/**
 * Observability API Routes
 *
 * 自定义告警规则、根因分析（RCA）、静默规则
 *
 * Prefix: /api/v1/observability
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ObservabilityController } from './controllers/ObservabilityController';
import { CustomAlertRuleService } from '../services/alert/CustomAlertRuleService';
import { RootCauseAnalysisService } from '../services/alert/RootCauseAnalysisService';
import { AlertSilenceService } from '../services/alert/AlertSilenceService';
import { AlertCorrelationService } from '../services/alert/AlertCorrelationService';

export default async function observabilityRoutes(
  app: FastifyInstance,
  opts?: { database?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }
): Promise<void> {
  // Initialize services
  const correlationService = new AlertCorrelationService();
  const alertRuleService = new CustomAlertRuleService(opts?.database);
  const rcaService = new RootCauseAnalysisService(correlationService);
  const silenceService = new AlertSilenceService(opts?.database);

  const controller = new ObservabilityController(alertRuleService, rcaService, silenceService);

  // ==================== Custom Alert Rules ====================

  // POST /observability/alert-rules - 创建自定义告警规则
  app.post('/alert-rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createAlertRule(request, reply);
  });

  // GET /observability/alert-rules - 获取规则列表
  app.get('/alert-rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listAlertRules(request, reply);
  });

  // GET /observability/alert-rules/:id - 获取规则详情
  app.get('/alert-rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlertRule(request, reply);
  });

  // PUT /observability/alert-rules/:id - 更新规则
  app.put('/alert-rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateAlertRule(request, reply);
  });

  // DELETE /observability/alert-rules/:id - 删除规则
  app.delete('/alert-rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteAlertRule(request, reply);
  });

  // POST /observability/alert-rules/:id/evaluate - 评估规则
  app.post('/alert-rules/:id/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.evaluateAlertRule(request, reply);
  });

  // GET /observability/alert-rule-templates - 获取告警规则模板列表
  app.get('/alert-rule-templates', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlertRuleTemplates(request, reply);
  });

  // POST /observability/alert-rules/from-template - 从模板创建规则
  app.post('/alert-rules/from-template', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createAlertRuleFromTemplate(request, reply);
  });

  // ==================== Root Cause Analysis ====================

  // POST /observability/rca - 触发根因分析
  app.post('/rca', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.triggerRca(request, reply);
  });

  // GET /observability/rca/:analysisId - 获取分析结果
  app.get('/rca/:analysisId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRcaResult(request, reply);
  });

  // GET /observability/top-root-causes - 获取 Top 根因
  app.get('/top-root-causes', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTopRootCauses(request, reply);
  });

  // ==================== Alert Silences ====================

  // POST /observability/silences - 创建静默规则
  app.post('/silences', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createSilence(request, reply);
  });

  // GET /observability/silences - 获取静默规则列表
  app.get('/silences', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listSilences(request, reply);
  });

  // DELETE /observability/silences/:id - 删除静默规则
  app.delete('/silences/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteSilence(request, reply);
  });

  // POST /observability/silences/expire - 清理过期静默规则
  app.post('/silences/expire', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.expireSilences(request, reply);
  });

  // GET /observability/rca/:deploymentId/timeline - 获取部署时间线
  app.get('/rca/:deploymentId/timeline', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRcaTimeline(request, reply);
  });

  // GET /observability/dependency-graph - 获取服务依赖图
  app.get('/dependency-graph', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDependencyGraph(request, reply);
  });

  // POST /observability/dependency-graph/analyze - 基于依赖图分析根因
  app.post('/dependency-graph/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.analyzeDependencyRootCause(request, reply);
  });

  // POST /observability/temporal-correlation - 时间关联分析
  app.post('/temporal-correlation', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.analyzeTemporalCorrelation(request, reply);
  });
}
