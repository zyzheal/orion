/**
 * Capability Service Tests
 */

import { CapabilityService, CapabilityServiceError } from '../../src/services/capability/CapabilityService';

// Mock CapabilityRepository
const mockCapRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  findByCategory: jest.fn(),
  findByParent: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  grantToRole: jest.fn(),
  revokeFromRole: jest.fn(),
  getCapabilitiesByRole: jest.fn(),
  getCapabilitiesByRoles: jest.fn(),
  grantToUser: jest.fn(),
  revokeFromUser: jest.fn(),
  getCapabilitiesByUser: jest.fn(),
  mapCommandToCapability: jest.fn(),
  getCapabilityForCommand: jest.fn(),
  getAuditLogs: jest.fn(),
  createAuditLog: jest.fn(),
  grantTemporaryPermission: jest.fn(),
  revokeTemporaryPermission: jest.fn(),
  getActiveTemporaryPermissions: jest.fn(),
  cleanupExpiredTemporaryPermissions: jest.fn(),
  createPermissionRequest: jest.fn(),
  getPermissionRequestByTicketId: jest.fn(),
  linkApprovalToPermissionRequest: jest.fn(),
  getUserEffectiveCapabilities: jest.fn(),
  checkAutoApprovalRules: jest.fn(),
  updatePermissionRequestStatus: jest.fn(),
  getPermissionRequestsByUser: jest.fn(),
};

describe('CapabilityService', () => {
  let service: CapabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CapabilityService(mockCapRepo as any);
  });

  describe('requestPermission', () => {
    it('should throw error when capability not found', async () => {
      (mockCapRepo.findById as jest.Mock).mockResolvedValue(null);
      (mockCapRepo.checkAutoApprovalRules as jest.Mock).mockResolvedValue({
        autoApprove: false,
        reason: 'Requires manual approval',
      });

      await expect(
        service.requestPermission({
          userId: 'user-1',
          capabilityId: 'nonexistent-cap',
          reason: 'Need access',
          durationHours: 8,
          tenantId: 'tenant-1',
        })
      ).rejects.toThrow('Capability not found');
    });

    it('should auto-approve low risk capabilities', async () => {
      const mockCapability = {
        capability_id: 'low_risk_cap',
        risk_level: 1,
        name: 'Low Risk Capability',
      };
      (mockCapRepo.findById as jest.Mock).mockResolvedValue(mockCapability);
      (mockCapRepo.checkAutoApprovalRules as jest.Mock).mockResolvedValue({
        autoApprove: true,
        reason: 'Low risk capability (auto-approved)',
      });
      (mockCapRepo.createPermissionRequest as jest.Mock).mockResolvedValue({
        ticket_id: 123,
        capability_id: 'low_risk_cap',
      });
      (mockCapRepo.grantTemporaryPermission as jest.Mock).mockResolvedValue({
        id: 456,
        user_id: 'user-1',
        capability_id: 'low_risk_cap',
      });
      (mockCapRepo.updatePermissionRequestStatus as jest.Mock).mockResolvedValue(true);

      const result = await service.requestPermission({
        userId: 'user-1',
        capabilityId: 'low_risk_cap',
        reason: 'Need access',
        durationHours: 8,
        tenantId: 'tenant-1',
      });

      expect(result.status).toBe('auto_approved');
      expect(result.tempPermissionId).toBe(456);
      expect(mockCapRepo.grantTemporaryPermission).toHaveBeenCalled();
    });

    it('should return pending for high risk capabilities', async () => {
      const mockCapability = {
        capability_id: 'high_risk_cap',
        risk_level: 4,
        name: 'High Risk Capability',
      };
      (mockCapRepo.findById as jest.Mock).mockResolvedValue(mockCapability);
      (mockCapRepo.checkAutoApprovalRules as jest.Mock).mockResolvedValue({
        autoApprove: false,
        reason: 'Requires manual approval',
      });
      (mockCapRepo.createPermissionRequest as jest.Mock).mockResolvedValue({
        ticket_id: 789,
        capability_id: 'high_risk_cap',
      });

      const result = await service.requestPermission({
        userId: 'user-1',
        capabilityId: 'high_risk_cap',
        reason: 'Need access',
        durationHours: 8,
        tenantId: 'tenant-1',
      });

      expect(result.status).toBe('pending');
      expect(result.tempPermissionId).toBeUndefined();
      expect(mockCapRepo.grantTemporaryPermission).not.toHaveBeenCalled();
    });
  });

  describe('approveRequest', () => {
    it('should throw error when request not found', async () => {
      (mockCapRepo.getPermissionRequestByTicketId as jest.Mock).mockResolvedValue(null);

      await expect(
        service.approveRequest({
          ticketId: 999,
          approverId: 'admin',
          tenantId: 'tenant-1',
        })
      ).rejects.toThrow('Permission request not found');
    });

    it('should approve and grant temporary permission', async () => {
      const mockRequest = {
        ticket_id: 123,
        capability_id: 'test_cap',
        requested_for_user_id: 'user-1',
        environment_suffix: null,
        duration_hours: 8,
      };
      (mockCapRepo.getPermissionRequestByTicketId as jest.Mock).mockResolvedValue(mockRequest);
      (mockCapRepo.getCapabilitiesByRoles as jest.Mock).mockResolvedValue(['test_cap']);
      (mockCapRepo.findById as jest.Mock).mockResolvedValue({ approval_role: null });
      (mockCapRepo.grantTemporaryPermission as jest.Mock).mockResolvedValue({
        id: 456,
        user_id: 'user-1',
        capability_id: 'test_cap',
      });
      (mockCapRepo.updatePermissionRequestStatus as jest.Mock).mockResolvedValue(true);

      const result = await service.approveRequest({
        ticketId: 123,
        approverId: 'admin',
        tenantId: 'tenant-1',
        approverRoles: ['admin'],
      });

      expect(result.success).toBe(true);
      expect(result.tempPermissionId).toBe(456);
      expect(mockCapRepo.updatePermissionRequestStatus).toHaveBeenCalledWith(
        123,
        'approved',
        'admin'
      );
    });
  });

  describe('getUserEffectiveCapabilities', () => {
    it('should return merged capabilities from user and roles', async () => {
      (mockCapRepo.getUserEffectiveCapabilities as jest.Mock).mockResolvedValue([
        'cap1',
        'cap2',
        'cap3',
      ]);

      const result = await service.getUserEffectiveCapabilities('user-1', ['role1', 'role2']);

      expect(result).toEqual(['cap1', 'cap2', 'cap3']);
      expect(mockCapRepo.getUserEffectiveCapabilities).toHaveBeenCalledWith('user-1', [
        'role1',
        'role2',
      ]);
    });
  });

  describe('rejectRequest', () => {
    it('should update request status to rejected', async () => {
      (mockCapRepo.updatePermissionRequestStatus as jest.Mock).mockResolvedValue(true);

      const result = await service.rejectRequest({
        ticketId: 123,
        rejecterId: 'admin',
        reason: 'Not justified',
      });

      expect(result).toBe(true);
      expect(mockCapRepo.updatePermissionRequestStatus).toHaveBeenCalledWith(
        123,
        'rejected',
        'admin'
      );
    });
  });

  describe('grantTemporaryPermissionSimplified', () => {
    it('should grant temporary permission with simplified params', async () => {
      const mockTempPerm = {
        id: 789,
        user_id: 'user-1',
        capability_id: 'test_cap',
        tenant_id: 'tenant-1',
        granted_by: 'admin',
      };
      (mockCapRepo.findById as jest.Mock).mockResolvedValue({ capability_id: 'test_cap' });
      (mockCapRepo.grantTemporaryPermission as jest.Mock).mockResolvedValue(mockTempPerm);

      const result = await service.grantTemporaryPermissionSimplified({
        userId: 'user-1',
        capabilityId: 'test_cap',
        durationHours: 4,
        grantorId: 'admin',
        tenantId: 'tenant-1',
        reason: 'Test grant',
      });

      expect(result).toEqual(mockTempPerm);
      expect(mockCapRepo.grantTemporaryPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          capability_id: 'test_cap',
          expires_in_hours: 4,
        })
      );
    });

    it('should throw error when capability not found', async () => {
      (mockCapRepo.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.grantTemporaryPermissionSimplified({
          userId: 'user-1',
          capabilityId: 'nonexistent',
          durationHours: 4,
          grantorId: 'admin',
          tenantId: 'tenant-1',
        })
      ).rejects.toThrow('Capability not found');
    });
  });

  describe('revokeTemporaryPermissionSimplified', () => {
    it('should revoke temporary permission', async () => {
      const mockRevoked = {
        id: 789,
        user_id: 'user-1',
        capability_id: 'test_cap',
        revoked_at: new Date().toISOString(),
      };
      (mockCapRepo.revokeTemporaryPermission as jest.Mock).mockResolvedValue(mockRevoked);

      const result = await service.revokeTemporaryPermissionSimplified(789, 'admin');

      expect(result).toEqual(mockRevoked);
      expect(mockCapRepo.revokeTemporaryPermission).toHaveBeenCalledWith(
        789,
        'admin',
        'Manual revocation'
      );
    });
  });
});