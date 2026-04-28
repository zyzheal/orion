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

  beforeEach(() => {
    configService = new ConfigService();
    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue('event-id'),
    };
    approvalService = new ConfigApprovalService({
      configService,
      eventPublisher: mockEventPublisher,
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
      const configService2 = new ConfigService();
      const approvalService2 = new ConfigApprovalService({
        configService: configService2,
        autoApply: false,
      });

      const config = await configService2.createConfig({
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
      const currentConfig = await configService2.getConfig(config.id);
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
