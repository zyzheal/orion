import { CodeQualityScanner } from '../docs/design-constraints/framework/core/code-quality-analyzer.ts';

async function main() {
  const scanner = new CodeQualityScanner('./src/pages/');
  const issues = await scanner.scan(50);
  const bySeverity = scanner.groupBySeverity(issues);
  const byType = scanner.groupByType(issues);

  console.log('\n' + '='.repeat(60));
  console.log('           代码质量深度扫描报告');
  console.log('='.repeat(60));

  console.log('\n【问题统计】');
  console.log(`  🔴 P0 (严重): ${bySeverity.P0.length}`);
  console.log(`  🟡 P1 (警告): ${bySeverity.P1.length}`);
  console.log(`  🟢 P2 (建议): ${bySeverity.P2.length}`);
  console.log(`  📊 总计: ${issues.length}`);

  console.log('\n【按类型分布】');
  const typeNames = {
    'console-log': 'Console 调试代码',
    'any-type': 'Any 类型使用',
    'hardcoded-value': '硬编码值',
    'magic-number': '魔法数字',
    'missing-key': '缺少 Key',
    'empty-block': '空代码块',
    'inline-function': '内联函数',
    'nested-loop': '嵌套循环',
    'deep-nesting': '代码嵌套过深',
    'eval-usage': 'Eval 使用',
    'dangerous-html': '危险 HTML 操作',
    'sql-concat': 'SQL 注入风险',
    'secret-hardcoded': '硬编码密钥',
    'unused-variable': '未使用变量',
    'unused-import': '未使用导入',
  };

  for (const [type, list] of Object.entries(byType)) {
    const icon = type.includes('eval') || type.includes('dangerous') || type.includes('sql') || type.includes('secret') || type.includes('any') 
      ? '🔴' : type.includes('key') || type.includes('console') 
      ? '🟡' : '🟢';
    console.log(`  ${icon} ${typeNames[type] || type}: ${list.length}`);
  }

  console.log('\n【P0 严重问题示例】');
  bySeverity.P0.slice(0, 5).forEach((issue, i) => {
    console.log(`\n  ${i + 1}. ${issue.message}`);
    console.log(`     文件: ${issue.file.split('/').slice(-2).join('/')}:${issue.line}`);
    if (issue.code) console.log(`     代码: ${issue.code}`);
  });

  console.log('\n【P1 警告问题示例】');
  bySeverity.P1.slice(0, 5).forEach((issue, i) => {
    console.log(`\n  ${i + 1}. ${issue.message}`);
    console.log(`     文件: ${issue.file.split('/').slice(-2).join('/')}:${issue.line}`);
  });
}

main();
