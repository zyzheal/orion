/**
 * Mock Data for BI Dashboard Pages
 * - Executive Dashboard metrics and trends
 * - Manager Dashboard team and member metrics
 * - Engineer Dashboard personal performance data
 */

import type {
  ExecutiveDashboardData,
  ManagerDashboardData,
  EngineerDashboardData,
} from '../../types/pages';

// Generate realistic mock data for 30 days
const generateTrendData = () => {
  const data: { period: string; created: number; resolved: number; open: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const created = Math.floor(Math.random() * 15) + 5;
    const resolved = Math.floor(Math.random() * 12) + 3;
    data.push({
      period: d.toISOString().slice(0, 10),
      created,
      resolved,
      open: Math.max(0, created - resolved + Math.floor(Math.random() * 5)),
    });
  }
  return data;
};

const volumeTrend = generateTrendData();

export const mockExecutiveDashboard: ExecutiveDashboardData = {
  overview: {
    totalTickets: 487,
    resolvedTickets: 412,
    openTickets: 75,
    overallResolutionRate: 84.6,
    avgResolutionTimeHours: 14.3,
    slaComplianceRate: 92.1,
    totalEngineers: 24,
    activeEngineers: 19,
  },
  trends: {
    ticketVolumeTrend: volumeTrend,
    resolutionTimeTrend: volumeTrend.map((d) => ({
      period: d.period,
      avgHours: Math.round((10 + Math.random() * 10) * 10) / 10,
      medianHours: Math.round((8 + Math.random() * 6) * 10) / 10,
    })),
    slaComplianceTrend: volumeTrend.map((d) => ({
      period: d.period,
      rate: Math.round((85 + Math.random() * 15) * 10) / 10,
    })),
  },
  teamRanking: {
    topPerformers: [
      { engineerId: 'E001', name: '张伟', score: 96, resolved: 52 },
      { engineerId: 'E003', name: '李娜', score: 93, resolved: 48 },
      { engineerId: 'E007', name: '王强', score: 91, resolved: 45 },
      { engineerId: 'E012', name: '赵敏', score: 89, resolved: 43 },
      { engineerId: 'E005', name: '陈浩', score: 87, resolved: 41 },
    ],
    bottomPerformers: [
      { engineerId: 'E018', name: '孙磊', score: 58, needsAttention: 'SLA合规率偏低 (72%)' },
      { engineerId: 'E022', name: '周芳', score: 62, needsAttention: '重开率偏高 (15%)' },
    ],
  },
  alerts: {
    slaBreachedCount: 8,
    overdueTicketsCount: 12,
    overloadedEngineers: 3,
    unassignedOlderThan24h: 5,
  },
  distribution: {
    byCategory: {
      infrastructure: { count: 128, avgResolutionHours: 18.5 },
      application: { count: 95, avgResolutionHours: 12.3 },
      database: { count: 67, avgResolutionHours: 22.1 },
      network: { count: 45, avgResolutionHours: 8.7 },
      security: { count: 32, avgResolutionHours: 28.4 },
      deployment: { count: 58, avgResolutionHours: 6.2 },
      pipeline: { count: 38, avgResolutionHours: 9.8 },
      performance: { count: 24, avgResolutionHours: 15.6 },
    },
    byPriority: {
      critical: { count: 15, resolved: 14 },
      high: { count: 78, resolved: 72 },
      medium: { count: 234, resolved: 198 },
      low: { count: 160, resolved: 128 },
    },
  },
};

export const mockManagerDashboard: ManagerDashboardData = {
  teamOverview: {
    totalTickets: 156,
    resolvedCount: 132,
    avgResolutionTimeHours: 11.8,
    slaComplianceRate: 94.2,
    teamLoadPercentage: 72,
  },
  memberMetrics: [
    {
      engineerId: 'E001',
      engineerName: '张伟',
      period: '2026-04',
      workload: { totalAssigned: 28, totalResolved: 26 },
      efficiency: { avgResolutionTimeMs: 8 * 3600 * 1000, ticketsPerDay: 1.2 },
      quality: { slaComplianceRate: 0.96, firstTimeResolveRate: 0.92, reopenRate: 0.04 },
      compositeScore: 96,
      performanceGrade: 'A',
      trend: 'improving',
    },
    {
      engineerId: 'E003',
      engineerName: '李娜',
      period: '2026-04',
      workload: { totalAssigned: 25, totalResolved: 23 },
      efficiency: { avgResolutionTimeMs: 10 * 3600 * 1000, ticketsPerDay: 1.0 },
      quality: { slaComplianceRate: 0.94, firstTimeResolveRate: 0.88, reopenRate: 0.06 },
      compositeScore: 93,
      performanceGrade: 'A',
      trend: 'stable',
    },
    {
      engineerId: 'E007',
      engineerName: '王强',
      period: '2026-04',
      workload: { totalAssigned: 22, totalResolved: 20 },
      efficiency: { avgResolutionTimeMs: 12 * 3600 * 1000, ticketsPerDay: 0.9 },
      quality: { slaComplianceRate: 0.91, firstTimeResolveRate: 0.85, reopenRate: 0.08 },
      compositeScore: 88,
      performanceGrade: 'B+',
      trend: 'stable',
    },
    {
      engineerId: 'E012',
      engineerName: '赵敏',
      period: '2026-04',
      workload: { totalAssigned: 20, totalResolved: 18 },
      efficiency: { avgResolutionTimeMs: 14 * 3600 * 1000, ticketsPerDay: 0.8 },
      quality: { slaComplianceRate: 0.88, firstTimeResolveRate: 0.82, reopenRate: 0.1 },
      compositeScore: 85,
      performanceGrade: 'B+',
      trend: 'improving',
    },
    {
      engineerId: 'E018',
      engineerName: '孙磊',
      period: '2026-04',
      workload: { totalAssigned: 15, totalResolved: 12 },
      efficiency: { avgResolutionTimeMs: 20 * 3600 * 1000, ticketsPerDay: 0.5 },
      quality: { slaComplianceRate: 0.72, firstTimeResolveRate: 0.7, reopenRate: 0.15 },
      compositeScore: 58,
      performanceGrade: 'D',
      trend: 'declining',
    },
  ],
  weekOverWeek: {
    ticketsCreatedChange: 8.5,
    resolvedChange: 12.3,
    avgResolutionTimeChange: -5.2,
    slaComplianceChange: 2.1,
  },
  transferAnalysis: {
    totalTransfers: 23,
    avgTransfersPerTicket: 0.15,
    topTransferReasons: [
      { reason: '专业不匹配', count: 12 },
      { reason: '超时自动转派', count: 7 },
      { reason: '工程师请假', count: 4 },
    ],
  },
};

export const mockEngineerDashboard: EngineerDashboardData = {
  personalOverview: {
    engineerId: 'E001',
    engineerName: '张伟',
    currentLoad: 5,
    totalResolved: 52,
    avgResolutionTimeHours: 8.2,
    slaComplianceRate: 96.2,
    performanceGrade: 'A',
    rank: 1,
    totalInTeam: 24,
  },
  personalTrend: (() => {
    const data: {
      period: string;
      resolved: number;
      avgResolutionHours: number;
      slaCompliant: number;
    }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      data.push({
        period: d.toISOString().slice(0, 10),
        resolved: Math.floor(Math.random() * 3) + 1,
        avgResolutionHours: Math.round((6 + Math.random() * 6) * 10) / 10,
        slaCompliant: Math.floor(Math.random() * 3) + 1,
      });
    }
    return data;
  })(),
  strengths: [
    {
      category: 'infrastructure',
      resolvedCount: 18,
      slaComplianceRate: 0.98,
      proficiencyScore: 95,
    },
    { category: 'network', resolvedCount: 12, slaComplianceRate: 0.96, proficiencyScore: 88 },
    { category: 'database', resolvedCount: 8, slaComplianceRate: 0.92, proficiencyScore: 82 },
  ],
  weaknesses: [
    {
      category: 'security',
      resolvedCount: 3,
      slaComplianceRate: 0.67,
      suggestion: '建议参加安全工单处理培训',
    },
    {
      category: 'performance',
      resolvedCount: 2,
      slaComplianceRate: 0.5,
      suggestion: '建议与性能专家结对处理',
    },
  ],
  activeTickets: [
    {
      ticketId: 'TKT-001',
      title: '生产数据库CPU使用率过高',
      priority: 'critical',
      status: 'in-progress',
      elapsedHours: 2.5,
      slaRemainingHours: 1.5,
      isOverdue: false,
    },
    {
      ticketId: 'TKT-015',
      title: '应用部署失败回滚',
      priority: 'high',
      status: 'assigned',
      elapsedHours: 0.5,
      slaRemainingHours: 7.5,
      isOverdue: false,
    },
    {
      ticketId: 'TKT-023',
      title: '服务器磁盘空间不足',
      priority: 'medium',
      status: 'in-progress',
      elapsedHours: 18,
      slaRemainingHours: 6,
      isOverdue: false,
    },
    {
      ticketId: 'TKT-008',
      title: 'API网关响应延迟',
      priority: 'high',
      status: 'in-progress',
      elapsedHours: 10,
      slaRemainingHours: -2,
      isOverdue: true,
    },
  ],
};
