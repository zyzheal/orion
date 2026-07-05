/**
 * 批量扫描前端模块功能缺失 - 详细版
 */
import { QuickScanner } from './quick-analyzer';
import * as fs from 'fs';
import * as path from 'path';

const pagesDir = '/Users/heal/orion-design/orion-frontend/src/pages';

// 8大菜单模块映射
const MENU_MAPPING: Record<string, string> = {
  // 工作台
  'Dashboard': '工作台', 'DashboardNew': '工作台', 'workspace': '工作台',
  // 控制台
  'Console': '控制台', 'ModuleManager': '控制台', 'SubApps': '控制台',
  // 交付
  'pipeline-svc': '交付', 'Pipeline': '交付', 'BuildEnv': '交付',
  'artifact': '交付', 'Artifacts': '交付', 'artifact-svc': '交付',
  'CodeMgmt': '交付', 'code-svc': '交付',
  // 可观测性
  'monitor-svc': '可观测性', 'Monitoring': '可观测性', 'AlertList': '可观测性',
  'OnCall': '可观测性', 'Diagnostic': '可观测性', 'security-svc': '可观测性',
  'AISecurity': '可观测性', 'cost': '可观测性',
  // AI平台
  'AIDashboard': 'AI平台', 'AIGateway': 'AI平台', 'AIReview': 'AI平台',
  'AIAgents': 'AI平台', 'AICostDashboard': 'AI平台', 'AIDocManagement': 'AI平台',
  'ai-svc': 'AI平台', 'ai-decision': 'AI平台', 'AgentDashboard': 'AI平台',
  'AgentRunDetail': 'AI平台',
  // 基础设施
  'Cluster': '基础设施', 'Host': '基础设施', 'K8s': '基础设施',
  'cloud-svc': '基础设施', 'infrastructure-svc': '基础设施',
  // 治理
  'ApprovalManagement': '治理', 'Approvals': '治理', 'approval-svc': '治理',
  'audit-svc': '治理', 'AuditLog': '治理', 'ApiKeyManagement': '治理',
  'api-governance': '治理', 'TicketDetail': '治理', 'ticket-svc': '治理',
  // 生态
  'KnowledgeBase': '生态', 'knowledge-svc': '生态', 'notify-svc': '生态',
  'Queue': '生态', 'CronManagement': '生态', 'PluginMarket': '生态',
};

interface ModuleResult {
  name: string;
  menu: string;
  total: number;
  p0: number;
  p1: number;
  issues: Record<string, number>;
}

async function scanDetailed() {
  const dirs = fs.readdirSync(pagesDir).filter(d => {
    return fs.statSync(path.join(pagesDir, d)).isDirectory() && !d.startsWith('_') && !d.includes('-svc');
  });

  const results: ModuleResult[] = [];

  console.log('=== Orion 前端模块功能缺失深度分析 ===\n');
  console.log(`扫描范围: ${dirs.length} 个前端模块\n`);

  // 扫描
  for (const dir of dirs) {
    const modulePath = path.join(pagesDir, dir);

    try {
      const scanner = new QuickScanner();
      const scanResults = await scanner.scan(modulePath, 5);

      const total = scanResults.reduce((sum, r) => sum + r.issues.length, 0);
      const p0 = scanResults.reduce((sum, r) => sum + r.stats.p0, 0);
      const p1 = scanResults.reduce((sum, r) => sum + r.stats.p1, 0);

      const issues: Record<string, number> = {};
      for (const r of scanResults) {
        for (const issue of r.issues) {
          issues[issue.id] = (issues[issue.id] || 0) + 1;
        }
      }

      results.push({
        name: dir,
        menu: MENU_MAPPING[dir] || '其他',
        total, p0, p1, issues
      });
    } catch (e) {
      // skip
    }
  }

  // 按问题数排序
  results.sort((a, b) => b.total - a.total);

  // 按8大菜单汇总
  const menuStats: Record<string, { total: number, p0: number, p1: number, modules: string[] }> = {};

  for (const r of results) {
    if (!menuStats[r.menu]) {
      menuStats[r.menu] = { total: 0, p0: 0, p1: 0, modules: [] };
    }
    menuStats[r.menu].total += r.total;
    menuStats[r.menu].p0 += r.p0;
    menuStats[r.menu].p1 += r.p1;
    if (r.total > 0) menuStats[r.menu].modules.push(r.name);
  }

  console.log('## 8大菜单模块问题分布\n');
  console.log('| 菜单模块 | 模块数 | P0问题 | P1问题 | 总计 |');
  console.log('|----------|--------|--------|--------|------|');

  const menuOrder = ['工作台', '控制台', '交付', '可观测性', 'AI平台', '基础设施', '治理', '生态', '其他'];
  for (const menu of menuOrder) {
    if (menuStats[menu]) {
      console.log(`| ${menu} | ${menuStats[menu].modules.length} | ${menuStats[menu].p0} | ${menuStats[menu].p1} | ${menuStats[menu].total} |`);
    }
  }

  console.log('\n## 问题最多的模块 TOP 25\n');
  console.log('| 模块 | 所属菜单 | P0 | P1 | 总计 |');
  console.log('|------|----------|----|----|------|');

  results.slice(0, 25).forEach(r => {
    console.log(`| ${r.name} | ${r.menu} | ${r.p0} | ${r.p1} | ${r.total} |`);
  });

  // 问题类型汇总
  const allIssueTypes: Record<string, number> = {};
  for (const r of results) {
    for (const [id, count] of Object.entries(r.issues)) {
      allIssueTypes[id] = (allIssueTypes[id] || 0) + count;
    }
  }

  console.log('\n## 问题类型汇总\n');
  console.log('| 问题ID | 问题类型 | 出现次数 | 严重性 |');
  console.log('|--------|----------|----------|--------|');

  const typeDesc: Record<string, string> = {
    'A1-06': '使用 any 类型',
    'A2-12': '异步操作缺少 loading',
    'A2-14': '列表缺少空状态 Empty',
    'A2-02': '操作后缺少反馈提示',
    'A3-16': '危险操作缺少确认',
    'D3-01': '硬编码颜色值',
    'B1-07': '日志包含敏感信息',
  };

  const severity: Record<string, string> = {
    'A1-06': 'P1', 'A2-12': 'P0', 'A2-14': 'P0',
    'A2-02': 'P0', 'A3-16': 'P0', 'D3-01': 'P1', 'B1-07': 'P0'
  };

  Object.entries(allIssueTypes).sort((a, b) => b[1] - a[1]).forEach(([id, count]) => {
    console.log(`| ${id} | ${typeDesc[id] || id} | ${count} | ${severity[id] || '-'} |`);
  });

  // 总体统计
  const totalP0 = results.reduce((s, r) => s + r.p0, 0);
  const totalP1 = results.reduce((s, r) => s + r.p1, 0);
  const totalIssues = totalP0 + totalP1;

  console.log('\n## 总体统计\n');
  console.log(`- 扫描模块数: ${results.length}`);
  console.log(`- P0 严重问题: ${totalP0}`);
  console.log(`- P1 警告问题: ${totalP1}`);
  console.log(`- 问题总计: ${totalIssues}`);

  // 建议
  console.log('\n## 修复优先级建议\n');
  console.log('1. **优先修复 P0 问题** - 影响用户体验和安全性');
  console.log('2. **any 类型 (A1-06)** 最多，建议批量替换为具体类型');
  console.log('3. **loading 状态 (A2-12)** 缺失严重，影响交互体验');
  console.log('4. **空状态 (A2-14)** 影响数据展示完整性');
}

scanDetailed();