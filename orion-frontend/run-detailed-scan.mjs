import { InteractionScanner } from '../docs/design-constraints/framework/core/ast-analyzer.ts';

console.log('\n' + '='.repeat(60));
console.log('           Orion 前端代码质量深度扫描报告');
console.log('='.repeat(60));

// 1. 交互完整性扫描
console.log('\n【1】交互完整性扫描 (AST 深度分析)');
console.log('-'.repeat(50));
const scanner = new InteractionScanner('./src/pages/');
const issues = await scanner.scan(80);

const bySeverity = scanner.groupBySeverity(issues);
const byType = scanner.groupByType(issues);

console.log(`扫描文件: 80 个`);
console.log(`发现问题: ${issues.length} 个`);
console.log(`  🔴 P0: ${bySeverity.P0.length}`);
console.log(`  🟡 P1: ${bySeverity.P1.length}`);

console.log(`\n按问题类型分布:`);
const typeNames1 = {
  'missing-feedback': '缺少操作反馈',
  'missing-loading': '缺少 loading 状态',
  'missing-empty': '缺少空状态引导',
  'missing-submit': '缺少表单提交按钮',
  'missing-edit': '缺少编辑入口'
};
for (const [type, list] of Object.entries(byType)) {
  const icon = type.includes('loading') || type.includes('feedback') ? '🔴' : '🟡';
  console.log(`  ${icon} ${typeNames1[type] || type}: ${list.length} 个`);
}

console.log(`\n🔝 P0 问题示例 (前5个):`);
bySeverity.P0.slice(0, 5).forEach((issue, i) => {
  console.log(`  ${i+1}. ${issue.message}`);
  console.log(`     文件: ${issue.file.split('/').slice(-2).join('/')}:${issue.line}`);
});

console.log(`\n🔶 P1 问题示例 (前3个):`);
bySeverity.P1.slice(0, 3).forEach((issue, i) => {
  console.log(`  ${i+1}. ${issue.message}`);
  console.log(`     文件: ${issue.file.split('/').slice(-2).join('/')}:${issue.line}`);
});
