/**
 * SecretsManagement constants
 * 抽取自 index.tsx (P2-9 Phase 124)
 */
import type { SecretScope } from '@/api/secrets';

// Masked placeholder shown instead of actual secret values
export const MASKED_VALUE = '***';

// Scope label mapping
export const scopeLabelMap: Record<SecretScope, string> = {
  org: '组织',
  environment: '环境',
  project: '项目',
};

// Scope tag colors
export const scopeColorMap: Record<SecretScope, string> = {
  org: 'purple',
  environment: 'blue',
  project: 'green',
};
