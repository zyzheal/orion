/**
 * 详细模块分析报告生成
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
  'Cluster': '基础设施', 'Host': '基础设施', 'K8s': '基础设施',
  'cloud-svc': '基础设施', 'infrastructure-svc': '基础设施',
  'ApprovalManagement': '治理', 'Approvals': '治理', 'approval-svc': '治理',
  'audit-svc': '治理', 'AuditLog': '治理', 'ApiKeyManagement': '治理',
  'api-governance': '治理', 'TicketDetail': '治理', 'ticket-svc': '治理',
  'notify-svc': '生态', 'Queue': '生态', 'CronManagement': '生态',
  'PluginMarket': '生态',
};

const issueDesc: Record<string, { desc: string; fix: string; severity: string }> = {
  'A1-06': {
    desc: '使用 any 类型',
    fix: '添加具体类型定义或使用 unknown',
    severity: 'P1'
  },
  'A2-12': {
    desc: '异步操作缺少 loading 状态',
    fix: '添加 const [loading, setLoading] = useState(false)',
    severity: 'P0'
  },
  'A2-14': {
    desc: '列表缺少空状态 Empty',
    fix: '添加 {data?.length === 0 && <Empty />}',
    severity: 'P0'
  },
  'A2-02': {
    desc: '操作后缺少反馈提示',
    fix: '添加 message.success/error',
    severity: 'P0'
  },
  'A3-16': {
    desc: '危险操作缺少二次确认',
    fix: '使用 <Popconfirm> 包裹按钮',
    severity: 'P0'
  },
  'D3-01': {
    desc: '使用硬编码颜色',
    fix: '改用 Design Token: colors.primary[500]',
    severity: 'P1'
  },
  'B1-07': {
    desc: '日志可能包含敏感信息',
    fix: '使用 *** 脱敏或移除敏感字段',
    severity: 'P0'
  },
};

interface IssueDetail {
  file: string;
  line: number;
  code: string;
}

async function generateDetailedReport() {
  const dirs = fs.readdirSync(pagesDir).filter(d => {
    return fs.statSync(path.join(pagesDir, d)).isDirectory() && !d.startsWith('_');
  });

  // 收集每个模块的问题详情
  const moduleDetails: Record<string, IssueDetail[]> = {};

  console.log('正在详细扫描...\n');

  for (const dir of dirs.slice(0, 30)) {  // 扫描前30个模块
    const modulePath = path.join(pagesDir, dir);

    try {
      const scanner = new QuickScanner();
      const results = await scanner.scan(modulePath, 3);

      const details: IssueDetail[] = [];
      for (const r of results) {
        for (const issue of r.issues) {
          details.push({
            file: path.basename(r.file),
            line: issue.line,
            code: issue.code
          });
        }
      }

      if (details.length > 0) {
        moduleDetails[dir] = details;
      }
    } catch (e) {
      // skip
    }
  }

  // 生成 Markdown 报告
  let md = `# Orion 前端模块功能缺失详细分析报告\n\n`;
  md += `> 生成时间: ${new Date().toISOString().split('T')[0]}\n`;
  md += `> 扫描模块数: 30\n\n`;

  md += `## 一、总体概览\n\n`;
  md += `| 指标 | 数值 |\n|------|------|\n`;
  md += `| 扫描模块 | 30 |\n`;
  md += `| P0 严重问题 | ${Object.values(moduleDetails).flat().length} |\n`;
  md += `| 问题类型 | 7 种 |\n\n`;

  md += `## 二、问题类型详细说明\n\n`;

  for (const [id, info] of Object.entries(issueDesc)) {
    const count = Object.values(moduleDetails).flat().filter((d: any) => d.id === id).length;
    md += `### ${id}: ${info.desc}\n`;
    md += `- **严重性**: ${info.severity}\n`;
    md += `- **出现次数**: ${count}\n`;
    md += `- **修复方法**: ${info.fix}\n\n`;
  }

  md += `## 三、各模块问题详情\n\n`;

  // 按模块输出
  const sortedModules = Object.entries(moduleDetails).sort(
    (a, b) => b[1].length - a[1].length
  );

  for (const [module, issues] of sortedModules.slice(0, 20)) {
    const menu = MENU_MAPPING[module] || '其他';
    md += `### ${module} (${menu})\n`;
    md += `**问题数**: ${issues.length}\n\n`;

    // 按问题类型分组
    const grouped: Record<string, IssueDetail[]> = {};
    for (const issue of issues) {
      // 从代码推断问题类型
      let type = 'A1-06';
      if (issue.code.includes('async') || issue.code.includes('await')) type = 'A2-12';
      else if (issue.code.includes('map(')) type = 'A1-06'; // key
      else if (issue.code.match(/#([0-9a-fA-F]{6})/)) type = 'D3-01';
      else if (issue.code.includes('delete') || issue.code.includes('删除')) type = 'A3-16';

      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(issue);
    }

    for (const [type, details] of Object.entries(grouped)) {
      const info = issueDesc[type] || { desc: type, fix: '', severity: 'P1' };
      md += `#### ${type} - ${info.desc} (${details.length}处)\n`;
      md += `\`\`\`typescript\n`;
      for (const d of details.slice(0, 5)) {
        md += `// ${d.file}:${d.line}\n`;
        md += `${d.code}\n`;
      }
      md += `\`\`\`\n`;
      md += `**修复**: ${info.fix}\n\n`;
    }
  }

  md += `## 四、修复清单\n\n`;
  md += `| 优先级 | 问题类型 | 涉及模块数 | 修复建议 |\n`;
  md += `|--------|----------|------------|----------|\n`;

  const typeModuleCount: Record<string, number> = {};
  for (const issues of Object.values(moduleDetails)) {
    for (const issue of issues) {
      let type = 'A1-06';
      if (issue.code.includes('async')) type = 'A2-12';
      else if (issue.code.match(/#([0-9a-fA-F]{6})/)) type = 'D3-01';
      typeModuleCount[type] = (typeModuleCount[type] || 0) + 1;
    }
  }

  for (const [type, count] of Object.entries(typeModuleCount).sort((a, b) => b[1] - a[1])) {
    const info = issueDesc[type] || { desc: type, fix: '', severity: 'P1' };
    md += `| ${info.severity} | ${info.desc} | ${count} | ${info.fix} |\n`;
  }

  // 保存报告
  fs.writeFileSync('/Users/heal/orion-design/docs/reports/module-gap-analysis-detailed.md', md);
  console.log('报告已保存到: docs/reports/module-gap-analysis-detailed.md');

  // 控制台输出
  console.log('\n' + md);
}

generateDetailedReport();