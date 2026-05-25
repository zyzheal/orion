import { InteractionScanner } from '../docs/design-constraints/framework/core/ast-analyzer.ts';

async function main() {
  const scanner = new InteractionScanner('./src/pages/');
  const issues = await scanner.scan(100);
  const bySeverity = scanner.groupBySeverity(issues);
  
  console.log('\n========== 真实问题扫描 ==========\n');
  console.log('P0 (loading/反馈):', bySeverity.P0.length);
  console.log('P1 (按钮/编辑):', bySeverity.P1.length);
  
  // 显示 P1 问题详情（这些更可能是真实的）
  console.log('\n========== P1 问题详情 ==========\n');
  bySeverity.P1.forEach(issue => {
    console.log(`[${issue.type}] ${issue.file.split('/').pop()}:${issue.line}`);
    console.log(`  ${issue.suggestion}\n`);
  });
}

main();
