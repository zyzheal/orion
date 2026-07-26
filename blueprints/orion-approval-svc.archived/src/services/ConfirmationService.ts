/**
 * Manual Confirmation Service (P0-6)
 *
 * Provides CRUD for confirmation requests, approval/rejection,
 * audit logging, batch operations, and notification settings.
 *
 * D7 Fix: Migrated from in-memory Map to PostgreSQL Repository pattern.
 * In-memory fallback retained for graceful degradation when DB is unavailable.
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfirmationRepository, ConfirmationEntity, ConfirmationAuditEntity, NotificationSettingsEntity } from '../repositories/ConfirmationRepository';

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

/**
 * In-memory fallback storage (used when PostgreSQL is unavailable)
 */
const confirmations = new Map<string, ConfirmationRequest>();
const auditLogs = new Map<string, ConfirmationAudit[]>();
const notificationSettings = new Map<string, NotificationSettings>();

export class ConfirmationService {
  private repository?: ConfirmationRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repository = new ConfirmationRepository(db);
    }
  }

  /**
   * Create a confirmation request
   */
  async create(input: {
    sceneType: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    aiSuggestion: string;
    aiConfidence: number;
    context?: Record<string, unknown>;
    tenantId?: string;
  }): Promise<ConfirmationRequest> {
    const request: ConfirmationRequest = {
      id: uuidv4(),
      sceneType: input.sceneType,
      priority: input.priority,
      aiSuggestion: input.aiSuggestion,
      aiConfidence: input.aiConfidence,
      status: 'pending',
      pushTime: new Date().toISOString(),
      context: input.context,
      tenantId: input.tenantId,
    };

    if (this.repository) {
      try {
        await this.repository.insert({
          sceneType: request.sceneType,
          priority: request.priority,
          aiSuggestion: request.aiSuggestion,
          aiConfidence: request.aiConfidence,
          context: request.context,
          tenantId: request.tenantId,
        });
      } catch (err) {
        console.warn('[ConfirmationService] Failed to persist to DB, keeping in-memory:', err);
        confirmations.set(request.id, request);
        auditLogs.set(request.id, []);
        return request;
      }
    } else {
      confirmations.set(request.id, request);
      auditLogs.set(request.id, []);
    }

    return request;
  }

  /**
   * Get confirmation by ID
   */
  async getById(id: string): Promise<ConfirmationRequest | null> {
    // Check in-memory first
    const cached = confirmations.get(id);
    if (cached) return cached;

    // Try repository
    if (this.repository) {
      const entity = await this.repository.findById(id);
      return entity ? this.entityToRequest(entity) : null;
    }

    return null;
  }

  /**
   * List confirmations with filters
   */
  async list(params: ConfirmationListParams = {}): Promise<ConfirmationRequest[]> {
    if (this.repository) {
      try {
        const result = await this.repository.findAll({
          sceneType: params.sceneType,
          priority: params.priority,
          status: params.status,
          tenantId: params.tenantId,
          offset: params.offset,
          limit: params.limit,
        });
        return result.entities.map((e: ConfirmationEntity) => this.entityToRequest(e));
      } catch (err) {
        console.warn('[ConfirmationService] DB query failed, falling back to memory:', err);
      }
    }

    // Fallback to in-memory
    let result = Array.from(confirmations.values());

    if (params.sceneType) {
      result = result.filter(r => r.sceneType === params.sceneType);
    }
    if (params.priority) {
      result = result.filter(r => r.priority === params.priority);
    }
    if (params.status) {
      result = result.filter(r => r.status === params.status);
    }
    if (params.tenantId) {
      result = result.filter(r => r.tenantId === params.tenantId);
    }

    result.sort((a, b) => new Date(b.pushTime).getTime() - new Date(a.pushTime).getTime());

    const offset = params.offset || 0;
    const limit = params.limit || 50;
    return result.slice(offset, offset + limit);
  }

  /**
   * Approve a confirmation
   */
  async approve(id: string, input: ConfirmationInput): Promise<ConfirmationRequest | null> {
    const request = confirmations.get(id) || await this.getById(id);
    if (!request || request.status !== 'pending') {
      return null;
    }

    const updated: ConfirmationRequest = {
      ...request,
      status: 'confirmed',
      responseTime: new Date().toISOString(),
      responder: input.responder || 'system',
      comment: input.comment || input.reason,
    };

    confirmations.set(id, updated);

    // Add audit log
    const logs = auditLogs.get(id) || [];
    logs.push({
      id: uuidv4(),
      confirmationId: id,
      action: 'approved',
      user: input.responder || 'system',
      timestamp: new Date().toISOString(),
      details: input.comment || input.reason,
    });
    auditLogs.set(id, logs);

    // Persist to repository
    if (this.repository) {
      try {
        await this.repository.updateStatus(
          id, 'confirmed', updated.responder, updated.comment, new Date(updated.responseTime!)
        );
        await this.repository.insertAudit({
          confirmationId: id,
          action: 'approved',
          user: input.responder || 'system',
          details: input.comment || input.reason,
        });
      } catch (err) {
        console.warn('[ConfirmationService] Failed to persist approval to DB:', err);
      }
    }

    return updated;
  }

  /**
   * Reject a confirmation
   */
  async reject(id: string, input: ConfirmationInput): Promise<ConfirmationRequest | null> {
    const request = confirmations.get(id) || await this.getById(id);
    if (!request || request.status !== 'pending') {
      return null;
    }

    const updated: ConfirmationRequest = {
      ...request,
      status: 'rejected',
      responseTime: new Date().toISOString(),
      responder: input.responder || 'system',
      comment: input.comment || input.reason,
    };

    confirmations.set(id, updated);

    // Add audit log
    const logs = auditLogs.get(id) || [];
    logs.push({
      id: uuidv4(),
      confirmationId: id,
      action: 'rejected',
      user: input.responder || 'system',
      timestamp: new Date().toISOString(),
      details: input.comment || input.reason,
    });
    auditLogs.set(id, logs);

    // Persist to repository
    if (this.repository) {
      try {
        await this.repository.updateStatus(
          id, 'rejected', updated.responder, updated.comment, new Date(updated.responseTime!)
        );
        await this.repository.insertAudit({
          confirmationId: id,
          action: 'rejected',
          user: input.responder || 'system',
          details: input.comment || input.reason,
        });
      } catch (err) {
        console.warn('[ConfirmationService] Failed to persist rejection to DB:', err);
      }
    }

    return updated;
  }

  /**
   * Batch approve confirmations
   */
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

  /**
   * Get audit logs
   */
  async getAuditLogs(params: AuditListParams = {}): Promise<ConfirmationAudit[]> {
    if (this.repository) {
      try {
        if (params.confirmationId) {
          const audits = await this.repository.findAuditsByConfirmation(params.confirmationId);
          return audits.map((a: ConfirmationAuditEntity) => this.entityToAudit(a));
        }

        const result = await this.repository.findAllAudits({
          user: params.user,
          tenantId: params.tenantId,
          startDate: params.startDate,
          endDate: params.endDate,
          offset: params.offset,
          limit: params.limit,
        });
        return result.entities.map((a: ConfirmationAuditEntity) => this.entityToAudit(a));
      } catch (err) {
        console.warn('[ConfirmationService] DB audit query failed, falling back to memory:', err);
      }
    }

    // Fallback to in-memory
    let result: ConfirmationAudit[] = [];

    if (params.confirmationId) {
      result = auditLogs.get(params.confirmationId) || [];
    } else {
      for (const logs of auditLogs.values()) {
        result.push(...logs);
      }
    }

    if (params.user) {
      result = result.filter(l => l.user === params.user);
    }
    if (params.tenantId) {
      result = result.filter(l => {
        const conf = confirmations.get(l.confirmationId);
        return conf?.tenantId === params.tenantId;
      });
    }
    if (params.startDate) {
      result = result.filter(l => l.timestamp >= params.startDate!);
    }
    if (params.endDate) {
      result = result.filter(l => l.timestamp <= params.endDate!);
    }

    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const offset = params.offset || 0;
    const limit = params.limit || 100;
    return result.slice(offset, offset + limit);
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    if (this.repository) {
      try {
        const settings = await this.repository.findNotificationSettings(userId);
        if (settings) {
          const result = this.entityToNotification(settings);
          notificationSettings.set(userId, result);
          return result;
        }
      } catch (err) {
        console.warn('[ConfirmationService] DB notification settings query failed, falling back to memory:', err);
      }
    }

    // Fallback to in-memory
    const existing = notificationSettings.get(userId);
    if (existing) return existing;

    const defaults: NotificationSettings = {
      userId,
      channels: ['email', 'slack'],
      dndStart: '22:00',
      dndEnd: '08:00',
      autoApproveP3: false,
      autoApproveAfterMinutes: 30,
    };

    notificationSettings.set(userId, defaults);
    return defaults;
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(
    userId: string,
    data: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    const existing = await this.getNotificationSettings(userId);
    const updated = { ...existing, ...data, userId };

    if (this.repository) {
      try {
        await this.repository.upsertNotificationSettings({
          userId: updated.userId,
          channels: updated.channels,
          dndStart: updated.dndStart,
          dndEnd: updated.dndEnd,
          autoApproveP3: updated.autoApproveP3,
          autoApproveAfterMinutes: updated.autoApproveAfterMinutes,
        });
      } catch (err) {
        console.warn('[ConfirmationService] Failed to persist notification settings to DB:', err);
      }
    }

    notificationSettings.set(userId, updated);
    return updated;
  }

  /**
   * Get statistics
   */
  async getStats(tenantId?: string): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
    expired: number;
  }> {
    if (this.repository) {
      try {
        return await this.repository.getStats(tenantId);
      } catch (err) {
        console.warn('[ConfirmationService] DB stats query failed, falling back to memory:', err);
      }
    }

    // Fallback to in-memory
    let all = Array.from(confirmations.values());
    if (tenantId) {
      all = all.filter(r => r.tenantId === tenantId);
    }

    return {
      total: all.length,
      pending: all.filter(r => r.status === 'pending').length,
      confirmed: all.filter(r => r.status === 'confirmed').length,
      rejected: all.filter(r => r.status === 'rejected').length,
      expired: all.filter(r => r.status === 'expired').length,
    };
  }

  // ==================== Entity Mappers ====================

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
