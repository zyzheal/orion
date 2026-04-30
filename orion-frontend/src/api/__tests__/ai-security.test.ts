/**
 * AI Security API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSecurityStats,
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getEvaluations,
} from '../ai-security';
import { api } from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('AI Security API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get security stats', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { stats: { policiesActive: 18, requestsBlocked: 1247, complianceScore: 94 } } });
    const result = await getSecurityStats();
    expect(api.get).toHaveBeenCalledWith('/v1/ai-security/stats');
    expect(result.data.stats.policiesActive).toBe(18);
  });

  it('should get policies', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { policies: [] } });
    const result = await getPolicies();
    expect(api.get).toHaveBeenCalledWith('/v1/ai-security/policies');
    expect(Array.isArray(result.data.policies)).toBe(true);
  });

  it('should create a policy', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { policy: { id: '1', name: 'SQL Injection' } } });
    const result = await createPolicy({
      name: 'SQL Injection',
      description: 'Block SQL injection',
      type: 'input_validation',
      enabled: true,
      severity: 'high',
      rule: 'SELECT.*FROM',
      action: 'block',
      matchCount: 0,
    } as any);
    expect(api.post).toHaveBeenCalledWith('/v1/ai-security/policies', expect.objectContaining({ name: 'SQL Injection' }));
  });

  it('should update a policy', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { policy: { id: '1' } } });
    await updatePolicy('1', { enabled: false });
    expect(api.put).toHaveBeenCalledWith('/v1/ai-security/policies/1', { enabled: false });
  });

  it('should delete a policy', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined });
    await deletePolicy('1');
    expect(api.delete).toHaveBeenCalledWith('/v1/ai-security/policies/1');
  });

  it('should get evaluations', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { evaluations: [] } });
    await getEvaluations('policy-1');
    expect(api.get).toHaveBeenCalledWith('/v1/ai-security/evaluations?policyId=policy-1');
  });
});
