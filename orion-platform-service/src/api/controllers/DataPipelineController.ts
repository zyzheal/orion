/**
 * DataPipelineController - 数据管道 API 控制器
 *
 * 处理数据管道创建、执行、调度、数据血缘
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { OrionError, ErrorCode } from '../../errors';
import { DatabasePool } from '../../services/database';
import { DataPipelineService } from '../../services/data-pipeline/DataPipelineService';
import { DataPipelineInput } from '../../services/data-pipeline/types';

export class DataPipelineController extends BaseController {
  private service: DataPipelineService;

  constructor(db?: DatabasePool) {
    super();
    this.service = new DataPipelineService(db);
  }

  async createPipeline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as DataPipelineInput;
      const tenantId = this.getTenantId(request);
      return this.service.createPipeline(tenantId, body);
    }, (pipeline) => this.sendCreated(reply, pipeline));
  }

  async listPipelines(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.service.listPipelines(tenantId);
    }, (pipelines) => this.sendSuccess(reply, pipelines));
  }

  async executePipeline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const tenantId = this.getTenantId(request);
      return this.service.executePipeline(params.id, tenantId);
    }, (exec) => this.sendSuccess(reply, exec));
  }

  async getExecutions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      return this.service.getExecutions(params.id);
    }, (executions) => this.sendSuccess(reply, executions));
  }

  async getLineage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const lineage = this.service.getDataLineage(params.id);
      if (!lineage) throw new OrionError(`Pipeline not found`, ErrorCode.NOT_FOUND);
      return lineage;
    }, (data) => this.sendSuccess(reply, data));
  }

  async getSchedule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const pipeline = this.service.getPipeline(params.id);
      if (!pipeline) throw new OrionError(`Pipeline not found`, ErrorCode.NOT_FOUND);
      return { schedule: pipeline.schedule || null };
    }, (data) => this.sendSuccess(reply, data));
  }

  async setSchedule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const body = request.body as { cron: string };
      return this.service.schedulePipeline(params.id, body.cron);
    }, (pipeline) => this.sendSuccess(reply, pipeline));
  }

  async getLineageGraph(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { id: string };
      const lineage = this.service.getDataLineage(params.id);
      return lineage || { pipelineId: params.id, nodes: [], edges: [] };
    }, (data) => this.sendSuccess(reply, data));
  }

  async getAllExecutions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const tenantId = this.getTenantId(request);
      const pipelineList = await this.service.listPipelines(tenantId);
      return pipelineList.flatMap(p =>
        this.service.getExecutions(p.id).map(e => ({ ...e, pipelineId: p.id }))
      );
    }, (data) => this.sendSuccess(reply, data));
  }
}
