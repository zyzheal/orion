/**
 * constants.ts - TicketDetail 常量配置
 * 抽取自 TicketDetail/index.tsx (P2-9 Phase 58)
 */
import { colors } from '@/tokens';

export const priorityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: colors.error[400], label: '紧急' },
  high: { color: colors.warning[600], label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: colors.neutral[400], label: '低' },
};

export const statusConfig: Record<string, { color: string; label: string }> = {
  open: { color: 'default', label: '待处理' },
  assigned: { color: 'processing', label: '已分配' },
  'in-progress': { color: 'blue', label: '处理中' },
  resolved: { color: 'success', label: '已解决' },
  closed: { color: 'default', label: '已关闭' },
};

export const categoryLabels: Record<string, string> = {
  infrastructure: '基础设施',
  application: '应用',
  database: '数据库',
  network: '网络',
  security: '安全',
  deployment: '部署',
  pipeline: '流水线',
  performance: '性能',
  cost: '成本',
  other: '其他',
};

export const sourceLabels: Record<string, string> = {
  manual: '手动',
  alert: '告警',
  incident: '事件',
  api: 'API',
};

export const relationTypeLabels: Record<string, string> = {
  duplicate: '重复',
  'caused-by': '导致于',
  related: '关联',
  blocks: '阻塞',
};

export const relationTypeColors: Record<string, string> = {
  duplicate: 'volcano',
  'caused-by': 'magenta',
  related: 'cyan',
  blocks: 'orange',
};

export const slaStatusColors: Record<string, string> = {
  normal: colors.success[500],
  warning: colors.warning[500],
  danger: colors.error[400],
};

export const historyActionLabels: Record<string, string> = {
  created: '创建工单',
  assigned: '分配工单',
  transitioned: '状态变更',
  escalated: '升级工单',
  resolved: '解决工单',
  closed: '关闭工单',
};
