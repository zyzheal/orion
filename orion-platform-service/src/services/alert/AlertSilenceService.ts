/**
 * AlertSilenceService - 告警静默规则服务
 *
 * 功能：
 * 1. 创建告警静默规则（维护窗口、已知问题、手动静默）
 * 2. 静默规则 CRUD 和过期管理
 * 3. 检查告警是否被静默
 */

import pino from 'pino';
import { BaseRepository } from '../../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Types ====================

export type SilenceType = 'manual' | 'maintenance' | 'known_issue';

export interface SilenceMatcher {
  name: string;       // e.g., "service", "alertname", "severity"
  type: 'equal' | 'regex';
  value: string;
}

export interface AlertSilence {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  silenceType: SilenceType;
  matchers: SilenceMatcher[];
  startsAt: Date;
  endsAt: Date;
  createdBy?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSilenceInput {
  name: string;
  description?: string;
  silenceType?: SilenceType;
  matchers: SilenceMatcher[];
  startsAt?: Date;
  endsAt: Date;
}

export interface AlertForSilenceCheck {
  name: string;
  service?: string;
  severity?: string;
  sourceId?: string;
  labels?: Record<string, string>;
  fingerprint?: string;
}

// ==================== Entity ====================

export interface AlertSilenceEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  silenceType: SilenceType;
  matchers: Record<string, unknown>[];
  startsAt: Date;
  endsAt: Date;
  createdBy: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Repository ====================

export class AlertSilenceRepository extends BaseRepository<AlertSilenceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_silences');
  }

  async findByTenantId(tenantId: string): Promise<AlertSilenceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_silences WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findActiveByTenant(tenantId: string): Promise<AlertSilenceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_silences
       WHERE tenant_id = $1 AND enabled = true
       AND starts_at <= NOW() AND ends_at > NOW()
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM alert_silences WHERE ends_at < NOW()`,
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): AlertSilenceEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      silenceType: row.silence_type,
      matchers: row.matchers,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdBy: row.created_by,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== Service ====================

export class AlertSilenceService {
  private repository: AlertSilenceRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repository = new AlertSilenceRepository(db);
    logger.info('[AlertSilenceService] Database-backed repository initialized');
  }

  /**
   * 创建静默规则
   */
  async createSilence(
    tenantId: string,
    input: CreateSilenceInput,
    createdBy?: string,
  ): Promise<AlertSilence> {
    if (!input.matchers || input.matchers.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Silence requires at least one matcher');
    }

    const now = new Date();
    const silence: AlertSilence = {
      id: this.generateId(),
      tenantId,
      name: input.name,
      description: input.description,
      silenceType: input.silenceType ?? 'manual',
      matchers: input.matchers,
      startsAt: input.startsAt ?? now,
      endsAt: input.endsAt,
      createdBy,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    // Validate time range
    if (silence.endsAt <= silence.startsAt) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'endsAt must be after startsAt');
    }

    if (this.repository) {
      const created = await this.repository.create({
        id: silence.id,
        tenantId: silence.tenantId,
        name: silence.name,
        description: silence.description ?? null,
        silenceType: silence.silenceType,
        matchers: silence.matchers as unknown as Record<string, unknown>[],
        startsAt: silence.startsAt,
        endsAt: silence.endsAt,
        createdBy: silence.createdBy ?? null,
        enabled: silence.enabled,
        createdAt: silence.createdAt,
        updatedAt: silence.updatedAt,
      });
      logger.info(
        { silenceId: silence.id, name: silence.name, endsAt: silence.endsAt },
        '[AlertSilenceService] Silence created'
      );
      return this.entityToSilence(created);
    }

    // Should not reach here — repository is always initialized
    throw new OrionError(ErrorCode.OPERATION_FAILED, 'AlertSilenceRepository not initialized');
  }

  /**
   * 获取活跃静默规则
   */
  async getActiveSilences(tenantId: string): Promise<AlertSilence[]> {
    const entities = await this.repository.findActiveByTenant(tenantId);
    return entities.map((e) => this.entityToSilence(e));
  }

  /**
   * 获取所有静默规则（包括过期的）
   */
  async getAllSilences(tenantId: string): Promise<AlertSilence[]> {
    const entities = await this.repository.findByTenantId(tenantId);
    return entities.map((e) => this.entityToSilence(e));
  }

  /**
   * 获取单个静默规则
   */
  async getSilenceById(silenceId: string): Promise<AlertSilence | undefined> {
    const entity = await this.repository.findById(silenceId);
    return entity ? this.entityToSilence(entity) : undefined;
  }

  /**
   * 删除静默规则
   */
  async deleteSilence(silenceId: string): Promise<boolean> {
    return this.repository.delete(silenceId);
  }

  /**
   * 更新静默规则
   */
  async updateSilence(silenceId: string, input: Partial<CreateSilenceInput> & { enabled?: boolean }): Promise<AlertSilence | undefined> {
    const existing = await this.getSilenceById(silenceId);
    if (!existing) {
      return undefined;
    }

    const updated: AlertSilence = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.silenceType !== undefined && { silenceType: input.silenceType }),
      ...(input.matchers !== undefined && { matchers: input.matchers }),
      ...(input.startsAt !== undefined && { startsAt: input.startsAt }),
      ...(input.endsAt !== undefined && { endsAt: input.endsAt }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      updatedAt: new Date(),
    };

    if (this.repository) {
      const updateData: Partial<AlertSilenceEntity> = {};
      if (input.name !== undefined) updateData.name = updated.name;
      if (input.description !== undefined) updateData.description = updated.description;
      if (input.silenceType !== undefined) updateData.silenceType = updated.silenceType;
      if (input.matchers !== undefined) updateData.matchers = input.matchers as unknown as Record<string, unknown>[];
      if (input.startsAt !== undefined) updateData.startsAt = updated.startsAt;
      if (input.endsAt !== undefined) updateData.endsAt = updated.endsAt;
      if (input.enabled !== undefined) updateData.enabled = updated.enabled;
      await this.repository.update(silenceId, updateData);
    }

    logger.info({ silenceId }, '[AlertSilenceService] Silence updated');
    return updated;
  }

  /**
   * 检查告警是否被静默
   */
  async isAlertSilenced(alert: AlertForSilenceCheck, tenantId: string): Promise<{ silenced: boolean; silenceId?: string; silenceName?: string; reason?: string }> {
    const activeSilences = await this.getActiveSilences(tenantId);

    for (const silence of activeSilences) {
      if (this.matchesSilence(alert, silence)) {
        logger.info(
          { alertName: alert.name, silenceId: silence.id, silenceName: silence.name },
          '[AlertSilenceService] Alert is silenced'
        );
        return {
          silenced: true,
          silenceId: silence.id,
          silenceName: silence.name,
          reason: `Silenced by "${silence.name}" (${silence.silenceType}) until ${silence.endsAt.toISOString()}`,
        };
      }
    }

    return { silenced: false };
  }

  /**
   * 清理过期静默规则
   */
  async expireSilences(): Promise<number> {
    const count = await this.repository.deleteExpired();

    if (count > 0) {
      logger.info({ count }, '[AlertSilenceService] Expired silences cleaned up');
    }

    return count;
  }

  // ==================== Private Methods ====================

  /**
   * 检查告警是否匹配静默规则
   */
  private matchesSilence(alert: AlertForSilenceCheck, silence: AlertSilence): boolean {
    for (const matcher of silence.matchers) {
      let alertValue: string | undefined;

      // Resolve the alert value based on matcher name
      switch (matcher.name) {
        case 'alertname':
          alertValue = alert.name;
          break;
        case 'service':
          alertValue = alert.service;
          break;
        case 'severity':
          alertValue = alert.severity;
          break;
        case 'source_id':
          alertValue = alert.sourceId;
          break;
        case 'fingerprint':
          alertValue = alert.fingerprint;
          break;
        default:
          // Try to resolve from labels
          if (alert.labels) {
            alertValue = alert.labels[matcher.name];
          }
          break;
      }

      if (alertValue === undefined || alertValue === null) {
        return false;
      }

      if (matcher.type === 'equal') {
        if (alertValue !== matcher.value) {
          return false;
        }
      } else if (matcher.type === 'regex') {
        try {
          const regex = new RegExp(matcher.value);
          if (!regex.test(alertValue)) {
            return false;
          }
        } catch {
          logger.warn({ matcher }, '[AlertSilenceService] Invalid regex in matcher');
          return false;
        }
      }
    }

    return true;
  }

  private generateId(): string {
    return `silence-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private entityToSilence(entity: AlertSilenceEntity): AlertSilence {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      description: entity.description ?? undefined,
      silenceType: entity.silenceType,
      matchers: entity.matchers.map((m) => m as unknown as SilenceMatcher),
      startsAt: entity.startsAt,
      endsAt: entity.endsAt,
      createdBy: entity.createdBy ?? undefined,
      enabled: entity.enabled,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private silenceToEntity(silence: AlertSilence): AlertSilenceEntity {
    return {
      id: silence.id,
      tenantId: silence.tenantId,
      name: silence.name,
      description: silence.description ?? null,
      silenceType: silence.silenceType,
      matchers: silence.matchers.map((m) => m as unknown as Record<string, unknown>),
      startsAt: silence.startsAt,
      endsAt: silence.endsAt,
      createdBy: silence.createdBy ?? null,
      enabled: silence.enabled,
      createdAt: silence.createdAt,
      updatedAt: silence.updatedAt,
    };
  }
}
