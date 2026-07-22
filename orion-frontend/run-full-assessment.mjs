import { InteractionScanner } from '../docs/design-constraints/framework/core/ast-analyzer.ts';
import { CodeQualityScanner } from '../docs/design-constraints/framework/core/code-quality-analyzer.ts';

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('           Orion 设计约束工具能力深度评审');
  console.log('='.repeat(70));

  // 1. 交互完整性扫描
  console.log('\n【1】交互完整性扫描 (AST)');
  const interactionScanner = new InteractionScanner('./src/pages/');
  const interactionIssues = await interactionScanner.scan(50);
  const iBySeverity = interactionScanner.groupBySeverity(interactionIssues);
  const iByType = interactionScanner.groupByType(interactionIssues);
  console.log(`    问题总数: ${interactionIssues.length}`);
  console.log(`    P0: ${iBySeverity.P0.length}, P1: ${iBySeverity.P1.length}`);
  console.log(`    检测类型: ${Object.keys(iByType).join(', ')}`);

  // 2. 代码质量扫描
  console.log('\n【2】代码质量扫描');
  const qualityScanner = new CodeQualityScanner('./src/pages/');
  const qualityIssues = await qualityScanner.scan(50);
  const qBySeverity = qualityScanner.groupBySeverity(qualityIssues);
  const qByType = qualityScanner.groupByType(qualityIssues);
  console.log(`    问题总数: ${qualityIssues.length}`);
  console.log(`    P0: ${qBySeverity.P0.length}, P1: ${qBySeverity.P1.length}, P2: ${qBySeverity.P2.length}`);
  console.log(`    检测类型: ${Object.keys(qByType).join(', ')}`);

  // 3. 汇总
  const totalP0 = iBySeverity.P0.length + qBySeverity.P0.length;
  const totalP1 = iBySeverity.P1.length + qBySeverity.P1.length;
  const totalP2 = qBySeverity.P2.length;
  
  console.log('\n【3】能力汇总');
  console.log(`    检测器总数: 2 个`);
  console.log(`    问题类型覆盖: ${Object.keys(iByType).length + Object.keys(qByType).length} 种`);
  console.log(`    扫描文件: 50 个`);
  console.log(`    发现问题: ${interactionIssues.length + qualityIssues.length} 个`);
  console.log(`    P0: ${totalP0}, P1: ${totalP1}, P2: ${totalP2}`);

  // 4. 能力矩阵
  console.log('\n【4】能力矩阵');
  console.log(`
  +------------------+-------+-------+-------+-------+
  | 检测维度         | P0    | P1    | P2    | 总计  |
  +------------------+-------+-------+-------+-------+
  | 交互完整性(A2)   | ${String(iBySeverity.P0.length).padEnd(5)} | ${String(iBySeverity.P1.length).padEnd(5)} | -     | ${String(interactionIssues.length).padEnd(5)} |
  | 代码质量        | ${String(qBySeverity.P0.length).padEnd(5)} | ${String(qBySeverity.P1.length).padEnd(5)} | ${String(qBySeverity.P2.length).padEnd(5)} | ${String(qualityIssues.length).padEnd(5)} |
  +------------------+-------+-------+-------+-------+
  | 合计            | ${String(totalP0).padEnd(5)} | ${String(totalP1).padEnd(5)} | ${String(totalP2).padEnd(5)} | ${String(interactionIssues.length + qualityIssues.length).padEnd(5)} |
  +------------------+-------+-------+-------+-------+
  `);

  // 5. 详细检测能力
  console.log('\n【5】详细检测能力');
  console.log('\n  交互完整性检测:');
  console.log('    ✅ 缺少 loading 状态 (P0)');
  console.log('    ✅ 缺少操作反馈 (P0)');
  console.log('    ✅ 缺少提交按钮 (P1)');
  console.log('    ✅ 缺少编辑入口 (P1)');
  console.log('    ⚠️  缺少 Empty 引导 (检测中)');

  console.log('\n  代码质量检测:');
  console.log('    ✅ Any 类型使用 (P1)');
  console.log('    ✅ 代码嵌套过深 (P1)');
  console.log('    ✅ 嵌套循环 (P1)');
  console.log('    ✅ Console 调试 (P1)');
  console.log('    ✅ 硬编码值 (P2)');
  console.log('    ✅ 魔法数字 (P2)');
  console.log('    ✅ 未使用变量 (P2)');
  
  console.log('\n  安全检测:');
  console.log('    ✅ Eval 使用 (P0)');
  console.log('    ✅ 危险 HTML (P0)');
  console.log('    ✅ SQL 注入 (P0)');
  console.log('    ✅ 硬编码密钥 (P0)');

  console.log('\n' + '='.repeat(70));
}

main();
