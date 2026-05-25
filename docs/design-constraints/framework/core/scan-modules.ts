/**
 * 批量扫描前端模块功能缺失
 */
import { QuickScanner } from './quick-analyzer';
import * as fs from 'fs';
import * as path from 'path';

const pagesDir = '/Users/heal/orion-design/orion-frontend/src/pages';

async function scanModules() {
  const dirs = fs.readdirSync(pagesDir).filter(d => {
    return fs.statSync(path.join(pagesDir, d)).isDirectory() && !d.startsWith('_');
  });

  console.log('=== 8大菜单模块功能缺失快速分析 ===\n');

  const allResults: any = {};
  const issueTypes: any = {};

  // 扫描每个模块 (每个取前3个文件)
  for (const dir of dirs) {
    const modulePath = path.join(pagesDir, dir);

    try {
      const scanner = new QuickScanner();
      const results = await scanner.scan(modulePath, 3);

      const total = results.reduce((sum, r) => sum + r.issues.length, 0);
      const p0 = results.reduce((sum, r) => sum + r.stats.p0, 0);
      const p1 = results.reduce((sum, r) => sum + r.stats.p1, 0);

      if (total > 0) {
        allResults[dir] = { total, p0, p1 };

        // 统计问题类型
        for (const r of results) {
          for (const issue of r.issues) {
            if (!issueTypes[issue.id]) issueTypes[issue.id] = 0;
            issueTypes[issue.id]++;
          }
        }
      }
    } catch (e) {
      // skip
    }
  }

  // 按问题数排序
  const sorted = Object.entries(allResults).sort((a: any, b: any) => b[1].total - a[1].total);

  console.log('## 问题最多的模块 TOP 20\n');
  console.log('| 排名 | 模块 | P0 | P1 | 总问题 |');
  console.log('|------|------|----|----|--------|');

  sorted.slice(0, 20).forEach(([module, stats]: [string, any], i) => {
    console.log(`| ${i + 1} | ${module} | ${stats.p0} | ${stats.p1} | ${stats.total} |`);
  });

  console.log('\n## 问题类型分布\n');
  console.log('| 问题ID | 描述 | 出现次数 |');
  console.log('|--------|------|----------|');

  const descMap: Record<string, string> = {
    'A2-12': '缺少loading',
    'A2-02': '缺少反馈',
    'A2-14': '缺少空状态',
    'A3-16': '缺少确认',
    'D3-01': '硬编码颜色',
    'A1-06': 'any类型',
    'B1-07': '敏感信息'
  };

  Object.entries(issueTypes).sort((a: any, b: any) => b[1] - a[1]).forEach(([id, count]) => {
    console.log(`| ${id} | ${descMap[id] || id} | ${count} |`);
  });

  console.log('\n---\n');
  console.log(`总计: ${sorted.length} 个模块, ${Object.values(allResults).reduce((s: any, x: any) => s + x.total, 0)} 个问题`);
}

scanModules();