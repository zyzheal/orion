/**
 * EnvProfiles constants
 * 抽取自 index.tsx (P2-9 Phase 178)
 */
export const ENV_COLOR: Record<string, string> = {
  development: 'green',
  staging: 'orange',
  production: 'red',
};

export const ENVIRONMENT_OPTIONS = [
  { value: 'development', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
];
