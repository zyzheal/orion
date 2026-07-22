/**
 * PipelineMetricsService Tests
 *
 * Tests for metric recording, aggregation, Prometheus format output,
 * histogram buckets, and cleanup.
 */

import { PipelineMetricsService, PipelineMetrics } from '../PipelineMetricsService';
import { PipelineRun, PipelineRunStatus, TriggerType } from '../../../models/PipelineRun';

// Helper to create a minimal PipelineRun
function makeRun(overrides: Partial<PipelineRun> = {}): PipelineRun {
  const now = new Date();
  return {
    id: overrides.id || 'run-1',
    pipelineId: overrides.pipelineId || 'pipeline-1',
    pipelineVersion: overrides.pipelineVersion || 'v1',
    triggerType: overrides.triggerType || TriggerType.MANUAL,
    status: overrides.status || PipelineRunStatus.SUCCESS,
    startedAt: overrides.startedAt || now,
    completedAt: overrides.completedAt || now,
    durationMs: overrides.durationMs ?? 1000,
    context: overrides.context ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

describe('PipelineMetricsService', () => {
  let service: PipelineMetricsService;

  beforeEach(() => {
    service = new PipelineMetricsService();
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('recordRun', () => {
    it('should record a successful run', () => {
      const run = makeRun({ status: PipelineRunStatus.SUCCESS, durationMs: 5000 });
      service.recordRun(run);

      const metrics = service.getMetrics();
      expect(metrics.totalRuns).toBe(1);
      expect(metrics.successRuns).toBe(1);
      expect(metrics.failedRuns).toBe(0);
    });

    it('should record a failed run with error type', () => {
      const run = makeRun({
        status: PipelineRunStatus.FAILED,
        durationMs: 3000,
        context: { error: 'Connection timeout' },
      });
      service.recordRun(run);

      const metrics = service.getMetrics();
      expect(metrics.totalRuns).toBe(1);
      expect(metrics.failedRuns).toBe(1);
      expect(metrics.failuresByErrorType['timeout']).toBe(1);
    });

    it('should record a cancelled run', () => {
      const run = makeRun({ status: PipelineRunStatus.CANCELLED });
      service.recordRun(run);

      const metrics = service.getMetrics();
      expect(metrics.cancelledRuns).toBe(1);
    });

    it('should track runs by trigger type', () => {
      service.recordRun(makeRun({ triggerType: TriggerType.MANUAL }));
      service.recordRun(makeRun({ triggerType: TriggerType.SCHEDULE }));
      service.recordRun(makeRun({ triggerType: TriggerType.MANUAL }));

      const metrics = service.getMetrics();
      expect(metrics.runsByTriggerType[TriggerType.MANUAL]).toBe(2);
      expect(metrics.runsByTriggerType[TriggerType.SCHEDULE]).toBe(1);
    });

    it('should track runs by pipeline ID', () => {
      service.recordRun(makeRun({ pipelineId: 'pipeline-A', durationMs: 1000 }));
      service.recordRun(makeRun({ pipelineId: 'pipeline-B', durationMs: 2000 }));
      service.recordRun(makeRun({ pipelineId: 'pipeline-A', durationMs: 3000 }));

      const metrics = service.getMetrics();
      expect(metrics.runsByPipeline['pipeline-A'].total).toBe(2);
      expect(metrics.runsByPipeline['pipeline-B'].total).toBe(1);
      // Average for pipeline-A: (1000 + 3000) / 2 = 2000
      expect(metrics.runsByPipeline['pipeline-A'].avgDurationMs).toBe(2000);
    });

    it('should enforce maxHistorySize', () => {
      const smallService = new PipelineMetricsService({ maxHistorySize: 5 });
      for (let i = 0; i < 10; i++) {
        smallService.recordRun(makeRun({ id: `run-${i}`, durationMs: i * 100 }));
      }
      const metrics = smallService.getMetrics();
      expect(metrics.totalRuns).toBe(5);
      smallService.shutdown();
    });
  });

  describe('getMetrics', () => {
    it('should calculate success rate', () => {
      service.recordRun(makeRun({ status: PipelineRunStatus.SUCCESS }));
      service.recordRun(makeRun({ status: PipelineRunStatus.SUCCESS }));
      service.recordRun(makeRun({ status: PipelineRunStatus.FAILED }));

      const metrics = service.getMetrics();
      expect(metrics.successRate).toBeCloseTo(2 / 3, 4);
    });

    it('should calculate duration percentiles', () => {
      for (let i = 1; i <= 20; i++) {
        service.recordRun(makeRun({ id: `run-${i}`, durationMs: i * 1000 }));
      }

      const metrics = service.getMetrics();
      expect(metrics.averageDurationMs).toBe(10500); // (1+20)*1000/2 = 10500
      expect(metrics.medianDurationMs).toBe(11000); // 20 items, index 10 = 11s
      expect(metrics.p95DurationMs).toBe(20000); // 20 * 0.95 = 19, index 19 clamped to 19 = 20s
    });

    it('should return zero for no runs', () => {
      const metrics = service.getMetrics();
      expect(metrics.totalRuns).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageDurationMs).toBe(0);
      expect(metrics.lastUpdated).toBeDefined();
    });
  });

  describe('getPrometheusMetrics', () => {
    it('should output counter metrics', () => {
      service.recordRun(makeRun({ status: PipelineRunStatus.SUCCESS }));
      service.recordRun(makeRun({ status: PipelineRunStatus.FAILED }));

      const output = service.getPrometheusMetrics();
      expect(output).toContain('# TYPE pipeline_runs_total counter');
      expect(output).toContain('pipeline_runs_total 2');
      expect(output).toContain('pipeline_runs_success_total 1');
      expect(output).toContain('pipeline_runs_failed_total 1');
    });

    it('should output gauge metrics', () => {
      service.recordRun(makeRun({ durationMs: 5000 }));

      const output = service.getPrometheusMetrics();
      expect(output).toContain('# TYPE pipeline_success_rate gauge');
      expect(output).toContain('# TYPE pipeline_queue_depth gauge');
    });

    it('should output duration histogram with buckets', () => {
      service.recordRun(makeRun({ id: 'run-1', durationMs: 15000 }));  // 15s -> falls in 30s bucket
      service.recordRun(makeRun({ id: 'run-2', durationMs: 5000 }));   // 5s  -> falls in 10s bucket
      service.recordRun(makeRun({ id: 'run-3', durationMs: 120000 })); // 120s -> falls in 5m bucket

      const output = service.getPrometheusMetrics();
      expect(output).toContain('# TYPE pipeline_run_duration_seconds histogram');
      expect(output).toContain('pipeline_run_duration_seconds_bucket{le="10"}');
      expect(output).toContain('pipeline_run_duration_seconds_bucket{le="30"}');
      expect(output).toContain('pipeline_run_duration_seconds_bucket{le="60"}');
      expect(output).toContain('pipeline_run_duration_seconds_bucket{le="300"}');
      expect(output).toContain('pipeline_run_duration_seconds_bucket{le="900"}');
      expect(output).toContain('pipeline_run_duration_seconds_bucket{le="1800"}');
      expect(output).toContain('pipeline_run_duration_seconds_bucket{le="3600"}');
      expect(output).toContain('pipeline_run_duration_seconds_sum');
      expect(output).toContain('pipeline_run_duration_seconds_count');
    });

    it('should output trigger counter metric', () => {
      service.recordRun(makeRun({ triggerType: TriggerType.SCHEDULE }));
      service.recordRun(makeRun({ triggerType: TriggerType.MANUAL }));
      service.recordRun(makeRun({ triggerType: TriggerType.SCHEDULE }));

      const output = service.getPrometheusMetrics();
      expect(output).toContain('# TYPE pipeline_runs_by_trigger_type counter');
      expect(output).toContain('trigger_type="schedule"');
      expect(output).toContain('trigger_type="manual"');
    });

    it('should output per-pipeline metrics with labels', () => {
      service.recordRun(makeRun({ pipelineId: 'my-pipeline' }));
      service.recordRun(makeRun({ pipelineId: 'my-pipeline' }));

      const output = service.getPrometheusMetrics();
      expect(output).toContain('pipeline_id="my-pipeline"');
      expect(output).toContain('pipeline_runs_by_pipeline_total');
    });

    it('should output error type metrics', () => {
      service.recordRun(makeRun({
        status: PipelineRunStatus.FAILED,
        context: { error: 'Permission denied' },
      }));

      const output = service.getPrometheusMetrics();
      expect(output).toContain('error_type="permission"');
      expect(output).toContain('pipeline_failures_by_error_type');
    });

    it('should return empty string for no runs', () => {
      const output = service.getPrometheusMetrics();
      // Should still have HELP/TYPE lines for defined metrics
      expect(output).toContain('pipeline_runs_total');
    });

    it('should have valid Prometheus text format', () => {
      service.recordRun(makeRun());
      const output = service.getPrometheusMetrics();

      // Every metric line should follow Prometheus conventions
      const lines = output.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('#'));
      for (const line of lines) {
        // Metric lines should be: name{labels} value OR name value
        expect(line).toMatch(/^[a-z_][a-z0-9_]*(\{[^}]*\})?\s+\d+(\.\d+)?$/);
      }
    });
  });

  describe('getMetricsByPipeline', () => {
    it('should return metrics for a specific pipeline', () => {
      service.recordRun(makeRun({ pipelineId: 'p1', status: PipelineRunStatus.SUCCESS, durationMs: 1000 }));
      service.recordRun(makeRun({ pipelineId: 'p1', status: PipelineRunStatus.FAILED, durationMs: 2000 }));
      service.recordRun(makeRun({ pipelineId: 'p2', status: PipelineRunStatus.SUCCESS, durationMs: 500 }));

      const metrics = service.getMetricsByPipeline('p1');
      expect(metrics.total).toBe(2);
      expect(metrics.success).toBe(1);
      expect(metrics.failed).toBe(1);
      expect(metrics.successRate).toBe(0.5);
      expect(metrics.avgDurationMs).toBe(1500);
    });

    it('should return empty for unknown pipeline', () => {
      const metrics = service.getMetricsByPipeline('nonexistent');
      expect(metrics.total).toBe(0);
    });
  });

  describe('getRecentRuns', () => {
    it('should return the most recent N runs', () => {
      for (let i = 0; i < 10; i++) {
        service.recordRun(makeRun({ id: `run-${i}` }));
      }

      const recent = service.getRecentRuns(3);
      expect(recent.length).toBe(3);
      expect(recent[recent.length - 1].runId).toBe('run-9');
    });

    it('should return all runs if limit exceeds total', () => {
      for (let i = 0; i < 3; i++) {
        service.recordRun(makeRun({ id: `run-${i}` }));
      }

      const recent = service.getRecentRuns(10);
      expect(recent.length).toBe(3);
    });
  });

  describe('clear', () => {
    it('should remove all recorded metrics', () => {
      service.recordRun(makeRun());
      service.recordRun(makeRun());
      expect(service.getMetrics().totalRuns).toBe(2);

      service.clear();
      expect(service.getMetrics().totalRuns).toBe(0);
    });
  });

  describe('error classification', () => {
    it('should classify timeout errors', () => {
      const run = makeRun({
        status: PipelineRunStatus.FAILED,
        context: { error: 'ETIMEDOUT: connection timed out' },
      });
      service.recordRun(run);
      const metrics = service.getMetrics();
      expect(metrics.failuresByErrorType['timeout']).toBe(1);
    });

    it('should classify permission errors', () => {
      const run = makeRun({
        status: PipelineRunStatus.FAILED,
        context: { error: 'Unauthorized access' },
      });
      service.recordRun(run);
      const metrics = service.getMetrics();
      expect(metrics.failuresByErrorType['permission']).toBe(1);
    });

    it('should classify not_found errors', () => {
      const run = makeRun({
        status: PipelineRunStatus.FAILED,
        context: { error: 'Resource not found' },
      });
      service.recordRun(run);
      const metrics = service.getMetrics();
      expect(metrics.failuresByErrorType['not_found']).toBe(1);
    });

    it('should classify network errors', () => {
      const run = makeRun({
        status: PipelineRunStatus.FAILED,
        context: { error: 'ECONNREFUSED connection refused' },
      });
      service.recordRun(run);
      const metrics = service.getMetrics();
      expect(metrics.failuresByErrorType['network']).toBe(1);
    });

    it('should classify compilation errors', () => {
      const run = makeRun({
        status: PipelineRunStatus.FAILED,
        context: { error: 'Syntax error in file.ts' },
      });
      service.recordRun(run);
      const metrics = service.getMetrics();
      expect(metrics.failuresByErrorType['compilation']).toBe(1);
    });

    it('should classify unknown errors', () => {
      const run = makeRun({
        status: PipelineRunStatus.FAILED,
        context: { error: 'Something weird happened' },
      });
      service.recordRun(run);
      const metrics = service.getMetrics();
      expect(metrics.failuresByErrorType['unknown']).toBe(1);
    });
  });
});
