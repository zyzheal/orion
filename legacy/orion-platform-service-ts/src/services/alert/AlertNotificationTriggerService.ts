/**
 * AlertNotificationTriggerService - 告警通知触发与分发服务
 *
 * 负责：
 * - onAlert(alert) 核心入口
 * - dispatchBySeverity(alert) 按 severity 分发
 * - dispatchToChannel(alert, channel, template) 多渠道分发
 * - renderTemplate(template, alert) 模板渲染
 * - checkDedup(fingerprint, channel) 去重检查
 */

import { createLogger } from '../../utils/logger';
import type { Alert as MonitoringAlert, AlertSeverity } from '../monitoring/types';
import { AlertNotificationService } from '../monitoring/AlertNotificationService';
import { AlertDeduplication } from './AlertDeduplication';

const logger = createLogger('alert-notification-trigger');

// Local Alert type matching what this service accesses (alert module model)
export interface Alert {
  id: string;
  fingerprint: string;
  name: string;
  severity: AlertSeverity;
  status: string;
  metric: string;
  value: number;
  threshold: number;
  startsAt: Date;
  message?: string;
  sourceName?: string;
  tenantId: string;
}

// Adapter: convert local Alert → MonitoringAlert for sendNotification
function toMonitoringAlert(alert: Alert): MonitoringAlert {
  return {
    ...alert,
    ruleId: alert.id,
    triggeredAt: alert.startsAt,
    severity: alert.severity,
  } as MonitoringAlert;
}

/**
 * 通知渠道配置
 */
export interface NotificationChannel {
  id: string;
  type: 'email' | 'webhook' | 'slack';
  enabled: boolean;
  severityFilter: AlertSeverity[];
  template?: string;
}

/**
 * 通知模板
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  channelType: 'email' | 'webhook' | 'slack';
  subjectTemplate?: string;
  bodyTemplate: string;
}

/**
 * 去重记录
 */
interface DedupRecord {
  fingerprint: string;
  channelId: string;
  lastSentAt: Date;
  count: number;
}

/**
 * 默认模板
 */
const DEFAULT_TEMPLATES: Record<string, NotificationTemplate> = {
  critical_email: {
    id: 'critical_email',
    name: 'Critical Email Template',
    channelType: 'email',
    subjectTemplate: '[CRITICAL] {{alert.name}}',
    bodyTemplate:
      'Alert: {{alert.name}}\nSeverity: {{alert.severity}}\nMetric: {{alert.metric}}\nValue: {{alert.value}}\nThreshold: {{alert.threshold}}\nTime: {{alert.startsAt}}',
  },
  warning_webhook: {
    id: 'warning_webhook',
    name: 'Warning Webhook Template',
    channelType: 'webhook',
    bodyTemplate:
      '{"severity":"{{alert.severity}}","name":"{{alert.name}}","value":{{alert.value}}}',
  },
  slack_default: {
    id: 'slack_default',
    name: 'Slack Default Template',
    channelType: 'slack',
    bodyTemplate: ':warning: *{{alert.severity.toUpperCase()}}: {{alert.name}}*\nValue: {{alert.value}}',
  },
};

export class AlertNotificationTriggerService {
  private notificationService: AlertNotificationService;
  private deduplication: AlertDeduplication;
  private templates: Map<string, NotificationTemplate> = new Map();
  private dedupRecords: Map<string, DedupRecord> = new Map();
  private defaultChannels: NotificationChannel[] = [];

  constructor(
    notificationService: AlertNotificationService,
    deduplication: AlertDeduplication,
    defaultChannels?: NotificationChannel[]
  ) {
    this.notificationService = notificationService;
    this.deduplication = deduplication;
    this.defaultChannels = defaultChannels || [];

    // 加载默认模板
    for (const template of Object.values(DEFAULT_TEMPLATES)) {
      this.templates.set(template.id, template);
    }
  }

  // ==================== Core Entry ====================

  /**
   * 核心入口：处理告警触发
   */
  async onAlert(alert: Alert): Promise<void> {
    logger.info(
      { alertId: alert.id, severity: alert.severity, metric: alert.metric },
      '[AlertNotificationTrigger] Processing alert'
    );

    try {
      await this.dispatchBySeverity(alert);
      logger.info(
        { alertId: alert.id },
        '[AlertNotificationTrigger] Alert dispatched successfully'
      );
    } catch (error) {
      logger.error(
        { err: error instanceof Error ? error.message : error, alertId: alert.id },
        '[AlertNotificationTrigger] Failed to dispatch alert'
      );
    }
  }

  // ==================== Severity Dispatch ====================

  /**
   * 按 severity 分发到匹配的渠道
   */
  async dispatchBySeverity(alert: Alert): Promise<void> {
    const channels = this.notificationService.getAllChannels();
    const matchedChannels = channels.filter((ch) => {
      if (!ch.enabled) return false;
      return this.matchesSeverity(ch.severityFilter, alert.severity);
    });

    if (matchedChannels.length === 0) {
      logger.debug(
        { alertId: alert.id, severity: alert.severity },
        '[AlertNotificationTrigger] No matching channels'
      );
      return;
    }

    // 并发分发到所有匹配的渠道
    await Promise.all(
      matchedChannels.map((channel) => this.dispatchToChannel(alert, channel))
    );
  }

  // ==================== Channel Dispatch ====================

  /**
   * 分发到指定渠道（含去重、模板渲染）
   */
  async dispatchToChannel(alert: Alert, channel: any, template?: NotificationTemplate): Promise<void> {
    const channelId = channel.id;

    // 去重检查
    if (this.checkDedup(alert.fingerprint, channelId)) {
      logger.debug(
        { alertId: alert.id, channelId },
        '[AlertNotificationTrigger] Alert deduplicated, skipping'
      );
      return;
    }

    // 选择模板
    const tpl = template || this.resolveTemplate(channel.type, alert.severity);
    if (!tpl) {
      logger.warn(
        { alertId: alert.id, channelId, channelType: channel.type },
        '[AlertNotificationTrigger] No template found, skipping'
      );
      return;
    }

    // 渲染模板
    const rendered = this.renderTemplate(tpl, alert);

    // 调用底层通知服务发送
    try {
      const records = await this.notificationService.sendNotification(toMonitoringAlert(alert), [channelId]);
      logger.info(
        { alertId: alert.id, channelId, status: records[0]?.status },
        '[AlertNotificationTrigger] Channel dispatch completed'
      );
    } catch (error) {
      logger.error(
        { err: error instanceof Error ? error.message : error, alertId: alert.id, channelId },
        '[AlertNotificationTrigger] Channel dispatch failed'
      );
    }
  }

  // ==================== Template Rendering ====================

  /**
   * 渲染模板
   */
  renderTemplate(template: NotificationTemplate, alert: Alert): { subject?: string; body: string } {
    let body = template.bodyTemplate || '';
    const subject = template.subjectTemplate || '';

    // 替换变量
    const vars: Record<string, string> = {
      'alert.id': alert.id,
      'alert.name': alert.name,
      'alert.severity': alert.severity,
      'alert.metric': alert.metric,
      'alert.value': String(alert.value),
      'alert.threshold': String(alert.threshold),
      'alert.status': alert.status,
      'alert.startsAt': alert.startsAt.toISOString(),
      'alert.message': alert.message || '',
      'alert.sourceName': alert.sourceName || '',
      'alert.tenantId': alert.tenantId,
    };

    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      body = body.replace(regex, value);
      if (subject) {
        // subject 不需要在这里替换，由调用方处理
      }
    }

    return { subject: subject || undefined, body };
  }

  /**
   * 根据渠道类型和 severity 解析模板
   */
  private resolveTemplate(channelType: string, severity: AlertSeverity): NotificationTemplate | undefined {
    const key = `${severity}_${channelType}`;
    return this.templates.get(key) || this.templates.get(`${channelType}_default`);
  }

  // ==================== Deduplication ====================

  /**
   * 检查去重（同一 fingerprint + channel 在 5 分钟内不重复发送）
   */
  checkDedup(fingerprint: string, channelId: string): boolean {
    const key = `${fingerprint}:${channelId}`;
    const now = new Date();
    const existing = this.dedupRecords.get(key);

    if (existing) {
      const diffMs = now.getTime() - existing.lastSentAt.getTime();
      const dedupWindowMs = 5 * 60 * 1000; // 5 分钟

      if (diffMs < dedupWindowMs) {
        existing.count++;
        return true; // 去重
      }

      // 超过去重窗口，重置
      existing.lastSentAt = now;
      existing.count = 1;
      return false;
    }

    // 新记录
    this.dedupRecords.set(key, {
      fingerprint,
      channelId,
      lastSentAt: now,
      count: 1,
    });
    return false;
  }

  /**
   * 清理过期的去重记录
   */
  cleanDedupRecords(olderThanMs: number = 30 * 60 * 1000): void {
    const now = new Date();
    for (const [key, record] of this.dedupRecords.entries()) {
      const diffMs = now.getTime() - record.lastSentAt.getTime();
      if (diffMs > olderThanMs) {
        this.dedupRecords.delete(key);
      }
    }
  }

  // ==================== Utilities ====================

  /**
   * 检查 severity 是否匹配渠道过滤条件
   */
  private matchesSeverity(
    severityFilter: AlertSeverity[] | undefined,
    alertSeverity: AlertSeverity
  ): boolean {
    if (!severityFilter || severityFilter.length === 0) return true;
    return severityFilter.includes(alertSeverity);
  }

  /**
   * 注册自定义模板
   */
  registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * 获取所有模板
   */
  getTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 设置默认渠道
   */
  setDefaultChannels(channels: NotificationChannel[]): void {
    this.defaultChannels = channels;
  }
}
