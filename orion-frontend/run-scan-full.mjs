import { InteractionScanner } from '../docs/design-constraints/framework/core/ast-analyzer.ts';

const scanner = new InteractionScanner('./src/pages/');
const issues = await scanner.scan(100);

console.log('\n========== AST 深度扫描结果 (100个文件) ==========\n');
console.log('总问题数:', issues.length);

const bySeverity = scanner.groupBySeverity(issues);
console.log('\n按严重程度:');
console.log('  P0:', bySeverity.P0.length);
console.log('  P1:', bySeverity.P1.length);
console.log('  P2:', bySeverity.P2.length);

const byType = scanner.groupByType(issues);
console.log('\n按问题类型:');
for (const [type, list] of Object.entries(byType)) {
  const typeName = {
    'missing-feedback': '缺少操作反馈',
    'missing-loading': '缺少loading状态',
    'missing-empty': '缺少空状态',
    'missing-submit': '缺少提交按钮',
    'missing-edit': '缺少编辑入口'
  };
  console.log('  ' + (typeName[type] || type) + ':', list.length);
}

console.log('\n--- P0 问题 (前3个) ---');
bySeverity.P0.slice(0, 3).forEach((issue, i) => {
  console.log(`\n${i+1}. [${issue.severity}] ${issue.message}`);
  console.log('   文件:', issue.file.replace('/Users/heal/orion-design/orion-frontend/', ''));
  console.log('   建议:', issue.suggestion);
});

console.log('\n--- P1 问题 (前5个) ---');
bySeverity.P1.slice(0, 5).forEach((issue, i) => {
  console.log(`\n${i+1}. [${issue.severity}] ${issue.message}`);
  console.log('   文件:', issue.file.replace('/Users/heal/orion-design/orion-frontend/', ''));
  console.log('   建议:', issue.suggestion);
});
