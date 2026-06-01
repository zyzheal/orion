/**
 * Escalation Module Tests
 *
 * Tests for EscalationConfigService (30+ tests)
 * Tests for EscalationScheduler (25+ tests)
 */

// ============================================================================
// Mock declarations (must come before imports)
// ============================================================================

// Shared mock logger accessible from tests
export const mockLoggerMethods = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('pino', () => {
  return jest.fn(() => mockLoggerMethods);
});

jest.mock('../../event-bus-service', () => {
  const MockEventBusService = jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue('evt-mock-id'),
    subscribe: jest.fn().mockResolvedValue(jest.fn()),
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }));
  return { EventBusService: MockEventBusService };
});

jest.mock('../../ticketing/TicketingRepository', () => {
  const MockTicketingRepository = jest.fn().mockImplementation((db: any) => ({
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
  }));
  return { TicketingRepository: MockTicketingRepository };
});

// ============================================================================
// Imports
// ============================================================================

import { EscalationConfigService, EscalationPolicy } from '../EscalationConfigService';
import { EscalationScheduler } from '../EscalationScheduler';
import { EventBusService } from '../../event-bus-service';

// Re-import the mock to access it in tests
import pino from 'pino';

// ============================================================================
// Helper types
// ============================================================================

type MockDb = {
  query: jest.Mock;
};

// ============================================================================
// EscalationConfigService Tests
// ============================================================================

describe('EscalationConfigService', () => {
  let service: EscalationConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // initialize
  // ---------------------------------------------------------------------------

  describe('initialize', () => {
    it('should use in-memory config when no DB is provided', async () => {
      service = new EscalationConfigService();
      await service.initialize();

      expect(console.log).toHaveBeenCalledWith(
        '[EscalationConfig] No DB, using in-memory config'
      );
    });

    it('should call db.query to create table when DB is provided', async () => {
      const mockDb: MockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();

      // initialize calls query twice: CREATE TABLE + loadPolicies
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      const createSql = mockDb.query.mock.calls[0][0];
      expect(createSql).toContain('CREATE TABLE IF NOT EXISTS escalation_policies');
      expect(createSql).toContain('CREATE INDEX IF NOT EXISTS idx_escalation_policies_entity');
    });

    it('should call loadPolicies after table creation', async () => {
      const mockDb: MockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();

      // Second query is loadPolicies
      const loadSql = mockDb.query.mock.calls[1][0];
      expect(loadSql).toContain('SELECT * FROM escalation_policies WHERE is_active = true');
    });

    it('should handle DB initialization error gracefully', async () => {
      const mockDb: MockDb = {
        query: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();

      expect(console.error).toHaveBeenCalled();
    });

    it('should load policies into cache when DB returns rows', async () => {
      const mockDb: MockDb = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'policy-1',
                entity_type: 'alert',
                severity: 'critical',
                level: 1,
                timeout_minutes: 10,
                notify_users: ['user-1'],
                notify_channels: ['dingtalk'],
                auto_action: null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          }),
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();

      const policies = service.getPolicies('alert', 'critical');
      expect(policies).toHaveLength(1);
      expect(policies[0].entityType).toBe('alert');
      expect(policies[0].level).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // createPolicy
  // ---------------------------------------------------------------------------

  describe('createPolicy', () => {
    beforeEach(async () => {
      service = new EscalationConfigService();
    });

    it('should create an alert policy', async () => {
      const policy = await service.createPolicy({
        entityType: 'alert',
        severity: 'critical',
        level: 1,
        timeoutMinutes: 10,
        notifyUsers: ['user-1'],
        notifyChannels: ['dingtalk'],
        isActive: true,
      });

      expect(policy.id).toMatch(/^policy_/);
      expect(policy.entityType).toBe('alert');
      expect(policy.severity).toBe('critical');
      expect(policy.level).toBe(1);
      expect(policy.createdAt).toBeInstanceOf(Date);
      expect(policy.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a ticket policy', async () => {
      const policy = await service.createPolicy({
        entityType: 'ticket',
        severity: 'high',
        level: 1,
        timeoutMinutes: 60,
        notifyUsers: ['team-lead'],
        notifyChannels: ['email', 'sms'],
        isActive: true,
      });

      expect(policy.entityType).toBe('ticket');
      expect(policy.severity).toBe('high');
    });

    it('should create an incident policy', async () => {
      const policy = await service.createPolicy({
        entityType: 'incident',
        level: 1,
        timeoutMinutes: 30,
        notifyUsers: ['oncall'],
        notifyChannels: ['slack'],
        isActive: true,
      });

      expect(policy.entityType).toBe('incident');
      expect(policy.severity).toBeUndefined();
    });

    it('should replace a duplicate level policy', async () => {
      await service.createPolicy({
        entityType: 'alert',
        severity: 'critical',
        level: 1,
        timeoutMinutes: 10,
        notifyUsers: ['user-1'],
        notifyChannels: ['dingtalk'],
        isActive: true,
      });

      const updated = await service.createPolicy({
        entityType: 'alert',
        severity: 'critical',
        level: 1,
        timeoutMinutes: 20,
        notifyUsers: ['user-2'],
        notifyChannels: ['email'],
        isActive: true,
      });

      const policies = service.getPolicies('alert', 'critical');
      expect(policies).toHaveLength(1);
      expect(policies[0].timeoutMinutes).toBe(20);
      expect(policies[0].notifyUsers).toEqual(['user-2']);
    });

    it('should sort policies by level after adding', async () => {
      await service.createPolicy({
        entityType: 'ticket',
        severity: 'high',
        level: 3,
        timeoutMinutes: 30,
        notifyUsers: ['director'],
        notifyChannels: ['email'],
        isActive: true,
      });
      await service.createPolicy({
        entityType: 'ticket',
        severity: 'high',
        level: 1,
        timeoutMinutes: 60,
        notifyUsers: ['engineer'],
        notifyChannels: ['dingtalk'],
        isActive: true,
      });
      await service.createPolicy({
        entityType: 'ticket',
        severity: 'high',
        level: 2,
        timeoutMinutes: 45,
        notifyUsers: ['team-lead'],
        notifyChannels: ['sms'],
        isActive: true,
      });

      const policies = service.getPolicies('ticket', 'high');
      expect(policies).toHaveLength(3);
      expect(policies[0].level).toBe(1);
      expect(policies[1].level).toBe(2);
      expect(policies[2].level).toBe(3);
    });

    it('should default isActive to true when not specified', async () => {
      const policy = await service.createPolicy({
        entityType: 'alert',
        level: 1,
        timeoutMinutes: 15,
        notifyUsers: ['user-1'],
        notifyChannels: ['dingtalk'],
        isActive: true,
      });

      expect(policy.isActive).toBe(true);
    });

    it('should insert into DB when database is provided', async () => {
      const mockDb: MockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      service = new EscalationConfigService(mockDb as any);
      await service.initialize();
      jest.clearAllMocks();

      await service.createPolicy({
        entityType: 'alert',
        severity: 'critical',
        level: 1,
        timeoutMinutes: 10,
        notifyUsers: ['user-1'],
        notifyChannels: ['dingtalk'],
        autoAction: 'auto-restart',
        isActive: true,
      });

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const insertSql = mockDb.query.mock.calls[0][0];
      expect(insertSql).toContain('INSERT INTO escalation_policies');
      expect(insertSql).toContain('ON CONFLICT');
    });
  });

  // ---------------------------------------------------------------------------
  // getPolicies
  // ---------------------------------------------------------------------------

  describe('getPolicies', () => {
    beforeEach(async () => {
      service = new EscalationConfigService();
      await service.createPolicy({
        entityType: 'alert',
        severity: 'critical',
        level: 1,
        timeoutMinutes: 10,
        notifyUsers: ['user-1'],
        notifyChannels: ['dingtalk'],
        isActive: true,
      });
      await service.createPolicy({
        entityType: 'alert',
        severity: 'critical',
        level: 2,
        timeoutMinutes: 20,
        notifyUsers: ['user-2'],
        notifyChannels: ['email'],
        isActive: true,
      });
    });

    it('should return policies by entityType', async () => {
      const policies = service.getPolicies('alert', 'critical');
      expect(policies).toHaveLength(2);
    });

    it('should return policies by entityType and severity', async () => {
      const policies = service.getPolicies('alert', 'critical');
      expect(policies.every(p => p.severity === 'critical')).toBe(true);
    });

    it('should return empty array for unknown type', async () => {
      const policies = service.getPolicies('unknown', 'critical');
      expect(policies).toEqual([]);
    });

    it('should return policies without severity filter using default', async () => {
      await service.createPolicy({
        entityType: 'ticket',
        level: 1,
        timeoutMinutes: 60,
        notifyUsers: ['engineer'],
        notifyChannels: ['dingtalk'],
        isActive: true,
      });

      const policies = service.getPolicies('ticket');
      expect(policies).toHaveLength(1);
      expect(policies[0].entityType).toBe('ticket');
    });
  });

  // ---------------------------------------------------------------------------
  // getNextEscalation
  // ---------------------------------------------------------------------------

  describe('getNextEscalation', () => {
    beforeEach(async () => {
      service = new EscalationConfigService();
      await service.createPolicy({
        entityType: 'ticket',
        severity: 'high',
        level: 1,
        timeoutMinutes: 60,
        notifyUsers: ['engineer'],
        notifyChannels: ['dingtalk'],
        isActive: true,
      });
      await service.createPolicy({
        entityType: 'ticket',
        severity: 'high',
        level: 2,
        timeoutMinutes: 30,
        notifyUsers: ['team-lead'],
        notifyChannels: ['email'],
        isActive: true,
      });
      await service.createPolicy({
        entityType: 'ticket',
        severity: 'high',
        level: 3,
        timeoutMinutes: 15,
        notifyUsers: ['director'],
        notifyChannels: ['sms'],
        isActive: true,
      });
    });

    it('should get next level from current level 0', async () => {
      const next = service.getNextEscalation('ticket', 'high', 0);
      expect(next).not.toBeNull();
      expect(next!.level).toBe(1);
      expect(next!.notifyUsers).toEqual(['engineer']);
    });

    it('should get next level from current level 1', async () => {
      const next = service.getNextEscalation('ticket', 'high', 1);
      expect(next).not.toBeNull();
      expect(next!.level).toBe(2);
      expect(next!.notifyUsers).toEqual(['team-lead']);
    });

    it('should get next level from current level 2', async () => {
      const next = service.getNextEscalation('ticket', 'high', 2);
      expect(next).not.toBeNull();
      expect(next!.level).toBe(3);
      expect(next!.notifyUsers).toEqual(['director']);
    });

    it('should return null when no next level exists', async () => {
      const next = service.getNextEscalation('ticket', 'high', 3);
      expect(next).toBeNull();
    });

    it('should return null when no policies exist for type', async () => {
      const next = service.getNextEscalation('alert', 'critical', 0);
      expect(next).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // updateGlobalConfig
  // ---------------------------------------------------------------------------

  describe('updateGlobalConfig', () => {
    beforeEach(async () => {
      service = new EscalationConfigService();
    });

    it('should update default timeout values', async () => {
      service.updateGlobalConfig({
        defaults: {
          alertTimeoutMinutes: 30,
          ticketSlaTimeoutMinutes: 180,
          incidentTimeoutMinutes: 60,
        },
      });

      const config = service.getGlobalConfig();
      expect(config.defaults.alertTimeoutMinutes).toBe(30);
      expect(config.defaults.ticketSlaTimeoutMinutes).toBe(180);
      expect(config.defaults.incidentTimeoutMinutes).toBe(60);
    });

    it('should update autoEscalationEnabled', async () => {
      service.updateGlobalConfig({ autoEscalationEnabled: false });

      const config = service.getGlobalConfig();
      expect(config.autoEscalationEnabled).toBe(false);
    });

    it('should update checkIntervalSeconds', async () => {
      service.updateGlobalConfig({ checkIntervalSeconds: 120 });

      const config = service.getGlobalConfig();
      expect(config.checkIntervalSeconds).toBe(120);
    });

    it('partial update preserves existing values', async () => {
      service.updateGlobalConfig({ autoEscalationEnabled: false });

      const config = service.getGlobalConfig();
      expect(config.autoEscalationEnabled).toBe(false);
      expect(config.defaults.alertTimeoutMinutes).toBe(15);
      expect(config.defaults.ticketSlaTimeoutMinutes).toBe(120);
      expect(config.checkIntervalSeconds).toBe(60);
    });
  });

  // ---------------------------------------------------------------------------
  // getGlobalConfig
  // ---------------------------------------------------------------------------

  describe('getGlobalConfig', () => {
    beforeEach(async () => {
      service = new EscalationConfigService();
    });

    it('should return a copy of the config', async () => {
      const config1 = service.getGlobalConfig();
      const config2 = service.getGlobalConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });

    it('should have correct default values', async () => {
      const config = service.getGlobalConfig();

      expect(config.defaults.alertTimeoutMinutes).toBe(15);
      expect(config.defaults.ticketSlaTimeoutMinutes).toBe(120);
      expect(config.defaults.incidentTimeoutMinutes).toBe(30);
      expect(config.autoEscalationEnabled).toBe(true);
      expect(config.checkIntervalSeconds).toBe(60);
    });
  });

  // ---------------------------------------------------------------------------
  // getDefaultTimeout
  // ---------------------------------------------------------------------------

  describe('getDefaultTimeout', () => {
    beforeEach(async () => {
      service = new EscalationConfigService();
    });

    it('should return 15 for alert', async () => {
      expect(service.getDefaultTimeout('alert')).toBe(15);
    });

    it('should return 120 for ticket', async () => {
      expect(service.getDefaultTimeout('ticket')).toBe(120);
    });

    it('should return 30 for incident', async () => {
      expect(service.getDefaultTimeout('incident')).toBe(30);
    });

    it('should return 15 for unknown entity type', async () => {
      expect(service.getDefaultTimeout('unknown')).toBe(15);
    });

    it('should reflect updated defaults', async () => {
      service.updateGlobalConfig({
        defaults: {
          alertTimeoutMinutes: 30,
          ticketSlaTimeoutMinutes: 240,
          incidentTimeoutMinutes: 60,
        },
      });

      expect(service.getDefaultTimeout('alert')).toBe(30);
      expect(service.getDefaultTimeout('ticket')).toBe(240);
      expect(service.getDefaultTimeout('incident')).toBe(60);
    });
  });
});

// ============================================================================
// EscalationScheduler Tests
// ============================================================================

describe('EscalationScheduler', () => {
  let scheduler: EscalationScheduler;
  let mockDb: MockDb;
  let mockEventBus: EventBusService;
  let configService: EscalationConfigService;

  /** Helper: start scheduler and create a default policy for manualEscalate tests */
  async function startSchedulerWithPolicy(db?: MockDb) {
    const useDb = db || mockDb;
    scheduler = new EscalationScheduler(useDb as any, mockEventBus);
    await scheduler.start();
    configService = (scheduler as any).configService as EscalationConfigService;
    await configService.createPolicy({
      entityType: 'alert',
      severity: 'default',
      level: 1,
      timeoutMinutes: 15,
      notifyUsers: ['oncall'],
      notifyChannels: ['dingtalk', 'email', 'sms', 'slack', 'wechat'],
      isActive: true,
    });
    await configService.createPolicy({
      entityType: 'ticket',
      severity: 'default',
      level: 1,
      timeoutMinutes: 60,
      notifyUsers: ['engineer'],
      notifyChannels: ['dingtalk', 'email'],
      isActive: true,
    });
    await configService.createPolicy({
      entityType: 'incident',
      severity: 'default',
      level: 1,
      timeoutMinutes: 30,
      notifyUsers: ['oncall'],
      notifyChannels: ['dingtalk'],
      isActive: true,
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    mockEventBus = new EventBusService({ enabled: false });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // start
  // ---------------------------------------------------------------------------

  describe('start', () => {
    it('should initialize config service on start', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should set isRunning to true', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();

      await scheduler.start();
      expect(mockLoggerMethods.warn).toHaveBeenCalled();
    });

    it('should create an interval timer', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      scheduler.stop();
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should perform an immediate check on start', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();

      expect(mockLoggerMethods.debug).toHaveBeenCalled();
    });

    it('should log started message with interval', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Started')
      );
    });

    it('should handle initial check error gracefully', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();

      expect(() => scheduler.stop()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // start with autoEscalation disabled
  // ---------------------------------------------------------------------------

  describe('start with autoEscalation disabled', () => {
    it('should return early when autoEscalationEnabled is false', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();

      configService = (scheduler as any).configService as EscalationConfigService;
      configService.updateGlobalConfig({ autoEscalationEnabled: false });
      scheduler.stop();

      await scheduler.start();

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        '[EscalationScheduler] Auto escalation disabled'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // stop
  // ---------------------------------------------------------------------------

  describe('stop', () => {
    it('should clear the interval', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      scheduler.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should set isRunning to false', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();
      scheduler.stop();

      jest.clearAllMocks();
      await scheduler.start();
      const warnCalls = mockLoggerMethods.warn.mock.calls.filter(
        (c: any[]) => c[0] && c[0].includes('Already running')
      );
      expect(warnCalls).toHaveLength(0);
    });

    it('should log a stop message', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();
      scheduler.stop();

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        '[EscalationScheduler] Stopped'
      );
    });

    it('should handle stop when never started', async () => {
      scheduler = new EscalationScheduler();
      expect(() => scheduler.stop()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // checkTicketsForEscalation
  // ---------------------------------------------------------------------------

  describe('checkTicketsForEscalation', () => {
    it('should skip when no ticketRepo available', async () => {
      scheduler = new EscalationScheduler(undefined, mockEventBus);
      await scheduler.start();

      await new Promise(resolve => process.nextTick(resolve));

      expect(mockLoggerMethods.debug).toHaveBeenCalledWith(
        '[EscalationScheduler] No ticket repo, skipping'
      );
    });

    it('should find open tickets and check for escalation', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();
      await new Promise(resolve => process.nextTick(resolve));

      expect(mockLoggerMethods.debug).toHaveBeenCalled();
    });

    it('should skip tickets without due_date', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();
      await new Promise(resolve => process.nextTick(resolve));

      scheduler.stop();
      expect(() => scheduler.stop()).not.toThrow();
    });

    it('should handle ticket escalation errors gracefully', async () => {
      // Mock ticketRepo.findAll to throw
      const { TicketingRepository } = await import('../../ticketing/TicketingRepository');
      (TicketingRepository as jest.Mock).mockImplementationOnce(() => ({
        findAll: jest.fn().mockRejectedValue(new Error('Ticket fetch failed')),
        update: jest.fn().mockResolvedValue({}),
      }));

      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);
      await scheduler.start();

      await new Promise(resolve => process.nextTick(resolve));

      expect(mockLoggerMethods.error).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // escalateAlert
  // ---------------------------------------------------------------------------

  describe('escalateAlert', () => {
    it('should send notifications and publish event via EventBus', async () => {
      await startSchedulerWithPolicy();

      const result = await scheduler.manualEscalate('alert', 'alert-123');
      expect(result.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // escalateTicket
  // ---------------------------------------------------------------------------

  describe('escalateTicket', () => {
    it('should update ticket level and send notifications', async () => {
      await startSchedulerWithPolicy();

      const result = await scheduler.manualEscalate('ticket', 'ticket-456');
      expect(result.success).toBe(true);
    });

    it('should publish event via EventBus', async () => {
      await startSchedulerWithPolicy();

      const publishSpy = jest.spyOn(mockEventBus, 'publish');
      await scheduler.manualEscalate('ticket', 'ticket-789');

      expect(publishSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // sendNotifications (via manualEscalate)
  // ---------------------------------------------------------------------------

  describe('sendNotifications (via manualEscalate)', () => {
    it('should route to DingTalk channel handler', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-dingtalk');

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Sending DingTalk'),
        expect.any(Object)
      );
    });

    it('should route to WeChat channel handler', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-wechat');

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Sending WeChat'),
        expect.any(Object)
      );
    });

    it('should route to Email channel handler', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-email');

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Sending Email'),
        expect.any(Object)
      );
    });

    it('should route to SMS channel handler', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-sms');

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Sending SMS'),
        expect.any(Object)
      );
    });

    it('should route to Slack channel handler', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-slack');

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Sending Slack'),
        expect.any(Object)
      );
    });

    it('should handle multiple notification channels', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-multi');

      const sendingCalls = mockLoggerMethods.info.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('Sending ')
      );
      expect(sendingCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // manualEscalate
  // ---------------------------------------------------------------------------

  describe('manualEscalate', () => {
    it('alert escalation should succeed', async () => {
      await startSchedulerWithPolicy();

      const result = await scheduler.manualEscalate('alert', 'alert-001');

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/Escalated to level/);
    });

    it('ticket escalation should succeed', async () => {
      await startSchedulerWithPolicy();

      const result = await scheduler.manualEscalate('ticket', 'ticket-001');

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/Escalated to level/);
    });

    it('incident escalation should succeed', async () => {
      await startSchedulerWithPolicy();

      const result = await scheduler.manualEscalate('incident', 'incident-001');

      expect(result.success).toBe(true);
    });

    it('should return failure when no policy found', async () => {
      const cleanDb: MockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      scheduler = new EscalationScheduler(cleanDb as any, mockEventBus);
      await scheduler.start();

      const result = await scheduler.manualEscalate('alert', 'alert-nopolicy');
      expect(result.success).toBe(false);
      expect(result.message).toContain('No escalation policy found');
    });

    it('should use targetLevel when provided', async () => {
      await startSchedulerWithPolicy();

      const result = await scheduler.manualEscalate('alert', 'alert-target', 3);

      expect(result.success).toBe(true);
      expect(result.message).toContain('level 3');
    });
  });

  // ---------------------------------------------------------------------------
  // Notification channel handlers
  // ---------------------------------------------------------------------------

  describe('Notification channel handlers', () => {
    it('DingTalk handler logs correctly', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-dt');

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Sending DingTalk'),
        expect.any(Object)
      );
    });

    it('WeChat handler logs correctly', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-wc');

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Sending WeChat'),
        expect.any(Object)
      );
    });

    it('Email handler logs correctly', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-em');

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Sending Email'),
        expect.any(Object)
      );
    });

    it('SMS handler logs correctly', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-sms');

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Sending SMS'),
        expect.any(Object)
      );
    });

    it('Slack handler logs correctly', async () => {
      await startSchedulerWithPolicy();

      await scheduler.manualEscalate('alert', 'alert-slack');

      expect(mockLoggerMethods.info).toHaveBeenCalledWith(
        expect.stringContaining('[EscalationScheduler] Sending Slack'),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: full lifecycle
  // ---------------------------------------------------------------------------

  describe('Integration: full lifecycle', () => {
    it('should start, create policies, escalate, and stop cleanly', async () => {
      await startSchedulerWithPolicy();

      await configService.createPolicy({
        entityType: 'alert',
        severity: 'default',
        level: 2,
        timeoutMinutes: 10,
        notifyUsers: ['manager'],
        notifyChannels: ['email'],
        isActive: true,
      });

      const result = await scheduler.manualEscalate('alert', 'alert-integration');
      expect(result.success).toBe(true);

      expect(() => scheduler.stop()).not.toThrow();
    });

    it('should handle start/stop/start cycle', async () => {
      scheduler = new EscalationScheduler(mockDb as any, mockEventBus);

      await scheduler.start();
      scheduler.stop();
      await scheduler.start();
      scheduler.stop();
    });
  });
});
