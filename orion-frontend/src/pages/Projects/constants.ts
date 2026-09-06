/**
 * constants.ts - 项目管理常量
 * 抽取自 Projects/index.tsx (P2-9 Phase 83)
 */
export const statusColorMap: Record<string, string> = {
  active: 'green',
  archived: 'default',
  suspended: 'red',
};

export const statusLabelMap: Record<string, string> = {
  active: '运行中',
  archived: '已归档',
  suspended: '已暂停',
};

export const resourceTypeLabelMap: Record<string, string> = {
  repository: '代码仓库',
  pipeline: '流水线',
  deployment: '部署',
  monitoring: '监控',
  alert_rule: '告警规则',
  database: '数据库',
  secret: '密钥',
};
