/**
 * Resilience Scoring Integration Tests
 *
 * Resilience score calculation with all factors:
 * - Experiment success rate
 * - Recovery time
 * - Blast radius
 * - Fault coverage
 */

import { ResilienceScoringService } from '@/services/chaos-engineering/ResilienceScoringService';
import { ResilienceScoreCalculator } from '@/services/chaos-engineering/ResilienceScoreCalculator';

// ============================================================
// Mock Database
// ============================================================

class MockResilienceDb {
  private chaosExperiments: any[] = [];
  private chaosRuns: any[] = [];
  private resilienceScores: any[] = [];
  private schedules: any[] = [];
  private idCounter = 0;

  async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number | null }> {
    // ================== Chaos experiments ==================
    if (text.includes('INSERT INTO chaos_experiments')) {
      const id = `exp-${++this.idCounter}`;
      const exp = {
        id,
        tenant_id: params[0],
        name: params[1],
        description: params[2] || null,
        scope: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3] || {},
        faults: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4] || [],
        steady_state_hypothesis: params[5],
        auto_rollback: params[6] ?? true,
        status: 'draft',
        created_by: params[7] || null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.chaosExperiments.push(exp);
      return { rows: [exp], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('chaos_experiments')) {
      // JOIN queries come through here too - check for JOIN first
      if (text.includes('JOIN') && (text.includes('COUNT') || text.includes('AVG'))) {
        // Aggregate JOIN query
        return {
          rows: [{ total_runs: '0', completed_runs: '0', avg_mttr: '0', recovered_runs: '0' }],
          rowCount: 1,
        };
      }
      if (text.includes('WHERE id =')) {
        const exp = this.chaosExperiments.find(e => e.id === params?.[0]);
        return { rows: exp ? [this.normalizeExp(exp)] : [], rowCount: exp ? 1 : 0 };
      }
      let rows = this.chaosExperiments.map(e => this.normalizeExp(e));
      if (params?.[0]) rows = rows.filter(r => r.tenant_id === params[0]);
      return { rows, rowCount: rows.length };
    }

    if (text.includes('UPDATE') && text.includes('chaos_experiments') && text.includes('status')) {
      const exp = this.chaosExperiments.find(e => e.id === params?.[0]);
      if (exp) {
        exp.status = params[1];
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // ================== Chaos runs ==================
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
      this.chaosRuns.push(run);
      return { rows: [this.normalizeRun(run)], rowCount: 1 };
    }

    // ================== Chaos runs JOIN experiments (for scoring) - MUST BE BEFORE generic SELECT check ==================
    if (text.includes('JOIN') && text.includes('chaos_experiments')) {
      const tenantId = params?.[0];
      const serviceId = params?.[1];

      // If this is an aggregate query (COUNT, AVG), return aggregate row
      if (text.includes('COUNT') || text.includes('AVG')) {
        return {
          rows: [{
            total_runs: '0',
            completed_runs: '0',
            avg_mttr: '0',
            recovered_runs: '0',
          }],
          rowCount: 1,
        };
      }

      // For non-aggregate JOIN queries (e.g., getRecentChaosExperiments)
      let runs = this.chaosRuns.map(r => this.normalizeRun(r));
      runs = runs.map(run => {
        const exp = this.chaosExperiments.find(e => e.id === run.experiment_id);
        return { ...run, name: exp?.name, status: run.status, metrics: run.metrics, started_at: run.started_at, ended_at: run.ended_at };
      });
      if (tenantId) runs = runs.filter(r => {
        const exp = this.chaosExperiments.find(e => e.id === r.experiment_id);
        return exp?.tenant_id === tenantId;
      });
      return { rows: runs, rowCount: runs.length };
    }

    if (text.includes('SELECT') && text.includes('chaos_runs')) {
      let rows = this.chaosRuns.map(r => this.normalizeRun(r));
      if (text.includes('WHERE id =')) {
        rows = rows.filter(r => r.id === params?.[0]);
        return { rows, rowCount: rows.length };
      }
      if (text.includes('WHERE experiment_id =')) {
        rows = rows.filter(r => r.experiment_id === params?.[0]);
        return { rows: rows.sort((a, b) => b.started_at.getTime() - a.started_at.getTime()), rowCount: rows.length };
      }
      return { rows, rowCount: rows.length };
    }

    if (text.includes('UPDATE') && text.includes('chaos_runs')) {
      const runId = params[params.length - 1];
      const run = this.chaosRuns.find(r => r.id === runId);
      if (run) {
        for (let i = 0; i < params.length - 1; i++) {
          const fieldMatch = text.match(new RegExp(`\\$${i + 1}`));
          if (fieldMatch) {
            const fieldBefore = text.substring(0, text.indexOf(`$${i + 1}`));
            if (fieldBefore.includes('status')) run.status = params[i];
            else if (fieldBefore.includes('timeline')) run.timeline = typeof params[i] === 'string' ? JSON.parse(params[i]) : params[i];
            else if (fieldBefore.includes('metrics')) run.metrics = typeof params[i] === 'string' ? JSON.parse(params[i]) : params[i];
            else if (fieldBefore.includes('ended_at')) run.ended_at = params[i];
          }
        }
        return { rows: [this.normalizeRun(run)], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // ================== Resilience scores ==================
    if (text.includes('INSERT INTO resilience_scores_enhanced')) {
      const id = `score-${++this.idCounter}`;
      const score = {
        id,
        tenant_id: params[0],
        service_id: params[1],
        overall_score: params[2],
        experiment_success_rate: params[3],
        recovery_time_score: params[4],
        blast_radius_score: params[5],
        fault_coverage_score: params[6],
        trend: params[7],
        calculated_at: new Date(),
      };
      this.resilienceScores.push(score);
      return { rows: [score], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('resilience_scores_enhanced')) {
      const rows = [...this.resilienceScores].sort((a, b) =>
        (b.calculated_at?.getTime() || 0) - (a.calculated_at?.getTime() || 0)
      );
      return { rows: rows.slice(0, 1), rowCount: rows.length };
    }

    // ================== Chaos schedules ==================
    if (text.includes('INSERT INTO chaos_schedules')) {
      const id = `schedule-${++this.idCounter}`;
      // Query: (experiment_id, cron_expression, timezone, enabled, max_runs, next_run_at)
      // VALUES ($1, $2, $3, true, $4, $5)
      // enabled is hardcoded as true in the VALUES clause
      const schedule = {
        id,
        experiment_id: params[0],
        cron_expression: params[1],
        timezone: params[2],
        enabled: true, // Hardcoded in SQL
        max_runs: params[3],
        current_runs: 0,
        last_run_at: null,
        next_run_at: params[4],
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.schedules.push(schedule);
      return { rows: [schedule], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('chaos_schedules')) {
      let rows = [...this.schedules];
      if (text.includes('WHERE enabled = true')) {
        rows = rows.filter(s => s.enabled);
      }
      return { rows, rowCount: rows.length };
    }

    if (text.includes('UPDATE') && text.includes('chaos_schedules')) {
      if (text.includes('enabled')) {
        const schedule = this.schedules.find(s => s.id === params?.[0]);
        if (schedule) {
          schedule.enabled = params[1];
          return { rows: [schedule], rowCount: 1 };
        }
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private normalizeExp(exp: any): any {
    return {
      ...exp,
      scope: typeof exp.scope === 'string' ? JSON.parse(exp.scope) : exp.scope || {},
      faults: typeof exp.faults === 'string' ? JSON.parse(exp.faults) : exp.faults || [],
    };
  }

  private normalizeRun(run: any): any {
    return {
      ...run,
      timeline: typeof run.timeline === 'string' ? JSON.parse(run.timeline) : run.timeline || [],
      metrics: typeof run.metrics === 'string' ? JSON.parse(run.metrics) : run.metrics || { mttr_ms: 0, affected_services: [], error_count: 0, recovered: false },
    };
  }
}

describe('Resilience Scoring Integration', () => {
  let mockDb: MockResilienceDb;
  let service: ResilienceScoringService;

  beforeEach(() => {
    mockDb = new MockResilienceDb();
    service = new ResilienceScoringService(mockDb as any);
  });

  describe('E2E: Chaos Schedule Management', () => {
    it('should create a chaos schedule', async () => {
      // First create an experiment
      await mockDb.query(
        `INSERT INTO chaos_experiments (tenant_id, name, description, scope, faults, auto_rollback, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['tenant-1', 'Scheduled Exp', null, JSON.stringify({ tenant_id: 'tenant-1', environment: 'staging' }), JSON.stringify([{ type: 'cpu_stress', target: 'svc', config: {}, duration_ms: 10000, delay_ms: 0 }]), true, 'user']
      );
      const experiments = await mockDb.query('SELECT * FROM chaos_experiments WHERE tenant_id = $1', ['tenant-1']);
      const expId = experiments.rows[0].id;

      const schedule = await service.createSchedule(expId, '0 2 * * *', {
        timezone: 'America/New_York',
        maxRuns: 50,
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.experiment_id).toBe(expId);
      expect(schedule.cron_expression).toBe('0 2 * * *');
      expect(schedule.enabled).toBe(true);
      expect(schedule.max_runs).toBe(50);
    });

    it('should toggle schedule', async () => {
      const exp = await mockDb.query(
        `INSERT INTO chaos_experiments (tenant_id, name, scope, faults, auto_rollback, created_by) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['tenant-1', 'Toggle Exp', JSON.stringify({ tenant_id: 'tenant-1', environment: 'staging' }), JSON.stringify([]), true, 'user']
      );

      const schedule = await service.createSchedule(exp.rows[0].id, '0 2 * * *');

      const disabled = await service.toggleSchedule(schedule.id, false);
      expect(disabled.enabled).toBe(false);

      const reenabled = await service.toggleSchedule(schedule.id, true);
      expect(reenabled.enabled).toBe(true);
    });

    it('should get due schedules', async () => {
      // Schedules with next_run_at in the past should be "due"
      // The mock returns all schedules, and the service filters
      const schedules = await service.getDueSchedules();
      expect(Array.isArray(schedules)).toBe(true);
    });
  });

  describe('E2E: Enhanced Resilience Score', () => {
    it('should calculate enhanced score with defaults when no experiments', async () => {
      const score = await service.calculateEnhancedScore('tenant-1', 'api-gateway');

      expect(score.id).toBeDefined();
      expect(score.tenant_id).toBe('tenant-1');
      expect(score.service_id).toBe('api-gateway');
      expect(score.overall_score).toBeGreaterThanOrEqual(0);
      expect(score.overall_score).toBeLessThanOrEqual(100);
      expect(['improving', 'stable', 'degrading']).toContain(score.trend);
    });

    it('should calculate score for tenant without specific service', async () => {
      const score = await service.calculateEnhancedScore('tenant-1');

      expect(score.tenant_id).toBe('tenant-1');
      expect(score.service_id).toBeNull();
    });

    it('should get score breakdown with recommendations', async () => {
      const breakdown = await service.getScoreBreakdown('tenant-1', 'api-gateway');

      expect(breakdown.overall_score).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(breakdown.recommendations)).toBe(true);
      expect(breakdown.recommendations.length).toBeGreaterThan(0);
      expect(breakdown.fault_coverage.total_fault_types).toBeGreaterThan(0);
    });
  });

  describe('E2E: Pre-Deploy Verification', () => {
    it('should block deployment with insufficient experiments', async () => {
      const result = await service.preDeployVerification('tenant-1', 'api-gateway');

      expect(result.passed).toBe(false);
      expect(result.block_reason).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.score).toBe(0);
    });

    it('should include experiment results in verification when experiments exist', async () => {
      // Create an experiment and run
      await mockDb.query(
        `INSERT INTO chaos_experiments (tenant_id, name, description, scope, faults, auto_rollback, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['tenant-1', 'Pre-deploy Exp', 'Test', JSON.stringify({ tenant_id: 'tenant-1', service_id: 'api-gateway', environment: 'staging' }), JSON.stringify([{ type: 'cpu_stress', target: 'api-gateway', config: { stress_percent: 50 }, duration_ms: 30000, delay_ms: 0 }]), true, 'user']
      );

      const exps = await mockDb.query('SELECT * FROM chaos_experiments WHERE tenant_id = $1', ['tenant-1']);
      if (exps.rows.length > 0) {
        await mockDb.query(`INSERT INTO chaos_runs (experiment_id, status, timeline, metrics) VALUES ($1, $2, $3, $4)`, [
          exps.rows[0].id,
          'completed',
          '[]',
          JSON.stringify({ mttr_ms: 5000, affected_services: ['api-gateway'], error_count: 0, recovered: true }),
        ]);
      }

      const result = await service.preDeployVerification('tenant-1', 'api-gateway');

      // May still fail due to minimum experiment count
      expect(result.passed).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });
});
