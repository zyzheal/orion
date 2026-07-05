import { InteractionScanner } from './docs/design-constraints/framework/core/ast-analyzer.ts';

async function main() {
  const scanner = new InteractionScanner('./orion-frontend/src/pages/');
  const issues = await scanner.scan(30);

  console.log('\n========== AST 深度扫描结果 ==========\n');
  console.log('总问题数:', issues.length);

  const bySeverity = scanner.groupBySeverity(issues);
  console.log('\n按严重程度:');
  console.log('  P0:', bySeverity.P0.length);
  console.log('  P1:', bySeverity.P1.length);
  console.log('  P2:', bySeverity.P2.length);

  const byType = scanner.groupByType(issues);
  console.log('\n按问题类型:');
  for (const [type, list] of Object.entries(byType)) {
    console.log('  ' + type + ':', list.length);
  }

  console.log('\n--- 示例问题 (前5个) ---');
  issues.slice(0, 5).forEach((issue, i) => {
    console.log(`\n${i+1}. [${issue.severity}] ${issue.message}`);
    console.log('   文件:', issue.file.replace('/Users/heal/orion-design/', ''));
    console.log('   建议:', issue.suggestion);
  });
}

main().catch(console.error);