/**
 * CapabilityRepository - Capability Database Layer Unit Tests
 *
 * Coverage: findById, findAll, findByCategory, findByParent, create, update,
 *           delete, grantToRole, revokeFromRole, getCapabilitiesByRole,
 *           getCapabilitiesByRoles, grantToUser, revokeFromUser,
 *           getCapabilitiesByUser, getExpiredPermissions, deleteExpiredPermissions,
 *           mapCommandToCapability, getCapabilityForCommand, getCommandsByCapability,
 *           grantTemporaryPermission, revokeTemporaryPermission,
 *           revokeTemporaryPermissionsByUser, getActiveTemporaryPermissions,
 *           getExpiredTemporaryPermissions, cleanupExpiredTemporaryPermissions,
 *           createAuditLog, getAuditLogs, createPermissionRequest,
 *           getPermissionRequestByTicketId, linkApprovalToPermissionRequest,
 *           getUserEffectiveCapabilities, checkAutoApprovalRules,
 *           updatePermissionRequestStatus, getPermissionRequestsByUser
 */

import { CapabilityRepository } from '../CapabilityRepository';

describe('CapabilityRepository', () => {
  let repo: CapabilityRepository;
  let mockPool: { query: jest.Mock };

  const sampleCapability = {
    id: 1,
    capability_id: 'cap-deploy',
    name: 'Deploy to Production',
    description: 'Deploy services to production environment',
    category: 'deployment',
    parent_capability_id: null,
    risk_level: 3,
    requires_approval: true,
    approval_role: 'admin',
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: 'admin',
  };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new CapabilityRepository(mockPool as any);
  });

  // ==================== CRUD ====================

  describe('findById', () => {
    it('should return capability by id', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleCapability] });
      const result = await repo.findById('cap-deploy');
      expect(result).toBeDefined();
      expect(result!.capability_id).toBe('cap-deploy');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findById('non-existent')).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all capabilities', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleCapability, { ...sampleCapability, capability_id: 'cap-test' }] });
      const result = await repo.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('findByCategory', () => {
    it('should filter by category', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleCapability] });
      const result = await repo.findByCategory('deployment');
      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('category = $1'),
        ['deployment']
      );
    });
  });

  describe('findByParent', () => {
    it('should find by parent id', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ ...sampleCapability, parent_capability_id: 'parent-1' }] });
      const result = await repo.findByParent('parent-1');
      expect(result).toHaveLength(1);
    });

    it('should find root capabilities when parent is null', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleCapability] });
      const result = await repo.findByParent(null);
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should create capability', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleCapability] });
      const result = await repo.create({
        capability_id: 'cap-deploy',
        name: 'Deploy to Production',
        category: 'deployment',
      });
      expect(result.capability_id).toBe('cap-deploy');
    });

    it('should use defaults for optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleCapability] });
      await repo.create({ capability_id: 'cap-1', name: 'Cap', category: 'test' });
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(1); // default risk_level
      expect(params).toContain(false); // default requires_approval
    });
  });

  describe('update', () => {
    it('should update capability fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ ...sampleCapability, name: 'Updated' }] });
      const result = await repo.update('cap-deploy', { name: 'Updated' });
      expect(result!.name).toBe('Updated');
    });

    it('should return existing when no updates', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleCapability] });
      const result = await repo.update('cap-deploy', {});
      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.update('non-existent', { name: 'New' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete capability', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.delete('cap-deploy')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.delete('non-existent')).toBe(false);
    });
  });

  // ==================== Role Mappings ====================

  describe('grantToRole', () => {
    it('should grant capability to role', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, capability_id: 'cap-deploy', role_name: 'developer' }] });
      const result = await repo.grantToRole('cap-deploy', 'developer');
      expect(result.role_name).toBe('developer');
    });

    it('should grant with grantedBy', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, granted_by: 'admin' }] });
      const result = await repo.grantToRole('cap-deploy', 'developer', 'admin');
      expect(result.granted_by).toBe('admin');
    });
  });

  describe('revokeFromRole', () => {
    it('should revoke capability from role', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.revokeFromRole('cap-deploy', 'developer')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.revokeFromRole('cap-deploy', 'non-existent')).toBe(false);
    });
  });

  describe('getCapabilitiesByRole', () => {
    it('should return capability IDs for role', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ capability_id: 'cap-1' }, { capability_id: 'cap-2' }] });
      const result = await repo.getCapabilitiesByRole('developer');
      expect(result).toEqual(['cap-1', 'cap-2']);
    });
  });

  describe('getCapabilitiesByRoles', () => {
    it('should return distinct capability IDs for multiple roles', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ capability_id: 'cap-1' }, { capability_id: 'cap-2' }] });
      const result = await repo.getCapabilitiesByRoles(['developer', 'admin']);
      expect(result).toEqual(['cap-1', 'cap-2']);
    });

    it('should return empty for empty roles', async () => {
      const result = await repo.getCapabilitiesByRoles([]);
      expect(result).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  // ==================== User Mappings ====================

  describe('grantToUser', () => {
    it('should grant capability to user', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, capability_id: 'cap-deploy', user_id: 'user-1' }] });
      const result = await repo.grantToUser('cap-deploy', 'user-1');
      expect(result.user_id).toBe('user-1');
    });

    it('should grant with expiration and extra fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });
      const expiresAt = new Date('2026-12-31');
      await repo.grantToUser('cap-deploy', 'user-1', 'admin', expiresAt, {
        approval_id: 42,
        ticket_id: 100,
        reason: 'Temporary access',
      });
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(expiresAt);
      expect(params).toContain(42);
    });
  });

  describe('revokeFromUser', () => {
    it('should revoke capability from user', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.revokeFromUser('cap-deploy', 'user-1')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.revokeFromUser('cap-deploy', 'user-99')).toBe(false);
    });
  });

  describe('getCapabilitiesByUser', () => {
    it('should return capability IDs for user', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ capability_id: 'cap-1' }] });
      const result = await repo.getCapabilitiesByUser('user-1');
      expect(result).toEqual(['cap-1']);
    });
  });

  describe('getExpiredPermissions', () => {
    it('should return expired permissions', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, user_id: 'user-1' }] });
      const result = await repo.getExpiredPermissions();
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteExpiredPermissions', () => {
    it('should delete expired permissions and return count', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 3 });
      expect(await repo.deleteExpiredPermissions()).toBe(3);
    });
  });

  // ==================== ChatOps Command Mapping ====================

  describe('mapCommandToCapability', () => {
    it('should map command to capability', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'm-1', command_name: 'deploy', command_action: 'start', capability_id: 'cap-deploy' }] });
      const result = await repo.mapCommandToCapability('deploy', 'start', 'cap-deploy');
      expect(result.command_name).toBe('deploy');
    });

    it('should map with environment suffix', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'm-1' }] });
      await repo.mapCommandToCapability('deploy', 'start', 'cap-deploy', 'prod');
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('prod');
    });
  });

  describe('getCapabilityForCommand', () => {
    it('should return capability for command with environment', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ capability_id: 'cap-deploy' }] });
      const result = await repo.getCapabilityForCommand('deploy', 'start', 'production');
      expect(result).toBe('cap-deploy');
    });

    it('should fall back to default mapping when env-specific not found', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // env-specific lookup returns empty
        .mockResolvedValueOnce({ rows: [{ capability_id: 'cap-default' }] }); // default lookup
      const result = await repo.getCapabilityForCommand('deploy', 'start', 'staging');
      expect(result).toBe('cap-default');
    });

    it('should return null when no mapping found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.getCapabilityForCommand('unknown', 'action')).toBeNull();
    });
  });

  describe('getCommandsByCapability', () => {
    it('should return commands for capability', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'm-1', command_name: 'deploy' }] });
      const result = await repo.getCommandsByCapability('cap-deploy');
      expect(result).toHaveLength(1);
    });
  });

  // ==================== Temporary Permissions ====================

  describe('grantTemporaryPermission', () => {
    it('should grant temporary permission', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, user_id: 'user-1' }] });
      const result = await repo.grantTemporaryPermission({
        tenant_id: 't-1',
        user_id: 'user-1',
        capability_id: 'cap-deploy',
        granted_by: 'admin',
        expires_at: new Date('2026-12-31'),
      });
      expect(result.user_id).toBe('user-1');
    });
  });

  describe('revokeTemporaryPermission', () => {
    it('should revoke temporary permission', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, revoked_at: '2026-06-01' }] });
      const result = await repo.revokeTemporaryPermission(1, 'admin', 'Expired');
      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.revokeTemporaryPermission(999, 'admin')).toBeNull();
    });
  });

  describe('revokeTemporaryPermissionsByUser', () => {
    it('should revoke all temporary permissions for user', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 2 });
      expect(await repo.revokeTemporaryPermissionsByUser('user-1', 'admin')).toBe(2);
    });
  });

  describe('getActiveTemporaryPermissions', () => {
    it('should return active temporary permissions', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, user_id: 'user-1' }] });
      const result = await repo.getActiveTemporaryPermissions('user-1');
      expect(result).toHaveLength(1);
    });

    it('should filter by tenantId', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      await repo.getActiveTemporaryPermissions('user-1', 't-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id'),
        expect.arrayContaining(['user-1', 't-1'])
      );
    });
  });

  describe('getExpiredTemporaryPermissions', () => {
    it('should return expired temporary permissions', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });
      expect(await repo.getExpiredTemporaryPermissions()).toHaveLength(1);
    });
  });

  describe('cleanupExpiredTemporaryPermissions', () => {
    it('should cleanup and return revoked permissions', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
      const result = await repo.cleanupExpiredTemporaryPermissions();
      expect(result).toHaveLength(2);
    });
  });

  // ==================== Audit Log ====================

  describe('createAuditLog', () => {
    it('should create audit log entry', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, action: 'granted' }] });
      const result = await repo.createAuditLog({
        tenant_id: 't-1',
        user_id: 'user-1',
        action: 'granted',
        capability_id: 'cap-deploy',
      });
      expect(result.action).toBe('granted');
    });
  });

  describe('getAuditLogs', () => {
    it('should return audit logs with pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const result = await repo.getAuditLogs({ limit: 2, offset: 0 });

      expect(result.total).toBe(10);
      expect(result.logs).toHaveLength(2);
    });

    it('should filter by user_id, capability_id, action', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await repo.getAuditLogs({ user_id: 'user-1', capability_id: 'cap-1', action: 'granted' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        expect.arrayContaining(['user-1'])
      );
    });
  });

  // ==================== Permission Requests ====================

  describe('createPermissionRequest', () => {
    it('should create permission request', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, ticket_id: 100 }] });
      const result = await repo.createPermissionRequest({
        ticket_id: 100,
        capability_id: 'cap-deploy',
        duration_hours: 24,
        requested_for_user_id: 'user-1',
      });
      expect(result.ticket_id).toBe(100);
    });
  });

  describe('getPermissionRequestByTicketId', () => {
    it('should return request by ticket id', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, ticket_id: 100 }] });
      const result = await repo.getPermissionRequestByTicketId(100);
      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.getPermissionRequestByTicketId(999)).toBeNull();
    });
  });

  describe('linkApprovalToPermissionRequest', () => {
    it('should link approval mapping', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.linkApprovalToPermissionRequest(100, 42)).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.linkApprovalToPermissionRequest(999, 42)).toBe(false);
    });
  });

  // ==================== Permission Request Status ====================

  describe('updatePermissionRequestStatus', () => {
    it('should update status', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.updatePermissionRequestStatus(100, 'approved', 'admin')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.updatePermissionRequestStatus(999, 'rejected')).toBe(false);
    });
  });

  describe('getPermissionRequestsByUser', () => {
    it('should return requests for user', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1, requested_for_user_id: 'user-1' }] });
      const result = await repo.getPermissionRequestsByUser('user-1');
      expect(result).toHaveLength(1);
    });
  });

  // ==================== User Effective Capabilities ====================

  describe('getUserEffectiveCapabilities', () => {
    it('should return direct + role capabilities', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ capability_id: 'cap-direct' }] }) // direct
        .mockResolvedValueOnce({ rows: [{ capability_id: 'cap-role' }] }) // role
        .mockResolvedValueOnce({ rows: [] }); // inherited

      const result = await repo.getUserEffectiveCapabilities('user-1', ['developer']);

      expect(result).toContain('cap-direct');
      expect(result).toContain('cap-role');
    });

    it('should return empty when no capabilities', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repo.getUserEffectiveCapabilities('user-1');
      expect(result).toEqual([]);
    });
  });

  // ==================== Auto-Approval Rules ====================

  describe('checkAutoApprovalRules', () => {
    it('should auto-approve low risk capabilities', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ risk_level: 1, parent_capability_id: null }] });

      const result = await repo.checkAutoApprovalRules('user-1', 'cap-low');

      expect(result.autoApprove).toBe(true);
      expect(result.reason).toContain('Low risk');
    });

    it('should auto-approve when user has parent capability', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ risk_level: 4, parent_capability_id: 'cap-parent' }] }) // capability lookup
        .mockResolvedValueOnce({ rows: [{ '1': 1 }] }); // parent mapping exists

      const result = await repo.checkAutoApprovalRules('user-1', 'cap-high');

      expect(result.autoApprove).toBe(true);
      expect(result.reason).toContain('parent');
    });

    it('should auto-approve when user role has capability', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ risk_level: 4, parent_capability_id: null }] })
        .mockResolvedValueOnce({ rows: [{ '1': 1 }] }); // role mapping

      const result = await repo.checkAutoApprovalRules('user-1', 'cap-high', ['admin']);

      expect(result.autoApprove).toBe(true);
      expect(result.reason).toContain('role');
    });

    it('should require manual approval when no rules match', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ risk_level: 5, parent_capability_id: null }] })
        .mockResolvedValueOnce({ rows: [] }); // no role mapping

      const result = await repo.checkAutoApprovalRules('user-1', 'cap-high', ['viewer']);

      expect(result.autoApprove).toBe(false);
      expect(result.reason).toContain('manual');
    });

    it('should return false when capability not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.checkAutoApprovalRules('user-1', 'non-existent');

      expect(result.autoApprove).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));
      await expect(repo.findById('cap-1')).rejects.toThrow('Connection refused');
    });
  });
});
