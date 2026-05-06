/**
 * Escalation Scheduler Service
 * 
 * 自动升级触发器 - 定时检查告警/工单/事件是否需要升级
 */

import { DatabasePool } from '../database';
import { EscalationConfigService, EscalationPolicy } from './EscalationConfigService';
import { AlertRepository } from '../repositories/AlertRepository';
import { TicketingRepository } from '../services/ticketing/TicketingRepository';
import { EventBusService } from '../services/event-bus-service';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class EscalationScheduler {
  private db?: DatabasePool;
  private configService: EscalationConfigService;
  private alertRepo?: AlertRepository;
  private ticketRepo?: TicketingRepository;
  private eventBus?: EventBusService;
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(
    database?: DatabasePool,
    eventBus?: EventBusService
  ) {
    this.db = database;
    this.eventBus = eventBus;
    this.configService = new EscalationConfigService(database);
    
    if (database) {
      this.alertRepo = new AlertRepository(database);
      this.ticketRepo = new TicketingRepository(database);
    }
  }

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[EscalationScheduler] Already running');
      return;
    }

    await this.configService.initialize();
    const config = this.configService.getGlobalConfig();
    
    if (!config.autoEscalationEnabled) {
      logger.info('[EscalationScheduler] Auto escalation disabled');
      return;
    }

    this.isRunning = true;
    const intervalMs = config.checkIntervalSeconds * 1000;
    
    this.intervalId = setInterval(() => {
      this.checkAndEscalate().catch(err => {
        logger.error('[EscalationScheduler] Error:', err);
      });
    }, intervalMs);

    logger.info(`[EscalationScheduler] Started, interval: ${config.checkIntervalSeconds}s`);
    
    // 立即执行一次
    this.checkAndEscalate().catch(err => {
      logger.error('[EscalationScheduler] Initial check error:', err);
    });
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    logger.info('[EscalationScheduler] Stopped');
  }

  /**
   * 检查并触发升级
   */
  private async checkAndEscalate(): Promise<void> {
    logger.debug('[EscalationScheduler] Checking for escalations...');
    
    await Promise.all([
      this.checkAlertsForEscalation(),
      this.checkTicketsForEscalation(),
      this.checkIncidentsForEscalation(),
    ]);
  }

  /**
   * 检查告警升级
   */
  private async checkAlertsForEscalation(): Promise<void> {
    if (!this.alertRepo) {
      logger.debug('[EscalationScheduler] No alert repo, skipping');
      return;
    }

    try {
      // 获取未解决的告警
      const alerts = await this.alertRepo.findUnresolved();
      const now = Date.now();

      for (const alert of alerts) {
        const minutesSinceCreated = (now - new Date(alert.created_at).getTime()) / 60000;
        
        // 获取当前告警的升级级别
        const currentLevel = alert.escalation_level || 0;
        const severity = alert.severity;
        
        // 获取下一级升级策略
        const nextPolicy = this.configService.getNextEscalation('alert', severity, currentLevel);
        
        if (!nextPolicy) continue;

        // 检查是否超时
        if (minutesSinceCreated >= nextPolicy.timeoutMinutes) {
          await this.escalateAlert(alert.id, currentLevel + 1, nextPolicy);
        }
      }
    } catch (error) {
      logger.error('[EscalationScheduler] Alert escalation error:', error);
    }
  }

  /**
   * 检查工单升级 (基于 SLA)
   */
  private async checkTicketsForEscalation(): Promise<void> {
    if (!this.ticketRepo) {
      logger.debug('[EscalationScheduler] No ticket repo, skipping');
      return;
    }

    try {
      const tickets = await this.ticketRepo.findOpen();
      const now = Date.now();

      for (const ticket of tickets) {
        // 计算 SLA 剩余时间
        if (!ticket.due_date) continue;
        
        const dueDate = new Date(ticket.due_date).getTime();
        const minutesUntilDue = (dueDate - now) / 60000;
        
        // 获取当前升级级别
        const currentLevel = ticket.escalation_level || 0;
        const severity = ticket.priority;
        
        // 获取下一级升级策略
        const nextPolicy = this.configService.getNextEscalation('ticket', severity, currentLevel);
        
        if (!nextPolicy) continue;

        // 如果剩余时间小于超时时间，触发升级
        if (minutesUntilDue <= 0 || Math.abs(minutesUntilDue) >= nextPolicy.timeoutMinutes) {
          await this.escalateTicket(ticket.id, currentLevel + 1, nextPolicy);
        }
      }
    } catch (error) {
      logger.error('[EscalationScheduler] Ticket escalation error:', error);
    }
  }

  /**
   * 检查事件升级
   */
  private async checkIncidentsForEscalation(): Promise<void> {
    // 类似实现，从 incident 表查询
    logger.debug('[EscalationScheduler] Checking incidents...');
  }

  /**
   * 执行告警升级
   */
  private async escalateAlert(alertId: string, newLevel: number, policy: EscalationPolicy): Promise<void> {
    logger.info(`[EscalationScheduler] Escalating alert ${alertId} to level ${newLevel}`);

    // 更新告警级别
    if (this.alertRepo) {
      await this.alertRepo.updateEscalationLevel(alertId, newLevel);
    }

    // 发送通知
    await this.sendNotifications(policy, {
      type: 'alert',
      entityId: alertId,
      level: newLevel,
    });

    // 发布事件
    if (this.eventBus) {
      await this.eventBus.publish('orion.alerts.escalated', {
        alertId,
        newLevel,
        policy: policy.notifyUsers,
        channels: policy.notifyChannels,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 执行工单升级
   */
  private async escalateTicket(ticketId: string, newLevel: number, policy: EscalationPolicy): Promise<void> {
    logger.info(`[EscalationScheduler] Escalating ticket ${ticketId} to level ${newLevel}`);

    // 更新工单级别
    if (this.ticketRepo) {
      await this.ticketRepo.updateEscalationLevel(ticketId, newLevel);
    }

    // 发送通知
    await this.sendNotifications(policy, {
      type: 'ticket',
      entityId: ticketId,
      level: newLevel,
    });

    // 发布事件
    if (this.eventBus) {
      await this.eventBus.publish('orion.tickets.escalated', {
        ticketId,
        newLevel,
        policy: policy.notifyUsers,
        channels: policy.notifyChannels,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 发送通知
   */
  private async sendNotifications(policy: EscalationPolicy, context: {
    type: string;
    entityId: string;
    level: number;
  }): Promise<void> {
    for (const channel of policy.notifyChannels) {
      switch (channel) {
        case 'dingtalk':
          await this.sendDingTalk(policy.notifyUsers, context);
          break;
        case 'wechat':
          await this.sendWeChat(policy.notifyUsers, context);
          break;
        case 'email':
          await this.sendEmail(policy.notifyUsers, context);
          break;
        case 'sms':
          await this.sendSMS(policy.notifyUsers, context);
          break;
        case 'slack':
          await this.sendSlack(policy.notifyUsers, context);
          break;
      }
    }
  }

  private async sendDingTalk(users: string[], context: any): Promise<void> {
    // TODO: 实现钉钉通知
    logger.info(`[EscalationScheduler] Sending DingTalk to ${users.join(', ')}:`, context);
  }

  private async sendWeChat(users: string[], context: any): Promise<void> {
    logger.info(`[EscalationScheduler] Sending WeChat to ${users.join(', ')}:`, context);
  }

  private async sendEmail(users: string[], context: any): Promise<void> {
    logger.info(`[EscalationScheduler] Sending Email to ${users.join(', ')}:`, context);
  }

  private async sendSMS(users: string[], context: any): Promise<void> {
    logger.info(`[EscalationScheduler] Sending SMS to ${users.join(', ')}:`, context);
  }

  private async sendSlack(users: string[], context: any): Promise<void> {
    logger.info(`[EscalationScheduler] Sending Slack to ${users.join(', ')}:`, context);
  }

  /**
   * 手动触发升级 (API 调用)
   */
  async manualEscalate(
    entityType: 'alert' | 'ticket' | 'incident',
    entityId: string,
    targetLevel?: number
  ): Promise<{ success: boolean; message: string }> {
    const severity = 'default'; // TODO: 从实体获取
    const currentLevel = 0; // TODO: 从实体获取
    
    const nextPolicy = this.configService.getNextEscalation(entityType, severity, currentLevel);
    
    if (!nextPolicy) {
      return { success: false, message: 'No escalation policy found' };
    }

    const level = targetLevel || currentLevel + 1;

    if (entityType === 'alert') {
      await this.escalateAlert(entityId, level, nextPolicy);
    } else if (entityType === 'ticket') {
      await this.escalateTicket(entityId, level, nextPolicy);
    }

    return { success: true, message: `Escalated to level ${level}` };
  }
}

export const escalationScheduler = new EscalationScheduler();