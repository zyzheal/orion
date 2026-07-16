/**
 * EscalationConfigService Extended Tests
 *
 * Covers gaps not in the main test file:
 * - getAllPolicies()
 * - createPolicy via EscalationPolicyRepository path
 * - loadPolicies with JSON string and null fields
 * - createPolicy with repo.upsert failure
 * - createPolicy with undefined severity
 */

// ============================================================================
// Mock declarations
// ============================================================================

const mockLoggerMethods = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('pino', () => {
  return jest.fn(() => mockLoggerMethods);
});

// ============================================================================
// Imports
// ============================================================================

import { EscalationConfigService, EscalationPolicy } from '../EscalationConfigService';

// ============================================================================
// Helpers
// ============================================================================

type MockDb = {
  query: jest.Mock;
};

function makePolicy(overrides: Partial<Omit<EscalationPolicy, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<EscalationPolicy, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    entityType: 'alert',
    severity: 'critical',
    level: 1,
    timeoutMinutes: 10,
    notifyUsers: ['user-1'],
    notifyChannels: ['dingtalk'],
    isActive: true,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('EscalationConfigService - Extended', () => {
  let service: EscalationConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getAllPolicies
  // ---------------------------------------------------------------------------

  describe('getAllPolicies', () => {
    it('should return empty array when cache is empty', () => {
      service = new EscalationConfigService();
      expect(service.getAllPolicies()).toEqual([]);
    });

    it('should return all policies across different entity types', async () => {
      service = new EscalationConfigService();
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'critical', level: 1 }));
      await service.createPolicy(makePolicy({ entityType: 'ticket', severity: 'high', level: 1 }));
      await service.createPolicy(makePolicy({ entityType: 'incident', level: 1 }));

      const all = service.getAllPolicies();
      expect(all).toHaveLength(3);
      expect(all.map(p => p.entityType).sort()).toEqual(['alert', 'incident', 'ticket']);
    });

    it('should return all policies across different severities of same type', async () => {
      service = new EscalationConfigService();
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'critical', level: 1 }));
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'high', level: 1 }));
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'low', level: 1 }));

      const all = service.getAllPolicies();
      expect(all).toHaveLength(3);
      expect(all.every(p => p.entityType === 'alert')).toBe(true);
    });

    it('should return multiple levels for same key', async () => {
      service = new EscalationConfigService();
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'critical', level: 1 }));
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'critical', level: 2 }));
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'critical', level: 3 }));

      const all = service.getAllPolicies();
      expect(all).toHaveLength(3);
    });

    it('should reflect deletions via cache replacement', async () => {
      service = new EscalationConfigService();
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'critical', level: 1, timeoutMinutes: 10 }));
      // Replace level 1 with different data
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'critical', level: 1, timeoutMinutes: 20 }));

      const all = service.getAllPolicies();
      expect(all).toHaveLength(1);
      expect(all[0].timeoutMinutes).toBe(20);
    });
  });

  // ---------------------------------------------------------------------------
  // createPolicy with undefined severity (cache key uses 'default')
  // ---------------------------------------------------------------------------

  describe('createPolicy with undefined severity', () => {
    it('should use "default" as cache key when severity is undefined', async () => {
      service = new EscalationConfigService();
      await service.createPolicy(makePolicy({ entityType: 'incident', severity: undefined, level: 1 }));

      // Should be retrievable via getPolicies with no severity
      const policies = service.getPolicies('incident');
      expect(policies).toHaveLength(1);
    });

    it('should distinguish between undefined severity and specific severity', async () => {
      service = new EscalationConfigService();
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: undefined, level: 1 }));
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'critical', level: 1 }));

      const defaultPolicies = service.getPolicies('alert');
      const criticalPolicies = service.getPolicies('alert', 'critical');
      expect(defaultPolicies).toHaveLength(1);
      expect(criticalPolicies).toHaveLength(1);
      expect(defaultPolicies[0].severity).toBeUndefined();
      expect(criticalPolicies[0].severity).toBe('critical');
    });

    it('should call DB with null severity when severity is undefined', async () => {
      const mockDb: MockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();
      jest.clearAllMocks();

      await service.createPolicy(makePolicy({ entityType: 'alert', severity: undefined, level: 1 }));

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const params = mockDb.query.mock.calls[0][1];
      expect(params[2]).toBeNull(); // severity should be null
    });
  });

  // ---------------------------------------------------------------------------
  // createPolicy via EscalationPolicyRepository path
  // ---------------------------------------------------------------------------

  describe('createPolicy via EscalationPolicyRepository', () => {
    it('should call repo.upsert when repo is available', async () => {
      const mockDb: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
          .mockResolvedValueOnce({ rows: [] }), // loadPolicies
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();
      jest.clearAllMocks();

      // After initialization, repo is created. Creating a policy should use repo.upsert.
      // The repo's upsert method calls db.query internally, so we track that.
      await service.createPolicy(makePolicy({
        entityType: 'alert',
        severity: 'critical',
        level: 1,
        notifyUsers: ['user-1'],
        notifyChannels: ['dingtalk', 'email'],
        autoAction: 'auto-restart',
      }));

      // repo.upsert calls db.query with INSERT ... ON CONFLICT
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO escalation_policies');
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('RETURNING *');
    });

    it('should silently catch repo.upsert failures', async () => {
      const mockDb: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
          .mockResolvedValueOnce({ rows: [] }) // loadPolicies
          .mockRejectedValueOnce(new Error('upsert failed')), // repo.upsert
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();
      jest.clearAllMocks();

      // Should not throw even though repo.upsert fails
      const policy = await service.createPolicy(makePolicy({
        entityType: 'alert',
        severity: 'critical',
        level: 1,
      }));

      expect(policy).toBeDefined();
      expect(policy.id).toMatch(/^policy_/);
      // The policy should still be in cache
      const cached = service.getPolicies('alert', 'critical');
      expect(cached).toHaveLength(1);
    });

    it('should pass correct fields to repo.upsert', async () => {
      const mockDb: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
          .mockResolvedValueOnce({ rows: [] }), // loadPolicies
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();
      jest.clearAllMocks();

      await service.createPolicy(makePolicy({
        entityType: 'ticket',
        severity: 'high',
        level: 2,
        timeoutMinutes: 60,
        notifyUsers: ['team-lead'],
        notifyChannels: ['sms', 'slack'],
        autoAction: 'escalate-to-manager',
        isActive: true,
      }));

      const params = mockDb.query.mock.calls[0][1];
      expect(params[1]).toBe('ticket');        // entity_type
      expect(params[2]).toBe('high');          // severity
      expect(params[3]).toBe(2);               // level
      expect(params[4]).toBe(60);              // timeout_minutes
      expect(params[5]).toBe('["team-lead"]'); // notify_users as JSON
      expect(params[6]).toBe('["sms","slack"]'); // notify_channels as JSON
      expect(params[7]).toBe('escalate-to-manager'); // auto_action
      expect(params[8]).toBe(true);            // is_active
    });
  });

  // ---------------------------------------------------------------------------
  // loadPolicies with JSON string fields
  // ---------------------------------------------------------------------------

  describe('loadPolicies with various field formats', () => {
    it('should parse JSON string notify_users and notify_channels', async () => {
      const mockDb: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
          .mockResolvedValueOnce({ rows: [] }), // repo findActive
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();
      jest.clearAllMocks();

      // Simulate loadPolicies returning rows with JSON strings (raw DB path)
      // Since repo is available, loadPolicies goes through repo.findActive which maps entities.
      // To test JSON string parsing, we need to go through the raw DB path.
      // We'll create a service without repo but with db to test the raw query path.
      const mockDb2: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'policy-json',
                entity_type: 'alert',
                severity: 'critical',
                level: 1,
                timeout_minutes: 10,
                notify_users: '["user-1","user-2"]', // JSON string
                notify_channels: '["dingtalk","email"]', // JSON string
                auto_action: null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          }),
      };

      // Create a new service where db.query is used directly (no repo)
      // We need to test the path where repo is null but db exists.
      // The constructor creates repo when database is provided.
      // The raw query path is used when repo is falsy.
      // Looking at the code: if (this.repo) { ... } else { const result = await this.db.query(...) }
      // The repo is always created when database is passed to constructor.
      // So we need to override this.repo to be undefined.

      const service2 = new EscalationConfigService(mockDb2 as any);
      // Force repo to undefined to test the raw DB path
      (service2 as any).repo = undefined;
      await service2.initialize();

      const policies = service2.getPolicies('alert', 'critical');
      expect(policies).toHaveLength(1);
      expect(policies[0].notifyUsers).toEqual(['user-1', 'user-2']);
      expect(policies[0].notifyChannels).toEqual(['dingtalk', 'email']);
    });

    it('should handle null notify_users and notify_channels gracefully', async () => {
      const mockDb: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'policy-null',
                entity_type: 'ticket',
                severity: null,
                level: 1,
                timeout_minutes: 60,
                notify_users: null,
                notify_channels: null,
                auto_action: null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          }),
      };

      const service2 = new EscalationConfigService(mockDb as any);
      (service2 as any).repo = undefined;
      await service2.initialize();

      const policies = service2.getPolicies('ticket');
      expect(policies).toHaveLength(1);
      expect(policies[0].notifyUsers).toEqual([]);
      expect(policies[0].notifyChannels).toEqual([]);
    });

    it('should handle already-parsed array notify_users and notify_channels', async () => {
      const mockDb: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'policy-array',
                entity_type: 'alert',
                severity: 'high',
                level: 1,
                timeout_minutes: 15,
                notify_users: ['user-a'], // already array
                notify_channels: ['slack'], // already array
                auto_action: 'notify',
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          }),
      };

      const service2 = new EscalationConfigService(mockDb as any);
      (service2 as any).repo = undefined;
      await service2.initialize();

      const policies = service2.getPolicies('alert', 'high');
      expect(policies).toHaveLength(1);
      expect(policies[0].notifyUsers).toEqual(['user-a']);
      expect(policies[0].notifyChannels).toEqual(['slack']);
      expect(policies[0].autoAction).toBe('notify');
    });

    it('should cache policies with correct key including severity', async () => {
      const mockDb: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'policy-1',
                entity_type: 'alert',
                severity: 'critical',
                level: 1,
                timeout_minutes: 10,
                notify_users: '["u1"]',
                notify_channels: '["email"]',
                auto_action: null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
              },
              {
                id: 'policy-2',
                entity_type: 'alert',
                severity: 'critical',
                level: 2,
                timeout_minutes: 20,
                notify_users: '["u2"]',
                notify_channels: '["sms"]',
                auto_action: null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
              },
              {
                id: 'policy-3',
                entity_type: 'ticket',
                severity: null,
                level: 1,
                timeout_minutes: 120,
                notify_users: '["u3"]',
                notify_channels: '["dingtalk"]',
                auto_action: null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          }),
      };

      const service2 = new EscalationConfigService(mockDb as any);
      (service2 as any).repo = undefined;
      await service2.initialize();

      expect(service2.getPolicies('alert', 'critical')).toHaveLength(2);
      expect(service2.getPolicies('ticket')).toHaveLength(1);
      expect(service2.getAllPolicies()).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // createPolicy with DB (raw query path fallback)
  // ---------------------------------------------------------------------------

  describe('createPolicy raw DB path (no repo)', () => {
    it('should insert into DB via raw query when repo is undefined', async () => {
      const mockDb: MockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      service = new EscalationConfigService(mockDb as any);
      // Force repo to undefined
      (service as any).repo = undefined;
      await service.initialize();
      jest.clearAllMocks();

      await service.createPolicy(makePolicy({
        entityType: 'alert',
        severity: 'critical',
        level: 1,
        timeoutMinutes: 10,
        notifyUsers: ['user-1'],
        notifyChannels: ['dingtalk'],
        autoAction: 'restart',
      }));

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO escalation_policies');
      expect(sql).toContain('ON CONFLICT (entity_type, severity, level)');
      expect(sql).toContain('DO UPDATE SET');
    });

    it('should serialize notifyUsers and notifyChannels as JSON in raw DB path', async () => {
      const mockDb: MockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      service = new EscalationConfigService(mockDb as any);
      (service as any).repo = undefined;
      await service.initialize();
      jest.clearAllMocks();

      await service.createPolicy(makePolicy({
        entityType: 'ticket',
        severity: 'high',
        level: 1,
        notifyUsers: ['user-a', 'user-b'],
        notifyChannels: ['email', 'sms', 'slack'],
      }));

      const params = mockDb.query.mock.calls[0][1];
      expect(params[5]).toBe('["user-a","user-b"]');
      expect(params[6]).toBe('["email","sms","slack"]');
    });

    it('should handle autoAction as null when undefined in raw DB path', async () => {
      const mockDb: MockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      service = new EscalationConfigService(mockDb as any);
      (service as any).repo = undefined;
      await service.initialize();
      jest.clearAllMocks();

      await service.createPolicy(makePolicy({
        entityType: 'alert',
        severity: 'critical',
        level: 1,
        autoAction: undefined,
      }));

      const params = mockDb.query.mock.calls[0][1];
      expect(params[7]).toBeNull(); // auto_action
    });
  });

  // ---------------------------------------------------------------------------
  // initialize with repo (findActive path)
  // ---------------------------------------------------------------------------

  describe('initialize with repo', () => {
    it('should load policies via repo.findActive when repo exists', async () => {
      const mockDb: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'policy-repo-1',
                entity_type: 'alert',
                severity: 'critical',
                level: 1,
                timeout_minutes: 10,
                notify_users: '["u1"]',
                notify_channels: '["email"]',
                auto_action: null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          }),
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();

      // The repo path calls findActive which calls db.query with SELECT
      const selectQuery = mockDb.query.mock.calls.find(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('SELECT')
      );
      expect(selectQuery).toBeDefined();
      expect(selectQuery[0]).toContain('WHERE is_active = true');

      const policies = service.getPolicies('alert', 'critical');
      expect(policies).toHaveLength(1);
    });

    it('should clear cache before loading new policies', async () => {
      const mockDb: MockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      service = new EscalationConfigService(mockDb as any);

      // Pre-populate cache via createPolicy
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'critical', level: 1 }));
      expect(service.getAllPolicies()).toHaveLength(1);

      // Initialize should clear the cache (loadPolicies returns empty)
      await service.initialize();
      expect(service.getAllPolicies()).toHaveLength(0);
    });

    it('should handle loadPolicies error gracefully', async () => {
      const mockDb: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
          .mockRejectedValueOnce(new Error('Load failed')), // loadPolicies
      };
      service = new EscalationConfigService(mockDb as any);

      // Should not throw
      await service.initialize();
      expect(mockLoggerMethods.error).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationConfig] Failed to load'),
        expect.any(Error)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('Edge cases', () => {
    it('should handle multiple createPolicy calls with same entity type and different severities', async () => {
      service = new EscalationConfigService();

      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'critical', level: 1 }));
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'high', level: 1 }));
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'medium', level: 1 }));
      await service.createPolicy(makePolicy({ entityType: 'alert', severity: 'low', level: 1 }));

      expect(service.getAllPolicies()).toHaveLength(4);
      expect(service.getPolicies('alert', 'critical')).toHaveLength(1);
      expect(service.getPolicies('alert', 'high')).toHaveLength(1);
      expect(service.getPolicies('alert', 'medium')).toHaveLength(1);
      expect(service.getPolicies('alert', 'low')).toHaveLength(1);
    });

    it('should handle createPolicy with empty notifyUsers array', async () => {
      service = new EscalationConfigService();
      const policy = await service.createPolicy(makePolicy({
        notifyUsers: [],
        notifyChannels: [],
      }));

      expect(policy.notifyUsers).toEqual([]);
      expect(policy.notifyChannels).toEqual([]);
    });

    it('should handle getNextEscalation with undefined severity', async () => {
      service = new EscalationConfigService();
      await service.createPolicy(makePolicy({ entityType: 'incident', severity: undefined, level: 1 }));
      await service.createPolicy(makePolicy({ entityType: 'incident', severity: undefined, level: 2 }));

      const next = service.getNextEscalation('incident', undefined, 0);
      expect(next).not.toBeNull();
      expect(next!.level).toBe(1);
    });

    it('should return a shallow copy of global config', () => {
      service = new EscalationConfigService();
      const config1 = service.getGlobalConfig();
      const config2 = service.getGlobalConfig();

      // Top-level properties are independent copies
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);

      // Mutating top-level property on copy does not affect original
      config1.autoEscalationEnabled = false;
      expect(service.getGlobalConfig().autoEscalationEnabled).toBe(true);
    });

    it('should support deeply nested partial config update', () => {
      service = new EscalationConfigService();
      service.updateGlobalConfig({
        defaults: {
          alertTimeoutMinutes: 25,
          ticketSlaTimeoutMinutes: 120,
          incidentTimeoutMinutes: 30,
        },
      });

      const config = service.getGlobalConfig();
      expect(config.defaults.alertTimeoutMinutes).toBe(25);
      expect(config.defaults.ticketSlaTimeoutMinutes).toBe(120);
      expect(config.defaults.incidentTimeoutMinutes).toBe(30);
    });
  });
});
