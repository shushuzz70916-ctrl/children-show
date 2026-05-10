# Idle Input Timeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the pre-send idle return logic so the message screen returns after 2 minutes with no input changes, instead of 2 minutes after entering the screen.

**Architecture:** Keep the feature inside `public/index.html` and reuse the existing idle timer entry points. Treat the input field's `input` event as the single source of truth for resetting the 2-minute pre-send idle timer, while leaving the post-send 60-second countdown untouched.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Express static server, browser DOM events

---

## File Structure

- Modify: `public/index.html` — update the pre-send idle timer behavior, attach the input-driven reset, and keep the current post-send countdown behavior intact.
- Verify: `package.json` — confirms there is no automated test script, so validation must use manual browser testing with the existing `npm run dev` flow.
- Reference: `docs/superpowers/specs/2026-05-10-idle-input-timeout-design.md` — approved behavior contract for this change.

### Task 1: Bind pre-send idle timeout to input events

**Files:**
- Modify: `public/index.html`
- Reference: `docs/superpowers/specs/2026-05-10-idle-input-timeout-design.md`

- [ ] **Step 1: Write the failing manual test checklist**

Create this checklist before editing code:

```md
Manual test checklist:
1. Open a role and do not type anything for 2 minutes.
   Expected: the app returns to the role selection screen.
2. Open a role and type one character every 30-60 seconds for more than 2 minutes.
   Expected: the app stays on the message screen the whole time.
3. Type several characters, stop typing, and wait 2 minutes.
   Expected: the app returns to the role selection screen.
4. Click the input without typing anything and wait 2 minutes.
   Expected: the app still returns to the role selection screen.
5. Send a message successfully.
   Expected: the existing 60-second post-send countdown still appears and works.
```

- [ ] **Step 2: Run the app to verify the current behavior fails the checklist**

Run:

```bash
npm run dev
```

Expected current failures:
- In checklist item 2, the page can still return 2 minutes after entering the screen even if input activity happened earlier.
- In checklist item 3, the timer is not clearly tied to the last input event.

- [ ] **Step 3: Update the idle timer helper to mean “start or reset”**

In `public/index.html`, keep the existing `IDLE_TIMEOUT` and `idleTimer`, but make `startIdleTimer()` always clear the old timeout and create a fresh one:

```js
const IDLE_TIMEOUT = 120;
let idleTimer = null;

function startIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (preSendHint.style.display !== 'none') {
      showRolesView();
    }
  }, IDLE_TIMEOUT * 1000);
}

function clearIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = null;
}
```

- [ ] **Step 4: Reset the idle timer only when the input value changes**

Add an `input` event listener near the existing `sendBtn` / `keydown` listeners in `public/index.html`:

```js
msgInput.addEventListener('input', () => {
  if (currentRoleIdx >= 0 && preSendHint.style.display !== 'none') {
    startIdleTimer();
  }
});
```

This keeps `focus`, `click`, and other non-content interactions from extending the timer.

- [ ] **Step 5: Keep message-screen entry behavior as the initial 2-minute window**

Ensure `showMessageView(roleIdx)` still starts the idle timer when the user first enters a role, so a child who never types still returns automatically:

```js
function showMessageView(roleIdx) {
  currentRoleIdx = roleIdx;
  const role = ROLES[roleIdx];
  navRoleName.textContent = role.name;
  navRoleAlias.textContent = role.alias || ' ';
  viewRoles.style.display = 'none';
  viewMessages.style.display = 'flex';
  musicBtn.style.display = 'none';
  msgInput.value = '';

  messageList.style.display = 'none';
  messageList.innerHTML = '';
  preSendHint.style.display = 'flex';
  countdownBarWrap.style.display = 'none';
  countdownText.style.display = 'none';
  stopCountdown();
  startIdleTimer();
}
```

- [ ] **Step 6: Keep the post-send behavior unchanged**

Verify the send-success branch still clears the pre-send idle timer when the first successful message unlocks the list:

```js
if (preSendHint.style.display !== 'none') {
  clearIdleTimer();
  preSendHint.style.display = 'none';
  messageList.style.display = 'flex';
  await loadMessages(role.id);
} else {
  appendMessage(data, true);
}
startCountdown();
```

Do not merge the idle timer with `startCountdown()`.

- [ ] **Step 7: Run the manual validation after the code change**

Run:

```bash
npm run dev
```

Then test the browser against this exact checklist:

```md
1. No typing for 2 minutes → returns to role selection.
2. Input changes within each 2-minute window → stays on message screen.
3. Stop typing for 2 minutes after entering text → returns to role selection.
4. Focus/click without changing text → still returns after 2 minutes.
5. Successful send → message list unlocks and 60-second countdown still works.
```

Expected result: all five checks pass.

- [ ] **Step 8: Commit the finished code change**

Run:

```bash
git add public/index.html
git commit -m "feat: reset idle timeout on message input"
```

Expected result: one commit containing only the message-screen idle timeout change.

## Self-Review

- Spec coverage check: the plan covers the preserved unlock gate, the input-only reset rule, the unchanged 60-second post-send countdown, and manual validation for the agreed edge cases.
- Placeholder scan: no TODO/TBD markers remain; each action includes concrete code or exact commands.
- Type consistency check: the plan uses the existing names `IDLE_TIMEOUT`, `idleTimer`, `startIdleTimer()`, `clearIdleTimer()`, `showMessageView()`, `preSendHint`, `msgInput`, and `startCountdown()` consistently.
