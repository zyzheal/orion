/**
 * Workflow Webhook Routes
 * 工作流 Webhook 触发端点（无需认证）
 *
 * Prefix: /api/v1/webhooks
 *
 * Endpoints:
 * - POST /api/v1/webhooks/:webhookPath - Webhook 触发端点
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'crypto';
import { DatabasePool } from '../services/database';
import { WorkflowTriggerRepository } from '../repositories/WorkflowTriggerRepository';
import { WorkflowTriggerLogRepository } from '../repositories/WorkflowTriggerLogRepository';
import { createLogger } from '../utils/logger';
import { OrionError, NotFoundError, UnauthorizedError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

const logger = pino({ name: 'workflow-webhook-routes' });

/**
 * 默认导出函数
 */
export default async function workflowWebhookRoutes(
  app: FastifyInstance,
  options: { database?: DatabasePool }
): Promise<void> {
  const database = options.database;
  let triggerRepo: WorkflowTriggerRepository | null = null;
  let triggerLogRepo: WorkflowTriggerLogRepository | null = null;

  if (database) {
    triggerRepo = new WorkflowTriggerRepository(database);
    triggerLogRepo = new WorkflowTriggerLogRepository(database);
  }

  // ==================== POST /api/v1/webhooks/:webhookPath - Webhook 触发 ====================
  // 注意：此端点不需要认证，通过 webhook_secret 进行签名验证
  app.post<{
    Params: { webhookPath: string };
    Body: Record<string, any>;
    Headers: { 'x-webhook-signature'?: string; 'x-webhook-timestamp'?: string };
  }>(
    '/:webhookPath',
    async (
      request: FastifyRequest<{
        Params: { webhookPath: string };
        Body: Record<string, any>;
        Headers: { 'x-webhook-signature'?: string; 'x-webhook-timestamp'?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo || !triggerLogRepo) {
          return handleError(reply, new ServiceUnavailableError('Database not available'));
        }

        const { webhookPath } = request.params;
        const fullPath = `/api/v1/webhooks/${webhookPath}`;

        // 查找匹配的触发器
        const trigger = await triggerRepo.findByWebhookPath(fullPath);
        if (!trigger) {
          return handleError(reply, new NotFoundError('Webhook not found'));
        }

        // 签名验证
        if (trigger.webhookSecret) {
          const signature = request.headers['x-webhook-signature'];
          const timestamp = request.headers['x-webhook-timestamp'];

          if (!signature) {
            return handleError(reply, new UnauthorizedError('Missing signature header'));
          }

          // 时间戳防重放验证（5 分钟窗口）
          if (timestamp) {
            const requestTime = parseInt(timestamp, 10);
            if (isNaN(requestTime) || Math.abs(Date.now() - requestTime) > 5 * 60 * 1000) {
              return handleError(reply, new UnauthorizedError('Expired timestamp'));
            }
          }

          const payload = timestamp
            ? `${timestamp}.${JSON.stringify(request.body)}`
            : JSON.stringify(request.body);

          const expectedSignature = crypto
            .createHmac('sha256', trigger.webhookSecret)
            .update(payload)
            .digest('hex');

          if (signature !== `sha256=${expectedSignature}` && signature !== expectedSignature) {
            return handleError(reply, new UnauthorizedError('Invalid signature'));
          }
        }

        // 记录触发日志
        const log = await triggerLogRepo.create({
          trigger_id: trigger.id,
          event_type: 'webhook',
          event_payload: request.body || {},
          status: 'pending',
        });

        const startTime = Date.now();

        try {
          // 创建工作流实例
          const { WorkflowEngine } = await import('../services/lowcode/WorkflowEngine');
          const engine = new WorkflowEngine(undefined, undefined, database);
          const instance = await engine.createInstance(
            trigger.workflowId,
            request.body || {},
            'webhook'
          );

          if (trigger.triggerStrategy === 'sync') {
            // 同步执行
            const result = await engine.execute(instance.id);

            await triggerLogRepo.updateStatus(log.id, 'success', undefined, Date.now() - startTime);

            return reply.send({
              success: true,
              instanceId: instance.id,
              execution: result,
            });
          } else {
            // 异步执行
            engine.execute(instance.id).catch(err => {
              logger.error(`[Webhook Trigger] Workflow execution failed: ${err}`);
            });

            return reply.status(202).send({
              success: true,
              instanceId: instance.id,
              status: 'queued',
            });
          }
        } catch (executionError) {
          const errorMessage = executionError instanceof Error ? executionError.message : String(executionError);
          await triggerLogRepo.updateStatus(log.id, 'failed', errorMessage, Date.now() - startTime);

          return handleError(reply, new OrionError('Unknown error', ErrorCode.INTERNAL_ERROR));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
