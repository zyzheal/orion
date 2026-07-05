import { InteractionScanner } from '../docs/design-constraints/framework/core/ast-analyzer.ts';

async function main() {
  const scanner = new InteractionScanner('./src/pages/AIAgents/');
  const issues = await scanner.scan(10);

  console.log('\n========== AIAgents 问题详情 ==========\n');
  for (const issue of issues) {
    console.log(`[${issue.severity}] ${issue.type}`);
    console.log(`  位置: ${issue.file.split('/').pop()}:${issue.line}`);
    console.log(`  消息: ${issue.message}`);
    console.log(`  建议: ${issue.suggestion}\n`);
  }
}

main();
