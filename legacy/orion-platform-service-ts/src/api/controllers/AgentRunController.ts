/**
 * Agent Run Controller
 *
 * 处理 Agent 运行相关的 HTTP 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AgentRunService } from '../../services/agent-run-service';
import { AgentAction } from '../../models/AgentRun';

export class AgentRunController {
  private service: AgentRunService;

  constructor(service: AgentRunService) {
    this.service = service;
  }

  /**
   * 手动触发 Agent 运行
   * POST /api/v1/agent-runs
   */
  async triggerRun(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;

      if (!body.agentProfileId) {
        await reply.status(400).send({
          success: false,
          error: 'agentProfileId is required',
        });
        return;
      }

      const run = await this.service.triggerRun({
        agentProfileId: body.agentProfileId,
        triggerPayload: body.triggerPayload || {},
        totalSteps: body.totalSteps,
        tenantId: body.tenantId,
      });

      await reply.status(201).send({
        success: true,
        data: run,
        message: `Agent run "${run.id}" started`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to trigger agent run',
      });
    }
  }

  /**
   * 执行 Agent 步骤
   * POST /api/v1/agent-runs/:id/step
   */
  async executeStep(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;

      if (!body.action) {
        await reply.status(400).send({
          success: false,
          error: 'action is required (read_file, run_command, write_code, create_pr, request_approval)',
        });
        return;
      }

      const decision = await this.service.executeStep(
        params.id,
        body.action as AgentAction,
        body.actionInput || {}
      );

      await reply.send({
        success: true,
        data: decision,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to execute agent step',
      });
    }
  }

  /**
   * 列出 Agent 运行
   * GET /api/v1/agent-runs
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const runs = await this.service.list({
        agentProfileId: query.agentProfileId,
        statusFilter: query.status,
      });

      await reply.send({
        success: true,
        data: runs,
        total: runs.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list agent runs',
      });
    }
  }

  /**
   * 获取 Agent 运行详情
   * GET /api/v1/agent-runs/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const run = await this.service.getById(params.id);

      await reply.send({
        success: true,
        data: run,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Agent run not found',
      });
    }
  }

  /**
   * 取消 Agent 运行
   * POST /api/v1/agent-runs/:id/cancel
   */
  async cancel(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const run = await this.service.cancel(params.id);

      await reply.send({
        success: true,
        data: run,
        message: 'Agent run cancelled',
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to cancel agent run',
      });
    }
  }

  /**
   * 重试 Agent 运行
   * POST /api/v1/agent-runs/:id/retry
   */
  async retry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const run = await this.service.retry(params.id);

      await reply.status(201).send({
        success: true,
        data: run,
        message: 'Agent run retried',
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retry agent run',
      });
    }
  }

  /**
   * 获取运行决策日志
   * GET /api/v1/agent-runs/:id/decisions
   */
  async getDecisions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const run = await this.service.getById(params.id);

      await reply.send({
        success: true,
        data: run.decisions,
        total: run.decisions.length,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Agent run not found',
      });
    }
  }
}
