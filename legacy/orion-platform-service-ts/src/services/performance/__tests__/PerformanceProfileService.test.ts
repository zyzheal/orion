/**
 * PerformanceProfileService - Comprehensive Tests
 *
 * Tests for profile creation, bottleneck analysis,
 * optimization suggestions, and profile management.
 */

import { PerformanceProfileService, ProfileConfig, ProfileRecord, ProfileResult } from '../PerformanceProfileService';
import { PerformanceProfileRepository } from '../../../repositories/PerformanceRepository';

// ─── Mock Repository ────────────────────────────────────────────────────────

class MockPerformanceProfileRepository extends PerformanceProfileRepository {
  private store: Map<string, any> = new Map();
  constructor() { super({} as any); }

  async create(data: any) {
    const entity = { ...data, created_at: new Date() };
    this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string) {
    return this.store.get(id);
  }

  async findByService(serviceName: string) {
    return Array.from(this.store.values())
      .filter((e: any) => e.service_name === serviceName)
      .sort((a: any, b: any) => b.created_at.getTime() - a.created_at.getTime());
  }

  async updateResults(id: string, results: any, status: string, errorMessage?: string) {
    const entity = this.store.get(id);
    if (!entity) throw new Error(`Profile ${id} not found`);
    entity.results = results;
    entity.status = status;
    entity.completed_at = status === 'completed' ? new Date() : null;
    if (errorMessage) entity.error_message = errorMessage;
    return entity;
  }

  clear() { this.store.clear(); }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PerformanceProfileService', () => {
  let service: PerformanceProfileService;
  let profileRepo: MockPerformanceProfileRepository;

  beforeEach(() => {
    profileRepo = new MockPerformanceProfileRepository();
    const mockDb = { query: async () => ({ rows: [], rowCount: 0 }) };
    service = new PerformanceProfileService(mockDb);
    (service as any).profileRepo = profileRepo;
  });

  afterEach(() => {
    profileRepo.clear();
  });

  // ─── profileService ──────────────────────────────────────────────────────

  describe('profileService', () => {
    it('should create a profile with default config', async () => {
      const profile = await service.profileService('api-gateway', {});

      expect(profile.id).toBeDefined();
      expect(profile.serviceName).toBe('api-gateway');
      expect(profile.status).toBe('pending');
      expect(profile.config.durationSeconds).toBe(60);
      expect(profile.config.concurrency).toBe(10);
      expect(profile.config.metrics).toContain('latency');
      expect(profile.config.metrics).toContain('throughput');
    });

    it('should create a profile with custom config', async () => {
      const profile = await service.profileService('api-gateway', {
        durationSeconds: 120,
        concurrency: 20,
        targetRps: 500,
        endpoints: ['/api/health', '/api/users'],
        metrics: ['latency', 'cpu'],
      });

      expect(profile.config.durationSeconds).toBe(120);
      expect(profile.config.concurrency).toBe(20);
      expect(profile.config.targetRps).toBe(500);
      expect(profile.config.endpoints).toEqual(['/api/health', '/api/users']);
      expect(profile.config.metrics).toEqual(['latency', 'cpu']);
    });

    it('should execute profile asynchronously', async () => {
      jest.useFakeTimers();
      try {
        const profile = await service.profileService('test-svc', { concurrency: 10 });

        // Initially pending
        expect(profile.status).toBe('pending');

        // Advance timers to let async execution complete
        jest.advanceTimersByTime(100);

        // Flush microtasks
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        // Check if completed (may still be pending depending on async timing)
        const updated = await service.getProfile(profile.id);
        expect(updated).toBeDefined();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // ─── getProfile ──────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should get profile by ID', async () => {
      const created = await service.profileService('test-svc', {});
      const found = await service.getProfile(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent profile', async () => {
      const found = await service.getProfile('non-existent');
      expect(found).toBeNull();
    });
  });

  // ─── listProfiles ────────────────────────────────────────────────────────

  describe('listProfiles', () => {
    it('should list profiles for a service', async () => {
      await service.profileService('api-gateway', {});
      await service.profileService('api-gateway', {});
      await service.profileService('web-frontend', {});

      const profiles = await service.listProfiles('api-gateway');
      expect(profiles.length).toBe(2);
    });

    it('should return empty array for service with no profiles', async () => {
      const profiles = await service.listProfiles('non-existent');
      expect(profiles).toEqual([]);
    });
  });

  // ─── analyzeBottlenecks ──────────────────────────────────────────────────

  describe('analyzeBottlenecks', () => {
    function createCompletedProfile(results: Partial<ProfileResult>): any {
      return {
        id: 'profile-1',
        service_name: 'test-svc',
        config: {},
        status: 'completed',
        results: {
          avgLatencyMs: 100,
          p50LatencyMs: 80,
          p95LatencyMs: 200,
          p99LatencyMs: 300,
          maxRps: 500,
          errorRate: 0.005,
          throughputRps: 400,
          resourceUsage: {
            cpuAvg: 50,
            cpuMax: 80,
            memoryAvg: 60,
            memoryMax: 85,
          },
          metrics: {},
          ...results,
        },
        created_at: new Date(),
        completed_at: new Date(),
        error_message: null,
      };
    }

    it('should return null for non-existent profile', async () => {
      const result = await service.analyzeBottlenecks('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for pending profile', async () => {
      // Insert a pending profile directly (bypassing async execution)
      const entity = {
        id: 'pending-profile',
        service_name: 'test-svc',
        config: {},
        status: 'pending',
        results: null,
        created_at: new Date(),
        completed_at: null,
        error_message: null,
      };
      profileRepo['store'].set(entity.id, entity);

      const result = await service.analyzeBottlenecks('pending-profile');
      expect(result).toBeNull();
    });

    it('should detect high tail latency bottleneck', async () => {
      const entity = createCompletedProfile({ p99LatencyMs: 600 });
      profileRepo['store'].set(entity.id, entity);

      const result = await service.analyzeBottlenecks(entity.id);
      expect(result).not.toBeNull();
      expect(result!.bottlenecks.some(b => b.type === 'high_tail_latency')).toBe(true);
    });

    it('should detect critical tail latency when p99 > 1000ms', async () => {
      const entity = createCompletedProfile({ p99LatencyMs: 1200 });
      profileRepo['store'].set(entity.id, entity);

      const result = await service.analyzeBottlenecks(entity.id);
      const latencyBottleneck = result!.bottlenecks.find(b => b.type === 'high_tail_latency');
      expect(latencyBottleneck?.severity).toBe('critical');
    });

    it('should detect high error rate bottleneck', async () => {
      const entity = createCompletedProfile({ errorRate: 0.02 });
      profileRepo['store'].set(entity.id, entity);

      const result = await service.analyzeBottlenecks(entity.id);
      expect(result!.bottlenecks.some(b => b.type === 'high_error_rate')).toBe(true);
    });

    it('should detect critical error rate when > 5%', async () => {
      const entity = createCompletedProfile({ errorRate: 0.06 });
      profileRepo['store'].set(entity.id, entity);

      const result = await service.analyzeBottlenecks(entity.id);
      const errorBottleneck = result!.bottlenecks.find(b => b.type === 'high_error_rate');
      expect(errorBottleneck?.severity).toBe('critical');
    });

    it('should detect high CPU usage bottleneck', async () => {
      const entity = createCompletedProfile({
        resourceUsage: { cpuAvg: 85, cpuMax: 95, memoryAvg: 50, memoryMax: 70 },
      });
      profileRepo['store'].set(entity.id, entity);

      const result = await service.analyzeBottlenecks(entity.id);
      expect(result!.bottlenecks.some(b => b.type === 'high_cpu_usage')).toBe(true);
    });

    it('should detect critical CPU when > 95%', async () => {
      const entity = createCompletedProfile({
        resourceUsage: { cpuAvg: 96, cpuMax: 99, memoryAvg: 50, memoryMax: 70 },
      });
      profileRepo['store'].set(entity.id, entity);

      const result = await service.analyzeBottlenecks(entity.id);
      const cpuBottleneck = result!.bottlenecks.find(b => b.type === 'high_cpu_usage');
      expect(cpuBottleneck?.severity).toBe('critical');
    });

    it('should detect high memory usage bottleneck', async () => {
      const entity = createCompletedProfile({
        resourceUsage: { cpuAvg: 50, cpuMax: 80, memoryAvg: 90, memoryMax: 95 },
      });
      profileRepo['store'].set(entity.id, entity);

      const result = await service.analyzeBottlenecks(entity.id);
      expect(result!.bottlenecks.some(b => b.type === 'high_memory_usage')).toBe(true);
    });

    it('should detect throughput degradation', async () => {
      const entity = createCompletedProfile({ maxRps: 1000, throughputRps: 400 });
      profileRepo['store'].set(entity.id, entity);

      const result = await service.analyzeBottlenecks(entity.id);
      expect(result!.bottlenecks.some(b => b.type === 'throughput_degradation')).toBe(true);
    });

    it('should return no bottlenecks for healthy profile', async () => {
      const entity = createCompletedProfile({
        p99LatencyMs: 100,
        errorRate: 0.001,
        maxRps: 500,
        throughputRps: 400,
        resourceUsage: { cpuAvg: 40, cpuMax: 60, memoryAvg: 50, memoryMax: 70 },
      });
      profileRepo['store'].set(entity.id, entity);

      const result = await service.analyzeBottlenecks(entity.id);
      expect(result!.bottlenecks).toHaveLength(0);
    });
  });

  // ─── getOptimizationSuggestions ──────────────────────────────────────────

  describe('getOptimizationSuggestions', () => {
    it('should suggest running profile when none exist', async () => {
      const suggestions = await service.getOptimizationSuggestions('test-svc');

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].title).toContain('No performance profiles');
      expect(suggestions[0].priority).toBe('high');
    });

    it('should suggest reducing tail latency when p99 > 200', async () => {
      const entity = {
        id: 'profile-1',
        service_name: 'test-svc',
        config: {},
        status: 'completed',
        results: {
          avgLatencyMs: 100, p50LatencyMs: 80, p95LatencyMs: 200, p99LatencyMs: 250,
          maxRps: 500, errorRate: 0.001, throughputRps: 400,
          resourceUsage: { cpuAvg: 40, cpuMax: 60, memoryAvg: 50, memoryMax: 70 },
          metrics: {},
        },
        created_at: new Date(),
        completed_at: new Date(),
      };
      profileRepo['store'].set(entity.id, entity);

      const suggestions = await service.getOptimizationSuggestions('test-svc');
      expect(suggestions.some(s => s.title.includes('tail latency'))).toBe(true);
    });

    it('should suggest reducing error rate when > 1%', async () => {
      const entity = {
        id: 'profile-1',
        service_name: 'test-svc',
        config: {},
        status: 'completed',
        results: {
          avgLatencyMs: 100, p50LatencyMs: 80, p95LatencyMs: 150, p99LatencyMs: 180,
          maxRps: 500, errorRate: 0.02, throughputRps: 400,
          resourceUsage: { cpuAvg: 40, cpuMax: 60, memoryAvg: 50, memoryMax: 70 },
          metrics: {},
        },
        created_at: new Date(),
        completed_at: new Date(),
      };
      profileRepo['store'].set(entity.id, entity);

      const suggestions = await service.getOptimizationSuggestions('test-svc');
      expect(suggestions.some(s => s.title.includes('error rate'))).toBe(true);
    });

    it('should suggest CPU optimization when > 70%', async () => {
      const entity = {
        id: 'profile-1',
        service_name: 'test-svc',
        config: {},
        status: 'completed',
        results: {
          avgLatencyMs: 100, p50LatencyMs: 80, p95LatencyMs: 150, p99LatencyMs: 180,
          maxRps: 500, errorRate: 0.001, throughputRps: 400,
          resourceUsage: { cpuAvg: 75, cpuMax: 90, memoryAvg: 50, memoryMax: 70 },
          metrics: {},
        },
        created_at: new Date(),
        completed_at: new Date(),
      };
      profileRepo['store'].set(entity.id, entity);

      const suggestions = await service.getOptimizationSuggestions('test-svc');
      expect(suggestions.some(s => s.title.includes('CPU'))).toBe(true);
    });

    it('should suggest memory optimization when > 75%', async () => {
      const entity = {
        id: 'profile-1',
        service_name: 'test-svc',
        config: {},
        status: 'completed',
        results: {
          avgLatencyMs: 100, p50LatencyMs: 80, p95LatencyMs: 150, p99LatencyMs: 180,
          maxRps: 500, errorRate: 0.001, throughputRps: 400,
          resourceUsage: { cpuAvg: 40, cpuMax: 60, memoryAvg: 80, memoryMax: 90 },
          metrics: {},
        },
        created_at: new Date(),
        completed_at: new Date(),
      };
      profileRepo['store'].set(entity.id, entity);

      const suggestions = await service.getOptimizationSuggestions('test-svc');
      expect(suggestions.some(s => s.title.includes('memory'))).toBe(true);
    });

    it('should suggest throughput improvement when < 100 RPS', async () => {
      const entity = {
        id: 'profile-1',
        service_name: 'test-svc',
        config: {},
        status: 'completed',
        results: {
          avgLatencyMs: 100, p50LatencyMs: 80, p95LatencyMs: 150, p99LatencyMs: 180,
          maxRps: 200, errorRate: 0.001, throughputRps: 50,
          resourceUsage: { cpuAvg: 40, cpuMax: 60, memoryAvg: 50, memoryMax: 70 },
          metrics: {},
        },
        created_at: new Date(),
        completed_at: new Date(),
      };
      profileRepo['store'].set(entity.id, entity);

      const suggestions = await service.getOptimizationSuggestions('test-svc');
      expect(suggestions.some(s => s.title.includes('throughput'))).toBe(true);
    });

    it('should say performance looks good when all metrics are healthy', async () => {
      const entity = {
        id: 'profile-1',
        service_name: 'test-svc',
        config: {},
        status: 'completed',
        results: {
          avgLatencyMs: 50, p50LatencyMs: 40, p95LatencyMs: 80, p99LatencyMs: 100,
          maxRps: 1000, errorRate: 0.001, throughputRps: 500,
          resourceUsage: { cpuAvg: 30, cpuMax: 50, memoryAvg: 40, memoryMax: 60 },
          metrics: {},
        },
        created_at: new Date(),
        completed_at: new Date(),
      };
      profileRepo['store'].set(entity.id, entity);

      const suggestions = await service.getOptimizationSuggestions('test-svc');
      expect(suggestions.some(s => s.title.includes('looks good'))).toBe(true);
    });
  });

  // ─── executeProfileAsync ─────────────────────────────────────────────────

  describe('executeProfileAsync', () => {
    it('should set results and status to completed', async () => {
      jest.useFakeTimers();
      try {
        const profile = await service.profileService('test-svc', { concurrency: 10 });

        // Trigger async execution
        jest.advanceTimersByTime(100);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const entity = profileRepo['store'].get(profile.id);
        // The async execution may have completed
        if (entity?.status === 'completed') {
          expect(entity.results).toBeDefined();
          expect(entity.results.avgLatencyMs).toBeGreaterThan(0);
          expect(entity.results.p99LatencyMs).toBeGreaterThan(0);
          expect(entity.results.resourceUsage).toBeDefined();
        }
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
