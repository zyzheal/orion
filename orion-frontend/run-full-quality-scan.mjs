import { CodeQualityScanner } from '../docs/design-constraints/framework/core/code-quality-analyzer.ts';

async function main() {
  const scanner = new CodeQualityScanner('./src/pages/');
  const issues = await scanner.scan(100);
  const bySeverity = scanner.groupBySeverity(issues);
  const byType = scanner.groupByType(issues);

  console.log('\n' + '='.repeat(70));
  console.log('           Orion 前端代码质量深度扫描报告 (100文件)');
  console.log('='.repeat(70));

  console.log('\n📊 【总体统计】');
  console.log(`   扫描文件: 100 个`);
  console.log(`   发现问题: ${issues.length} 个`);
  console.log(`   🔴 P0 (严重): ${bySeverity.P0.length}`);
  console.log(`   🟡 P1 (警告): ${bySeverity.P1.length}`);
  console.log(`   🟢 P2 (建议): ${bySeverity.P2.length}`);

  console.log('\n📋 【按类型分布】');
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

  const sortedTypes = Object.entries(byType).sort((a, b) => b[1].length - a[1].length);
  for (const [type, list] of sortedTypes) {
    const icon = type.includes('eval') || type.includes('dangerous') || type.includes('sql') || type.includes('secret') 
      ? '🔴' : type.includes('any') || type.includes('key') || type.includes('console') || type.includes('deep') || type.includes('nested')
      ? '🟡' : '🟢';
    console.log(`   ${icon} ${typeNames[type] || type}: ${list.length}`);
  }

  console.log('\n🔥 【P0 严重问题】');
  if (bySeverity.P0.length === 0) {
    console.log('   ✅ 无严重安全问题');
  } else {
    bySeverity.P0.forEach((issue, i) => {
      console.log(`\n   ${i + 1}. ${issue.message}`);
      console.log(`      文件: ${issue.file.split('/').slice(-2).join('/')}:${issue.line}`);
      if (issue.suggestion) console.log(`      建议: ${issue.suggestion}`);
    });
  }

  console.log('\n⚠️ 【P1 警告问题 Top 10】');
  bySeverity.P1.slice(0, 10).forEach((issue, i) => {
    console.log(`\n   ${i + 1}. ${issue.message}`);
    console.log(`      文件: ${issue.file.split('/').slice(-2).join('/')}:${issue.line}`);
  });

  console.log('\n📝 【问题分析】');
  
  // 统计文件问题分布
  const fileCounts = {};
  issues.forEach(issue => {
    const file = issue.file.split('/').slice(-2).join('/');
    fileCounts[file] = (fileCounts[file] || 0) + 1;
  });
  
  const topFiles = Object.entries(fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.log('\n   【问题最多的文件 Top 5】');
  topFiles.forEach(([file, count], i) => {
    console.log(`   ${i + 1}. ${file}: ${count} 个问题`);
  });

  console.log('\n' + '='.repeat(70));
}

main();
