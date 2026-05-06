/**
 * Chaos Experiment Integration Tests
 *
 * Chaos experiment create -> execute -> recover flow
 */

import {
  ChaosExperimentService,
  ChaosExperimentServiceError,
  CreateExperimentInput,
  RunExperimentInput,
} from '@/services/chaos-engineering/ChaosExperimentService';

// ============================================================
// Mock Database
// ============================================================

class MockChaosDb {
  private experiments: Map<string, any> = new Map();
  private runs: Map<string, any> = new Map();
  private idCounter = 0;

  async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number | null }> {
    if (text.includes('INSERT INTO chaos_experiments')) {
      const id = `exp-${++this.idCounter}`;
      const exp = {
        id,
        tenant_id: params[0],
        name: params[1],
        description: params[2],
        scope: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
        faults: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
        steady_state_hypothesis: params[5],
        auto_rollback: params[6] ?? true,
        status: 'draft',
        created_by: params[7],
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.experiments.set(id, exp);
      return { rows: [exp], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('chaos_experiments') && !text.includes('JOIN')) {
      if (text.includes('WHERE id =')) {
        const id = params?.[0];
        const exp = this.experiments.get(id);
        return { rows: exp ? [this.mapExpRow(exp)] : [], rowCount: exp ? 1 : 0 };
      }
      let rows = Array.from(this.experiments.values()).map(e => this.mapExpRow(e));
      if (params?.[0]) rows = rows.filter(r => r.tenant_id === params[0]);
      if (params?.[1] && text.includes('status')) rows = rows.filter(r => r.status === params[1]);
      rows.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      return { rows, rowCount: rows.length };
    }

    if (text.includes('UPDATE') && text.includes('chaos_experiments')) {
      if (text.includes('status =')) {
        const id = params[0];
        const status = params[1];
        const exp = this.experiments.get(id);
        if (exp) {
          exp.status = status;
          exp.updated_at = new Date();
        }
        return { rows: [], rowCount: exp ? 1 : 0 };
      }
    }

    if (text.includes('INSERT INTO chaos_runs')) {
      const id = `run-${++this.idCounter}`;
      const run = {
        id,
        experiment_id: params[0],
        status: 'running',
        timeline: [],
        metrics: { mttr_ms: 0, affected_services: [], error_count: 0, recovered: false },
        started_at: new Date(),
        ended_at: null,
      };
      this.runs.set(id, run);
      return { rows: [this.mapRunRow(run)], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('chaos_runs')) {
      if (text.includes('WHERE id =')) {
        const id = params?.[0];
        const run = this.runs.get(id);
        return { rows: run ? [this.mapRunRow(run)] : [], rowCount: run ? 1 : 0 };
      }
      if (text.includes('WHERE experiment_id =')) {
        const expId = params?.[0];
        const rows = Array.from(this.runs.values())
          .filter(r => r.experiment_id === expId)
          .map(r => this.mapRunRow(r))
          .sort((a, b) => b.started_at.getTime() - a.started_at.getTime());
        return { rows, rowCount: rows.length };
      }
    }

    if (text.includes('UPDATE') && text.includes('chaos_runs')) {
      const runId = params[params.length - 1];
      const run = this.runs.get(runId);
      if (run) {
        const values = params.slice(0, -1);
        for (const val of values) {
          if (typeof val === 'string' && ['running', 'completed', 'failed', 'rolled_back'].includes(val)) {
            run.status = val;
          } else if (val instanceof Date) {
            run.ended_at = val;
          } else if (Array.isArray(val)) {
            // Timeline is always an array of events
            run.timeline = val;
          } else if (val && typeof val === 'object') {
            if ('mttr_ms' in val || 'recovered' in val) {
              run.metrics = val;
            }
          }
        }
        this.runs.set(runId, run); // Ensure it's saved
        return { rows: [this.mapRunRow(run)], rowCount: 1 };
      }
      // Debug: run not found
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  private mapExpRow(exp: any): any {
    return {
      ...exp,
      scope: typeof exp.scope === 'string' ? JSON.parse(exp.scope) : exp.scope,
      faults: typeof exp.faults === 'string' ? JSON.parse(exp.faults) : exp.faults,
    };
  }

  private mapRunRow(run: any): any {
    return {
      ...run,
      timeline: typeof run.timeline === 'string' ? JSON.parse(run.timeline) : run.timeline,
      metrics: typeof run.metrics === 'string' ? JSON.parse(run.metrics) : run.metrics,
    };
  }
}

describe('Chaos Experiment Integration - Create -> Execute -> Recover', () => {
  let mockDb: MockChaosDb;
  let service: ChaosExperimentService;

  beforeEach(() => {
    mockDb = new MockChaosDb();
    service = new ChaosExperimentService(mockDb as any);
  });

  describe('E2E: Create and Execute Experiment', () => {
    it('should create a chaos experiment', async () => {
      const input: CreateExperimentInput = {
        tenant_id: 'tenant-1',
        name: 'Network Latency Test',
        description: 'Test network latency resilience',
        scope: {
          tenant_id: 'tenant-1',
          service_id: 'api-gateway',
          environment: 'staging',
        },
        faults: [
          {
            type: 'network_latency',
            target: 'api-gateway',
            config: { latency_ms: 200 },
            duration_ms: 30000,
            delay_ms: 0,
          },
        ],
        steady_state_hypothesis: 'API responds within 500ms',
        auto_rollback: true,
        created_by: 'chaos-engineer',
      };

      const experiment = await service.createExperiment(input);

      expect(experiment.id).toBeDefined();
      expect(experiment.name).toBe('Network Latency Test');
      expect(experiment.status).toBe('draft');
      expect(experiment.faults).toHaveLength(1);
      expect(experiment.auto_rollback).toBe(true);
    });

    it('should reject invalid fault type', async () => {
      const input: CreateExperimentInput = {
        tenant_id: 'tenant-1',
        name: 'Invalid Fault',
        scope: {
          tenant_id: 'tenant-1',
          environment: 'staging',
        },
        faults: [
          {
            type: 'invalid_fault' as any,
            target: 'service',
            config: {},
            duration_ms: 1000,
            delay_ms: 0,
          },
        ],
        created_by: 'user',
      };

      await expect(service.createExperiment(input))
        .rejects
        .toThrow(ChaosExperimentServiceError);
    });

    it('should reject fault with zero duration', async () => {
      const input: CreateExperimentInput = {
        tenant_id: 'tenant-1',
        name: 'Zero Duration',
        scope: {
          tenant_id: 'tenant-1',
          environment: 'staging',
        },
        faults: [
          {
            type: 'cpu_stress',
            target: 'service',
            config: {},
            duration_ms: 0,
            delay_ms: 0,
          },
        ],
        created_by: 'user',
      };

      await expect(service.createExperiment(input))
        .rejects
        .toThrow('Invalid fault configuration');
    });

    it('should activate experiment', async () => {
      const experiment = await service.createExperiment({
        tenant_id: 'tenant-1',
        name: 'Activate Test',
        scope: { tenant_id: 'tenant-1', environment: 'staging' },
        faults: [{ type: 'cpu_stress', target: 'svc', config: {}, duration_ms: 10000, delay_ms: 0 }],
        created_by: 'user',
      });

      const activated = await service.activateExperiment(experiment.id);
      expect(activated.status).toBe('active');
    });

    it('should reject activation of non-draft experiment', async () => {
      const experiment = await service.createExperiment({
        tenant_id: 'tenant-1',
        name: 'Already Active',
        scope: { tenant_id: 'tenant-1', environment: 'staging' },
        faults: [{ type: 'cpu_stress', target: 'svc', config: {}, duration_ms: 10000, delay_ms: 0 }],
        created_by: 'user',
      });

      await service.activateExperiment(experiment.id);

      await expect(service.activateExperiment(experiment.id))
        .rejects
        .toThrow('Only draft experiments can be activated');
    });

    it('should run an active experiment', async () => {
      const experiment = await service.createExperiment({
        tenant_id: 'tenant-1',
        name: 'Run Test',
        scope: { tenant_id: 'tenant-1', environment: 'staging' },
        faults: [{ type: 'network_latency', target: 'svc', config: { latency_ms: 100 }, duration_ms: 10000, delay_ms: 0 }],
        created_by: 'user',
      });

      await service.activateExperiment(experiment.id);

      const runResult = await service.runExperiment(experiment.id, { dry_run: true });

      expect(runResult.run_id).toBeDefined();
      expect(runResult.status).toBe('running');
      expect(runResult.dry_run).toBe(true);
    });

    it('should reject running non-active experiment', async () => {
      const experiment = await service.createExperiment({
        tenant_id: 'tenant-1',
        name: 'Draft Run',
        scope: { tenant_id: 'tenant-1', environment: 'staging' },
        faults: [{ type: 'network_latency', target: 'svc', config: {}, duration_ms: 10000, delay_ms: 0 }],
        created_by: 'user',
      });

      await expect(service.runExperiment(experiment.id, {}))
        .rejects
        .toThrow('Only active experiments can be run');
    });
  });

  describe('E2E: Experiment Run Lifecycle', () => {
    let experimentId: string;
    let runId: string;

    beforeEach(async () => {
      const experiment = await service.createExperiment({
        tenant_id: 'tenant-1',
        name: 'Lifecycle Test',
        scope: { tenant_id: 'tenant-1', service_id: 'api-gateway', environment: 'staging' },
        faults: [
          { type: 'network_latency', target: 'api-gateway', config: { latency_ms: 200 }, duration_ms: 30000, delay_ms: 0 },
          { type: 'cpu_stress', target: 'api-gateway', config: { stress_percent: 50 }, duration_ms: 15000, delay_ms: 30000 },
        ],
        steady_state_hypothesis: 'P99 latency < 500ms',
        auto_rollback: true,
        created_by: 'chaos-engineer',
      });

      await service.activateExperiment(experiment.id);
      experimentId = experiment.id;

      const runResult = await service.runExperiment(experiment.id, { dry_run: false });
      runId = runResult.run_id;
    });

    it('should get run status', async () => {
      const run = await service.getRun(runId);

      expect(run.id).toBe(runId);
      expect(run.status).toBe('running');
      expect(run.experiment_id).toBe(experimentId);
    });

    it('should add events to run timeline', async () => {
      await service.addRunEvent(runId, {
        timestamp: new Date(),
        type: 'inject',
        service: 'api-gateway',
        details: 'Injected 200ms network latency',
      });

      const run = await service.getRun(runId);
      expect(run.timeline).toHaveLength(1);
      expect(run.timeline[0].type).toBe('inject');
    });

    it('should complete run with metrics', async () => {
      await service.addRunEvent(runId, {
        timestamp: new Date(),
        type: 'inject',
        service: 'api-gateway',
        details: 'Fault injected',
      });

      await service.addRunEvent(runId, {
        timestamp: new Date(),
        type: 'recover',
        service: 'api-gateway',
        details: 'Service recovered',
      });

      const completed = await service.completeRun(runId, {
        mttr_ms: 5000,
        affected_services: ['api-gateway'],
        error_count: 0,
        recovered: true,
      });

      expect(completed.status).toBe('completed');
      expect(completed.metrics.mttr_ms).toBe(5000);
      expect(completed.metrics.recovered).toBe(true);
    });

    it('should rollback a running experiment', async () => {
      const result = await service.rollbackRun(runId, 'Safety concern detected');

      expect(result.success).toBe(true);

      const run = await service.getRun(runId);
      expect(run.status).toBe('rolled_back');
    });

    it('should reject rollback of non-running experiment', async () => {
      await service.completeRun(runId, {
        mttr_ms: 0,
        affected_services: [],
        error_count: 0,
        recovered: true,
      });

      await expect(service.rollbackRun(runId))
        .rejects
        .toThrow('Can only rollback running experiments');
    });
  });

  describe('E2E: List Experiments', () => {
    it('should list experiments by tenant', async () => {
      await service.createExperiment({
        tenant_id: 'tenant-1',
        name: 'Exp 1',
        scope: { tenant_id: 'tenant-1', environment: 'staging' },
        faults: [{ type: 'cpu_stress', target: 'svc', config: {}, duration_ms: 10000, delay_ms: 0 }],
        created_by: 'user',
      });
      await service.createExperiment({
        tenant_id: 'tenant-1',
        name: 'Exp 2',
        scope: { tenant_id: 'tenant-1', environment: 'staging' },
        faults: [{ type: 'network_latency', target: 'svc', config: { latency_ms: 100 }, duration_ms: 10000, delay_ms: 0 }],
        created_by: 'user',
      });

      const result = await service.listExperiments({ tenant_id: 'tenant-1' });
      expect(result.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should get experiment by id', async () => {
      const experiment = await service.createExperiment({
        tenant_id: 'tenant-1',
        name: 'Findable Exp',
        scope: { tenant_id: 'tenant-1', environment: 'staging' },
        faults: [{ type: 'service_down', target: 'svc', config: {}, duration_ms: 10000, delay_ms: 0 }],
        created_by: 'user',
      });

      const found = await service.getExperiment(experiment.id);
      expect(found.id).toBe(experiment.id);
      expect(found.name).toBe('Findable Exp');
    });

    it('should throw when experiment not found', async () => {
      await expect(service.getExperiment('non-existent'))
        .rejects
        .toThrow('Experiment not found');
    });
  });
});
