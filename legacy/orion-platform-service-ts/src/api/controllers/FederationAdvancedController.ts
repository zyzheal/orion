/**
 * FederationAdvancedController - Phase 4
 *
 * 联邦调度进阶功能 API：调度策略、跨集群调度、资源池管理、执行器管理
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { FederationAdvancedService } from '../../services/federation/FederationAdvancedService';
import { FederationService } from '../../services/federation/FederationService';

export class FederationAdvancedController extends BaseController {
  private service: FederationAdvancedService;
  private federationService: FederationService;

  constructor(service: FederationAdvancedService, federationService: FederationService) {
    super();
    this.service = service;
    this.federationService = federationService;
  }

  /**
   * POST /v1/federation-advanced/scheduling-policies - 创建调度策略
   */
  async createSchedulingPolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ name: string; description?: string; strategy?: string; rules?: Record<string, unknown> }>(request);
      return this.service.createSchedulingPolicy(tenantId, {
        name: body.name,
        description: body.description,
        strategy: body.strategy,
        rules: body.rules,
      });
    });
  }

  /**
   * GET /v1/federation-advanced/scheduling-policies - 获取调度策略列表
   */
  async listSchedulingPolicies(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.service.listSchedulingPolicies(tenantId);
    });
  }

  /**
   * POST /v1/federation-advanced/cross-cluster-jobs - 调度跨集群任务
   */
  async scheduleCrossClusterJob(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ name: string; targetClusters: string[]; resourceRequirements?: { cpu?: number; memory?: number } }>(request);
      return this.service.scheduleCrossClusterJob(tenantId, {
        name: body.name,
        targetClusters: body.targetClusters,
        resourceRequirements: body.resourceRequirements,
      });
    });
  }

  /**
   * POST /v1/federation-advanced/resource-pools - 创建资源池
   */
  async createResourcePool(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ name: string; description?: string; clusterId: string; cpu: number; memory: number }>(request);
      return this.service.createResourcePool(tenantId, {
        name: body.name,
        description: body.description,
        clusterId: body.clusterId,
        cpu: body.cpu,
        memory: body.memory,
      });
    });
  }

  /**
   * GET /v1/federation-advanced/resource-pools/:poolId - 获取资源池状态
   */
  async getResourcePoolStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const params = this.getParams<{ poolId: string }>(request);
      const result = await this.service.getResourcePoolStatus(params.poolId);
      if (!result) {
        this.sendNotFound(reply, 'ResourcePool', params.poolId);
        return;
      }
      return result;
    });
  }

  // ==================== Executor Management ====================

  /**
   * POST /v1/federation-advanced/executors - 注册执行器
   */
  async registerExecutor(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const body = this.getBody<{ cluster_id: string; name: string; region: string; cpu_capacity?: number; memory_capacity_mb?: number; max_concurrent_jobs?: number; labels?: Record<string, any> }>(request);
      return this.federationService.registerExecutor({
        cluster_id: body.cluster_id,
        name: body.name,
        region: body.region,
        cpu_capacity: body.cpu_capacity,
        memory_capacity_mb: body.memory_capacity_mb,
        max_concurrent_jobs: body.max_concurrent_jobs,
        labels: body.labels,
      });
    });
  }

  /**
   * GET /v1/federation-advanced/executors - 获取执行器列表
   */
  async listExecutors(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.federationService.listExecutors(tenantId);
    });
  }

  /**
   * GET /v1/federation-advanced/executors/:executorId/health - 获取执行器健康状态
   */
  async getExecutorHealth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const params = this.getParams<{ executorId: string }>(request);
      const result = await this.federationService.getExecutorHealth(params.executorId);
      if (!result) {
        this.sendNotFound(reply, 'ExecutorHealth', params.executorId);
        return;
      }
      return result;
    });
  }

  /**
   * GET /v1/federation-advanced/executors/dashboard - 获取执行器健康仪表盘
   */
  async getExecutorDashboard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.federationService.getExecutorDashboard(tenantId);
    });
  }

  /**
   * POST /v1/federation-advanced/executors/:executorId/heartbeat - 执行器心跳
   */
  async executorHeartbeat(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const params = this.getParams<{ executorId: string }>(request);
      const body = this.getBody<{ cpu_used?: number; memory_used_mb?: number; running_jobs?: number; response_time_ms?: number }>(request);
      return this.federationService.executorHeartbeat(params.executorId, body);
    });
  }

  /**
   * DELETE /v1/federation-advanced/executors/:executorId - 注销执行器
   */
  async deregisterExecutor(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const params = this.getParams<{ executorId: string }>(request);
      return { deregistered: await this.federationService.deregisterExecutor(params.executorId) };
    });
  }

  /**
   * POST /v1/federation-advanced/dispatch-job - 调度任务（带负载均衡）
   */
  async dispatchJob(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{
        name: string;
        description?: string;
        job_type?: string;
        source_cluster_id: string;
        target_cluster_ids: string[];
        priority?: string;
        spec?: Record<string, any>;
        executor_id?: string;
        resource_requirements?: { cpu?: number; memory_mb?: number };
      }>(request);
      return this.federationService.dispatchJob(tenantId, body);
    });
  }
}
