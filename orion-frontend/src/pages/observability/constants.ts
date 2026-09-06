/**
 * constants.ts - RootCausePage 常量
 * 抽取自 observability/RootCausePage.tsx (P2-9 Phase 70)
 */

export const STATUS_COLOR_MAP: Record<string, string> = {
  analyzing: 'processing',
  completed: 'success',
  failed: 'error',
  partial: 'warning',
};

export const DEP_TYPE_COLOR_MAP: Record<string, string> = {
  sync: 'blue',
  async: 'green',
  database: 'orange',
  cache: 'purple',
  external: 'default',
};
