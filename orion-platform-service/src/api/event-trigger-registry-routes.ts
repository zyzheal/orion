/**
 * Event Trigger Registry API Routes
 * 事件触发器注册表 REST API 路由
 *
 * Prefix: /v1/event-registry (handled by register)
 *
 * Endpoints:
 * - GET /v1/event-registry/event-types - 获取可用事件类型列表
 * - GET /v1/event-registry/subscriptions - 获取当前订阅状态
 * - POST /v1/event-registry/test-match - 测试事件与触发器的匹配
 * - GET /v1/event-registry/statistics - 触发器执行统计
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { WorkflowTriggerRepository } from '../repositories/WorkflowTriggerRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import type { WorkflowTrigger } from '../repositories/WorkflowTriggerRepository';
import { ORION_STREAMS } from '../services/types/event-types';

/**
 * 路由选项接口
 */
interface EventRegistryRoutesOptions {
  database?: DatabasePool;
}

/**
 * 测试匹配请求体
 */
interface TestMatchBody {
  eventType: string;
  eventPayload: Record<string, any>;
  triggerId?: string;
}

/**
 * 已知事件类型元数据
 */
const KNOWN_EVENT_TYPES: Array<{
  type: string;
  category: string;
  description: string;
  samplePayload: Record<string, any>;
}> = [
  // Pipeline 事件
  {
    type: 'pipeline.run.started',
    category: 'pipeline',
    description: 'Pipeline 运行开始',
    samplePayload: { pipelineId: 'pipeline-1', branch: 'main', commit: 'abc123', triggeredBy: 'user-1' },
  },
  {
    type: 'pipeline.run.completed',
    category: 'pipeline',
    description: 'Pipeline 运行完成',
    samplePayload: { pipelineId: 'pipeline-1', status: 'success', duration: 120000 },
  },
  {
    type: 'pipeline.run.failed',
    category: 'pipeline',
    description: 'Pipeline 运行失败',
    samplePayload: { pipelineId: 'pipeline-1', failedStage: 'test', errorMessage: 'Unit tests failed' },
  },
  {
    type: 'pipeline.stage.completed',
    category: 'pipeline',
    description: 'Pipeline 阶段完成',
    samplePayload: { pipelineId: 'pipeline-1', stageName: 'build', status: 'success' },
  },
  // Code 事件
  {
    type: 'code.pr.created',
    category: 'code',
    description: 'Pull Request 创建',
    samplePayload: { prId: 'pr-1', repo: 'my-repo', branch: 'feature-x', author: 'user-1' },
  },
  {
    type: 'code.pr.merged',
    category: 'code',
    description: 'Pull Request 合并',
    samplePayload: { prId: 'pr-1', repo: 'my-repo', targetBranch: 'main' },
  },
  // Deploy 事件
  {
    type: 'deploy.started',
    category: 'deploy',
    description: '部署开始',
    samplePayload: { appId: 'app-1', environment: 'production', version: 'v1.2.3' },
  },
  {
    type: 'deploy.completed',
    category: 'deploy',
    description: '部署完成',
    samplePayload: { appId: 'app-1', environment: 'production', status: 'success' },
  },
  {
    type: 'deploy.rolled_back',
    category: 'deploy',
    description: '部署回滚',
    samplePayload: { appId: 'app-1', environment: 'production', reason: 'Health check failed' },
  },
  // Config 事件
  {
    type: 'config.changed',
    category: 'config',
    description: '配置变更',
    samplePayload: { configKey: 'feature.flag', oldValue: 'false', newValue: 'true', changedBy: 'user-1' },
  },
  // Incident 事件
  {
    type: 'incident.created',
    category: 'incident',
    description: '事故创建',
    samplePayload: { incidentId: 'inc-1', severity: 'high', title: 'Service down', affectedService: 'api' },
  },
  {
    type: 'incident.resolved',
    category: 'incident',
    description: '事故解决',
    samplePayload: { incidentId: 'inc-1', resolution: 'Restarted service', resolvedBy: 'user-1' },
  },
  // Workflow 事件
  {
    type: 'workflow.task.completed',
    category: 'workflow',
    description: '工作流任务完成',
    samplePayload: { taskId: 'task-1', completedBy: 'user-1', instanceId: 'inst-1' },
  },
];

/**
 * 默认导出函数
 */
export default async function eventRegistryRoutes(
  app: FastifyInstance,
  options: EventRegistryRoutesOptions
): Promise<void> {
  const database = options.database;
  let triggerRepo: WorkflowTriggerRepository | null = null;

  if (database) {
    triggerRepo = new WorkflowTriggerRepository(database);
  }

  // ==================== GET /v1/event-registry/event-types - 可用事件类型 ====================
  app.get(
    '/event-types',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        // 返回已知事件类型
        return reply.send({
          success: true,
          data: {
            eventTypes: KNOWN_EVENT_TYPES,
            categories: [...new Set(KNOWN_EVENT_TYPES.map((e) => e.category))],
            streams: Object.values(ORION_STREAMS).map((s) => ({
              name: s.name,
              subjects: s.subjects,
            })),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // ==================== GET /v1/event-registry/subscriptions - 订阅状态 ====================
  app.get(
    '/subscriptions',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo) {
          return reply.status(503).send({
            success: false,
            error: 'Database not available',
          });
        }

        // 获取所有启用的事件触发器
        const eventTriggers = await triggerRepo.findByType('event');
        const enabledTriggers = eventTriggers.filter((t) => t.enabled);

        const subscriptions = enabledTriggers.map((trigger) => ({
          triggerId: trigger.id,
          triggerName: trigger.name,
          eventType: trigger.eventType,
          workflowId: trigger.workflowId,
          enabled: trigger.enabled,
          eventFilter: trigger.eventFilter,
          createdAt: trigger.createdAt,
        }));

        return reply.send({
          success: true,
          data: {
            total: subscriptions.length,
            subscriptions,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // ==================== POST /v1/event-registry/test-match - 测试事件匹配 ====================
  app.post<{ Body: TestMatchBody }>(
    '/test-match',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest<{ Body: TestMatchBody }>,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo) {
          return reply.status(503).send({
            success: false,
            error: 'Database not available',
          });
        }

        const { eventType, eventPayload, triggerId } = request.body;

        // 查找匹配的触发器
        let triggers: WorkflowTrigger[];
        if (triggerId) {
          const trigger = await triggerRepo.findById(triggerId);
          triggers = trigger ? [trigger] : [];
        } else {
          triggers = await triggerRepo.findByEventType(eventType);
        }

        const results = triggers.map((trigger) => {
          const filter = trigger.eventFilter;
          let matched = true;
          let matchDetails = 'No filter configured (matches all)';
          const matchedFields: Record<string, any> = {};

          if (filter && Object.keys(filter).length > 0) {
            const payload = eventPayload || {};

            for (const [key, expectedValue] of Object.entries(filter)) {
              const actualValue = getNestedValue(payload, key);

              if (actualValue === undefined) {
                matched = false;
                matchDetails = `Field "${key}" not found in event payload`;
                break;
              }

              if (typeof expectedValue === 'object' && expectedValue !== null) {
                const opResult = matchOperator(expectedValue, actualValue);
                if (!opResult.matched) {
                  matched = false;
                  matchDetails = opResult.reason || 'Filter condition not met';
                  break;
                }
              } else if (actualValue !== expectedValue) {
                matched = false;
                matchDetails = `Field "${key}" mismatch: expected "${expectedValue}", got "${actualValue}"`;
                break;
              }

              matchedFields[key] = actualValue;
            }

            if (matched) {
              matchDetails = 'All filter conditions matched';
            }
          }

          return {
            triggerId: trigger.id,
            triggerName: trigger.name,
            workflowId: trigger.workflowId,
            matched,
            matchDetails,
            matchedFields: matched ? matchedFields : undefined,
          };
        });

        return reply.send({
          success: true,
          data: {
            eventType,
            eventPayload,
            matchingTriggers: results.filter((r) => r.matched).length,
            results,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // ==================== GET /v1/event-registry/statistics - 触发器统计 ====================
  app.get(
    '/statistics',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo) {
          return reply.status(503).send({
            success: false,
            error: 'Database not available',
          });
        }

        // 获取所有触发器的统计
        const allTriggers = await triggerRepo.findAll();
        const triggerStats = allTriggers.entities.map((trigger) => ({
          triggerId: trigger.id,
          triggerName: trigger.name,
          type: trigger.type,
          enabled: trigger.enabled,
          eventType: trigger.eventType,
          cronExpression: trigger.cronExpression,
        }));

        // 按类型分组统计
        const byType: Record<string, { total: number; enabled: number }> = {};
        for (const trigger of allTriggers.entities) {
          if (!byType[trigger.type]) {
            byType[trigger.type] = { total: 0, enabled: 0 };
          }
          byType[trigger.type].total++;
          if (trigger.enabled) {
            byType[trigger.type].enabled++;
          }
        }

        return reply.send({
          success: true,
          data: {
            totalTriggers: allTriggers.total,
            byType,
            triggers: triggerStats.slice(0, 50),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );
}

/**
 * 获取嵌套属性值
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

/**
 * 操作符匹配
 */
function matchOperator(
  condition: Record<string, any>,
  actualValue: any
): { matched: boolean; reason?: string } {
  for (const [operator, expectedValue] of Object.entries(condition)) {
    switch (operator) {
      case '$eq':
        if (actualValue !== expectedValue) {
          return { matched: false, reason: `Value not equal: ${expectedValue}` };
        }
        break;
      case '$ne':
        if (actualValue === expectedValue) {
          return { matched: false, reason: `Value should not equal: ${expectedValue}` };
        }
        break;
      case '$gt':
        if (!(actualValue > expectedValue)) {
          return { matched: false, reason: `Value not greater than: ${expectedValue}` };
        }
        break;
      case '$gte':
        if (!(actualValue >= expectedValue)) {
          return { matched: false, reason: `Value not greater or equal: ${expectedValue}` };
        }
        break;
      case '$lt':
        if (!(actualValue < expectedValue)) {
          return { matched: false, reason: `Value not less than: ${expectedValue}` };
        }
        break;
      case '$lte':
        if (!(actualValue <= expectedValue)) {
          return { matched: false, reason: `Value not less or equal: ${expectedValue}` };
        }
        break;
      case '$contains':
        if (typeof actualValue === 'string') {
          if (!actualValue.includes(expectedValue)) {
            return { matched: false, reason: `String does not contain: ${expectedValue}` };
          }
        } else if (Array.isArray(actualValue)) {
          if (!actualValue.includes(expectedValue)) {
            return { matched: false, reason: `Array does not contain: ${expectedValue}` };
          }
        } else {
          return { matched: false, reason: `$contains only works with string or array` };
        }
        break;
      case '$in':
        if (!Array.isArray(expectedValue)) {
          return { matched: false, reason: `$in requires an array` };
        }
        if (!expectedValue.includes(actualValue)) {
          return { matched: false, reason: `Value not in: [${expectedValue.join(', ')}]` };
        }
        break;
      case '$regex':
        try {
          const regex = new RegExp(expectedValue);
          if (!regex.test(actualValue)) {
            return { matched: false, reason: `Value does not match regex: ${expectedValue}` };
          }
        } catch {
          return { matched: false, reason: `Invalid regex: ${expectedValue}` };
        }
        break;
      default:
        return { matched: false, reason: `Unknown operator: ${operator}` };
    }
  }

  return { matched: true };
}
