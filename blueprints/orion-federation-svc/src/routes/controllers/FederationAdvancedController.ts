/**
 * FederationAdvancedController - Phase 4
 *
 * Federation scheduling advanced features API: scheduling policies,
 * cross-cluster scheduling, resource pool management, executor management.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { FederationAdvancedService } from '../../services/FederationAdvancedService';
import { FederationService } from '../../services/FederationService';

export class FederationAdvancedController {
  private service: FederationAdvancedService;
  private federationService: FederationService;

  constructor(service: FederationAdvancedService, federationService: FederationService) {
    this.service = service;
    this.federationService = federationService;
  }

  /**
   * POST /scheduling-policies - Create scheduling policy
   */
  async createSchedulingPolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as {
        name: string;
        description?: string;
        strategy?: string;
        rules?: Record<string, unknown>;
      };
      const result = await this.service.createSchedulingPolicy(tenantId, {
        name: body.name,
        description: body.description,
        strategy: body.strategy,
        rules: body.rules,
      });
      reply.code(201).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * GET /scheduling-policies - List scheduling policies
   */
  async listSchedulingPolicies(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const result = await this.service.listSchedulingPolicies(tenantId);
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * POST /cross-cluster-jobs - Schedule cross-cluster job
   */
  async scheduleCrossClusterJob(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as {
        name: string;
        targetClusters: string[];
        resourceRequirements?: { cpu?: number; memory?: number };
      };
      const result = await this.service.scheduleCrossClusterJob(tenantId, {
        name: body.name,
        targetClusters: body.targetClusters,
        resourceRequirements: body.resourceRequirements,
      });
      reply.code(201).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * POST /resource-pools - Create resource pool
   */
  async createResourcePool(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as {
        name: string;
        description?: string;
        clusterId: string;
        cpu: number;
        memory: number;
      };
      const result = await this.service.createResourcePool(tenantId, {
        name: body.name,
        description: body.description,
        clusterId: body.clusterId,
        cpu: body.cpu,
        memory: body.memory,
      });
      reply.code(201).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * GET /resource-pools/:poolId - Get resource pool status
   */
  async getResourcePoolStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { poolId: string };
      const result = await this.service.getResourcePoolStatus(params.poolId);
      if (!result) {
        reply.code(404).send({ error: `ResourcePool '${params.poolId}' not found` });
        return;
      }
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  // ==================== Executor Management ====================

  /**
   * POST /executors - Register executor
   */
  async registerExecutor(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as {
        cluster_id: string;
        name: string;
        region: string;
        cpu_capacity?: number;
        memory_capacity_mb?: number;
        max_concurrent_jobs?: number;
        labels?: Record<string, any>;
      };
      const result = await this.federationService.registerExecutor({
        cluster_id: body.cluster_id,
        name: body.name,
        region: body.region,
        cpu_capacity: body.cpu_capacity,
        memory_capacity_mb: body.memory_capacity_mb,
        max_concurrent_jobs: body.max_concurrent_jobs,
        labels: body.labels,
      });
      reply.code(201).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * GET /executors - List executors
   */
  async listExecutors(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const result = await this.federationService.listExecutors(tenantId);
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * GET /executors/:executorId/health - Get executor health
   */
  async getExecutorHealth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { executorId: string };
      const result = await this.federationService.getExecutorHealth(params.executorId);
      if (!result) {
        reply.code(404).send({ error: `ExecutorHealth '${params.executorId}' not found` });
        return;
      }
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * GET /executors/dashboard - Get executor health dashboard
   */
  async getExecutorDashboard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const result = await this.federationService.getExecutorDashboard(tenantId);
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * POST /executors/:executorId/heartbeat - Executor heartbeat
   */
  async executorHeartbeat(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { executorId: string };
      const body = request.body as {
        cpu_used?: number;
        memory_used_mb?: number;
        running_jobs?: number;
        response_time_ms?: number;
      };
      const result = await this.federationService.executorHeartbeat(params.executorId, body);
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * DELETE /executors/:executorId - Deregister executor
   */
  async deregisterExecutor(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { executorId: string };
      const result = await this.federationService.deregisterExecutor(params.executorId);
      reply.code(200).send({ deregistered: result });
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * POST /dispatch-job - Dispatch job with load balancing
   */
  async dispatchJob(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as {
        name: string;
        description?: string;
        job_type?: string;
        source_cluster_id: string;
        target_cluster_ids: string[];
        priority?: string;
        spec?: Record<string, any>;
        executor_id?: string;
        resource_requirements?: { cpu?: number; memory_mb?: number };
      };
      const result = await this.federationService.dispatchJob(tenantId, body);
      reply.code(201).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * Extract tenant ID from request headers or query.
   */
  private getTenantId(request: FastifyRequest): string {
    const headers = request.headers as Record<string, string>;
    return headers['x-tenant-id'] || (request.query as Record<string, string>)?.tenantId || 'default';
  }
}
