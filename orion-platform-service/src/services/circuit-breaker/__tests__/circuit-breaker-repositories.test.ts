/**
 * Circuit Breaker Repositories - Direct Unit Tests
 *
 * Covers:
 * - CircuitBreakerConfigRepository: findByTargetKey, findEnabled, upsertByTargetKey, mapRowToEntity
 * - CircuitBreakerStateRepository: findByTargetKey, findByState, findAll, upsertState, resetState, mapRowToEntity
 * - CircuitBreakerEventRepository: logEvent, findByTargetKey, countByEventType, mapRowToEntity
 */

import {
  CircuitBreakerConfigRepository,
  CircuitBreakerStateRepository,
  CircuitBreakerEventRepository,
} from '../circuit-breaker-repositories';

// ─── Mock DB Factory ────────────────────────────────────────────────────────

function createMockDb() {
  return {
    query: jest.fn(),
  };
}

// ─── Sample Rows ────────────────────────────────────────────────────────────

function makeConfigRow(overrides: Record<string, any> = {}) {
  return {
    id: 'cfg-1',
    target_key: 'scm:github',
    description: 'GitHub circuit breaker',
    failure_threshold: 5,
    recovery_timeout_ms: 30000,
    success_threshold: 2,
    enabled: true,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
    ...overrides,
  };
}

function makeStateRow(overrides: Record<string, any> = {}) {
  return {
    id: 'state-1',
    target_key: 'scm:github',
    state: 'closed',
    failure_count: 0,
    success_count: 10,
    last_failure_time: null,
    last_success_time: new Date('2026-01-01'),
    last_state_change: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeEventRow(overrides: Record<string, any> = {}) {
  return {
    id: 'evt-1',
    target_key: 'scm:github',
    event_type: 'state_change',
    from_state: 'closed',
    to_state: 'open',
    failure_count: 5,
    success_count: 0,
    message: 'Circuit closed -> open',
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CircuitBreakerConfigRepository
// ═══════════════════════════════════════════════════════════════════════════

describe('CircuitBreakerConfigRepository', () => {
  let db: ReturnType<typeof createMockDb>;
  let repo: CircuitBreakerConfigRepository;

  beforeEach(() => {
    db = createMockDb();
    repo = new CircuitBreakerConfigRepository(db as any);
  });

  // ─── findByTargetKey ─────────────────────────────────────────────────────

  describe('findByTargetKey', () => {
    it('should return mapped entity when found', async () => {
      db.query.mockResolvedValue({ rows: [makeConfigRow()], rowCount: 1 });

      const result = await repo.findByTargetKey('scm:github');

      expect(result).not.toBeNull();
      expect(result!.targetKey).toBe('scm:github');
      expect(result!.failureThreshold).toBe(5);
      expect(result!.recoveryTimeoutMs).toBe(30000);
      expect(result!.successThreshold).toBe(2);
      expect(result!.enabled).toBe(true);
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findByTargetKey('nonexistent');

      expect(result).toBeNull();
    });

    it('should pass targetKey as query parameter', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findByTargetKey('registry:docker');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE target_key = $1'),
        ['registry:docker'],
      );
    });

    it('should map all fields correctly', async () => {
      const row = makeConfigRow({
        id: 'cfg-99',
        target_key: 'k8s:api',
        description: 'K8s API breaker',
        failure_threshold: 3,
        recovery_timeout_ms: 60000,
        success_threshold: 1,
        enabled: false,
        created_at: new Date('2026-06-01'),
        updated_at: new Date('2026-06-02'),
      });
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.findByTargetKey('k8s:api');

      expect(result!.id).toBe('cfg-99');
      expect(result!.targetKey).toBe('k8s:api');
      expect(result!.description).toBe('K8s API breaker');
      expect(result!.failureThreshold).toBe(3);
      expect(result!.recoveryTimeoutMs).toBe(60000);
      expect(result!.successThreshold).toBe(1);
      expect(result!.enabled).toBe(false);
    });

    it('should handle null description', async () => {
      db.query.mockResolvedValue({ rows: [makeConfigRow({ description: null })], rowCount: 1 });

      const result = await repo.findByTargetKey('scm:github');

      expect(result!.description).toBeNull();
    });
  });

  // ─── findEnabled ─────────────────────────────────────────────────────────

  describe('findEnabled', () => {
    it('should return all enabled configs', async () => {
      db.query.mockResolvedValue({
        rows: [
          makeConfigRow({ id: '1', target_key: 'scm:github' }),
          makeConfigRow({ id: '2', target_key: 'registry:docker' }),
        ],
        rowCount: 2,
      });

      const result = await repo.findEnabled();

      expect(result).toHaveLength(2);
      expect(result[0].targetKey).toBe('scm:github');
      expect(result[1].targetKey).toBe('registry:docker');
    });

    it('should return empty array when no enabled configs', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findEnabled();

      expect(result).toEqual([]);
    });

    it('should query with enabled = true filter', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findEnabled();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE enabled = true'),
      );
    });

    it('should order by created_at DESC', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findEnabled();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
      );
    });
  });

  // ─── upsertByTargetKey ───────────────────────────────────────────────────

  describe('upsertByTargetKey', () => {
    it('should upsert with all config fields', async () => {
      const row = makeConfigRow({
        target_key: 'scm:github',
        description: 'Updated',
        failure_threshold: 10,
        recovery_timeout_ms: 120000,
        success_threshold: 3,
        enabled: true,
      });
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.upsertByTargetKey('scm:github', {
        description: 'Updated',
        failureThreshold: 10,
        recoveryTimeoutMs: 120000,
        successThreshold: 3,
        enabled: true,
      });

      expect(result.targetKey).toBe('scm:github');
      expect(result.failureThreshold).toBe(10);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO circuit_breaker_configs'),
        ['scm:github', 'Updated', 10, 120000, 3, true],
      );
    });

    it('should use default values when not provided', async () => {
      db.query.mockResolvedValue({ rows: [makeConfigRow()], rowCount: 1 });

      await repo.upsertByTargetKey('scm:github', {});

      const params = db.query.mock.calls[0][1];
      expect(params[1]).toBeNull(); // description
      expect(params[2]).toBe(5); // failureThreshold default
      expect(params[3]).toBe(60000); // recoveryTimeoutMs default
      expect(params[4]).toBe(1); // successThreshold default
      expect(params[5]).toBe(true); // enabled default
    });

    it('should use ON CONFLICT clause for upsert', async () => {
      db.query.mockResolvedValue({ rows: [makeConfigRow()], rowCount: 1 });

      await repo.upsertByTargetKey('scm:github', {});

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('ON CONFLICT');
      expect(query).toContain('DO UPDATE SET');
      expect(query).toContain('RETURNING *');
    });

    it('should return mapped entity from result', async () => {
      const row = makeConfigRow({ id: 'new-cfg', target_key: 'notification:slack' });
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.upsertByTargetKey('notification:slack', {
        description: 'Slack breaker',
      });

      expect(result.id).toBe('new-cfg');
      expect(result.targetKey).toBe('notification:slack');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CircuitBreakerStateRepository
// ═══════════════════════════════════════════════════════════════════════════

describe('CircuitBreakerStateRepository', () => {
  let db: ReturnType<typeof createMockDb>;
  let repo: CircuitBreakerStateRepository;

  beforeEach(() => {
    db = createMockDb();
    repo = new CircuitBreakerStateRepository(db as any);
  });

  // ─── findByTargetKey ─────────────────────────────────────────────────────

  describe('findByTargetKey', () => {
    it('should return mapped state entity when found', async () => {
      db.query.mockResolvedValue({ rows: [makeStateRow()], rowCount: 1 });

      const result = await repo.findByTargetKey('scm:github');

      expect(result).not.toBeNull();
      expect(result!.targetKey).toBe('scm:github');
      expect(result!.state).toBe('closed');
      expect(result!.failureCount).toBe(0);
      expect(result!.successCount).toBe(10);
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findByTargetKey('nonexistent');

      expect(result).toBeNull();
    });

    it('should map all state fields correctly', async () => {
      const row = makeStateRow({
        id: 'st-2',
        target_key: 'registry:docker',
        state: 'open',
        failure_count: 5,
        success_count: 0,
        last_failure_time: new Date('2026-06-01'),
        last_success_time: null,
        last_state_change: new Date('2026-06-01'),
        updated_at: new Date('2026-06-01'),
      });
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.findByTargetKey('registry:docker');

      expect(result!.state).toBe('open');
      expect(result!.failureCount).toBe(5);
      expect(result!.successCount).toBe(0);
      expect(result!.lastFailureTime).toEqual(new Date('2026-06-01'));
      expect(result!.lastSuccessTime).toBeNull();
    });
  });

  // ─── findByState ─────────────────────────────────────────────────────────

  describe('findByState', () => {
    it('should return states matching the given state', async () => {
      db.query.mockResolvedValue({
        rows: [
          makeStateRow({ id: '1', target_key: 'a:1', state: 'open' }),
          makeStateRow({ id: '2', target_key: 'b:2', state: 'open' }),
        ],
        rowCount: 2,
      });

      const result = await repo.findByState('open');

      expect(result).toHaveLength(2);
      expect(result[0].state).toBe('open');
      expect(result[1].state).toBe('open');
    });

    it('should return empty array when no states match', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findByState('half-open');

      expect(result).toEqual([]);
    });

    it('should query with correct state parameter', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findByState('closed');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE state = $1'),
        ['closed'],
      );
    });

    it('should order by last_state_change DESC', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findByState('open');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY last_state_change DESC'),
        expect.any(Array),
      );
    });
  });

  // ─── findAll (override) ──────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all states without options', async () => {
      db.query.mockResolvedValue({
        rows: [
          makeStateRow({ id: '1', target_key: 'a:1' }),
          makeStateRow({ id: '2', target_key: 'b:2' }),
        ],
        rowCount: 2,
      });

      const result = await repo.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect((result as any[])).toHaveLength(2);
    });

    it('should return entities and total when called with options', async () => {
      db.query.mockResolvedValue({
        rows: [makeStateRow({ id: '1', target_key: 'a:1' })],
        rowCount: 1,
      });

      const result = await repo.findAll({ where: { state: 'open' } });

      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('total');
      expect((result as any).entities).toHaveLength(1);
    });

    it('should build WHERE clause from options.where', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findAll({ where: { state: 'open' } });

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('WHERE');
      expect(query).toContain('state = $1');
    });

    it('should add LIMIT and OFFSET when provided', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findAll({ limit: 10, offset: 20 });

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('LIMIT 10');
      expect(query).toContain('OFFSET 20');
    });

    it('should order by target_key', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findAll();

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('ORDER BY target_key');
    });

    it('should handle empty where clause', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findAll({ where: {} });

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('SELECT * FROM circuit_breaker_states');
      expect(query).not.toContain('WHERE 1=1 AND');
    });

    it('should handle multiple where conditions', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findAll({ where: { state: 'open', target_key: 'scm:github' } });

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('WHERE');
      expect(query).toContain('AND');
    });
  });

  // ─── upsertState ─────────────────────────────────────────────────────────

  describe('upsertState', () => {
    it('should upsert state with all parameters', async () => {
      const row = makeStateRow({
        target_key: 'scm:github',
        state: 'open',
        failure_count: 5,
        success_count: 0,
        last_failure_time: new Date('2026-06-01'),
        last_success_time: null,
      });
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const lastFailure = new Date('2026-06-01');
      const result = await repo.upsertState('scm:github', 'open', 5, 0, lastFailure, null);

      expect(result.targetKey).toBe('scm:github');
      expect(result.state).toBe('open');
      expect(result.failureCount).toBe(5);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO circuit_breaker_states'),
        ['scm:github', 'open', 5, 0, lastFailure, null],
      );
    });

    it('should use ON CONFLICT for upsert', async () => {
      db.query.mockResolvedValue({ rows: [makeStateRow()], rowCount: 1 });

      await repo.upsertState('scm:github', 'closed', 0, 0, null, null);

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('ON CONFLICT');
      expect(query).toContain('DO UPDATE SET');
      expect(query).toContain('RETURNING *');
    });

    it('should handle null timestamps', async () => {
      db.query.mockResolvedValue({ rows: [makeStateRow()], rowCount: 1 });

      await repo.upsertState('scm:github', 'closed', 0, 0, null, null);

      const params = db.query.mock.calls[0][1];
      expect(params[4]).toBeNull(); // last_failure_time
      expect(params[5]).toBeNull(); // last_success_time
    });

    it('should return mapped entity', async () => {
      const row = makeStateRow({ state: 'half-open', failure_count: 2, success_count: 1 });
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.upsertState('scm:github', 'half-open', 2, 1, null, null);

      expect(result.state).toBe('half-open');
      expect(result.failureCount).toBe(2);
      expect(result.successCount).toBe(1);
    });
  });

  // ─── resetState ──────────────────────────────────────────────────────────

  describe('resetState', () => {
    it('should reset existing state to closed', async () => {
      const row = makeStateRow({
        state: 'closed',
        failure_count: 0,
        success_count: 0,
        last_failure_time: null,
        last_success_time: null,
      });
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.resetState('scm:github');

      expect(result.state).toBe('closed');
      expect(result.failureCount).toBe(0);
      expect(result.successCount).toBe(0);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE circuit_breaker_states'),
        ['scm:github'],
      );
    });

    it('should fall back to upsertState when no existing row', async () => {
      // First call (UPDATE) returns no rows
      db.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // Second call (INSERT upsert) returns new row
        .mockResolvedValueOnce({ rows: [makeStateRow({ state: 'closed' })], rowCount: 1 });

      const result = await repo.resetState('new:target');

      expect(result.state).toBe('closed');
      expect(db.query).toHaveBeenCalledTimes(2);
      // First call is UPDATE
      expect(db.query.mock.calls[0][0]).toContain('UPDATE circuit_breaker_states');
      // Second call is INSERT (upsert)
      expect(db.query.mock.calls[1][0]).toContain('INSERT INTO circuit_breaker_states');
    });

    it('should use WHERE target_key = $1 in update', async () => {
      db.query.mockResolvedValue({ rows: [makeStateRow()], rowCount: 1 });

      await repo.resetState('k8s:api');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE target_key = $1'),
        ['k8s:api'],
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CircuitBreakerEventRepository
// ═══════════════════════════════════════════════════════════════════════════

describe('CircuitBreakerEventRepository', () => {
  let db: ReturnType<typeof createMockDb>;
  let repo: CircuitBreakerEventRepository;

  beforeEach(() => {
    db = createMockDb();
    repo = new CircuitBreakerEventRepository(db as any);
  });

  // ─── logEvent ────────────────────────────────────────────────────────────

  describe('logEvent', () => {
    it('should log event with all options', async () => {
      const row = makeEventRow();
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.logEvent('scm:github', 'state_change', {
        fromState: 'closed',
        toState: 'open',
        failureCount: 5,
        successCount: 0,
        message: 'Circuit closed -> open',
      });

      expect(result.targetKey).toBe('scm:github');
      expect(result.eventType).toBe('state_change');
      expect(result.fromState).toBe('closed');
      expect(result.toState).toBe('open');
      expect(result.failureCount).toBe(5);
      expect(result.successCount).toBe(0);
      expect(result.message).toBe('Circuit closed -> open');
    });

    it('should default all options to null when not provided', async () => {
      db.query.mockResolvedValue({ rows: [makeEventRow()], rowCount: 1 });

      await repo.logEvent('scm:github', 'failure');

      const params = db.query.mock.calls[0][1];
      expect(params[2]).toBeNull(); // fromState
      expect(params[3]).toBeNull(); // toState
      expect(params[4]).toBeNull(); // failureCount
      expect(params[5]).toBeNull(); // successCount
      expect(params[6]).toBeNull(); // message
    });

    it('should support all event types', async () => {
      const eventTypes = ['state_change', 'failure', 'success', 'manual_trip', 'manual_reset', 'config_change'] as const;

      for (const eventType of eventTypes) {
        db.query.mockResolvedValue({ rows: [makeEventRow({ event_type: eventType })], rowCount: 1 });

        const result = await repo.logEvent('test:key', eventType);
        expect(result.eventType).toBe(eventType);
      }

      expect(db.query).toHaveBeenCalledTimes(eventTypes.length);
    });

    it('should pass correct SQL parameters', async () => {
      db.query.mockResolvedValue({ rows: [makeEventRow()], rowCount: 1 });

      await repo.logEvent('k8s:api', 'manual_trip', {
        fromState: 'closed',
        toState: 'open',
        failureCount: 3,
        successCount: 1,
        message: 'Manual trip',
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO circuit_breaker_events'),
        ['k8s:api', 'manual_trip', 'closed', 'open', 3, 1, 'Manual trip'],
      );
    });

    it('should return mapped entity', async () => {
      const row = makeEventRow({
        id: 'evt-99',
        target_key: 'notification:slack',
        event_type: 'success',
        from_state: 'half-open',
        to_state: 'closed',
        failure_count: 0,
        success_count: 2,
        message: 'Recovered',
        created_at: new Date('2026-06-01'),
      });
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.logEvent('notification:slack', 'success');

      expect(result.id).toBe('evt-99');
      expect(result.targetKey).toBe('notification:slack');
      expect(result.eventType).toBe('success');
      expect(result.fromState).toBe('half-open');
      expect(result.toState).toBe('closed');
      expect(result.message).toBe('Recovered');
    });
  });

  // ─── findByTargetKey ─────────────────────────────────────────────────────

  describe('findByTargetKey', () => {
    it('should return events for target key', async () => {
      db.query.mockResolvedValue({
        rows: [
          makeEventRow({ id: '1', event_type: 'failure' }),
          makeEventRow({ id: '2', event_type: 'success' }),
        ],
        rowCount: 2,
      });

      const result = await repo.findByTargetKey('scm:github');

      expect(result).toHaveLength(2);
    });

    it('should use default limit of 50', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findByTargetKey('scm:github');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['scm:github', 50],
      );
    });

    it('should support custom limit', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findByTargetKey('scm:github', 100);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['scm:github', 100],
      );
    });

    it('should order by created_at DESC', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findByTargetKey('scm:github');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array),
      );
    });

    it('should return empty array when no events', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findByTargetKey('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ─── countByEventType ────────────────────────────────────────────────────

  describe('countByEventType', () => {
    it('should return count for event type', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '42' }], rowCount: 1 });

      const result = await repo.countByEventType('failure');

      expect(result).toBe(42);
    });

    it('should return 0 when no events', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '0' }], rowCount: 1 });

      const result = await repo.countByEventType('success');

      expect(result).toBe(0);
    });

    it('should add since filter when provided', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '5' }], rowCount: 1 });

      const since = new Date('2026-01-01');
      const result = await repo.countByEventType('failure', since);

      expect(result).toBe(5);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND created_at >= $2'),
        ['failure', since],
      );
    });

    it('should not add since filter when not provided', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '10' }], rowCount: 1 });

      await repo.countByEventType('state_change');

      const query = db.query.mock.calls[0][0] as string;
      expect(query).not.toContain('created_at >= $2');
      expect(query).toContain('WHERE event_type = $1');
    });

    it('should handle all event types', async () => {
      const eventTypes = ['state_change', 'failure', 'success', 'manual_trip', 'manual_reset', 'config_change'] as const;

      for (const eventType of eventTypes) {
        db.query.mockResolvedValue({ rows: [{ count: '1' }], rowCount: 1 });
        const result = await repo.countByEventType(eventType);
        expect(result).toBe(1);
      }

      expect(db.query).toHaveBeenCalledTimes(eventTypes.length);
    });

    it('should handle parseInt for count string', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '123' }], rowCount: 1 });

      const result = await repo.countByEventType('failure');

      expect(result).toBe(123);
    });

    it('should handle missing count field', async () => {
      db.query.mockResolvedValue({ rows: [{}], rowCount: 1 });

      const result = await repo.countByEventType('failure');

      expect(result).toBe(0); // parseInt(undefined || '0', 10) = 0
    });
  });
});
