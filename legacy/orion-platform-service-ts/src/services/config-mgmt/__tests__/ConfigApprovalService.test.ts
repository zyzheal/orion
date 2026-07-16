/**
 * ConfigApprovalService Unit Tests
 *
 * Tests for approval workflows, multi-level approval, auto-apply, and audit trail.
 */

import { ConfigApprovalService } from '../ConfigApprovalService';
import { ConfigService } from '../ConfigService';
import { IEventPublisher, CreateChangeRequestInput, ApproveChangeInput } from '../../types';

describe('ConfigApprovalService', () => {
  let configService: ConfigService;
  let approvalService: ConfigApprovalService;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  // In-memory stores for mock repositories
  let approvalStore: Map<string, any>;
  let configStore: Map<string, any>;
  let configIdCounter: number;

  // Mock ConfigApprovalRepository
  let mockApprovalRepo: any;

  // Mock ConfigRepository (for ConfigService)
  let mockConfigRepo: any;

  beforeEach(() => {
    approvalStore = new Map<string, any>();
    configStore = new Map<string, any>();
    configIdCounter = 0;
    jest.clearAllMocks();

    mockApprovalRepo = {
      create: jest.fn(async (data: any) => {
        const entity = {
          ...data,
          approvals: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        approvalStore.set(data.id, entity);
        return entity;
      }),
      findById: jest.fn(async (id: string) => {
        const e = approvalStore.get(id);
        return e ? { ...e } : null;
      }),
      findMany: jest.fn(async (options?: { status?: string; configId?: string; requester?: string; environment?: string }) => {
        let results = Array.from(approvalStore.values());
        if (options?.status) results = results.filter((e: any) => e.status === options.status);
        if (options?.configId) results = results.filter((e: any) => e.configId === options.configId);
        if (options?.requester) results = results.filter((e: any) => e.requester === options.requester);
        if (options?.environment) results = results.filter((e: any) => e.environment === options.environment);
        return results.map((e: any) => ({ ...e }));
      }),
      findByConfig: jest.fn(async (configId: string) => {
        return Array.from(approvalStore.values())
          .filter((e: any) => e.configId === configId)
          .map((e: any) => ({ ...e }));
      }),
      update: jest.fn(async (id: string, data: any) => {
        const existing = approvalStore.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...data, updatedAt: new Date() };
        approvalStore.set(id, updated);
        return updated;
      }),
      delete: jest.fn(async (id: string) => {
        return approvalStore.delete(id);
      }),
    };

    mockConfigRepo = {
      set: jest.fn(async (tenantId: string, key: string, value: any, changedBy?: string) => {
        // Find existing entry with matching tenantId and key
        for (const [, entry] of configStore) {
          if (entry.tenant_id === tenantId && entry.key === key) {
            entry.value = value;
            entry.version = (entry.version || 1) + 1;
            entry.updatedBy = changedBy;
            entry.updated_by = changedBy;
            entry.updatedAt = new Date();
            entry.updated_at = new Date();
            configStore.set(entry.id, entry);
            return { ...entry };
          }
        }
        const id = `config-${++configIdCounter}`;
        const entry = {
          id,
          tenant_id: tenantId,
          key,
          value,
          version: 1,
          environment: value.environment || 'dev',
          status: 'active',
          description: value.description,
          encrypted: value.encrypted || false,
          tags: value.tags || [],
          createdBy: changedBy,
          created_by: changedBy,
          createdAt: new Date(),
          created_at: new Date(),
          updatedBy: changedBy,
          updated_by: changedBy,
          updatedAt: new Date(),
          updated_at: new Date(),
        };
        configStore.set(id, entry);
        return { ...entry };
      }),
      findById: jest.fn(async (id: string) => configStore.get(id) ? { ...configStore.get(id) } : null),
      findByKey: jest.fn(async (tenantId: string, key: string) => {
        for (const [, e] of configStore) {
          if (e.tenant_id === tenantId && e.key === key) return { ...e };
        }
        return null;
      }),
      findAll: jest.fn(async (tenantId: string) =>
        Array.from(configStore.values()).filter((e: any) => e.tenant_id === tenantId)
      ),
      delete: jest.fn(async (tenantId: string, key: string) => {
        for (const [id, e] of configStore) {
          if (e.tenant_id === tenantId && e.key === key) {
            configStore.delete(id);
            return true;
          }
        }
        return false;
      }),
      getHistory: jest.fn(async () => []),
      getHistoryByConfigId: jest.fn(async () => []),
      updateByKey: jest.fn(async () => null),
    };

    configService = new ConfigService(mockConfigRepo as any);

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue('event-id'),
    };

    approvalService = new ConfigApprovalService({
      configService,
      repository: mockApprovalRepo as any,
      eventPublisher: mockEventPublisher,
    });
  });

  describe('constructor', () => {
    it('should throw error if repository is not provided', () => {
      expect(() => new ConfigApprovalService({ configService } as any)).toThrow(
        'ConfigApprovalRepository is required'
      );
    });
  });

  describe('createChangeRequest', () => {
    it('should create a new change request', async () => {
      const config = await configService.createConfig({
        key: 'database.url',
        value: 'postgres://old:5432/db',
        environment: 'dev',
        createdBy: 'admin',
      });

      const input: CreateChangeRequestInput = {
        configId: config.id,
        newValue: 'postgres://new:5432/db',
        reason: 'Database migration',
        requester: 'developer',
      };

      const result = await approvalService.createChangeRequest(input);

      expect(result.id).toBeDefined();
      expect(result.configId).toBe(config.id);
      expect(result.configKey).toBe('database.url');
      expect(result.oldValue).toBe('postgres://old:5432/db');
      expect(result.newValue).toBe('postgres://new:5432/db');
      expect(result.reason).toBe('Database migration');
      expect(result.requester).toBe('developer');
      expect(result.status).toBe('pending');
      expect(result.requiredApprovals).toBe(1); // Default
      expect(result.approvals).toEqual([]);
    });

    it('should throw error for non-existent config', async () => {
      await expect(
        approvalService.createChangeRequest({
          configId: 'non-existent-id',
          newValue: 'new-value',
          reason: 'test',
          requester: 'admin',
        })
      ).rejects.toThrow("Config 'non-existent-id' not found");
    });

    it('should support custom required approvals', async () => {
      const config = await configService.createConfig({
        key: 'database.url',
        value: 'value',
        environment: 'prod',
        createdBy: 'admin',
      });

      const result = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
        requiredApprovals: 3,
      });

      expect(result.requiredApprovals).toBe(3);
    });
  });

  describe('approveChange', () => {
    it('should approve a change request', async () => {
      const config = await configService.createConfig({
        key: 'database.url',
        value: 'old-value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
      });

      const result = await approvalService.approveChange(changeRequest.id, {
        approver: 'manager',
        comment: 'Looks good',
      });

      expect(result.status).toBe('applied'); // auto-apply changes status to 'applied'
      expect(result.approvals.length).toBe(1);
      expect(result.approvals[0].approver).toBe('manager');
      expect(result.approvals[0].status).toBe('approved');
      expect(result.approvals[0].comment).toBe('Looks good');
    });

    it('should auto-apply the config change when fully approved', async () => {
      const config = await configService.createConfig({
        key: 'database.url',
        value: 'old-value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
      });

      await approvalService.approveChange(changeRequest.id, {
        approver: 'manager',
      });

      // Verify the config was updated
      const updatedConfig = await configService.getConfig(config.id);
      expect(updatedConfig?.value).toBe('new-value');
    });

    it('should not auto-apply if not enough approvals', async () => {
      const config = await configService.createConfig({
        key: 'database.url',
        value: 'old-value',
        environment: 'prod',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
        requiredApprovals: 2,
      });

      // First approval
      await approvalService.approveChange(changeRequest.id, {
        approver: 'manager1',
      });

      // Verify the config was NOT updated
      const currentConfig = await configService.getConfig(config.id);
      expect(currentConfig?.value).toBe('old-value');

      // Change request should still be pending
      const result = await approvalService.getChangeRequest(changeRequest.id);
      expect(result?.status).toBe('pending');
      expect(result?.approvals.length).toBe(1);
    });

    it('should auto-apply after all required approvals are met', async () => {
      const config = await configService.createConfig({
        key: 'database.url',
        value: 'old-value',
        environment: 'prod',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
        requiredApprovals: 2,
      });

      // First approval
      await approvalService.approveChange(changeRequest.id, {
        approver: 'manager1',
      });

      // Second approval - should trigger auto-apply
      await approvalService.approveChange(changeRequest.id, {
        approver: 'manager2',
      });

      const updatedConfig = await configService.getConfig(config.id);
      expect(updatedConfig?.value).toBe('new-value');
    });

    it('should throw error if approver already voted', async () => {
      // Use 2 required approvals so status stays 'pending' after first approval
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
        requiredApprovals: 2,
      });

      await approvalService.approveChange(changeRequest.id, {
        approver: 'manager',
      });

      await expect(
        approvalService.approveChange(changeRequest.id, {
          approver: 'manager',
        })
      ).rejects.toThrow("Approver 'manager' has already voted");
    });

    it('should throw error for non-existent change request', async () => {
      await expect(
        approvalService.approveChange('non-existent-id', {
          approver: 'manager',
        })
      ).rejects.toThrow("Change request 'non-existent-id' not found");
    });

    it('should throw error if change request is not pending', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
      });

      // Reject first
      await approvalService.rejectChange(changeRequest.id, {
        approver: 'manager',
      });

      // Try to approve
      await expect(
        approvalService.approveChange(changeRequest.id, {
          approver: 'manager2',
        })
      ).rejects.toThrow('is not in pending state');
    });

    it('should publish config.approved event', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
      });

      await approvalService.approveChange(changeRequest.id, {
        approver: 'manager',
      });

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'config.approved',
        expect.objectContaining({
          changeRequestId: changeRequest.id,
          approvedBy: 'manager',
        }),
        expect.any(Object)
      );
    });
  });

  describe('rejectChange', () => {
    it('should reject a change request', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
      });

      const result = await approvalService.rejectChange(changeRequest.id, {
        approver: 'manager',
        comment: 'Not approved',
      });

      expect(result.status).toBe('rejected');
      expect(result.approvals.length).toBe(1);
      expect(result.approvals[0].status).toBe('rejected');
      expect(result.approvals[0].comment).toBe('Not approved');
    });

    it('should not apply the config change', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'original',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'changed',
        reason: 'test',
        requester: 'developer',
      });

      await approvalService.rejectChange(changeRequest.id, {
        approver: 'manager',
      });

      const currentConfig = await configService.getConfig(config.id);
      expect(currentConfig?.value).toBe('original');
    });

    it('should throw error if approver already voted', async () => {
      // Use 2 required approvals so status stays 'pending' after first approval
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
        requiredApprovals: 2,
      });

      await approvalService.approveChange(changeRequest.id, {
        approver: 'manager',
      });

      await expect(
        approvalService.rejectChange(changeRequest.id, {
          approver: 'manager',
        })
      ).rejects.toThrow("Approver 'manager' has already voted");
    });

    it('should publish config.rejected event', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
      });

      await approvalService.rejectChange(changeRequest.id, {
        approver: 'manager',
        comment: 'Rejected',
      });

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'config.rejected',
        expect.objectContaining({
          changeRequestId: changeRequest.id,
          rejectedBy: 'manager',
        }),
        expect.any(Object)
      );
    });
  });

  describe('getChangeRequest', () => {
    it('should return change request by ID', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
      });

      const result = await approvalService.getChangeRequest(changeRequest.id);
      expect(result?.id).toBe(changeRequest.id);
    });

    it('should return null for non-existent change request', async () => {
      const result = await approvalService.getChangeRequest('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('listChangeRequests', () => {
    it('should list all change requests', async () => {
      const config1 = await configService.createConfig({
        key: 'key1',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });
      const config2 = await configService.createConfig({
        key: 'key2',
        value: 'v2',
        environment: 'prod',
        createdBy: 'admin',
      });

      await approvalService.createChangeRequest({
        configId: config1.id,
        newValue: 'new-v1',
        reason: 'test',
        requester: 'dev1',
      });
      await approvalService.createChangeRequest({
        configId: config2.id,
        newValue: 'new-v2',
        reason: 'test',
        requester: 'dev2',
      });

      const results = await approvalService.listChangeRequests();
      expect(results.length).toBe(2);
    });

    it('should filter by status', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const cr1 = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-v1',
        reason: 'test',
        requester: 'dev1',
      });
      await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-v2',
        reason: 'test',
        requester: 'dev2',
      });

      await approvalService.approveChange(cr1.id, { approver: 'manager' });

      const pending = await approvalService.listChangeRequests({
        status: 'pending',
      });
      expect(pending.length).toBe(1);

      const approved = await approvalService.listChangeRequests({
        status: 'applied',
      });
      expect(approved.length).toBe(1);
    });

    it('should filter by requester', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'v1',
        reason: 'test',
        requester: 'alice',
      });
      await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'v2',
        reason: 'test',
        requester: 'bob',
      });

      const aliceRequests = await approvalService.listChangeRequests({
        requester: 'alice',
      });
      expect(aliceRequests.length).toBe(1);
    });

    it('should filter by environment', async () => {
      const devConfig = await configService.createConfig({
        key: 'test.dev.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });
      await new Promise(r => setTimeout(r, 10)); // Ensure unique timestamps for IDs
      const prodConfig = await configService.createConfig({
        key: 'test.prod.key',
        value: 'value',
        environment: 'prod',
        createdBy: 'admin',
      });

      await approvalService.createChangeRequest({
        configId: devConfig.id,
        newValue: 'dev-new',
        reason: 'test',
        requester: 'dev',
      });
      await approvalService.createChangeRequest({
        configId: prodConfig.id,
        newValue: 'prod-new',
        reason: 'test',
        requester: 'dev',
      });

      const prodRequests = await approvalService.listChangeRequests({
        environment: 'prod',
      });
      expect(prodRequests.length).toBe(1);
    });
  });

  describe('listPendingApprovals', () => {
    it('should return only pending change requests', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const cr1 = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'v1',
        reason: 'test',
        requester: 'dev',
      });
      await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'v2',
        reason: 'test',
        requester: 'dev',
      });

      await approvalService.approveChange(cr1.id, { approver: 'manager' });

      const pending = await approvalService.listPendingApprovals();
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe('pending');
    });
  });

  describe('cancelChangeRequest', () => {
    it('should cancel a pending change request', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
      });

      const result = await approvalService.cancelChangeRequest(changeRequest.id);

      expect(result.status).toBe('rejected');
    });

    it('should throw error if not pending', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new-value',
        reason: 'test',
        requester: 'developer',
      });

      await approvalService.approveChange(changeRequest.id, {
        approver: 'manager',
      });

      await expect(
        approvalService.cancelChangeRequest(changeRequest.id)
      ).rejects.toThrow('Only pending change requests can be cancelled');
    });
  });

  describe('getAuditTrail', () => {
    it('should return all change requests for a config', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'v1',
        reason: 'change 1',
        requester: 'dev',
      });
      await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'v2',
        reason: 'change 2',
        requester: 'dev',
      });

      const auditTrail = await approvalService.getAuditTrail(config.id);
      expect(auditTrail.length).toBe(2);
    });

    it('should return empty for config with no change requests', async () => {
      const config = await configService.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const auditTrail = await approvalService.getAuditTrail(config.id);
      expect(auditTrail).toEqual([]);
    });
  });

  describe('auto-apply toggle', () => {
    it('should not auto-apply when disabled', async () => {
      const approvalService2 = new ConfigApprovalService({
        configService,
        repository: mockApprovalRepo as any,
        autoApply: false,
      });

      const config = await configService.createConfig({
        key: 'test.key',
        value: 'old',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService2.createChangeRequest({
        configId: config.id,
        newValue: 'new',
        reason: 'test',
        requester: 'dev',
      });

      await approvalService2.approveChange(changeRequest.id, {
        approver: 'manager',
      });

      // Config should not be updated
      const currentConfig = await configService.getConfig(config.id);
      expect(currentConfig?.value).toBe('old');
    });

    it('should allow toggling auto-apply', async () => {
      approvalService.setAutoApply(false);

      const config = await configService.createConfig({
        key: 'test.key',
        value: 'old',
        environment: 'dev',
        createdBy: 'admin',
      });

      const changeRequest = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'new',
        reason: 'test',
        requester: 'dev',
      });

      await approvalService.approveChange(changeRequest.id, {
        approver: 'manager',
      });

      let currentConfig = await configService.getConfig(config.id);
      expect(currentConfig?.value).toBe('old');

      // Enable auto-apply and approve another change
      approvalService.setAutoApply(true);

      const changeRequest2 = await approvalService.createChangeRequest({
        configId: config.id,
        newValue: 'newer',
        reason: 'test',
        requester: 'dev',
      });

      await approvalService.approveChange(changeRequest2.id, {
        approver: 'manager',
      });

      currentConfig = await configService.getConfig(config.id);
      expect(currentConfig?.value).toBe('newer');
    });
  });
});
