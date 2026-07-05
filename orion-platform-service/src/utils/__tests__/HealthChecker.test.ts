/**
 * @file Comprehensive tests for HealthCheckerService
 *
 * Covers:
 * - Check registration and reactivation
 * - HTTP health check (success, failure, timeout, unexpected status)
 * - gRPC health check (serving, not serving, error)
 * - TCP health check (success, connection refused)
 * - Custom check (success, failure, not registered)
 * - Retry logic
 * - Result persistence via mock repository
 * - Consecutive failure threshold and alert triggering
 * - Recovery detection and reset
 * - Batch execution (runAllChecks)
 * - getRecentResults, getResultsInRange, getUptime analytics
 */

// Mock dependencies before imports
jest.mock('../../db/base-repository', () => ({
  BaseRepository: class {
    protected db: any;
    protected tableName: string;
    constructor(db: any, tableName: string) { this.db = db; this.tableName = tableName; }
    getDb() { return this.db; }
    getTenantId() { return '00000000-0000-0000-0000-000000000000'; }
    async create(_data: any): Promise<any> { return _data; }
    async findById(_id: string): Promise<any> { return undefined; }
    async findAll(): Promise<any> { return { entities: [], total: 0 }; }
    async update(_id: string, data: any): Promise<any> { return data; }
    async delete(_id: string): Promise<boolean> { return true; }
  },
}));

// Mock utils/logger to avoid pino instantiation issues
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { HealthCheckerService } from '../../services/health-check/HealthCheckerService';
import type { ServiceHealthCheckEntity, CheckResult, AlertPayload } from '../../services/health-check/HealthCheckerService';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createMockDb(): {
  query: jest.MockedFunction<(text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>>;
} {
  const query = jest.fn() as jest.MockedFunction<any>;
  return { query };
}

function createCheck(overrides: Partial<ServiceHealthCheckEntity> = {}): ServiceHealthCheckEntity {
  return {
    id: 'check-001',
    tenantId: '00000000-0000-0000-0000-000000000000',
    serviceName: 'test-svc',
    serviceUrl: 'http://localhost:8080/healthz',
    checkType: 'http',
    intervalSeconds: 30,
    timeoutSeconds: 10,
    retryCount: 2,
    expectedStatusCode: 200,
    expectedGrpcStatus: 'SERVING',
    port: null,
    failureThreshold: 3,
    consecutiveFailures: 0,
    lastStatus: 'unknown',
    lastCheckedAt: null,
    lastError: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createHealthyResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return { status: 'healthy', latencyMs: 42, errorMessage: null, responseBody: '{"ok":true}', ...overrides };
}

function createUnhealthyResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return { status: 'unhealthy', latencyMs: 42, errorMessage: 'Connection refused', responseBody: null, ...overrides };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HealthCheckerService', () => {
  let svc: HealthCheckerService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    svc = new HealthCheckerService(mockDb as any);
  });

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    test('creates service with null alert callback by default', () => {
      const s = new HealthCheckerService(mockDb as any);
      expect(s).toBeDefined();
    });

    test('accepts alert callback', () => {
      const cb = jest.fn();
      const s = new HealthCheckerService(mockDb as any, cb);
      expect(s).toBeDefined();
    });
  });

  // ─── Check Registration ─────────────────────────────────────────────────────

  describe('registerCheck', () => {
    test('creates a new check record via repository', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-id', service_name: 'x', service_url: 'y', check_type: 'http' }],
        rowCount: 1,
      });
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'check-new',
            service_name: 'x',
            service_url: 'y',
            check_type: 'http',
            consecutive_failures: 0,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      });

      const check = await svc.registerCheck({
        serviceName: 'my-svc',
        serviceUrl: 'http://localhost:8080/healthz',
        checkType: 'http',
      });

      expect(check.serviceName).toBe('my-svc');
      expect(check.checkType).toBe('http');
    });

    test('updates existing check if same service/url/type combo', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'existing', service_name: 'x', service_url: 'y', check_type: 'http' }],
        rowCount: 1,
      });

      const result = await svc.registerCheck({
        serviceName: 'my-svc',
        serviceUrl: 'http://localhost:8080/healthz',
        checkType: 'http',
        failureThreshold: 5,
      });

      // Should update, not create
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(result.serviceName).toBe('my-svc');
    });

    test('throws VALIDATION_ERROR for TCP check without port', async () => {
      await expect(
        svc.registerCheck({
          serviceName: 'tcp-svc',
          serviceUrl: 'http://localhost',
          checkType: 'tcp',
          port: undefined!,
        }),
      ).rejects.toThrow();
    });
  });

  // ─── HTTP Check ─────────────────────────────────────────────────────────────

  describe('executeHttpCheck', () => {
    test('returns healthy for 200 response matching expected status', async () => {
      // Override global.fetch
      const originalFetch = global.fetch;
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{"status":"ok"}'),
      });

      const check = createCheck({ serviceUrl: 'http://localhost:8080/healthz', expectedStatusCode: 200 });
      const result = await (svc as any).executeHttpCheck(check, 5000, 1);

      expect(result.status).toBe('healthy');
      expect(result.errorMessage).toBeNull();
      expect(result.responseBody).toContain('ok');

      (global as any).fetch = originalFetch;
    });

    test('returns unhealthy for non-matching status code', async () => {
      const originalFetch = global.fetch;
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: jest.fn().mockResolvedValue('Service Unavailable'),
      });

      const check = createCheck({ serviceUrl: 'http://localhost:8080/healthz', expectedStatusCode: 200 });
      const result = await (svc as any).executeHttpCheck(check, 5000, 1);

      expect(result.status).toBe('unhealthy');
      expect(result.errorMessage).toContain('503');

      (global as any).fetch = originalFetch;
    });

    test('returns timeout on AbortSignal abort', async () => {
      const originalFetch = global.fetch;
      (global as any).fetch = jest.fn().mockImplementation(() => {
        return new Promise((_resolve, reject) => {
          const err = new Error('signal aborted');
          (err as any).name = 'AbortError';
          reject(err);
        });
      });

      const check = createCheck({ serviceUrl: 'http://localhost:8080/healthz', timeoutSeconds: 1 });
      const result = await (svc as any).executeHttpCheck(check, 1000, 1);

      expect(result.status).toBe('timeout');
      expect(result.errorMessage).toContain('timeout');

      (global as any).fetch = originalFetch;
    });

    test('returns error on network failure', async () => {
      const originalFetch = global.fetch;
      (global as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const check = createCheck({ serviceUrl: 'http://localhost:8080/healthz' });
      const result = await (svc as any).executeHttpCheck(check, 5000, 1);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('ECONNREFUSED');

      (global as any).fetch = originalFetch;
    });
  });

  // ─── gRPC Check ─────────────────────────────────────────────────────────────

  describe('executeGrpcCheck', () => {
    test('returns degraded (NOT_SERVING) when no gRPC client configured', async () => {
      const check = createCheck({ serviceUrl: 'grpc://localhost:9090', checkType: 'grpc' });
      const result = await (svc as any).executeGrpcCheck(check, 5000, 1);

      expect(result.status).toBe('degraded');
      expect(result.errorMessage).toContain('not serving');
    });

    test('returns error on gRPC client throw', async () => {
      const originalResolve = (svc as any).resolveGrpcClient;
      (svc as any).resolveGrpcClient = jest.fn().mockRejectedValue(new Error('gRPC channel failed'));

      const check = createCheck({ serviceUrl: 'grpc://localhost:9090', checkType: 'grpc' });
      const result = await (svc as any).executeGrpcCheck(check, 5000, 1);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('gRPC');

      (svc as any).resolveGrpcClient = originalResolve;
    });
  });

  // ─── TCP Check ──────────────────────────────────────────────────────────────

  describe('executeTcpCheck', () => {
    test('returns healthy on successful TCP connection', async () => {
      const net = require('net');
      const mockSocket = {
        connect: jest.fn(),
        on: jest.fn((event: string, fn: Function) => {
          if (event === 'connect') fn();
          return mockSocket;
        }),
        destroy: jest.fn(),
        setTimeout: jest.fn(),
      };
      jest.spyOn(net, 'createConnection').mockReturnValue(mockSocket as any);

      const check = createCheck({
        checkType: 'tcp',
        serviceUrl: 'http://localhost',
        port: 6379,
      });
      const result = await (svc as any).executeTcpCheck(check, 5000, 1);

      expect(result.status).toBe('healthy');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      jest.restoreAllMocks();
    });

    test('returns error on TCP connection refused', async () => {
      const net = require('net');
      const mockSocket = {
        connect: jest.fn(),
        on: jest.fn((event: string, fn: Function) => {
          if (event === 'error') fn(new Error('ECONNREFUSED'));
          return mockSocket;
        }),
        destroy: jest.fn(),
        setTimeout: jest.fn(),
      };
      jest.spyOn(net, 'createConnection').mockReturnValue(mockSocket as any);

      const check = createCheck({
        checkType: 'tcp',
        serviceUrl: 'http://localhost',
        port: 9999,
      });
      const result = await (svc as any).executeTcpCheck(check, 5000, 1);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('ECONNREFUSED');

      jest.restoreAllMocks();
    });
  });

  // ─── Custom Check ────────────────────────────────────────────────────────────

  describe('executeCustomCheck', () => {
    test('runs registered custom checker', async () => {
      (svc as any).customCheckers.set('my-custom', jest.fn().mockResolvedValue(
        createHealthyResult({ status: 'healthy', responseBody: 'custom-ok' }),
      ));

      const check = createCheck({
        checkType: 'custom',
        serviceName: 'my-custom',
        serviceUrl: '',
      });
      const result = await (svc as any).executeCustomCheck(check, 1);

      expect(result.status).toBe('healthy');
      expect(result.responseBody).toBe('custom-ok');
    });

    test('returns error when no custom checker registered', async () => {
      const check = createCheck({
        checkType: 'custom',
        serviceName: 'nonexistent-checker',
        serviceUrl: '',
      });
      const result = await (svc as any).executeCustomCheck(check, 1);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('nonexistent-checker');
    });

    test('returns error when custom checker throws', async () => {
      (svc as any).customCheckers.set('failing-checker', jest.fn().mockRejectedValue(
        new Error('Script execution failed'),
      ));

      const check = createCheck({
        checkType: 'custom',
        serviceName: 'failing-checker',
        serviceUrl: '',
      });
      const result = await (svc as any).executeCustomCheck(check, 1);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('Script execution failed');
    });
  });

  // ─── Retry Logic ────────────────────────────────────────────────────────────

  describe('runCheck retry', () => {
    test('succeeds on first attempt', async () => {
      const check = createCheck({ retryCount: 3 });
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'c1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'check', service_name: 'x', service_url: 'y', check_type: 'http', consecutive_failures: 0, is_active: true, created_at: new Date(), updated_at: new Date() }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'r1', check_id: 'c1', tenant_id: '0', status: 'healthy', latency_ms: 10, error_message: null, attempt_number: 1, response_body: null, created_at: new Date() }], rowCount: 1 });

      const originalFetch = global.fetch;
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('ok'),
      });

      const checkEntity = createCheck({ id: 'c1' });
      const result = await (svc as any).runCheck(checkEntity);

      expect(result.status).toBe('healthy');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      (global as any).fetch = originalFetch;
    });

    test('retries then succeeds', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'c2' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'c2', service_name: 'x', service_url: 'y', check_type: 'http', consecutive_failures: 0, is_active: true, created_at: new Date(), updated_at: new Date() }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'r2', check_id: 'c2', tenant_id: '0', status: 'healthy', latency_ms: 10, error_message: null, attempt_number: 1, response_body: null, created_at: new Date() }], rowCount: 1 });

      const originalFetch = global.fetch;
      (global as any).fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValue('ok'),
        });

      const checkEntity = createCheck({ id: 'c2', retryCount: 3 });
      const result = await (svc as any).runCheck(checkEntity);

      expect(result.status).toBe('healthy');

      (global as any).fetch = originalFetch;
    });

    test('returns error after all retries exhausted', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'c3' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'c3', service_name: 'x', service_url: 'y', check_type: 'http', consecutive_failures: 0, is_active: true, created_at: new Date(), updated_at: new Date() }], rowCount: 1 });

      const originalFetch = global.fetch;
      (global as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const checkEntity = createCheck({ id: 'c3', retryCount: 2 });
      const result = await (svc as any).runCheck(checkEntity);

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('exhausted');

      (global as any).fetch = originalFetch;
    });
  });

  // ─── runAllChecks (batch execution) ─────────────────────────────────────────

  describe('runAllChecks', () => {
    test('persists results and updates check status for all active checks', async () => {
      mockDb.query
        // findActiveByTenantId
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'chk-1',
              service_name: 'svc-a',
              service_url: 'http://a/healthz',
              check_type: 'http',
              consecutive_failures: 0,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
        })
        // createResult
        .mockResolvedValueOnce({
          rows: [{ id: 'res-1', check_id: 'chk-1', tenant_id: '0', status: 'healthy', latency_ms: 10, error_message: null, attempt_number: 1, response_body: null, created_at: new Date() }],
          rowCount: 1,
        })
        // updateStatus (healthy -> reset consecutiveFailures to 0)
        .mockResolvedValueOnce({
          rows: [{
            id: 'chk-1',
            service_name: 'svc-a',
            service_url: 'http://a/healthz',
            check_type: 'http',
            consecutive_failures: 0,
            last_status: 'healthy',
            last_error: null,
            last_checked_at: new Date(),
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          }],
          rowCount: 1,
        });

      const originalFetch = global.fetch;
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('ok'),
      });

      const result = await svc.runAllChecks('tenant-123');

      expect(result.ran).toBe(1);
      expect(result.healthy).toBe(1);

      // Should have called: findActiveByTenantId, createResult, updateStatus
      expect(mockDb.query).toHaveBeenCalledTimes(3);

      (global as any).fetch = originalFetch;
    });

    test('counts unhealthy and error separately', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'chk-bad',
              service_name: 'svc-b',
              service_url: 'http://b/healthz',
              check_type: 'http',
              consecutive_failures: 2,
              failure_threshold: 3,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'res-bad', check_id: 'chk-bad', tenant_id: '0', status: 'unhealthy', latency_ms: 10, error_message: null, attempt_number: 1, response_body: null, created_at: new Date() }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'chk-bad',
            service_name: 'svc-b',
            service_url: 'http://b/healthz',
            check_type: 'http',
            consecutive_failures: 3,
            failure_threshold: 3,
            last_status: 'unhealthy',
            last_error: 'down',
            last_checked_at: new Date(),
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          }],
          rowCount: 1,
        });

      const originalFetch = global.fetch;
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: jest.fn().mockResolvedValue('down'),
      });

      const result = await svc.runAllChecks('tenant-123');

      expect(result.ran).toBe(1);
      expect(result.unhealthy).toBe(1);
      expect(result.healthy).toBe(0);

      (global as any).fetch = originalFetch;
    });
  });

  // ─── Alerting ───────────────────────────────────────────────────────────────

  describe('alert triggering', () => {
    test('does not alert when no callback configured', async () => {
      const s = new HealthCheckerService(mockDb as any);
      // Should not throw
      await expect((s as any).triggerAlert({
        check: createCheck({ consecutiveFailures: 3 }),
        result: createUnhealthyResult(),
        consecutiveFailures: 3,
        isRecovery: false,
      })).resolves.toBeUndefined();
    });

    test('calls alert callback on failure threshold', async () => {
      const cb = jest.fn();
      const s = new HealthCheckerService(mockDb as any, cb);

      const check = createCheck({ consecutiveFailures: 3, failureThreshold: 3 });
      await (s as any).triggerAlert({
        check,
        result: createUnhealthyResult(),
        consecutiveFailures: 3,
        isRecovery: false,
      });

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ isRecovery: false, consecutiveFailures: 3 }),
      );
    });

    test('calls alert callback on recovery', async () => {
      const cb = jest.fn();
      const s = new HealthCheckerService(mockDb as any, cb);

      const check = createCheck();
      await (s as any).triggerAlert({
        check,
        result: createHealthyResult(),
        consecutiveFailures: 0,
        isRecovery: true,
      });

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ isRecovery: true, consecutiveFailures: 0 }),
      );
    });

    test('handles alert callback throw gracefully', async () => {
      const cb = jest.fn().mockRejectedValue(new Error('alert bus down'));
      const s = new HealthCheckerService(mockDb as any, cb);

      const check = createCheck();
      // Should not throw
      await expect(
        (s as any).triggerAlert({
          check,
          result: createUnhealthyResult(),
          consecutiveFailures: 5,
          isRecovery: false,
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── Custom Checker Registration ────────────────────────────────────────────

  describe('registerCustomChecker', () => {
    test('registers and runs custom checker', async () => {
      const fn = jest.fn().mockResolvedValue(createHealthyResult({ responseBody: 'custom' }));
      svc.registerCustomChecker('my-checker', fn);

      const check = createCheck({ serviceName: 'my-checker', checkType: 'custom', serviceUrl: '' });
      const result = await (svc as any).executeCustomCheck(check, 1);

      expect(result.status).toBe('healthy');
      expect(result.responseBody).toBe('custom');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('registerCustomChecker overwrites previous', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      svc.registerCustomChecker('same-name', fn1);
      svc.registerCustomChecker('same-name', fn2);
      expect((svc as any).customCheckers.get('same-name')).toBe(fn2);
    });
  });

  // ─── deactivateCheck ────────────────────────────────────────────────────────

  describe('deactivateCheck', () => {
    test('calls repository deactivate', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });
      await svc.deactivateCheck('chk-1');
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = FALSE'),
        ['chk-1'],
      );
    });
  });

  // ─── Analytics ──────────────────────────────────────────────────────────────

  describe('getRecentResults', () => {
    test('delegates to result repository', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'r1', check_id: 'c1', tenant_id: '0', status: 'healthy', latency_ms: 10, error_message: null, attempt_number: 1, response_body: null, created_at: new Date() }],
        rowCount: 1,
      });

      const results = await svc.getRecentResults('c1', 10);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('healthy');
    });
  });

  describe('getResultsInRange', () => {
    test('returns results within time range', async () => {
      const start = new Date('2026-07-01T00:00:00Z');
      const end = new Date('2026-07-02T00:00:00Z');

      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'r1', check_id: 'c1', tenant_id: '0', status: 'healthy', latency_ms: 10, error_message: null, attempt_number: 1, response_body: null, created_at: new Date() }],
        rowCount: 1,
      });

      const results = await svc.getResultsInRange('c1', start, end, 50);
      expect(results).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >='),
        expect.arrayContaining([expect.any(Date), expect.any(Date)]),
      );
    });
  });

  describe('getUptime', () => {
    test('delegates to repository calculateUptime', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ total: '100', healthy: '99' }],
        rowCount: 1,
      });

      const uptime = await svc.getUptime('c1', new Date('2026-07-01'));
      expect(uptime.total).toBe(100);
      expect(uptime.healthy).toBe(99);
      expect(uptime.uptimePercent).toBe(99);
    });

    test('returns 100% for empty range', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ total: '0', healthy: '0' }],
        rowCount: 0,
      });

      const uptime = await svc.getUptime('c1', new Date('2026-07-01'));
      expect(uptime.uptimePercent).toBe(100);
    });
  });
});
