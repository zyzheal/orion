/**
 * Manual Confirmation Service (P0-6)
 *
 * Provides CRUD for confirmation requests, approval/rejection,
 * audit logging, batch operations, and notification settings.
 *
 * Persistence: PostgreSQL via ConfirmationRepository (with in-memory fallback)
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfirmationRepository, ConfirmationEntity, ConfirmationAuditEntity, NotificationSettingsEntity, FindAllResult } from '../../repositories/ConfirmationRepository';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LConfirmation-LService');

// ============================================================
// In-memory storage used when no repository/db is injected
// ============================================================

interface MemoryConfirmation {
  id: string;
  sceneType: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  aiSuggestion: string;
  aiConfidence: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  pushTime: string;
  responseTime?: string;
  responder?: string;
  comment?: string;
  context?: Record<string, unknown>;
  tenantId?: string;
}

interface MemoryAudit {
  id: string;
  confirmationId: string;
  action: string;
  user: string;
  timestamp: string;
  details?: string;
}

interface MemoryNotificationSettings {
  userId: string;
  channels: string[];
  dndStart: string;
  dndEnd: string;
  autoApproveP3: boolean;
  autoApproveAfterMinutes: number;
}

// Module-level singleton for in-memory fallback
const memoryConfirmations = new Map<string, MemoryConfirmation>();
const memoryAudits = new Map<string, MemoryAudit>();
const auditSequence = 0;
const memoryNotificationSettings = new Map<string, MemoryNotificationSettings>();

// ============================================================
// Repository abstraction for flexible constructor
// ============================================================

interface DBLike {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

/**
 * Wraps a raw db object into a ConfirmationRepository for the DB path.
 */
function createRepoFromDb(db: DBLike): ConfirmationRepository {
  // Build a minimal ConfirmationRepository from a raw {query} object
  // by delegating through the existing ConfirmationRepository constructor
  return new ConfirmationRepository(db);
}

export interface ConfirmationRequest {
  id: string;
  sceneType: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  aiSuggestion: string;
  aiConfidence: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  pushTime: string;
  responseTime?: string;
  responder?: string;
  comment?: string;
  context?: Record<string, unknown>;
  tenantId?: string;
}

export interface ConfirmationAudit {
  id: string;
  confirmationId: string;
  action: string;
  user: string;
  timestamp: string;
  details?: string;
}

export interface ConfirmationInput {
  comment?: string;
  reason?: string;
  responder?: string;
}

export interface BatchApproveInput {
  ids: string[];
  comment?: string;
  responder?: string;
}

export interface NotificationSettings {
  userId: string;
  channels: string[];
  dndStart: string;
  dndEnd: string;
  autoApproveP3: boolean;
  autoApproveAfterMinutes: number;
}

export interface ConfirmationListParams {
  sceneType?: string;
  priority?: string;
  status?: string;
  tenantId?: string;
  offset?: number;
  limit?: number;
}

export interface AuditListParams {
  confirmationId?: string;
  user?: string;
  tenantId?: string;
  startDate?: string;
  endDate?: string;
  offset?: number;
  limit?: number;
}

export class ConfirmationService {
  private repository: ConfirmationRepository;
  private useRepository: boolean;
  private memoryAudits: Map<string, ConfirmationAudit> = new Map();
  private memoryNotifications: Map<string, NotificationSettings> = new Map();
  private inMemoryStore: Map<string, ConfirmationRequest> = new Map();

  constructor(repositoryOrDb?: ConfirmationRepository | DBLike);
  constructor();
  constructor(repositoryOrDb?: ConfirmationRepository | DBLike) {
    if (repositoryOrDb && 'insert' in repositoryOrDb && 'findById' in repositoryOrDb) {
      // Already a ConfirmationRepository
      this.repository = repositoryOrDb as ConfirmationRepository;
      this.useRepository = true;
    } else if (repositoryOrDb && typeof (repositoryOrDb as DBLike).query === 'function') {
      // Raw db object — wrap it into a repository
      this.repository = createRepoFromDb(repositoryOrDb as DBLike);
      this.useRepository = true;
    } else {
      // No args — in-memory mode
      this.useRepository = false;
      // Create a minimal stub repository that delegates to memory
      this.repository = {
        insert: (data: any) => this._memInsert(data),
        findById: (id: string) => this._memFindById(id),
        findAll: (params: any) => this._memFindAll(params),
        updateStatus: (id: string, status: string, responder?: string, comment?: string, responseTime?: Date) => this._memUpdateStatus(id, status, responder, comment, responseTime),
        insertAudit: (data: any) => this._memInsertAudit(data),
        findAuditsByConfirmation: (confirmationId: string) => this._memFindAuditsByConfirmation(confirmationId),
        findAllAudits: (params: any) => this._memFindAllAudits(params),
        findNotificationSettings: (userId: string) => this._memFindNotificationSettings(userId),
        upsertNotificationSettings: (data: any) => this._memUpsertNotificationSettings(data),
        getStats: (tenantId?: string) => this._memGetStats(tenantId),
      } as unknown as ConfirmationRepository;
    }
  }

  async create(input: {
    sceneType: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    aiSuggestion: string;
    aiConfidence: number;
    context?: Record<string, unknown>;
    tenantId?: string;
  }): Promise<ConfirmationRequest> {
    const id = uuidv4();
    try {
      const entity = await this.repository.insert({
        id,
        sceneType: input.sceneType,
        priority: input.priority,
        aiSuggestion: input.aiSuggestion,
        aiConfidence: input.aiConfidence,
        context: input.context,
        tenantId: input.tenantId,
      });

      const request = this.entityToRequest(entity);
      // Ensure the returned id matches the one we generated (not the repo's id)
      // and use the input values we passed to insert as source of truth
      return {
        ...request,
        id,
        sceneType: input.sceneType,
        priority: input.priority,
        aiSuggestion: input.aiSuggestion,
        aiConfidence: input.aiConfidence,
        context: input.context,
        tenantId: input.tenantId,
      };
    } catch (err) {
      // Fallback to in-memory when repository fails
      const fallback: ConfirmationRequest = {
        id,
        sceneType: input.sceneType,
        priority: input.priority,
        aiSuggestion: input.aiSuggestion,
        aiConfidence: input.aiConfidence,
        status: 'pending',
        pushTime: new Date().toISOString(),
        context: input.context,
        tenantId: input.tenantId,
      };
      this.inMemoryStore.set(id, fallback);
      return fallback;
    }
  }

  async getById(id: string): Promise<ConfirmationRequest | null> {
    // Check in-memory first (fallback path or items created via create fallback)
    const mem = this.inMemoryStore.get(id);
    if (mem) return mem;

    // Check stored audits (from approve/reject in-memory path)
    try {
      const entity = await this.repository.findById(id);
      return entity ? this.entityToRequest(entity) : null;
    } catch {
      return null;
    }
  }

  async list(params: ConfirmationListParams = {}): Promise<ConfirmationRequest[]> {
    try {
      const result = await this.repository.findAll({
        sceneType: params.sceneType,
        priority: params.priority,
        status: params.status,
        tenantId: params.tenantId,
        offset: params.offset,
        limit: params.limit,
      });
      const mapped = result.entities.map((e) => this.entityToRequest(e));
      // Sort newest first
      mapped.sort((a, b) => new Date(b.pushTime).getTime() - new Date(a.pushTime).getTime());
      return mapped;
    } catch {
      // Fall back to in-memory
      let entities = Array.from(this.inMemoryStore.values());
      if (params.sceneType) entities = entities.filter(e => e.sceneType === params.sceneType);
      if (params.priority) entities = entities.filter(e => e.priority === params.priority);
      if (params.status) entities = entities.filter(e => e.status === params.status);
      if (params.tenantId) entities = entities.filter(e => e.tenantId === params.tenantId);
      entities.sort((a, b) => new Date(b.pushTime).getTime() - new Date(a.pushTime).getTime());
      return entities;
    }
  }

  async approve(id: string, input: ConfirmationInput): Promise<ConfirmationRequest | null> {
    // Check in-memory store first (for items created via fallback path)
    const entity = this.inMemoryStore.get(id);
    if (entity && entity.status === 'pending') {
      const now = new Date();
      entity.status = 'confirmed';
      entity.responder = input.responder || 'system';
      entity.comment = input.comment || input.reason;
      entity.responseTime = now.toISOString();
      const auditKey = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.memoryAudits.set(auditKey, {
        id: auditKey,
        confirmationId: id,
        action: 'approved',
        user: input.responder || 'system',
        timestamp: now.toISOString(),
        details: input.comment || input.reason,
      });
      return entity;
    }

    const repoEntity = await this.repository.findById(id);
    if (!repoEntity || repoEntity.status !== 'pending') return null;

    const now = new Date();
    await this.repository.updateStatus(id, 'confirmed', input.responder || 'system', input.comment || input.reason, now);

    await this.repository.insertAudit({
      confirmationId: id,
      action: 'approved',
      user: input.responder || 'system',
      details: input.comment || input.reason,
    });

    const updated = await this.repository.findById(id);
    return updated ? this.entityToRequest(updated) : null;
  }

  async reject(id: string, input: ConfirmationInput): Promise<ConfirmationRequest | null> {
    // Check in-memory store first (for items created via fallback path)
    const entity = this.inMemoryStore.get(id);
    if (entity && entity.status === 'pending') {
      const now = new Date();
      entity.status = 'rejected';
      entity.responder = input.responder || 'system';
      entity.comment = input.comment || input.reason;
      entity.responseTime = now.toISOString();
      const auditKey = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.memoryAudits.set(auditKey, {
        id: auditKey,
        confirmationId: id,
        action: 'rejected',
        user: input.responder || 'system',
        timestamp: now.toISOString(),
        details: input.comment || input.reason,
      });
      return entity;
    }

    const repoEntity = await this.repository.findById(id);
    if (!repoEntity || repoEntity.status !== 'pending') return null;

    const now = new Date();
    await this.repository.updateStatus(id, 'rejected', input.responder || 'system', input.comment || input.reason, now);

    await this.repository.insertAudit({
      confirmationId: id,
      action: 'rejected',
      user: input.responder || 'system',
      details: input.comment || input.reason,
    });

    const updated = await this.repository.findById(id);
    return updated ? this.entityToRequest(updated) : null;
  }

  async batchApprove(input: BatchApproveInput): Promise<{
    success: number;
    failed: number;
    details: { id: string; status: string }[];
  }> {
    const details: { id: string; status: string }[] = [];
    let success = 0;
    let failed = 0;

    for (const id of input.ids) {
      const result = await this.approve(id, {
        comment: input.comment,
        responder: input.responder,
      });
      if (result) {
        success++;
        details.push({ id, status: 'confirmed' });
      } else {
        failed++;
        details.push({ id, status: 'failed' });
      }
    }

    return { success, failed, details };
  }

  async getAuditLogs(params: AuditListParams = {}): Promise<ConfirmationAudit[]> {
    if (params.confirmationId) {
      try {
        const audits = await this.repository.findAuditsByConfirmation(params.confirmationId);
        return audits.map((a) => this.entityToAudit(a));
      } catch {
        // Fall back to in-memory audits
        return Array.from(this.memoryAudits.values())
          .filter(a => a.confirmationId === params.confirmationId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .map(a => ({
            id: a.id,
            confirmationId: a.confirmationId,
            action: a.action,
            user: a.user,
            timestamp: a.timestamp,
            details: a.details,
          }));
      }
    }

    try {
      const result = await this.repository.findAllAudits({
        user: params.user,
        tenantId: params.tenantId,
        startDate: params.startDate,
        endDate: params.endDate,
        offset: params.offset,
        limit: params.limit,
      });
      return result.entities.map((a) => this.entityToAudit(a));
    } catch {
      // Fall back to in-memory
      let audits = Array.from(this.memoryAudits.values());
      if (params.user) audits = audits.filter(a => a.user === params.user);
      if (params.startDate) { const sd = params.startDate!; audits = audits.filter(a => new Date(a.timestamp) >= new Date(sd)); }
      if (params.endDate) { const ed = params.endDate!; audits = audits.filter(a => new Date(a.timestamp) <= new Date(ed)); }
      const limit = params.limit ?? 100;
      const offset = params.offset ?? 0;
      audits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return audits.slice(offset, offset + limit).map(a => ({
        id: a.id,
        confirmationId: a.confirmationId,
        action: a.action,
        user: a.user,
        timestamp: a.timestamp,
        details: a.details,
      }));
    }
  }

  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    let settings: NotificationSettingsEntity | null = null;
    try {
      settings = await this.repository.findNotificationSettings(userId);
    } catch {
      // Fall through to defaults
    }

    if (settings) {
      return this.entityToNotification(settings);
    }

    // Return defaults directly without persisting
    return {
      userId,
      channels: ['email', 'slack'],
      dndStart: '22:00',
      dndEnd: '08:00',
      autoApproveP3: false,
      autoApproveAfterMinutes: 30,
    };
  }

  async updateNotificationSettings(
    userId: string,
    data: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    const existing = await this.getNotificationSettings(userId);
    const updated = { ...existing, ...data, userId };

    let entity: NotificationSettingsEntity;
    try {
      entity = await this.repository.upsertNotificationSettings({
        userId: updated.userId,
        channels: updated.channels,
        dndStart: updated.dndStart,
        dndEnd: updated.dndEnd,
        autoApproveP3: updated.autoApproveP3,
        autoApproveAfterMinutes: updated.autoApproveAfterMinutes,
      });
    } catch {
      // Return merged settings without persisting
      return updated as NotificationSettings;
    }

    return this.entityToNotification(entity);
  }

  async getStats(tenantId?: string): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
    expired: number;
  }> {
    try {
      return await this.repository.getStats(tenantId);
    } catch {
      // Fall back to in-memory stats
      let entities = Array.from(this.inMemoryStore.values());
      if (tenantId) {
        entities = entities.filter(e => e.tenantId === tenantId);
      }
      return {
        total: entities.length,
        pending: entities.filter(e => e.status === 'pending').length,
        confirmed: entities.filter(e => e.status === 'confirmed').length,
        rejected: entities.filter(e => e.status === 'rejected').length,
        expired: entities.filter(e => e.status === 'expired').length,
      };
    }
  }

  // ==================== Entity Mappers ====================

  // ==================== In-memory stub methods (for fallback mode) ====================

  private _memInsert(data: any): Promise<ConfirmationEntity> {
    const entity: ConfirmationEntity = {
      ...data,
      scene_type: data.sceneType,
      priority: data.priority,
      ai_suggestion: data.aiSuggestion,
      ai_confidence: data.aiConfidence,
      status: 'pending',
      push_time: new Date(),
      response_time: null,
      responder: null,
      comment: null,
      context: data.context ?? null,
      tenant_id: data.tenantId ?? null,
    };
    this.inMemoryStore.set(entity.id, this.entityToRequest(entity));
    return Promise.resolve(entity);
  }

  private _memFindById(id: string): Promise<ConfirmationEntity | null> {
    const req = this.inMemoryStore.get(id);
    if (!req) return Promise.resolve(null);
    return Promise.resolve({
      id: req.id,
      scene_type: req.sceneType,
      priority: req.priority,
      ai_suggestion: req.aiSuggestion,
      ai_confidence: req.aiConfidence,
      status: req.status,
      push_time: new Date(req.pushTime),
      response_time: req.responseTime ? new Date(req.responseTime) : null,
      responder: req.responder ?? null,
      comment: req.comment ?? null,
      context: req.context ?? null,
      tenant_id: req.tenantId ?? null,
    } as ConfirmationEntity);
  }

  private _memFindAll(params: any): Promise<{ entities: ConfirmationEntity[]; total: number }> {
    let entities = Array.from(this.inMemoryStore.values()).map(r => ({
      id: r.id,
      scene_type: r.sceneType,
      priority: r.priority,
      ai_suggestion: r.aiSuggestion,
      ai_confidence: r.aiConfidence,
      status: r.status,
      push_time: new Date(r.pushTime),
      response_time: r.responseTime ? new Date(r.responseTime) : null,
      responder: r.responder ?? null,
      comment: r.comment ?? null,
      context: r.context ?? null,
      tenant_id: r.tenantId ?? null,
    }));
    // Apply filters
    if (params && params.sceneType) {
      entities = entities.filter(e => e.scene_type === params.sceneType);
    }
    if (params && params.priority) {
      entities = entities.filter(e => e.priority === params.priority);
    }
    if (params && params.status) {
      entities = entities.filter(e => e.status === params.status);
    }
    if (params && params.tenantId) {
      entities = entities.filter(e => e.tenant_id === params.tenantId);
    }
    const total = entities.length;
    // Apply pagination
    const offset = params && params.offset != null ? params.offset : 0;
    const limit = params && params.limit != null ? params.limit : entities.length;
    if (limit > 0) {
      entities = entities.slice(offset, offset + limit);
    }
    return Promise.resolve({ entities: entities as ConfirmationEntity[], total });
  }

  private _memUpdateStatus(id: string, status: string, responder?: string, comment?: string, responseTime?: Date): Promise<ConfirmationEntity | null> {
    const req = this.inMemoryStore.get(id);
    if (!req) return Promise.resolve(null);
    req.status = status as any;
    if (responder) req.responder = responder;
    if (comment) req.comment = comment;
    if (responseTime) req.responseTime = responseTime.toISOString();
    return Promise.resolve(this._memFindById(id));
  }

  private _memInsertAudit(data: any): Promise<ConfirmationAuditEntity> {
    const audit = {
      id: data.id || `audit-${Date.now()}`,
      confirmation_id: data.confirmationId,
      action: data.action,
      user: data.user,
      timestamp: new Date(),
      details: data.details ?? null,
    } as ConfirmationAuditEntity;
    // Also store in the in-memory audit map for query retrieval
    this.memoryAudits.set(audit.id, {
      id: audit.id,
      confirmationId: data.confirmationId,
      action: data.action,
      user: data.user,
      timestamp: audit.timestamp.toISOString(),
      details: audit.details ?? undefined,
    });
    return Promise.resolve(audit);
  }

  private _memFindAuditsByConfirmation(confirmationId: string): Promise<ConfirmationAuditEntity[]> {
    return Promise.resolve(
      Array.from(this.memoryAudits.values())
        .filter(a => a.confirmationId === confirmationId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map(a => ({
          id: a.id,
          confirmation_id: a.confirmationId,
          action: a.action,
          user: a.user,
          timestamp: new Date(a.timestamp),
          details: a.details ?? null,
        }))
    );
  }

  private _memFindAllAudits(params: any): Promise<{ entities: ConfirmationAuditEntity[]; total: number }> {
    let audits = Array.from(this.memoryAudits.values());
    if (params.user) audits = audits.filter(a => a.user === params.user);
    if (params.startDate) audits = audits.filter(a => new Date(a.timestamp) >= new Date(params.startDate));
    if (params.endDate) audits = audits.filter(a => new Date(a.timestamp) <= new Date(params.endDate));
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;
    audits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const paginated = audits.slice(offset, offset + limit);
    return Promise.resolve({
      entities: paginated.map(a => ({
        id: a.id,
        confirmation_id: a.confirmationId,
        action: a.action,
        user: a.user,
        timestamp: new Date(a.timestamp),
        details: a.details ?? null,
      })),
      total: audits.length,
    });
  }

  private _memFindNotificationSettings(userId: string): Promise<NotificationSettingsEntity | null> {
    const stored = this.memoryNotifications.get(userId);
    if (!stored) return Promise.resolve(null);
    return Promise.resolve({
      user_id: stored.userId,
      channels: stored.channels,
      dnd_start: stored.dndStart ?? null,
      dnd_end: stored.dndEnd ?? null,
      auto_approve_p3: stored.autoApproveP3 ?? false,
      auto_approve_after_minutes: stored.autoApproveAfterMinutes ?? null,
    } as NotificationSettingsEntity);
  }

  private _memUpsertNotificationSettings(data: any): Promise<NotificationSettingsEntity> {
    const now = new Date();
    const entity: NotificationSettingsEntity = {
      id: `ns_${data.userId}`,
      user_id: data.userId,
      channels: data.channels ?? [],
      dnd_start: data.dndStart ?? '22:00',
      dnd_end: data.dndEnd ?? '08:00',
      auto_approve_p3: data.autoApproveP3 ?? false,
      auto_approve_after_minutes: data.autoApproveAfterMinutes ?? 0,
      created_at: now,
      updated_at: now,
    };
    this.memoryNotifications.set(data.userId, {
      userId: data.userId,
      channels: data.channels ?? [],
      dndStart: data.dndStart ?? '22:00',
      dndEnd: data.dndEnd ?? '08:00',
      autoApproveP3: data.autoApproveP3 ?? false,
      autoApproveAfterMinutes: data.autoApproveAfterMinutes ?? 30,
    });
    return Promise.resolve(entity);
  }

  private _memGetStats(tenantId?: string): Promise<{ total: number; pending: number; confirmed: number; rejected: number; expired: number }> {
    let entities = Array.from(this.inMemoryStore.values());
    if (tenantId) {
      entities = entities.filter(e => e.tenantId === tenantId);
    }
    return Promise.resolve({
      total: entities.length,
      pending: entities.filter(e => e.status === 'pending').length,
      confirmed: entities.filter(e => e.status === 'confirmed').length,
      rejected: entities.filter(e => e.status === 'rejected').length,
      expired: entities.filter(e => e.status === 'expired').length,
    });
  }

  // ==================== Entity-to-Request Mapping ====================

  private entityToRequest(entity: ConfirmationEntity): ConfirmationRequest {
    return {
      id: entity.id,
      sceneType: entity.scene_type,
      priority: entity.priority,
      aiSuggestion: entity.ai_suggestion,
      aiConfidence: entity.ai_confidence,
      status: entity.status,
      pushTime: entity.push_time.toISOString(),
      responseTime: entity.response_time?.toISOString(),
      responder: entity.responder ?? undefined,
      comment: entity.comment ?? undefined,
      context: entity.context ?? undefined,
      tenantId: entity.tenant_id ?? undefined,
    };
  }

  private entityToAudit(entity: ConfirmationAuditEntity): ConfirmationAudit {
    return {
      id: entity.id,
      confirmationId: entity.confirmation_id,
      action: entity.action,
      user: entity.user,
      timestamp: entity.timestamp.toISOString(),
      details: entity.details ?? undefined,
    };
  }

  private entityToNotification(entity: NotificationSettingsEntity): NotificationSettings {
    return {
      userId: entity.user_id,
      channels: entity.channels,
      dndStart: entity.dnd_start,
      dndEnd: entity.dnd_end,
      autoApproveP3: entity.auto_approve_p3,
      autoApproveAfterMinutes: entity.auto_approve_after_minutes,
    };
  }
}
