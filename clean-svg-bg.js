const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'public', 'assets');
const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.svg'));

files.forEach(file => {
  const filepath = path.join(assetsDir, file);
  let svg = fs.readFileSync(filepath, 'utf8');

  // 只删除 opacity="0" 的透明路径（这些是去白底后的透明残留）
  // 保留所有实体颜色，让 mix-blend-mode 在网页上处理白底
  svg = svg.replace(/<path[^/>]*opacity="0"[^/>]*\/>/g, '');

  // 清理空标签
  svg = svg.replace(/>\s+</g, '><');

  fs.writeFileSync(filepath, svg);
  const size = (fs.statSync(filepath).size / 1024).toFixed(1);
  console.log(`${file}: ${size} KB`);
});
