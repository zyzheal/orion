/**
 * Artifact Service Unified API Routes
 *
 * Central route registry for all artifact-related endpoints.
 * Combines artifact registry, operations, and version management.
 *
 * Routes:
 * - /api/v1/artifacts/* - Main artifact CRUD and management
 * - /api/v1/artifact-ops/* - Operations, retention, scanning
 * - /api/v1/artifact-versions/* - Pipeline artifact versioning
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../utils/database';
import { ArtifactController } from '../controllers/artifact/ArtifactController';
import { ArtifactRegistryServiceImpl } from '../services/ArtifactRegistryService';
import { PostgresArtifactRepository } from '../repositories/ArtifactRepository';
import { LocalArtifactStorage } from '../storage/ArtifactStorage';
import { PromotionService } from '../services/PromotionService';
import { ArtifactOperationRepository } from '../repositories/ArtifactOperationRepository';
import { RetentionPolicyRepository, RetentionEvaluationRepository } from '../repositories/ArtifactRetentionRepository';
import { ScanReportRepository, ScanFindingRepository, MaliciousDetectionRepository } from '../repositories/ArtifactScanRepository';
import { ArtifactOperationService } from '../services/ArtifactOperationService';
import { ArtifactScanService } from '../services/ArtifactScanService';
import { ArtifactRetentionService } from '../services/ArtifactRetentionService';
import { ArtifactOpsController } from './controllers/ArtifactOpsController';
import { ArtifactVersionService } from '../services/pipeline/ArtifactVersionService';
import { ArtifactVersionRepository } from '../repositories/ArtifactVersionRepository';

interface ArtifactRoutesOptions {
  database?: DatabasePool;
}

export default async function artifactRoutes(
  app: FastifyInstance,
  options: ArtifactRoutesOptions
): Promise<void> {
  const db = options.database;

  // ==================== Initialize Services ====================

  // Core artifact services
  const artifactRepository = db ? new PostgresArtifactRepository(db) : null;
  const artifactStorage = new LocalArtifactStorage('/tmp/artifacts');
  const artifactService = artifactRepository
    ? new ArtifactRegistryServiceImpl(artifactRepository, artifactStorage)
    : null;
  const artifactController = artifactService ? new ArtifactController(artifactService) : null;
  const promotionService = new PromotionService();

  // Operations services
  const operationRepo = db ? new ArtifactOperationRepository(db) : null;
  const policyRepo = db ? new RetentionPolicyRepository(db) : null;
  const evaluationRepo = db ? new RetentionEvaluationRepository(db) : null;
  const scanReportRepo = db ? new ScanReportRepository(db) : null;
  const scanFindingRepo = db ? new ScanFindingRepository(db) : null;
  const maliciousDetectionRepo = db ? new MaliciousDetectionRepository(db) : null;

  const operationService = operationRepo ? new ArtifactOperationService(operationRepo) : null;
  const scanService = scanReportRepo && scanFindingRepo && maliciousDetectionRepo
    ? new ArtifactScanService(scanReportRepo, scanFindingRepo, maliciousDetectionRepo)
    : null;
  const retentionService = policyRepo && evaluationRepo
    ? new ArtifactRetentionService(policyRepo, evaluationRepo)
    : null;

  const opsController = (operationService && scanService && retentionService)
    ? new ArtifactOpsController({ operationService, scanService, retentionService })
    : null;

  // Version services
  const versionRepository = db ? new ArtifactVersionRepository(db) : null;
  const versionService = versionRepository ? new ArtifactVersionService(versionRepository) : null;

  // DB unavailable error handler
  const dbUnavailable = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Artifact management requires database connection',
    });
  };

  // ==================== Health Check ====================

  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!db) {
      return reply.send({ status: 'degraded', reason: 'database unavailable' });
    }
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ==================== Main Artifact Routes (/api/v1/artifacts/*) ====================

  // POST /artifacts - Create artifact
  app.post('/artifacts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.create(request, reply);
  });

  // GET /artifacts - List artifacts
  app.get('/artifacts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.list(request, reply);
  });

  // GET /artifacts/stats - Get artifact statistics
  app.get('/artifacts/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactRepository) return dbUnavailable(request, reply);
    try {
      const stats = await artifactRepository.getStats();
      return reply.send({ success: true, data: stats });
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to get stats' });
    }
  });

  // GET /artifacts/types - Get artifact type statistics
  app.get('/artifacts/types', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactRepository) return dbUnavailable(request, reply);
    try {
      const typeStats = await artifactRepository.getTypeStats();
      return reply.send({ success: true, data: typeStats });
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to get type stats' });
    }
  });

  // GET /artifacts/namespaces - Get namespace list
  app.get('/artifacts/namespaces', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactRepository) return dbUnavailable(request, reply);
    try {
      const namespaces = await artifactRepository.getNamespaces();
      return reply.send({ success: true, data: namespaces });
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to get namespaces' });
    }
  });

  // GET /artifacts/search - Search artifacts
  app.get('/artifacts/search', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.search(request, reply);
  });

  // GET /artifacts/:id - Get artifact by ID
  app.get('/artifacts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.getById(request, reply);
  });

  // PUT /artifacts/:id - Update artifact
  app.put('/artifacts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.update(request, reply);
  });

  // DELETE /artifacts/:id - Delete artifact
  app.delete('/artifacts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.delete(request, reply);
  });

  // ==================== Artifact Tags ====================

  // GET /artifacts/:id/tags - Get tags
  app.get('/artifacts/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.getTags(request, reply);
  });

  // POST /artifacts/:id/tags - Add tags
  app.post('/artifacts/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.addTags(request, reply);
  });

  // DELETE /artifacts/:id/tags - Remove tags
  app.delete('/artifacts/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.removeTags(request, reply);
  });

  // ==================== Artifact Download ====================

  // GET /artifacts/:id/download - Download artifact
  app.get('/artifacts/:id/download', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.download(request, reply);
  });

  // GET /artifacts/:id/downloads - Download history
  app.get('/artifacts/:id/downloads', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.getDownloadHistory(request, reply);
  });

  // ==================== Artifact Promotion ====================

  // POST /artifacts/:id/promote - Promote artifact
  app.post('/artifacts/:id/promote', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { promotedBy, approvedBy, reason } = request.body as any;

    try {
      if (approvedBy) {
        const record = await promotionService.promoteWithApproval(id, promotedBy, approvedBy, reason);
        return reply.send(record);
      }
      const record = await promotionService.promote(id, promotedBy, reason);
      return reply.send(record);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /artifacts/:id/stage - Get current promotion stage
  app.get('/artifacts/:id/stage', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const stage = await promotionService.getCurrentStage(id);
    if (!stage) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send({ stage });
  });

  // GET /artifacts/:id/history - Get promotion history
  app.get('/artifacts/:id/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send({ history: promotionService.getHistory(id) });
  });

  // ==================== Artifact Status Management ====================

  // POST /artifacts/:id/deprecate - Deprecate artifact
  app.post('/artifacts/:id/deprecate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.deprecate(request, reply);
  });

  // POST /artifacts/:id/quarantine - Quarantine artifact
  app.post('/artifacts/:id/quarantine', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.quarantine(request, reply);
  });

  // ==================== Artifact Operations Routes (/api/v1/artifact-ops/*) ====================

  // POST /artifact-ops/track - Track operation
  app.post('/artifact-ops/track', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.trackOperation(request, reply);
  });

  // GET /artifact-ops/history/:artifactId - Get operation history
  app.get('/artifact-ops/history/:artifactId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.getOperationHistory(request, reply);
  });

  // GET /artifact-ops/stats/:tenantId - Get artifact stats
  app.get('/artifact-ops/stats/:tenantId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.getArtifactStats(request, reply);
  });

  // POST /artifact-ops/retention - Define retention policy
  app.post('/artifact-ops/retention', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.defineRetentionPolicy(request, reply);
  });

  // GET /artifact-ops/retention/policies - List retention policies
  app.get('/artifact-ops/retention/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.listPolicies(request, reply);
  });

  // DELETE /artifact-ops/retention/policies/:policyId - Delete retention policy
  app.delete('/artifact-ops/retention/policies/:policyId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.deletePolicy(request, reply);
  });

  // POST /artifact-ops/retention/evaluate - Evaluate retention
  app.post('/artifact-ops/retention/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.evaluateRetention(request, reply);
  });

  // GET /artifact-ops/retention/report - Get retention report
  app.get('/artifact-ops/retention/report', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.getRetentionReport(request, reply);
  });

  // POST /artifact-ops/cleanup - Cleanup artifacts
  app.post('/artifact-ops/cleanup', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.cleanup(request, reply);
  });

  // POST /artifact-ops/scan/:artifactId - Scan artifact
  app.post('/artifact-ops/scan/:artifactId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.scanArtifact(request, reply);
  });

  // GET /artifact-ops/scan-report/:scanId - Get scan report
  app.get('/artifact-ops/scan-report/:scanId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.getScanReport(request, reply);
  });

  // GET /artifact-ops/scans/:artifactId - Get artifact scan reports
  app.get('/artifact-ops/scans/:artifactId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.getArtifactScanReports(request, reply);
  });

  // POST /artifact-ops/detect - Detect malicious artifact
  app.post('/artifact-ops/detect', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!opsController) return dbUnavailable(request, reply);
    return opsController.detectMalicious(request, reply);
  });

  // ==================== Artifact Version Routes (/api/v1/artifact-versions/*) ====================

  // POST /artifact-versions - Create version
  app.post('/artifact-versions', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!versionService || !db) return dbUnavailable(request, reply);
    const body = request.body as any;
    const { tenantId, pipelineId, runId, stageName, artifactName, version, commitSha, branch, storagePath, metadata } = body;

    if (!tenantId || !pipelineId || !artifactName || !version) {
      return reply.code(400).send({
        error: 'Missing required fields: tenantId, pipelineId, artifactName, version',
      });
    }

    try {
      const result = await versionService.createVersion({
        tenantId, pipelineId, runId, stageName, artifactName, version, commitSha, branch, storagePath, metadata,
      });
      return reply.code(201).send({ data: result });
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  });

  // GET /artifact-versions - List versions
  app.get('/artifact-versions', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!versionRepository || !db) return dbUnavailable(request, reply);
    const query = request.query as any;
    const options: any = {
      pipelineId: query.pipelineId,
      artifactName: query.artifactName,
      environment: query.environment,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };

    const results = await versionRepository.findWithFilters(options);
    return reply.send({ data: results.versions, total: results.total });
  });

  // GET /artifact-versions/:id - Get version details
  app.get('/artifact-versions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!versionService) return dbUnavailable(request, reply);
    const params = request.params as any;
    const version = await versionService.getVersionById(params.id);

    if (!version) {
      return reply.code(404).send({ error: 'Artifact version not found' });
    }

    return reply.send({ data: version });
  });

  // POST /artifact-versions/:id/promote - Promote version
  app.post('/artifact-versions/:id/promote', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!versionService) return dbUnavailable(request, reply);
    const params = request.params as any;
    const body = request.body as any;

    if (!body.targetEnvironment) {
      return reply.code(400).send({ error: 'Missing required field: targetEnvironment' });
    }

    try {
      const result = await versionService.promoteVersion(params.id, body.targetEnvironment);
      return reply.send({ data: result });
    } catch (error: any) {
      if (error.message.includes('already promoted') || error.message.includes('not found')) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // GET /artifact-versions/:id/lineage - Get version lineage
  app.get('/artifact-versions/:id/lineage', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!versionService) return dbUnavailable(request, reply);
    const params = request.params as any;

    try {
      const lineage = await versionService.getVersionLineage(params.id);
      return reply.send({ data: lineage });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  // POST /artifact-versions/:id/tags/:tag - Add tag to version
  app.post('/artifact-versions/:id/tags/:tag', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!versionService) return dbUnavailable(request, reply);
    const params = request.params as any;

    try {
      const result = await versionService.addTag(params.id, params.tag);
      return reply.send({ data: result });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  // DELETE /artifact-versions/:id/tags/:tag - Remove tag from version
  app.delete('/artifact-versions/:id/tags/:tag', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!versionService) return dbUnavailable(request, reply);
    const params = request.params as any;

    try {
      await versionService.removeTag(params.id, params.tag);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // GET /artifact-versions/tag/:tag - Find versions by tag
  app.get('/artifact-versions/tag/:tag', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!versionService) return dbUnavailable(request, reply);
    const params = request.params as any;
    const versions = await versionService.findVersionsByTag(params.tag);
    return reply.send({ data: versions, total: versions.length });
  });

  // GET /artifact-versions/pipeline/:pipelineId/history - Get deployment history
  app.get('/artifact-versions/pipeline/:pipelineId/history', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!versionService) return dbUnavailable(request, reply);
    const params = request.params as any;
    const query = request.query as any;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;

    const history = await versionService.getDeploymentHistory(params.pipelineId, limit);
    return reply.send({ data: history });
  });

  // GET /artifact-versions/pipeline/:pipelineId/compare - Compare versions
  app.get('/artifact-versions/pipeline/:pipelineId/compare', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!versionService) return dbUnavailable(request, reply);
    const params = request.params as any;
    const query = request.query as any;

    if (!query.versionA || !query.versionB) {
      return reply.code(400).send({ error: 'Missing required query params: versionA, versionB' });
    }

    const diff = await versionService.compareVersions(params.pipelineId, query.versionA, query.versionB);
    return reply.send({ data: diff });
  });
}