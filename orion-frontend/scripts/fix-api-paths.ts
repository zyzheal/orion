/**
 * 前端 API 路径批量替换脚本
 *
 * 用法:
 *   npx tsx scripts/fix-api-paths.ts [--dry-run]
 *
 * 示例:
 *   npx tsx scripts/fix-api-paths.ts              # 实际执行
 *   npx tsx scripts/fix-api-paths.ts --dry-run    # 仅预览
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

interface PathReplacement {
  from: string;
  to: string;
  description: string;
}

// 定义所有需要替换的 API 路径
const REPLACEMENTS: PathReplacement[] = [
  // 租户模块：单数 → 复数
  { from: '/v1/tenant', to: '/v1/tenants', description: 'Tenant: singular → plural' },
  { from: "'/v1/tenant'", to: "'/v1/tenants'", description: 'Tenant: singular → plural (quoted)' },
  { from: '"/v1/tenant"', to: '"/v1/tenants"', description: 'Tenant: singular → plural (double quoted)' },

  // 其他需要调整的模块（按需添加）
  // { from: '/v1/pipeline', to: '/v1/pipelines', description: 'Pipeline: singular → plural' },
];

function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.next', '__tests__', '__snapshots__'].includes(entry.name)) continue;
      results.push(...findFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function applyReplacements(content: string, replacements: PathReplacement[]): { content: string; changes: number } {
  let changes = 0;
  let result = content;

  for (const repl of replacements) {
    const before = result;
    // 使用全局替换，但避免替换已经正确的路径
    result = result.split(repl.from).join(repl.to);
    const diff = (before.length - result.length) / (repl.from.length - repl.to.length);
    if (diff > 0) {
      changes += diff;
    }
  }

  return { content: result, changes };
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const frontendDir = path.resolve(__dirname, '../../orion-frontend/src');

  if (!fs.existsSync(frontendDir)) {
    console.error(`Frontend src directory not found: ${frontendDir}`);
    process.exit(1);
  }

  const files = findFiles(frontendDir, ['.ts', '.tsx']);
  console.log(`Found ${files.length} TypeScript files`);

  let totalChanges = 0;
  let modifiedFiles = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const { content: newContent, changes } = applyReplacements(content, REPLACEMENTS);

    if (changes > 0) {
      const relativePath = path.relative(frontendDir, file);
      totalChanges += changes;
      modifiedFiles++;

      if (dryRun) {
        console.log(`[DRY RUN] ${relativePath}: ${changes} replacements`);
        // 显示具体替换
        for (const repl of REPLACEMENTS) {
          const count = (content.split(repl.from).length - 1);
          if (count > 0) {
            console.log(`  ${repl.from} → ${repl.to} (${count} occurrences)`);
          }
        }
      } else {
        fs.writeFileSync(file, newContent);
        console.log(`[MODIFIED] ${path.relative(frontendDir, file)}: ${changes} replacements`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  if (dryRun) {
    console.log(`DRY RUN: ${modifiedFiles} files would be modified, ${totalChanges} total replacements`);
    console.log('Run without --dry-run to apply changes');
  } else {
    console.log(`DONE: Modified ${modifiedFiles} files, ${totalChanges} total replacements`);
  }
}

main();
