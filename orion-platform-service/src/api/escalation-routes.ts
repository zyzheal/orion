/**
 * Escalation API Routes
 * Prefix: /api/v1/escalation
 * 
 * 统一升级管理 API
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { EscalationConfigService, EscalationPolicy, GlobalEscalationConfig } from '../services/escalation/EscalationConfigService';
import { escalationScheduler } from '../services/escalation';
import { EventBusService } from '../services/event-bus-service';

interface EscalationRoutesOptions {
  database?: DatabasePool;
  eventBus?: EventBusService;
}

interface CreatePolicyBody {
  entityType: 'alert' | 'ticket' | 'incident';
  severity?: string;
  level: number;
  timeoutMinutes: number;
  notifyUsers: string[];
  notifyChannels: ('dingtalk' | 'wechat' | 'email' | 'sms' | 'slack')[];
  autoAction?: string;
  isActive?: boolean;
}

interface UpdateConfigBody {
  defaults?: {
    alertTimeoutMinutes?: number;
    ticketSlaTimeoutMinutes?: number;
    incidentTimeoutMinutes?: number;
  };
  autoEscalationEnabled?: boolean;
  checkIntervalSeconds?: number;
}

export default async function escalationRoutes(
  app: FastifyInstance,
  options: EscalationRoutesOptions = {}
): Promise<void> {
  const configService = new EscalationConfigService(options.database);

  // Initialize scheduler with proper dependencies
  escalationScheduler.init(options.database, options.eventBus);

  // 初始化
  await configService.initialize();

  // ==================== 策略管理 ====================

  // POST /escalation/policies - 创建升级策略
  app.post<{ Body: CreatePolicyBody }>('/policies', async (request, reply) => {
    const body = request.body;

    if (!body.entityType || !body.level || !body.timeoutMinutes) {
      return reply.status(400).send({
        code: 'INVALID_INPUT',
        message: 'entityType, level, timeoutMinutes are required',
      });
    }

    try {
      const policy = await configService.createPolicy({
        entityType: body.entityType,
        severity: body.severity,
        level: body.level,
        timeoutMinutes: body.timeoutMinutes,
        notifyUsers: body.notifyUsers || [],
        notifyChannels: body.notifyChannels || ['dingtalk'],
        autoAction: body.autoAction,
        isActive: body.isActive ?? true,
      });

      return reply.send({ policy });
    } catch (error: any) {
      return reply.status(400).send({ code: 'CREATE_FAILED', message: error.message });
    }
  });

  // GET /escalation/policies - 获取所有升级策略
  app.get('/policies', async (request, reply) => {
    const { entityType, severity } = request.query as { entityType?: string; severity?: string };

    if (entityType) {
      const policies = configService.getPolicies(entityType, severity);
      return reply.send({ policies });
    }

    // 返回所有策略
    const allPolicies = configService.getAllPolicies();

    return reply.send({ policies: allPolicies });
  });

  // GET /escalation/policies/:id - 获取单个策略
  app.get<{ Params: { id: string } }>('/policies/:id', async (request, reply) => {
    const { id } = request.params;
    // TODO: 实现 getById
    return reply.send({ id, message: 'Not implemented' });
  });

  // DELETE /escalation/policies/:id - 删除策略
  app.delete<{ Params: { id: string } }>('/policies/:id', async (request, reply) => {
    const { id } = request.params;
    // TODO: 实现删除
    return reply.send({ id, message: 'Not implemented' });
  });

  // ==================== 全局配置 ====================

  // GET /escalation/config - 获取全局配置
  app.get('/config', async (_request, reply) => {
    const config = configService.getGlobalConfig();
    return reply.send({ config });
  });

  // PUT /escalation/config - 更新全局配置
  app.put<{ Body: UpdateConfigBody }>('/config', async (request, reply) => {
    const body = request.body;

    if (body.defaults) {
      configService.updateGlobalConfig({
        defaults: {
          alertTimeoutMinutes: body.defaults.alertTimeoutMinutes ?? 30,
          ticketSlaTimeoutMinutes: body.defaults.ticketSlaTimeoutMinutes ?? 60,
          incidentTimeoutMinutes: body.defaults.incidentTimeoutMinutes ?? 120,
        },
        autoEscalationEnabled: body.autoEscalationEnabled,
        checkIntervalSeconds: body.checkIntervalSeconds,
      });
    }

    const config = configService.getGlobalConfig();
    return reply.send({ config });
  });

  // ==================== 调度器控制 ====================

  // POST /escalation/scheduler/start - 启动调度器
  app.post('/scheduler/start', async (_request, reply) => {
    try {
      await escalationScheduler.start();
      return reply.send({ message: 'Scheduler started' });
    } catch (error: any) {
      return reply.status(500).send({ code: 'START_FAILED', message: error.message });
    }
  });

  // POST /escalation/scheduler/stop - 停止调度器
  app.post('/scheduler/stop', async (_request, reply) => {
    escalationScheduler.stop();
    return reply.send({ message: 'Scheduler stopped' });
  });

  // GET /escalation/scheduler/status - 获取调度器状态
  app.get('/scheduler/status', async (_request, reply) => {
    return reply.send({
      running: (escalationScheduler as any).isRunning || false,
      config: configService.getGlobalConfig(),
    });
  });

  // ==================== 手动升级 ====================

  // POST /escalation/manual - 手动触发升级
  app.post<{ Body: { entityType: 'alert' | 'ticket' | 'incident'; entityId: string; targetLevel?: number } }>(
    '/manual',
    async (request, reply) => {
      const { entityType, entityId, targetLevel } = request.body;

      if (!entityType || !entityId) {
        return reply.status(400).send({
          code: 'INVALID_INPUT',
          message: 'entityType and entityId are required',
        });
      }

      try {
        const result = await escalationScheduler.manualEscalate(entityType, entityId, targetLevel);
        return reply.send(result);
      } catch (error: any) {
        return reply.status(400).send({ code: 'ESCALATE_FAILED', message: error.message });
      }
    }
  );

  // ==================== 默认策略初始化 ====================

  // POST /escalation/init-defaults - 初始化默认策略
  app.post('/init-defaults', async (_request, reply) => {
    const defaultPolicies: Omit<EscalationPolicy, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // 告警升级策略
      { entityType: 'alert', severity: 'critical', level: 1, timeoutMinutes: 5, notifyUsers: ['oncall'], notifyChannels: ['dingtalk', 'sms'], isActive: true },
      { entityType: 'alert', severity: 'critical', level: 2, timeoutMinutes: 10, notifyUsers: ['tech_lead'], notifyChannels: ['dingtalk'], isActive: true },
      { entityType: 'alert', severity: 'critical', level: 3, timeoutMinutes: 15, notifyUsers: ['org_admin'], notifyChannels: ['dingtalk', 'sms'], isActive: true },
      { entityType: 'alert', severity: 'high', level: 1, timeoutMinutes: 15, notifyUsers: ['oncall'], notifyChannels: ['dingtalk'], isActive: true },
      { entityType: 'alert', severity: 'high', level: 2, timeoutMinutes: 30, notifyUsers: ['tech_lead'], notifyChannels: ['dingtalk'], isActive: true },
      { entityType: 'alert', severity: 'medium', level: 1, timeoutMinutes: 30, notifyUsers: ['oncall'], notifyChannels: ['dingtalk'], isActive: true },
      { entityType: 'alert', severity: 'low', level: 1, timeoutMinutes: 60, notifyUsers: ['oncall'], notifyChannels: ['email'], isActive: true },
      
      // 工单升级策略 (基于 SLA)
      { entityType: 'ticket', severity: 'critical', level: 1, timeoutMinutes: 30, notifyUsers: ['assignee'], notifyChannels: ['dingtalk'], isActive: true },
      { entityType: 'ticket', severity: 'critical', level: 2, timeoutMinutes: 60, notifyUsers: ['tech_lead'], notifyChannels: ['dingtalk'], isActive: true },
      { entityType: 'ticket', severity: 'critical', level: 3, timeoutMinutes: 120, notifyUsers: ['org_admin'], notifyChannels: ['dingtalk', 'sms'], isActive: true },
      { entityType: 'ticket', severity: 'high', level: 1, timeoutMinutes: 60, notifyUsers: ['assignee'], notifyChannels: ['dingtalk'], isActive: true },
      { entityType: 'ticket', severity: 'high', level: 2, timeoutMinutes: 180, notifyUsers: ['tech_lead'], notifyChannels: ['dingtalk'], isActive: true },
      { entityType: 'ticket', severity: 'medium', level: 1, timeoutMinutes: 240, notifyUsers: ['assignee'], notifyChannels: ['email'], isActive: true },
      { entityType: 'ticket', severity: 'low', level: 1, timeoutMinutes: 480, notifyUsers: ['assignee'], notifyChannels: ['email'], isActive: true },

      // 事件升级策略
      { entityType: 'incident', severity: 'critical', level: 1, timeoutMinutes: 5, notifyUsers: ['oncall'], notifyChannels: ['dingtalk', 'sms'], autoAction: 'page_oncall', isActive: true },
      { entityType: 'incident', severity: 'critical', level: 2, timeoutMinutes: 15, notifyUsers: ['tech_lead'], notifyChannels: ['dingtalk', 'sms'], isActive: true },
      { entityType: 'incident', severity: 'high', level: 1, timeoutMinutes: 15, notifyUsers: ['oncall'], notifyChannels: ['dingtalk'], isActive: true },
      { entityType: 'incident', severity: 'high', level: 2, timeoutMinutes: 30, notifyUsers: ['tech_lead'], notifyChannels: ['dingtalk'], isActive: true },
    ];

    const created: EscalationPolicy[] = [];
    for (const policy of defaultPolicies) {
      try {
        const createdPolicy = await configService.createPolicy(policy);
        created.push(createdPolicy);
      } catch (error) {
        // 忽略重复错误
      }
    }

    return reply.send({ 
      message: `Initialized ${created.length} default policies`,
      policies: created,
    });
  });
}