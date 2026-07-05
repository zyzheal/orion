/**
 * ConfigAuditService - Unit Tests
 *
 * Tests for audit log recording, querying with filters, and entry count.
 */

// Mock uuid
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `audit-uuid-${++uuidCounter}`),
}));

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

import { ConfigAuditService, AuditAction, AuditFilter } from '../ConfigAuditService';

describe('ConfigAuditService', () => {
  let service: ConfigAuditService;

  beforeEach(() => {
    uuidCounter = 0;
    // No database = in-memory mode
    service = new ConfigAuditService();
  });

  // ==================== record ====================

  describe('record', () => {
    it('should record a basic audit entry', async () => {
      const entry = await service.record(
        'tenant-1',
        'config.create',
        'config',
        'config-123',
        'admin'
      );

      expect(entry.id).toBe('audit-uuid-1');
      expect(entry.tenantId).toBe('tenant-1');
      expect(entry.action).toBe('config.create');
      expect(entry.resourceType).toBe('config');
      expect(entry.resourceId).toBe('config-123');
      expect(entry.actor).toBe('admin');
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    it('should record an entry with all optional fields', async () => {
      const entry = await service.record(
        'tenant-1',
        'config.update',
        'config',
        'config-456',
        'developer',
        {
          resourceKey: 'database.url',
          actorRole: 'editor',
          oldValue: { value: 'old-db-url' },
          newValue: { value: 'new-db-url' },
          reason: 'Database migration',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: { source: 'api', requestId: 'req-789' },
        }
      );

      expect(entry.resourceKey).toBe('database.url');
      expect(entry.actorRole).toBe('editor');
      expect(entry.oldValue).toEqual({ value: 'old-db-url' });
      expect(entry.newValue).toEqual({ value: 'new-db-url' });
      expect(entry.reason).toBe('Database migration');
      expect(entry.ipAddress).toBe('192.168.1.1');
      expect(entry.userAgent).toBe('Mozilla/5.0');
      expect(entry.metadata).toEqual({ source: 'api', requestId: 'req-789' });
    });

    it('should record entries for all resource types', async () => {
      const resourceTypes = ['config', 'flag', 'experiment', 'drift'] as const;

      for (const rt of resourceTypes) {
        const entry = await service.record('t', 'config.create', rt, 'res-1', 'admin');
        expect(entry.resourceType).toBe(rt);
      }
    });

    it('should record entries for various audit actions', async () => {
      const actions: AuditAction[] = [
        'config.create',
        'config.update',
        'config.delete',
        'config.rollback',
        'flag.create',
        'flag.update',
        'flag.toggle',
        'flag.delete',
        'experiment.create',
        'experiment.start',
        'experiment.stop',
        'experiment.cancel',
        'drift.remediate',
      ];

      for (const action of actions) {
        const entry = await service.record('t', action, 'config', 'res-1', 'admin');
        expect(entry.action).toBe(action);
      }
    });
  });

  // ==================== queryAuditLog ====================

  describe('queryAuditLog', () => {
    beforeEach(async () => {
      // Seed audit entries
      await service.record('tenant-1', 'config.create', 'config', 'cfg-1', 'alice', {
        resourceKey: 'app.theme',
      });
      await service.record('tenant-1', 'config.update', 'config', 'cfg-1', 'bob', {
        resourceKey: 'app.theme',
      });
      await service.record('tenant-1', 'flag.create', 'flag', 'flag-1', 'alice', {
        resourceKey: 'dark-mode',
      });
      await service.record('tenant-2', 'config.create', 'config', 'cfg-2', 'charlie');
    });

    it('should return all entries for a tenant', async () => {
      const entries = await service.queryAuditLog({ tenantId: 'tenant-1' });
      expect(entries).toHaveLength(3);
    });

    it('should filter by single action', async () => {
      const entries = await service.queryAuditLog({
        tenantId: 'tenant-1',
        action: 'config.create',
      });
      expect(entries).toHaveLength(1);
      expect(entries[0].actor).toBe('alice');
    });

    it('should filter by multiple actions', async () => {
      const entries = await service.queryAuditLog({
        tenantId: 'tenant-1',
        action: ['config.create', 'flag.create'] as any,
      });
      expect(entries).toHaveLength(2);
    });

    it('should filter by resource type', async () => {
      const entries = await service.queryAuditLog({
        tenantId: 'tenant-1',
        resourceType: 'flag',
      });
      expect(entries).toHaveLength(1);
      expect(entries[0].resourceType).toBe('flag');
    });

    it('should filter by resource id', async () => {
      const entries = await service.queryAuditLog({
        tenantId: 'tenant-1',
        resourceId: 'cfg-1',
      });
      expect(entries).toHaveLength(2);
    });

    it('should filter by actor', async () => {
      const entries = await service.queryAuditLog({
        tenantId: 'tenant-1',
        actor: 'alice',
      });
      expect(entries).toHaveLength(2);
    });

    it('should support pagination with limit and offset', async () => {
      const page1 = await service.queryAuditLog({
        tenantId: 'tenant-1',
        limit: 2,
        offset: 0,
      });
      expect(page1).toHaveLength(2);

      const page2 = await service.queryAuditLog({
        tenantId: 'tenant-1',
        limit: 2,
        offset: 2,
      });
      expect(page2).toHaveLength(1);
    });

    it('should return empty for non-existent tenant', async () => {
      const entries = await service.queryAuditLog({ tenantId: 'ghost-tenant' });
      expect(entries).toHaveLength(0);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const tomorrow = new Date(now.getTime() + 86400000);

      const entries = await service.queryAuditLog({
        tenantId: 'tenant-1',
        startDate: yesterday,
        endDate: tomorrow,
      });
      // All entries should be within range since they were just created
      expect(entries).toHaveLength(3);
    });

    it('should return empty when date range does not match', async () => {
      const farPast = new Date('2000-01-01');
      const alsoPast = new Date('2000-01-02');

      const entries = await service.queryAuditLog({
        tenantId: 'tenant-1',
        startDate: farPast,
        endDate: alsoPast,
      });
      expect(entries).toHaveLength(0);
    });
  });

  // ==================== getEntryCount ====================

  describe('getEntryCount', () => {
    beforeEach(async () => {
      await service.record('tenant-1', 'config.create', 'config', 'cfg-1', 'alice');
      await service.record('tenant-1', 'config.update', 'config', 'cfg-2', 'bob');
      await service.record('tenant-1', 'flag.create', 'flag', 'flag-1', 'alice');
      await service.record('tenant-2', 'config.create', 'config', 'cfg-3', 'charlie');
    });

    it('should count all entries for a tenant', async () => {
      const count = await service.getEntryCount('tenant-1');
      expect(count).toBe(3);
    });

    it('should count entries filtered by resource type', async () => {
      const count = await service.getEntryCount('tenant-1', 'config');
      expect(count).toBe(2);
    });

    it('should return 0 for non-existent tenant', async () => {
      const count = await service.getEntryCount('ghost-tenant');
      expect(count).toBe(0);
    });

    it('should return 0 for non-matching resource type', async () => {
      const count = await service.getEntryCount('tenant-1', 'experiment');
      expect(count).toBe(0);
    });
  });
});
