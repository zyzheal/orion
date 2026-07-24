/**
 * ModelVersionController - Stub
 * Handles model version management API requests.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ModelVersionService, type ModelRegistrationInput } from '../../services/ModelVersionService';

export class ModelVersionController {
  private service: ModelVersionService;

  constructor(service: ModelVersionService) {
    this.service = service;
  }

  async registerModel(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const body = request.body as ModelRegistrationInput;
    const model = await this.service.registerModel(body);
    return reply.send(model);
  }

  async listModels(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const query = request.query as { status?: string; framework?: string; name?: string };
    const models = await this.service.listModels({
      status: query.status as any,
      framework: query.framework as any,
      name: query.name,
    });
    return reply.send(models);
  }

  async getModelById(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const params = request.params as { modelId: string };
    const model = await this.service.getModelById(params.modelId);
    if (!model) return reply.code(404).send({ error: 'Model not found' });
    return reply.send(model);
  }

  async getModelVersions(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const params = request.params as { modelName: string };
    const query = request.query as { include_deprecated?: string };
    const versions = await this.service.getModelVersions(params.modelName, query.include_deprecated === 'true');
    return reply.send(versions);
  }

  async activateModel(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const params = request.params as { modelId: string };
    const model = await this.service.activateModel(params.modelId);
    return reply.send(model);
  }

  async deprecateModel(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const params = request.params as { modelId: string };
    const model = await this.service.deprecateModel(params.modelId);
    return reply.send(model);
  }

  async getABTestResults(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const params = request.params as { modelName: string };
    const results = await this.service.getABTestResults(params.modelName);
    if (!results) return reply.code(404).send({ error: 'AB test not found' });
    return reply.send(results);
  }

  async getModelPerformance(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const params = request.params as { modelName: string };
    const perf = await this.service.getModelPerformanceOverview(params.modelName);
    return reply.send(perf);
  }

  async rollbackModel(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    const params = request.params as { modelId: string };
    const body = request.body as { targetVersion?: string };
    const model = await this.service.rollbackModel(params.modelId, body?.targetVersion);
    return reply.send(model);
  }
}
