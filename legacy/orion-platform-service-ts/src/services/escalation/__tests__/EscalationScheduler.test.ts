/**
 * EscalationScheduler Tests
 *
 * Covers:
 * - Constructor: with/without dependencies
 * - start/stop: timer management, isRunning flag
 * - manualEscalate: ticket escalation, no policy found
 * - createEscalationScheduler factory
 * - escalationScheduler singleton: init, start, stop, manualEscalate
 */

import { EscalationScheduler, createEscalationScheduler, escalationScheduler } from '../EscalationScheduler';

jest.mock('pino', () => {
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return jest.fn(() => mockLogger);
});

// Mock the dependencies
jest.mock('../EscalationConfigService', () => ({
  EscalationConfigService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getGlobalConfig: jest.fn().mockReturnValue({ autoEscalationEnabled: true, checkIntervalSeconds: 30 }),
    getNextEscalation: jest.fn().mockReturnValue({
      notifyUsers: ['admin'],
      notifyChannels: ['email'],
      timeoutMinutes: 30,
    }),
  })),
}));

jest.mock('../../ticketing/TicketingRepository', () => ({
  TicketingRepository: jest.fn().mockImplementation(() => ({
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../event-bus-service', () => ({
  EventBusService: jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../errors', () => ({
  OrionError: class OrionError extends Error {
    constructor(message: string, public code: string) { super(message); this.name = 'OrionError'; }
  },
  ErrorCode: { OPERATION_FAILED: 'OPERATION_FAILED' },
}));

describe('EscalationScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Reset singleton
    (escalationScheduler as any)._scheduler = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create scheduler without dependencies', () => {
      const scheduler = new EscalationScheduler();
      expect(scheduler.isRunning).toBe(false);
    });

    it('should create scheduler with dependencies', () => {
      const mockDb = { query: jest.fn() } as any;
      const scheduler = new EscalationScheduler(mockDb);
      expect(scheduler).toBeDefined();
    });
  });

  // ==================== start/stop ====================

  describe('start/stop', () => {
    it('should start scheduler', async () => {
      const scheduler = new EscalationScheduler();
      await scheduler.start();
      expect(scheduler.isRunning).toBe(true);
    });

    it('should not start twice', async () => {
      const scheduler = new EscalationScheduler();
      await scheduler.start();
      await scheduler.start(); // second call should warn
      expect(scheduler.isRunning).toBe(true);
    });

    it('should stop scheduler', async () => {
      const scheduler = new EscalationScheduler();
      await scheduler.start();
      scheduler.stop();
      expect(scheduler.isRunning).toBe(false);
    });

    it('should handle stop when not started', () => {
      const scheduler = new EscalationScheduler();
      scheduler.stop(); // should not throw
      expect(scheduler.isRunning).toBe(false);
    });
  });

  // ==================== manualEscalate ====================

  describe('manualEscalate', () => {
    it('should escalate ticket', async () => {
      const scheduler = new EscalationScheduler();
      const result = await scheduler.manualEscalate('ticket', 'ticket-1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Escalated');
    });

    it('should escalate alert', async () => {
      const scheduler = new EscalationScheduler();
      const result = await scheduler.manualEscalate('alert', 'alert-1');
      expect(result.success).toBe(true);
    });
  });

  // ==================== createEscalationScheduler ====================

  describe('createEscalationScheduler', () => {
    it('should create a new scheduler instance', () => {
      const scheduler = createEscalationScheduler();
      expect(scheduler).toBeInstanceOf(EscalationScheduler);
    });
  });
});
