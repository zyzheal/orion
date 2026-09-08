/**
 * GlobalParams constants
 * 抽取自 index.tsx (P2-9 Phase 201)
 */

export const SCOPE_COLORS: Record<string, string> = {
  tenant: 'blue',
  pipeline: 'green',
  global: 'purple',
};

export const SCOPE_OPTIONS = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'global', label: 'Global' },
];

export const BOOL_OPTIONS = [
  { value: true, label: '是' },
  { value: false, label: '否' },
];
