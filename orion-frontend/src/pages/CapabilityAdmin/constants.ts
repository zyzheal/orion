/**
 * constants.ts - 能力权限配置常量
 * 抽取自 CapabilityAdmin/index.tsx (P2-9 Phase 86)
 */
export const RISK_COLORS: Record<number, string> = {
  1: 'green',
  2: 'blue',
  3: 'orange',
  4: 'red',
};

export const RISK_LABELS: Record<number, string> = {
  1: '低风险',
  2: '中风险',
  3: '高风险',
  4: '最高风险',
};

export const AUDIT_ACTION_COLORS: Record<string, string> = {
  granted: 'green',
  revoked: 'red',
  expired: 'orange',
  requested: 'blue',
  approved: 'cyan',
  rejected: 'magenta',
};
