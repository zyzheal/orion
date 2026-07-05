/**
 * 智能扫描器 V2 - 精确检测 + 准确统计
 */
import { QuickScanner, QuickAnalyzer } from './quick-analyzer';
import * as fs from 'fs';
import * as path from 'path';

const pagesDir = '/Users/heal/orion-design/orion-frontend/src/pages';

// 8大菜单模块映射
const MENU_MAPPING: Record<string, string> = {
  'Dashboard': '工作台', 'DashboardNew': '工作台', 'workspace': '工作台',
  'Console': '控制台', 'ModuleManager': '控制台', 'SubApps': '控制台',
  'pipeline-svc': '交付', 'Pipeline': '交付', 'BuildEnv': '交付',
  'artifact': '交付', 'Artifacts': '交付', 'artifact-svc': '交付',
  'CodeMgmt': '交付', 'code-svc': '交付',
  'monitor-svc': '可观测性', 'Monitoring': '可观测性', 'AlertList': '可观测性',
  'OnCall': '可观测性', 'Diagnostic': '可观测性', 'security-svc': '可观测性',
  'AISecurity': '可观测性', 'cost': '可观测性',
  'AIDashboard': 'AI平台', 'AIGateway': 'AI平台', 'AIReview': 'AI平台',
  'AIAgents': 'AI平台', 'AICostDashboard': 'AI平台', 'AIDocManagement': 'AI平台',
  'ai-svc': 'AI平台', 'ai-decision': 'AI平台', 'AgentDashboard': 'AI平台',
  'AgentRunDetail': 'AI平台', 'KnowledgeBase': 'AI平台',
  'ApprovalManagement': '治理', 'Approvals': '治理', 'approval-svc': '治理',
  'audit-svc': '治理', 'AuditLog': '治理', 'ApiKeyManagement': '治理',
  'api-governance': '治理', 'TicketDetail': '治理', 'ticket-svc': '治理',
  'notify-svc': '生态', 'Queue': '生态', 'CronManagement': '生态',
  'PluginMarket': '生态',
};

interface Issue {
  id: string;
  severity: 'P0' | 'P1';
  title: string;
  line: number;
}

interface ModuleResult {
  name: string;
  menu: string;
  issues: Issue[];
}

async function smartScanV2() {
  const dirs = fs.readdirSync(pagesDir).filter(d => {
    return fs.statSync(path.join(pagesDir, d)).isDirectory() && !d.startsWith('_');
  });

  console.log('=== 智能扫描 V2 - 精确检测 ===\n');
  console.log(`扫描模块数: ${dirs.length}\n`);

  const allResults: ModuleResult[] = [];

  // 扫描每个模块
  for (const dir of dirs) {
    const modulePath = path.join(pagesDir, dir);
    try {
      const scanner = new QuickScanner();
      const results = await scanner.scan(modulePath, 3);

      const issues: Issue[] = [];
      for (const r of results) {
        for (const issue of r.issues) {
          issues.push({
            id: issue.id,
            severity: issue.severity as 'P0' | 'P1',
            title: issue.title,
            line: issue.line
          });
        }
      }

      if (issues.length > 0) {
        allResults.push({
          name: dir,
          menu: MENU_MAPPING[dir] || '其他',
          issues
        });
      }
    } catch (e) {
      // skip
    }
  }

  // 按问题数排序
  allResults.sort((a, b) => b.issues.length - a.issues.length);

  // 统计
  const p0Count = allResults.reduce((sum, m) => sum + m.issues.filter(i => i.severity === 'P0').length, 0);
  const p1Count = allResults.reduce((sum, m) => sum + m.issues.filter(i => i.severity === 'P1').length, 0);
  const totalCount = p0Count + p1Count;

  // 问题类型统计
  const issueTypeCount: Record<string, { p0: number; p1: number }> = {};
  for (const m of allResults) {
    for (const issue of m.issues) {
      if (!issueTypeCount[issue.id]) issueTypeCount[issue.id] = { p0: 0, p1: 0 };
      const key = issue.severity === 'P0' ? 'p0' : 'p1';
      issueTypeCount[issue.id][key]++;
    }
  }

  // 菜单统计
  const menuStats: Record<string, { p0: number; p1: number; modules: string[] }> = {};
  for (const m of allResults) {
    if (!menuStats[m.menu]) menuStats[m.menu] = { p0: 0, p1: 0, modules: [] };
    menuStats[m.menu].p0 += m.issues.filter(i => i.severity === 'P0').length;
    menuStats[m.menu].p1 += m.issues.filter(i => i.severity === 'P1').length;
    menuStats[m.menu].modules.push(m.name);
  }

  // 输出报告
  let md = `# Orion 前端功能缺失智能分析报告\n\n`;
  md += `> 生成时间: ${new Date().toLocaleString()}\n`;
  md += `> 扫描模块数: ${allResults.length}\n`;
  md += `> 发现问题: ${totalCount} 个 (P0: ${p0Count}, P1: ${p1Count})\n\n`;

  // 1. 总体统计
  md += `## 一、总体统计\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 扫描模块数 | ${allResults.length} |\n`;
  md += `| P0 严重问题 | ${p0Count} |\n`;
  md += `| P1 警告问题 | ${p1Count} |\n`;
  md += `| 问题总计 | ${totalCount} |\n\n`;

  // 2. 8大菜单分布
  md += `## 二、8大菜单模块问题分布\n\n`;
  md += `| 菜单模块 | 模块数 | P0 | P1 | 总计 |\n`;
  md += `|----------|--------|----|----|------|\n`;
  const menuOrder = ['工作台', '控制台', '交付', '可观测性', 'AI平台', '基础设施', '治理', '生态', '其他'];
  for (const menu of menuOrder) {
    if (menuStats[menu]) {
      md += `| ${menu} | ${menuStats[menu].modules.length} | ${menuStats[menu].p0} | ${menuStats[menu].p1} | ${menuStats[menu].p0 + menuStats[menu].p1} |\n`;
    }
  }
  md += `\n`;

  // 3. 问题类型分布
  md += `## 三、问题类型分布\n\n`;
  md += `| 问题ID | 问题描述 | P0 | P1 | 严重性 |\n`;
  md += `|--------|----------|----|----|--------|\n`;
  const issueDesc: Record<string, string> = {
    'A2-12': '异步操作缺少 loading',
    'A2-02': '操作后缺少反馈',
    'A2-14': '列表缺少空状态',
    'A3-16': '危险操作缺少确认',
    'A1-06': '使用 any 类型',
    'A1-01': 'map 缺少 key',
    'D3-01': '硬编码颜色',
    'B1-07': '日志敏感信息'
  };
  for (const [id, count] of Object.entries(issueTypeCount).sort((a, b) => (b[1].p0 + b[1].p1) - (a[1].p0 + a[1].p1))) {
    const severity = count.p0 > 0 ? 'P0' : 'P1';
    md += `| ${id} | ${issueDesc[id] || id} | ${count.p0} | ${count.p1} | ${severity} |\n`;
  }
  md += `\n`;

  // 4. 问题最多的模块
  md += `## 四、问题最多的模块 TOP 15\n\n`;
  md += `| 排名 | 模块 | 所属菜单 | P0 | P1 | 总计 |\n`;
  md += `|------|------|----------|----|----|------|\n`;
  allResults.slice(0, 15).forEach((m, i) => {
    const p0 = m.issues.filter(i => i.severity === 'P0').length;
    const p1 = m.issues.filter(i => i.severity === 'P1').length;
    md += `| ${i + 1} | ${m.name} | ${m.menu} | ${p0} | ${p1} | ${p0 + p1} |\n`;
  });
  md += `\n`;

  // 5. 问题详情（每个问题类型）
  md += `## 五、问题详情与修复指南\n\n`;

  const fixGuides: Record<string, { desc: string; fix: string; example: string }> = {
    'A2-12': {
      desc: '异步操作缺少 loading 状态',
      fix: '添加 const [loading, setLoading] = useState(false)，异步操作时 setLoading(true)，完成时 setLoading(false)，按钮添加 loading={loading}',
      example: `const [loading, setLoading] = useState(false);
const handleSubmit = async () => {
  setLoading(true);
  try {
    await api.submit(values);
    message.success('提交成功');
  } catch (e) {
    message.error('提交失败');
  } finally {
    setLoading(false);
  }
};
<Button loading={loading} onClick={handleSubmit}>提交</Button>`
    },
    'A2-02': {
      desc: '操作后缺少反馈提示',
      fix: 'try 块中添加 message.success，catch 块中添加 message.error',
      example: `try {
  await api.delete(id);
  message.success('删除成功');
} catch (error) {
  message.error(error.message || '删除失败');
}`
    },
    'A2-14': {
      desc: '列表缺少空状态引导',
      fix: '数据为空时显示 Empty 组件',
      example: `{data?.length === 0 ? (
  <Empty description="暂无数据" />
) : (
  data.map(item => <div key={item.id}>{item.name}</div>)
)}`
    },
    'A1-06': {
      desc: '使用 any 类型',
      fix: '定义具体接口或使用 unknown',
      example: `// 定义接口
interface User { id: string; name: string; }
// 使用具体类型
const [user, setUser] = useState<User | null>(null);`
    },
    'A1-01': {
      desc: 'map 渲染缺少 key',
      fix: '添加 key={item.id}',
      example: `{data.map(item => (
  <div key={item.id}>{item.name}</div>
))}`
    },
    'D3-01': {
      desc: '使用硬编码颜色',
      fix: '改用 Design Token',
      example: `import { colors } from '@/tokens';
<Button style={{ color: colors.primary[500] }}>提交</Button>`
    },
    'B1-07': {
      desc: '日志包含敏感信息',
      fix: '使用 *** 掩码或移除敏感字段',
      example: `logger.info('login', { userId, token: '***' });`
    },
    'A3-16': {
      desc: '危险操作缺少确认',
      fix: '使用 Popconfirm 包裹',
      example: `<Popconfirm title="确认删除?" onConfirm={handleDelete}>
  <Button danger>删除</Button>
</Popconfirm>`
    }
  };

  for (const [id, stats] of Object.entries(issueTypeCount).sort((a, b) => (b[1].p0 + b[1].p1) - (a[1].p0 + a[1].p1))) {
    const guide = fixGuides[id];
    if (!guide) continue;
    md += `### ${id}: ${guide.desc}\n\n`;
    md += `- **问题数量**: P0: ${stats.p0}, P1: ${stats.p1}\n`;
    md += `- **修复方法**: ${guide.fix}\n\n`;
    md += `**正确示例**:\n\`\`\`typescript\n${guide.example}\n\`\`\`\n\n---\n\n`;
  }

  // 保存报告
  fs.writeFileSync('/Users/heal/orion-design/docs/reports/smart-analysis-v2.md', md);
  console.log('报告已保存到: docs/reports/smart-analysis-v2.md');

  console.log('\n' + md);
}

smartScanV2();