/**
 * Batch-replace colors.light.* theme references with themeVars CSS variables.
 * Runs from /Users/heal/orion-design/orion-frontend
 *
 * Safety: reads each file, makes exact string substitutions, only writes if changed.
 * Dry-run mode: pass --dry-run to see what would change without writing.
 */
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

const PAGES_DIR = path.join(__dirname, '../src/pages');
const EXCLUDE_DIRS = new Set(['__tests__', 'deprecated']);

// Exact substitutions (order matters — longer patterns first)
const REPLACEMENTS = [
  ['colors.light.bg.primary',   'themeVars.bgPrimary'],
  ['colors.light.bg.secondary', 'themeVars.bgSecondary'],
  ['colors.light.bg.tertiary',  'themeVars.bgTertiary'],
  ['colors.light.bg.elevated',  'themeVars.bgElevated'],
  ['colors.light.border.heavy', 'themeVars.borderHeavy'],
  ['colors.light.border.light', 'themeVars.borderLight'],
  ['colors.light.border.default', 'themeVars.borderDefault'],
  ['colors.light.text.primary', 'themeVars.textPrimary'],
  ['colors.light.text.secondary', 'themeVars.textSecondary'],
  ['colors.light.text.tertiary', 'themeVars.textTertiary'],
  ['colors.light.text.disabled', 'themeVars.textDisabled'],
];

function collectFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  for (const [old, replacement] of REPLACEMENTS) {
    content = content.replaceAll(old, replacement);
  }

  if (content === original) return { changed: false, added: false };

  // Add themeVars import
  const importLine = "import { themeVars } from '@/tokens/theme-vars';";
  if (content.includes('themeVars') && !content.includes('@/tokens/theme-vars')) {
    // Try to add to existing colors import if present
    const colorsImportRegex = /(import \{ ([^}]*?) \} from '@\/tokens';)/;
    const colorsMatch = content.match(colorsImportRegex);
    if (colorsMatch) {
      const existing = colorsMatch[2].trim();
      let newImports = existing;
      if (!existing.includes('themeVars')) {
        newImports = existing + ', themeVars';
      }
      content = content.replace(colorsMatch[0], `import { ${newImports} } from '@/tokens';`);
      // Also add theme-vars import if themeVars not from /tokens
      if (!content.includes('@/tokens/theme-vars')) {
        // Check if we already added it
        if (!content.match(importLine)) {
          content = `import { themeVars } from '@/tokens/theme-vars';\n` + content;
        }
      }
    } else {
      // No colors import — add standalone
      if (!content.includes('@/tokens/theme-vars')) {
        content = `${importLine}\n` + content;
      }
    }
  }

  if (!DRY_RUN && content !== original) {
    fs.writeFileSync(filePath, content);
  }

  return { changed: true, lines: content.split('\n').length };
}

// Run
const files = collectFiles(PAGES_DIR);
let changedCount = 0;
const changedFiles = [];

for (const f of files) {
  const result = processFile(f);
  if (result.changed) {
    changedCount++;
    changedFiles.push(path.relative(path.join(__dirname, '..'), f));
  }
}

console.log(`\nTotal files scanned: ${files.length}`);
console.log(`Files changed: ${changedCount}`);
if (DRY_RUN) console.log('\n(DRY RUN — no files written)');
console.log('\nChanged files:');
for (const f of changedFiles) {
  console.log(`  ${f}`);
}