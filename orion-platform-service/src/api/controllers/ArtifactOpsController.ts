/**
 * ArtifactOpsController - 制品运维 API 控制器
 *
 * 处理制品操作追踪、历史记录、统计、清理、扫描、保留策略
 * Uses PostgreSQL-backed services via constructor injection.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { ArtifactOperationService, ArtifactOperationInput } from '../../services/artifact-ops/ArtifactOperationService';
import { ArtifactScanService } from '../../services/artifact-ops/ArtifactScanService';
import { ArtifactRetentionService, RetentionPolicyInput, ArtifactEntry } from '../../services/artifact-ops/ArtifactRetentionService';

export interface ArtifactOpsServices {
  operationService: ArtifactOperationService;
  scanService: ArtifactScanService;
  retentionService: ArtifactRetentionService;
}

export class ArtifactOpsController extends BaseController {
  private operationService: ArtifactOperationService;
  private scanService: ArtifactScanService;
  private retentionService: ArtifactRetentionService;

  constructor(services: ArtifactOpsServices) {
    super();
    this.operationService = services.operationService;
    this.scanService = services.scanService;
    this.retentionService = services.retentionService;
  }

  async trackOperation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as {
        tenantId: string;
        artifactId: string;
        operation: string;
        source?: string;
        target?: string;
        metadata?: Record<string, unknown>;
        initiatedBy?: string;
      };

      const input: ArtifactOperationInput = {
        artifactId: body.artifactId,
        operation: body.operation as ArtifactOperationInput['operation'],
        source: body.source,
        target: body.target,
        metadata: body.metadata,
        initiatedBy: body.initiatedBy,
      };

      const tenantId = body.tenantId || 'default';
      return this.operationService.trackOperation(tenantId, input);
    }, (record) => this.sendCreated(reply, record));
  }

  async getOperationHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { artifactId: string };
      const query = request.query as { tenantId?: string };
      const tenantId = query.tenantId || 'default';

      const history = await this.operationService.getOperationHistory(tenantId, {
        artifactId: params.artifactId,
      });

      return { artifactId: params.artifactId, operations: history, total: history.length };
    }, (data) => this.sendSuccess(reply, data));
  }

  async getArtifactStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { tenantId?: string };
      const tenantId = params.tenantId || 'default';
      return this.operationService.getArtifactStats(tenantId);
    }, (stats) => this.sendSuccess(reply, stats));
  }

  async defineRetentionPolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as {
        tenantId: string;
        name: string;
        maxAgeDays: number;
        maxVersions?: number;
        maxSizeMB?: number;
        protectedTags?: string[];
        schedule?: string;
      };

      const input: RetentionPolicyInput = {
        name: body.name,
        maxAgeDays: body.maxAgeDays,
        maxVersions: body.maxVersions,
        maxSizeMB: body.maxSizeMB,
        protectedTags: body.protectedTags,
        schedule: body.schedule,
      };

      const tenantId = body.tenantId || 'default';
      return this.retentionService.defineRetentionPolicy(tenantId, input);
    }, (policy) => this.sendCreated(reply, policy));
  }

  async cleanup(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as { tenantId?: string; artifactId?: string };
      const tenantId = body.tenantId || 'default';

      let cleaned = 0;
      if (body.artifactId) {
        // Delete operations for specific artifact
        const history = await this.operationService.getOperationHistory(tenantId, {
          artifactId: body.artifactId,
        });
        cleaned = history.length;
      } else {
        cleaned = await this.operationService.deleteTenantOperations(tenantId);
      }

      return { cleaned, tenantId, timestamp: new Date().toISOString() };
    }, (result) => this.sendSuccess(reply, result));
  }

  async scanArtifact(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { artifactId: string };
      const query = request.query as { tenantId?: string };
      const tenantId = query.tenantId || 'default';

      return this.scanService.scanArtifact(tenantId, params.artifactId);
    }, (result) => this.sendSuccess(reply, result));
  }

  async getScanReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { scanId: string };
      const report = await this.scanService.getScanReport(params.scanId);
      if (!report) {
        throw new Error(`Scan report '${params.scanId}' not found`);
      }
      return report;
    }, (report) => this.sendSuccess(reply, report));
  }

  async getArtifactScanReports(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { artifactId: string };
      return this.scanService.getArtifactReports(params.artifactId);
    }, (reports) => this.sendSuccess(reply, reports));
  }

  async detectMalicious(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as { artifactId: string; tenantId?: string };
      const tenantId = body.tenantId || 'default';
      return this.scanService.detectMaliciousArtifact(tenantId, body.artifactId);
    }, (detection) => this.sendSuccess(reply, detection));
  }

  async evaluateRetention(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as {
        tenantId: string;
        artifacts: ArtifactEntry[];
      };
      const tenantId = body.tenantId || 'default';
      return this.retentionService.evaluateRetention(tenantId, body.artifacts);
    }, (evaluations) => this.sendSuccess(reply, evaluations));
  }

  async getRetentionReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const query = request.query as { tenantId?: string };
      const params = request.params as { artifacts?: string };
      const tenantId = query.tenantId || 'default';

      // Parse artifacts from query params or body
      const artifacts: ArtifactEntry[] = (request.body as any)?.artifacts || [];
      return this.retentionService.getRetentionReport(tenantId, artifacts);
    }, (report) => this.sendSuccess(reply, report));
  }

  async listPolicies(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const query = request.query as { tenantId?: string; enabledOnly?: string };
      const tenantId = query.tenantId || 'default';
      const enabledOnly = query.enabledOnly === 'true';
      return this.retentionService.listPolicies(tenantId, enabledOnly || undefined);
    }, (policies) => this.sendSuccess(reply, policies));
  }

  async deletePolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { policyId: string };
      const deleted = await this.retentionService.deletePolicy(params.policyId);
      if (!deleted) {
        throw new Error(`Policy '${params.policyId}' not found`);
      }
      return { deleted: true, policyId: params.policyId };
    }, (result) => this.sendSuccess(reply, result));
  }
}
