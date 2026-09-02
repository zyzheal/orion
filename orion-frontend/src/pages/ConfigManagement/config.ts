import type { ConfigItem } from '@/api/config';

/** 环境列表 */
export const ENVIRONMENTS = ['dev', 'staging', 'prod'] as const;

/** 表单环境选项（与后端对齐） */
export const ENVIRONMENT_OPTIONS = [
  { label: 'development', value: 'development' },
  { label: 'testing', value: 'testing' },
  { label: 'staging', value: 'staging' },
  { label: 'production', value: 'production' },
] as const;

/** 表格环境筛选项 */
export const ENVIRONMENT_FILTERS = [
  { text: 'development', value: 'development' },
  { text: 'testing', value: 'testing' },
  { text: 'staging', value: 'staging' },
  { text: 'production', value: 'production' },
] as const;

/** 分类选项 */
export const CATEGORY_OPTIONS = [
  { label: 'application', value: 'application' },
  { label: 'database', value: 'database' },
  { label: 'cache', value: 'cache' },
  { label: 'feature', value: 'feature' },
] as const;

/** 版本选择选项（v1~v10） */
export const VERSION_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1).map((v) => ({
  label: `v${v}`,
  value: v,
})) as const;

/** 状态 → 标签颜色映射 */
export const STATUS_COLOR_MAP: Record<string, string> = {
  draft: 'default',
  pending_approval: 'orange',
  approved: 'blue',
  rejected: 'red',
  active: 'green',
};

/** 状态 → 中文标签映射 */
export const STATUS_LABEL_MAP: Record<string, string> = {
  active: '已激活',
  pending_approval: '待审批',
  draft: '草稿',
  approved: '已批准',
  rejected: '已拒绝',
};

/** 变更操作 → 颜色映射 */
export const CHANGE_COLOR_MAP: Record<string, string> = {
  add: 'green',
  remove: 'red',
  update: 'orange',
};

/** 变更操作 → 中文标签映射 */
export const CHANGE_LABEL_MAP: Record<string, string> = {
  add: '新增',
  remove: '删除',
  update: '变更',
};

/** 状态中文名称（用于 Drawer 详情页） */
export const STATUS_NAME_MAP: Record<string, string> = STATUS_LABEL_MAP;

/** 配置列表转为 Select 选项 */
export const buildConfigSelectOptions = (configs: ConfigItem[]) =>
  configs.map((c) => ({
    label: `${c.key} (${c.environment})`,
    value: c.id,
  }));
