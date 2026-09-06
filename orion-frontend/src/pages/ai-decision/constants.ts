/**
 * constants.ts - AI 决策引擎常量
 * 抽取自 AIDecisionPage.tsx (P2-9 Phase 84)
 */
export const statusColorMap: Record<string, string> = {
  active: 'success',
  deprecated: 'default',
  testing: 'processing',
};

export const decisionColorMap: Record<string, string> = {
  pass: 'success',
  fail: 'error',
  warn: 'warning',
  manual_review: 'processing',
};
