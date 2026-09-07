/**
 * Role Management constants
 * 抽取自 index.tsx (P2-9 Phase 165)
 */

export const DEFAULT_TENANT_ID = 'tenant-default';

export const getPermissionColor = (value: string): string => {
  if (
    value.includes(':write') ||
    value.includes(':execute') ||
    value.includes(':delete') ||
    value.includes(':manage')
  )
    return 'blue';
  if (value.includes(':read')) return 'green';
  return 'default';
};
