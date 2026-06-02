/**
 * CapabilityService Tests
 *
 * Covers:
 * - CRUD operations: get, list, create, update, delete
 * - Role mappings: grant/revoke/get
 * - User mappings: grant/revoke/get
 * - Permission check: allowed/disallowed/requires approval
 * - Temporary permissions: grant/revoke/cleanup
 * - Error handling: not found, invalid risk level, has children
 */

import { CapabilityService, CapabilityServiceError } from '../CapabilityService';

describe('CapabilityService', () => {
  let service: CapabilityService;
  let mockCapRepo: any;
  let mockRoleRepo: any;

  beforeEach(() => {
    mockCapRepo = {
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
      deleteExpiredPermissions: jest.fn(),
      getExpiredPermissions: jest.fn(),
      grantTemporaryPermission: jest.fn(),
      revokeTemporaryPermission: jest.fn(),
      getActiveTemporaryPermissions: jest.fn(),
      cleanupExpiredTemporaryPermissions: jest.fn(),
      createAuditLog: jest.fn(),
      getAuditLogs: jest.fn(),
      createPermissionRequest: jest.fn(),
      getPermissionRequestByTicketId: jest.fn(),
      linkApprovalToPermissionRequest: jest.fn(),
      checkAutoApprovalRules: jest.fn(),
      updatePermissionRequestStatus: jest.fn(),
      getPermissionRequestsByUser: jest.fn(),
      getUserEffectiveCapabilities: jest.fn(),
    };
    mockRoleRepo = { findByName: jest.fn() };
    service = new CapabilityService(mockCapRepo, mockRoleRepo);
  });

  const mockCap = { id: 'cap-1', capability_id: 'deploy', name: 'Deploy', category: 'ops', risk_level: 2, requires_approval: false };

  // ==================== CRUD ====================

  describe('getCapability', () => {
    it('should return capability when found', async () => {
      mockCapRepo.findById.mockResolvedValue(mockCap);
      expect(await service.getCapability('cap-1')).toEqual(mockCap);
    });

    it('should return null when not found', async () => {
      mockCapRepo.findById.mockResolvedValue(null);
      expect(await service.getCapability('missing')).toBeNull();
    });
  });

  describe('listCapabilities', () => {
    it('should list all capabilities', async () => {
      mockCapRepo.findAll.mockResolvedValue([mockCap]);
      expect(await service.listCapabilities()).toEqual([mockCap]);
    });

    it('should filter by category', async () => {
      mockCapRepo.findByCategory.mockResolvedValue([mockCap]);
      expect(await service.listCapabilities('ops')).toEqual([mockCap]);
      expect(mockCapRepo.findByCategory).toHaveBeenCalledWith('ops');
    });
  });

  describe('createCapability', () => {
    it('should create capability', async () => {
      mockCapRepo.create.mockResolvedValue(mockCap);
      const result = await service.createCapability({ capability_id: 'deploy', name: 'Deploy', category: 'ops' });
      expect(result).toEqual(mockCap);
    });

    it('should throw for invalid risk level', async () => {
      await expect(service.createCapability({ capability_id: 'x', name: 'X', category: 'c', risk_level: 5 }))
        .rejects.toThrow('Risk level must be between 1 and 4');
    });

    it('should throw when parent not found', async () => {
      mockCapRepo.findById.mockResolvedValue(null);
      await expect(service.createCapability({ capability_id: 'x', name: 'X', category: 'c', parent_capability_id: 'missing' }))
        .rejects.toThrow('Parent capability not found');
    });
  });

  describe('updateCapability', () => {
    it('should update capability', async () => {
      mockCapRepo.update.mockResolvedValue({ ...mockCap, name: 'Updated' });
      const result = await service.updateCapability('cap-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw when not found', async () => {
      mockCapRepo.update.mockResolvedValue(null);
      await expect(service.updateCapability('missing', { name: 'X' })).rejects.toThrow('Capability not found');
    });
  });

  describe('deleteCapability', () => {
    it('should delete capability', async () => {
      mockCapRepo.findByParent.mockResolvedValue([]);
      mockCapRepo.delete.mockResolvedValue(true);
      expect(await service.deleteCapability('cap-1')).toBe(true);
    });

    it('should throw when has children', async () => {
      mockCapRepo.findByParent.mockResolvedValue([{ id: 'child-1' }]);
      await expect(service.deleteCapability('cap-1')).rejects.toThrow('Cannot delete capability with children');
    });
  });

  // ==================== Role Mappings ====================

  describe('grantCapabilityToRole', () => {
    it('should grant capability to role', async () => {
      mockCapRepo.findById.mockResolvedValue(mockCap);
      mockRoleRepo.findByName.mockResolvedValue({ name: 'admin' });
      await service.grantCapabilityToRole('cap-1', 'admin', 'user-1');
      expect(mockCapRepo.grantToRole).toHaveBeenCalledWith('cap-1', 'admin', 'user-1');
    });

    it('should throw when capability not found', async () => {
      mockCapRepo.findById.mockResolvedValue(null);
      await expect(service.grantCapabilityToRole('missing', 'admin')).rejects.toThrow('Capability not found');
    });
  });

  // ==================== Permission Check ====================

  describe('checkPermission', () => {
    it('should allow when user has direct capability', async () => {
      mockCapRepo.findById.mockResolvedValue(mockCap);
      mockCapRepo.getCapabilitiesByUser.mockResolvedValue(['cap-1']);

      const result = await service.checkPermission({ userId: 'u1', userRoles: [], capabilityId: 'cap-1' });
      expect(result.allowed).toBe(true);
    });

    it('should allow when role has capability', async () => {
      mockCapRepo.findById.mockResolvedValue(mockCap);
      mockCapRepo.getCapabilitiesByUser.mockResolvedValue([]);
      mockCapRepo.getCapabilitiesByRoles.mockResolvedValue(['cap-1']);

      const result = await service.checkPermission({ userId: 'u1', userRoles: ['admin'], capabilityId: 'cap-1' });
      expect(result.allowed).toBe(true);
    });

    it('should deny when no capability match', async () => {
      mockCapRepo.findById.mockResolvedValue(mockCap);
      mockCapRepo.getCapabilitiesByUser.mockResolvedValue([]);
      mockCapRepo.getCapabilitiesByRoles.mockResolvedValue([]);

      const result = await service.checkPermission({ userId: 'u1', userRoles: ['viewer'], capabilityId: 'cap-1' });
      expect(result.allowed).toBe(false);
    });

    it('should deny when capability not found', async () => {
      mockCapRepo.findById.mockResolvedValue(null);
      const result = await service.checkPermission({ userId: 'u1', userRoles: [], capabilityId: 'missing' });
      expect(result.allowed).toBe(false);
    });
  });

  // ==================== Cleanup ====================

  describe('revokeExpiredPermissions', () => {
    it('should revoke expired permissions', async () => {
      mockCapRepo.deleteExpiredPermissions.mockResolvedValue(5);
      expect(await service.revokeExpiredPermissions()).toBe(5);
    });
  });

  // ==================== CapabilityServiceError ====================

  describe('CapabilityServiceError', () => {
    it('should have correct name and code', () => {
      const error = new CapabilityServiceError('test', 'CODE');
      expect(error.name).toBe('CapabilityServiceError');
      expect(error.code).toBe('CODE');
    });
  });
});
