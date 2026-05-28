/**
 * Escalation Configuration Service
 * 
 * 统一升级配置中心 - 支持告警、工单、事件自动升级
 */

import { DatabasePool } from '../database';
import pino from 'pino';

const logger = pino({ name: 'LEscalation-LConfig-LService' });

export interface EscalationPolicy {
  id: string;
  entityType: 'alert' | 'ticket' | 'incident';
  severity?: string;  // critical, high, medium, low
  level: number;      // 1, 2, 3...
  timeoutMinutes: number;
  notifyUsers: string[];  // user IDs or roles
  notifyChannels: ('dingtalk' | 'wechat' | 'email' | 'sms' | 'slack')[];
  autoAction?: string;    // 自动执行动作
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GlobalEscalationConfig {
  // 全局默认超时时间
  defaults: {
    alertTimeoutMinutes: number;
    ticketSlaTimeoutMinutes: number;
    incidentTimeoutMinutes: number;
  };
  // 启用自动升级
  autoEscalationEnabled: boolean;
  // 检查间隔 (秒)
  checkIntervalSeconds: number;
}

const DEFAULT_CONFIG: GlobalEscalationConfig = {
  defaults: {
    alertTimeoutMinutes: 15,
    ticketSlaTimeoutMinutes: 120,
    incidentTimeoutMinutes: 30,
  },
  autoEscalationEnabled: true,
  checkIntervalSeconds: 60,
};

export class EscalationConfigService {
  private db?: DatabasePool;
  private cache: Map<string, EscalationPolicy[]> = new Map();
  private globalConfig: GlobalEscalationConfig = DEFAULT_CONFIG;

  constructor(database?: DatabasePool) {
    this.db = database;
  }

  /**
   * 初始化升级配置表
   */
  async initialize(): Promise<void> {
    if (!this.db) {
      logger.info('[EscalationConfig] No DB, using in-memory config');
      return;
    }

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS escalation_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('alert', 'ticket', 'incident')),
        severity VARCHAR(20),
        level INTEGER NOT NULL DEFAULT 1,
        timeout_minutes INTEGER NOT NULL,
        notify_users JSONB NOT NULL DEFAULT '[]',
        notify_channels JSONB NOT NULL DEFAULT '[]',
        auto_action VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(entity_type, severity, level)
      );
      
      CREATE INDEX IF NOT EXISTS idx_escalation_policies_entity 
        ON escalation_policies(entity_type, severity, level);
    `;

    try {
      await this.db.query(createTableSQL);
      logger.info('[EscalationConfig] Table initialized');
      await this.loadPolicies();
    } catch (error) {
      logger.error('[EscalationConfig] Failed to initialize:', error);
    }
  }

  /**
   * 从数据库加载策略
   */
  private async loadPolicies(): Promise<void> {
    if (!this.db) return;

    try {
      const result = await this.db.query(
        'SELECT * FROM escalation_policies WHERE is_active = true ORDER BY entity_type, level'
      );

      this.cache.clear();
      for (const row of result.rows) {
        const key = `${row.entity_type}_${row.severity || 'default'}`;
        const policy: EscalationPolicy = {
          id: row.id,
          entityType: row.entity_type,
          severity: row.severity,
          level: row.level,
          timeoutMinutes: row.timeout_minutes,
          notifyUsers: row.notify_users,
          notifyChannels: row.notify_channels,
          autoAction: row.auto_action,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };

        const existing = this.cache.get(key) || [];
        existing.push(policy);
        this.cache.set(key, existing);
      }

      logger.info(`[EscalationConfig] Loaded ${result.rows.length} policies`);
    } catch (error) {
      logger.error('[EscalationConfig] Failed to load policies:', error);
    }
  }

  /**
   * 创建升级策略
   */
  async createPolicy(policy: Omit<EscalationPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<EscalationPolicy> {
    const id = `policy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    if (this.db) {
      await this.db.query(
        `INSERT INTO escalation_policies 
         (id, entity_type, severity, level, timeout_minutes, notify_users, notify_channels, auto_action, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (entity_type, severity, level) 
         DO UPDATE SET timeout_minutes = $4, notify_users = $5, notify_channels = $6, auto_action = $7, updated_at = $10`,
        [id, policy.entityType, policy.severity || null, policy.level, policy.timeoutMinutes,
         JSON.stringify(policy.notifyUsers), JSON.stringify(policy.notifyChannels), 
         policy.autoAction || null, policy.isActive, now, now]
      );
    }

    const newPolicy: EscalationPolicy = {
      ...policy,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // 更新缓存
    const key = `${policy.entityType}_${policy.severity || 'default'}`;
    const existing = this.cache.get(key) || [];
    const idx = existing.findIndex(p => p.level === policy.level);
    if (idx >= 0) {
      existing[idx] = newPolicy;
    } else {
      existing.push(newPolicy);
      existing.sort((a, b) => a.level - b.level);
    }
    this.cache.set(key, existing);

    return newPolicy;
  }

  /**
   * 获取所有升级策略
   */
  getAllPolicies(): EscalationPolicy[] {
    const all: EscalationPolicy[] = [];
    for (const policies of this.cache.values()) {
      all.push(...policies);
    }
    return all;
  }

  /**
   * 获取升级策略
   */
  getPolicies(entityType: string, severity?: string): EscalationPolicy[] {
    const key = `${entityType}_${severity || 'default'}`;
    return this.cache.get(key) || [];
  }

  /**
   * 获取当前级别应通知的用户
   */
  getNextEscalation(entityType: string, severity: string | undefined, currentLevel: number): EscalationPolicy | null {
    const policies = this.getPolicies(entityType, severity);
    const nextLevel = currentLevel + 1;
    return policies.find(p => p.level === nextLevel) || null;
  }

  /**
   * 更新全局配置
   */
  updateGlobalConfig(config: Partial<GlobalEscalationConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
  }

  /**
   * 获取全局配置
   */
  getGlobalConfig(): GlobalEscalationConfig {
    return { ...this.globalConfig };
  }

  /**
   * 获取默认超时时间
   */
  getDefaultTimeout(entityType: string): number {
    switch (entityType) {
      case 'alert':
        return this.globalConfig.defaults.alertTimeoutMinutes;
      case 'ticket':
        return this.globalConfig.defaults.ticketSlaTimeoutMinutes;
      case 'incident':
        return this.globalConfig.defaults.incidentTimeoutMinutes;
      default:
        return 15;
    }
  }
}

export const escalationConfigService = new EscalationConfigService();