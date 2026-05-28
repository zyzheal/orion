import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

// Extended color mapping
const colorMap = {
  // Primary
  '#3370E6': 'colors.primary[500]',
  '#1890ff': 'colors.primary[500]',
  '#1677ff': 'colors.primary[500]',
  '#2B5DD6': 'colors.primary[600]',
  '#1F4BB5': 'colors.primary[700]',
  '#EBF0FB': 'colors.primary[50]',
  '#e6f4ff': 'colors.primary[50]',
  '#f0f5ff': 'colors.primary[50]',
  '#bae0ff': 'colors.primary[100]',
  '#91caff': 'colors.primary[200]',
  '#69b1ff': 'colors.primary[300]',
  '#4096ff': 'colors.primary[400]',

  // Success
  '#52c41a': 'colors.success[500]',
  '#73d13d': 'colors.success[400]',
  '#95de64': 'colors.success[300]',
  '#b7eb8f': 'colors.success[200]',
  '#d9f7be': 'colors.success[100]',
  '#f6ffed': 'colors.success[50]',
  '#389e0d': 'colors.success[600]',
  '#237804': 'colors.success[700]',

  // Warning
  '#faad14': 'colors.warning[500]',
  '#ffc53d': 'colors.warning[400]',
  '#ffd666': 'colors.warning[300]',
  '#ffe58f': 'colors.warning[200]',
  '#fff1b8': 'colors.warning[100]',
  '#fffbe6': 'colors.warning[50]',
  '#d48806': 'colors.warning[600]',
  '#ad6800': 'colors.warning[700]',

  // Error
  '#f5222d': 'colors.error[500]',
  '#ff4d4f': 'colors.error[400]',
  '#ff7875': 'colors.error[300]',
  '#ffa39e': 'colors.error[200]',
  '#ffccc7': 'colors.error[100]',
  '#fff1f0': 'colors.error[50]',
  '#cf1322': 'colors.error[600]',
  '#a8071a': 'colors.error[700]',
  '#b50a0a': 'colors.error[700]',

  // Info
  '#3a98f4': 'colors.info[500]',
  '#69b1ff': 'colors.info[400]',
  '#91caff': 'colors.info[300]',
  '#bae0ff': 'colors.info[200]',
  '#e6f4ff': 'colors.info[100]',
  '#096dd9': 'colors.info[600]',
  '#0050b3': 'colors.info[700]',

  // Purple
  '#7C5CFC': 'colors.purple[500]',
  '#9254de': 'colors.purple[500]',
  '#b37feb': 'colors.purple[400]',
  '#d3adf7': 'colors.purple[300]',
  '#efdbff': 'colors.purple[100]',

  // Neutral
  '#8c8c8c': 'colors.neutral[500]',
  '#999': 'colors.neutral[500]',
  '#999999': 'colors.neutral[500]',
  '#bfbfbf': 'colors.neutral[400]',
  '#d9d9d9': 'colors.neutral[300]',
  '#e8e8e8': 'colors.neutral[200]',
  '#f0f0f0': 'colors.neutral[200]',
  '#f5f5f5': 'colors.neutral[100]',
  '#fafafa': 'colors.neutral[50]',
  '#fafbfc': 'colors.neutral[50]',
  '#1f1f1f': 'colors.neutral[900]',
  '#1f2329': 'colors.neutral[800]',
  '#262626': 'colors.neutral[800]',
  '#333': 'colors.neutral[800]',
  '#333333': 'colors.neutral[800]',
  '#434343': 'colors.neutral[700]',
  '#595959': 'colors.neutral[600]',
  '#646a73': 'colors.neutral[600]',
  '#ffffff': 'colors.neutral[0]',
  '#fff': 'colors.neutral[0]',
  '#000000': 'colors.neutral[1000]',
  '#000': 'colors.neutral[1000]',

  // Badge colors (gold, silver, bronze, platinum)
  '#ffd700': 'colors.warning[400]',  // gold
  '#c0c0c0': 'colors.neutral[400]',  // silver
  '#cd7f32': '#cd7f32',  // bronze - keep as-is (unique)
  '#e5e4e2': '#e5e4e2',  // platinum - keep as-is (unique)
  '#d7ba7d': '#d7ba7d',  // gold variant - keep as-is

  // Syntax highlighting colors
  '#569cd6': '#569cd6',  // blue keyword
  '#c586c0': '#c586c0',  // purple keyword
  '#6a9955': '#6a9955',  // green comment
  '#4dc9b0': '#4dc9b0',  // teal
  '#9679': '#9679',      // incomplete hex, keep as-is
};

// Find files with hardcoded colors
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
    // Skip if token is same as hex (keep as-is)
    if (token === hex) continue;

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

    // Pattern 3: In template literal: `${...}#fff${...}`
    const templateRegex = new RegExp(`(?<!\\w)${escapedHex}(?!\\w)`, 'g');
    result = result.replace(templateRegex, (match) => {
      if (match.includes('colors.')) return match;
      replacements++;
      return token;
    });
  }

  if (replacements > 0) {
    // Add colors import if needed
    if (!hasColorsImport && result.includes('colors.')) {
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
