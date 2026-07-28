// =============================================================================
// API 路径迁移脚本
//
// 用途：将所有前端 API 文件中的硬编码路径 /api/v1/xxx 批量替换为 /xxx
// 运行：npx ts-node scripts/migrate-api-paths.ts
//
// 迁移规则：
//   '/api/v1/xxx'  →  '/xxx'
//   '/api/xxx'     →  '/xxx' （如果 baseURL 是 /api/v1）
//   "api/v1/xxx"   →  "xxx"
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const API_DIR = path.resolve(__dirname, '../src/api');

// 需要处理的文件（排除 client.ts 和 types.ts）
const files = fs.readdirSync(API_DIR)
  .filter(f => f.endsWith('.ts') && !['client.ts', 'types.ts', 'ci-types.ts'].includes(f));

console.log(`\n🔍 找到 ${files.length} 个 API 文件需要扫描\n`);

let totalReplacements = 0;
let changedFiles = 0;

for (const file of files) {
  const filePath = path.join(API_DIR, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // 替换模式1: '/api/v1/xxx' → '/xxx'
  content = content.replace(/['"]\/api\/v1\/([^'"]+)['"]/g, (match, p1) => {
    totalReplacements++;
    return `'/${p1}'`;
  });

  // 替换模式2: `/api/v1/${xxx}` → `/${xxx}`
  content = content.replace(/`\/api\/v1\/(\$\{[^}]+\})`/g, (match, p1) => {
    totalReplacements++;
    return `/${p1}`;
  });

  // 替换模式3: 注释中的 /api/v1/xxx 路径提示
  content = content.replace(/\/api\/v1\//g, '/');

  // 替换模式4: 确保 import 使用相对路径风格的 api
  // 旧: api.get('/api/v1/xxx')
  // 新: api.get('/xxx')
  content = content.replace(/api\.(get|post|put|delete|patch)\(['"]\/api\/v1\//g, (match, method) => {
    totalReplacements++;
    return `api.${method}('/`;
  });

  if (content !== original) {
    changedFiles++;
    fs.writeFileSync(filePath, content, 'utf-8');
    const diffCount = (content.match(/'\/[a-z]/g) || []).length - (original.match(/'\/[a-z]/g) || []).length;
    console.log(`  ✅ ${file}: ${diffCount} 处替换`);
  }
}

console.log(`\n📊 迁移统计:`);
console.log(`  - 扫描文件: ${files.length}`);
console.log(`  - 修改文件: ${changedFiles}`);
console.log(`  - 总替换数: ${totalReplacements}`);
console.log(`\n⚠️  请手动检查以下文件确保路径正确:`);
console.log(`  1. 检查 client.ts 中引用 /api/v1 的路径`);
console.log(`  2. 检查 refresh token 端点路径`);
console.log(`  3. 运行 'npm run type-check' 验证类型`);
console.log(`  4. 运行 'npm test' 验证测试通过\n`);
