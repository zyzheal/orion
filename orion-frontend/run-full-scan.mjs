import { InteractionScanner } from '../docs/design-constraints/framework/core/ast-analyzer.ts';

// 交互完整性扫描
console.log('\n========== 1. 交互完整性扫描 ==========\n');
const scanner = new InteractionScanner('./src/pages/');
const issues = await scanner.scan(80);

const bySeverity = scanner.groupBySeverity(issues);
const byType = scanner.groupByType(issues);

console.log(`总问题数: ${issues.length}`);
console.log(`  P0: ${bySeverity.P0.length}`);
console.log(`  P1: ${bySeverity.P1.length}`);
console.log(`\n按类型分布:`);
for (const [type, list] of Object.entries(byType)) {
  const names = {
    'missing-feedback': '缺少操作反馈',
    'missing-loading': '缺少loading',
    'missing-empty': '缺少空状态',
    'missing-submit': '缺少提交按钮',
    'missing-edit': '缺少编辑入口'
  };
  console.log(`  ${names[type] || type}: ${list.length}`);
}

// 类型安全扫描
console.log('\n========== 2. 类型安全扫描 (any 检测) ==========\n');
const { TypeSafetyScanner } = await import('../docs/design-constraints/framework/core/type-safety-analyzer.ts');
const typeScanner = new TypeSafetyScanner('./src/pages/');
const typeIssues = await typeScanner.scan(50);
const typeBySeverity = typeScanner.groupBySeverity(typeIssues);
const typeByType = typeScanner.groupByType(typeIssues);

console.log(`总问题数: ${typeIssues.length}`);
console.log(`  P0: ${typeBySeverity.P0.length}`);
console.log(`  P1: ${typeBySeverity.P1.length}`);
console.log(`\n按类型分布:`);
for (const [type, list] of Object.entries(typeByType)) {
  const names = {
    'as-any': 'as any',
    'any-type': ': any',
    'any-array': 'any[]',
    'implicit-any': '隐式any'
  };
  console.log(`  ${names[type] || type}: ${list.length}`);
}

// Design Token 扫描
console.log('\n========== 3. Design Token 扫描 ==========\n');
const { DesignTokenScanner } = await import('../docs/design-constraints/framework/core/design-token-analyzer.ts');
const tokenScanner = new DesignTokenScanner('./src/pages/');
const tokenIssues = await tokenScanner.scan(50);
const tokenBySeverity = tokenScanner.groupBySeverity(tokenIssues);
const tokenByType = tokenScanner.groupByType(tokenIssues);

console.log(`总问题数: ${tokenIssues.length}`);
console.log(`  P0: ${tokenBySeverity.P0.length}`);
console.log(`  P1: ${tokenBySeverity.P1.length}`);
console.log(`\n按类型分布:`);
for (const [type, list] of Object.entries(tokenByType)) {
  const names = {
    'hardcoded-color': '硬编码颜色',
    'hardcoded-spacing': '硬编码间距',
    'hardcoded-radius': '硬编码圆角'
  };
  console.log(`  ${names[type] || type}: ${list.length}`);
}

// 汇总
console.log('\n========== 汇总报告 ==========\n');
const totalP0 = bySeverity.P0.length + typeBySeverity.P0.length + tokenBySeverity.P0.length;
const totalP1 = bySeverity.P1.length + typeBySeverity.P1.length + tokenBySeverity.P1.length;
console.log(`| 扫描项 | P0 | P1 | 总计 |`);
console.log(`|--------|----|----|------|`);
console.log(`| 交互完整性 | ${bySeverity.P0.length} | ${bySeverity.P1.length} | ${issues.length} |`);
console.log(`| 类型安全 | ${typeBySeverity.P0.length} | ${typeBySeverity.P1.length} | ${typeIssues.length} |`);
console.log(`| Design Token | ${tokenBySeverity.P0.length} | ${tokenBySeverity.P1.length} | ${tokenIssues.length} |`);
console.log(`|--------|----|----|------|`);
console.log(`| **合计** | **${totalP0}** | **${totalP1}** | **${issues.length + typeIssues.length + tokenIssues.length}** |`);

