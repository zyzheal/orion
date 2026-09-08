import type { Contract, DriftDetail } from './types';

export const FALLBACK_CONTRACTS: Contract[] = [
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/pipelines', method: 'GET', status: 'verified', lastVerified: '2026-08-26T10:00:00Z', version: '1.2.0' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/dba/migrations', method: 'GET', status: 'verified', lastVerified: '2026-08-26T09:30:00Z', version: '1.0.1' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/ai/chat', method: 'POST', status: 'drift', lastVerified: '2026-08-25T14:00:00Z', version: '2.0.0' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/deploy/release', method: 'POST', status: 'verified', lastVerified: '2026-08-26T08:00:00Z', version: '1.1.0' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/sbom/documents', method: 'GET', status: 'verified', lastVerified: '2026-08-26T11:00:00Z', version: '1.0.0' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/ci-type-designer', method: 'GET', status: 'missing', lastVerified: '', version: '0.1.0' },
  { consumer: 'orion-frontend', provider: 'orion-platform-svc', endpoint: '/api/v1/security/container-scan', method: 'GET', status: 'pending', lastVerified: '', version: '1.0.0' },
];

export const FALLBACK_DRIFT: DriftDetail[] = [
  { field: 'response.data.items[].status', expected: '"pending"|"running"|"success"|"failed"', actual: '"pending"|"running"|"success"|"failed"|"cancelled"', severity: 'minor' },
  { field: 'response.data.items[].metadata', expected: 'object', actual: 'object|null', severity: 'patch' },
];

export const STATUS_MAP: Record<string, { color: string; label: string }> = {
  verified: { color: 'green', label: '✅ 通过' },
  drift: { color: 'red', label: '⚠️ 漂移' },
  missing: { color: 'orange', label: '❌ 缺失' },
  pending: { color: 'default', label: '待验证' },
};

export const METHOD_COLOR: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'cyan',
};

export const SEVERITY_COLOR: Record<string, string> = {
  breaking: 'red',
  minor: 'orange',
  patch: 'blue',
};

export const PACT_STEPS = [
  { step: '1. Consumer 定义', desc: '消费者编写 Pact 期望 (JSON)' },
  { step: '2. Provider 验证', desc: 'Provider 加载 Pact 并运行验证' },
  { step: '3. CI 门禁', desc: '验证失败阻断合并' },
  { step: '4. Mock Server', desc: '基于 Pact 生成 Mock 供前端开发' },
];
