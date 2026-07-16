/**
 * EfficiencyEventHandler 单元测试
 *
 * Migration: Tests now use injected FakeLocalStorage instead of InMemoryLocalStorage.
 * InMemoryLocalStorage has been removed; db is now required and PostgresLocalStorage is used.
 */

import { CloudEvent, EventHandler, EventContext } from '@orion/event-bus';
import {
  EfficiencyEventHandler,
  LocalStorage,
  type EfficiencyEventHandlerConfig,
} from '../EventHandler';
import { DoraMetricsService } from '../DoraMetricsService';
import { ClickHouseSync } from '../ClickHouseSync';
import { PipelineCompletionRecord, DeploymentRecord } from '../types';

// ==================== FakeLocalStorage (in-memory test double) ====================

class FakeLocalStorage implements LocalStorage {
  private pipelineRecords: PipelineCompletionRecord[] = [];
  private deploymentRecords: DeploymentRecord[] = [];

  async savePipelineRecord(record: PipelineCompletionRecord): Promise<void> {
    this.pipelineRecords.push(record);
  }

  async getPipelineRecords(filter?: { tenantId?: string; since?: Date }): Promise<PipelineCompletionRecord[]> {
    let records = [...this.pipelineRecords];
    if (filter?.tenantId) {
      records = records.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.since) {
      records = records.filter((r) => r.completedAt >= filter.since!);
    }
    return records;
  }

  async getUnsyncedPipelineRecords(limit: number = 100): Promise<PipelineCompletionRecord[]> {
    return this.pipelineRecords
      .filter((r) => !r.syncedToClickHouse)
      .slice(0, limit);
  }

  async saveDeploymentRecord(record: DeploymentRecord): Promise<void> {
    this.deploymentRecords.push(record);
  }

  async getDeploymentRecords(filter?: { tenantId?: string; since?: Date }): Promise<DeploymentRecord[]> {
    let records = [...this.deploymentRecords];
    if (filter?.tenantId) {
      records = records.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.since) {
      records = records.filter((r) => r.deployedAt >= filter.since!);
    }
    return records;
  }

  async getUnsyncedDeploymentRecords(limit: number = 100): Promise<DeploymentRecord[]> {
    return this.deploymentRecords
      .filter((r) => !r.syncedToClickHouse)
      .slice(0, limit);
  }

  async markPipelineSynced(id: string): Promise<void> {
    const record = this.pipelineRecords.find((r) => r.id === id);
    if (record) {
      record.syncedToClickHouse = true;
      record.syncedAt = new Date();
    }
  }

  async markDeploymentSynced(id: string): Promise<void> {
    const record = this.deploymentRecords.find((r) => r.id === id);
    if (record) {
      record.syncedToClickHouse = true;
      record.syncedAt = new Date();
    }
  }
}

// ==================== Mock EventBus ====================

class MockEventBus {
  public subscriptions: Map<string, EventHandler<any>> = new Map();
  public publishedEvents: any[] = [];

  async subscribe<T>(
    eventType: string,
    handler: EventHandler<T>,
    _options?: any
  ): Promise<{ unsubscribe: () => Promise<void>; drain: () => Promise<void>; isClosed: boolean }> {
    this.subscriptions.set(eventType, handler);
    return {
      unsubscribe: async () => {
        this.subscriptions.delete(eventType);
      },
      drain: async () => {
        this.subscriptions.delete(eventType);
      },
      isClosed: false,
    };
  }

  async publish(event: CloudEvent<any>): Promise<string> {
    this.publishedEvents.push(event);
    return 'mock-event-id';
  }

  async publishEvent(type: string, data: any): Promise<void> {
    this.publishedEvents.push({ type, data });
  }
}

// ==================== Mock ClickHouseSync ====================

class MockClickHouseSync {
  public syncedPipelineRecords: PipelineCompletionRecord[] = [];
  public syncedDeploymentRecords: DeploymentRecord[] = [];
  public flushedRecords: boolean = false;

  async connect(): Promise<boolean> {
    return true;
  }

  async syncPipelineRecords(records: PipelineCompletionRecord[]): Promise<boolean> {
    this.syncedPipelineRecords.push(...records);
    return true;
  }

  async syncDeploymentRecords(records: DeploymentRecord[]): Promise<boolean> {
    this.syncedDeploymentRecords.push(...records);
    return true;
  }

  async flushPendingRecords(): Promise<{ metrics: boolean; events: boolean }> {
    this.flushedRecords = true;
    return { metrics: true, events: true };
  }

  getStatus() {
    return {
      connected: true,
      tablesCreated: true,
      pendingRecords: 0,
      consecutiveFailures: 0,
    };
  }
}

// ==================== Test Helpers ====================

function createMockDb() {
  return { query: jest.fn() } as any;
}

function createHandler(config?: Partial<EfficiencyEventHandlerConfig>): EfficiencyEventHandler {
  const defaultStorage = new FakeLocalStorage();
  const handler = new EfficiencyEventHandler({
    eventBus: undefined,
    doraMetricsService: new DoraMetricsService(),
    db: createMockDb(),
    ...config,
    localStorage: config?.localStorage || defaultStorage,
  });
  // 使用 FakeLocalStorage 替代 PostgresLocalStorage（构造函数会创建 PostgresLocalStorage）
  handler.setLocalStorage(config?.localStorage || defaultStorage);
  return handler;
}

// ==================== Tests ====================

describe('EfficiencyEventHandler', () => {
  let handler: EfficiencyEventHandler;
  let mockEventBus: MockEventBus;
  let mockDoraService: DoraMetricsService;
  let mockClickHouse: MockClickHouseSync;
  let fakeStorage: FakeLocalStorage;

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    mockDoraService = new DoraMetricsService();
    mockClickHouse = new MockClickHouseSync();
    fakeStorage = new FakeLocalStorage();

    handler = createHandler({
      eventBus: mockEventBus as any,
      doraMetricsService: mockDoraService,
      clickHouseSync: mockClickHouse as any,
      streamName: 'orion-platform-stream',
      consumerGroup: 'test-consumers',
      localStorage: fakeStorage,
    });
  });

  afterEach(async () => {
    await handler.stop();
  });

  // ==================== start/stop ====================

  describe('start/stop', () => {
    it('should subscribe to events on start', async () => {
      await handler.start();

      expect(mockEventBus.subscriptions.has('pipeline.run.completed')).toBe(true);
      expect(mockEventBus.subscriptions.has('pipeline.run.failed')).toBe(true);
      expect(mockEventBus.subscriptions.has('deployment.completed')).toBe(true);
      expect(mockEventBus.subscriptions.has('deployment.failed')).toBe(true);
      expect(mockEventBus.subscriptions.has('deployment.rolled_back')).toBe(true);
    });

    it('should unsubscribe from events on stop', async () => {
      await handler.start();
      await handler.stop();

      expect(mockEventBus.subscriptions.size).toBe(0);
    });

    it('should handle start without EventBus gracefully', async () => {
      const handlerWithoutBus = createHandler({
        doraMetricsService: mockDoraService,
        eventBus: undefined,
      });

      await expect(handlerWithoutBus.start()).resolves.not.toThrow();
      await handlerWithoutBus.stop();
    });
  });

  // ==================== handlePipelineCompleted ====================

  describe('handlePipelineCompleted', () => {
    it('should save pipeline record to PostgreSQL-backed storage', async () => {
      await handler.start();

      const event = new CloudEvent({
        type: 'pipeline.run.completed',
        source: 'orion-pipeline',
        data: {
          pipelineId: 'pipe-1',
          pipelineVersion: 'v1.0.0',
          runId: 'run-1',
          status: 'success',
          triggerType: 'push',
          gitRef: 'main',
          gitSha: 'abc123',
          durationMs: 60000,
          timestamp: '2026-04-12T00:00:00Z',
        },
        extensions: {
          tenantId: 'tenant-001',
          userId: 'user-001',
          traceId: 'trace-1',
        },
      });

      const handler_fn = mockEventBus.subscriptions.get('pipeline.run.completed');
      await handler_fn!(event, {
        subscriptionId: 'test-sub',
        seq: 1,
        timestamp: new Date(),
        retryCount: 0,
      });

      const records = await fakeStorage.getPipelineRecords();
      expect(records).toHaveLength(1);
      expect(records[0].runId).toBe('run-1');
      expect(records[0].status).toBe('success');
      expect(records[0].tenantId).toBe('tenant-001');
    });

    it('should trigger ClickHouse sync', async () => {
      await handler.start();

      const event = new CloudEvent({
        type: 'pipeline.run.completed',
        source: 'orion-pipeline',
        data: {
          pipelineId: 'pipe-1',
          pipelineVersion: 'v1.0.0',
          runId: 'run-1',
          status: 'success',
          triggerType: 'manual',
          durationMs: 120000,
          timestamp: '2026-04-12T00:00:00Z',
        },
      });

      const handler_fn = mockEventBus.subscriptions.get('pipeline.run.completed');
      await handler_fn!(event, {
        subscriptionId: 'test-sub',
        seq: 1,
        timestamp: new Date(),
        retryCount: 0,
      });

      expect(mockClickHouse.syncedPipelineRecords.length).toBeGreaterThan(0);
    });
  });

  // ==================== handlePipelineFailed ====================

  describe('handlePipelineFailed', () => {
    it('should save failed pipeline record', async () => {
      await handler.start();

      const event = new CloudEvent({
        type: 'pipeline.run.failed',
        source: 'orion-pipeline',
        data: {
          pipelineId: 'pipe-1',
          pipelineVersion: 'v1.0.0',
          runId: 'run-failed',
          status: 'failed',
          triggerType: 'push',
          error: 'Build failed',
          durationMs: 30000,
          timestamp: '2026-04-12T00:00:00Z',
        },
      });

      const handler_fn = mockEventBus.subscriptions.get('pipeline.run.failed');
      await handler_fn!(event, {
        subscriptionId: 'test-sub',
        seq: 2,
        timestamp: new Date(),
        retryCount: 0,
      });

      const records = await fakeStorage.getPipelineRecords();
      expect(records).toHaveLength(1);
      expect(records[0].status).toBe('failed');
      expect(records[0].runId).toBe('run-failed');
    });
  });

  // ==================== handleDeploymentCompleted ====================

  describe('handleDeploymentCompleted', () => {
    it('should save deployment record', async () => {
      await handler.start();

      const event = new CloudEvent({
        type: 'deployment.completed',
        source: 'orion-deploy',
        data: {
          deploymentId: 'deploy-1',
          service: 'api-gateway',
          environment: 'production',
          status: 'success',
          version: 'v1.2.3',
          durationMs: 120000,
          timestamp: '2026-04-12T00:00:00Z',
        },
        extensions: {
          tenantId: 'tenant-001',
        },
      });

      const handler_fn = mockEventBus.subscriptions.get('deployment.completed');
      await handler_fn!(event, {
        subscriptionId: 'test-sub',
        seq: 3,
        timestamp: new Date(),
        retryCount: 0,
      });

      const records = await fakeStorage.getDeploymentRecords();
      expect(records).toHaveLength(1);
      expect(records[0].deploymentId).toBe('deploy-1');
      expect(records[0].service).toBe('api-gateway');
      expect(records[0].status).toBe('success');
    });
  });

  // ==================== handleDeploymentFailed ====================

  describe('handleDeploymentFailed', () => {
    it('should save failed deployment record', async () => {
      await handler.start();

      const event = new CloudEvent({
        type: 'deployment.failed',
        source: 'orion-deploy',
        data: {
          deploymentId: 'deploy-failed',
          service: 'api-gateway',
          environment: 'staging',
          error: 'Container crashed',
          phase: 'deployment',
          timestamp: '2026-04-12T00:00:00Z',
        },
        extensions: {
          tenantId: 'tenant-001',
        },
      });

      const handler_fn = mockEventBus.subscriptions.get('deployment.failed');
      await handler_fn!(event, {
        subscriptionId: 'test-sub',
        seq: 4,
        timestamp: new Date(),
        retryCount: 0,
      });

      const records = await fakeStorage.getDeploymentRecords();
      expect(records).toHaveLength(1);
      expect(records[0].status).toBe('failed');
      expect(records[0].deploymentId).toBe('deploy-failed');
    });
  });

  // ==================== handleDeploymentRolledBack ====================

  describe('handleDeploymentRolledBack', () => {
    it('should save rolled back deployment record', async () => {
      await handler.start();

      const event = new CloudEvent({
        type: 'deployment.rolled_back',
        source: 'orion-deploy',
        data: {
          deploymentId: 'deploy-rollback',
          service: 'api-gateway',
          environment: 'production',
          rollbackToVersion: 'v1.2.2',
          recoveryTimeMs: 3600000,
          timestamp: '2026-04-12T00:00:00Z',
        },
        extensions: {
          tenantId: 'tenant-001',
        },
      });

      const handler_fn = mockEventBus.subscriptions.get('deployment.rolled_back');
      await handler_fn!(event, {
        subscriptionId: 'test-sub',
        seq: 5,
        timestamp: new Date(),
        retryCount: 0,
      });

      const records = await fakeStorage.getDeploymentRecords();
      expect(records).toHaveLength(1);
      expect(records[0].status).toBe('rolled_back');
      expect(records[0].recoveryTimeMs).toBe(3600000);
    });
  });

  // ==================== getDoraReport ====================

  describe('getDoraReport', () => {
    it('should generate DORA report from stored records', async () => {
      const referenceDate = new Date('2026-04-13T00:00:00Z');

      // Pre-populate storage via the handler
      await fakeStorage.savePipelineRecord({
        id: 'p1',
        runId: 'run-1',
        pipelineId: 'pipe-1',
        status: 'success',
        triggerType: 'push',
        durationMs: 60000,
        completedAt: new Date('2026-04-12T00:00:00Z'),
        syncedToClickHouse: false,
        tenantId: 'tenant-001',
      });

      await fakeStorage.saveDeploymentRecord({
        id: 'd1',
        deploymentId: 'deploy-1',
        service: 'api',
        environment: 'production',
        status: 'success',
        deployedAt: new Date('2026-04-12T00:00:00Z'),
        syncedToClickHouse: false,
        tenantId: 'tenant-001',
      });

      const report = await handler.getDoraReport('tenant-001', 'week', 1, referenceDate);

      expect(report).toBeDefined();
      expect(report.reportId).toBeDefined();
      expect(report.tenantId).toBe('tenant-001');
      expect(report.deploymentFrequency.totalDeployments).toBe(1);
      expect(report.leadTimeForChanges.totalChanges).toBe(1);
    });
  });

  // ==================== flushToClickHouse ====================

  describe('flushToClickHouse', () => {
    it('should flush pending records to ClickHouse', async () => {
      await handler.flushToClickHouse();

      expect(mockClickHouse.flushedRecords).toBe(true);
    });

    it('should handle missing ClickHouse sync gracefully', async () => {
      const handlerWithoutCH = createHandler({
        eventBus: mockEventBus as any,
        doraMetricsService: mockDoraService,
        clickHouseSync: undefined,
      });

      await expect(handlerWithoutCH.flushToClickHouse()).resolves.not.toThrow();
      await handlerWithoutCH.stop();
    });
  });

  // ==================== setLocalStorage ====================

  describe('setLocalStorage', () => {
    it('should allow custom local storage injection', async () => {
      const customStorage: LocalStorage = {
        savePipelineRecord: jest.fn(),
        getPipelineRecords: jest.fn().mockResolvedValue([]),
        saveDeploymentRecord: jest.fn(),
        getDeploymentRecords: jest.fn().mockResolvedValue([]),
        getUnsyncedPipelineRecords: jest.fn().mockResolvedValue([]),
        getUnsyncedDeploymentRecords: jest.fn().mockResolvedValue([]),
        markPipelineSynced: jest.fn(),
        markDeploymentSynced: jest.fn(),
      };

      handler.setLocalStorage(customStorage);
      expect(handler.getLocalStorage()).toBe(customStorage);
    });
  });

  // ==================== PostgreSQL requirement ====================

  describe('PostgreSQL requirement', () => {
    it('should require db config (EfficiencyEventHandlerConfig.db is mandatory)', () => {
      // Verify the constructor signature requires db by checking config type
      const config: EfficiencyEventHandlerConfig = {
        doraMetricsService: mockDoraService,
        db: createMockDb(),
      };
      const h = new EfficiencyEventHandler(config);
      expect(h).toBeDefined();
    });
  });
});
