/**
 * ResilienceScoringService Tests
 *
 * Covers:
 * - createSchedule: schedule creation with options
 * - listSchedules: tenant filtering, enabled-only
 * - toggleSchedule: enable/disable, not found
 * - getDueSchedules: due schedule query
 * - recordScheduleRun: run recording
 * - preDeployVerification: score calculation, insufficient experiments, pass/fail
 * - calculateEnhancedScore: four-factor score calculation
 * - getScoreBreakdown: detailed breakdown with recommendations
 */

import { ResilienceScoringService } from '../ResilienceScoringService';

jest.mock('../ResilienceScoreCalculator', () => ({
  ResilienceScoreCalculator: jest.fn().mockImplementation(() => ({})),
  ResilienceScoreRepository: jest.fn().mockImplementation(() => ({})),
}));

describe('ResilienceScoringService', () => {
  let service: ResilienceScoringService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    service = new ResilienceScoringService(mockPool);
  });

  // ==================== createSchedule ====================

  describe('createSchedule', () => {
    it('should create a schedule with default options', async () => {
      const mockRow = {
        id: 'sched-1',
        experiment_id: 'exp-1',
        cron_expression: '0 * * * *',
        timezone: 'UTC',
        enabled: true,
        max_runs: 100,
        current_runs: 0,
        last_run_at: null,
        next_run_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPool.query.mockResolvedValue({ rows: [mockRow] });

      const result = await service.createSchedule('exp-1', '0 * * * *');

      expect(result.id).toBe('sched-1');
      expect(result.experiment_id).toBe('exp-1');
      expect(result.enabled).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chaos_schedules'),
        expect.arrayContaining(['exp-1', '0 * * * *', 'UTC', 100])
      );
    });

    it('should accept custom timezone and maxRuns', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 's1', experiment_id: 'e1', cron_expression: '* * * * *', timezone: 'Asia/Shanghai', enabled: true, max_runs: 50, current_runs: 0, last_run_at: null, next_run_at: null, created_at: new Date(), updated_at: new Date() }],
      });

      await service.createSchedule('e1', '* * * * *', { timezone: 'Asia/Shanghai', maxRuns: 50 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining(['e1', '* * * * *', 'Asia/Shanghai', 50])
      );
    });
  });

  // ==================== listSchedules ====================

  describe('listSchedules', () => {
    it('should list schedules for tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [
        { id: 's1', experiment_id: 'e1', cron_expression: '* * * * *', timezone: 'UTC', enabled: true, max_runs: 10, current_runs: 0, last_run_at: null, next_run_at: null, created_at: new Date(), updated_at: new Date() },
      ] });

      const result = await service.listSchedules('tenant-1');

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ce.tenant_id = $1'),
        ['tenant-1']
      );
    });

    it('should filter by enabled only', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listSchedules('tenant-1', true);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('cs.enabled = true'),
        ['tenant-1']
      );
    });
  });

  // ==================== toggleSchedule ====================

  describe('toggleSchedule', () => {
    it('should toggle schedule enabled state', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 's1', enabled: false, experiment_id: 'e1', cron_expression: '* * * * *', timezone: 'UTC', max_runs: 10, current_runs: 0, last_run_at: null, next_run_at: null, created_at: new Date(), updated_at: new Date() }],
      });

      const result = await service.toggleSchedule('s1', false);

      expect(result.enabled).toBe(false);
    });

    it('should throw when schedule not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(service.toggleSchedule('missing', true)).rejects.toThrow('Schedule not found');
    });
  });

  // ==================== getDueSchedules ====================

  describe('getDueSchedules', () => {
    it('should return due schedules', async () => {
      mockPool.query.mockResolvedValue({ rows: [
        { id: 's1', experiment_id: 'e1', cron_expression: '* * * * *', timezone: 'UTC', enabled: true, max_runs: 10, current_runs: 5, last_run_at: null, next_run_at: new Date(), created_at: new Date(), updated_at: new Date() },
      ] });

      const result = await service.getDueSchedules();

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('next_run_at <= NOW()')
      );
    });
  });

  // ==================== recordScheduleRun ====================

  describe('recordScheduleRun', () => {
    it('should update schedule run count and next run', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ cron_expression: '0 * * * *', timezone: 'UTC' }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.recordScheduleRun('s1', 'run-1');

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockPool.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('UPDATE chaos_schedules'),
        expect.arrayContaining(['s1'])
      );
    });

    it('should handle missing schedule gracefully', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.recordScheduleRun('missing', 'run-1');

      // Should only call once (SELECT), not UPDATE
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== preDeployVerification ====================

  describe('preDeployVerification', () => {
    it('should fail with insufficient experiments', async () => {
      mockPool.query.mockResolvedValue({ rows: [] }); // no experiments

      const result = await service.preDeployVerification('t1', 'svc-1');

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.block_reason).toContain('Insufficient');
    });

    it('should pass with good experiment results', async () => {
      const experiments = Array.from({ length: 5 }, (_, i) => ({
        id: `exp-${i}`,
        name: `Test ${i}`,
        status: 'completed',
        started_at: new Date(),
        ended_at: new Date(),
        metrics: { mttr_ms: 1000, recovered: true, affected_services: ['svc-1'] },
      }));
      mockPool.query.mockResolvedValue({ rows: experiments });

      const result = await service.preDeployVerification('t1', 'svc-1');

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0);
      expect(result.recent_experiments).toHaveLength(5);
    });

    it('should provide recommendations when score is low', async () => {
      const experiments = Array.from({ length: 3 }, (_, i) => ({
        id: `exp-${i}`,
        name: `Test ${i}`,
        status: 'failed',
        started_at: new Date(),
        ended_at: new Date(),
        metrics: { mttr_ms: 600000, recovered: false, affected_services: ['svc-1', 'svc-2', 'svc-3', 'svc-4', 'svc-5', 'svc-6'] },
      }));
      mockPool.query.mockResolvedValue({ rows: experiments });

      const result = await service.preDeployVerification('t1', 'svc-1');

      expect(result.passed).toBe(false);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ==================== calculateEnhancedScore ====================

  describe('calculateEnhancedScore', () => {
    it('should calculate score with all four factors', async () => {
      // Mock all the queries needed
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total_runs: '10', completed_runs: '8', avg_mttr: '30000', recovered_runs: '7' }] }) // getEnhancedMetrics
        .mockResolvedValueOnce({ rows: [{ fault_type: 'network_latency' }, { fault_type: 'service_down' }] }) // getFaultCoverage
        .mockResolvedValueOnce({ rows: [{ metrics: { affected_services: ['svc-1'] } }] }) // getLatestBlastRadius
        .mockResolvedValueOnce({ rows: [{ overall_score: 65 }] }) // calculateScoreTrend
        .mockResolvedValueOnce({ rows: [{}] }); // INSERT

      const result = await service.calculateEnhancedScore('t1', 'svc-1');

      expect(result.tenant_id).toBe('t1');
      expect(result.service_id).toBe('svc-1');
      expect(result.overall_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_score).toBeLessThanOrEqual(100);
      expect(result.trend).toBeDefined();
    });

    it('should handle no experiment data', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total_runs: '0', completed_runs: '0', avg_mttr: null, recovered_runs: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{}] });

      const result = await service.calculateEnhancedScore('t1');

      expect(result.overall_score).toBeGreaterThanOrEqual(0);
      expect(result.service_id).toBeNull();
    });
  });

  // ==================== getScoreBreakdown ====================

  describe('getScoreBreakdown', () => {
    it('should return detailed breakdown', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total_runs: '5', completed_runs: '4', avg_mttr: '60000', recovered_runs: '3' }] })
        .mockResolvedValueOnce({ rows: [{ fault_type: 'network_latency' }] })
        .mockResolvedValueOnce({ rows: [{ metrics: { affected_services: [] } }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{ fault_type: 'network_latency' }] })
        .mockResolvedValueOnce({ rows: [{ metrics: { affected_services: [] } }] });

      const result = await service.getScoreBreakdown('t1', 'svc-1');

      expect(result).toHaveProperty('overall_score');
      expect(result).toHaveProperty('fault_coverage');
      expect(result).toHaveProperty('blast_radius');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});
