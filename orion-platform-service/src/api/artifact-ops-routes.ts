/**
 * Artifact Operations API Routes
 *
 * Routes under /v1/artifact-ops
 * PostgreSQL Repository pattern: receives database pool, creates repositories and services.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ArtifactOperationRepository } from '../repositories/ArtifactOperationRepository';
import { RetentionPolicyRepository, RetentionEvaluationRepository } from '../repositories/ArtifactRetentionRepository';
import { ScanReportRepository, ScanFindingRepository, MaliciousDetectionRepository } from '../repositories/ArtifactScanRepository';
import { ArtifactOperationService } from '../services/artifact-ops/ArtifactOperationService';
import { ArtifactScanService } from '../services/artifact-ops/ArtifactScanService';
import { ArtifactRetentionService } from '../services/artifact-ops/ArtifactRetentionService';
import { ArtifactOpsController, ArtifactOpsServices } from './controllers/ArtifactOpsController';

interface ArtifactOpsRoutesOptions {
  database?: DatabasePool;
}

export default async function artifactOpsRoutes(
  app: FastifyInstance,
  opts: ArtifactOpsRoutesOptions = {},
): Promise<void> {
  if (!opts.database) {
    // Graceful degradation: register stub health route when database unavailable
    app.get('/health', async () => ({ status: 'degraded', reason: 'database unavailable' }));
    return;
  }

  const db = opts.database;

  // Create repositories
  const operationRepo = new ArtifactOperationRepository(db);
  const policyRepo = new RetentionPolicyRepository(db);
  const evaluationRepo = new RetentionEvaluationRepository(db);
  const scanReportRepo = new ScanReportRepository(db);
  const scanFindingRepo = new ScanFindingRepository(db);
  const maliciousDetectionRepo = new MaliciousDetectionRepository(db);

  // Create services
  const operationService = new ArtifactOperationService(operationRepo);
  const scanService = new ArtifactScanService(scanReportRepo, scanFindingRepo, maliciousDetectionRepo);
  const retentionService = new ArtifactRetentionService(policyRepo, evaluationRepo);

  // Create controller
  const services: ArtifactOpsServices = { operationService, scanService, retentionService };
  const controller = new ArtifactOpsController(services);

  // POST /v1/artifact-ops/track - Track operation
  app.post('/track', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.trackOperation(request, reply);
  });

  // GET /v1/artifact-ops/history/:artifactId - Get operation history
  app.get('/history/:artifactId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getOperationHistory(request, reply);
  });

  // GET /v1/artifact-ops/stats/:tenantId - Get artifact stats
  app.get('/stats/:tenantId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getArtifactStats(request, reply);
  });

  // POST /v1/artifact-ops/retention - Define retention policy
  app.post('/retention', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.defineRetentionPolicy(request, reply);
  });

  // POST /v1/artifact-ops/cleanup - Cleanup artifacts
  app.post('/cleanup', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.cleanup(request, reply);
  });

  // POST /v1/artifact-ops/scan/:artifactId - Scan artifact
  app.post('/scan/:artifactId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.scanArtifact(request, reply);
  });

  // GET /v1/artifact-ops/scan-report/:scanId - Get scan report
  app.get('/scan-report/:scanId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getScanReport(request, reply);
  });

  // GET /v1/artifact-ops/scans/:artifactId - Get artifact scan reports
  app.get('/scans/:artifactId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getArtifactScanReports(request, reply);
  });

  // POST /v1/artifact-ops/detect - Detect malicious artifact
  app.post('/detect', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.detectMalicious(request, reply);
  });

  // POST /v1/artifact-ops/retention/evaluate - Evaluate retention
  app.post('/retention/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.evaluateRetention(request, reply);
  });

  // GET /v1/artifact-ops/retention/report - Get retention report
  app.get('/retention/report', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRetentionReport(request, reply);
  });

  // GET /v1/artifact-ops/retention/policies - List retention policies
  app.get('/retention/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listPolicies(request, reply);
  });

  // DELETE /v1/artifact-ops/retention/policies/:policyId - Delete retention policy
  app.delete('/retention/policies/:policyId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deletePolicy(request, reply);
  });
}
