/**
 * Webhook Controller - Webhook 接收和处理控制器
 *
 * 接收来自 GitLab、Gerrit、GitHub 的 Webhook 请求，
 * 统一解析并发布到 NATS 事件总线。
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  CodeRepoWebhookService,
  WebhookEventType,
  RepoType,
} from '../services/code-repo';

// 共享实例
const webhookService = new CodeRepoWebhookService();

/** 注册事件发布器 (由应用启动时调用) */
export function setEventPublisher(publisher: any): void {
  webhookService.setEventPublisher(publisher);
}

export class WebhookController {
  /**
   * 获取服务实例 (用于测试注入)
   */
  getService(): CodeRepoWebhookService {
    return webhookService;
  }

  /**
   * 接收 GitLab Webhook
   *
   * POST /api/v1/code-repo/webhooks/gitlab
   *
   * GitLab Webhook 会发送:
   *   - X-Gitlab-Token: 用于验证的 Secret Token
   *   - X-Gitlab-Event: 事件类型
   */
  async handleGitLab(request: FastifyRequest, reply: FastifyReply) {
    try {
      const headers: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        headers[key] = typeof value === 'string' ? value : value?.[0];
      }

      // 验证签名
      const isValid = webhookService.verifyWebhookSignature(
        'gitlab',
        JSON.stringify(request.body),
        headers
      );

      if (!isValid) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid webhook signature',
        });
      }

      const result = await webhookService.handleGitLabWebhook(
        request.body as any,
        headers
      );

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({
        success: true,
        eventId: result.eventId,
        eventType: result.eventType,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 接收 Gerrit Webhook
   *
   * POST /api/v1/code-repo/webhooks/gerrit
   */
  async handleGerrit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const headers: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        headers[key] = typeof value === 'string' ? value : value?.[0];
      }

      const result = await webhookService.handleGerritWebhook(
        request.body as any,
        headers
      );

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({
        success: true,
        eventId: result.eventId,
        eventType: result.eventType,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 接收 GitHub Webhook
   *
   * POST /api/v1/code-repo/webhooks/github
   *
   * GitHub Webhook 会发送:
   *   - X-GitHub-Event: 事件类型
   *   - X-Hub-Signature-256: HMAC-SHA256 签名
   */
  async handleGitHub(request: FastifyRequest, reply: FastifyReply) {
    try {
      const headers: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        headers[key] = typeof value === 'string' ? value : value?.[0];
      }

      // 验证签名
      const isValid = webhookService.verifyWebhookSignature(
        'github',
        JSON.stringify(request.body),
        headers
      );

      if (!isValid) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid webhook signature',
        });
      }

      const result = await webhookService.handleGitHubWebhook(
        request.body as any,
        headers
      );

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({
        success: true,
        eventId: result.eventId,
        eventType: result.eventType,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 获取 Webhook 事件日志
   *
   * GET /api/v1/code-repo/webhooks/logs
   */
  async getEventLog(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { eventType, repoType, limit } = request.query as {
        eventType?: string;
        repoType?: string;
        limit?: string;
      };

      const logs = webhookService.getEventLog({
        eventType: eventType as WebhookEventType,
        repoType: repoType as RepoType,
        limit: limit ? parseInt(limit) : 50,
      });

      return reply.send({
        success: true,
        data: logs,
        count: logs.length,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 注册 Webhook 密钥
   *
   * POST /api/v1/code-repo/webhooks/secret
   */
  async registerSecret(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as { repoId: string; secret: string };

      if (!body.repoId || !body.secret) {
        return reply.status(400).send({
          success: false,
          error: 'repoId and secret are required',
        });
      }

      webhookService.registerWebhookSecret(body.repoId, body.secret);

      return reply.send({
        success: true,
        message: 'Webhook secret registered',
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }
}
