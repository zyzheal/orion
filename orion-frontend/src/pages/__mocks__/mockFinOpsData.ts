/**
 * Mock Data for FinOps Cost Management Pages
 * - Cost summary metrics
 * - Cost breakdown by service
 * - 12-month cost trend
 * - Optimization recommendations
 * - Budget alerts
 */

// ============================================================================
// Cost Summary Mock Data
// ============================================================================

export const mockCostSummary = {
  totalMonthly: 45680,
  budgetLimit: 60000,
  previousMonth: 42350,
  projectedMonthly: 48200,
  savings: 3200,
  waste: 5400,
};

// ============================================================================
// Cost by Service Mock Data
// ============================================================================

export const mockCostByService = [
  { key: '1', service: '云服务器 ECS', cost: 18500, percent: 40.5, trend: 'up' },
  { key: '2', service: '数据库 RDS', cost: 12300, percent: 26.9, trend: 'stable' },
  { key: '3', service: '对象存储 OSS', cost: 4800, percent: 10.5, trend: 'down' },
  { key: '4', service: '负载均衡 SLB', cost: 3200, percent: 7.0, trend: 'stable' },
  { key: '5', service: 'CDN', cost: 2900, percent: 6.4, trend: 'up' },
  { key: '6', service: '容器服务 ACK', cost: 2400, percent: 5.3, trend: 'down' },
  { key: '7', service: '其他', cost: 1580, percent: 3.5, trend: 'stable' },
];

// ============================================================================
// Cost Trend Mock Data (last 12 months)
// ============================================================================

export const mockCostTrend = [
  { month: '2025-05', cost: 35000 },
  { month: '2025-06', cost: 36500 },
  { month: '2025-07', cost: 38000 },
  { month: '2025-08', cost: 37200 },
  { month: '2025-09', cost: 39800 },
  { month: '2025-10', cost: 41000 },
  { month: '2025-11', cost: 40500 },
  { month: '2025-12', cost: 42350 },
  { month: '2026-01', cost: 43800 },
  { month: '2026-02', cost: 44200 },
  { month: '2026-03', cost: 45680 },
  { month: '2026-04', cost: 48200 },
];

// ============================================================================
// Optimization Recommendations Mock Data
// ============================================================================

export const mockOptimizations = [
  {
    key: '1',
    title: '闲置资源清理',
    description: '发现 3 台未使用的 ECS 实例，预计可节省 ¥2,400/月',
    savings: 2400,
    effort: 'low',
    status: 'pending',
  },
  {
    key: '2',
    title: '预留实例购买',
    description: '建议购买 6 个月预留实例，预计节省 35% 费用',
    savings: 4800,
    effort: 'medium',
    status: 'pending',
  },
  {
    key: '3',
    title: '降配建议',
    description: 'ECS-007 使用率仅 15%，建议从 8C16G 降至 4C8G',
    savings: 800,
    effort: 'low',
    status: 'applied',
  },
  {
    key: '4',
    title: 'RDS 存储优化',
    description: 'RDS-prod 存储使用率仅 20%，可减少预购存储容量',
    savings: 1200,
    effort: 'medium',
    status: 'pending',
  },
  {
    key: '5',
    title: 'CDN 缓存策略优化',
    description: '调整缓存 TTL 可减少回源请求，预计节省 20% CDN 费用',
    savings: 580,
    effort: 'low',
    status: 'pending',
  },
];

// ============================================================================
// Budget Alerts Mock Data
// ============================================================================

export const mockBudgetAlerts = [
  { key: '1', service: '云服务器 ECS', threshold: 80, current: 85, status: 'exceeded' },
  { key: '2', service: '数据库 RDS', threshold: 70, current: 68, status: 'warning' },
  { key: '3', service: 'CDN', threshold: 90, current: 95, status: 'exceeded' },
];
