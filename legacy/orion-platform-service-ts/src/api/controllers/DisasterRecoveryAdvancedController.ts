/**
 * DisasterRecoveryAdvancedController - Phase 3
 *
 * 灾难恢复进阶功能 API：RTO/RPO 跟踪、演练调度、故障切换自动化
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { DisasterRecoveryService } from '../../services/disaster-recovery/DisasterRecoveryService';

export class DisasterRecoveryAdvancedController extends BaseController {
  private service: DisasterRecoveryService;

  constructor(service: DisasterRecoveryService) {
    super();
    this.service = service;
  }

  // ==================== RTO/RPO Tracking ====================

  /**
   * GET /v1/disaster-recovery/advanced/rto-status - 获取 RTO 状态
   */
  async getRTOStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.service.getRTOStatus(tenantId);
    });
  }

  /**
   * GET /v1/disaster-recovery/advanced/rpo-status - 获取 RPO 状态
   */
  async getRPOStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.service.getRPOStatus(tenantId);
    });
  }

  // ==================== DR Drill Scheduling ====================

  /**
   * POST /v1/disaster-recovery/advanced/drills - 创建演练计划
   */
  async scheduleDrill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ componentType: string; scheduledAt?: string; createdBy?: string }>(request);
      return this.service.scheduleDrill(tenantId, body);
    });
  }

  /**
   * GET /v1/disaster-recovery/advanced/drills - 获取演练列表
   */
  async listDrills(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.service.listDrills(tenantId);
    });
  }

  /**
   * POST /v1/disaster-recovery/advanced/drills/:drillId/execute - 执行演练
   */
  async executeDrill(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const params = this.getParams<{ drillId: string }>(request);
      return this.service.executeScheduledDrill(params.drillId);
    });
  }

  /**
   * GET /v1/disaster-recovery/advanced/drills/:drillId/report - 获取演练报告
   */
  async getDrillReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const params = this.getParams<{ drillId: string }>(request);
      const result = await this.service.getDrillReport(params.drillId);
      if (!result) {
        this.sendNotFound(reply, 'DrillReport', params.drillId);
        return;
      }
      return result;
    });
  }

  // ==================== Failover Test Automation ====================

  /**
   * POST /v1/disaster-recovery/advanced/failover-test/:componentType/automated - 自动故障切换测试
   */
  async runAutomatedFailoverTest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.executeAndSend(reply, async () => {
      const params = this.getParams<{ componentType: string }>(request);
      return this.service.runAutomatedFailoverTest(params.componentType);
    });
  }
}
