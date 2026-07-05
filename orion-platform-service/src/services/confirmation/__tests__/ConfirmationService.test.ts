/**
 * ConfirmationService - Comprehensive Test Suite
 *
 * Tests all 10 public methods:
 * create, getById, list, approve, reject, batchApprove,
 * getAuditLogs, getNotificationSettings, updateNotificationSettings, getStats
 *
 * Uses mock ConfirmationRepository pattern (in-memory stores).
 */

import { ConfirmationService } from '../ConfirmationService';
import {
  ConfirmationRepository,
  ConfirmationEntity,
  ConfirmationAuditEntity,
  NotificationSettingsEntity,
} from '../../../repositories/ConfirmationRepository';

// ==================== In-memory stores ====================

let confirmationStore: Map<string, ConfirmationEntity>;
let auditStore: ConfirmationAuditEntity[];
let settingsStore: Map<string, NotificationSettingsEntity>;
let idCounter: number;

// ==================== Mock Repository ====================

function createMockRepo() {
  return {
    insert: jest.fn(async (data: {
      sceneType: string; priority: string; aiSuggestion: string;
      aiConfidence: number; context?: Record<string, unknown>; tenantId?: string; id?: string;
    }): Promise<ConfirmationEntity> => {
      const now = new Date();
      const entityId = data.id ?? `conf-${++idCounter}`;
      const entity: ConfirmationEntity = {
        id: entityId,
        scene_type: data.sceneType,
        priority: data.priority as ConfirmationEntity['priority'],
        ai_suggestion: data.aiSuggestion,
        ai_confidence: data.aiConfidence,
        status: 'pending',
        push_time: now,
        response_time: null,
        responder: null,
        comment: null,
        context: data.context ?? null,
        tenant_id: data.tenantId ?? null,
        created_at: now,
      };
      confirmationStore.set(entityId, entity);
      return { ...entity };
    }),

    findById: jest.fn(async (id: string): Promise<ConfirmationEntity | null> => {
      const e = confirmationStore.get(id);
      return e ? { ...e } : null;
    }),

    findAll: jest.fn(async (params?: {
      sceneType?: string; priority?: string; status?: string;
      tenantId?: string; offset?: number; limit?: number;
    }): Promise<{ entities: ConfirmationEntity[]; total: number }> => {
      let results = Array.from(confirmationStore.values());
      if (params?.sceneType) results = results.filter(e => e.scene_type === params.sceneType);
      if (params?.priority) results = results.filter(e => e.priority === params.priority);
      if (params?.status) results = results.filter(e => e.status === params.status);
      if (params?.tenantId) results = results.filter(e => e.tenant_id === params.tenantId);
      // Sort by push_time descending
      results.sort((a, b) => b.push_time.getTime() - a.push_time.getTime());
      const total = results.length;
      const offset = params?.offset ?? 0;
      const limit = params?.limit ?? 50;
      const entities = results.slice(offset, offset + limit).map(e => ({ ...e }));
      return { entities, total };
    }),

    updateStatus: jest.fn(async (
      id: string, status: string, responder?: string, comment?: string, responseTime?: Date
    ): Promise<boolean> => {
      const entity = confirmationStore.get(id);
      if (!entity) return false;
      entity.status = status as ConfirmationEntity['status'];
      entity.responder = responder ?? null;
      entity.comment = comment ?? null;
      entity.response_time = responseTime ?? null;
      confirmationStore.set(id, entity);
      return true;
    }),

    delete: jest.fn(async (id: string): Promise<boolean> => {
      return confirmationStore.delete(id);
    }),

    insertAudit: jest.fn(async (data: {
      confirmationId: string; action: string; user: string; details?: string;
    }): Promise<ConfirmationAuditEntity> => {
      const entity: ConfirmationAuditEntity = {
        id: `audit-${++idCounter}`,
        confirmation_id: data.confirmationId,
        action: data.action,
        user: data.user,
        timestamp: new Date(),
        details: data.details ?? null,
      };
      auditStore.push(entity);
      return { ...entity };
    }),

    findAuditsByConfirmation: jest.fn(async (confirmationId: string): Promise<ConfirmationAuditEntity[]> => {
      return auditStore
        .filter(a => a.confirmation_id === confirmationId)
        .map(a => ({ ...a }));
    }),

    findAllAudits: jest.fn(async (params?: {
      user?: string; tenantId?: string; startDate?: string; endDate?: string;
      offset?: number; limit?: number;
    }): Promise<{ entities: ConfirmationAuditEntity[]; total: number }> => {
      let results = [...auditStore];
      if (params?.user) results = results.filter(a => a.user === params.user);
      // Sort by timestamp descending
      results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      const total = results.length;
      const offset = params?.offset ?? 0;
      const limit = params?.limit ?? 100;
      const entities = results.slice(offset, offset + limit).map(a => ({ ...a }));
      return { entities, total };
    }),

    findNotificationSettings: jest.fn(async (userId: string): Promise<NotificationSettingsEntity | null> => {
      const s = settingsStore.get(userId);
      return s ? { ...s } : null;
    }),

    upsertNotificationSettings: jest.fn(async (data: {
      userId: string; channels: string[]; dndStart: string; dndEnd: string;
      autoApproveP3: boolean; autoApproveAfterMinutes: number;
    }): Promise<NotificationSettingsEntity> => {
      const now = new Date();
      const existing = settingsStore.get(data.userId);
      const entity: NotificationSettingsEntity = {
        id: existing?.id ?? `settings-${++idCounter}`,
        user_id: data.userId,
        channels: data.channels,
        dnd_start: data.dndStart,
        dnd_end: data.dndEnd,
        auto_approve_p3: data.autoApproveP3,
        auto_approve_after_minutes: data.autoApproveAfterMinutes,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      settingsStore.set(data.userId, entity);
      return { ...entity };
    }),

    getStats: jest.fn(async (tenantId?: string): Promise<{
      total: number; pending: number; confirmed: number; rejected: number; expired: number;
    }> => {
      let all = Array.from(confirmationStore.values());
      if (tenantId) all = all.filter(e => e.tenant_id === tenantId);
      return {
        total: all.length,
        pending: all.filter(e => e.status === 'pending').length,
        confirmed: all.filter(e => e.status === 'confirmed').length,
        rejected: all.filter(e => e.status === 'rejected').length,
        expired: all.filter(e => e.status === 'expired').length,
      };
    }),
  };
}

describe('ConfirmationService', () => {
  let service: ConfirmationService;
  let mockRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    confirmationStore = new Map();
    auditStore = [];
    settingsStore = new Map();
    idCounter = 0;
    jest.clearAllMocks();
    mockRepo = createMockRepo();
    service = new ConfirmationService(mockRepo as any as ConfirmationRepository);
  });

  // ==========================================================================
  // CONSTRUCTOR TESTS
  // ==========================================================================

  describe('constructor', () => {
    test('should work without repository (in-memory mode)', () => {
      const service = new ConfirmationService();
      expect(service).toBeDefined();
    });
  });

  // ==========================================================================
  // CREATE TESTS
  // ==========================================================================

  describe('create', () => {
    test('should create a confirmation with minimal required fields', async () => {
      const result = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Rollback to previous version',
        aiConfidence: 0.85,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.sceneType).toBe('deploy');
      expect(result.priority).toBe('P1');
      expect(result.aiSuggestion).toBe('Rollback to previous version');
      expect(result.aiConfidence).toBe(0.85);
      expect(result.status).toBe('pending');
      expect(result.pushTime).toBeDefined();
      expect(result.context).toBeUndefined();
      expect(result.tenantId).toBeUndefined();
    });

    test('should create a confirmation with P0 priority', async () => {
      const result = await service.create({
        sceneType: 'incident',
        priority: 'P0',
        aiSuggestion: 'Immediate shutdown required',
        aiConfidence: 0.99,
      });

      expect(result.priority).toBe('P0');
      expect(result.status).toBe('pending');
    });

    test('should create a confirmation with P2 priority', async () => {
      const result = await service.create({
        sceneType: 'config-change',
        priority: 'P2',
        aiSuggestion: 'Update rate limit configuration',
        aiConfidence: 0.70,
      });

      expect(result.priority).toBe('P2');
    });

    test('should create a confirmation with P3 priority', async () => {
      const result = await service.create({
        sceneType: 'optimization',
        priority: 'P3',
        aiSuggestion: 'Optimize cache TTL',
        aiConfidence: 0.60,
      });

      expect(result.priority).toBe('P3');
    });

    test('should create a confirmation with context', async () => {
      const context = { service: 'api-gateway', region: 'us-east-1', metrics: { latency: 500 } };
      const result = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy hotfix',
        aiConfidence: 0.90,
        context,
      });

      expect(result.context).toEqual(context);
    });

    test('should create a confirmation with tenantId', async () => {
      const result = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy to staging',
        aiConfidence: 0.80,
        tenantId: 'tenant-123',
      });

      expect(result.tenantId).toBe('tenant-123');
    });

    test('should create a confirmation with all optional fields', async () => {
      const context = { key: 'value' };
      const result = await service.create({
        sceneType: 'scaling',
        priority: 'P0',
        aiSuggestion: 'Scale up immediately',
        aiConfidence: 0.95,
        context,
        tenantId: 'tenant-456',
      });

      expect(result.sceneType).toBe('scaling');
      expect(result.priority).toBe('P0');
      expect(result.aiSuggestion).toBe('Scale up immediately');
      expect(result.aiConfidence).toBe(0.95);
      expect(result.status).toBe('pending');
      expect(result.context).toEqual(context);
      expect(result.tenantId).toBe('tenant-456');
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    test('should generate unique IDs for each confirmation', async () => {
      const r1 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'First',
        aiConfidence: 0.8,
      });
      const r2 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Second',
        aiConfidence: 0.8,
      });

      expect(r1.id).not.toBe(r2.id);
    });

    test('should set pushTime to current timestamp', async () => {
      const before = Date.now();
      const result = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });
      const after = Date.now();

      const pushTime = new Date(result.pushTime).getTime();
      expect(pushTime).toBeGreaterThanOrEqual(before);
      expect(pushTime).toBeLessThanOrEqual(after);
    });
  });

  // ==========================================================================
  // GET BY ID TESTS
  // ==========================================================================

  describe('getById', () => {
    test('should return confirmation when it exists', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const found = await service.getById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.sceneType).toBe('deploy');
    });

    test('should return null when confirmation does not exist', async () => {
      const result = await service.getById('non-existent-id');

      expect(result).toBeNull();
    });

    test('should return the full confirmation object', async () => {
      const context = { env: 'prod' };
      const created = await service.create({
        sceneType: 'rollback',
        priority: 'P0',
        aiSuggestion: 'Rollback',
        aiConfidence: 0.95,
        context,
        tenantId: 't-1',
      });

      const found = await service.getById(created.id);

      expect(found).not.toBeNull();
      expect(found!.sceneType).toBe('rollback');
      expect(found!.priority).toBe('P0');
      expect(found!.aiConfidence).toBe(0.95);
      expect(found!.context).toEqual(context);
      expect(found!.tenantId).toBe('t-1');
    });
  });

  // ==========================================================================
  // LIST TESTS
  // ==========================================================================

  describe('list', () => {
    test('should return empty array when no confirmations exist', async () => {
      const result = await service.list();

      expect(result).toEqual([]);
    });

    test('should return all confirmations with no filter', async () => {
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });
      await service.create({
        sceneType: 'rollback',
        priority: 'P2',
        aiSuggestion: 'B',
        aiConfidence: 0.7,
      });

      const result = await service.list();

      expect(result.length).toBe(2);
    });

    test('should filter by sceneType', async () => {
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy 1',
        aiConfidence: 0.8,
      });
      await service.create({
        sceneType: 'rollback',
        priority: 'P1',
        aiSuggestion: 'Rollback 1',
        aiConfidence: 0.8,
      });
      await service.create({
        sceneType: 'deploy',
        priority: 'P2',
        aiSuggestion: 'Deploy 2',
        aiConfidence: 0.7,
      });

      const result = await service.list({ sceneType: 'deploy' });

      expect(result.length).toBe(2);
      expect(result.every(r => r.sceneType === 'deploy')).toBe(true);
    });

    test('should filter by priority', async () => {
      await service.create({
        sceneType: 'deploy',
        priority: 'P0',
        aiSuggestion: 'A',
        aiConfidence: 0.9,
      });
      await service.create({
        sceneType: 'deploy',
        priority: 'P3',
        aiSuggestion: 'B',
        aiConfidence: 0.5,
      });

      const result = await service.list({ priority: 'P0' });

      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('P0');
    });

    test('should filter by status', async () => {
      const c1 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'B',
        aiConfidence: 0.8,
      });

      await service.approve(c1.id, { responder: 'admin' });

      const pendingResult = await service.list({ status: 'pending' });
      const confirmedResult = await service.list({ status: 'confirmed' });

      expect(pendingResult.length).toBe(1);
      expect(confirmedResult.length).toBe(1);
    });

    test('should filter by tenantId', async () => {
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
        tenantId: 'tenant-A',
      });
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'B',
        aiConfidence: 0.8,
        tenantId: 'tenant-B',
      });

      const result = await service.list({ tenantId: 'tenant-A' });

      expect(result.length).toBe(1);
      expect(result[0].tenantId).toBe('tenant-A');
    });

    test('should apply multiple filters together', async () => {
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
        tenantId: 't-1',
      });
      await service.create({
        sceneType: 'deploy',
        priority: 'P2',
        aiSuggestion: 'B',
        aiConfidence: 0.7,
        tenantId: 't-1',
      });
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'C',
        aiConfidence: 0.9,
        tenantId: 't-2',
      });

      const result = await service.list({ sceneType: 'deploy', priority: 'P1', tenantId: 't-1' });

      expect(result.length).toBe(1);
      expect(result[0].aiSuggestion).toBe('A');
    });

    test('should paginate with offset and limit', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({
          sceneType: 'deploy',
          priority: 'P1',
          aiSuggestion: `Item ${i}`,
          aiConfidence: 0.8,
        });
      }

      const page1 = await service.list({ offset: 0, limit: 2 });
      const page2 = await service.list({ offset: 2, limit: 2 });
      const page3 = await service.list({ offset: 4, limit: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      expect(page3.length).toBe(1);
    });

    test('should use default limit of 50', async () => {
      for (let i = 0; i < 60; i++) {
        await service.create({
          sceneType: 'deploy',
          priority: 'P1',
          aiSuggestion: `Item ${i}`,
          aiConfidence: 0.8,
        });
      }

      const result = await service.list();

      expect(result.length).toBe(50);
    });

    test('should sort by pushTime descending', async () => {
      const c1 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'First',
        aiConfidence: 0.8,
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      const c2 = await service.create({
        sceneType: 'deploy',
        priority: 'P2',
        aiSuggestion: 'Second',
        aiConfidence: 0.7,
      });

      const result = await service.list();

      expect(result[0].id).toBe(c2.id);
      expect(result[1].id).toBe(c1.id);
    });
  });

  // ==========================================================================
  // APPROVE TESTS
  // ==========================================================================

  describe('approve', () => {
    test('should approve a pending confirmation', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const result = await service.approve(created.id, {
        responder: 'admin',
        comment: 'Looks good',
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('confirmed');
      expect(result!.responder).toBe('admin');
      expect(result!.comment).toBe('Looks good');
      expect(result!.responseTime).toBeDefined();
    });

    test('should set status to confirmed', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      await service.approve(created.id, { responder: 'admin' });

      const updated = await service.getById(created.id);
      expect(updated!.status).toBe('confirmed');
    });

    test('should set responseTime', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const before = Date.now();
      const result = await service.approve(created.id, { responder: 'admin' });
      const after = Date.now();

      const responseTime = new Date(result!.responseTime!).getTime();
      expect(responseTime).toBeGreaterThanOrEqual(before);
      expect(responseTime).toBeLessThanOrEqual(after);
    });

    test('should use default responder "system" when not provided', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const result = await service.approve(created.id, {});

      expect(result!.responder).toBe('system');
    });

    test('should use reason as comment when comment is not provided', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const result = await service.approve(created.id, {
        reason: 'Approved via reason field',
        responder: 'admin',
      });

      expect(result!.comment).toBe('Approved via reason field');
    });

    test('should return null when confirmation does not exist', async () => {
      const result = await service.approve('non-existent', { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should return null when already confirmed', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      await service.approve(created.id, { responder: 'admin' });
      const result = await service.approve(created.id, { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should return null when already rejected', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      await service.reject(created.id, { responder: 'admin' });
      const result = await service.approve(created.id, { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should create audit log entry on approval', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      await service.approve(created.id, {
        responder: 'admin',
        comment: 'Approved for production',
      });

      const logs = await service.getAuditLogs({ confirmationId: created.id });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('approved');
      expect(logs[0].user).toBe('admin');
      expect(logs[0].confirmationId).toBe(created.id);
      expect(logs[0].details).toBe('Approved for production');
    });
  });

  // ==========================================================================
  // REJECT TESTS
  // ==========================================================================

  describe('reject', () => {
    test('should reject a pending confirmation', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const result = await service.reject(created.id, {
        responder: 'admin',
        comment: 'Too risky',
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('rejected');
      expect(result!.responder).toBe('admin');
      expect(result!.comment).toBe('Too risky');
      expect(result!.responseTime).toBeDefined();
    });

    test('should set status to rejected', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      await service.reject(created.id, { responder: 'admin' });

      const updated = await service.getById(created.id);
      expect(updated!.status).toBe('rejected');
    });

    test('should set responseTime', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const before = Date.now();
      const result = await service.reject(created.id, { responder: 'admin' });
      const after = Date.now();

      const responseTime = new Date(result!.responseTime!).getTime();
      expect(responseTime).toBeGreaterThanOrEqual(before);
      expect(responseTime).toBeLessThanOrEqual(after);
    });

    test('should use default responder "system" when not provided', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const result = await service.reject(created.id, {});

      expect(result!.responder).toBe('system');
    });

    test('should return null when confirmation does not exist', async () => {
      const result = await service.reject('non-existent', { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should return null when already rejected', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      await service.reject(created.id, { responder: 'admin' });
      const result = await service.reject(created.id, { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should return null when already confirmed', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      await service.approve(created.id, { responder: 'admin' });
      const result = await service.reject(created.id, { responder: 'admin' });

      expect(result).toBeNull();
    });

    test('should create audit log entry on rejection', async () => {
      const created = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      await service.reject(created.id, {
        responder: 'admin',
        comment: 'Rejected for production',
      });

      const logs = await service.getAuditLogs({ confirmationId: created.id });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('rejected');
      expect(logs[0].user).toBe('admin');
      expect(logs[0].confirmationId).toBe(created.id);
      expect(logs[0].details).toBe('Rejected for production');
    });
  });

  // ==========================================================================
  // BATCH APPROVE TESTS
  // ==========================================================================

  describe('batchApprove', () => {
    test('should approve multiple confirmations successfully', async () => {
      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P2', aiSuggestion: 'B', aiConfidence: 0.7,
      });
      const c3 = await service.create({
        sceneType: 'deploy', priority: 'P3', aiSuggestion: 'C', aiConfidence: 0.6,
      });

      const result = await service.batchApprove({
        ids: [c1.id, c2.id, c3.id],
        responder: 'admin',
        comment: 'Batch approved',
      });

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.details.length).toBe(3);
      expect(result.details.every(d => d.status === 'confirmed')).toBe(true);
    });

    test('should handle non-existent IDs in batch', async () => {
      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });

      const result = await service.batchApprove({
        ids: [c1.id, 'non-existent-1', 'non-existent-2'],
        responder: 'admin',
      });

      expect(result.success).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.details.length).toBe(3);

      const successDetail = result.details.find(d => d.id === c1.id);
      expect(successDetail!.status).toBe('confirmed');

      const failedDetails = result.details.filter(d => d.status === 'failed');
      expect(failedDetails.length).toBe(2);
    });

    test('should return empty result for empty ids array', async () => {
      const result = await service.batchApprove({
        ids: [],
        responder: 'admin',
      });

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.details).toEqual([]);
    });

    test('should handle all non-existent IDs', async () => {
      const result = await service.batchApprove({
        ids: ['id-1', 'id-2', 'id-3'],
        responder: 'admin',
      });

      expect(result.success).toBe(0);
      expect(result.failed).toBe(3);
      expect(result.details.every(d => d.status === 'failed')).toBe(true);
    });

    test('should skip already approved confirmations in batch', async () => {
      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'B', aiConfidence: 0.8,
      });

      await service.approve(c1.id, { responder: 'admin' });

      const result = await service.batchApprove({
        ids: [c1.id, c2.id],
        responder: 'admin',
      });

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });

    test('should propagate comment to all approvals', async () => {
      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'B', aiConfidence: 0.8,
      });

      await service.batchApprove({
        ids: [c1.id, c2.id],
        comment: 'Batch approval comment',
        responder: 'admin',
      });

      const updated1 = await service.getById(c1.id);
      const updated2 = await service.getById(c2.id);

      expect(updated1!.comment).toBe('Batch approval comment');
      expect(updated2!.comment).toBe('Batch approval comment');
    });
  });

  // ==========================================================================
  // AUDIT LOGS TESTS
  // ==========================================================================

  describe('getAuditLogs', () => {
    test('should return empty array when no logs exist', async () => {
      const result = await service.getAuditLogs();

      expect(result).toEqual([]);
    });

    test('should return logs for a specific confirmationId', async () => {
      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'B', aiConfidence: 0.8,
      });

      await service.approve(c1.id, { responder: 'admin', comment: 'Approved c1' });
      await service.reject(c2.id, { responder: 'reviewer', comment: 'Rejected c2' });

      const c1Logs = await service.getAuditLogs({ confirmationId: c1.id });
      const c2Logs = await service.getAuditLogs({ confirmationId: c2.id });

      expect(c1Logs.length).toBe(1);
      expect(c1Logs[0].action).toBe('approved');
      expect(c2Logs.length).toBe(1);
      expect(c2Logs[0].action).toBe('rejected');
    });

    test('should filter logs by user', async () => {
      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'B', aiConfidence: 0.8,
      });

      await service.approve(c1.id, { responder: 'admin' });
      await service.reject(c2.id, { responder: 'reviewer' });

      const adminLogs = await service.getAuditLogs({ user: 'admin' });
      const reviewerLogs = await service.getAuditLogs({ user: 'reviewer' });

      expect(adminLogs.length).toBe(1);
      expect(adminLogs[0].user).toBe('admin');
      expect(reviewerLogs.length).toBe(1);
      expect(reviewerLogs[0].user).toBe('reviewer');
    });

    test('should paginate audit logs', async () => {
      for (let i = 0; i < 5; i++) {
        const c = await service.create({
          sceneType: 'deploy', priority: 'P1', aiSuggestion: `Item ${i}`, aiConfidence: 0.8,
        });
        await service.approve(c.id, { responder: 'admin' });
      }

      const page1 = await service.getAuditLogs({ offset: 0, limit: 2 });
      const page2 = await service.getAuditLogs({ offset: 2, limit: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    test('should use default limit of 100', async () => {
      for (let i = 0; i < 105; i++) {
        const c = await service.create({
          sceneType: 'deploy', priority: 'P1', aiSuggestion: `Item ${i}`, aiConfidence: 0.8,
        });
        await service.approve(c.id, { responder: 'admin' });
      }

      const result = await service.getAuditLogs();

      expect(result.length).toBe(100);
    });

    test('should sort audit logs by timestamp descending', async () => {
      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'First', aiConfidence: 0.8,
      });
      await service.approve(c1.id, { responder: 'admin' });

      await new Promise(resolve => setTimeout(resolve, 10));

      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'Second', aiConfidence: 0.8,
      });
      await service.approve(c2.id, { responder: 'admin' });

      const logs = await service.getAuditLogs();

      expect(logs[0].confirmationId).toBe(c2.id);
      expect(logs[1].confirmationId).toBe(c1.id);
    });

    test('should return logs with all expected fields', async () => {
      const c = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });

      await service.approve(c.id, { responder: 'admin', comment: 'Test comment' });

      const logs = await service.getAuditLogs({ confirmationId: c.id });

      expect(logs[0]).toHaveProperty('id');
      expect(logs[0]).toHaveProperty('confirmationId');
      expect(logs[0]).toHaveProperty('action');
      expect(logs[0]).toHaveProperty('user');
      expect(logs[0]).toHaveProperty('timestamp');
      expect(logs[0]).toHaveProperty('details');
      expect(logs[0].id.length).toBeGreaterThan(0);
      expect(typeof logs[0].timestamp).toBe('string');
    });
  });

  // ==========================================================================
  // NOTIFICATION SETTINGS TESTS
  // ==========================================================================

  describe('getNotificationSettings', () => {
    test('should return default settings for new user', async () => {
      const settings = await service.getNotificationSettings('user-1');

      expect(settings.userId).toBe('user-1');
      expect(settings.channels).toEqual(['email', 'slack']);
      expect(settings.dndStart).toBe('22:00');
      expect(settings.dndEnd).toBe('08:00');
      expect(settings.autoApproveP3).toBe(false);
      expect(settings.autoApproveAfterMinutes).toBe(30);
    });

    test('should return same defaults for different users', async () => {
      const settings1 = await service.getNotificationSettings('user-1');
      const settings2 = await service.getNotificationSettings('user-2');

      expect(settings1.channels).toEqual(settings2.channels);
      expect(settings1.dndStart).toBe(settings2.dndStart);
      expect(settings1.autoApproveP3).toBe(settings2.autoApproveP3);
    });

    test('should return cached settings for existing user', async () => {
      await service.updateNotificationSettings('user-1', {
        channels: ['pagerduty'],
        autoApproveP3: true,
      });

      const fetched = await service.getNotificationSettings('user-1');

      expect(fetched.channels).toEqual(['pagerduty']);
      expect(fetched.autoApproveP3).toBe(true);
    });
  });

  describe('updateNotificationSettings', () => {
    test('should update channels', async () => {
      const result = await service.updateNotificationSettings('user-1', {
        channels: ['pagerduty', 'email'],
      });

      expect(result.channels).toEqual(['pagerduty', 'email']);
    });

    test('should update DND times', async () => {
      const result = await service.updateNotificationSettings('user-1', {
        dndStart: '23:00',
        dndEnd: '07:00',
      });

      expect(result.dndStart).toBe('23:00');
      expect(result.dndEnd).toBe('07:00');
    });

    test('should update autoApproveP3', async () => {
      const result = await service.updateNotificationSettings('user-1', {
        autoApproveP3: true,
      });

      expect(result.autoApproveP3).toBe(true);
    });

    test('should update autoApproveAfterMinutes', async () => {
      const result = await service.updateNotificationSettings('user-1', {
        autoApproveAfterMinutes: 60,
      });

      expect(result.autoApproveAfterMinutes).toBe(60);
    });

    test('should preserve unchanged fields during partial update', async () => {
      await service.updateNotificationSettings('user-1', {
        channels: ['slack'],
      });

      const settings = await service.getNotificationSettings('user-1');

      expect(settings.channels).toEqual(['slack']);
      expect(settings.dndStart).toBe('22:00');
      expect(settings.dndEnd).toBe('08:00');
      expect(settings.autoApproveP3).toBe(false);
    });

    test('should persist changes across get calls', async () => {
      await service.updateNotificationSettings('user-persist', {
        channels: ['webhook'],
        dndStart: '20:00',
        autoApproveP3: true,
        autoApproveAfterMinutes: 15,
      });

      const settings = await service.getNotificationSettings('user-persist');

      expect(settings.channels).toEqual(['webhook']);
      expect(settings.dndStart).toBe('20:00');
      expect(settings.dndEnd).toBe('08:00');
      expect(settings.autoApproveP3).toBe(true);
      expect(settings.autoApproveAfterMinutes).toBe(15);
    });

    test('should maintain userId during update', async () => {
      const result = await service.updateNotificationSettings('user-1', {
        channels: ['email'],
      });

      expect(result.userId).toBe('user-1');
    });

    test('should allow multiple sequential updates', async () => {
      await service.updateNotificationSettings('user-1', { channels: ['a'] });
      await service.updateNotificationSettings('user-1', { channels: ['b'] });
      await service.updateNotificationSettings('user-1', { channels: ['c'] });

      const settings = await service.getNotificationSettings('user-1');
      expect(settings.channels).toEqual(['c']);
    });
  });

  // ==========================================================================
  // STATS TESTS
  // ==========================================================================

  describe('getStats', () => {
    test('should return zero counts when no confirmations exist', async () => {
      const stats = await service.getStats();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.confirmed).toBe(0);
      expect(stats.rejected).toBe(0);
      expect(stats.expired).toBe(0);
    });

    test('should count total confirmations', async () => {
      await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      await service.create({
        sceneType: 'deploy', priority: 'P2', aiSuggestion: 'B', aiConfidence: 0.7,
      });

      const stats = await service.getStats();

      expect(stats.total).toBe(2);
    });

    test('should count pending confirmations', async () => {
      await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'B', aiConfidence: 0.8,
      });
      await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'C', aiConfidence: 0.8,
      });

      await service.approve(c2.id, { responder: 'admin' });

      const stats = await service.getStats();

      expect(stats.pending).toBe(2);
      expect(stats.confirmed).toBe(1);
    });

    test('should count confirmed confirmations', async () => {
      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'B', aiConfidence: 0.8,
      });

      await service.approve(c1.id, { responder: 'admin' });
      await service.approve(c2.id, { responder: 'admin' });

      const stats = await service.getStats();

      expect(stats.confirmed).toBe(2);
    });

    test('should count rejected confirmations', async () => {
      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'B', aiConfidence: 0.8,
      });
      await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'C', aiConfidence: 0.8,
      });

      await service.reject(c1.id, { responder: 'admin' });
      await service.reject(c2.id, { responder: 'admin' });

      const stats = await service.getStats();

      expect(stats.rejected).toBe(2);
      expect(stats.pending).toBe(1);
    });

    test('should count expired confirmations', async () => {
      const c = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8,
      });

      await service.reject(c.id, { responder: 'admin' });

      const stats = await service.getStats();

      expect(stats.expired).toBe(0);
      expect(stats.rejected).toBe(1);
      expect(stats.total).toBe(stats.pending + stats.confirmed + stats.rejected + stats.expired);
    });

    test('should filter stats by tenantId', async () => {
      await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8, tenantId: 'tenant-A',
      });
      await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'B', aiConfidence: 0.8, tenantId: 'tenant-A',
      });
      await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'C', aiConfidence: 0.8, tenantId: 'tenant-B',
      });

      const statsA = await service.getStats('tenant-A');
      const statsB = await service.getStats('tenant-B');
      const statsAll = await service.getStats();

      expect(statsA.total).toBe(2);
      expect(statsB.total).toBe(1);
      expect(statsAll.total).toBe(3);
    });

    test('should return correct counts with mixed statuses per tenant', async () => {
      const c1 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8, tenantId: 'tenant-X',
      });
      const c2 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'B', aiConfidence: 0.8, tenantId: 'tenant-X',
      });
      const c3 = await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'C', aiConfidence: 0.8, tenantId: 'tenant-X',
      });

      await service.approve(c1.id, { responder: 'admin' });
      await service.reject(c2.id, { responder: 'admin' });

      const stats = await service.getStats('tenant-X');

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.confirmed).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.expired).toBe(0);
    });

    test('should return zero for tenant with no confirmations', async () => {
      await service.create({
        sceneType: 'deploy', priority: 'P1', aiSuggestion: 'A', aiConfidence: 0.8, tenantId: 'tenant-A',
      });

      const stats = await service.getStats('non-existent-tenant');

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.confirmed).toBe(0);
      expect(stats.rejected).toBe(0);
      expect(stats.expired).toBe(0);
    });
  });

  // ==========================================================================
  // INTEGRATION / CROSS-METHOD TESTS
  // ==========================================================================

  describe('cross-method integration', () => {
    test('should maintain consistency between create, approve, list, and stats', async () => {
      const priorities = ['P0', 'P1', 'P2', 'P3', 'P1'] as const;
      const created = [];
      for (let i = 0; i < 5; i++) {
        const c = await service.create({
          sceneType: 'deploy',
          priority: priorities[i],
          aiSuggestion: `Suggestion ${i}`,
          aiConfidence: 0.5 + i * 0.1,
          tenantId: 'integration-test',
        });
        created.push(c);
      }

      await service.approve(created[0].id, { responder: 'admin' });
      await service.approve(created[1].id, { responder: 'admin' });
      await service.reject(created[2].id, { responder: 'admin' });

      const stats = await service.getStats('integration-test');
      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(2);
      expect(stats.confirmed).toBe(2);
      expect(stats.rejected).toBe(1);

      const pendingList = await service.list({ status: 'pending', tenantId: 'integration-test' });
      const confirmedList = await service.list({ status: 'confirmed', tenantId: 'integration-test' });
      const rejectedList = await service.list({ status: 'rejected', tenantId: 'integration-test' });

      expect(pendingList.length).toBe(2);
      expect(confirmedList.length).toBe(2);
      expect(rejectedList.length).toBe(1);

      const auditLogs = await service.getAuditLogs();
      expect(auditLogs.length).toBe(3);
    });

    test('full lifecycle: create -> approve -> verify audit -> check stats', async () => {
      const created = await service.create({
        sceneType: 'rollback',
        priority: 'P0',
        aiSuggestion: 'Rollback immediately',
        aiConfidence: 0.99,
        context: { incident: 'INC-001' },
        tenantId: 'lifecycle-tenant',
      });

      expect(created.status).toBe('pending');

      const approved = await service.approve(created.id, {
        responder: 'on-call-engineer',
        comment: 'Confirmed rollback needed',
      });

      expect(approved!.status).toBe('confirmed');
      expect(approved!.responder).toBe('on-call-engineer');

      const logs = await service.getAuditLogs({ confirmationId: created.id });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('approved');
      expect(logs[0].user).toBe('on-call-engineer');

      const stats = await service.getStats('lifecycle-tenant');
      expect(stats.confirmed).toBe(1);
    });
  });
});
