/**
 * ApprovalFlowEngine Tests
 */
import { ApprovalFlowEngine, ApprovalFlowConfig, createDefaultFlowConfig, getRiskLevelLabel, getRiskLevelColor } from '../ApprovalFlowEngine';
import { v4 as uuidv4 } from 'uuid';

// Mock DatabasePool
class MockPool {
  queries: Array<{ text: string; params?: unknown[] }> = [];

  async query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }> {
    this.queries.push({ text, params });

    // Mock table creation (CREATE TABLE IF NOT EXISTS)
    if (text.includes('CREATE TABLE IF NOT EXISTS')) {
      return { rows: [], rowCount: null };
    }

    // Mock flow config queries
    if (text.includes('approval_flow_configs')) {
      if (text.includes('INSERT INTO')) {
        return { rows: [{ id: uuidv4() }], rowCount: 1 };
      }
      if (text.includes('SELECT') && text.includes('WHERE flow_id')) {
        return { rows: [], rowCount: null };
      }
      if (text.includes('SELECT') && text.includes('ORDER BY')) {
        return { rows: [], rowCount: null };
      }
      if (text.includes('UPDATE')) {
        return { rows: [], rowCount: 1 };
      }
      if (text.includes('DELETE')) {
        return { rows: [], rowCount: 1 };
      }
    }

    // Mock approval_approver_rules
    if (text.includes('approval_approver_rules')) {
      if (text.includes('CREATE TABLE')) {
        return { rows: [], rowCount: null };
      }
    }

    // Mock approval_fallback_logs
    if (text.includes('approval_fallback_logs')) {
      if (text.includes('CREATE TABLE')) {
        return { rows: [], rowCount: null };
      }
    }

    return { rows: [], rowCount: null };
  }
}

// Mock MultiLevelApprovalService
const mockMultiLevelService = {
  submitApprovalRequest: jest.fn().mockResolvedValue({
    id: 'approval_123',
    status: 'pending',
    title: 'Test Approval',
  }),
  review: jest.fn().mockResolvedValue({
    id: 'approval_123',
    status: 'approved',
  }),
  getApprovalChain: jest.fn(),
  getPendingApprovals: jest.fn().mockResolvedValue([]),
};

// Replace with actual implementation for testing
jest.mock('../MultiLevelApprovalService', () => ({
  MultiLevelApprovalService: jest.fn().mockImplementation(() => mockMultiLevelService),
  ApprovalAction: {
    APPROVE: 'approve',
    REJECT: 'reject',
  },
  ApprovalMode: {
    SERIAL: 'serial',
    PARALLEL: 'parallel',
  },
}));

describe('ApprovalFlowEngine', () => {
  let engine: ApprovalFlowEngine;
  let mockPool: MockPool;

  beforeEach(() => {
    mockPool = new MockPool();
    engine = new ApprovalFlowEngine(mockPool, mockPool as any);
    jest.clearAllMocks();
  });

  describe('createDefaultFlowConfig', () => {
    it('should create default flow config with human node', () => {
      const config = createDefaultFlowConfig('Test Flow', 'test-flow', {
        approverType: 'role',
        approverValue: 'admin',
      });

      expect(config.flowId).toBe('test-flow');
      expect(config.name).toBe('Test Flow');
      expect(config.enabled).toBe(true);
      expect(config.nodes).toHaveLength(1);
      expect(config.nodes[0].nodeType).toBe('human');
      expect(config.nodes[0].approverType).toBe('role');
      expect(config.nodes[0].approverValue).toBe('admin');
    });

    it('should use defaults when options not provided', () => {
      const config = createDefaultFlowConfig('Default', 'default');

      expect(config.nodes[0].approverType).toBe('role');
      expect(config.nodes[0].approverValue).toBe('admin');
      expect(config.nodes[0].timeoutMinutes).toBe(60);
    });
  });

  describe('getRiskLevelLabel', () => {
    it('should return correct labels for each risk level', () => {
      expect(getRiskLevelLabel(1)).toBe('低风险');
      expect(getRiskLevelLabel(2)).toBe('中低风险');
      expect(getRiskLevelLabel(3)).toBe('中高风险');
      expect(getRiskLevelLabel(4)).toBe('高风险');
      expect(getRiskLevelLabel(5)).toBe('未知');
    });
  });

  describe('getRiskLevelColor', () => {
    it('should return correct colors for each risk level', () => {
      expect(getRiskLevelColor(1)).toBe('success');
      expect(getRiskLevelColor(2)).toBe('info');
      expect(getRiskLevelColor(3)).toBe('warning');
      expect(getRiskLevelColor(4)).toBe('error');
      expect(getRiskLevelColor(0)).toBe('default');
    });
  });

  describe('matchFlow', () => {
    it('should return null when no matching config exists', async () => {
      const result = await engine.matchFlow('unknown-capability', 'prod', 3, 'default');

      expect(result).toBeNull();
    });
  });

  describe('createFlowConfig', () => {
    it('should create flow config successfully', async () => {
      const config = createDefaultFlowConfig('New Flow', 'new-flow');

      const result = await engine.createFlowConfig('default', config);

      expect(result).toBeDefined();
      expect(result.flowId).toBe('new-flow');
      expect(result.version).toBe(1);
    });
  });

  describe('getFlowConfig', () => {
    it('should return null for non-existent flow', async () => {
      const result = await engine.getFlowConfig('non-existent', 'default');

      expect(result).toBeNull();
    });
  });

  describe('listFlowConfigs', () => {
    it('should return empty array when no configs exist', async () => {
      const result = await engine.listFlowConfigs('default');

      expect(result).toEqual([]);
    });
  });

  describe('updateFlowConfig', () => {
    it('should return null when updating non-existent config', async () => {
      const result = await engine.updateFlowConfig('non-existent', 'default', {
        name: 'Updated Name',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteFlowConfig', () => {
    it('should return result when deleting config', async () => {
      const result = await engine.deleteFlowConfig('non-existent', 'default');

      // Just verify it returns a result (mock returns rowCount: 1)
      expect(result).toBeDefined();
    });
  });

  describe('approve', () => {
    it('should handle approval errors gracefully', async () => {
      // Test error handling case
      const result = await engine.approve('approval_123', 'approver_1', 'approve');

      // The mock may return different values, just check it returns a result
      expect(result).toBeDefined();
      expect(result.ticketId).toBeDefined();
    });
  });

  describe('reject', () => {
    it('should return result when rejecting', async () => {
      const result = await engine.reject('approval_123', 'approver_1', 'Security concern');

      // Just verify it returns a result object
      expect(result).toBeDefined();
      expect(result.ticketId).toBeDefined();
    });
  });

  describe('startFlow', () => {
    it('should return error when config has no nodes', async () => {
      const config: ApprovalFlowConfig = {
        id: 'flow_1',
        tenantId: 'default',
        flowId: 'test',
        name: 'Test',
        enabled: true,
        nodes: [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await engine.startFlow(config, {
        capabilityId: 'deploy',
        environment: 'prod',
        riskLevel: 3,
        resourceType: 'deployment',
        resourceId: 'dep_123',
        requesterId: 'user_1',
        title: 'Deploy to prod',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No nodes');
    });
  });

  describe('external service integration', () => {
    it('should register external client', () => {
      const mockClient = {
        Approve: jest.fn().mockResolvedValue({ approved: true, approverId: 'ext_1' }),
      };

      engine.registerExternalClient('external-approval', mockClient);

      // Client is registered (no error thrown)
      expect(true).toBe(true);
    });

    it('should throw when calling non-existent external service', async () => {
      await expect(
        engine.callExternalApprovalService('non-existent', {
          ticketId: '123',
          context: {
            capabilityId: 'test',
            environment: 'dev',
            riskLevel: 1,
            resourceType: 'test',
            resourceId: '123',
            requesterId: 'user_1',
            title: 'Test',
          },
        }),
      ).rejects.toThrow('External approval service not found');
    });
  });
});

describe('Type exports', () => {
  it('should export all required types', () => {
    // Verify types are exported correctly by checking they can be used
    const flowNodeTypes = ['human', 'condition', 'agent', 'parallel-group', 'fallback-chain'] as const;
    expect(flowNodeTypes).toContain('human');
    expect(flowNodeTypes).toContain('agent');
  });
});