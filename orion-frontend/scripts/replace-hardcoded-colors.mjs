#!/usr/bin/env node
/**
 * Replace hardcoded hex colors in frontend page files with Design Token references.
 * Skips .bak files, test files, and files that don't need changes.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Color mapping: hex value → token reference
const COLOR_MAP = {
  // Primary blues
  '#3370E6': 'colors.primary[500]',
  '#3370e6': 'colors.primary[500]',
  '#3370FF': 'colors.primary[500]',
  '#1677ff': 'colors.primary[500]',
  '#1890ff': 'colors.primary[500]',
  '#0089FF': 'colors.primary[500]',

  // Success greens
  '#52c41a': 'colors.success[500]',
  '#389e0d': 'colors.success[600]',
  '#237804': 'colors.success[700]',
  '#b7eb8f': 'colors.success[200]',
  '#f6ffed': 'colors.success[50]',

  // Warning
  '#faad14': 'colors.warning[500]',
  '#d48806': 'colors.warning[600]',
  '#fffbe6': 'colors.warning[50]',
  '#ffe58f': 'colors.warning[300]',

  // Error reds
  '#f5222d': 'colors.error[500]',
  '#cf1322': 'colors.error[600]',
  '#ff4d4f': 'colors.error[400]',
  '#fff1f0': 'colors.error[50]',
  '#ffa39e': 'colors.error[200]',
  '#f44747': 'colors.error[400]',

  // Purple
  '#722ed1': 'colors.purple[600]',
  '#722ED1': 'colors.purple[600]',
  '#7C5CFC': 'colors.purple[500]',

  // Info
  '#3a98f4': 'colors.info[500]',
  '#91d5ff': 'colors.info[200]',
  '#e6f7ff': 'colors.info[50]',

  // Neutral
  '#ffffff': 'colors.neutral[0]',
  '#fafafa': 'colors.neutral[50]',
  '#F5F5F7': 'colors.neutral[100]',
  '#f0f0f0': 'colors.neutral[200]',
  '#d9d9d9': 'colors.neutral[300]',
  '#d4d4d4': 'colors.neutral[300]',
  '#bfbfbf': 'colors.neutral[400]',
  '#999': 'colors.neutral[500]',
  '#8c8c8c': 'colors.neutral[500]',
  '#888': 'colors.neutral[500]',
  '#808080': 'colors.neutral[500]',
  '#595959': 'colors.neutral[600]',
  '#434343': 'colors.neutral[700]',
  '#262626': 'colors.neutral[800]',
  '#1f1f1f': 'colors.neutral[900]',
  '#1e1e1e': 'colors.neutral[950]',
  '#141414': 'colors.neutral[950]',

  // Other Ant Design colors
  '#fa541c': 'colors.error[600]',  // volcano
  '#fa8c16': 'colors.warning[600]',  // orange
  '#13C2C2': 'colors.info[400]',  // cyan
};

// Colors to skip (domain-specific, not in design token system)
const SKIP_COLORS = new Set([
  '#ffd700',  // gold (community badges)
  '#e5e4e2',  // platinum (community badges)
  '#c0c0c0',  // silver (community badges)
  '#cd7f32',  // bronze (community badges)
  '#d7ba7d',  // VS Code theme
  '#c586c0',  // VS Code theme
  '#6a9955',  // VS Code theme
  '#569cd6',  // VS Code theme
  '#0C1B3A',  // domain-specific dark
  '#b50a0a',  // domain-specific red
  '#EB2F96',  // magenta
  '#3f8600',  // lime
  '#2BAE67',  // custom green
  '#4dc9b0',  // custom teal
  '#fff566',  // yellow highlight
  '#fafbfc',  // github bg
  '#f0f5ff',  // antd light blue bg
  '#fff2f0',  // antd light red bg
]);

const PAGES_DIR = 'orion-frontend/src/pages';

function findFiles(dir) {
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      result.push(...findFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      if (entry.name.endsWith('.bak') || entry.name.includes('.bak')) continue;
      result.push(fullPath);
    }
  }
  return result;
}

function replaceColorsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  let replacements = [];

  // Check if file already imports colors
  const hasColorsImport = /import\s*\{[^}]*colors[^}]*\}\s*from\s*['"]@\/tokens['"]/.test(content) ||
    /import\s*colors\s*from\s*['"]@\/tokens\/colors['"]/.test(content);

  // Build regex that matches all color values (longest first to avoid partial matches)
  const colorKeys = Object.keys(COLOR_MAP)
    .filter(c => !SKIP_COLORS.has(c))
    .sort((a, b) => b.length - a.length);  // longest first

  for (const hexColor of colorKeys) {
    const token = COLOR_MAP[hexColor];
    // Escape special regex chars in hex color
    const escaped = hexColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match in various contexts:
    // 1. String value: '#hex' or "#hex"
    // 2. Template literal: `...${'#hex'}...`
    const regex = new RegExp(`(['"])${escaped}\\1`, 'gi');

    const newContent = content.replace(regex, (match, quote, offset) => {
      // Skip if inside a comment
      const lineStart = content.lastIndexOf('\n', offset) + 1;
      const line = content.substring(lineStart, content.indexOf('\n', offset));
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) {
        return match;
      }

      // Skip if inside a test mock or import
      if (filePath.includes('test') || filePath.includes('spec')) {
        return match;
      }

      // Determine context: JSX attribute or object property?
      // Look at character before the opening quote
      const beforeQuote = offset > 0 ? content[offset - 1] : '';

      modified = true;
      replacements.push(`${hexColor} → ${token}`);

      if (beforeQuote === '=') {
        // JSX attribute: attr='#xxx' → attr={colors.xxx}
        return `{${token}}`;
      } else if (beforeQuote === '{') {
        // JSX expression: attr={'#xxx'} → attr={colors.xxx}
        return token;
      } else {
        // Object property or variable: key: '#xxx' → key: colors.xxx
        return token;
      }
    });

    content = newContent;
  }

  if (!modified) return null;

  // Add colors import if not present
  if (!hasColorsImport) {
    // Find the end of the last import block (handles multi-line imports)
    const lines = content.split('\n');
    let insertIdx = 0;
    let inImportBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ')) {
        inImportBlock = true;
        insertIdx = i + 1;
        // Check if this is a single-line import (contains 'from' or ends with ';')
        if (line.includes(" from ") || line.endsWith(';')) {
          inImportBlock = false;
        }
      } else if (inImportBlock) {
        insertIdx = i + 1;
        if (line.includes(" from ") || line.endsWith(';')) {
          inImportBlock = false;
        }
      }
    }

    lines.splice(insertIdx, 0, `import { colors } from '@/tokens';`);
    content = lines.join('\n');
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return replacements;
}

// Main
const files = findFiles(PAGES_DIR);
let totalFiles = 0;
let totalReplacements = 0;
const fileResults = [];

for (const file of files) {
  const replacements = replaceColorsInFile(file);
  if (replacements && replacements.length > 0) {
    totalFiles++;
    totalReplacements += replacements.length;
    fileResults.push({ file, replacements });
  }
}

// Print results
console.log(`\n=== Design Token Replacement Results ===\n`);
console.log(`Files scanned: ${files.length}`);
console.log(`Files modified: ${totalFiles}`);
console.log(`Total replacements: ${totalReplacements}\n`);

for (const { file, replacements } of fileResults) {
  console.log(`\n${file} (${replacements.length} replacements):`);
  // Group by replacement type
  const grouped = {};
  for (const r of replacements) {
    const key = r;
    grouped[key] = (grouped[key] || 0) + 1;
  }
  for (const [key, count] of Object.entries(grouped)) {
    console.log(`  ${key}${count > 1 ? ` (×${count})` : ''}`);
  }
}
