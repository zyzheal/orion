/**
 * PR Trigger Management constants
 * 抽取自 index.tsx (P2-9 Phase 153)
 */
export const PROVIDER_LABEL: Record<string, string> = {
  github: 'GitHub PR',
  gitlab: 'GitLab MR',
  both: 'GitHub + GitLab',
};

export const SECURITY_LABEL: Record<string, string> = {
  safe: '安全模式',
  trusted: '信任模式',
  full: '完全模式',
};
