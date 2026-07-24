/**
 * EscalationScheduler Extended Tests
 *
 * Covers gaps not in the main test file:
 * - createEscalationScheduler factory function
 * - escalationScheduler singleton (init, start, stop, manualEscalate, isRunning)
 * - checkTicketsForEscalation with actual ticket data
 * - escalateTicket ticketRepo.update verification
 * - escalateAlert/escalateTicket EventBus publish verification
 * - Scheduler without DB
 */

// ============================================================================
// Mock declarations
// ============================================================================

const mockLoggerMethods = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('pino', () => {
  return jest.fn(() => mockLoggerMethods);
});

const mockEventBusPublish = jest.fn().mockResolvedValue('evt-id');
const mockEventBus = {
  publish: mockEventBusPublish,
  subscribe: jest.fn().mockResolvedValue(jest.fn()),
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../event-bus-service', () => {
  return {
    EventBusService: jest.fn().mockImplementation(() => mockEventBus),
  };
});

const mockTicketFindAll = jest.fn().mockResolvedValue([]);
const mockTicketUpdate = jest.fn().mockResolvedValue({});

jest.mock('../../ticketing/TicketingRepository', () => {
  return {
    TicketingRepository: jest.fn().mockImplementation(() => ({
      findAll: mockTicketFindAll,
      update: mockTicketUpdate,
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    })),
  };
});

// ============================================================================
// Imports
// ============================================================================

import { EscalationScheduler, createEscalationScheduler, escalationScheduler } from '../EscalationScheduler';
import { EscalationConfigService } from '../EscalationConfigService';

// ============================================================================
// Helpers
// ============================================================================

type MockDb = {
  query: jest.Mock;
};

// Reset the singleton before each test
function resetSingleton() {
  (escalationScheduler as any)._scheduler = null;
}

// Start scheduler, wait for initial checkAndEscalate to complete, then create policies
async function setupSchedulerWithPolicies(
  mockDb: MockDb,
  policies: Array<{
    entityType: 'alert' | 'ticket' | 'incident';
    severity?: string;
    level: number;
    timeoutMinutes: number;
    notifyUsers: string[];
    notifyChannels: string[];
  }>
) {
  const scheduler = new EscalationScheduler(mockDb as any, mockEventBus as any);
  await scheduler.start();
  // Wait for the initial fire-and-forget checkAndEscalate to complete
  await new Promise(resolve => process.nextTick(resolve));

  const configService = (scheduler as any).configService as EscalationConfigService;
  for (const p of policies) {
    await configService.createPolicy({ ...p, isActive: true });
  }
  return { scheduler, configService };
}

// ============================================================================
// Tests
// ============================================================================

describe('EscalationScheduler - Extended', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    resetSingleton();
    mockTicketFindAll.mockResolvedValue([]);
    mockTicketUpdate.mockResolvedValue({});
    mockEventBusPublish.mockResolvedValue('evt-id');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetSingleton();
  });

  // ---------------------------------------------------------------------------
  // createEscalationScheduler factory
  // ---------------------------------------------------------------------------

  describe('createEscalationScheduler', () => {
    it('should create an EscalationScheduler instance', () => {
      const scheduler = createEscalationScheduler();
      expect(scheduler).toBeInstanceOf(EscalationScheduler);
      expect(scheduler.isRunning).toBe(false);
    });

    it('should create scheduler with database dependency', () => {
      const scheduler = createEscalationScheduler(mockDb as any);
      expect(scheduler).toBeInstanceOf(EscalationScheduler);
    });

    it('should create scheduler with eventBus dependency', () => {
      const scheduler = createEscalationScheduler(undefined, mockEventBus as any);
      expect(scheduler).toBeInstanceOf(EscalationScheduler);
    });

    it('should create scheduler with both dependencies', () => {
      const scheduler = createEscalationScheduler(mockDb as any, mockEventBus as any);
      expect(scheduler).toBeInstanceOf(EscalationScheduler);
    });

    it('should create independent instances', () => {
      const s1 = createEscalationScheduler();
      const s2 = createEscalationScheduler();
      expect(s1).not.toBe(s2);
    });
  });

  // ---------------------------------------------------------------------------
  // escalationScheduler singleton
  // ---------------------------------------------------------------------------

  describe('escalationScheduler singleton', () => {
    describe('init', () => {
      it('should create and return a new scheduler instance', () => {
        const instance = escalationScheduler.init();
        expect(instance).toBeInstanceOf(EscalationScheduler);
      });

      it('should return the same instance on second call', () => {
        const first = escalationScheduler.init();
        const second = escalationScheduler.init();
        expect(first).toBe(second);
      });

      it('should warn when already initialized', () => {
        escalationScheduler.init();
        escalationScheduler.init();
        expect(mockLoggerMethods.warn).toHaveBeenCalledWith(
          '[EscalationScheduler] Already initialized, returning existing instance'
        );
      });

      it('should pass database dependency to scheduler', () => {
        const instance = escalationScheduler.init(mockDb as any);
        expect(instance).toBeInstanceOf(EscalationScheduler);
      });

      it('should pass eventBus dependency to scheduler', () => {
        const instance = escalationScheduler.init(undefined, mockEventBus as any);
        expect(instance).toBeInstanceOf(EscalationScheduler);
      });
    });

    describe('isRunning', () => {
      it('should return false when no scheduler is initialized', () => {
        expect(escalationScheduler.isRunning).toBe(false);
      });

      it('should reflect scheduler running state', async () => {
        escalationScheduler.init(mockDb as any, mockEventBus as any);
        expect(escalationScheduler.isRunning).toBe(false);
      });
    });

    describe('start', () => {
      it('should create default instance when not initialized and start it', async () => {
        await escalationScheduler.start();
        expect(escalationScheduler.isRunning).toBeDefined();
        escalationScheduler.stop();
      });

      it('should warn about deprecated behavior when starting without init', async () => {
        await escalationScheduler.start();
        expect(mockLoggerMethods.warn).toHaveBeenCalledWith(
          '[EscalationScheduler] Not initialized with dependencies, creating default instance (deprecated)'
        );
        escalationScheduler.stop();
      });
    });

    describe('stop', () => {
      it('should not throw when no scheduler exists', () => {
        expect(() => escalationScheduler.stop()).not.toThrow();
      });

      it('should stop the initialized scheduler', async () => {
        const instance = escalationScheduler.init(mockDb as any, mockEventBus as any);
        await instance.start();
        expect(escalationScheduler.isRunning).toBe(true);

        escalationScheduler.stop();
        expect(escalationScheduler.isRunning).toBe(false);
      });
    });

    describe('manualEscalate', () => {
      it('should throw OrionError when not initialized', async () => {
        await expect(
          escalationScheduler.manualEscalate('alert', 'alert-1')
        ).rejects.toThrow('EscalationScheduler not initialized');
      });

      it('should delegate to scheduler when initialized', async () => {
        const instance = escalationScheduler.init(mockDb as any, mockEventBus as any);
        await instance.start();

        const configService = (instance as any).configService as EscalationConfigService;
        await configService.createPolicy({
          entityType: 'alert',
          severity: 'default',
          level: 1,
          timeoutMinutes: 15,
          notifyUsers: ['oncall'],
          notifyChannels: ['email'],
          isActive: true,
        });

        const result = await escalationScheduler.manualEscalate('alert', 'alert-1');
        expect(result.success).toBe(true);
        escalationScheduler.stop();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // EscalationScheduler without DB
  // ---------------------------------------------------------------------------

  describe('EscalationScheduler without DB', () => {
    it('should start without database', async () => {
      const scheduler = new EscalationScheduler(undefined, mockEventBus as any);
      await scheduler.start();

      expect(scheduler.isRunning).toBe(true);
      scheduler.stop();
    });

    it('should perform initial check without DB', async () => {
      const scheduler = new EscalationScheduler(undefined, mockEventBus as any);
      await scheduler.start();

      // checkTicketsForEscalation should skip (no ticketRepo)
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith(
        '[EscalationScheduler] No ticket repo, skipping'
      );
      scheduler.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // checkTicketsForEscalation with actual data
  // ---------------------------------------------------------------------------

  describe('checkTicketsForEscalation with ticket data', () => {
    it('should escalate ticket when due date is past', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();

      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'ticket', severity: 'high', level: 1, timeoutMinutes: 60, notifyUsers: ['engineer'], notifyChannels: ['email'] },
      ]);

      // Now set up ticket data and trigger a manual check
      mockTicketFindAll.mockResolvedValue([
        { id: 'ticket-1', due_date: pastDate, escalation_level: 0, priority: 'high' },
      ]);

      await (scheduler as any).checkTicketsForEscalation();

      expect(mockTicketUpdate).toHaveBeenCalledWith('ticket-1', { escalation_level: 1 }, '');
      scheduler.stop();
    });

    it('should escalate ticket when within timeout window', async () => {
      const soonDate = new Date(Date.now() + 300000).toISOString(); // 5 minutes from now

      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'ticket', severity: 'high', level: 1, timeoutMinutes: 60, notifyUsers: ['engineer'], notifyChannels: ['email'] },
      ]);

      mockTicketFindAll.mockResolvedValue([
        { id: 'ticket-2', due_date: soonDate, escalation_level: 0, priority: 'high' },
      ]);

      await (scheduler as any).checkTicketsForEscalation();

      // 5 minutes remaining < 60 minutes timeout window -> escalate
      expect(mockTicketUpdate).toHaveBeenCalledWith('ticket-2', { escalation_level: 1 }, '');
      scheduler.stop();
    });

    it('should skip ticket when no matching escalation policy', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'ticket', severity: 'high', level: 1, timeoutMinutes: 60, notifyUsers: ['engineer'], notifyChannels: ['email'] },
      ]);

      mockTicketFindAll.mockResolvedValue([
        { id: 'ticket-3', due_date: new Date(Date.now() - 3600000).toISOString(), escalation_level: 0, priority: 'low' },
      ]);

      await (scheduler as any).checkTicketsForEscalation();

      // No policy for 'low' severity
      expect(mockTicketUpdate).not.toHaveBeenCalled();
      scheduler.stop();
    });

    it('should skip ticket when no next escalation level available', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'ticket', severity: 'high', level: 1, timeoutMinutes: 60, notifyUsers: ['engineer'], notifyChannels: ['email'] },
      ]);

      mockTicketFindAll.mockResolvedValue([
        { id: 'ticket-4', due_date: new Date(Date.now() - 3600000).toISOString(), escalation_level: 5, priority: 'high' },
      ]);

      await (scheduler as any).checkTicketsForEscalation();

      // escalation_level is 5, next would be 6, but policy only has level 1
      expect(mockTicketUpdate).not.toHaveBeenCalled();
      scheduler.stop();
    });

    it('should skip ticket when due_date is null', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'ticket', severity: 'high', level: 1, timeoutMinutes: 60, notifyUsers: ['engineer'], notifyChannels: ['email'] },
      ]);

      mockTicketFindAll.mockResolvedValue([
        { id: 'ticket-5', due_date: null, escalation_level: 0, priority: 'high' },
      ]);

      await (scheduler as any).checkTicketsForEscalation();

      expect(mockTicketUpdate).not.toHaveBeenCalled();
      scheduler.stop();
    });

    it('should handle multiple tickets with different escalation needs', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'ticket', severity: 'high', level: 1, timeoutMinutes: 60, notifyUsers: ['engineer'], notifyChannels: ['email'] },
      ]);

      mockTicketFindAll.mockResolvedValue([
        { id: 'ticket-a', due_date: new Date(Date.now() - 3600000).toISOString(), escalation_level: 0, priority: 'high' },
        { id: 'ticket-b', due_date: new Date(Date.now() + 7200000).toISOString(), escalation_level: 0, priority: 'high' },
        { id: 'ticket-c', due_date: null, escalation_level: 0, priority: 'high' },
      ]);

      await (scheduler as any).checkTicketsForEscalation();

      // Only ticket-a should be escalated (past due)
      expect(mockTicketUpdate).toHaveBeenCalledTimes(1);
      expect(mockTicketUpdate).toHaveBeenCalledWith('ticket-a', { escalation_level: 1 }, '');
      scheduler.stop();
    });

    it('should skip when no ticketRepo available', async () => {
      const scheduler = new EscalationScheduler(undefined, mockEventBus as any);
      await scheduler.start();

      // Directly call checkTicketsForEscalation
      await (scheduler as any).checkTicketsForEscalation();

      expect(mockTicketFindAll).not.toHaveBeenCalled();
      scheduler.stop();
    });

    it('should handle findAll error gracefully', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'ticket', severity: 'high', level: 1, timeoutMinutes: 60, notifyUsers: ['engineer'], notifyChannels: ['email'] },
      ]);

      mockTicketFindAll.mockRejectedValue(new Error('DB connection failed'));

      await (scheduler as any).checkTicketsForEscalation();

      expect(mockLoggerMethods.error).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Ticket escalation error'),
        expect.any(Error)
      );
      expect(mockTicketUpdate).not.toHaveBeenCalled();
      scheduler.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // escalateTicket - ticketRepo.update and EventBus publish
  // ---------------------------------------------------------------------------

  describe('escalateTicket - detailed verification', () => {
    it('should call ticketRepo.update with correct escalation level', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'ticket', severity: 'default', level: 1, timeoutMinutes: 60, notifyUsers: ['engineer'], notifyChannels: ['email'] },
      ]);

      await scheduler.manualEscalate('ticket', 'ticket-update');

      expect(mockTicketUpdate).toHaveBeenCalledWith('ticket-update', { escalation_level: 1 }, '');
      scheduler.stop();
    });

    it('should publish orion.tickets.escalated event with correct data', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'ticket', severity: 'default', level: 1, timeoutMinutes: 60, notifyUsers: ['engineer'], notifyChannels: ['email'] },
      ]);

      await scheduler.manualEscalate('ticket', 'ticket-evt');

      expect(mockEventBusPublish).toHaveBeenCalledWith(
        'orion.tickets.escalated',
        expect.objectContaining({
          ticketId: 'ticket-evt',
          newLevel: 1,
          policy: ['engineer'],
          channels: ['email'],
          timestamp: expect.any(String),
        })
      );
      scheduler.stop();
    });

    it('should include ISO timestamp in event payload', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'ticket', severity: 'default', level: 1, timeoutMinutes: 60, notifyUsers: ['eng'], notifyChannels: ['email'] },
      ]);

      await scheduler.manualEscalate('ticket', 'ticket-ts');

      const publishCall = mockEventBusPublish.mock.calls.find(
        (c: any[]) => c[0] === 'orion.tickets.escalated'
      );
      expect(publishCall).toBeDefined();
      const timestamp = publishCall[1].timestamp;
      expect(() => new Date(timestamp).toISOString()).not.toThrow();
      expect(new Date(timestamp).getTime()).not.toBeNaN();
      scheduler.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // escalateAlert - EventBus publish verification
  // ---------------------------------------------------------------------------

  describe('escalateAlert - detailed verification', () => {
    it('should publish orion.alerts.escalated event with correct data', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'alert', severity: 'default', level: 1, timeoutMinutes: 15, notifyUsers: ['oncall'], notifyChannels: ['dingtalk'] },
      ]);

      await scheduler.manualEscalate('alert', 'alert-evt');

      expect(mockEventBusPublish).toHaveBeenCalledWith(
        'orion.alerts.escalated',
        expect.objectContaining({
          alertId: 'alert-evt',
          newLevel: 1,
          policy: ['oncall'],
          channels: ['dingtalk'],
          timestamp: expect.any(String),
        })
      );
      scheduler.stop();
    });

    it('should include ISO timestamp in alert event payload', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'alert', severity: 'default', level: 1, timeoutMinutes: 15, notifyUsers: ['oncall'], notifyChannels: ['email'] },
      ]);

      await scheduler.manualEscalate('alert', 'alert-ts');

      const publishCall = mockEventBusPublish.mock.calls.find(
        (c: any[]) => c[0] === 'orion.alerts.escalated'
      );
      const timestamp = publishCall[1].timestamp;
      expect(new Date(timestamp).getTime()).not.toBeNaN();
      scheduler.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // checkAndEscalate - runs all three checks
  // ---------------------------------------------------------------------------

  describe('checkAndEscalate', () => {
    it('should run alert, ticket, and incident checks', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, []);

      // Call checkAndEscalate directly
      await (scheduler as any).checkAndEscalate();

      // Alert check logs "Alert repo not available"
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith(
        expect.stringContaining('Alert repo not available')
      );
      // Incident check logs "Checking incidents..."
      expect(mockLoggerMethods.debug).toHaveBeenCalledWith(
        expect.stringContaining('Checking incidents')
      );
      scheduler.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // start/stop lifecycle
  // ---------------------------------------------------------------------------

  describe('start/stop lifecycle', () => {
    it('should allow restart after stop', async () => {
      const scheduler = new EscalationScheduler(mockDb as any, mockEventBus as any);

      await scheduler.start();
      expect(scheduler.isRunning).toBe(true);
      scheduler.stop();
      expect(scheduler.isRunning).toBe(false);

      await scheduler.start();
      expect(scheduler.isRunning).toBe(true);
      scheduler.stop();
    });

    it('should warn when starting while already running', async () => {
      const scheduler = new EscalationScheduler(mockDb as any, mockEventBus as any);

      await scheduler.start();
      jest.clearAllMocks();
      await scheduler.start();

      expect(mockLoggerMethods.warn).toHaveBeenCalledWith(
        '[EscalationScheduler] Already running'
      );
      scheduler.stop();
    });

    it('should not set up interval when autoEscalation is disabled', async () => {
      const scheduler = new EscalationScheduler(mockDb as any, mockEventBus as any);
      await scheduler.start();

      const configService = (scheduler as any).configService as EscalationConfigService;
      configService.updateGlobalConfig({ autoEscalationEnabled: false });
      scheduler.stop();

      jest.clearAllMocks();
      await scheduler.start();

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        '[EscalationScheduler] Auto escalation disabled'
      );
      expect(scheduler.isRunning).toBe(false);
    });

    it('should stop cleanly when interval is active', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const scheduler = new EscalationScheduler(mockDb as any, mockEventBus as any);
      await scheduler.start();
      scheduler.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(scheduler.isRunning).toBe(false);
      clearIntervalSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // manualEscalate edge cases
  // ---------------------------------------------------------------------------

  describe('manualEscalate edge cases', () => {
    it('should handle incident entity type', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'incident', severity: 'default', level: 1, timeoutMinutes: 30, notifyUsers: ['oncall'], notifyChannels: ['dingtalk'] },
      ]);

      const result = await scheduler.manualEscalate('incident', 'incident-1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('level 1');
      scheduler.stop();
    });

    it('should use specified targetLevel for escalation', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        { entityType: 'alert', severity: 'default', level: 1, timeoutMinutes: 15, notifyUsers: ['oncall'], notifyChannels: ['email'] },
      ]);

      const result = await scheduler.manualEscalate('alert', 'alert-custom', 5);
      expect(result.success).toBe(true);
      expect(result.message).toContain('level 5');
      scheduler.stop();
    });

    it('should return failure message when no escalation policy matches', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, []);

      const result = await scheduler.manualEscalate('alert', 'no-policy');
      expect(result.success).toBe(false);
      expect(result.message).toBe('No escalation policy found');
      scheduler.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // Notification channels via escalate
  // ---------------------------------------------------------------------------

  describe('Notification channels', () => {
    it('should send to all configured channels during escalation', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        {
          entityType: 'alert',
          severity: 'default',
          level: 1,
          timeoutMinutes: 15,
          notifyUsers: ['oncall'],
          notifyChannels: ['dingtalk', 'wechat', 'email', 'sms', 'slack'],
        },
      ]);

      await scheduler.manualEscalate('alert', 'alert-all-channels');

      const sendingCalls = mockLoggerMethods.info.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('[EscalationScheduler] Sending')
      );

      // Should have 5 sending calls (one per channel)
      expect(sendingCalls).toHaveLength(5);
      const channels = sendingCalls.map((c: any[]) => c[0]);
      expect(channels.some((c: string) => c.includes('DingTalk'))).toBe(true);
      expect(channels.some((c: string) => c.includes('WeChat'))).toBe(true);
      expect(channels.some((c: string) => c.includes('Email'))).toBe(true);
      expect(channels.some((c: string) => c.includes('SMS'))).toBe(true);
      expect(channels.some((c: string) => c.includes('Slack'))).toBe(true);
      scheduler.stop();
    });

    it('should not send any notifications when channels array is empty', async () => {
      const { scheduler } = await setupSchedulerWithPolicies(mockDb, [
        {
          entityType: 'alert',
          severity: 'default',
          level: 1,
          timeoutMinutes: 15,
          notifyUsers: ['oncall'],
          notifyChannels: [],
        },
      ]);

      await scheduler.manualEscalate('alert', 'alert-no-channels');

      const sendingCalls = mockLoggerMethods.info.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('[EscalationScheduler] Sending')
      );
      expect(sendingCalls).toHaveLength(0);
      scheduler.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // isRunning property
  // ---------------------------------------------------------------------------

  describe('isRunning property', () => {
    it('should be false initially', () => {
      const scheduler = new EscalationScheduler();
      expect(scheduler.isRunning).toBe(false);
    });

    it('should be true after start', async () => {
      const scheduler = new EscalationScheduler(mockDb as any, mockEventBus as any);
      await scheduler.start();
      expect(scheduler.isRunning).toBe(true);
      scheduler.stop();
    });

    it('should be false after stop', async () => {
      const scheduler = new EscalationScheduler(mockDb as any, mockEventBus as any);
      await scheduler.start();
      scheduler.stop();
      expect(scheduler.isRunning).toBe(false);
    });
  });
});
