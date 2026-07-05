/**
 * AutomationRuleService Unit Tests
 */

import { AutomationRuleService, AutomationRuleServiceError } from '../AutomationRuleService';
import { AutomationRuleRepository, AutomationRule, AutomationRuleExecution } from '../repositories/AutomationRuleRepository';
import { getCurrentTenantId, getCurrentUserId } from '../../../db/tenant-context-storage';

jest.mock('../../../db/tenant-context-storage', () => {
  const mockFn = jest.fn(() => '__system__');
  return { getCurrentTenantId: mockFn, getCurrentUserId: mockFn };
});

const MOCK_TENANT_ID = '__system__';
const MOCK_USER_ID = 'user-1';

// Mock AutomationRuleRepository
const mockAutomationRuleRepo = {
  createRule: jest.fn(),
  findRuleById: jest.fn(),
  findAllRules: jest.fn(),
  updateRule: jest.fn(),
  deleteRule: jest.fn(),
  incrementExecutionCount: jest.fn(),
  getEnabledRules: jest.fn(),
  createExecution: jest.fn(),
  updateExecution: jest.fn(),
  getExecutionsByRule: jest.fn(),
  getExecutionsByTicket: jest.fn(),
} as unknown as AutomationRuleRepository;

describe('AutomationRuleService', () => {
  let service: AutomationRuleService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentTenantId as jest.Mock).mockReturnValue(MOCK_TENANT_ID);
    (getCurrentUserId as jest.Mock).mockReturnValue(MOCK_USER_ID);
    service = new AutomationRuleService(mockAutomationRuleRepo);
  });

  // ==================== AutomationRuleServiceError ====================

  describe('AutomationRuleServiceError', () => {
    it('should set message and code', () => {
      const error = new AutomationRuleServiceError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AutomationRuleServiceError');
    });

    it('should be an instance of Error', () => {
      const error = new AutomationRuleServiceError('msg', 'CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  // ==================== createRule ====================

  describe('createRule', () => {
    it('should create an automation rule', async () => {
      const mockRule = {
        id: 'AR-1',
        tenantId: MOCK_TENANT_ID,
        name: 'Auto Assign Critical',
        description: 'Auto assign critical tickets',
        enabled: true,
        priority: 10,
        conditions: [{ field: 'priority', operator: 'eq', value: 'critical' }],
        actions: [{ type: 'assign', payload: { assignee: 'user-1' } }],
        executionCount: 0,
        createdBy: MOCK_USER_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AutomationRule;

      (mockAutomationRuleRepo.createRule as jest.Mock).mockResolvedValue(mockRule);

      const result = await service.createRule({
        name: 'Auto Assign Critical',
        description: 'Auto assign critical tickets',
        conditions: [{ field: 'priority', operator: 'eq', value: 'critical' }],
        actions: [{ type: 'assign', payload: { assignee: 'user-1' } }],
      });

      expect(mockAutomationRuleRepo.createRule).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Auto Assign Critical',
          description: 'Auto assign critical tickets',
          conditions: [{ field: 'priority', operator: 'eq', value: 'critical' }],
          actions: [{ type: 'assign', payload: { assignee: 'user-1' } }],
          createdBy: MOCK_USER_ID,
        }),
        MOCK_TENANT_ID,
      );
      expect(result).toEqual(mockRule);
    });
  });

  // ==================== getRule ====================

  describe('getRule', () => {
    it('should return a rule by ID', async () => {
      const mockRule = {
        id: 'AR-1',
        tenantId: MOCK_TENANT_ID,
        name: 'Auto Assign',
        enabled: true,
        priority: 10,
        conditions: [],
        actions: [],
        executionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AutomationRule;

      (mockAutomationRuleRepo.findRuleById as jest.Mock).mockResolvedValue(mockRule);

      const result = await service.getRule(MOCK_TENANT_ID, 'AR-1');
      expect(result).toEqual(mockRule);
    });

    it('should return null if rule not found', async () => {
      (mockAutomationRuleRepo.findRuleById as jest.Mock).mockResolvedValue(null);
      const result = await service.getRule(MOCK_TENANT_ID, 'non-existent');
      expect(result).toBeNull();
    });
  });

  // ==================== listRules ====================

  describe('listRules', () => {
    it('should list rules for a tenant', async () => {
      const mockRules = [
        {
          id: 'AR-1',
          tenantId: MOCK_TENANT_ID,
          name: 'Rule 1',
          enabled: true,
          priority: 10,
          conditions: [],
          actions: [],
          executionCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as AutomationRule,
      ];

      (mockAutomationRuleRepo.findAllRules as jest.Mock).mockResolvedValue(mockRules);

      const result = await service.listRules(MOCK_TENANT_ID);
      expect(result).toEqual(mockRules);
      expect(mockAutomationRuleRepo.findAllRules).toHaveBeenCalledWith(undefined);
    });

    it('should pass options to repository', async () => {
      const mockRules: AutomationRule[] = [];
      (mockAutomationRuleRepo.findAllRules as jest.Mock).mockResolvedValue(mockRules);

      await service.listRules(MOCK_TENANT_ID, { enabled: true, limit: 10, offset: 0 });
      expect(mockAutomationRuleRepo.findAllRules).toHaveBeenCalledWith({ enabled: true, limit: 10, offset: 0 });
    });
  });

  // ==================== updateRule ====================

  describe('updateRule', () => {
    it('should update a rule', async () => {
      const updatedRule = {
        id: 'AR-1',
        tenantId: MOCK_TENANT_ID,
        name: 'Updated Rule',
        description: 'Updated description',
        enabled: true,
        priority: 20,
        conditions: [{ field: 'priority', operator: 'eq', value: 'high' }],
        actions: [{ type: 'set_priority', payload: { priority: 'high' } }],
        executionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AutomationRule;

      (mockAutomationRuleRepo.updateRule as jest.Mock).mockResolvedValue(updatedRule);

      const result = await service.updateRule(MOCK_TENANT_ID, 'AR-1', {
        name: 'Updated Rule',
        priority: 20,
      });

      expect(result).toEqual(updatedRule);
    });

    it('should throw NOT_FOUND if rule does not exist', async () => {
      (mockAutomationRuleRepo.updateRule as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateRule(MOCK_TENANT_ID, 'non-existent', { name: 'New Name' })
      ).rejects.toThrow(AutomationRuleServiceError);
    });
  });

  // ==================== deleteRule ====================

  describe('deleteRule', () => {
    it('should delete a rule', async () => {
      (mockAutomationRuleRepo.deleteRule as jest.Mock).mockResolvedValue(true);

      await expect(service.deleteRule(MOCK_TENANT_ID, 'AR-1')).resolves.toBeUndefined();
      expect(mockAutomationRuleRepo.deleteRule).toHaveBeenCalledWith('AR-1');
    });

    it('should throw NOT_FOUND if rule does not exist', async () => {
      (mockAutomationRuleRepo.deleteRule as jest.Mock).mockResolvedValue(false);

      await expect(service.deleteRule(MOCK_TENANT_ID, 'non-existent')).rejects.toThrow(AutomationRuleServiceError);
    });
  });

  // ==================== executeRule ====================

  describe('executeRule', () => {
    it('should execute a rule and return execution log', async () => {
      const mockRule = {
        id: 'AR-1',
        tenantId: MOCK_TENANT_ID,
        name: 'Auto Assign',
        enabled: true,
        priority: 10,
        conditions: [{ field: 'priority', operator: 'eq', value: 'critical' }],
        actions: [{ type: 'assign', payload: { assignee: 'user-1' } }],
        executionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AutomationRule;

      const mockExecution = {
        id: 'EXEC-1',
        ruleId: 'AR-1',
        ticketId: 'ticket-1',
        triggeredBy: 'create' as const,
        conditionsMet: { priority: 'critical' },
        actionsTaken: [{ type: 'assign', payload: { assignee: 'user-1' } }],
        status: 'success' as const,
        executedAt: new Date(),
        completedAt: new Date(),
      } as AutomationRuleExecution;

      (mockAutomationRuleRepo.findRuleById as jest.Mock).mockResolvedValue(mockRule);
      (mockAutomationRuleRepo.createExecution as jest.Mock).mockResolvedValue(mockExecution);
      (mockAutomationRuleRepo.updateExecution as jest.Mock).mockResolvedValue({
        ...mockExecution,
        status: 'success',
        actionsTaken: mockExecution.actionsTaken,
        completedAt: new Date(),
      } as AutomationRuleExecution);
      (mockAutomationRuleRepo.incrementExecutionCount as jest.Mock).mockResolvedValue(undefined);

      const result = await service.executeRule(MOCK_TENANT_ID, 'AR-1', {
        ticketId: 'ticket-1',
        triggeredBy: 'create',
        ticket: { priority: 'critical', title: 'Test' },
      });

      expect(result).toBeDefined();
      expect(mockAutomationRuleRepo.createExecution).toHaveBeenCalled();
      expect(mockAutomationRuleRepo.incrementExecutionCount).toHaveBeenCalledWith('AR-1');
    });

    it('should throw NOT_FOUND if rule does not exist', async () => {
      (mockAutomationRuleRepo.findRuleById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.executeRule(MOCK_TENANT_ID, 'non-existent', {
          ticketId: 'ticket-1',
          triggeredBy: 'manual',
          ticket: {},
        })
      ).rejects.toThrow(AutomationRuleServiceError);
    });

    it('should throw RULE_DISABLED if rule is disabled', async () => {
      const mockRule = {
        id: 'AR-1',
        tenantId: MOCK_TENANT_ID,
        name: 'Auto Assign',
        enabled: false,
        priority: 10,
        conditions: [],
        actions: [],
        executionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AutomationRule;

      (mockAutomationRuleRepo.findRuleById as jest.Mock).mockResolvedValue(mockRule);

      await expect(
        service.executeRule(MOCK_TENANT_ID, 'AR-1', {
          ticketId: 'ticket-1',
          triggeredBy: 'manual',
          ticket: {},
        })
      ).rejects.toThrow(AutomationRuleServiceError);
    });
  });

  // ==================== evaluateConditions ====================

  describe('evaluateConditions', () => {
    it('should return true for empty conditions', () => {
      const result = service.evaluateConditions([], { priority: 'critical' });
      expect(result).toBe(true);
    });

    it('should evaluate eq operator', () => {
      const conditions = [{ field: 'priority', operator: 'eq' as const, value: 'critical' }];
      expect(service.evaluateConditions(conditions, { priority: 'critical' })).toBe(true);
      expect(service.evaluateConditions(conditions, { priority: 'high' })).toBe(false);
    });

    it('should evaluate neq operator', () => {
      const conditions = [{ field: 'priority', operator: 'neq' as const, value: 'critical' }];
      expect(service.evaluateConditions(conditions, { priority: 'high' })).toBe(true);
      expect(service.evaluateConditions(conditions, { priority: 'critical' })).toBe(false);
    });

    it('should evaluate gt/gte/lt/lte operators', () => {
      const conditions = [
        { field: 'priority', operator: 'gt' as const, value: 'low' },
      ];
      expect(service.evaluateConditions(conditions, { priority: 'high' })).toBe(true);
      expect(service.evaluateConditions(conditions, { priority: 'low' })).toBe(false);
    });

    it('should evaluate in operator', () => {
      const conditions = [
        { field: 'priority', operator: 'in' as const, value: ['critical', 'high'] },
      ];
      expect(service.evaluateConditions(conditions, { priority: 'critical' })).toBe(true);
      expect(service.evaluateConditions(conditions, { priority: 'medium' })).toBe(false);
    });

    it('should evaluate contains operator', () => {
      const conditions = [
        { field: 'title', operator: 'contains' as const, value: 'urgent' },
      ];
      expect(service.evaluateConditions(conditions, { title: 'Urgent: server down' })).toBe(true);
      expect(service.evaluateConditions(conditions, { title: 'Normal issue' })).toBe(false);
    });

    it('should evaluate is_null and is_not_null operators', () => {
      const nullConditions = [{ field: 'assignee', operator: 'is_null' as const, value: null }];
      expect(service.evaluateConditions(nullConditions, { assignee: null })).toBe(true);
      expect(service.evaluateConditions(nullConditions, { assignee: 'user-1' })).toBe(false);

      const notNullConditions = [{ field: 'assignee', operator: 'is_not_null' as const, value: null }];
      expect(service.evaluateConditions(notNullConditions, { assignee: 'user-1' })).toBe(true);
      expect(service.evaluateConditions(notNullConditions, { assignee: null })).toBe(false);
    });

    it('should evaluate multiple conditions with AND logic', () => {
      const conditions = [
        { field: 'priority', operator: 'eq' as const, value: 'critical' },
        { field: 'status', operator: 'eq' as const, value: 'open' },
      ];
      expect(service.evaluateConditions(conditions, { priority: 'critical', status: 'open' })).toBe(true);
      expect(service.evaluateConditions(conditions, { priority: 'critical', status: 'assigned' })).toBe(false);
    });
  });

  // ==================== getEnabledRules ====================

  describe('getEnabledRules', () => {
    it('should return enabled rules for a tenant', async () => {
      const mockRules = [
        {
          id: 'AR-1',
          tenantId: MOCK_TENANT_ID,
          name: 'Rule 1',
          enabled: true,
          priority: 10,
          conditions: [],
          actions: [],
          executionCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as AutomationRule,
      ];

      (mockAutomationRuleRepo.getEnabledRules as jest.Mock).mockResolvedValue(mockRules);

      const result = await service.getEnabledRules(MOCK_TENANT_ID);
      expect(result).toEqual(mockRules);
    });
  });

  // ==================== getRuleExecutions ====================

  describe('getRuleExecutions', () => {
    it('should return execution history for a rule', async () => {
      const mockExecutions = [
        {
          id: 'EXEC-1',
          ruleId: 'AR-1',
          ticketId: 'ticket-1',
          triggeredBy: 'create',
          conditionsMet: {},
          actionsTaken: [],
          status: 'success',
          executedAt: new Date(),
        } as AutomationRuleExecution,
      ];

      (mockAutomationRuleRepo.getExecutionsByRule as jest.Mock).mockResolvedValue(mockExecutions);

      const result = await service.getRuleExecutions(MOCK_TENANT_ID, 'AR-1', 50);
      expect(result).toEqual(mockExecutions);
      expect(mockAutomationRuleRepo.getExecutionsByRule).toHaveBeenCalledWith('AR-1', MOCK_TENANT_ID, 50);
    });
  });

  // ==================== getTicketExecutions ====================

  describe('getTicketExecutions', () => {
    it('should return execution history for a ticket', async () => {
      const mockExecutions = [
        {
          id: 'EXEC-1',
          ruleId: 'AR-1',
          ticketId: 'ticket-1',
          triggeredBy: 'create',
          conditionsMet: {},
          actionsTaken: [],
          status: 'success',
          executedAt: new Date(),
        } as AutomationRuleExecution,
      ];

      (mockAutomationRuleRepo.getExecutionsByTicket as jest.Mock).mockResolvedValue(mockExecutions);

      const result = await service.getTicketExecutions(MOCK_TENANT_ID, 'ticket-1');
      expect(result).toEqual(mockExecutions);
    });
  });
});
