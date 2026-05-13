import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { PipelineService } from '../services/PipelineService';
import { PipelineRepository, CreatePipelineInput } from '../services/PipelineRepository';
import { PipelineEngine } from '../services/PipelineEngine';
import { VisualPipelineService } from '../services/VisualPipelineService';
import type { VisualPipelineCreateInput, VisualPipelineUpdateInput } from '../models/VisualPipeline';

export async function pipelineRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { database: any; pipelineEngine?: PipelineEngine }
): Promise<void> {
  const repo = new PipelineRepository(opts.database);
  const pipelineService = new PipelineService(repo);
  const visualPipelineService = new VisualPipelineService(opts.database);
  const engine = opts.pipelineEngine;

  fastify.post('/pipelines', async (request, reply) => {
    const pipeline = await pipelineService.create(request.body as CreatePipelineInput);
    return reply.code(201).send(pipeline);
  });

  fastify.get('/pipelines', async (request) => {
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    return pipelineService.list(tenantId, query.projectId);
  });

  fastify.get('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pipeline = await pipelineService.getById(id);
    if (!pipeline) return reply.code(404).send({ error: 'Pipeline not found' });
    return pipeline;
  });

  fastify.put('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pipeline = await pipelineService.update(id, request.body as Partial<CreatePipelineInput>);
    if (!pipeline) return reply.code(404).send({ error: 'Pipeline not found' });
    return pipeline;
  });

  fastify.delete('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await pipelineService.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Pipeline not found' });
    return reply.code(204).send();
  });

  fastify.post('/pipelines/:id/run', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await pipelineService.triggerRun(id, request.body as { trigger_type?: string; trigger_by?: string });
    if (!run) return reply.code(404).send({ error: 'Pipeline not found' });
    return reply.code(201).send(run);
  });

  fastify.get('/pipelines/:id/runs', async (request) => {
    const { id } = request.params as { id: string };
    return pipelineService.listRuns(id);
  });

  fastify.get('/pipelines/:id/runs/:rid', async (request, reply) => {
    const { rid } = request.params as { id: string; rid: string };
    const run = await pipelineService.getRun(rid);
    if (!run) return reply.code(404).send({ error: 'Run not found' });
    return run;
  });

  fastify.post('/pipelines/:id/runs/:rid/cancel', async (request, reply) => {
    const { rid } = request.params as { id: string; rid: string };
    const result = await pipelineService.cancelRun(rid);
    if (!result) return reply.code(404).send({ error: 'Run not found' });
    return result;
  });

  // 运行 YAML pipeline（无需保存，直接运行 YAML 定义）
  fastify.post('/pipelines/run-yaml', async (request, reply) => {
    const body = request.body as {
      name?: string;
      yamlDefinition: string;
      envOverrides?: Record<string, string>;
      inputs?: Record<string, unknown>;
    };

    if (!body.yamlDefinition) {
      return reply.code(400).send({ error: 'yamlDefinition is required' });
    }

    // 从 YAML 解析 stages
    const { YamlPreprocessor } = await import('../engine/YamlPreprocessor');
    const preprocessor = new YamlPreprocessor();
    const executionModel = preprocessor.parse(body.yamlDefinition, {
      inputs: body.inputs || {},
      env: body.envOverrides || {},
      params: body.envOverrides || {},
    });

    // 构建 Pipeline 对象
    const pipeline = {
      id: body.name || `yaml-pipeline-${Date.now()}`,
      tenantId: 'default',
      projectId: 'default',
      name: body.name || 'YAML Pipeline',
      status: 'active' as const,
      stages: executionModel.stages.map(s => ({
        id: s.stageId,
        name: s.stageName,
        type: 'build',
        command: '', // 不使用传统 command 模式
        dependsOn: [],
        env: s.env,
        timeoutMs: s.timeoutMs,
        continueOnError: s.continueOnError,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
    };

    // 使用 engine 执行
    if (!engine) {
      return reply.code(500).send({ error: 'Pipeline engine not available' });
    }

    const run = await engine.runPipeline(pipeline, 'manual', {
      yamlDefinition: body.yamlDefinition,
      inputs: body.inputs,
      envOverrides: body.envOverrides,
    });

    return reply.code(201).send(run);
  });

  // ==================== Visual Pipeline Editor Routes ====================

  // List visual pipelines
  fastify.get('/pipelines/:pipelineId/layouts', async (request) => {
    const { pipelineId } = request.params as { pipelineId: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    return visualPipelineService.getByPipelineId(tenantId, pipelineId);
  });

  // Get visual pipeline by ID
  fastify.get('/pipelines/layouts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const layout = await visualPipelineService.getById(tenantId, id);
    if (!layout) return reply.code(404).send({ error: 'Layout not found' });
    return layout;
  });

  // Create visual pipeline layout
  fastify.post('/pipelines/:pipelineId/layouts', async (request, reply) => {
    const { pipelineId } = request.params as { pipelineId: string };
    const body = request.body as VisualPipelineCreateInput;
    const layout = await visualPipelineService.create({
      ...body,
      pipelineId,
      tenantId: body.tenantId || 'default',
    });
    return reply.code(201).send(layout);
  });

  // Save layout (upsert - create or update)
  fastify.put('/pipelines/:pipelineId/layouts', async (request, reply) => {
    const { pipelineId } = request.params as { pipelineId: string };
    const body = request.body as {
      name: string;
      layout: VisualPipelineCreateInput['layout'];
      yamlDefinition: string;
      tenantId?: string;
      createdBy?: string;
    };
    const layout = await visualPipelineService.saveLayout(
      body.tenantId || 'default',
      pipelineId,
      body.name,
      body.layout,
      body.yamlDefinition,
      body.createdBy
    );
    return reply.code(200).send(layout);
  });

  // Update visual pipeline layout
  fastify.put('/pipelines/layouts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const body = request.body as VisualPipelineUpdateInput;
    const layout = await visualPipelineService.update(tenantId, id, body);
    if (!layout) return reply.code(404).send({ error: 'Layout not found' });
    return layout;
  });

  // Delete visual pipeline layout
  fastify.delete('/pipelines/layouts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const deleted = await visualPipelineService.delete(tenantId, id);
    if (!deleted) return reply.code(404).send({ error: 'Layout not found' });
    return reply.code(204).send();
  });
}
