/**
 * PipelineCircuitBreaker - Comprehensive Tests
 *
 * Tests for pipeline circuit breaker integration, target key constants,
 * default configs, execute/getState/getAllStates, and fallback behavior.
 */

import { PipelineCircuitBreaker, PIPELINE_CB_TARGETS, PIPELINE_CB_DEFAULTS } from '../pipeline-circuit-breaker';
import { CircuitBreakerService } from '../circuit-breaker-service';
import {
  CircuitBreakerConfigRepository,
  CircuitBreakerStateRepository,
  CircuitBreakerEventRepository,
} from '../circuit-breaker-repositories';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../index', () => {
  let cbService: any = null;
  return {
    getCircuitBreakerService: () => cbService,
    __setMockService: (svc: any) => { cbService = svc; },
    __clearMockService: () => { cbService = null; },
  };
});

function createMockDb() {
  const tables = new Map<string, any[]>();
  return {
    tables,
    query: async (text: string, params?: unknown[]) => {
      if (text.includes('INSERT') && text.includes('RETURNING')) {
        const tableName = text.match(/INTO (\w+)/)?.[1];
        const targetKey = params?.[0];
        const row: any = {
          id: `mock-${Date.now()}`,
          target_key: targetKey,
          description: params?.[1],
          failure_threshold: params?.[2] ?? 5,
          recovery_timeout_ms: params?.[3] ?? 60000,
          success_threshold: params?.[4] ?? 1,
          enabled: params?.[5] ?? true,
          created_at: new Date(),
          updated_at: new Date(),
        };
        if (tableName) {
          const existing = tables.get(tableName) || [];
          const idx = existing.findIndex((r: any) => r.target_key === targetKey);
          if (idx >= 0) existing[idx] = row;
          else existing.push(row);
          tables.set(tableName, existing);
        }
        return { rows: [row], rowCount: 1 };
      }
      if (text.includes('SELECT') && text.includes('circuit_breaker_configs')) {
        const rows = tables.get('circuit_breaker_configs') || [];
        return { rows, rowCount: rows.length };
      }
      if (text.includes('SELECT') && text.includes('circuit_breaker_states')) {
        return { rows: tables.get('circuit_breaker_states') || [], rowCount: 0 };
      }
      if (text.includes('SELECT') && text.includes('circuit_breaker_events')) {
        return { rows: tables.get('circuit_breaker_events') || [], rowCount: 0 };
      }
      if (text.includes('INSERT') && text.includes('circuit_breaker_events')) {
        const row = { id: `evt-${Date.now()}`, target_key: params?.[0], event_type: params?.[1], created_at: new Date() };
        const existing = tables.get('circuit_breaker_events') || [];
        existing.push(row);
        tables.set('circuit_breaker_events', existing);
        return { rows: [row], rowCount: 1 };
      }
      if (text.includes('UPDATE') || text.includes('INSERT')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

function createCircuitBreakerService() {
  const mockDb = createMockDb();
  const configRepo = new CircuitBreakerConfigRepository(mockDb);
  const stateRepo = new CircuitBreakerStateRepository(mockDb);
  const eventRepo = new CircuitBreakerEventRepository(mockDb);
  return new CircuitBreakerService(configRepo, stateRepo, eventRepo);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PipelineCircuitBreaker', () => {
  let pcb: PipelineCircuitBreaker;
  const mockModule = require('../index');

  beforeEach(() => {
    pcb = new PipelineCircuitBreaker();
    mockModule.__clearMockService();
  });

  // ─── Target Key Constants ────────────────────────────────────────────────

  describe('PIPELINE_CB_TARGETS', () => {
    it('should define SCM target keys', () => {
      expect(PIPELINE_CB_TARGETS.scmGitHub).toBe('scm:github');
      expect(PIPELINE_CB_TARGETS.scmGitLab).toBe('scm:gitlab');
      expect(PIPELINE_CB_TARGETS.scmBitbucket).toBe('scm:bitbucket');
    });

    it('should define registry target keys', () => {
      expect(PIPELINE_CB_TARGETS.dockerRegistry).toBe('registry:docker');
      expect(PIPELINE_CB_TARGETS.harborRegistry).toBe('registry:harbor');
    });

    it('should define notification target keys', () => {
      expect(PIPELINE_CB_TARGETS.notificationSlack).toBe('notification:slack');
      expect(PIPELINE_CB_TARGETS.notificationDingTalk).toBe('notification:dingtalk');
      expect(PIPELINE_CB_TARGETS.notificationWeCom).toBe('notification:wecom');
    });

    it('should define k8s and artifact target keys', () => {
      expect(PIPELINE_CB_TARGETS.k8sAPI).toBe('k8s:api');
      expect(PIPELINE_CB_TARGETS.artifactStorage).toBe('artifact:storage');
    });
  });

  // ─── Default Configs ─────────────────────────────────────────────────────

  describe('PIPELINE_CB_DEFAULTS', () => {
    it('should have defaults for SCM GitHub', () => {
      const config = PIPELINE_CB_DEFAULTS['scm:github'];
      expect(config).toBeDefined();
      expect(config.failureThreshold).toBe(5);
      expect(config.recoveryTimeoutMs).toBe(30000);
      expect(config.successThreshold).toBe(2);
    });

    it('should have defaults for Docker Registry with stricter threshold', () => {
      const config = PIPELINE_CB_DEFAULTS['registry:docker'];
      expect(config).toBeDefined();
      expect(config.failureThreshold).toBe(3);
      expect(config.recoveryTimeoutMs).toBe(60000);
    });

    it('should have defaults for notification services', () => {
      const config = PIPELINE_CB_DEFAULTS['notification:slack'];
      expect(config).toBeDefined();
      expect(config.failureThreshold).toBe(5);
    });

    it('should have defaults for K8s API', () => {
      const config = PIPELINE_CB_DEFAULTS['k8s:api'];
      expect(config).toBeDefined();
      expect(config.failureThreshold).toBe(3);
      expect(config.recoveryTimeoutMs).toBe(60000);
    });
  });

  // ─── execute (no service) ────────────────────────────────────────────────

  describe('execute without CB service', () => {
    it('should fallback to direct execution when no CB service', async () => {
      const result = await pcb.execute('scm', 'github', async () => 'direct-result');
      expect(result).toBe('direct-result');
    });

    it('should propagate errors when no CB service', async () => {
      await expect(
        pcb.execute('scm', 'github', async () => { throw new Error('fail'); })
      ).rejects.toThrow('fail');
    });
  });

  // ─── execute (with service) ──────────────────────────────────────────────

  describe('execute with CB service', () => {
    it('should execute through circuit breaker when service available', async () => {
      const cbService = createCircuitBreakerService();
      mockModule.__setMockService(cbService);

      const result = await pcb.execute('scm', 'github', async () => 'cb-result');
      expect(result).toBe('cb-result');
    });

    it('should propagate circuit breaker errors', async () => {
      const cbService = createCircuitBreakerService();
      mockModule.__setMockService(cbService);

      await expect(
        pcb.execute('scm', 'github', async () => { throw new Error('cb-fail'); })
      ).rejects.toThrow('cb-fail');
    });

    it('should open circuit after repeated failures', async () => {
      const cbService = createCircuitBreakerService();
      mockModule.__setMockService(cbService);

      const targetKey = 'scm:github';
      await cbService.register(targetKey, { failureThreshold: 2, recoveryTimeoutMs: 10000 });

      for (let i = 0; i < 2; i++) {
        try {
          await pcb.execute('scm', 'github', async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }

      // Circuit should be open now
      await expect(
        pcb.execute('scm', 'github', async () => 'should-not-reach')
      ).rejects.toThrow();
    });
  });

  // ─── getState ────────────────────────────────────────────────────────────

  describe('getState', () => {
    it('should return null when no CB service', async () => {
      const state = await pcb.getState('scm', 'github');
      expect(state).toBeNull();
    });

    it('should return null when target not registered', async () => {
      const cbService = createCircuitBreakerService();
      mockModule.__setMockService(cbService);

      const state = await pcb.getState('scm', 'github');
      expect(state).toBeNull();
    });

    it('should return state when target is registered', async () => {
      const cbService = createCircuitBreakerService();
      mockModule.__setMockService(cbService);

      await cbService.register('scm:github', { failureThreshold: 5, recoveryTimeoutMs: 30000 });

      const state = await pcb.getState('scm', 'github');
      expect(state).toBe('closed');
    });
  });

  // ─── getAllStates ────────────────────────────────────────────────────────

  describe('getAllStates', () => {
    it('should return empty array when no CB service', async () => {
      const states = await pcb.getAllStates();
      expect(states).toEqual([]);
    });

    it('should return empty array when no pipeline targets registered', async () => {
      const cbService = createCircuitBreakerService();
      mockModule.__setMockService(cbService);

      // Register a non-pipeline target
      await cbService.register('other:target', { failureThreshold: 5, recoveryTimeoutMs: 60000 });

      const states = await pcb.getAllStates();
      expect(states).toEqual([]);
    });

    it('should return pipeline-related targets', async () => {
      const cbService = createCircuitBreakerService();
      mockModule.__setMockService(cbService);

      await cbService.register('scm:github', { failureThreshold: 5, recoveryTimeoutMs: 30000 });
      await cbService.register('registry:docker', { failureThreshold: 3, recoveryTimeoutMs: 60000 });
      await cbService.register('other:target', { failureThreshold: 5, recoveryTimeoutMs: 60000 });

      const states = await pcb.getAllStates();
      expect(states.length).toBe(2);
      expect(states.map(s => s.targetKey)).toContain('scm:github');
      expect(states.map(s => s.targetKey)).toContain('registry:docker');
      expect(states.map(s => s.targetKey)).not.toContain('other:target');
    });

    it('should filter notification targets', async () => {
      const cbService = createCircuitBreakerService();
      mockModule.__setMockService(cbService);

      await cbService.register('notification:slack', { failureThreshold: 5, recoveryTimeoutMs: 30000 });

      const states = await pcb.getAllStates();
      expect(states.length).toBe(1);
      expect(states[0].targetKey).toBe('notification:slack');
    });

    it('should filter k8s targets', async () => {
      const cbService = createCircuitBreakerService();
      mockModule.__setMockService(cbService);

      await cbService.register('k8s:api', { failureThreshold: 3, recoveryTimeoutMs: 60000 });

      const states = await pcb.getAllStates();
      expect(states.length).toBe(1);
      expect(states[0].targetKey).toBe('k8s:api');
    });

    it('should filter artifact targets', async () => {
      const cbService = createCircuitBreakerService();
      mockModule.__setMockService(cbService);

      await cbService.register('artifact:storage', { failureThreshold: 3, recoveryTimeoutMs: 60000 });

      const states = await pcb.getAllStates();
      expect(states.length).toBe(1);
      expect(states[0].targetKey).toBe('artifact:storage');
    });
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe('singleton', () => {
    it('should export a singleton instance', () => {
      const { pipelineCircuitBreaker } = require('../pipeline-circuit-breaker');
      expect(pipelineCircuitBreaker).toBeInstanceOf(PipelineCircuitBreaker);
    });
  });
});
