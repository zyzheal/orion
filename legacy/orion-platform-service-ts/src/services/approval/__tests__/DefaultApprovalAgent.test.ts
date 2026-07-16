/**
 * Tests for DefaultApprovalAgent
 */
import { DefaultApprovalAgent, createDefaultApprovalAgent } from '../DefaultApprovalAgent';
import { safeFetch } from '../../../utils/safeFetch';

jest.mock('../../../utils/safeFetch', () => ({
  safeFetch: jest.fn(),
}));

const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;

// Mock fetch globally
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('DefaultApprovalAgent', () => {
  let agent: DefaultApprovalAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new DefaultApprovalAgent({ aiServiceUrl: 'http://test-ai:5000' });
  });

  describe('evaluate', () => {
    it('should reject high risk prod operations', async () => {
      mockSafeFetch.mockResolvedValue({ ok: true }); // healthy

      const result = await agent.evaluate({
        operation: 'deploy',
        resource: 'prod/api-gateway',
        requester: 'user1',
        requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
        environment: 'prod',
        riskLevel: 4,
      });

      expect(result.action).toBe('reject');
      expect(result.riskScore).toBeGreaterThanOrEqual(90);
    });

    it('should reject high-risk operations in prod', async () => {
      mockSafeFetch.mockResolvedValue({ ok: true }); // healthy

      const result = await agent.evaluate({
        operation: 'delete',
        resource: 'prod/database',
        requester: 'user1',
        requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
        environment: 'prod',
        riskLevel: 2,
      });

      expect(result.action).toBe('reject');
    });

    it('should approve low risk dev operations', async () => {
      mockSafeFetch.mockResolvedValue({ ok: true }); // healthy

      const result = await agent.evaluate({
        operation: 'deploy',
        resource: 'dev/test-service',
        requester: 'user1',
        requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
        environment: 'dev',
        riskLevel: 1,
      });

      expect(result.action).toBe('approve');
    });

    it('should approve read operations', async () => {
      mockSafeFetch.mockResolvedValue({ ok: true }); // healthy

      const result = await agent.evaluate({
        operation: 'get',
        resource: 'prod/config',
        requester: 'user1',
        requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
        environment: 'prod',
        riskLevel: 1,
      });

      expect(result.action).toBe('approve');
    });

    it('should fallback to rules when AI is unhealthy', async () => {
      mockSafeFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await agent.evaluate({
        operation: 'deploy',
        resource: 'dev/service',
        requester: 'user1',
        requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
        environment: 'dev',
        riskLevel: 2,
      });

      expect(result.action).toBe('approve');
      expect(result.reason).toContain('AI 服务不可用');
    });

    it('should escalate when AI is unhealthy and prod environment', async () => {
      mockSafeFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await agent.evaluate({
        operation: 'deploy',
        resource: 'prod/service',
        requester: 'user1',
        requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
        environment: 'prod',
        riskLevel: 2,
      });

      expect(result.action).toBe('escalate');
    });

    it('should call LLM for medium risk operations', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            action: 'approve',
            confidence: 0.85,
            reason: 'LLM approved',
            riskScore: 40,
          }),
        });

      const result = await agent.evaluate({
        operation: 'deploy',
        resource: 'staging/service',
        requester: 'user1',
        requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
        environment: 'staging',
        riskLevel: 2,
      });

      expect(result.action).toBe('approve');
      expect(result.reason).toBe('LLM approved');
    });

    it('should fallback to rules when LLM call fails', async () => {
      mockSafeFetch
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockRejectedValueOnce(new Error('LLM error'));

      const result = await agent.evaluate({
        operation: 'deploy',
        resource: 'staging/service',
        requester: 'user1',
        requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
        environment: 'staging',
        riskLevel: 3,
      });

      expect(result.action).toBe('escalate');
    });
  });

  describe('isHealthy', () => {
    it('should return true when AI service is healthy', async () => {
      mockSafeFetch.mockResolvedValue({ ok: true });

      const result = await agent.isHealthy();
      expect(result).toBe(true);
    });

    it('should return false when AI service is unhealthy', async () => {
      mockSafeFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await agent.isHealthy();
      expect(result).toBe(false);
    });

    it('should return false when response is not ok', async () => {
      mockSafeFetch.mockResolvedValue({ ok: false, status: 503 });

      const result = await agent.isHealthy();
      expect(result).toBe(false);
    });
  });

  describe('analyzeRisk', () => {
    it('should calculate base risk score for prod environment', async () => {
      const result = await agent.analyzeRisk({
        context: {
          operation: 'deploy',
          resource: 'prod/api',
          requester: 'user1',
          requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
          environment: 'prod',
          riskLevel: 2,
        },
      });

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskLevel).toBeGreaterThan(0);
    });

    it('should include history factor when requested', async () => {
      const result = await agent.analyzeRisk({
        context: {
          operation: 'deploy',
          resource: 'dev/service',
          requester: 'user1',
          requesterHistory: { totalOperations: 10, rejectionRate: 0.6, recentIncidents: 0 },
          environment: 'dev',
          riskLevel: 1,
        },
        analysisDimensions: ['history'],
      });

      expect(result.riskFactors).toContain('申请人历史审批拒绝率高');
    });

    it('should include operation factor for high-risk operations', async () => {
      const result = await agent.analyzeRisk({
        context: {
          operation: 'delete',
          resource: 'dev/service',
          requester: 'user1',
          requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
          environment: 'dev',
          riskLevel: 1,
        },
        analysisDimensions: ['operation'],
      });

      expect(result.riskFactors.length).toBeGreaterThan(0);
    });

    it('should include resource factor for sensitive resources', async () => {
      const result = await agent.analyzeRisk({
        context: {
          operation: 'update',
          resource: 'prod/db/secret-keys',
          requester: 'user1',
          requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
          environment: 'prod',
          riskLevel: 2,
        },
        analysisDimensions: ['resource'],
      });

      expect(result.riskFactors.length).toBeGreaterThan(0);
    });

    it('should cap risk score at 100', async () => {
      const result = await agent.analyzeRisk({
        context: {
          operation: 'delete',
          resource: 'prod/db/secret',
          requester: 'user1',
          requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
          environment: 'prod',
          riskLevel: 4,
        },
        analysisDimensions: ['history', 'operation', 'resource'],
      });

      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('suggestApprover', () => {
    it('should suggest expert for high risk', async () => {
      const result = await agent.suggestApprover({
        context: {
          operation: 'delete',
          resource: 'prod/database',
          requester: 'user1',
          requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
          environment: 'prod',
          riskLevel: 4,
        },
      });

      expect(result.requiresExpertReview).toBe(true);
      expect(result.suggestedApprovers).toContain('super_admin');
    });

    it('should suggest manager for low risk', async () => {
      const result = await agent.suggestApprover({
        context: {
          operation: 'deploy',
          resource: 'dev/service',
          requester: 'user1',
          requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
          environment: 'dev',
          riskLevel: 1,
        },
      });

      expect(result.requiresExpertReview).toBe(false);
      expect(result.suggestedApprovers).toContain('manager');
    });
  });

  describe('autoApprove', () => {
    it('should approve low risk operations', async () => {
      const result = await agent.autoApprove({
        context: {
          operation: 'deploy',
          resource: 'dev/service',
          requester: 'user1',
          requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
          environment: 'dev',
          riskLevel: 1,
        },
      });

      expect(result.approved).toBe(true);
      expect(result.action).toBe('approve');
    });

    it('should not approve high risk prod operations', async () => {
      const result = await agent.autoApprove({
        context: {
          operation: 'delete',
          resource: 'prod/database',
          requester: 'user1',
          requesterHistory: { totalOperations: 10, rejectionRate: 0, recentIncidents: 0 },
          environment: 'prod',
          riskLevel: 4,
        },
      });

      expect(result.approved).toBe(false);
      expect(result.action).toBe('escalate');
    });
  });

  describe('getConfig', () => {
    it('should return config copy', () => {
      const config = agent.getConfig();
      expect(config).toBeDefined();
      expect(config.aiServiceUrl).toBe('http://test-ai:5000');
    });
  });
});

describe('createDefaultApprovalAgent', () => {
  it('should create a DefaultApprovalAgent instance', () => {
    const agent = createDefaultApprovalAgent();
    expect(agent.name).toBe('default-approval-agent');
    expect(agent.evaluate).toBeDefined();
    expect(agent.isHealthy).toBeDefined();
  });
});
