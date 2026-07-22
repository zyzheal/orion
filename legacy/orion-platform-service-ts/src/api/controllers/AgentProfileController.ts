/**
 * Agent Profile Controller
 *
 * 处理 Agent Profile 相关的 HTTP 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AgentProfileService } from '../../services/agent-profile-service';

export class AgentProfileController {
  private service: AgentProfileService;

  constructor(service: AgentProfileService) {
    this.service = service;
  }

  /**
   * 创建 Agent Profile
   * POST /api/v1/agents
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const profile = await this.service.create({
        name: body.name,
        role: body.role,
        description: body.description,
        tools: body.tools,
        capabilities: body.capabilities,
        constraints: body.constraints,
        llmConfig: body.llmConfig,
      });

      await reply.status(201).send({
        success: true,
        data: profile,
        message: `Agent profile "${profile.name}" created successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create agent profile',
      });
    }
  }

  /**
   * 列出 Agent Profiles
   * GET /api/v1/agents
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const profiles = await this.service.list({
        roleFilter: query.role,
        enabledOnly: query.enabledOnly === 'true',
      });

      await reply.send({
        success: true,
        data: profiles,
        total: profiles.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list agent profiles',
      });
    }
  }

  /**
   * 获取 Agent Profile 详情
   * GET /api/v1/agents/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const profile = await this.service.getById(params.id);

      await reply.send({
        success: true,
        data: profile,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Agent profile not found',
      });
    }
  }

  /**
   * 更新 Agent Profile
   * PUT /api/v1/agents/:id
   */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const profile = await this.service.update(params.id, {
        description: body.description,
        tools: body.tools,
        capabilities: body.capabilities,
        constraints: body.constraints,
        llmConfig: body.llmConfig,
        enabled: body.enabled,
      });

      await reply.send({
        success: true,
        data: profile,
        message: `Agent profile "${profile.name}" updated successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update agent profile',
      });
    }
  }

  /**
   * 删除 Agent Profile
   * DELETE /api/v1/agents/:id
   */
  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      await this.service.delete(params.id);

      await reply.send({
        success: true,
        message: 'Agent profile deleted successfully',
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete agent profile',
      });
    }
  }

  /**
   * 启用/禁用 Agent
   * PATCH /api/v1/agents/:id/toggle
   */
  async toggle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const profile = await this.service.toggle(params.id);

      await reply.send({
        success: true,
        data: profile,
        message: `Agent profile "${profile.name}" ${profile.enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to toggle agent',
      });
    }
  }
}
