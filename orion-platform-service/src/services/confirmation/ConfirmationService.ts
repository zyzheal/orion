/**
 * Manual Confirmation Service (P0-6)
 *
 * Provides CRUD for confirmation requests, approval/rejection,
 * audit logging, batch operations, and notification settings.
 */

import { v4 as uuidv4 } from 'uuid';

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
 * In-memory storage (Phase 2: migrate to PostgreSQL)
 */
const confirmations = new Map<string, ConfirmationRequest>();
const auditLogs = new Map<string, ConfirmationAudit[]>();
const notificationSettings = new Map<string, NotificationSettings>();

export class ConfirmationService {
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

    confirmations.set(request.id, request);
    auditLogs.set(request.id, []);

    return request;
  }

  /**
   * Get confirmation by ID
   */
  async getById(id: string): Promise<ConfirmationRequest | null> {
    return confirmations.get(id) || null;
  }

  /**
   * List confirmations with filters
   */
  async list(params: ConfirmationListParams = {}): Promise<ConfirmationRequest[]> {
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

    // Sort by pushTime (newest first)
    result.sort((a, b) => new Date(b.pushTime).getTime() - new Date(a.pushTime).getTime());

    const offset = params.offset || 0;
    const limit = params.limit || 50;
    return result.slice(offset, offset + limit);
  }

  /**
   * Approve a confirmation
   */
  async approve(id: string, input: ConfirmationInput): Promise<ConfirmationRequest | null> {
    const request = confirmations.get(id);
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

    return updated;
  }

  /**
   * Reject a confirmation
   */
  async reject(id: string, input: ConfirmationInput): Promise<ConfirmationRequest | null> {
    const request = confirmations.get(id);
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
      // Filter by tenantId through confirmation
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
    const existing = notificationSettings.get(userId);
    if (existing) return existing;

    // Default settings
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
}
