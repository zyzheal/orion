/**
 * ReleaseTrainService - Release Train Management Unit Tests
 *
 * Coverage: createRelease, getRelease, listReleases, getReleasesByProductLine,
 *           scheduleRelease, cancelRelease, startRelease, completeRelease,
 *           failRelease, getDueReleases, setRepository, in-memory fallback
 */

import { ReleaseTrainService } from '../ReleaseTrainService';

describe('ReleaseTrainService', () => {
  let service: ReleaseTrainService;

  beforeEach(() => {
    service = new ReleaseTrainService();
  });

  // ==================== createRelease ====================

  describe('createRelease', () => {
    it('should create a release train', async () => {
      const result = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Weekly Release',
        schedule: '0 9 * * MON',
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Weekly Release');
      expect(result.productLineId).toBe('pl-1');
      expect(result.schedule).toBe('0 9 * * MON');
      expect(result.state).toBe('Idle');
    });

    it('should use default values for optional fields', async () => {
      const result = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Release',
        schedule: '0 * * * *',
      });

      expect(result.targetBranch).toBe('production');
      expect(result.sourceBranch).toBe('main');
      expect(result.autoPromote).toBe(false);
      expect(result.approvalRequired).toBe(true);
      expect(result.approvers).toEqual([]);
      expect(result.preChecks).toEqual([]);
      expect(result.postActions).toEqual([]);
      expect(result.lastRun).toBeNull();
      expect(result.nextRun).toBeNull();
      expect(result.lastRelease).toBeNull();
    });

    it('should accept custom optional fields', async () => {
      const result = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Custom Release',
        schedule: '0 10 * * *',
        targetBranch: 'staging',
        sourceBranch: 'develop',
        autoPromote: true,
        approvalRequired: false,
        approvers: ['user-1', 'user-2'],
        preChecks: [{ type: 'lint' }],
        postActions: [{ type: 'notify' }],
      });

      expect(result.targetBranch).toBe('staging');
      expect(result.sourceBranch).toBe('develop');
      expect(result.autoPromote).toBe(true);
      expect(result.approvalRequired).toBe(false);
      expect(result.approvers).toEqual(['user-1', 'user-2']);
    });
  });

  // ==================== getRelease ====================

  describe('getRelease', () => {
    it('should return release by id', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Test Release',
        schedule: '0 * * * *',
      });

      const result = await service.getRelease(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.name).toBe('Test Release');
    });

    it('should return null for non-existent id', async () => {
      const result = await service.getRelease('non-existent');
      expect(result).toBeNull();
    });
  });

  // ==================== listReleases ====================

  describe('listReleases', () => {
    it('should list all releases', async () => {
      await service.createRelease({ productLineId: 'pl-1', name: 'R1', schedule: '0 * * * *' });
      await service.createRelease({ productLineId: 'pl-1', name: 'R2', schedule: '0 * * * *' });

      const result = await service.listReleases();

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by productLineId', async () => {
      await service.createRelease({ productLineId: 'pl-filter-test', name: 'Filtered', schedule: '0 * * * *' });

      const result = await service.listReleases({ productLineId: 'pl-filter-test' });

      expect(result.every(r => r.productLineId === 'pl-filter-test')).toBe(true);
    });

    it('should filter by state', async () => {
      const created = await service.createRelease({ productLineId: 'pl-state-test', name: 'State Test', schedule: '0 * * * *' });
      await service.scheduleRelease({ releaseId: created.id });

      const result = await service.listReleases({ state: 'Scheduled' });

      expect(result.some(r => r.id === created.id)).toBe(true);
    });

    it('should apply limit', async () => {
      await service.createRelease({ productLineId: 'pl-limit', name: 'L1', schedule: '0 * * * *' });
      await service.createRelease({ productLineId: 'pl-limit', name: 'L2', schedule: '0 * * * *' });

      const result = await service.listReleases({ productLineId: 'pl-limit', limit: 1 });

      expect(result).toHaveLength(1);
    });
  });

  // ==================== getReleasesByProductLine ====================

  describe('getReleasesByProductLine', () => {
    it('should return releases for product line', async () => {
      await service.createRelease({ productLineId: 'pl-bypl', name: 'PL Release', schedule: '0 * * * *' });

      const result = await service.getReleasesByProductLine('pl-bypl');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every(r => r.productLineId === 'pl-bypl')).toBe(true);
    });
  });

  // ==================== scheduleRelease ====================

  describe('scheduleRelease', () => {
    it('should schedule a release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Schedule Test',
        schedule: '0 9 * * *',
      });

      const result = await service.scheduleRelease({ releaseId: created.id });

      expect(result).toBeDefined();
      expect(result!.state).toBe('Scheduled');
      expect(result!.nextRun).toBeDefined();
    });

    it('should schedule with custom time', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Custom Time',
        schedule: '0 * * * *',
      });
      const scheduledTime = new Date('2026-06-15T09:00:00Z');

      const result = await service.scheduleRelease({
        releaseId: created.id,
        scheduledTime,
      });

      expect(result!.nextRun).toEqual(scheduledTime);
    });

    it('should return null for non-existent release', async () => {
      const result = await service.scheduleRelease({ releaseId: 'non-existent' });
      expect(result).toBeNull();
    });
  });

  // ==================== cancelRelease ====================

  describe('cancelRelease', () => {
    it('should cancel a scheduled release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Cancel Test',
        schedule: '0 * * * *',
      });
      await service.scheduleRelease({ releaseId: created.id });

      const result = await service.cancelRelease(created.id);

      expect(result).toBeDefined();
      expect(result!.state).toBe('Cancelled');
      expect(result!.nextRun).toBeNull();
    });

    it('should cancel an idle release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Idle Cancel',
        schedule: '0 * * * *',
      });

      const result = await service.cancelRelease(created.id);

      expect(result!.state).toBe('Cancelled');
    });

    it('should not cancel a running release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Running Cancel',
        schedule: '0 * * * *',
      });
      await service.scheduleRelease({ releaseId: created.id });
      await service.startRelease(created.id);

      const result = await service.cancelRelease(created.id);

      // Running releases cannot be cancelled - returns as-is
      expect(result!.state).toBe('Running');
    });

    it('should return null for non-existent release', async () => {
      const result = await service.cancelRelease('non-existent');
      expect(result).toBeNull();
    });
  });

  // ==================== startRelease ====================

  describe('startRelease', () => {
    it('should start a scheduled release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Start Test',
        schedule: '0 * * * *',
      });
      await service.scheduleRelease({ releaseId: created.id });

      const result = await service.startRelease(created.id);

      expect(result).toBeDefined();
      expect(result!.state).toBe('Running');
      expect(result!.lastRun).toBeDefined();
      expect(result!.nextRun).toBeDefined();
    });

    it('should start an idle release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Idle Start',
        schedule: '0 * * * *',
      });

      const result = await service.startRelease(created.id);

      expect(result!.state).toBe('Running');
    });

    it('should not start a running release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Double Start',
        schedule: '0 * * * *',
      });
      await service.scheduleRelease({ releaseId: created.id });
      await service.startRelease(created.id);

      const result = await service.startRelease(created.id);

      expect(result!.state).toBe('Running');
    });

    it('should return null for non-existent release', async () => {
      const result = await service.startRelease('non-existent');
      expect(result).toBeNull();
    });
  });

  // ==================== completeRelease ====================

  describe('completeRelease', () => {
    it('should complete a running release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Complete Test',
        schedule: '0 * * * *',
      });
      await service.scheduleRelease({ releaseId: created.id });
      await service.startRelease(created.id);

      const result = await service.completeRelease(created.id, 'v1.0.0');

      expect(result).toBeDefined();
      expect(result!.state).toBe('Completed');
      expect(result!.lastRelease).toBe('v1.0.0');
    });

    it('should generate version when not provided', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Auto Version',
        schedule: '0 * * * *',
      });
      await service.scheduleRelease({ releaseId: created.id });
      await service.startRelease(created.id);

      const result = await service.completeRelease(created.id);

      expect(result!.lastRelease).toBeDefined();
      expect(result!.lastRelease).toMatch(/^v\d{4}\.\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should not complete a non-running release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Idle Complete',
        schedule: '0 * * * *',
      });

      const result = await service.completeRelease(created.id);

      expect(result!.state).toBe('Idle');
    });

    it('should return null for non-existent release', async () => {
      const result = await service.completeRelease('non-existent');
      expect(result).toBeNull();
    });
  });

  // ==================== failRelease ====================

  describe('failRelease', () => {
    it('should fail a running release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Fail Test',
        schedule: '0 * * * *',
      });
      await service.scheduleRelease({ releaseId: created.id });
      await service.startRelease(created.id);

      const result = await service.failRelease(created.id, 'Build failed');

      expect(result).toBeDefined();
      expect(result!.state).toBe('Failed');
    });

    it('should not fail a non-running release', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Idle Fail',
        schedule: '0 * * * *',
      });

      const result = await service.failRelease(created.id);

      expect(result!.state).toBe('Idle');
    });

    it('should return null for non-existent release', async () => {
      const result = await service.failRelease('non-existent');
      expect(result).toBeNull();
    });
  });

  // ==================== getDueReleases ====================

  describe('getDueReleases', () => {
    it('should return releases past their scheduled time', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-due',
        name: 'Due Release',
        schedule: '0 * * * *',
      });
      await service.scheduleRelease({
        releaseId: created.id,
        scheduledTime: new Date(Date.now() - 60000), // 1 minute ago
      });

      const result = await service.getDueReleases();

      expect(result.some(r => r.id === created.id)).toBe(true);
    });

    it('should not return future releases', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-future',
        name: 'Future Release',
        schedule: '0 * * * *',
      });
      await service.scheduleRelease({
        releaseId: created.id,
        scheduledTime: new Date(Date.now() + 86400000), // 1 day from now
      });

      const result = await service.getDueReleases();

      expect(result.every(r => r.id !== created.id)).toBe(true);
    });
  });

  // ==================== setRepository ====================

  describe('setRepository', () => {
    it('should set repository for database mode', () => {
      const mockRepo = { findById: jest.fn() } as any;
      service.setRepository(mockRepo);
      // No assertion needed - just verifying it doesn't throw
      expect(true).toBe(true);
    });
  });

  // ==================== Schedule Calculation ====================

  describe('schedule calculation', () => {
    it('should handle wildcard minute schedule', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Wildcard',
        schedule: '* * * * *',
      });

      const result = await service.scheduleRelease({ releaseId: created.id });

      expect(result!.nextRun).toBeDefined();
    });

    it('should handle invalid schedule format', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Invalid Schedule',
        schedule: 'invalid',
      });

      const result = await service.scheduleRelease({ releaseId: created.id });

      // Falls back to 1 hour from now
      expect(result!.nextRun).toBeDefined();
    });

    it('should handle specific minute schedule', async () => {
      const created = await service.createRelease({
        productLineId: 'pl-1',
        name: 'Specific Minute',
        schedule: '30 9 * * *',
      });

      const result = await service.scheduleRelease({ releaseId: created.id });

      expect(result!.nextRun).toBeDefined();
      expect(result!.nextRun!.getMinutes()).toBe(30);
    });
  });
});
