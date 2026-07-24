/**
 * Tests for ApproverResolver
 */
import { ApproverResolver, createFallbackStep, createApproverRule, getRiskLevelLabel, getDeriveTypeLabel } from '../ApproverResolver';

const mockQuery = jest.fn();
const mockUserFindById = jest.fn();
const mockCapabilityFindById = jest.fn();

jest.mock('../../user/UserRepository', () => ({
  UserRepository: jest.fn().mockImplementation(() => ({
    findById: mockUserFindById,
  })),
}));

jest.mock('../../capability/CapabilityRepository', () => ({
  CapabilityRepository: jest.fn().mockImplementation(() => ({
    findById: mockCapabilityFindById,
  })),
}));

describe('ApproverResolver', () => {
  let resolver: ApproverResolver;
  const mockPool = { query: mockQuery };

  beforeEach(() => {
    jest.clearAllMocks();
    resolver = new ApproverResolver(mockPool as any);
  });

  describe('resolveApprover', () => {
    it('should return default rule when capability not found', async () => {
      mockCapabilityFindById.mockResolvedValue(undefined);

      const result = await resolver.resolveApprover('nonexistent', {
        capabilityId: 'nonexistent',
        requesterId: 'user1',
        environment: 'dev',
        riskLevel: 2,
        tenantId: 'tenant-1',
      });

      expect(result.success).toBe(true);
      expect(result.fallbackChain.length).toBeGreaterThan(0);
    });

    it('should resolve by user type', async () => {
      mockCapabilityFindById.mockResolvedValue({
        id: 'cap-1',
        metadata: {
          approverConfig: {
            type: 'user',
            value: 'specific-user',
            backupApprovers: [],
            fallbackChain: [],
            backupTimeoutMinutes: 30,
          },
        },
      });
      mockUserFindById.mockResolvedValue({ id: 'specific-user', status: 'active' });

      const result = await resolver.resolveApprover('cap-1', {
        capabilityId: 'cap-1',
        requesterId: 'user1',
        environment: 'dev',
        riskLevel: 1,
        tenantId: 'tenant-1',
      });

      expect(result.success).toBe(true);
    });

    it('should use approval_role when no approverConfig', async () => {
      mockCapabilityFindById.mockResolvedValue({
        id: 'cap-1',
        approval_role: 'admin',
        metadata: {},
      });
      mockQuery.mockResolvedValue({ rows: [{ id: 'admin-user' }] });

      const result = await resolver.resolveApprover('cap-1', {
        capabilityId: 'cap-1',
        requesterId: 'user1',
        environment: 'dev',
        riskLevel: 1,
        tenantId: 'tenant-1',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('filterAvailableApprovers', () => {
    it('should return empty for empty input', async () => {
      const result = await resolver.filterAvailableApprovers([]);
      expect(result).toEqual([]);
    });

    it('should filter out unavailable approvers', async () => {
      mockUserFindById
        .mockResolvedValueOnce({ id: 'user1', status: 'active' })
        .mockResolvedValueOnce({ id: 'user2', status: 'frozen' });

      const result = await resolver.filterAvailableApprovers(['user1', 'user2']);
      expect(result).toEqual(['user1']);
    });

    it('should filter out non-existent users', async () => {
      mockUserFindById
        .mockResolvedValueOnce({ id: 'user1', status: 'active' })
        .mockResolvedValueOnce(undefined);

      const result = await resolver.filterAvailableApprovers(['user1', 'ghost']);
      expect(result).toEqual(['user1']);
    });
  });

  describe('checkApproverAvailability', () => {
    it('should return available for active user', async () => {
      mockUserFindById.mockResolvedValue({ id: 'user1', status: 'active' });

      const result = await resolver.checkApproverAvailability('user1');
      expect(result.isAvailable).toBe(true);
    });

    it('should return unavailable for frozen user', async () => {
      mockUserFindById.mockResolvedValue({ id: 'user1', status: 'frozen' });

      const result = await resolver.checkApproverAvailability('user1');
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('frozen');
    });

    it('should return unavailable for disabled user', async () => {
      mockUserFindById.mockResolvedValue({ id: 'user1', status: 'disabled' });

      const result = await resolver.checkApproverAvailability('user1');
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('should return unavailable for non-existent user', async () => {
      mockUserFindById.mockResolvedValue(undefined);

      const result = await resolver.checkApproverAvailability('ghost');
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should return unavailable for DND user', async () => {
      mockUserFindById.mockResolvedValue({
        id: 'user1',
        status: 'active',
        settings: { availability: 'dnd' },
      });

      const result = await resolver.checkApproverAvailability('user1');
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('DND');
    });

    it('should return unavailable for offline user (>24h)', async () => {
      const oldLogin = new Date(Date.now() - 25 * 60 * 60 * 1000);
      mockUserFindById.mockResolvedValue({
        id: 'user1',
        status: 'active',
        last_login_at: oldLogin.toISOString(),
      });

      const result = await resolver.checkApproverAvailability('user1');
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('offline');
    });

    it('should handle errors gracefully', async () => {
      mockUserFindById.mockRejectedValue(new Error('DB error'));

      const result = await resolver.checkApproverAvailability('user1');
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('Error');
    });
  });

  describe('autoApproveCheck', () => {
    it('should return false for unavailable approver', async () => {
      mockUserFindById.mockResolvedValue(undefined);

      const result = await resolver.autoApproveCheck('user1', 1, {
        capabilityId: 'cap-1',
        requesterId: 'user1',
        environment: 'dev',
        riskLevel: 1,
        tenantId: 'tenant-1',
      });

      expect(result).toBe(false);
    });

    it('should return false for production environment', async () => {
      mockUserFindById.mockResolvedValue({ id: 'user1', status: 'active', role: 'admin' });
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await resolver.autoApproveCheck('user1', 1, {
        capabilityId: 'cap-1',
        requesterId: 'user1',
        environment: 'prod',
        riskLevel: 1,
        tenantId: 'tenant-1',
      });

      expect(result).toBe(false);
    });

    it('should return false when risk level exceeds threshold', async () => {
      mockUserFindById.mockResolvedValue({ id: 'user1', status: 'active', role: 'admin' });

      const result = await resolver.autoApproveCheck('user1', 5, {
        capabilityId: 'cap-1',
        requesterId: 'user1',
        environment: 'dev',
        riskLevel: 5,
        tenantId: 'tenant-1',
      });

      expect(result).toBe(false);
    });
  });
});

describe('createFallbackStep', () => {
  it('should create fallback step with defaults', () => {
    const step = createFallbackStep('step-1', 'manager');
    expect(step.id).toBe('step-1');
    expect(step.deriveType).toBe('manager');
    expect(step.autoApprove).toBe(false);
    expect(step.autoApproveMaxRiskLevel).toBe(2);
  });

  it('should create fallback step with custom options', () => {
    const step = createFallbackStep('step-2', 'role-escalation', {
      deriveParam: 'super_admin',
      autoApprove: true,
      autoApproveMaxRiskLevel: 1,
    });
    expect(step.deriveParam).toBe('super_admin');
    expect(step.autoApprove).toBe(true);
    expect(step.autoApproveMaxRiskLevel).toBe(1);
  });
});

describe('createApproverRule', () => {
  it('should create approver rule with defaults', () => {
    const rule = createApproverRule('user', 'user1');
    expect(rule.type).toBe('user');
    expect(rule.value).toBe('user1');
    expect(rule.backupApprovers).toEqual([]);
    expect(rule.fallbackChain).toEqual([]);
    expect(rule.backupTimeoutMinutes).toBe(30);
  });

  it('should create approver rule with custom options', () => {
    const rule = createApproverRule('role', 'admin', {
      backupApprovers: ['backup1'],
      backupTimeoutMinutes: 60,
    });
    expect(rule.backupApprovers).toEqual(['backup1']);
    expect(rule.backupTimeoutMinutes).toBe(60);
  });
});

describe('getRiskLevelLabel', () => {
  it('should return correct labels', () => {
    expect(getRiskLevelLabel(1)).toBe('低风险');
    expect(getRiskLevelLabel(2)).toBe('中低风险');
    expect(getRiskLevelLabel(3)).toBe('中高风险');
    expect(getRiskLevelLabel(4)).toBe('高风险');
    expect(getRiskLevelLabel(5)).toBe('未知');
  });
});

describe('getDeriveTypeLabel', () => {
  it('should return correct labels', () => {
    expect(getDeriveTypeLabel('manager')).toBe('直属领导');
    expect(getDeriveTypeLabel('department-head')).toBe('部门负责人');
    expect(getDeriveTypeLabel('role-escalation')).toBe('角色升级');
    expect(getDeriveTypeLabel('oncall')).toBe('值班人员');
    expect(getDeriveTypeLabel('fixed-user')).toBe('固定用户');
  });
});
