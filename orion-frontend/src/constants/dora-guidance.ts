/**
 * DORA 指标引导配置
 *
 * 包含 Tooltip 文案、新手引导步骤、等级说明等
 */

/** DORA 四指标 Tooltip 文案 */
export const DORA_TOOLTIPS = {
  deploymentFrequency: {
    title: '部署频率 (Deployment Frequency)',
    description:
      '你的团队平均每周部署次数。频率越高，说明交付能力越强。Elite 团队通常按需部署（每天多次）。',
    benchmarks: {
      elite: '按需部署（每天多次）',
      high: '每周至每月部署一次',
      medium: '每月至每季度部署一次',
      low: '少于每季度部署一次',
    },
  },
  leadTimeForChanges: {
    title: '变更前置时间 (Lead Time for Changes)',
    description:
      '从代码提交到成功部署到生产环境的平均时长。越短说明交付流程越高效。Elite 团队通常 < 1 小时。',
    benchmarks: {
      elite: '< 1 小时',
      high: '< 1 天',
      medium: '< 1 周',
      low: '> 1 周',
    },
  },
  meanTimeToRecovery: {
    title: '服务恢复时间 (MTTR)',
    description:
      '生产故障从发生到恢复服务的平均时长。越短说明应急响应能力越强。Elite 团队通常 < 1 小时。',
    benchmarks: {
      elite: '< 1 小时',
      high: '< 1 天',
      medium: '< 1 周',
      low: '> 1 周',
    },
  },
  changeFailureRate: {
    title: '变更失败率 (Change Failure Rate)',
    description:
      '部署失败或需要回滚的次数占总部署次数的百分比。越低说明发布质量越稳定。Elite 团队通常 < 5%。',
    benchmarks: {
      elite: '< 5%',
      high: '< 10%',
      medium: '< 15%',
      low: '> 15%',
    },
  },
};

/** 新手引导步骤配置 */
export const ONBOARDING_STEPS = [
  {
    title: '欢迎使用效能看板',
    icon: 'dashboard',
    content:
      '效能看板基于 DORA 研究成果，帮助你追踪团队软件交付绩效。DORA 四大核心指标是衡量 DevOps 成熟度的全球标准。',
  },
  {
    title: '四大核心指标',
    icon: 'metrics',
    content:
      '• 部署频率：衡量交付速度\n• 变更前置时间：衡量流程效率\n• 服务恢复时间：衡量响应能力\n• 变更失败率：衡量发布质量',
  },
  {
    title: '效能等级说明',
    icon: 'level',
    content:
      'Elite（精英）：行业顶尖水平\nHigh（高）：表现优秀\nMedium（中等）：有改进空间\nLow（低）：需要重点关注',
  },
  {
    title: '如何提升效能',
    icon: 'improve',
    content:
      '1. 查看改进建议获取针对性优化方案\n2. 使用团队对比了解差距\n3. 关注趋势分析持续改进\n4. 点击右上角 ❓ 图标可随时查看帮助',
  },
];

/** 效能等级说明 */
export const DORA_LEVELS = [
  {
    level: 'elite',
    name: 'Elite（精英）',
    color: '#52c41a',
    description: '行业顶尖水平，具备卓越的软件交付能力。',
    criteria: {
      deploymentFrequency: '按需部署（每天多次）',
      leadTime: '< 1 小时',
      mttr: '< 1 小时',
      failureRate: '< 5%',
    },
  },
  {
    level: 'high',
    name: 'High（高）',
    color: '#1890ff',
    description: '表现优秀，持续交付能力稳定可靠。',
    criteria: {
      deploymentFrequency: '每周至每月部署一次',
      leadTime: '< 1 天',
      mttr: '< 1 天',
      failureRate: '< 10%',
    },
  },
  {
    level: 'medium',
    name: 'Medium（中等）',
    color: '#faad14',
    description: '有改进空间，需要优化部分流程。',
    criteria: {
      deploymentFrequency: '每月至每季度部署一次',
      leadTime: '< 1 周',
      mttr: '< 1 周',
      failureRate: '< 15%',
    },
  },
  {
    level: 'low',
    name: 'Low（低）',
    color: '#ff4d4f',
    description: '需要重点关注，建议制定改进计划。',
    criteria: {
      deploymentFrequency: '少于每季度部署一次',
      leadTime: '> 1 周',
      mttr: '> 1 周',
      failureRate: '> 15%',
    },
  },
];

/** 常见问题 FAQ */
export const DORA_FAQ = [
  {
    question: '部署频率是如何计算的？',
    answer:
      '部署频率 = 统计周期内成功部署次数 / 统计天数 × 7。我们默认统计最近 30 天的数据。',
  },
  {
    question: '变更前置时间为什么显示的是 Pipeline 执行时长？',
    answer:
      '当前版本使用 Pipeline 执行时长作为近似值。后续版本将从 Git commit 时间开始计算完整链路。',
  },
  {
    question: 'MTTR 数据从哪里来？',
    answer:
      '当前 MTTR 从部署记录的恢复时间字段计算。后续版本将接入独立的 Incident 追踪系统。',
  },
  {
    question: '如何查看历史趋势？',
    answer:
      '切换到"趋势分析" Tab 可查看近 12 周的指标变化趋势。历史数据依赖 ClickHouse 存储，当前使用 PostgreSQL 模拟数据。',
  },
  {
    question: '团队对比功能如何使用？',
    answer:
      '切换到"团队对比" Tab，选择需要对比的团队，系统将展示雷达图和排名表格。',
  },
];

/** localStorage 键名 */
export const STORAGE_KEYS = {
  hasSeenOnboarding: 'orion_efficiency_onboarding_seen',
  preferredTeam: 'orion_efficiency_preferred_team',
};