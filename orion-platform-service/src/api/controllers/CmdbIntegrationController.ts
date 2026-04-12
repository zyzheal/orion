/**
 * CMDB 集成控制器 (Fastify 版本)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import {
  CmdbIntegrationService,
  ScriptExecutionRequest,
  K8sSyncConfig,
} from '../../services/cmdb-integration-service';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class CmdbIntegrationController {
  private service: CmdbIntegrationService;

  constructor(service: CmdbIntegrationService) {
    this.service = service;
  }

  // ==================== 主机 Read API ====================

  /**
   * GET /api/v1/cmdb/hosts - 获取主机列表
   */
  async listHosts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = BigInt(request.headers['x-tenant-id'] as string || '1');
      const query = request.query as any;
      const { status, tags, limit, offset } = query;

      const result = await this.service.listHosts({
        tenantId,
        status: status as string | undefined,
        tags: tags ? (tags as string).split(',') : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      await reply.send({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: result.data.length,
          offset: 0,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to list hosts');
      await reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/cmdb/hosts/:ciId - 获取主机详情
   */
  async getHost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { ciId } = params;

      const host = await this.service.getHost(ciId);

      if (!host) {
        await reply.status(404).send({
          success: false,
          error: 'NOT_FOUND',
          code: '30201',
          message: `Host ${ciId} not found`,
        });
        return;
      }

      await reply.send({
        success: true,
        data: host,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get host');
      await reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== K8s Read API ====================

  /**
   * GET /api/v1/cmdb/k8s - 获取 K8s 资源列表
   */
  async listK8sResources(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = BigInt(request.headers['x-tenant-id'] as string || '1');
      const query = request.query as any;
      const { kind, namespace, limit, offset } = query;

      const result = await this.service.listK8sResources({
        tenantId,
        kind: kind as string | undefined,
        namespace: namespace as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      await reply.send({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: result.data.length,
          offset: 0,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to list K8s resources');
      await reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== CI/CD Read API ====================

  /**
   * GET /api/v1/cmdb/cicd - 获取 CI/CD 资源列表
   */
  async listCICDResources(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = BigInt(request.headers['x-tenant-id'] as string || '1');
      const query = request.query as any;
      const { status, limit, offset } = query;

      const result = await this.service.listCICDResources({
        tenantId,
        status: status as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      await reply.send({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: result.data.length,
          offset: 0,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to list CI/CD resources');
      await reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== 拓扑 API ====================

  /**
   * GET /api/v1/cmdb/topology - 获取拓扑图
   */
  async getTopology(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = BigInt(request.headers['x-tenant-id'] as string || '1');
      const query = request.query as any;
      const { ciType, depth } = query;

      const topology = await this.service.getTopology({
        tenantId,
        ciType: ciType as any,
        depth: depth ? parseInt(depth as string, 10) : undefined,
      });

      await reply.send({
        success: true,
        data: topology,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get topology');
      await reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== K8s 同步 API ====================

  /**
   * POST /api/v1/cmdb/k8s/sync/start - 启动 K8s 同步
   */
  async startK8sSync(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = BigInt(request.headers['x-tenant-id'] as string || '1');
      const body = request.body as any || {};

      // 默认配置
      const defaultConfig: K8sSyncConfig = {
        apiServerUrl: body.apiServerUrl,
        token: body.token,
        caCert: body.caCert,
        watchEnabled: body.watchEnabled !== false,
        reconciliationIntervalMs: body.reconciliationIntervalMs || 300000, // 5 分钟
      };

      await this.service.startK8sSync(tenantId, defaultConfig);

      await reply.send({
        success: true,
        message: 'K8s sync started',
        config: {
          watchEnabled: defaultConfig.watchEnabled,
          reconciliationIntervalMs: defaultConfig.reconciliationIntervalMs,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to start K8s sync');
      await reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/cmdb/k8s/sync/stop - 停止 K8s 同步
   */
  async stopK8sSync(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      this.service.stopK8sSync();

      await reply.send({
        success: true,
        message: 'K8s sync stopped',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to stop K8s sync');
      await reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== 脚本执行 API ====================

  /**
   * POST /api/v1/cmdb/execute - 执行脚本
   */
  async executeScript(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};

      // 验证必填字段
      if (!body.targetCiIds || !body.script || !body.scriptType) {
        await reply.status(400).send({
          success: false,
          error: 'INVALID_REQUEST',
          code: '30101',
          message: 'Missing required fields: targetCiIds, script, scriptType',
        });
        return;
      }

      const results = await this.service.executeScript(body as ScriptExecutionRequest);

      await reply.send({
        success: true,
        data: results,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to execute script');
      await reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}