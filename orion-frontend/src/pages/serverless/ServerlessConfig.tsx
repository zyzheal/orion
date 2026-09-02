/**
 * ServerlessPage configuration constants.
 *
 * Extracted from ServerlessPage.tsx for reusability across components
 * and to reduce the main page file size.
 *
 * All values are self-contained constants — no stateful logic or handlers.
 */
import { ReactNode } from 'react';
import { FunctionStatus, FunctionRuntime, TriggerType } from '@/api/serverless';
import { colors } from '@/tokens/colors';

// ============================================================================
// Status maps
// ============================================================================

export const statusColorMap: Record<FunctionStatus, string> = {
  draft: colors.neutral[500],
  deployed: colors.success[500],
  stopped: colors.warning[500],
  error: colors.error[500],
};

export const statusLabelMap: Record<FunctionStatus, string> = {
  draft: '草稿',
  deployed: '已部署',
  stopped: '已停止',
  error: '错误',
};

// ============================================================================
// Runtime maps
// ============================================================================

export const runtimeLabelMap: Record<FunctionRuntime, string> = {
  nodejs18: 'Node.js 18',
  nodejs20: 'Node.js 20',
  'python3.9': 'Python 3.9',
  'python3.11': 'Python 3.11',
  'go1.21': 'Go 1.21',
  java17: 'Java 17',
};

export const runtimeSelectOptions: readonly { value: FunctionRuntime; label: string }[] = [
  { value: 'nodejs18', label: 'Node.js 18' },
  { value: 'nodejs20', label: 'Node.js 20' },
  { value: 'python3.9', label: 'Python 3.9' },
  { value: 'python3.11', label: 'Python 3.11' },
  { value: 'go1.21', label: 'Go 1.21' },
  { value: 'java17', label: 'Java 17' },
] as const;

// ============================================================================
// Trigger type maps
// ============================================================================

export const triggerTypeLabelMap: Record<TriggerType, string> = {
  http: 'HTTP',
  cron: '定时任务',
  event: '事件',
  queue: '消息队列',
  kafka: 'Kafka',
  s3: '对象存储',
};

export const triggerTypeColorMap: Record<TriggerType, string> = {
  http: colors.primary[500],
  cron: colors.success[500],
  event: colors.info[500],
  queue: colors.warning[500],
  kafka: colors.purple[500],
  s3: colors.neutral[700],
};

export const triggerTypeSelectOptions: readonly { value: TriggerType; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'cron', label: '定时任务' },
  { value: 'event', label: '事件' },
  { value: 'queue', label: '消息队列' },
  { value: 'kafka', label: 'Kafka' },
  { value: 's3', label: '对象存储' },
] as const;

// ============================================================================
// Scale action maps (auto-scaling recommendations)
// ============================================================================

export const scaleActionColorMap: Record<string, string> = {
  scale_up: colors.error[500],
  scale_down: colors.warning[500],
  no_change: colors.success[500],
};

export const scaleActionLabelMap: Record<string, string> = {
  scale_up: '扩容',
  scale_down: '缩容',
  no_change: '不变',
};

// ============================================================================
// Log level color map
// ============================================================================

export const logLevelColorMap: Record<string, string> = {
  info: colors.info[500],
  warn: colors.warning[500],
  error: colors.error[500],
  debug: colors.neutral[500],
};

// ============================================================================
// Tab configuration
// ============================================================================

export type ServerlessTabKey = 'functions' | 'triggers' | 'metrics';

export interface ServerlessTabItem {
  key: ServerlessTabKey;
  label: string;
  children: ReactNode;
}

export const tabConfig: Omit<ServerlessTabItem, 'children'>[] = [
  { key: 'functions', label: '函数管理' },
  { key: 'triggers', label: '事件触发器' },
  { key: 'metrics', label: '指标与扩缩容' },
];

// ============================================================================
// HTTP method options for trigger creation form
// ============================================================================

export const httpMethodOptions: readonly { value: string; label: string }[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
] as const;
