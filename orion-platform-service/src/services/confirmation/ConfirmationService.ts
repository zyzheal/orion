/**
 * Manual Confirmation Service (P0-6)
 *
 * Provides CRUD for confirmation requests, approval/rejection,
 * audit logging, batch operations, and notification settings.
 *
 * Persistence: PostgreSQL via ConfirmationRepository
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfirmationRepository, ConfirmationEntity, ConfirmationAuditEntity, NotificationSettingsEntity } from '../../repositories/ConfirmationRepository';
import pino from 'pino';

const logger = pino({ name: 'LConfirmation-LService' });

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

  constructor(repository: ConfirmationRepository) {
    if (!repository) throw new Error('ConfirmationRepository is required');
    this.repository = repository;
  }

  async create(input: {
    sceneType: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    aiSuggestion: string;
    aiConfidence: number;
    context?: Record<string, unknown>;
    tenantId?: string;
  }): Promise<ConfirmationRequest> {
    const entity = await this.repository.insert({
      sceneType: input.sceneType,
      priority: input.priority,
      aiSuggestion: input.aiSuggestion,
      aiConfidence: input.aiConfidence,
      context: input.context,
      tenantId: input.tenantId,
    });

    return this.entityToRequest(entity);
  }

  async getById(id: string): Promise<ConfirmationRequest | null> {
    const entity = await this.repository.findById(id);
    return entity ? this.entityToRequest(entity) : null;
  }

  async list(params: ConfirmationListParams = {}): Promise<ConfirmationRequest[]> {
    const result = await this.repository.findAll({
      sceneType: params.sceneType,
      priority: params.priority,
      status: params.status,
      tenantId: params.tenantId,
      offset: params.offset,
      limit: params.limit,
    });
    return result.entities.map((e) => this.entityToRequest(e));
  }

  async approve(id: string, input: ConfirmationInput): Promise<ConfirmationRequest | null> {
    const entity = await this.repository.findById(id);
    if (!entity || entity.status !== 'pending') return null;

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
    const entity = await this.repository.findById(id);
    if (!entity || entity.status !== 'pending') return null;

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
      const audits = await this.repository.findAuditsByConfirmation(params.confirmationId);
      return audits.map((a) => this.entityToAudit(a));
    }

    const result = await this.repository.findAllAudits({
      user: params.user,
      tenantId: params.tenantId,
      startDate: params.startDate,
      endDate: params.endDate,
      offset: params.offset,
      limit: params.limit,
    });
    return result.entities.map((a) => this.entityToAudit(a));
  }

  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    const settings = await this.repository.findNotificationSettings(userId);
    if (settings) {
      return this.entityToNotification(settings);
    }

    // Create defaults
    const defaults: NotificationSettings = {
      userId,
      channels: ['email', 'slack'],
      dndStart: '22:00',
      dndEnd: '08:00',
      autoApproveP3: false,
      autoApproveAfterMinutes: 30,
    };

    const created = await this.repository.upsertNotificationSettings({
      userId: defaults.userId,
      channels: defaults.channels,
      dndStart: defaults.dndStart,
      dndEnd: defaults.dndEnd,
      autoApproveP3: defaults.autoApproveP3,
      autoApproveAfterMinutes: defaults.autoApproveAfterMinutes,
    });

    return this.entityToNotification(created);
  }

  async updateNotificationSettings(
    userId: string,
    data: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    const existing = await this.getNotificationSettings(userId);
    const updated = { ...existing, ...data, userId };

    const entity = await this.repository.upsertNotificationSettings({
      userId: updated.userId,
      channels: updated.channels,
      dndStart: updated.dndStart,
      dndEnd: updated.dndEnd,
      autoApproveP3: updated.autoApproveP3,
      autoApproveAfterMinutes: updated.autoApproveAfterMinutes,
    });

    return this.entityToNotification(entity);
  }

  async getStats(tenantId?: string): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
    expired: number;
  }> {
    return this.repository.getStats(tenantId);
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
