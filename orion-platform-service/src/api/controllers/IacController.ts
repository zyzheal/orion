/**
 * IaC Controller - Fastify HTTP request/response handlers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { WorkspaceService } from '../../services/iac/WorkspaceService';
import { PlanService } from '../../services/iac/PlanService';

export class IacController {
  private workspaceService: WorkspaceService;
  private planService: PlanService;

  constructor(options: {
    workspaceService: WorkspaceService;
    planService: PlanService;
  }) {
    this.workspaceService = options.workspaceService;
    this.planService = options.planService;
  }

  // ==================== Workspace CRUD ====================

  async listWorkspaces(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string>;
      const { workspaces, total } = await this.workspaceService.list({
        projectId: query.projectId,
        environment: query.environment as any,
        status: query.status as any,
        provider: query.provider as any,
        page: query.page ? parseInt(query.page) : undefined,
        perPage: query.perPage ? parseInt(query.perPage) : undefined,
      });

      await reply.send({ success: true, data: workspaces, total });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getWorkspace(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const workspace = await this.workspaceService.getById(params.id);
      if (!workspace) {
        await reply.status(404).send({ success: false, error: 'Workspace not found' });
        return;
      }
      await reply.send({ success: true, data: workspace });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async createWorkspace(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.name || !body.projectId || !body.environment) {
        await reply.status(400).send({
          success: false,
          error: 'name, projectId, and environment are required',
        });
        return;
      }
      const workspace = await this.workspaceService.create({
        name: body.name as string,
        projectId: body.projectId as string,
        environment: body.environment as any,
        statePath: body.statePath as string | undefined,
        variables: body.variables as Record<string, unknown> | undefined,
        provider: body.provider as any,
      });

      await reply.status(201).send({ success: true, data: workspace });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create workspace',
      });
    }
  }

  async updateWorkspace(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const workspace = await this.workspaceService.update(params.id, {
        name: body.name as string | undefined,
        statePath: body.statePath as string | undefined,
        variables: body.variables as Record<string, unknown> | undefined,
        status: body.status as any,
      });
      if (!workspace) {
        await reply.status(404).send({ success: false, error: 'Workspace not found' });
        return;
      }
      await reply.send({ success: true, data: workspace });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update workspace',
      });
    }
  }

  // ==================== Plan & Apply ====================

  async generatePlan(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      // Verify workspace exists
      const workspace = await this.workspaceService.getById(params.id);
      if (!workspace) {
        await reply.status(404).send({ success: false, error: 'Workspace not found' });
        return;
      }

      const plan = await this.planService.create({
        workspaceId: params.id,
        commitSha: (body.commitSha as string) || 'HEAD',
        resourceChanges: body.resourceChanges as Record<string, unknown> | undefined,
        costEstimate: body.costEstimate as Record<string, unknown> | undefined,
      });

      await reply.status(201).send({ success: true, data: plan });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to generate plan',
      });
    }
  }

  async applyPlan(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const planId = (body.planId as string) || params.id;

      const plan = await this.planService.apply(planId);
      if (!plan) {
        await reply.status(404).send({ success: false, error: 'Plan not found' });
        return;
      }
      await reply.send({ success: true, data: plan });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to apply plan',
      });
    }
  }

  // ==================== State & Resources ====================

  async getCurrentState(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const state = await this.workspaceService.getCurrentState(params.id);
      if (!state) {
        await reply.status(404).send({ success: false, error: 'No state found for workspace' });
        return;
      }
      await reply.send({ success: true, data: state });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async listResources(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const resources = await this.workspaceService.listResources(params.id);
      await reply.send({ success: true, data: resources, total: resources.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async importResource(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      if (!body.address || !body.type) {
        await reply.status(400).send({
          success: false,
          error: 'address and type are required',
        });
        return;
      }

      const resource = await this.workspaceService.importResource(params.id, body);
      await reply.status(201).send({ success: true, data: resource });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to import resource',
      });
    }
  }

  // ==================== Modules ====================

  async listModules(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const modules = await this.workspaceService.listModules();
      await reply.send({ success: true, data: modules, total: modules.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async createModule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.name || !body.version || !body.source) {
        await reply.status(400).send({
          success: false,
          error: 'name, version, and source are required',
        });
        return;
      }
      const module = await this.workspaceService.createModule({
        name: body.name as string,
        version: body.version as string,
        source: body.source as string,
        dependencies: body.dependencies as Record<string, unknown> | undefined,
      });

      await reply.status(201).send({ success: true, data: module });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create module',
      });
    }
  }
}
