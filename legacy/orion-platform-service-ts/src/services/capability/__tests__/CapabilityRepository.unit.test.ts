/**
 * CapabilityRepository - 完整单元测试
 * 覆盖所有 CRUD、角色映射、用户映射、ChatOps 映射、临时权限、审计日志、权限申请
 */

import { CapabilityRepository, Capability, CapabilityRoleMapping, CapabilityUserMapping, TemporaryPermission, ChatOpsCommandCapability } from '../CapabilityRepository';

// Mock DatabasePool
const createMockPool = () => ({
  query: jest.fn(),
});

type MockPool = ReturnType<typeof createMockPool>;

describe('CapabilityRepository', () => {
  let repo: CapabilityRepository;
  let pool: MockPool;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = createMockPool();
    repo = new CapabilityRepository(pool as any);
  });

  // ==================== findById ====================
  describe('findById', () => {
    it('should return capability when found', async () => {
      const cap: Capability = {
        id: '1', capability_id: 'cap-1', name: 'Test', description: null,
        category: 'deploy', parent_capability_id: null, risk_level: 1,
        requires_approval: false, approval_role: null, metadata: {},
        created_at: '2026-01-01', updated_at: '2026-01-01', created_by: null,
      };
      pool.query.mockResolvedValue({ rows: [cap], rowCount: 1 });

      const result = await repo.findById('cap-1');
      expect(result).toEqual(cap);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM capabilities WHERE capability_id = $1',
        ['cap-1']
      );
    });

    it('should return null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ==================== findAll ====================
  describe('findAll', () => {
    it('should return all capabilities ordered by category', async () => {
      const caps = [
        { capability_id: 'a', category: 'build' },
        { capability_id: 'b', category: 'deploy' },
      ];
      pool.query.mockResolvedValue({ rows: caps, rowCount: 2 });

      const result = await repo.findAll();
      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM capabilities ORDER BY category, capability_id'
      );
    });

    it('should return empty array when no capabilities exist', async () => {
      pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.findAll();
      expect(result).toEqual([]);
    });
  });

  // ==================== findByCategory ====================
  describe('findByCategory', () => {
    it('should return capabilities filtered by category', async () => {
      const caps = [{ capability_id: 'cap-1', category: 'deploy' }];
      pool.query.mockResolvedValue({ rows: caps, rowCount: 1 });

      const result = await repo.findByCategory('deploy');
      expect(result).toEqual(caps);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM capabilities WHERE category = $1 ORDER BY capability_id',
        ['deploy']
      );
    });

    it('should return empty array for non-existent category', async () => {
      pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.findByCategory('nonexistent');
      expect(result).toEqual([]);
    });
  });

  // ==================== findByParent ====================
  describe('findByParent', () => {
    it('should return children of a specific parent', async () => {
      const children = [{ capability_id: 'child-1', parent_capability_id: 'parent-1' }];
      pool.query.mockResolvedValue({ rows: children, rowCount: 1 });

      const result = await repo.findByParent('parent-1');
      expect(result).toEqual(children);
    });

    it('should return root capabilities when parentId is null', async () => {
      const roots = [{ capability_id: 'root-1', parent_capability_id: null }];
      pool.query.mockResolvedValue({ rows: roots, rowCount: 1 });

      const result = await repo.findByParent(null);
      expect(result).toEqual(roots);
    });
  });

  // ==================== create ====================
  describe('create', () => {
    it('should create a capability with all fields', async () => {
      const input = {
        capability_id: 'cap-new',
        name: 'New Cap',
        description: 'A new capability',
        category: 'deploy',
        parent_capability_id: 'parent-1',
        risk_level: 3,
        requires_approval: true,
        approval_role: 'admin',
        metadata: { key: 'value' },
        created_by: 'user-1',
      };
      const created = { ...input, id: '1', created_at: '2026-01-01', updated_at: '2026-01-01' };
      pool.query.mockResolvedValue({ rows: [created], rowCount: 1 });

      const result = await repo.create(input);
      expect(result).toEqual(created);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO capabilities'),
        ['cap-new', 'New Cap', 'A new capability', 'deploy', 'parent-1', 3, true, 'admin', { key: 'value' }, 'user-1']
      );
    });

    it('should create a capability with defaults for optional fields', async () => {
      const input = { capability_id: 'cap-min', name: 'Min', category: 'ops' };
      const created = { ...input, id: '1', description: null, risk_level: 1, requires_approval: false };
      pool.query.mockResolvedValue({ rows: [created], rowCount: 1 });

      const result = await repo.create(input);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO capabilities'),
        ['cap-min', 'Min', null, 'ops', null, 1, false, null, {}, null]
      );
    });
  });

  // ==================== update ====================
  describe('update', () => {
    it('should update specified fields', async () => {
      const updated = { capability_id: 'cap-1', name: 'Updated', risk_level: 2 };
      pool.query.mockResolvedValue({ rows: [updated], rowCount: 1 });

      const result = await repo.update('cap-1', { name: 'Updated', risk_level: 2 });
      expect(result).toEqual(updated);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE capabilities SET'),
        ['Updated', 2, 'cap-1']
      );
    });

    it('should return findById result when no fields to update', async () => {
      const cap = { capability_id: 'cap-1', name: 'Test' };
      pool.query.mockResolvedValue({ rows: [cap], rowCount: 1 });

      const result = await repo.update('cap-1', {});
      expect(result).toEqual(cap);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM capabilities WHERE capability_id = $1',
        ['cap-1']
      );
    });

    it('should return null when updating non-existent capability', async () => {
      pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.update('nonexistent', { name: 'X' });
      expect(result).toBeNull();
    });

    it('should update metadata field', async () => {
      const meta = { key: 'value', nested: { a: 1 } };
      pool.query.mockResolvedValue({ rows: [{ metadata: meta }], rowCount: 1 });

      await repo.update('cap-1', { metadata: meta });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('metadata = $1'),
        [meta, 'cap-1']
      );
    });

    it('should update requires_approval and approval_role together', async () => {
      pool.query.mockResolvedValue({ rows: [{}], rowCount: 1 });

      await repo.update('cap-1', { requires_approval: true, approval_role: 'ops' });
      const call = pool.query.mock.calls[0];
      expect(call[0]).toContain('requires_approval = $1');
      expect(call[0]).toContain('approval_role = $2');
      expect(call[0]).toContain('updated_at = NOW()');
    });
  });

  // ==================== delete ====================
  describe('delete', () => {
    it('should return true when capability is deleted', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });
      const result = await repo.delete('cap-1');
      expect(result).toBe(true);
    });

    it('should return false when capability not found', async () => {
      pool.query.mockResolvedValue({ rowCount: 0 });
      const result = await repo.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ==================== Role Mappings ====================
  describe('grantToRole', () => {
    it('should insert a role mapping and return it', async () => {
      const mapping: CapabilityRoleMapping = {
        id: '1', capability_id: 'cap-1', role_name: 'admin',
        granted_at: '2026-01-01', granted_by: 'user-1',
      };
      pool.query.mockResolvedValue({ rows: [mapping], rowCount: 1 });

      const result = await repo.grantToRole('cap-1', 'admin', 'user-1');
      expect(result).toEqual(mapping);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO capability_role_mappings'),
        ['cap-1', 'admin', 'user-1']
      );
    });

    it('should handle grantedBy as null when omitted', async () => {
      pool.query.mockResolvedValue({ rows: [{}], rowCount: 1 });
      await repo.grantToRole('cap-1', 'viewer');
      expect(pool.query.mock.calls[0][1]).toEqual(['cap-1', 'viewer', null]);
    });
  });

  describe('revokeFromRole', () => {
    it('should return true when mapping is deleted', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });
      const result = await repo.revokeFromRole('cap-1', 'admin');
      expect(result).toBe(true);
    });

    it('should return false when mapping does not exist', async () => {
      pool.query.mockResolvedValue({ rowCount: 0 });
      const result = await repo.revokeFromRole('cap-1', 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getCapabilitiesByRole', () => {
    it('should return capability IDs for a role', async () => {
      pool.query.mockResolvedValue({ rows: [{ capability_id: 'cap-1' }, { capability_id: 'cap-2' }] });
      const result = await repo.getCapabilitiesByRole('admin');
      expect(result).toEqual(['cap-1', 'cap-2']);
    });

    it('should return empty array when role has no capabilities', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const result = await repo.getCapabilitiesByRole('empty-role');
      expect(result).toEqual([]);
    });
  });

  describe('getCapabilitiesByRoles', () => {
    it('should return distinct capability IDs for multiple roles', async () => {
      pool.query.mockResolvedValue({ rows: [{ capability_id: 'cap-1' }, { capability_id: 'cap-2' }] });
      const result = await repo.getCapabilitiesByRoles(['admin', 'ops']);
      expect(result).toEqual(['cap-1', 'cap-2']);
    });

    it('should return empty array immediately for empty roleNames', async () => {
      const result = await repo.getCapabilitiesByRoles([]);
      expect(result).toEqual([]);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  // ==================== User Mappings ====================
  describe('grantToUser', () => {
    it('should insert a user mapping with all parameters', async () => {
      const mapping: CapabilityUserMapping = {
        id: '1', capability_id: 'cap-1', user_id: 'u1',
        granted_at: '2026-01-01', granted_by: 'admin',
        expires_at: '2026-12-31', approval_id: 10, ticket_id: 20, reason: 'test',
      };
      pool.query.mockResolvedValue({ rows: [mapping], rowCount: 1 });
      const expiresAt = new Date('2026-12-31');

      const result = await repo.grantToUser('cap-1', 'u1', 'admin', expiresAt, {
        approval_id: 10, ticket_id: 20, reason: 'test',
      });
      expect(result).toEqual(mapping);
    });

    it('should default optional params to null', async () => {
      pool.query.mockResolvedValue({ rows: [{}], rowCount: 1 });
      await repo.grantToUser('cap-1', 'u1');
      expect(pool.query.mock.calls[0][1]).toEqual(['cap-1', 'u1', null, null, null, null, null]);
    });
  });

  describe('revokeFromUser', () => {
    it('should return true when mapping is deleted', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });
      const result = await repo.revokeFromUser('cap-1', 'u1');
      expect(result).toBe(true);
    });

    it('should return false when mapping does not exist', async () => {
      pool.query.mockResolvedValue({ rowCount: 0 });
      const result = await repo.revokeFromUser('cap-1', 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getCapabilitiesByUser', () => {
    it('should return capabilities for non-expired user mappings', async () => {
      pool.query.mockResolvedValue({ rows: [{ capability_id: 'cap-1' }] });
      const result = await repo.getCapabilitiesByUser('u1');
      expect(result).toEqual(['cap-1']);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('expires_at IS NULL OR expires_at > NOW()'),
        ['u1']
      );
    });

    it('should return empty array for user with no capabilities', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const result = await repo.getCapabilitiesByUser('u-empty');
      expect(result).toEqual([]);
    });
  });

  describe('getExpiredPermissions', () => {
    it('should return expired user mappings', async () => {
      const expired = [{ id: '1', user_id: 'u1' }];
      pool.query.mockResolvedValue({ rows: expired });
      const result = await repo.getExpiredPermissions();
      expect(result).toEqual(expired);
    });
  });

  describe('deleteExpiredPermissions', () => {
    it('should return count of deleted expired permissions', async () => {
      pool.query.mockResolvedValue({ rowCount: 3 });
      const result = await repo.deleteExpiredPermissions();
      expect(result).toBe(3);
    });

    it('should return 0 when no expired permissions exist', async () => {
      pool.query.mockResolvedValue({ rowCount: 0 });
      const result = await repo.deleteExpiredPermissions();
      expect(result).toBe(0);
    });
  });

  // ==================== ChatOps Command Mapping ====================
  describe('mapCommandToCapability', () => {
    it('should insert command-capability mapping', async () => {
      const mapping: ChatOpsCommandCapability = {
        id: '1', command_name: 'deploy', command_action: 'start',
        capability_id: 'cap-1', environment_suffix: '_prod',
      };
      pool.query.mockResolvedValue({ rows: [mapping], rowCount: 1 });

      const result = await repo.mapCommandToCapability('deploy', 'start', 'cap-1', '_prod');
      expect(result).toEqual(mapping);
    });

    it('should handle environmentSuffix as null when omitted', async () => {
      pool.query.mockResolvedValue({ rows: [{}], rowCount: 1 });
      await repo.mapCommandToCapability('deploy', 'start', 'cap-1');
      expect(pool.query.mock.calls[0][1]).toEqual(['deploy', 'start', 'cap-1', null]);
    });
  });

  describe('getCapabilityForCommand', () => {
    it('should return capability for environment-specific mapping', async () => {
      pool.query.mockResolvedValue({ rows: [{ capability_id: 'cap-prod' }] });
      const result = await repo.getCapabilityForCommand('deploy', 'start', 'prod');
      expect(result).toBe('cap-prod');
    });

    it('should fall back to default mapping when no env-specific mapping found', async () => {
      // First call (env-specific) returns nothing, second call (default) returns result
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ capability_id: 'cap-default' }] });
      const result = await repo.getCapabilityForCommand('deploy', 'start', 'staging');
      expect(result).toBe('cap-default');
    });

    it('should skip env query when environment is not provided', async () => {
      pool.query.mockResolvedValue({ rows: [{ capability_id: 'cap-default' }] });
      const result = await repo.getCapabilityForCommand('deploy', 'start');
      expect(result).toBe('cap-default');
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('should return null when no mapping exists', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const result = await repo.getCapabilityForCommand('unknown', 'action');
      expect(result).toBeNull();
    });
  });

  describe('getCommandsByCapability', () => {
    it('should return all commands for a capability', async () => {
      const commands = [
        { command_name: 'deploy', command_action: 'start' },
        { command_name: 'deploy', command_action: 'stop' },
      ];
      pool.query.mockResolvedValue({ rows: commands });
      const result = await repo.getCommandsByCapability('cap-1');
      expect(result).toEqual(commands);
    });
  });

  // ==================== Temporary Permissions ====================
  describe('grantTemporaryPermission', () => {
    it('should insert temporary permission record', async () => {
      const perm: TemporaryPermission = {
        id: 1, tenant_id: 't1', user_id: 'u1', capability_id: 'cap-1',
        environment_suffix: '_prod', granted_by: 'admin', approval_id: 5,
        ticket_id: 10, reason: 'temporary access', granted_at: '2026-01-01',
        expires_at: '2026-02-01', revoked_at: null, revoked_by: null,
        revoke_reason: null, created_at: '2026-01-01',
      };
      pool.query.mockResolvedValue({ rows: [perm], rowCount: 1 });

      const result = await repo.grantTemporaryPermission({
        tenant_id: 't1', user_id: 'u1', capability_id: 'cap-1',
        environment_suffix: '_prod', granted_by: 'admin',
        approval_id: 5, ticket_id: 10, reason: 'temporary access',
        expires_at: new Date('2026-02-01'),
      });
      expect(result).toEqual(perm);
    });

    it('should default optional fields to null', async () => {
      pool.query.mockResolvedValue({ rows: [{}], rowCount: 1 });
      await repo.grantTemporaryPermission({
        tenant_id: 't1', user_id: 'u1', capability_id: 'cap-1',
        granted_by: 'admin', expires_at: new Date(),
      });
      const params = pool.query.mock.calls[0][1];
      expect(params[3]).toBeNull(); // environment_suffix
      expect(params[5]).toBeNull(); // approval_id
      expect(params[6]).toBeNull(); // ticket_id
      expect(params[7]).toBeNull(); // reason
    });
  });

  describe('revokeTemporaryPermission', () => {
    it('should revoke an active temporary permission', async () => {
      const revoked: TemporaryPermission = {
        id: 1, tenant_id: 't1', user_id: 'u1', capability_id: 'cap-1',
        environment_suffix: null, granted_by: 'admin', approval_id: null,
        ticket_id: null, reason: null, granted_at: '2026-01-01',
        expires_at: '2026-02-01', revoked_at: '2026-01-15', revoked_by: 'admin',
        revoke_reason: 'manual revoke', created_at: '2026-01-01',
      };
      pool.query.mockResolvedValue({ rows: [revoked], rowCount: 1 });

      const result = await repo.revokeTemporaryPermission(1, 'admin', 'manual revoke');
      expect(result).toEqual(revoked);
    });

    it('should return null when permission not found or already revoked', async () => {
      pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.revokeTemporaryPermission(999, 'admin');
      expect(result).toBeNull();
    });

    it('should handle null reason', async () => {
      pool.query.mockResolvedValue({ rows: [{}], rowCount: 1 });
      await repo.revokeTemporaryPermission(1, 'admin');
      expect(pool.query.mock.calls[0][1]).toEqual(['admin', null, 1]);
    });
  });

  describe('revokeTemporaryPermissionsByUser', () => {
    it('should revoke all active permissions for a user', async () => {
      pool.query.mockResolvedValue({ rowCount: 3 });
      const result = await repo.revokeTemporaryPermissionsByUser('u1', 'admin');
      expect(result).toBe(3);
    });

    it('should return 0 when user has no active permissions', async () => {
      pool.query.mockResolvedValue({ rowCount: 0 });
      const result = await repo.revokeTemporaryPermissionsByUser('u-empty', 'admin');
      expect(result).toBe(0);
    });
  });

  describe('getActiveTemporaryPermissions', () => {
    it('should return active permissions for user', async () => {
      const perms = [{ id: 1, user_id: 'u1' }];
      pool.query.mockResolvedValue({ rows: perms });
      const result = await repo.getActiveTemporaryPermissions('u1');
      expect(result).toEqual(perms);
    });

    it('should filter by tenantId when provided', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      await repo.getActiveTemporaryPermissions('u1', 't1');
      const query = pool.query.mock.calls[0][0];
      expect(query).toContain('tenant_id = $2');
    });
  });

  describe('getExpiredTemporaryPermissions', () => {
    it('should return expired non-revoked permissions', async () => {
      const perms = [{ id: 1 }];
      pool.query.mockResolvedValue({ rows: perms });
      const result = await repo.getExpiredTemporaryPermissions();
      expect(result).toEqual(perms);
    });
  });

  describe('cleanupExpiredTemporaryPermissions', () => {
    it('should mark expired permissions as revoked by system', async () => {
      const expired = [{ id: 1 }, { id: 2 }];
      pool.query.mockResolvedValue({ rows: expired });
      const result = await repo.cleanupExpiredTemporaryPermissions();
      expect(result).toEqual(expired);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('自动过期清理')
      );
    });
  });

  // ==================== Audit Log ====================
  describe('createAuditLog', () => {
    it('should insert audit log with all fields', async () => {
      const log = { id: 1, tenant_id: 't1', user_id: 'u1', action: 'granted' };
      pool.query.mockResolvedValue({ rows: [log], rowCount: 1 });

      const result = await repo.createAuditLog({
        tenant_id: 't1', user_id: 'u1', action: 'granted',
        capability_id: 'cap-1', environment_suffix: '_prod',
        actor_id: 'admin', reason: 'test', metadata: { key: 'val' },
      });
      expect(result).toEqual(log);
    });

    it('should default optional fields to null', async () => {
      pool.query.mockResolvedValue({ rows: [{}], rowCount: 1 });
      await repo.createAuditLog({ tenant_id: 't1', user_id: 'u1', action: 'test', capability_id: 'cap-1' });
      const params = pool.query.mock.calls[0][1];
      expect(params[4]).toBeNull(); // environment_suffix
      expect(params[5]).toBeNull(); // actor_id
      expect(params[6]).toBeNull(); // reason
      expect(params[7]).toBeNull(); // metadata
    });
  });

  describe('getAuditLogs', () => {
    it('should return logs with total count and default pagination', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const result = await repo.getAuditLogs({});
      expect(result.total).toBe(5);
      expect(result.logs).toHaveLength(2);
    });

    it('should filter by user_id, capability_id, action', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{}] });

      await repo.getAuditLogs({ user_id: 'u1', capability_id: 'cap-1', action: 'granted' });
      const countQuery = pool.query.mock.calls[0][0];
      expect(countQuery).toContain('user_id = $1');
      expect(countQuery).toContain('capability_id = $2');
      expect(countQuery).toContain('action = $3');
    });

    it('should apply custom limit and offset', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.getAuditLogs({ limit: 10, offset: 20 });
      const params = pool.query.mock.calls[1][1];
      expect(params).toContain(10);
      expect(params).toContain(20);
    });

    it('should cap limit at 200', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.getAuditLogs({ limit: 500 });
      const params = pool.query.mock.calls[1][1];
      expect(params).toContain(200);
    });
  });

  // ==================== Permission Requests ====================
  describe('createPermissionRequest', () => {
    it('should insert a permission request', async () => {
      const record = { id: 1, ticket_id: 100, capability_id: 'cap-1', status: 'pending' };
      pool.query.mockResolvedValue({ rows: [record], rowCount: 1 });

      const result = await repo.createPermissionRequest({
        ticket_id: 100, capability_id: 'cap-1', duration_hours: 24,
        requested_for_user_id: 'u1',
      });
      expect(result).toEqual(record);
    });
  });

  describe('getPermissionRequestByTicketId', () => {
    it('should return request by ticket ID', async () => {
      const record = { id: 1, ticket_id: 100 };
      pool.query.mockResolvedValue({ rows: [record] });
      const result = await repo.getPermissionRequestByTicketId(100);
      expect(result).toEqual(record);
    });

    it('should return null when ticket not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const result = await repo.getPermissionRequestByTicketId(999);
      expect(result).toBeNull();
    });
  });

  describe('linkApprovalToPermissionRequest', () => {
    it('should return true when linked successfully', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });
      const result = await repo.linkApprovalToPermissionRequest(100, 5);
      expect(result).toBe(true);
    });

    it('should return false when ticket not found', async () => {
      pool.query.mockResolvedValue({ rowCount: 0 });
      const result = await repo.linkApprovalToPermissionRequest(999, 5);
      expect(result).toBe(false);
    });
  });

  // ==================== Auto-Approval Rules ====================
  describe('checkAutoApprovalRules', () => {
    it('should auto-approve low risk (level 1) capabilities', async () => {
      pool.query.mockResolvedValue({ rows: [{ risk_level: 1, parent_capability_id: null }] });
      const result = await repo.checkAutoApprovalRules('u1', 'cap-1');
      expect(result).toEqual({ autoApprove: true, reason: 'Low risk capability (auto-approved)' });
    });

    it('should auto-approve risk level 2 capabilities', async () => {
      pool.query.mockResolvedValue({ rows: [{ risk_level: 2, parent_capability_id: null }] });
      const result = await repo.checkAutoApprovalRules('u1', 'cap-1');
      expect(result.autoApprove).toBe(true);
    });

    it('should not auto-approve when capability not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const result = await repo.checkAutoApprovalRules('u1', 'nonexistent');
      expect(result).toEqual({ autoApprove: false, reason: 'Capability not found' });
    });

    it('should auto-approve when user has parent capability', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ risk_level: 3, parent_capability_id: 'parent-1' }] })
        .mockResolvedValueOnce({ rows: [{ '1': 1 }] }); // user has parent

      const result = await repo.checkAutoApprovalRules('u1', 'cap-1');
      expect(result).toEqual({ autoApprove: true, reason: 'User has parent capability (auto-approved)' });
    });

    it('should auto-approve when user role already has capability', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ risk_level: 3, parent_capability_id: null }] })
        .mockResolvedValueOnce({ rows: [{ '1': 1 }] }); // role has capability

      const result = await repo.checkAutoApprovalRules('u1', 'cap-1', ['admin']);
      expect(result).toEqual({ autoApprove: true, reason: 'User role has capability (auto-approved)' });
    });

    it('should require manual approval when no auto-approve rules match', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ risk_level: 3, parent_capability_id: null }] })
        .mockResolvedValueOnce({ rows: [] }); // no role match

      const result = await repo.checkAutoApprovalRules('u1', 'cap-1', ['viewer']);
      expect(result).toEqual({ autoApprove: false, reason: 'Requires manual approval' });
    });

    it('should require manual approval when userRoles is empty and high risk', async () => {
      pool.query.mockResolvedValue({ rows: [{ risk_level: 4, parent_capability_id: null }] });
      const result = await repo.checkAutoApprovalRules('u1', 'cap-1', []);
      expect(result).toEqual({ autoApprove: false, reason: 'Requires manual approval' });
    });
  });

  // ==================== Permission Request Status ====================
  describe('updatePermissionRequestStatus', () => {
    it('should return true when status is updated', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });
      const result = await repo.updatePermissionRequestStatus(100, 'approved', 'admin');
      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE permission_requests'),
        ['approved', 'admin', 100]
      );
    });

    it('should handle null approvedBy', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });
      await repo.updatePermissionRequestStatus(100, 'rejected');
      expect(pool.query.mock.calls[0][1]).toEqual(['rejected', null, 100]);
    });

    it('should return false when ticket not found', async () => {
      pool.query.mockResolvedValue({ rowCount: 0 });
      const result = await repo.updatePermissionRequestStatus(999, 'approved', 'admin');
      expect(result).toBe(false);
    });
  });

  describe('getPermissionRequestsByUser', () => {
    it('should return requests ordered by created_at DESC', async () => {
      const records = [{ id: 2 }, { id: 1 }];
      pool.query.mockResolvedValue({ rows: records });
      const result = await repo.getPermissionRequestsByUser('u1');
      expect(result).toEqual(records);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        ['u1']
      );
    });
  });
});
