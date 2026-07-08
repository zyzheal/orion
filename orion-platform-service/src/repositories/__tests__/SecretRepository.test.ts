/**
 * SecretRepository Tests
 */

import { SecretRepository, SecretScope } from '../SecretRepository';

describe('SecretRepository', () => {
  let repo: SecretRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new SecretRepository(mockDb);
  });

  const mockDate = new Date('2026-01-01T00:00:00Z');

  function mockRow(overrides?: Partial<any>) {
    return {
      id: 'sec-1',
      tenant_id: 'tenant-1',
      name: 'MY_SECRET',
      encrypted_value: Buffer.from('encrypted-data'),
      scope: 'project',
      created_at: mockDate,
      updated_at: mockDate,
      created_by: 'user-1',
      ...overrides,
    };
  }

  // ==================== findByTenantAndName ====================

  describe('findByTenantAndName', () => {
    it('should find secret with explicit scope', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRow()], rowCount: 1 });

      const result = await repo.findByTenantAndName('tenant-1', 'MY_SECRET', 'project');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('MY_SECRET');
      expect(result!.scope).toBe('project');
      expect(result!.tenantId).toBe('tenant-1');
      expect(result!.encryptedValue).toBeInstanceOf(Buffer);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1 AND name = $2 AND scope = $3'),
        ['tenant-1', 'MY_SECRET', 'project'],
      );
    });

    it('should return undefined when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findByTenantAndName('tenant-1', 'MISSING', 'project');

      expect(result).toBeNull();
    });

    it('should search across scopes with priority when scope not specified', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRow()], rowCount: 1 });

      await repo.findByTenantAndName('tenant-1', 'MY_SECRET');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY'),
        ['tenant-1', 'MY_SECRET'],
      );
    });
  });

  // ==================== listByTenantAndScope ====================

  describe('listByTenantAndScope', () => {
    it('should list secrets for a tenant', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: '1', tenant_id: 't1', name: 'SECRET_A', scope: 'project', created_at: mockDate, updated_at: mockDate, created_by: 'u1', encrypted_value: Buffer.from('a') },
          { id: '2', tenant_id: 't1', name: 'SECRET_B', scope: 'org', created_at: mockDate, updated_at: mockDate, created_by: 'u2', encrypted_value: Buffer.from('b') },
        ],
        rowCount: 2,
      });

      const result = await repo.listByTenantAndScope('t1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('SECRET_A');
      expect(result[1].name).toBe('SECRET_B');
    });

    it('should filter by scope when provided', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: '1', tenant_id: 't1', name: 'P1', scope: 'project', created_at: mockDate, updated_at: mockDate, created_by: 'u1', encrypted_value: Buffer.from('x') }],
        rowCount: 1,
      });

      await repo.listByTenantAndScope('t1', 'project');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND scope = $2'),
        ['t1', 'project'],
      );
    });
  });

  // ==================== upsert ====================

  describe('upsert', () => {
    it('should insert a new secret', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRow()], rowCount: 1 });

      const result = await repo.upsert({
        tenantId: 'tenant-1',
        name: 'MY_SECRET',
        encryptedValue: Buffer.from('encrypted'),
        scope: 'project',
        createdBy: 'user-1',
      });

      expect(result.name).toBe('MY_SECRET');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.arrayContaining([
          expect.any(String),
          'tenant-1',
          'MY_SECRET',
          expect.any(Buffer),
          'project',
          'user-1',
        ]),
      );
    });

    it('should update existing secret on conflict', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRow({ name: 'UPDATED', encrypted_value: Buffer.from('new-encrypted') })], rowCount: 1 });

      const result = await repo.upsert({
        id: 'sec-1',
        tenantId: 'tenant-1',
        name: 'MY_SECRET',
        encryptedValue: Buffer.from('new-encrypted'),
        scope: 'project',
      });

      expect(result.encryptedValue).toEqual(Buffer.from('new-encrypted'));
    });

    it('should use default scope when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRow({ scope: 'project' })], rowCount: 1 });

      await repo.upsert({
        tenantId: 't1',
        name: 'TEST',
        encryptedValue: Buffer.from('x'),
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.any(String), 't1', 'TEST', expect.any(Buffer), 'project', null]),
      );
    });
  });

  // ==================== deleteByTenantAndScope ====================

  describe('deleteByTenantAndScope', () => {
    it('should delete secrets by tenant and scope', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 3 });

      const count = await repo.deleteByTenantAndScope('tenant-1', 'project');

      expect(count).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        ['tenant-1', 'project'],
      );
    });
  });

  // ==================== deleteByTenant ====================

  describe('deleteByTenant', () => {
    it('should delete all secrets for a tenant', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 5 });

      const count = await repo.deleteByTenant('tenant-1');

      expect(count).toBe(5);
    });
  });

  // ==================== Base Repository Methods ====================

  describe('findById (inherited)', () => {
    it('should find by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRow()], rowCount: 1 });

      const result = await repo.findById('sec-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('sec-1');
    });

    it('should return undefined for non-existent id', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('delete (inherited)', () => {
    it('should delete by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await repo.delete('sec-1');

      expect(result).toBe(true);
    });
  });
});
