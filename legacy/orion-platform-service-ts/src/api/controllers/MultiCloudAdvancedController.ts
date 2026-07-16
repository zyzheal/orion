/**
 * MultiCloudAdvancedController - Phase 4
 *
 * 多云混合云进阶功能 API：跨区容灾、多云成本、云网络、云账号管理、资源清单
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { MultiCloudAdvancedService } from '../../services/multi-cloud/MultiCloudAdvancedService';
import { MultiCloudManagerService } from '../../services/multi-cloud/MultiCloudManagerService';

export class MultiCloudAdvancedController extends BaseController {
  private service: MultiCloudAdvancedService;
  private managerService: MultiCloudManagerService;

  constructor(service: MultiCloudAdvancedService, managerService: MultiCloudManagerService) {
    super();
    this.service = service;
    this.managerService = managerService;
  }

  /**
   * POST /v1/multi-cloud-advanced/dr - 设置跨区容灾
   */
  async setupCrossZoneDR(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ name: string; primaryZone: string; secondaryZone: string; strategy?: string; rpo?: number; rto?: number }>(request);
      return this.service.setupCrossZoneDR(tenantId, {
        name: body.name,
        primaryZone: body.primaryZone,
        secondaryZone: body.secondaryZone,
        strategy: body.strategy,
        rpo: body.rpo,
        rto: body.rto,
      });
    });
  }

  /**
   * POST /v1/multi-cloud-advanced/dr/:drId/test - 测试跨区容灾
   */
  async testCrossZoneDR(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const params = this.getParams<{ drId: string }>(request);
      return this.service.testCrossZoneDR(params.drId);
    });
  }

  /**
   * GET /v1/multi-cloud-advanced/cost - 计算多云成本
   */
  async calculateMultiCloudCost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const query = this.getQuery<{ timeWindow?: string }>(request);
      const timeWindow = query.timeWindow || '30d';
      return this.service.calculateMultiCloudCost(tenantId, timeWindow);
    });
  }

  /**
   * GET /v1/multi-cloud-advanced/cost/optimize - 优化多云成本
   */
  async optimizeCloudCost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.service.optimizeCloudCost(tenantId);
    });
  }

  /**
   * POST /v1/multi-cloud-advanced/networks - 设置云网络
   */
  async setupCloudNetwork(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ name: string; vpcId: string; subnets?: string[]; securityGroups?: string[] }>(request);
      return this.service.setupCloudNetwork(tenantId, {
        name: body.name,
        vpcId: body.vpcId,
        subnets: body.subnets,
        securityGroups: body.securityGroups,
      });
    });
  }

  // ==================== Cloud Account Management ====================

  /**
   * POST /v1/multi-cloud-advanced/accounts - 添加云账号
   */
  async addCloudAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ name: string; provider: string; region: string; credentials_ref: string; metadata?: Record<string, any> }>(request);
      return this.managerService.addCloudAccount(tenantId, body);
    });
  }

  /**
   * DELETE /v1/multi-cloud-advanced/accounts/:accountId - 移除云账号
   */
  async removeCloudAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const params = this.getParams<{ accountId: string }>(request);
      const tenantId = this.getTenantId(request);
      return { removed: await this.managerService.removeCloudAccount(params.accountId, tenantId) };
    });
  }

  /**
   * GET /v1/multi-cloud-advanced/accounts - 获取云账号列表
   */
  async listCloudAccounts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.managerService.listCloudAccounts(tenantId);
    });
  }

  // ==================== Resource Inventory ====================

  /**
   * GET /v1/multi-cloud-advanced/inventory - 查询资源清单
   */
  async getResourceInventory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const query = this.getQuery<{ accountId?: string }>(request);
      return this.managerService.getResourceInventory(tenantId, query.accountId);
    });
  }

  /**
   * GET /v1/multi-cloud-advanced/inventory/summary - 资源清单汇总
   */
  async getResourceInventorySummary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.managerService.getResourceInventorySummary(tenantId);
    });
  }

  // ==================== Cloud Cost Comparison ====================

  /**
   * POST /v1/multi-cloud-advanced/cost/compare - 跨云成本对比
   */
  async compareCloudCosts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ vm_count?: number; vm_type?: string; storage_gb?: number; bandwidth_gb_month?: number }>(request);
      return this.managerService.compareCloudCosts(tenantId, body);
    });
  }
}
