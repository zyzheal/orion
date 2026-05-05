/**
 * DataPipelineController - 数据管道 API 控制器
 *
 * 处理数据管道创建、执行、调度、数据血缘
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';

interface DataPipeline {
  id: string;
  name: string;
  description: string;
  source: string;
  destination: string;
  transforms: string[];
  schedule?: string;
  status: 'active' | 'inactive' | 'running' | 'failed';
  createdAt: string;
}

interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  startedAt: string;
  completedAt?: string;
}

interface DataLineage {
  source: string;
  destination: string;
  transforms: Array<{ name: string; type: string }>;
  dependencies: string[];
}

export class DataPipelineController extends BaseController {
  private pipelines = new Map<string, DataPipeline>();
  private executions = new Map<string, PipelineExecution>();

  async createPipeline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as {
        name: string;
        description: string;
        source: string;
        destination: string;
        transforms: string[];
        schedule?: string;
      };
      const id = `dp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const pipeline: DataPipeline = {
        id,
        name: body.name,
        description: body.description,
        source: body.source,
        destination: body.destination,
        transforms: body.transforms,
        schedule: body.schedule,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      this.pipelines.set(id, pipeline);
      return pipeline;
    }, (pipeline) => this.sendCreated(reply, pipeline));
  }

  async listPipelines(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const query = request.query as { status?: string };
      let results = Array.from(this.pipelines.values());
      if (query.status) {
        results = results.filter((p) => p.status === query.status);
      }
      return results;
    }, (pipelines) => this.sendSuccess(reply, pipelines));
  }

  async executePipeline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const pipeline = this.pipelines.get(params.id);
      if (!pipeline) throw new Error(`Pipeline '${params.id}' not found`);
      const id = `exec-${Date.now()}`;
      const exec: PipelineExecution = {
        id,
        pipelineId: params.id,
        status: 'running',
        recordsProcessed: 0,
        startedAt: new Date().toISOString(),
      };
      this.executions.set(id, exec);
      pipeline.status = 'running';
      return exec;
    }, (exec) => this.sendSuccess(reply, exec));
  }

  async schedulePipeline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const body = request.body as { cron: string };
      const pipeline = this.pipelines.get(params.id);
      if (!pipeline) throw new Error(`Pipeline '${params.id}' not found`);
      pipeline.schedule = body.cron;
      return pipeline;
    }, (pipeline) => this.sendSuccess(reply, pipeline));
  }

  async getPipelineStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const pipeline = this.pipelines.get(params.id);
      if (!pipeline) throw new Error(`Pipeline '${params.id}' not found`);
      const recentExecs = Array.from(this.executions.values())
        .filter((e) => e.pipelineId === params.id)
        .slice(-5);
      return { pipeline, recentExecutions: recentExecs };
    }, (data) => this.sendSuccess(reply, data));
  }

  async getDataLineage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const pipeline = this.pipelines.get(params.id);
      if (!pipeline) throw new Error(`Pipeline '${params.id}' not found`);
      const lineage: DataLineage = {
        source: pipeline.source,
        destination: pipeline.destination,
        transforms: pipeline.transforms.map((t) => ({ name: t, type: 'transform' })),
        dependencies: [pipeline.source],
      };
      return lineage;
    }, (lineage) => this.sendSuccess(reply, lineage));
  }
}
