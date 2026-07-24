/**
 * Config Management Controller - Fastify API Controller
 *
 * Handles HTTP requests for configuration management, GitOps sync,
 * approval workflows, and config diff operations.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { ConfigService } from '../../services/config-mgmt/ConfigService';
import { GitOpsService } from '../../services/config-mgmt/GitOpsService';
import { ConfigApprovalService } from '../../services/config-mgmt/ConfigApprovalService';
import { ConfigDiffService } from '../../services/config-mgmt/ConfigDiffService';
import { ConfigSnapshotService } from '../../services/config-mgmt/ConfigSnapshotService';
import { ConfigWebhookService } from '../../services/config/ConfigWebhookService';

export class ConfigController extends BaseController {
  private configService: ConfigService;
  private gitOpsService: GitOpsService;
  private approvalService: ConfigApprovalService;
  private diffService: ConfigDiffService;
  private snapshotService: ConfigSnapshotService;
  private webhookService: ConfigWebhookService | undefined;

  constructor(
    configService: ConfigService,
    gitOpsService: GitOpsService,
    approvalService: ConfigApprovalService,
    diffService: ConfigDiffService,
    snapshotService: ConfigSnapshotService,
    webhookService?: ConfigWebhookService
  ) {
    super();
    this.configService = configService;
    this.gitOpsService = gitOpsService;
    this.approvalService = approvalService;
    this.diffService = diffService;
    this.snapshotService = snapshotService;
    this.webhookService = webhookService;
  }

  // ==================== Config CRUD ====================

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const { key, value, environment, description, encrypted, tags, createdBy } =
        body;
      const tenantId = this.getTenantId(request);

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
      const tenantId = this.getTenantId(request);

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
      const tenantId = this.getTenantId(request);

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
      const tenantId = this.getTenantId(request);

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

      const tenantId = this.getTenantId(request);

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

      const tenantId = this.getTenantId(request);

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

  // ==================== Snapshots ====================

  async createSnapshot(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const { snapshotName, description, createdBy } = body;
      const tenantId = this.getTenantId(request);

      if (!snapshotName || !createdBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'SNAPSHOT_001',
          message: 'Missing required fields: snapshotName, createdBy',
        });
        return;
      }

      const snapshot = await this.snapshotService.createSnapshot(tenantId, {
        snapshotName,
        description,
        createdBy,
      });

      await reply.status(201).send(snapshot);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SNAPSHOT_500',
        message: error.message || 'Failed to create snapshot',
      });
    }
  }

  async listSnapshots(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const tenantId = this.getTenantId(request);
      const limit = query.limit ? parseInt(query.limit as string) : 20;

      const snapshots = await this.snapshotService.listSnapshots(tenantId, limit);

      await reply.send({
        data: snapshots,
        total: snapshots.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SNAPSHOT_500',
        message: error.message || 'Failed to list snapshots',
      });
    }
  }

  async getSnapshot(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const tenantId = this.getTenantId(request);

      const snapshot = await this.snapshotService.getSnapshot(tenantId, id);
      if (!snapshot) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'SNAPSHOT_404',
          message: `Snapshot '${id}' not found`,
        });
        return;
      }

      await reply.send(snapshot);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SNAPSHOT_500',
        message: error.message || 'Failed to get snapshot',
      });
    }
  }

  async restoreSnapshot(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const body = request.body as any;
      const { restoredBy } = body;
      const tenantId = this.getTenantId(request);

      if (!restoredBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'SNAPSHOT_001',
          message: 'Missing required field: restoredBy',
        });
        return;
      }

      const result = await this.snapshotService.restoreSnapshot(tenantId, id, restoredBy);

      await reply.send({
        message: 'Snapshot restored successfully',
        restoredCount: result.restoredCount,
        configKeys: result.configKeys,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'SNAPSHOT_404',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SNAPSHOT_500',
        message: error.message || 'Failed to restore snapshot',
      });
    }
  }

  async deleteSnapshot(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const tenantId = this.getTenantId(request);

      const deleted = await this.snapshotService.deleteSnapshot(tenantId, id);
      if (!deleted) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'SNAPSHOT_404',
          message: `Snapshot '${id}' not found`,
        });
        return;
      }

      await reply.status(204).send();
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SNAPSHOT_500',
        message: error.message || 'Failed to delete snapshot',
      });
    }
  }

  async getConfigVersionHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { configId } = params;
      const tenantId = this.getTenantId(request);
      const query = request.query as any;
      const limit = query.limit ? parseInt(query.limit as string) : 50;

      const versions = await this.snapshotService.listVersions(tenantId, configId, limit);

      await reply.send({
        data: versions.map((v) => ({
          id: v.id,
          key: v.key,
          version: v.version,
          changeType: v.changeType,
          oldValue: v.oldValue,
          newValue: v.newValue,
          changedBy: v.changedBy,
          changedAt: v.changedAt,
          comment: v.comment,
          checksum: v.checksum,
        })),
        total: versions.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'VERSION_500',
        message: error.message || 'Failed to get version history',
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

  // ==================== Config Templates ====================

  async createTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const { name, description, category, configData, targetEnvironment, createdBy } = body;
      const tenantId = this.getTenantId(request);

      if (!name || !configData || !createdBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'TEMPLATE_001',
          message: 'Missing required fields: name, configData, createdBy',
        });
        return;
      }

      const template = await this.configService.createTemplate(tenantId, {
        name,
        description,
        category,
        configData,
        targetEnvironment,
        createdBy,
      });

      await reply.status(201).send({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        configData: template.configData,
        targetEnvironment: template.targetEnvironment,
        isActive: template.isActive,
        createdBy: template.createdBy,
        createdAt: template.createdAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'TEMPLATE_500',
        message: error.message || 'Failed to create template',
      });
    }
  }

  async listTemplates(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const { category } = query;
      const tenantId = this.getTenantId(request);

      const templates = await this.configService.listTemplates(tenantId, category);

      await reply.send({
        data: templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          configData: t.configData,
          targetEnvironment: t.targetEnvironment,
          isActive: t.isActive,
          createdBy: t.createdBy,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        total: templates.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'TEMPLATE_500',
        message: error.message || 'Failed to list templates',
      });
    }
  }

  async getTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const tenantId = this.getTenantId(request);

      const template = await this.configService.getTemplate(tenantId, id);
      if (!template) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'TEMPLATE_404',
          message: `Template '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        configData: template.configData,
        targetEnvironment: template.targetEnvironment,
        isActive: template.isActive,
        createdBy: template.createdBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'TEMPLATE_500',
        message: error.message || 'Failed to get template',
      });
    }
  }

  async updateTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const { id } = params;
      const { name, description, category, configData, targetEnvironment, isActive, updatedBy } = body;
      const tenantId = this.getTenantId(request);

      if (!updatedBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'TEMPLATE_001',
          message: 'Missing required field: updatedBy',
        });
        return;
      }

      const template = await this.configService.updateTemplate(tenantId, id, {
        name,
        description,
        category,
        configData,
        targetEnvironment,
        isActive,
        updatedBy,
      });

      await reply.send({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        configData: template.configData,
        targetEnvironment: template.targetEnvironment,
        isActive: template.isActive,
        createdBy: template.createdBy,
        updatedAt: template.updatedAt,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'TEMPLATE_404',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'TEMPLATE_500',
        message: error.message || 'Failed to update template',
      });
    }
  }

  async deleteTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const tenantId = this.getTenantId(request);

      const deleted = await this.configService.deleteTemplate(tenantId, id);
      if (!deleted) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'TEMPLATE_404',
          message: `Template '${id}' not found`,
        });
        return;
      }

      await reply.status(204).send();
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'TEMPLATE_500',
        message: error.message || 'Failed to delete template',
      });
    }
  }

  async createTemplateVersion(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const { id } = params;
      const { configData, changeLog, changedBy } = body;
      const tenantId = this.getTenantId(request);

      if (!configData || !changedBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'TEMPLATE_001',
          message: 'Missing required fields: configData, changedBy',
        });
        return;
      }

      const version = await this.configService.createTemplateVersion(tenantId, id, configData, changedBy);

      await reply.status(201).send({
        id: version.id,
        templateId: version.templateId,
        version: version.version,
        configData: version.configData,
        changeLog: version.changeLog,
        createdBy: version.createdBy,
        createdAt: version.createdAt,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'TEMPLATE_404',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'TEMPLATE_500',
        message: error.message || 'Failed to create template version',
      });
    }
  }

  async listTemplateVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const tenantId = this.getTenantId(request);

      const versions = await this.configService.listTemplateVersions(tenantId, id);

      await reply.send({
        data: versions.map((v) => ({
          id: v.id,
          templateId: v.templateId,
          version: v.version,
          configData: v.configData,
          changeLog: v.changeLog,
          createdBy: v.createdBy,
          createdAt: v.createdAt,
        })),
        total: versions.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'TEMPLATE_500',
        message: error.message || 'Failed to list template versions',
      });
    }
  }

  // ==================== Canary Deployment ====================

  async createCanary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const { configId, percentage, canaryValue, targetValue, configKey } = body;
      const tenantId = this.getTenantId(request);

      if (!configId || percentage === undefined || !canaryValue || !targetValue) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'CANARY_001',
          message: 'Missing required fields: configId, percentage, canaryValue, targetValue',
        });
        return;
      }

      const canary = await this.configService.createCanaryDeployment(
        tenantId,
        configId,
        percentage,
        canaryValue,
        targetValue,
        configKey
      );

      await reply.status(201).send({
        id: canary.id,
        tenantId: canary.tenant_id,
        configId: canary.configId,
        configKey: canary.configKey,
        environment: canary.environment,
        percentage: canary.percentage,
        status: canary.status,
        canaryValue: canary.canaryValue,
        targetValue: canary.targetValue,
        createdBy: canary.createdBy,
        createdAt: canary.createdAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CANARY_500',
        message: error.message || 'Failed to create canary deployment',
      });
    }
  }

  async promoteCanary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const tenantId = this.getTenantId(request);

      const canary = await this.configService.promoteCanary(tenantId, id);

      await reply.send({
        id: canary.id,
        status: canary.status,
        percentage: canary.percentage,
        promotedAt: canary.promotedAt,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CANARY_404',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CANARY_500',
        message: error.message || 'Failed to promote canary deployment',
      });
    }
  }

  async rollbackCanary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const tenantId = this.getTenantId(request);

      const canary = await this.configService.rollbackCanary(tenantId, id);

      await reply.send({
        id: canary.id,
        status: canary.status,
        percentage: canary.percentage,
        rolledBackAt: canary.rolledBackAt,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CANARY_404',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CANARY_500',
        message: error.message || 'Failed to rollback canary deployment',
      });
    }
  }

  // ==================== Config Dependencies ====================

  async getDependencyGraph(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { configId } = params;
      const tenantId = this.getTenantId(request);

      const graph = await this.configService.getDependencyGraph(tenantId, configId);

      await reply.send({
        node: {
          id: graph.node.id,
          configId: graph.node.configId,
          dependencyType: graph.node.dependencyType,
          isActive: graph.node.isActive,
        },
        dependencies: graph.dependencies.map((d) => ({
          id: d.id,
          configId: d.configId,
          dependsOnConfigId: d.dependsOnConfigId,
          dependencyType: d.dependencyType,
          description: d.description,
          isActive: d.isActive,
          createdBy: d.createdBy,
          createdAt: d.createdAt,
        })),
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DEPENDENCY_500',
        message: error.message || 'Failed to get dependency graph',
      });
    }
  }

  // ==================== Webhooks ====================

  async createWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!this.webhookService) {
        await reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          code: 'WEBHOOK_503',
          message: 'Webhook service is not configured',
        });
        return;
      }
      const body = request.body as any;
      const tenantId = this.getTenantId(request);
      const { name, url, method, headers, secret, eventTypes, domains, enabled, retryCount, timeoutMs, createdBy } = body;

      if (!name || !url || !createdBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'WEBHOOK_001',
          message: 'Missing required fields: name, url, createdBy',
        });
        return;
      }

      const webhook = await this.webhookService.createWebhook(tenantId, {
        name,
        url,
        method: method || 'POST',
        headers: headers || {},
        secret,
        eventTypes: eventTypes || [],
        domains: domains || [],
        enabled: enabled ?? true,
        retryCount: retryCount ?? 3,
        timeoutMs: timeoutMs ?? 5000,
        createdBy,
      });

      await reply.status(201).send({
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        method: webhook.method,
        eventTypes: webhook.eventTypes,
        domains: webhook.domains,
        enabled: webhook.enabled,
        retryCount: webhook.retryCount,
        timeoutMs: webhook.timeoutMs,
        createdAt: webhook.createdAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'WEBHOOK_500',
        message: error.message || 'Failed to create webhook',
      });
    }
  }

  async getWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!this.webhookService) {
        await reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', code: 'WEBHOOK_503', message: 'Webhook service is not configured' });
        return;
      }
      const params = request.params as any;
      const { id } = params;
      const tenantId = this.getTenantId(request);

      const webhook = await this.webhookService.getWebhook(id, tenantId);
      if (!webhook) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'WEBHOOK_404',
          message: `Webhook '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        method: webhook.method,
        headers: webhook.headers,
        eventTypes: webhook.eventTypes,
        domains: webhook.domains,
        enabled: webhook.enabled,
        retryCount: webhook.retryCount,
        timeoutMs: webhook.timeoutMs,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'WEBHOOK_500',
        message: error.message || 'Failed to get webhook',
      });
    }
  }

  async listWebhooks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!this.webhookService) {
        await reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', code: 'WEBHOOK_503', message: 'Webhook service is not configured' });
        return;
      }
      const tenantId = this.getTenantId(request);
      const query = request.query as any;
      const enabled = query.enabled !== undefined ? query.enabled === 'true' : undefined;

      const result = await this.webhookService.listWebhooks(tenantId, {
        enabled: enabled,
        limit: query.limit ? parseInt(query.limit as string) : 50,
        offset: query.offset ? parseInt(query.offset as string) : 0,
      });

      await reply.send({
        data: result.data.map((w) => ({
          id: w.id,
          name: w.name,
          url: w.url,
          method: w.method,
          eventTypes: w.eventTypes,
          domains: w.domains,
          enabled: w.enabled,
          retryCount: w.retryCount,
          timeoutMs: w.timeoutMs,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        })),
        total: result.total,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'WEBHOOK_500',
        message: error.message || 'Failed to list webhooks',
      });
    }
  }

  async updateWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!this.webhookService) {
        await reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', code: 'WEBHOOK_503', message: 'Webhook service is not configured' });
        return;
      }
      const params = request.params as any;
      const { id } = params;
      const body = request.body as any;
      const tenantId = this.getTenantId(request);

      const webhook = await this.webhookService.updateWebhook(id, tenantId, body);
      if (!webhook) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'WEBHOOK_404',
          message: `Webhook '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        method: webhook.method,
        eventTypes: webhook.eventTypes,
        domains: webhook.domains,
        enabled: webhook.enabled,
        retryCount: webhook.retryCount,
        timeoutMs: webhook.timeoutMs,
        updatedAt: webhook.updatedAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'WEBHOOK_500',
        message: error.message || 'Failed to update webhook',
      });
    }
  }

  async deleteWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!this.webhookService) {
        await reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', code: 'WEBHOOK_503', message: 'Webhook service is not configured' });
        return;
      }
      const params = request.params as any;
      const { id } = params;
      const tenantId = this.getTenantId(request);

      const deleted = await this.webhookService.deleteWebhook(id, tenantId);
      if (!deleted) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'WEBHOOK_404',
          message: `Webhook '${id}' not found`,
        });
        return;
      }

      await reply.status(204).send();
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'WEBHOOK_500',
        message: error.message || 'Failed to delete webhook',
      });
    }
  }
}
