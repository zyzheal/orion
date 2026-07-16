/**
 * MultiCloudAdvancedController - Phase 4
 *
 * Multi-cloud hybrid cloud advanced features API: cross-zone DR, multi-cloud cost,
 * cloud network, cloud account management, resource inventory.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { MultiCloudAdvancedService } from '../../services/MultiCloudAdvancedService';
import { MultiCloudManagerService } from '../../services/MultiCloudManagerService';

export class MultiCloudAdvancedController {
  private service: MultiCloudAdvancedService;
  private managerService: MultiCloudManagerService;

  constructor(service: MultiCloudAdvancedService, managerService: MultiCloudManagerService) {
    this.service = service;
    this.managerService = managerService;
  }

  /**
   * POST /dr - Setup cross-zone disaster recovery
   */
  async setupCrossZoneDR(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as {
        name: string;
        primaryZone: string;
        secondaryZone: string;
        strategy?: string;
        rpo?: number;
        rto?: number;
      };
      const result = await this.service.setupCrossZoneDR(tenantId, {
        name: body.name,
        primaryZone: body.primaryZone,
        secondaryZone: body.secondaryZone,
        strategy: body.strategy,
        rpo: body.rpo,
        rto: body.rto,
      });
      reply.code(201).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * POST /dr/:drId/test - Test cross-zone disaster recovery
   */
  async testCrossZoneDR(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { drId: string };
      const result = await this.service.testCrossZoneDR(params.drId);
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * GET /cost - Calculate multi-cloud cost
   */
  async calculateMultiCloudCost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const query = request.query as { timeWindow?: string };
      const timeWindow = query.timeWindow || '30d';
      const result = await this.service.calculateMultiCloudCost(tenantId, timeWindow);
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * GET /cost/optimize - Optimize multi-cloud cost
   */
  async optimizeCloudCost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const result = await this.service.optimizeCloudCost(tenantId);
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * POST /networks - Setup cloud network
   */
  async setupCloudNetwork(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as {
        name: string;
        vpcId: string;
        subnets?: string[];
        securityGroups?: string[];
      };
      const result = await this.service.setupCloudNetwork(tenantId, {
        name: body.name,
        vpcId: body.vpcId,
        subnets: body.subnets,
        securityGroups: body.securityGroups,
      });
      reply.code(201).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  // ==================== Cloud Account Management ====================

  /**
   * POST /accounts - Add cloud account
   */
  async addCloudAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as {
        name: string;
        provider: string;
        region: string;
        credentials_ref: string;
        metadata?: Record<string, any>;
      };
      const result = await this.managerService.addCloudAccount(tenantId, body);
      reply.code(201).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * DELETE /accounts/:accountId - Remove cloud account
   */
  async removeCloudAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { accountId: string };
      const tenantId = this.getTenantId(request);
      const result = await this.managerService.removeCloudAccount(params.accountId, tenantId);
      reply.code(200).send({ removed: result });
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * GET /accounts - List cloud accounts
   */
  async listCloudAccounts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const result = await this.managerService.listCloudAccounts(tenantId);
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  // ==================== Resource Inventory ====================

  /**
   * GET /inventory - Query resource inventory
   */
  async getResourceInventory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const query = request.query as { accountId?: string };
      const result = await this.managerService.getResourceInventory(tenantId, query.accountId);
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  /**
   * GET /inventory/summary - Resource inventory summary
   */
  async getResourceInventorySummary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const result = await this.managerService.getResourceInventorySummary(tenantId);
      reply.code(200).send(result);
    } catch (error) {
      reply.code(500).send({ error: (error as Error).message });
    }
  }

  // ==================== Cloud Cost Comparison ====================

  /**
   * POST /cost/compare - Cross-cloud cost comparison
   */
  async compareCloudCosts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as {
        vm_count?: number;
        vm_type?: string;
        storage_gb?: number;
        bandwidth_gb_month?: number;
      };
      const result = await this.managerService.compareCloudCosts(tenantId, body);
      reply.code(200).send(result);
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
