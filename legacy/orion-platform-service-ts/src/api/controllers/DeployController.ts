/**
 * Smart Deploy Controller - Fastify API Controller
 *
 * Handles HTTP requests for smart deployment operations including
 * deployment execution, status queries, history, rollback, and metrics.
 *
 * TASK-701: Smart Deployment (智能部署)
 * Prefix: /api/v1/deploy
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { SmartDeployService } from '../../services/smart-deploy/SmartDeployService';
import { DeployReleaseNotesService } from '../../services/deploy/DeployReleaseNotesService';
import { DeployGitIntegrationService, DeployGitIntegrationError } from '../../services/deploy/DeployGitIntegrationService';

export class DeployController extends BaseController {
  private smartDeployService: SmartDeployService;
  private releaseNotesService: DeployReleaseNotesService;
  private gitIntegrationService: DeployGitIntegrationService;

  constructor(
    smartDeployService: SmartDeployService,
    releaseNotesService?: DeployReleaseNotesService,
    gitIntegrationService?: DeployGitIntegrationService
  ) {
    super();
    this.smartDeployService = smartDeployService;
    this.releaseNotesService = releaseNotesService || ({} as any);
    this.gitIntegrationService = gitIntegrationService || ({} as any);
  }

  // ==================== Deployment Execution ====================

  /**
   * POST /deploy - Create and execute a deployment
   */
  async deploy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const {
        appName,
        version,
        environment,
        strategy,
        strategyConfig,
        healthCheck,
        rollbackPolicy,
        image,
        replicas,
        initiatedBy,
        notes,
        changeRequestId,
        commitSha,
        commitCommittedAt,
      } = body;

      if (!appName || !version || !environment || !initiatedBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'DEPLOY_001',
          message:
            'Missing required fields: appName, version, environment, initiatedBy',
        });
        return;
      }

      if (!['dev', 'staging', 'prod', 'development', 'production', 'pre-prod'].includes(environment)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'DEPLOY_002',
          message:
            'Invalid environment. Must be one of: dev, staging, prod, pre-prod',
        });
        return;
      }

      const validStrategies = ['blue-green', 'canary', 'rolling', 'recreate'];
      if (strategy && !validStrategies.includes(strategy)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'DEPLOY_003',
          message:
            'Invalid strategy. Must be one of: blue-green, canary, rolling, recreate',
        });
        return;
      }

      const deployment = await this.smartDeployService.deploy({
        appName,
        version,
        environment,
        strategy,
        strategyConfig,
        healthCheck,
        rollbackPolicy,
        image,
        replicas,
        initiatedBy,
        notes,
        changeRequestId,
        commitSha,
        commitCommittedAt: commitCommittedAt ? new Date(commitCommittedAt) : undefined,
      });

      await reply.status(201).send({
        id: deployment.id,
        appName: deployment.appName,
        version: deployment.version,
        environment: deployment.environment,
        strategy: deployment.strategy,
        status: deployment.status,
        stages: deployment.stages.map((s) => ({
          name: s.name,
          status: s.status,
          steps: s.steps.map((step) => ({
            name: step.name,
            status: step.status,
          })),
        })),
        startedAt: deployment.startedAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DEPLOY_500',
        message: error.message || 'Failed to create deployment',
      });
    }
  }

  // ==================== Deployment Status ====================

  /**
   * GET /deploy/:id - Get deployment status
   */
  async getStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const deployment = await this.smartDeployService.getStatus(id);
      if (!deployment) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'DEPLOY_004',
          message: `Deployment '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: deployment.id,
        appName: deployment.appName,
        version: deployment.version,
        environment: deployment.environment,
        strategy: deployment.strategy,
        status: deployment.status,
        stages: deployment.stages,
        currentStageIndex: deployment.currentStageIndex,
        rollbackInfo: deployment.rollbackInfo,
        startedAt: deployment.startedAt,
        completedAt: deployment.completedAt,
        initiatedBy: deployment.initiatedBy,
        error: deployment.error,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DEPLOY_500',
        message: error.message || 'Failed to get deployment status',
      });
    }
  }

  // ==================== Deployment History ====================

  /**
   * GET /deploy/history - Get deployment history
   */
  async getHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const {
        appName,
        version,
        environment,
        status,
        strategy,
        initiatedBy,
        startDate,
        endDate,
        limit,
        offset,
      } = query;

      const history = await this.smartDeployService.getHistory({
        appName,
        version,
        environment,
        status: status as any,
        strategy: strategy as any,
        initiatedBy,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });

      await reply.send({
        data: history.data.map((d) => ({
          id: d.id,
          appName: d.appName,
          version: d.version,
          environment: d.environment,
          strategy: d.strategy,
          status: d.status,
          initiatedBy: d.initiatedBy,
          startedAt: d.startedAt,
          completedAt: d.completedAt,
        })),
        total: history.total,
        limit: history.limit,
        offset: history.offset,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DEPLOY_500',
        message: error.message || 'Failed to get deployment history',
      });
    }
  }

  // ==================== Deployment Metrics ====================

  /**
   * GET /deploy/metrics - Get deployment metrics
   */
  async getMetrics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const { appName, environment, startDate, endDate } = query;

      const metrics = await this.smartDeployService.getMetrics({
        appName,
        environment,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      await reply.send(metrics);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DEPLOY_500',
        message: error.message || 'Failed to get deployment metrics',
      });
    }
  }

  // ==================== Audit Trail ====================

  /**
   * GET /deploy/:id/audit - Get audit trail
   */
  async getAuditTrail(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const auditTrail = await this.smartDeployService.getAuditTrail(id);

      await reply.send({
        data: auditTrail,
        total: auditTrail.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DEPLOY_500',
        message: error.message || 'Failed to get audit trail',
      });
    }
  }

  // ==================== Rollback ====================

  /**
   * POST /deploy/:id/rollback - Trigger rollback
   */
  async rollback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const body = request.body as any;
      const { reason, triggeredBy, targetVersion } = body;

      if (!reason || !triggeredBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'DEPLOY_001',
          message: 'Missing required fields: reason, triggeredBy',
        });
        return;
      }

      const result = await this.smartDeployService.rollback(
        id,
        reason,
        triggeredBy,
        targetVersion
      );

      await reply.send({
        deployment: {
          id: result.deployment.id,
          status: result.deployment.status,
          rollbackInfo: result.deployment.rollbackInfo,
        },
        rollback: {
          id: result.rollback.id,
          status: result.rollback.status,
          reason: result.rollback.reason,
          targetVersion: result.rollback.targetVersion,
          startedAt: result.rollback.startedAt,
          completedAt: result.rollback.completedAt,
        },
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'DEPLOY_004',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DEPLOY_500',
        message: error.message || 'Failed to rollback deployment',
      });
    }
  }

  /**
   * GET /deploy/:id/rollbacks - Get rollback history
   */
  async getRollbackHistory(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const rollbacks = await this.smartDeployService.getRollbackHistory(id);

      await reply.send({
        data: rollbacks,
        total: rollbacks.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DEPLOY_500',
        message: error.message || 'Failed to get rollback history',
      });
    }
  }

  // ==================== Cancel ====================

  /**
   * POST /deploy/:id/cancel - Cancel a deployment
   */
  async cancel(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const body = request.body as any;
      const { cancelledBy } = body;

      if (!cancelledBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'DEPLOY_001',
          message: 'Missing required field: cancelledBy',
        });
        return;
      }

      const deployment = await this.smartDeployService.cancelDeployment(
        id,
        cancelledBy
      );

      await reply.send({
        id: deployment.id,
        status: deployment.status,
        cancelledAt: deployment.completedAt,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'DEPLOY_004',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DEPLOY_500',
        message: error.message || 'Failed to cancel deployment',
      });
    }
  }

  // ==================== Latest Deployment ====================

  /**
   * GET /deploy/latest/:appName/:environment - Get latest deployment
   */
  async getLatestDeployment(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { appName, environment } = params;

      const deployment = await this.smartDeployService.getLatestDeployment(
        appName,
        environment
      );

      if (!deployment) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'DEPLOY_004',
          message: `No deployments found for '${appName}' in '${environment}'`,
        });
        return;
      }

      await reply.send({
        id: deployment.id,
        appName: deployment.appName,
        version: deployment.version,
        environment: deployment.environment,
        strategy: deployment.strategy,
        status: deployment.status,
        startedAt: deployment.startedAt,
        completedAt: deployment.completedAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'DEPLOY_500',
        message: error.message || 'Failed to get latest deployment',
      });
    }
  }

  // ==================== Release Notes ====================

  /**
   * GET /deploy/:id/release-notes - Get release notes for a deployment
   */
  async getReleaseNotes(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const releaseNotes = await this.releaseNotesService.getReleaseNotes(id);

      if (!releaseNotes) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'RELEASE_NOTES_404',
          message: `Release notes not found for deployment '${id}'`,
        });
        return;
      }

      await reply.send(releaseNotes);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'RELEASE_NOTES_500',
        message: error.message || 'Failed to get release notes',
      });
    }
  }

  /**
   * POST /deploy/:id/release-notes/generate - Generate release notes from Git
   */
  async generateReleaseNotes(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const body = request.body as any;

      // Get deployment info
      const deployment = await this.smartDeployService.getStatus(id);
      if (!deployment) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'DEPLOY_004',
          message: `Deployment '${id}' not found`,
        });
        return;
      }

      // Generate release notes
      const releaseNotes = await this.releaseNotesService.generateFromGit({
        deploymentId: id,
        tenantId: 'default',
        version: deployment.version,
        environment: deployment.environment,
        fromCommit: body?.fromCommit,
        toCommit: body?.toCommit || deployment.commitSha,
        repoPath: body?.repoPath || process.cwd(),
        generatedBy: 'git',
      });

      await reply.status(201).send(releaseNotes);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'RELEASE_NOTES_500',
        message: error.message || 'Failed to generate release notes',
      });
    }
  }

  /**
   * GET /deploy/release-notes/tenant/:tenantId - Get release notes for tenant
   */
  async getReleaseNotesByTenant(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { tenantId } = params;
      const query = request.query as any;
      const limit = query?.limit ? parseInt(query.limit) : 50;

      const releaseNotes = await this.releaseNotesService.getReleaseNotesByTenant(tenantId, limit);

      await reply.send({
        data: releaseNotes,
        total: releaseNotes.length,
        limit,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'RELEASE_NOTES_500',
        message: error.message || 'Failed to get release notes',
      });
    }
  }

  // ==================== Git Integration ====================

  /**
   * POST /deploy/:id/git/link - Link a Git commit to a deployment
   */
  async linkGitCommit(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const body = request.body as any;
      const tenantId = this.getTenantId(request);

      const { commitSha, branch, prNumber, prUrl } = body;

      if (!commitSha) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'GIT_LINK_001',
          message: 'commitSha is required',
        });
        return;
      }

      const link = await this.gitIntegrationService.linkGitCommit(id, tenantId, commitSha, {
        branch,
        prNumber,
        prUrl,
      });

      await reply.status(201).send(link);
    } catch (error: any) {
      if (error instanceof DeployGitIntegrationError) {
        const statusMap: Record<string, number> = {
          DEPLOY_NOT_FOUND: 404,
          TENANT_MISMATCH: 403,
          INVALID_INPUT: 400,
          INVALID_COMMIT_SHA: 400,
        };
        const status = statusMap[error.code] || 500;
        await reply.status(status).send({
          error: error.code,
          code: `GIT_LINK_${status}`,
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'GIT_LINK_500',
        message: error.message || 'Failed to link Git commit',
      });
    }
  }

  /**
   * GET /deploy/:id/git/changelog - Get deployment changelog from Git
   */
  async getDeploymentChangelog(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const query = request.query as any;
      const tenantId = this.getTenantId(request);
      const repoPath = query?.repoPath;

      const changelog = await this.gitIntegrationService.getDeploymentChangelog(id, tenantId, repoPath);

      await reply.send(changelog);
    } catch (error: any) {
      if (error instanceof DeployGitIntegrationError) {
        const statusMap: Record<string, number> = {
          DEPLOY_NOT_FOUND: 404,
          TENANT_MISMATCH: 403,
          NO_COMMIT_SHA: 422,
          INVALID_INPUT: 400,
          REPO_NOT_FOUND: 404,
          NOT_A_REPO: 400,
          GIT_LOG_FAILED: 500,
        };
        const status = statusMap[error.code] || 500;
        await reply.status(status).send({
          error: error.code,
          code: `GIT_CHANGELOG_${status}`,
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'GIT_CHANGELOG_500',
        message: error.message || 'Failed to get deployment changelog',
      });
    }
  }
}
