/**
 * SLA config constants
 * Color maps, label maps, select option lists for SLA management page.
 */

// ==================== SLA Type ====================

export const TYPE_COLOR_MAP: Record<string, string> = {
  response: 'blue',
  resolution: 'orange',
  availability: 'green',
};

export const TYPE_LABEL_MAP: Record<string, string> = {
  response: '响应时间',
  resolution: '解决时间',
  availability: '可用性',
};

export const TYPE_OPTIONS = [
  { label: '响应时间', value: 'response' },
  { label: '解决时间', value: 'resolution' },
  { label: '可用性', value: 'availability' },
] as const;

// ==================== SLA Definition Status ====================

export const DEF_STATUS_COLOR_MAP: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  archived: 'default',
};

export const DEF_STATUS_LABEL_MAP: Record<string, string> = {
  active: '启用',
  inactive: '停用',
  archived: '归档',
};

export const DEF_STATUS_OPTIONS = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
  { label: '归档', value: 'archived' },
] as const;

// ==================== Tracking Status ====================

export const TRACKING_STATUS_LABEL_MAP: Record<string, string> = {
  tracking: '追踪中',
  met: '已达成',
  breached: '已违约',
  paused: '已暂停',
};

export const TRACKING_STATUS_OPTIONS = [
  { label: '追踪中', value: 'tracking' },
  { label: '已达成', value: 'met' },
  { label: '已违约', value: 'breached' },
  { label: '已暂停', value: 'paused' },
] as const;

export const TRACKING_STATUS_BADGE_MAP: Record<
  string,
  'processing' | 'success' | 'error' | 'warning'
> = {
  tracking: 'processing',
  met: 'success',
  breached: 'error',
  paused: 'warning',
};

// ==================== Entity Type ====================

export const ENTITY_TYPE_COLOR_MAP: Record<string, string> = {
  incident: 'red',
  request: 'blue',
  change: 'purple',
};

export const ENTITY_TYPE_LABEL_MAP: Record<string, string> = {
  incident: '事件',
  request: '请求',
  change: '变更',
};

export const ENTITY_TYPE_OPTIONS = [
  { label: '事件', value: 'incident' },
  { label: '请求', value: 'request' },
  { label: '变更', value: 'change' },
] as const;

// ==================== Priority ====================

export const PRIORITY_COLOR_MAP: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'blue',
  low: 'default',
};

export const PRIORITY_LABEL_MAP: Record<string, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

export const PRIORITY_OPTIONS = [
  { label: '紧急', value: 'critical' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
] as const;

// ==================== Target Unit ====================

export const TARGET_UNIT_OPTIONS = [
  { label: '分钟', value: 'minutes' },
  { label: '小时', value: 'hours' },
  { label: '百分比', value: 'percent' },
] as const;

// ==================== Event Type (Breach) ====================

export const EVENT_TYPE_COLOR_MAP: Record<string, string> = {
  warning: 'orange',
  breach: 'red',
  escalation: 'purple',
};

export const EVENT_TYPE_LABEL_MAP: Record<string, string> = {
  warning: '预警',
  breach: '违约',
  escalation: '升级',
};
