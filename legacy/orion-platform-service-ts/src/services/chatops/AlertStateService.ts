/**
 * Alert State Service — 告警已读/确认/忽略状态管理
 *
 * B-11: 用户告警状态跟踪
 * SE-9: 资源范围校验 (防越权)
 */

import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

export interface ChatOpsAlertStateEntity {
  id: string;
  userId: string;
  alertId: string;
  state: 'unread' | 'read' | 'acknowledged' | 'dismissed';
  readAt: Date | null;
  dismissedAt: Date | null;
  escalationStopped: boolean;
  escalationCurrentLevel: number;
  createdAt: Date;
}

export class AlertStateService {
  constructor(private pool: DatabasePool) {}

  /**
   * SE-9: 校验 alert 是否属于当前用户的资源范围
   */
  private async validateAlertOwnership(userId: string, alertId: string): Promise<boolean> {
    try {
      // 方式 1: 通过 tenant 关联
      const result = await this.pool.query(
        `SELECT 1 FROM alerts a
         JOIN user_tenants ut ON a.tenant_id = ut.tenant_id
         WHERE a.id = $1 AND ut.user_id = $2
         LIMIT 1`,
        [alertId, userId],
      );
      if (result.rowCount !== 0) return true;
    } catch {
      // alerts 表可能不存在，继续方式 2
    }

    // 方式 2: 通过 user_resources 关联
    try {
      const rc = await this.pool.query(
        `SELECT 1 FROM chatops_alert_states cas
         JOIN user_resources ur ON cas.resource_type = ur.resource_type AND cas.resource_id = ur.resource_id
         WHERE cas.alert_id = $1 AND ur.user_id = $2
         LIMIT 1`,
        [alertId, userId],
      );
      if (rc.rowCount !== 0) return true;
    } catch {
      // user_resources 可能不存在
    }

    // 降级策略: 生产环境拒绝，开发环境允许
    return process.env.NODE_ENV !== 'production';
  }

  async listByUserId(userId: string): Promise<ChatOpsAlertStateEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_alert_states WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map(this.mapRow);
  }

  async markAsRead(userId: string, alertId: string): Promise<void> {
    if (!await this.validateAlertOwnership(userId, alertId)) {
      throw new OrionError('无权访问该告警', ErrorCode.OPERATION_FAILED);
    }
    await this.upsertState(userId, alertId, 'read', new Date(), null);
  }

  async markAsAcknowledged(userId: string, alertId: string): Promise<void> {
    if (!await this.validateAlertOwnership(userId, alertId)) {
      throw new OrionError('无权访问该告警', ErrorCode.OPERATION_FAILED);
    }
    await this.upsertState(userId, alertId, 'acknowledged', new Date(), null);
  }

  async markAsDismissed(userId: string, alertId: string): Promise<void> {
    if (!await this.validateAlertOwnership(userId, alertId)) {
      throw new OrionError('无权访问该告警', ErrorCode.OPERATION_FAILED);
    }
    await this.upsertState(userId, alertId, 'dismissed', null, new Date());
  }

  async batchMarkAsRead(userId: string, alertIds: string[]): Promise<void> {
    for (const alertId of alertIds) {
      if (!await this.validateAlertOwnership(userId, alertId)) continue;
      await this.upsertState(userId, alertId, 'read', new Date(), null);
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM chatops_alert_states
       WHERE user_id = $1 AND state IN ('unread', 'acknowledged')`,
      [userId],
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  private async upsertState(
    userId: string,
    alertId: string,
    state: string,
    readAt: Date | null,
    dismissedAt: Date | null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO chatops_alert_states (user_id, alert_id, state, read_at, dismissed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, alert_id)
       DO UPDATE SET state = $3, read_at = $4, dismissed_at = $5, updated_at = NOW()`,
      [userId, alertId, state, readAt, dismissedAt],
    );
  }

  private mapRow(row: any): ChatOpsAlertStateEntity {
    return {
      id: row.id,
      userId: row.user_id,
      alertId: row.alert_id,
      state: row.state,
      readAt: row.read_at,
      dismissedAt: row.dismissed_at,
      escalationStopped: row.escalation_stopped || false,
      escalationCurrentLevel: row.escalation_current_level || 0,
      createdAt: row.created_at,
    };
  }
}
