/**
 * ComponentRegistry constants
 * 抽取自 index.tsx (P2-9 Phase 194)
 */
export const CATEGORIES = [
  { value: 'basic', label: '基础' },
  { value: 'form', label: '表单' },
  { value: 'display', label: '展示' },
  { value: 'layout', label: '布局' },
  { value: 'data', label: '数据' },
  { value: 'custom', label: '自定义' },
];

export const getCategoryLabel = (value: string) =>
  CATEGORIES.find((c) => c.value === value)?.label || value;
