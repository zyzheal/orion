const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'src/api/routes.ts');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
let changed = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('registerWithRoleGuard') && !line.includes("'/api/v1")) {
    // Replace '/something to '/api/v1/something in registerWithRoleGuard lines
    const newLine = line.replace(/'\/+/g, "'/api/v1/");
    if (newLine !== line) {
      lines[i] = newLine;
      changed++;
    }
  }
}

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Changed', changed, 'lines');
