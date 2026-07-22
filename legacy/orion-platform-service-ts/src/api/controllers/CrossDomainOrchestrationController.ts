/**
 * CrossDomainOrchestrationController - Fastify API Controller
 *
 * Handles HTTP requests for cross-domain orchestration.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import {
  CrossDomainOrchestrator,
  CreateOrchestrationInput,
  OrchestrationListFilter,
} from '../../services/cross-domain-orchestration/CrossDomainOrchestrator';

export class CrossDomainOrchestrationController extends BaseController {
  private orchestrator: CrossDomainOrchestrator;

  constructor(orchestrator: CrossDomainOrchestrator) {
    super();
    this.orchestrator = orchestrator;
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const tenantId = this.getTenantId(request);
      const createdBy = (request.headers['x-user-id'] as string) || 'system';

      const { name, description, domains, steps, metadata } = body;

      if (!name || !domains || !steps || !Array.isArray(steps) || steps.length === 0) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'ORCH_001',
          message: 'Missing required fields: name, domains, steps',
        });
        return;
      }

      const input: CreateOrchestrationInput = { name, description, domains, steps, metadata };
      const orchestration = await this.orchestrator.createOrchestration(tenantId, input, createdBy);

      await reply.status(201).send({
        id: orchestration.id,
        name: orchestration.name,
        status: orchestration.status,
        stepCount: orchestration.stepCount,
        domains: orchestration.domains,
        createdAt: orchestration.createdAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'ORCH_500',
        message: error.message || 'Failed to create orchestration',
      });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const query = request.query as any;

      const filter: OrchestrationListFilter = {
        status: query.status ? (query.status as any) : undefined,
        domain: query.domain,
        limit: query.limit ? parseInt(query.limit as string) : undefined,
        offset: query.offset ? parseInt(query.offset as string) : undefined,
      };

      const orchestrations = await this.orchestrator.listOrchestrations(tenantId, filter);

      await reply.send({
        data: orchestrations.map((o) => ({
          id: o.id,
          name: o.name,
          status: o.status,
          stepCount: o.stepCount,
          completedSteps: o.completedSteps,
          domains: o.domains,
          createdBy: o.createdBy,
          createdAt: o.createdAt,
        })),
        total: orchestrations.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'ORCH_500',
        message: error.message || 'Failed to list orchestrations',
      });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const orchestration = await this.orchestrator.getOrchestrationStatus(id);
      if (!orchestration) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'ORCH_004',
          message: `Orchestration '${id}' not found`,
        });
        return;
      }

      await reply.send(orchestration);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'ORCH_004',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'ORCH_500',
        message: error.message || 'Failed to get orchestration',
      });
    }
  }

  async execute(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const orchestration = await this.orchestrator.executeOrchestration(id);

      await reply.send({
        id: orchestration.id,
        status: orchestration.status,
        completedSteps: orchestration.completedSteps,
        stepCount: orchestration.stepCount,
        error: orchestration.error,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'ORCH_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'ORCH_005',
        message: error.message || 'Failed to execute orchestration',
      });
    }
  }

  async pause(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const orchestration = await this.orchestrator.pauseOrchestration(id);

      await reply.send({
        id: orchestration.id,
        status: orchestration.status,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'ORCH_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'ORCH_005',
        message: error.message || 'Failed to pause orchestration',
      });
    }
  }

  async resume(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const orchestration = await this.orchestrator.resumeOrchestration(id);

      await reply.send({
        id: orchestration.id,
        status: orchestration.status,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'ORCH_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'ORCH_005',
        message: error.message || 'Failed to resume orchestration',
      });
    }
  }

  async abort(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const orchestration = await this.orchestrator.abortOrchestration(id);

      await reply.send({
        id: orchestration.id,
        status: orchestration.status,
        error: orchestration.error,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'ORCH_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'ORCH_005',
        message: error.message || 'Failed to abort orchestration',
      });
    }
  }
}
