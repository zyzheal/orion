/**
 * Artifact Operations API Routes
 * 制品运维 API 路由 — 操作追踪、扫描、保留策略
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ArtifactOpsController } from './controllers/ArtifactOpsController';
import { ArtifactOperationService } from '../services/artifact-ops/ArtifactOperationService';
import { ArtifactScanService } from '../services/artifact-ops/ArtifactScanService';
import { ArtifactRetentionService } from '../services/artifact-ops/ArtifactRetentionService';

interface ArtifactOpsRoutesOptions {
  database?: DatabasePool;
}

export default async function artifactOpsRoutes(
  app: FastifyInstance,
  options: ArtifactOpsRoutesOptions
): Promise<void> {
  const db = options.database;

  if (!db) {
    const unavailable = async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Artifact operations require database connection',
      });
    };
    app.post('/track', unavailable);
    app.get('/history/:artifactId', unavailable);
    app.get('/stats', unavailable);
    app.post('/retention', unavailable);
    app.post('/cleanup', unavailable);
    app.post('/scan/:artifactId', unavailable);
    app.get('/scan/report/:scanId', unavailable);
    app.get('/scan/:artifactId/reports', unavailable);
    app.post('/scan/detect', unavailable);
    app.post('/retention/evaluate', unavailable);
    app.post('/retention/report', unavailable);
    app.get('/retention/policies', unavailable);
    app.delete('/retention/policies/:policyId', unavailable);
    return;
  }

  const operationService = new ArtifactOperationService(db);
  const scanService = new ArtifactScanService(db);
  const retentionService = new ArtifactRetentionService(db);

  const controller = new ArtifactOpsController({
    operationService,
    scanService,
    retentionService,
  });

  // ==================== 操作追踪 ====================

  // POST /artifact-ops/track - 追踪操作
  app.post('/track', (req, reply) => controller.trackOperation(req, reply));

  // GET /artifact-ops/history/:artifactId - 操作历史
  app.get('/history/:artifactId', (req, reply) => controller.getOperationHistory(req, reply));

  // GET /artifact-ops/stats - 统计信息
  app.get('/stats', (req, reply) => controller.getArtifactStats(req, reply));

  // ==================== 扫描 ====================

  // POST /artifact-ops/scan/:artifactId - 扫描制品
  app.post('/scan/:artifactId', (req, reply) => controller.scanArtifact(req, reply));

  // GET /artifact-ops/scan/report/:scanId - 获取扫描报告
  app.get('/scan/report/:scanId', (req, reply) => controller.getScanReport(req, reply));

  // GET /artifact-ops/scan/:artifactId/reports - 制品扫描报告列表
  app.get('/scan/:artifactId/reports', (req, reply) => controller.getArtifactScanReports(req, reply));

  // POST /artifact-ops/scan/detect - 恶意检测
  app.post('/scan/detect', (req, reply) => controller.detectMalicious(req, reply));

  // ==================== 保留策略 ====================

  // POST /artifact-ops/retention - 定义保留策略
  app.post('/retention', (req, reply) => controller.defineRetentionPolicy(req, reply));

  // POST /artifact-ops/retention/evaluate - 评估保留策略
  app.post('/retention/evaluate', (req, reply) => controller.evaluateRetention(req, reply));

  // POST /artifact-ops/retention/report - 保留报告
  app.post('/retention/report', (req, reply) => controller.getRetentionReport(req, reply));

  // GET /artifact-ops/retention/policies - 策略列表
  app.get('/retention/policies', (req, reply) => controller.listPolicies(req, reply));

  // DELETE /artifact-ops/retention/policies/:policyId - 删除策略
  app.delete('/retention/policies/:policyId', (req, reply) => controller.deletePolicy(req, reply));

  // ==================== 清理 ====================

  // POST /artifact-ops/cleanup - 清理操作记录
  app.post('/cleanup', (req, reply) => controller.cleanup(req, reply));
}
