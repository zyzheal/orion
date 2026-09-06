/**
 * CI 类型设计器 常量
 * 抽取自 index.tsx (P2-9 Phase 106)
 */
export const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  draft: 'orange',
  archived: 'default',
  deprecated: 'red',
};

export const CATEGORY_OPTIONS = [
  { label: '基础设施', value: 'infrastructure' },
  { label: '应用服务', value: 'application' },
  { label: '网络', value: 'network' },
  { label: '安全', value: 'security' },
  { label: '其他', value: 'other' },
];

export const ATTRIBUTE_TYPE_OPTIONS = [
  { label: '字符串', value: 'string' },
  { label: '整数', value: 'integer' },
  { label: '布尔', value: 'boolean' },
  { label: '枚举', value: 'enum' },
  { label: '日期', value: 'date' },
  { label: '引用', value: 'reference' },
];
