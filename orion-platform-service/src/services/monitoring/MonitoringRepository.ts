import { DatabasePool } from '../database';
/**
 * MonitoringRepository - Database layer for Monitoring & Alert operations
 */


export interface MonitoringConfig {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  target: string;
  metric: string;
  threshold: Record<string, any>;
  interval_sec: number;
  enabled: boolean;
  notification_channels: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Alert {
  id: string;
  tenant_id: string;
  config_id: string | null;
  severity: string;
  title: string;
  message: string | null;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
  resolved_at: Date | null;
  value: Record<string, any> | null;
  created_at: Date;
}

export interface AlertCorrelation {
  id: string;
  alert_id: string;
  correlated_alert_id: string;
  correlation_type: string | null;
  created_at: Date;
}

export interface CreateMonitoringConfigInput {
  tenant_id: string;
  name: string;
  type: string;
  target: string;
  metric: string;
  threshold: Record<string, any>;
  interval_sec?: number;
  enabled?: boolean;
  notification_channels?: string[];
}

export interface CreateAlertInput {
  tenant_id: string;
  config_id?: string;
  severity: string;
  title: string;
  message?: string;
  value?: Record<string, any>;
}

export interface UpdateAlertInput {
  status?: string;
  acknowledged_by?: string;
}

// ==================== Alert Rules ====================

export interface AlertRuleRecord {
  id: string;
  tenant_id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  suppressed: boolean;
  cooldown_ms: number;
  tags: Record<string, string> | null;
  rate_of_change_percent: number | null;
  description: string | null;
  evaluation_window_ms: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAlertRuleInput {
  tenant_id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity?: string;
  enabled?: boolean;
  cooldown_ms?: number;
  tags?: Record<string, string>;
  rate_of_change_percent?: number;
  description?: string;
  evaluation_window_ms?: number;
}

// ==================== Notification Channels ====================

export interface NotificationChannelRecord {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  enabled: boolean;
  severity_filter: string[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationChannelInput {
  tenant_id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  enabled?: boolean;
  severity_filter?: string[];
}

// ==================== Escalation Policies ====================

export interface EscalationPolicyRecord {
  id: string;
  tenant_id: string;
  name: string;
  steps: Record<string, any>[];
  repeat_count: number;
  enabled: boolean;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEscalationPolicyInput {
  tenant_id: string;
  name: string;
  steps: Record<string, any>[];
  repeat_count?: number;
  enabled?: boolean;
  description?: string;
}

// ==================== Notification History ====================

export interface NotificationHistoryRecord {
  id: string;
  tenant_id: string;
  alert_id: string;
  channel_id: string;
  channel_type: string;
  status: string;
  sent_at: Date;
  error_message: string | null;
  response_payload: string | null;
  escalation_step: number | null;
}

export interface CreateNotificationHistoryInput {
  tenant_id: string;
  alert_id: string;
  channel_id: string;
  channel_type: string;
  status: string;
  error_message?: string;
  response_payload?: string;
  escalation_step?: number;
}

export class MonitoringRepository {
  constructor(private pool: DatabasePool) {}


  // ==================== Monitoring Configs ====================

  async findConfigById(id: string): Promise<MonitoringConfig | null> {
    const result = await this.pool.query('SELECT * FROM monitoring_configs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAllConfigs(tenantId?: string): Promise<MonitoringConfig[]> {
    let query = 'SELECT * FROM monitoring_configs';
    const params: any[] = [];
    
    if (tenantId) {
      params.push(tenantId);
      query += ' WHERE tenant_id = $1';
    }
    
    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async createConfig(input: CreateMonitoringConfigInput): Promise<MonitoringConfig> {
    const { tenant_id, name, type, target, metric, threshold, interval_sec, enabled, notification_channels } = input;
    
    const result = await this.pool.query(
      `INSERT INTO monitoring_configs (tenant_id, name, type, target, metric, threshold, interval_sec, enabled, notification_channels)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenant_id, name, type, target, metric, threshold, interval_sec || 60, enabled !== false, notification_channels || []]
    );
    
    return result.rows[0];
  }

  async updateConfig(id: string, input: Partial<CreateMonitoringConfigInput>): Promise<MonitoringConfig | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) { params.push(input.name); updates.push(`name = $${paramIndex++}`); }
    if (input.enabled !== undefined) { params.push(input.enabled); updates.push(`enabled = $${paramIndex++}`); }
    if (input.threshold !== undefined) { params.push(JSON.stringify(input.threshold)); updates.push(`threshold = $${paramIndex++}`); }
    if (input.notification_channels !== undefined) { params.push(input.notification_channels); updates.push(`notification_channels = $${paramIndex++}`); }

    if (updates.length === 0) return this.findConfigById(id);

    params.push(id);
    const result = await this.pool.query(
      `UPDATE monitoring_configs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async deleteConfig(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM monitoring_configs WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  // ==================== Alerts ====================

  async findAlertById(id: string): Promise<Alert | null> {
    const result = await this.pool.query('SELECT * FROM alerts WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAllAlerts(options?: { tenantId?: string; status?: string; severity?: string; limit?: number; offset?: number }): Promise<Alert[]> {
    let query = 'SELECT * FROM alerts';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $${params.length}`); }
    if (options?.status) { params.push(options.status); conditions.push(`status = $${params.length}`); }
    if (options?.severity) { params.push(options.severity); conditions.push(`severity = $${params.length}`); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${params.length}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${params.length}`; }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async countAlerts(options?: { tenantId?: string; status?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM alerts';
    const params: any[] = [];
    
    if (options?.tenantId || options?.status) {
      const conditions: string[] = [];
      if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $1`); }
      if (options?.status) { params.push(options.status); conditions.push(`status = $${params.length}`); }
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  async createAlert(input: CreateAlertInput): Promise<Alert> {
    const { tenant_id, config_id, severity, title, message, value } = input;
    
    const result = await this.pool.query(
      `INSERT INTO alerts (tenant_id, config_id, severity, title, message, value, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'firing')
       RETURNING *`,
      [tenant_id, config_id || null, severity, title, message || null, value || null]
    );
    
    return result.rows[0];
  }

  async updateAlert(id: string, input: UpdateAlertInput): Promise<Alert | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) { 
      params.push(input.status); 
      updates.push(`status = $${paramIndex++}`); 
      if (input.status === 'resolved') {
        params.push(new Date());
        updates.push(`resolved_at = $${paramIndex++}`);
      }
    }
    if (input.acknowledged_by !== undefined) { 
      params.push(input.acknowledged_by); 
      updates.push(`acknowledged_by = $${paramIndex++}`); 
      params.push(new Date());
      updates.push(`acknowledged_at = $${paramIndex++}`);
    }

    if (updates.length === 0) return this.findAlertById(id);

    params.push(id);
    const result = await this.pool.query(
      `UPDATE alerts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async acknowledgeAlert(id: string, userId: string): Promise<Alert | null> {
    return this.updateAlert(id, { status: 'acknowledged', acknowledged_by: userId });
  }

  async resolveAlert(id: string): Promise<Alert | null> {
    return this.updateAlert(id, { status: 'resolved' });
  }

  // ==================== Alert Rules ====================

  async findAllRules(tenantId?: string): Promise<AlertRuleRecord[]> {
    let query = 'SELECT * FROM monitoring_alert_rules';
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      query += ' WHERE tenant_id = $1';
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async findRuleById(id: string): Promise<AlertRuleRecord | null> {
    const result = await this.pool.query('SELECT * FROM monitoring_alert_rules WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async createRule(input: CreateAlertRuleInput): Promise<AlertRuleRecord> {
    const { tenant_id, name, metric, condition, threshold, severity, enabled, cooldown_ms, tags, rate_of_change_percent, description, evaluation_window_ms } = input;

    const result = await this.pool.query(
      `INSERT INTO monitoring_alert_rules (tenant_id, name, metric, condition, threshold, severity, enabled, cooldown_ms, tags, rate_of_change_percent, description, evaluation_window_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [tenant_id, name, metric, condition, threshold, severity || 'warning', enabled !== false, cooldown_ms || 300000, tags || null, rate_of_change_percent || null, description || null, evaluation_window_ms || null]
    );

    return result.rows[0];
  }

  async updateRule(id: string, input: Partial<CreateAlertRuleInput>): Promise<AlertRuleRecord | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) { params.push(input.name); updates.push(`name = $${paramIndex++}`); }
    if (input.enabled !== undefined) { params.push(input.enabled); updates.push(`enabled = $${paramIndex++}`); }
    if (input.threshold !== undefined) { params.push(input.threshold); updates.push(`threshold = $${paramIndex++}`); }
    if (input.condition !== undefined) { params.push(input.condition); updates.push(`condition = $${paramIndex++}`); }
    if (input.metric !== undefined) { params.push(input.metric); updates.push(`metric = $${paramIndex++}`); }
    if (input.severity !== undefined) { params.push(input.severity); updates.push(`severity = $${paramIndex++}`); }
    if (input.cooldown_ms !== undefined) { params.push(input.cooldown_ms); updates.push(`cooldown_ms = $${paramIndex++}`); }
    if (input.tags !== undefined) { params.push(JSON.stringify(input.tags)); updates.push(`tags = $${paramIndex++}`); }
    if (input.rate_of_change_percent !== undefined) { params.push(input.rate_of_change_percent); updates.push(`rate_of_change_percent = $${paramIndex++}`); }
    if (input.description !== undefined) { params.push(input.description); updates.push(`description = $${paramIndex++}`); }
    if (input.evaluation_window_ms !== undefined) { params.push(input.evaluation_window_ms); updates.push(`evaluation_window_ms = $${paramIndex++}`); }

    if (updates.length === 0) return this.findRuleById(id);

    params.push(id);
    const result = await this.pool.query(
      `UPDATE monitoring_alert_rules SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async deleteRule(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM monitoring_alert_rules WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async toggleRule(id: string, enabled: boolean): Promise<AlertRuleRecord | null> {
    const result = await this.pool.query(
      'UPDATE monitoring_alert_rules SET enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [enabled, id]
    );
    return result.rows[0] || null;
  }

  async suppressRule(id: string): Promise<AlertRuleRecord | null> {
    const result = await this.pool.query(
      'UPDATE monitoring_alert_rules SET suppressed = true, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async unsuppressRule(id: string): Promise<AlertRuleRecord | null> {
    const result = await this.pool.query(
      'UPDATE monitoring_alert_rules SET suppressed = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  // ==================== Notification Channels ====================

  async findAllChannels(tenantId?: string): Promise<NotificationChannelRecord[]> {
    let query = 'SELECT * FROM monitoring_notification_channels';
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      query += ' WHERE tenant_id = $1';
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async findChannelById(id: string): Promise<NotificationChannelRecord | null> {
    const result = await this.pool.query('SELECT * FROM monitoring_notification_channels WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async createChannel(input: CreateNotificationChannelInput): Promise<NotificationChannelRecord> {
    const { tenant_id, name, type, config, enabled, severity_filter } = input;

    const result = await this.pool.query(
      `INSERT INTO monitoring_notification_channels (tenant_id, name, type, config, enabled, severity_filter)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenant_id, name, type, config, enabled !== false, severity_filter || null]
    );

    return result.rows[0];
  }

  async toggleChannel(id: string, enabled: boolean): Promise<NotificationChannelRecord | null> {
    const result = await this.pool.query(
      'UPDATE monitoring_notification_channels SET enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [enabled, id]
    );
    return result.rows[0] || null;
  }

  // ==================== Escalation Policies ====================

  async findAllPolicies(tenantId?: string): Promise<EscalationPolicyRecord[]> {
    let query = 'SELECT * FROM monitoring_escalation_policies';
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      query += ' WHERE tenant_id = $1';
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async findPolicyById(id: string): Promise<EscalationPolicyRecord | null> {
    const result = await this.pool.query('SELECT * FROM monitoring_escalation_policies WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async createPolicy(input: CreateEscalationPolicyInput): Promise<EscalationPolicyRecord> {
    const { tenant_id, name, steps, repeat_count, enabled, description } = input;

    const result = await this.pool.query(
      `INSERT INTO monitoring_escalation_policies (tenant_id, name, steps, repeat_count, enabled, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenant_id, name, steps, repeat_count || 0, enabled !== false, description || null]
    );

    return result.rows[0];
  }

  // ==================== Notification History ====================

  async findNotificationHistory(options?: { tenantId?: string; alertId?: string; channelId?: string; status?: string; limit?: number }): Promise<NotificationHistoryRecord[]> {
    let query = 'SELECT * FROM monitoring_notification_history';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $${params.length}`); }
    if (options?.alertId) { params.push(options.alertId); conditions.push(`alert_id = $${params.length}`); }
    if (options?.channelId) { params.push(options.channelId); conditions.push(`channel_id = $${params.length}`); }
    if (options?.status) { params.push(options.status); conditions.push(`status = $${params.length}`); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY sent_at DESC';

    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${params.length}`; }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async createNotificationHistory(input: CreateNotificationHistoryInput): Promise<NotificationHistoryRecord> {
    const { tenant_id, alert_id, channel_id, channel_type, status, error_message, response_payload, escalation_step } = input;

    const result = await this.pool.query(
      `INSERT INTO monitoring_notification_history (tenant_id, alert_id, channel_id, channel_type, status, error_message, response_payload, escalation_step)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tenant_id, alert_id, channel_id, channel_type, status, error_message || null, response_payload || null, escalation_step || null]
    );

    return result.rows[0];
  }

  // ==================== Stats ====================

  async getAlertStats(tenantId?: string): Promise<{
    total: number;
    firing: number;
    acknowledged: number;
    resolved: number;
    critical: number;
    warning: number;
  }> {
    let query = `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'firing' THEN 1 ELSE 0 END) as firing,
      SUM(CASE WHEN status = 'acknowledged' THEN 1 ELSE 0 END) as acknowledged,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
      SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning
     FROM alerts`;
    const params: any[] = [];

    if (tenantId) { params.push(tenantId); query += ' WHERE tenant_id = $1'; }

    const result = await this.pool.query(query, params);
    const row = result.rows[0];

    return {
      total: parseInt(row.total || '0', 10),
      firing: parseInt(row.firing || '0', 10),
      acknowledged: parseInt(row.acknowledged || '0', 10),
      resolved: parseInt(row.resolved || '0', 10),
      critical: parseInt(row.critical || '0', 10),
      warning: parseInt(row.warning || '0', 10),
    };
  }
}