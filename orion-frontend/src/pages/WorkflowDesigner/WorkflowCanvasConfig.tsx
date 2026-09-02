/**
 * 工作流画布配置常量
 *
 * 从 WorkflowCanvas.tsx 中提取的纯静态配置对象：
 * - 节点类型颜色/标签映射
 * - 审批/通知/Webhook/错误处理选项
 * - ReactFlow 默认边样式
 */
import { colors, themeVars } from '@/tokens';

// ==================== 节点类型映射 ====================

export const nodeTypeColors: Record<string, string> = {
  start: colors.success[500],
  approval: colors.purple[500],
  condition: colors.warning[500],
  notification: colors.info[500],
  webhook: colors.primary[500],
  task: colors.primary[600],
  'sub-workflow': colors.purple[600],
  delay: colors.info[400],
  timer: colors.purple[500],
  end: colors.neutral[500],
};

export const nodeTypeLabels: Record<string, string> = {
  start: '开始节点',
  approval: '审批节点',
  condition: '条件分支',
  notification: '通知节点',
  webhook: 'Webhook',
  task: '人工任务',
  'sub-workflow': '子流程',
  delay: '延迟节点',
  timer: '定时器',
  end: '结束节点',
};

// ==================== 审批节点配置选项 ====================

export const approvalModeOptions = [
  { label: '一人通过', value: 'one' },
  { label: '多数通过', value: 'majority' },
  { label: '全员通过', value: 'all' },
];

// ==================== 通知节点渠道选项 ====================

export const notificationChannelOptions = [
  { label: '邮件', value: 'email' },
  { label: '短信', value: 'sms' },
  { label: '钉钉', value: 'dingtalk' },
  { label: '飞书', value: 'feishu' },
  { label: 'Webhook', value: 'webhook' },
];

// ==================== Webhook 请求方法选项 ====================

export const webhookMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
];

// ==================== 错误处理策略选项 ====================

export const errorHandlingStrategyOptions = [
  { label: '跳过', value: 'skip' },
  { label: '重试', value: 'retry' },
  { label: '终止', value: 'abort' },
];

// ==================== 重试次数选项 ====================

export const retryCountOptions = [
  { label: '1 次', value: 1 },
  { label: '2 次', value: 2 },
  { label: '3 次', value: 3 },
];

// ==================== ReactFlow 默认边样式 ====================

export const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: { stroke: colors.neutral[400], strokeWidth: 2 },
};

// ==================== ReactFlow Controls 样式 ====================

export const controlsStyle = {
  background: colors.neutral[0],
  border: `1px solid ${colors.neutral[200]}`,
  borderRadius: 8,
};

// ==================== ReactFlow MiniMap 样式 ====================

export const miniMapStyle = {
  background: colors.neutral[0],
  border: `1px solid ${colors.neutral[200]}`,
};

// ==================== ReactFlow 画布背景色 ====================

export const canvasBackgroundColor = themeVars.bgSecondary;

// ==================== 工具栏分隔线样式 ====================

export const toolbarDividerBottom = `1px solid ${colors.neutral[200]}`;
