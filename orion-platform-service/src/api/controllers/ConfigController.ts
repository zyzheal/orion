/**
 * Config Management Controller - Fastify API Controller
 *
 * Handles HTTP requests for configuration management, GitOps sync,
 * approval workflows, and config diff operations.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '../../services/config-mgmt/ConfigService';
import { GitOpsService } from '../../services/config-mgmt/GitOpsService';
import { ConfigApprovalService } from '../../services/config-mgmt/ConfigApprovalService';
import { ConfigDiffService } from '../../services/config-mgmt/ConfigDiffService';

export class ConfigController {
  private configService: ConfigService;
  private gitOpsService: GitOpsService;
  private approvalService: ConfigApprovalService;
  private diffService: ConfigDiffService;

  constructor(
    configService: ConfigService,
    gitOpsService: GitOpsService,
    approvalService: ConfigApprovalService,
    diffService: ConfigDiffService
  ) {
    this.configService = configService;
    this.gitOpsService = gitOpsService;
    this.approvalService = approvalService;
    this.diffService = diffService;
  }

  // ==================== Config CRUD ====================

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const { key, value, environment, description, encrypted, tags, createdBy } =
        body;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';

      if (!key || !value || !environment || !createdBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'CONFIG_001',
          message:
            'Missing required fields: key, value, environment, createdBy',
        });
        return;
      }

      if (!['dev', 'staging', 'prod'].includes(environment)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'CONFIG_002',
          message: 'Invalid environment. Must be one of: dev, staging, prod',
        });
        return;
      }

      const config = await this.configService.createConfig(tenantId, {
        key,
        value,
        environment,
        description,
        encrypted,
        tags,
        createdBy,
      });

      await reply.status(201).send({
        id: config.id,
        key: config.key,
        environment: config.environment,
        version: config.version,
        status: config.status,
        createdAt: config.createdAt,
      });
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        await reply.status(409).send({
          error: 'CONFLICT',
          code: 'CONFIG_003',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_500',
        message: error.message || 'Failed to create config',
      });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const { configId } = params;
      const { value, description, status, tags, updatedBy } = body;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';

      if (!value || !updatedBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'CONFIG_001',
          message: 'Missing required fields: value, updatedBy',
        });
        return;
      }

      const config = await this.configService.updateConfig(tenantId, configId, {
        value,
        description,
        status,
        tags,
        updatedBy,
      });

      await reply.send({
        id: config.id,
        key: config.key,
        value: config.value,
        version: config.version,
        status: config.status,
        updatedAt: config.updatedAt,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_004',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_500',
        message: error.message || 'Failed to update config',
      });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { configId } = params;

      const config = await this.configService.getConfigById(configId);
      if (!config) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_004',
          message: `Config '${configId}' not found`,
        });
        return;
      }

      await reply.send({
        id: config.id,
        key: config.key,
        value: config.value,
        environment: config.environment,
        version: config.version,
        status: config.status,
        description: config.description,
        encrypted: config.encrypted,
        tags: config.tags,
        createdBy: config.createdBy,
        createdAt: config.createdAt,
        updatedBy: config.updatedBy,
        updatedAt: config.updatedAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_500',
        message: error.message || 'Failed to get config',
      });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const { environment, status, keyPrefix, tags, limit, offset } = query;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';

      const configs = await this.configService.list(tenantId, {
        environment: environment as any,
        status: status as any,
        keyPrefix,
        tags: tags ? (tags as string).split(',') : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      await reply.send({
        data: configs.map((c) => ({
          id: c.id,
          key: c.key,
          environment: c.environment,
          version: c.version,
          status: c.status,
          description: c.description,
          createdAt: c.createdAt,
        })),
        total: configs.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_500',
        message: error.message || 'Failed to list configs',
      });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const query = request.query as any;
      const { configId } = params;
      const deletedBy = (query as any)?.deletedBy || 'system';

      await this.configService.deleteConfig(configId, deletedBy);
      await reply.status(204).send();
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_004',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_500',
        message: error.message || 'Failed to delete config',
      });
    }
  }

  async getVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { configId } = params;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';

      const config = await this.configService.getConfigById(configId);
      const versions = await this.configService.getConfigVersions(tenantId, config?.key || configId);

      await reply.send({
        data: versions.map((v) => ({
          id: v.id,
          configId: v.configId,
          key: v.key,
          value: v.value,
          version: v.version,
          changeLog: v.changeLog,
          createdBy: v.createdBy,
          createdAt: v.createdAt,
        })),
        total: versions.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_500',
        message: error.message || 'Failed to get versions',
      });
    }
  }

  async rollback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const { configId } = params;
      const { targetVersion, rolledBackBy } = body;

      if (!targetVersion || !rolledBackBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'CONFIG_001',
          message: 'Missing required fields: targetVersion, rolledBackBy',
        });
        return;
      }

      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';

      const config = await this.configService.rollbackConfig(
        tenantId,
        configId,
        targetVersion
      );

      if (!config) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_006',
          message: `Config '${configId}' not found or rollback failed`,
        });
        return;
      }

      await reply.send({
        id: config.id,
        key: config.key,
        value: config.value,
        version: config.version,
        rolledBackTo: targetVersion,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'CONFIG_005',
        message: error.message || 'Failed to rollback config',
      });
    }
  }

  async clone(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const { configId } = params;
      const { targetEnvironment, createdBy } = body;

      if (!targetEnvironment || !createdBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'CONFIG_001',
          message: 'Missing required fields: targetEnvironment, createdBy',
        });
        return;
      }

      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';

      const config = await this.configService.cloneConfig(
        tenantId,
        configId,
        targetEnvironment
      );

      if (!config) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_007',
          message: `Source config '${configId}' not found`,
        });
        return;
      }

      await reply.status(201).send({
        id: config.id,
        key: config.key,
        environment: config.environment,
        version: config.version,
        clonedFrom: configId,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_004',
          message: error.message,
        });
        return;
      }
      if (error.message?.includes('already exists')) {
        await reply.status(409).send({
          error: 'CONFLICT',
          code: 'CONFIG_003',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_500',
        message: error.message || 'Failed to clone config',
      });
    }
  }

  // ==================== GitOps ====================

  async enableGitOps(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const { repoUrl, branch, configPath, syncInterval, syncDirection, autoApply, createdBy } =
        body;

      if (!repoUrl || !branch || !createdBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'GITOPS_001',
          message: 'Missing required fields: repoUrl, branch, createdBy',
        });
        return;
      }

      const gitOpsConfig = await this.gitOpsService.enableGitOps({
        repoUrl,
        branch,
        configPath,
        syncInterval,
        syncDirection,
        autoApply,
        createdBy,
      });

      await reply.status(201).send({
        id: gitOpsConfig.id,
        repoUrl: gitOpsConfig.repoUrl,
        branch: gitOpsConfig.branch,
        syncInterval: gitOpsConfig.syncInterval,
        status: gitOpsConfig.status,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'GITOPS_500',
        message: error.message || 'Failed to enable GitOps',
      });
    }
  }

  async disableGitOps(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { gitOpsConfigId } = params;

      const gitOpsConfig = await this.gitOpsService.disableGitOps(gitOpsConfigId);

      await reply.send({
        id: gitOpsConfig.id,
        status: gitOpsConfig.status,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'GITOPS_004',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'GITOPS_500',
        message: error.message || 'Failed to disable GitOps',
      });
    }
  }

  async syncFromGit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { gitOpsConfigId } = params || {};

      const syncStatus = await this.gitOpsService.syncFromGit(gitOpsConfigId);

      await reply.send({
        id: syncStatus.id,
        status: syncStatus.status,
        itemsSynced: syncStatus.itemsSynced,
        itemsFailed: syncStatus.itemsFailed,
        driftDetected: syncStatus.driftDetected,
        startedAt: syncStatus.startedAt,
        completedAt: syncStatus.completedAt,
        error: syncStatus.error,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'GITOPS_500',
        message: error.message || 'Failed to sync from Git',
      });
    }
  }

  async detectDrift(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const { gitOpsConfigId } = query;

      const driftItems = await this.gitOpsService.detectDrift(gitOpsConfigId);

      await reply.send({
        driftDetected: driftItems.length > 0,
        itemCount: driftItems.length,
        items: driftItems,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'GITOPS_500',
        message: error.message || 'Failed to detect drift',
      });
    }
  }

  async getSyncStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const { gitOpsConfigId, limit } = query;

      const statuses = await this.gitOpsService.getSyncStatus({
        gitOpsConfigId,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      await reply.send({
        data: statuses,
        total: statuses.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'GITOPS_500',
        message: error.message || 'Failed to get sync status',
      });
    }
  }

  async listGitOpsConfigs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const configs = await this.gitOpsService.listGitOpsConfigs();

      await reply.send({
        data: configs.map((c) => ({
          id: c.id,
          repoUrl: c.repoUrl,
          branch: c.branch,
          status: c.status,
          lastSync: c.lastSync,
          syncInterval: c.syncInterval,
        })),
        total: configs.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'GITOPS_500',
        message: error.message || 'Failed to list GitOps configs',
      });
    }
  }

  // ==================== Approval Workflow ====================

  async createChangeRequest(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const body = request.body as any;
      const { configId, newValue, reason, requester, requiredApprovals } = body;

      if (!configId || !newValue || !reason || !requester) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'APPROVAL_001',
          message:
            'Missing required fields: configId, newValue, reason, requester',
        });
        return;
      }

      const changeRequest = await this.approvalService.createChangeRequest({
        configId,
        newValue,
        reason,
        requester,
        requiredApprovals,
      });

      await reply.status(201).send({
        id: changeRequest.id,
        configId: changeRequest.configId,
        configKey: changeRequest.configKey,
        environment: changeRequest.environment,
        status: changeRequest.status,
        requiredApprovals: changeRequest.requiredApprovals,
        createdAt: changeRequest.createdAt,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'APPROVAL_004',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'APPROVAL_500',
        message: error.message || 'Failed to create change request',
      });
    }
  }

  async approveChange(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const { changeRequestId } = params;
      const { approver, comment } = body;

      if (!approver) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'APPROVAL_001',
          message: 'Missing required field: approver',
        });
        return;
      }

      const changeRequest = await this.approvalService.approveChange(
        changeRequestId,
        { approver, comment }
      );

      await reply.send({
        id: changeRequest.id,
        status: changeRequest.status,
        approvals: changeRequest.approvals,
        appliedAt: changeRequest.appliedAt,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'APPROVAL_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'APPROVAL_005',
        message: error.message || 'Failed to approve change',
      });
    }
  }

  async rejectChange(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const { changeRequestId } = params;
      const { approver, comment } = body;

      if (!approver) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'APPROVAL_001',
          message: 'Missing required field: approver',
        });
        return;
      }

      const changeRequest = await this.approvalService.rejectChange(
        changeRequestId,
        { approver, comment }
      );

      await reply.send({
        id: changeRequest.id,
        status: changeRequest.status,
        approvals: changeRequest.approvals,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'APPROVAL_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'APPROVAL_005',
        message: error.message || 'Failed to reject change',
      });
    }
  }

  async getChangeRequest(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { changeRequestId } = params;

      const changeRequest = await this.approvalService.getChangeRequest(
        changeRequestId
      );
      if (!changeRequest) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'APPROVAL_004',
          message: `Change request '${changeRequestId}' not found`,
        });
        return;
      }

      await reply.send(changeRequest);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'APPROVAL_500',
        message: error.message || 'Failed to get change request',
      });
    }
  }

  async listChangeRequests(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const query = request.query as any;
      const { status, configId, requester, environment } = query;

      const changeRequests = await this.approvalService.listChangeRequests({
        status,
        configId,
        requester,
        environment,
      });

      await reply.send({
        data: changeRequests.map((cr) => ({
          id: cr.id,
          configKey: cr.configKey,
          environment: cr.environment,
          status: cr.status,
          requester: cr.requester,
          approvals: cr.approvals.length,
          requiredApprovals: cr.requiredApprovals,
          createdAt: cr.createdAt,
        })),
        total: changeRequests.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'APPROVAL_500',
        message: error.message || 'Failed to list change requests',
      });
    }
  }

  async getAuditTrail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { configId } = params;

      const auditTrail = await this.approvalService.getAuditTrail(configId);

      await reply.send({
        data: auditTrail,
        total: auditTrail.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'APPROVAL_500',
        message: error.message || 'Failed to get audit trail',
      });
    }
  }

  // ==================== Diff & Comparison ====================

  async compareEnvironments(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { sourceEnv, targetEnv } = params;

      const report = await this.diffService.compareEnvironments(
        sourceEnv,
        targetEnv
      );

      await reply.send(report);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DIFF_500',
        message: error.message || 'Failed to compare environments',
      });
    }
  }

  async compareVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { configId } = params;
      const query = request.query as any;
      const fromVersion = parseInt(query.fromVersion);
      const toVersion = parseInt(query.toVersion);

      if (!fromVersion || !toVersion) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'DIFF_001',
          message: 'Missing required query params: fromVersion, toVersion',
        });
        return;
      }

      const diff = await this.diffService.compareVersions(
        configId,
        fromVersion,
        toVersion
      );

      await reply.send(diff);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'DIFF_004',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DIFF_500',
        message: error.message || 'Failed to compare versions',
      });
    }
  }

  async getDiffReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const { configId } = query;

      const report = await this.diffService.getDiffReport(configId);

      await reply.send(report);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DIFF_500',
        message: error.message || 'Failed to generate diff report',
      });
    }
  }
}
