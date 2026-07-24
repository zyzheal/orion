/**
 * Tests for ApprovalTimeoutScheduler
 */
import { ApprovalTimeoutScheduler, DEFAULT_TIMEOUT_CONFIG } from '../ApprovalTimeoutScheduler';

const mockFindAll = jest.fn();
const mockFindStepsByApproval = jest.fn();
const mockUpdateStepStatus = jest.fn();
const mockUpdateStatus = jest.fn();

jest.mock('../../../repositories/ApprovalRepository', () => ({
  ApprovalRepository: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findStepsByApproval: mockFindStepsByApproval,
    updateStepStatus: mockUpdateStepStatus,
    updateStatus: mockUpdateStatus,
  })),
}));

describe('ApprovalTimeoutScheduler', () => {
  let scheduler: ApprovalTimeoutScheduler;
  const mockDb = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new ApprovalTimeoutScheduler(mockDb);
  });

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const config = scheduler.getConfig();
      expect(config.reminderTimeoutMs).toBe(DEFAULT_TIMEOUT_CONFIG.reminderTimeoutMs);
      expect(config.autoActionTimeoutMs).toBe(DEFAULT_TIMEOUT_CONFIG.autoActionTimeoutMs);
      expect(config.defaultAutoAction).toBe('approve');
      expect(config.autoApproveEnabled).toBe(true);
      expect(config.autoRejectEnabled).toBe(false);
    });

    it('should merge custom config with defaults', () => {
      const customScheduler = new ApprovalTimeoutScheduler(mockDb, {
        autoApproveEnabled: false,
        defaultAutoAction: 'reject',
      });
      const config = customScheduler.getConfig();
      expect(config.autoApproveEnabled).toBe(false);
      expect(config.defaultAutoAction).toBe('reject');
      expect(config.reminderTimeoutMs).toBe(DEFAULT_TIMEOUT_CONFIG.reminderTimeoutMs);
    });
  });

  describe('scanTimeoutApprovals', () => {
    it('should return empty array when no pending approvals', async () => {
      mockFindAll.mockResolvedValue({ entities: [], total: 0 });

      const result = await scheduler.scanTimeoutApprovals();
      expect(result).toEqual([]);
    });

    it('should return empty array when no approvals are overdue', async () => {
      const now = new Date();
      mockFindAll.mockResolvedValue({
        entities: [
          {
            id: 'approval-1',
            status: 'pending',
            createdAt: now, // Just created, not overdue
          },
        ],
        total: 1,
      });
      mockFindStepsByApproval.mockResolvedValue([]);

      const result = await scheduler.scanTimeoutApprovals();
      expect(result).toEqual([]);
    });

    it('should identify approvals in reminder phase', async () => {
      const overdueDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      mockFindAll.mockResolvedValue({
        entities: [
          {
            id: 'approval-1',
            status: 'pending',
            createdAt: overdueDate,
          },
        ],
        total: 1,
      });
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'user1', status: 'pending' },
      ]);

      const result = await scheduler.scanTimeoutApprovals();
      expect(result.length).toBe(1);
      expect(result[0].currentPhase).toBe('reminder');
    });

    it('should identify approvals in auto_action phase', async () => {
      const overdueDate = new Date(Date.now() - 49 * 60 * 60 * 1000); // 49 hours ago
      mockFindAll.mockResolvedValue({
        entities: [
          {
            id: 'approval-1',
            status: 'pending',
            createdAt: overdueDate,
          },
        ],
        total: 1,
      });
      mockFindStepsByApproval.mockResolvedValue([]);

      const result = await scheduler.scanTimeoutApprovals();
      expect(result.length).toBe(1);
      expect(result[0].currentPhase).toBe('auto_action');
    });

    it('should skip non-pending approvals', async () => {
      const overdueDate = new Date(Date.now() - 100 * 60 * 60 * 1000);
      mockFindAll.mockResolvedValue({
        entities: [
          { id: 'approval-1', status: 'approved', createdAt: overdueDate },
          { id: 'approval-2', status: 'rejected', createdAt: overdueDate },
        ],
        total: 2,
      });

      const result = await scheduler.scanTimeoutApprovals();
      expect(result).toEqual([]);
    });
  });

  describe('handleTimeout', () => {
    it('should send reminder in reminder phase', async () => {
      const result = await scheduler.handleTimeout({
        entity: { id: 'approval-1' } as any,
        steps: [{ id: 'step-1', approverId: 'user1', status: 'pending' }] as any,
        overdueMs: 25 * 60 * 60 * 1000,
        currentPhase: 'reminder',
      });

      expect(result.action).toBe('reminded');
      expect(result.approvalId).toBe('approval-1');
    });

    it('should auto-approve in auto_action phase when configured', async () => {
      mockUpdateStepStatus.mockResolvedValue(undefined);
      mockUpdateStatus.mockResolvedValue(undefined);

      const result = await scheduler.handleTimeout({
        entity: { id: 'approval-1' } as any,
        steps: [
          { id: 'step-1', approverId: 'user1', status: 'pending' },
          { id: 'step-2', approverId: 'user2', status: 'pending' },
        ] as any,
        overdueMs: 49 * 60 * 60 * 1000,
        currentPhase: 'auto_action',
      });

      expect(result.action).toBe('approved');
      expect(mockUpdateStepStatus).toHaveBeenCalledTimes(2);
      expect(mockUpdateStatus).toHaveBeenCalledWith('approval-1', 'approved', expect.any(Date));
    });

    it('should auto-reject when configured', async () => {
      const rejectScheduler = new ApprovalTimeoutScheduler(mockDb, {
        defaultAutoAction: 'reject',
        autoRejectEnabled: true,
      });

      mockUpdateStepStatus.mockResolvedValue(undefined);
      mockUpdateStatus.mockResolvedValue(undefined);

      const result = await rejectScheduler.handleTimeout({
        entity: { id: 'approval-1' } as any,
        steps: [{ id: 'step-1', approverId: 'user1', status: 'pending' }] as any,
        overdueMs: 49 * 60 * 60 * 1000,
        currentPhase: 'auto_action',
      });

      expect(result.action).toBe('rejected');
      expect(mockUpdateStatus).toHaveBeenCalledWith('approval-1', 'rejected', expect.any(Date));
    });

    it('should return none when no action configured', async () => {
      const noActionScheduler = new ApprovalTimeoutScheduler(mockDb, {
        autoApproveEnabled: false,
        autoRejectEnabled: false,
      });

      const result = await noActionScheduler.handleTimeout({
        entity: { id: 'approval-1' } as any,
        steps: [],
        overdueMs: 49 * 60 * 60 * 1000,
        currentPhase: 'auto_action',
      });

      expect(result.action).toBe('none');
    });

    it('should handle errors gracefully', async () => {
      mockUpdateStepStatus.mockRejectedValue(new Error('DB error'));

      await expect(
        scheduler.handleTimeout({
          entity: { id: 'approval-1' } as any,
          steps: [{ id: 'step-1', status: 'pending' }] as any,
          overdueMs: 49 * 60 * 60 * 1000,
          currentPhase: 'auto_action',
        }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('processAllTimeouts', () => {
    it('should process all timeout approvals', async () => {
      const overdueDate = new Date(Date.now() - 49 * 60 * 60 * 1000);
      mockFindAll.mockResolvedValue({
        entities: [
          { id: 'approval-1', status: 'pending', createdAt: overdueDate },
          { id: 'approval-2', status: 'pending', createdAt: overdueDate },
        ],
        total: 2,
      });
      mockFindStepsByApproval.mockResolvedValue([]);
      mockUpdateStepStatus.mockResolvedValue(undefined);
      mockUpdateStatus.mockResolvedValue(undefined);

      const results = await scheduler.processAllTimeouts();
      expect(results.length).toBe(2);
    });

    it('should handle errors for individual approvals', async () => {
      const overdueDate = new Date(Date.now() - 49 * 60 * 60 * 1000);
      mockFindAll.mockResolvedValue({
        entities: [
          { id: 'approval-1', status: 'pending', createdAt: overdueDate },
        ],
        total: 1,
      });
      mockFindStepsByApproval.mockRejectedValue(new Error('DB error'));

      const results = await scheduler.processAllTimeouts();
      expect(results.length).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update config values', () => {
      scheduler.updateConfig({
        autoApproveEnabled: false,
        reminderTimeoutMs: 12 * 60 * 60 * 1000,
      });

      const config = scheduler.getConfig();
      expect(config.autoApproveEnabled).toBe(false);
      expect(config.reminderTimeoutMs).toBe(12 * 60 * 60 * 1000);
      expect(config.autoActionTimeoutMs).toBe(DEFAULT_TIMEOUT_CONFIG.autoActionTimeoutMs);
    });
  });

  describe('start/stop', () => {
    it('should log warning when no cron scheduler provided', async () => {
      await scheduler.start();
      // Should not throw
    });

    it('should register with cron scheduler when provided', async () => {
      const mockCron = {
        addJob: jest.fn(),
        removeJob: jest.fn(),
      };
      const cronScheduler = new ApprovalTimeoutScheduler(mockDb, {}, mockCron as any);
      await cronScheduler.start();
      expect(mockCron.addJob).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'approval-timeout-scheduler' }),
      );
    });

    it('should remove job on stop', () => {
      const mockCron = {
        addJob: jest.fn(),
        removeJob: jest.fn(),
      };
      const cronScheduler = new ApprovalTimeoutScheduler(mockDb, {}, mockCron as any);
      cronScheduler.stop();
      expect(mockCron.removeJob).toHaveBeenCalledWith('approval-timeout-scheduler');
    });
  });
});
