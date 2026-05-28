import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';

// Color mapping
const colorMap = {
  '#3370E6': 'colors.primary[500]',
  '#1890ff': 'colors.primary[500]',
  '#1677ff': 'colors.primary[500]',
  '#EBF0FB': 'colors.primary[50]',
  '#e6f4ff': 'colors.primary[50]',
  '#52c41a': 'colors.success[500]',
  '#73d13d': 'colors.success[400]',
  '#faad14': 'colors.warning[500]',
  '#f5222d': 'colors.error[500]',
  '#ff4d4f': 'colors.error[400]',
  '#3a98f4': 'colors.info[500]',
  '#7C5CFC': 'colors.purple[500]',
  '#8c8c8c': 'colors.neutral[500]',
  '#999': 'colors.neutral[500]',
  '#999999': 'colors.neutral[500]',
  '#bfbfbf': 'colors.neutral[400]',
  '#d9d9d9': 'colors.neutral[300]',
  '#f0f0f0': 'colors.neutral[200]',
  '#f5f5f5': 'colors.neutral[100]',
  '#fafafa': 'colors.neutral[50]',
  '#1f1f1f': 'colors.neutral[900]',
  '#262626': 'colors.neutral[800]',
  '#434343': 'colors.neutral[700]',
  '#595959': 'colors.neutral[600]',
  '#ffffff': 'colors.neutral[0]',
  '#fff': 'colors.neutral[0]',
  '#000000': 'colors.neutral[1000]',
  '#000': 'colors.neutral[1000]',
};

// Find all TSX/TS files with hardcoded colors (excluding tokens/, node_modules, __tests__)
const files = execSync(
  `grep -rl "#[0-9a-fA-F]\\{3,6\\}" src/ --include="*.tsx" --include="*.ts" | grep -v "tokens/" | grep -v "node_modules" | grep -v "__tests__" | grep -v "\\.test\\."`,
  { encoding: 'utf-8', cwd: '/Users/heal/orion-design/orion-frontend' }
).trim().split('\n').filter(Boolean);

let totalReplacements = 0;
let filesModified = 0;

for (const file of files) {
  const filePath = join('/Users/heal/orion-design/orion-frontend', file);
  let content;
  try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }

  let result = content;
  let replacements = 0;

  // Check if colors is already imported
  const hasColorsImport = content.includes("from '@/tokens/colors'") ||
                           content.includes('from "@/tokens/colors"') ||
                           content.includes("from '@/tokens'") ||
                           content.includes('from "@/tokens"');

  // Replace each color
  for (const [hex, token] of Object.entries(colorMap)) {
    const escapedHex = hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern 1: JSX attribute: fill="#fff" or color="#fff"
    const jsxRegex = new RegExp(`(\\w+)=['"]${escapedHex}['"]`, 'gi');
    result = result.replace(jsxRegex, (match, attr) => {
      replacements++;
      return `${attr}={${token}}`;
    });

    // Pattern 2: Object property: color: '#fff' or background: "#fff"
    const objRegex = new RegExp(`(\\w+):\\s*['"]${escapedHex}['"]`, 'gi');
    result = result.replace(objRegex, (match, prop) => {
      replacements++;
      return `${prop}: ${token}`;
    });

    // Pattern 3: String in template literal or concatenation
    const strRegex = new RegExp(`['"]${escapedHex}['"]`, 'g');
    result = result.replace(strRegex, (match) => {
      // Only replace if not already replaced by patterns above
      if (match.includes('colors.')) return match;
      replacements++;
      return token;
    });
  }

  if (replacements > 0) {
    // Add colors import if needed
    if (!hasColorsImport) {
      // Find the right place to add import
      const importLines = result.split('\n');
      let lastImportIdx = -1;
      for (let j = 0; j < importLines.length; j++) {
        if (importLines[j].match(/^import\s+/)) {
          lastImportIdx = j;
        }
      }

      const importLine = `import { colors } from '@/tokens';`;

      if (lastImportIdx >= 0) {
        importLines.splice(lastImportIdx + 1, 0, importLine);
      } else {
        importLines.unshift(importLine);
      }
      result = importLines.join('\n');
    }

    writeFileSync(filePath, result, 'utf-8');
    totalReplacements += replacements;
    filesModified++;
    console.log(`  ${file}: ${replacements} replacements`);
  }
}

console.log(`\nTotal: ${totalReplacements} replacements in ${filesModified} files`);
