// orion-ai-svc/src/routes/knowledge-security-api.ts
// Threat monitoring and compliance reporting API routes
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { threatMonitor, type ThreatLevel, type ThreatType } from '../services/ThreatMonitor';
import { complianceReporter } from '../services/ComplianceReporter';

interface RecordThreatRequest {
  level: ThreatLevel;
  type: ThreatType;
  description: string;
  source: string;
  details: Record<string, unknown>;
}

interface ThreatQuery {
  startDate?: string;
  endDate?: string;
  level?: ThreatLevel;
  resolved?: string;
  limit?: string;
}

interface ReportQuery {
  startDate: string;
  endDate: string;
}

export async function knowledgeSecurityRoutes(fastify: FastifyInstance): Promise<void> {
  // 记录威胁事件
  fastify.post<{ Body: RecordThreatRequest }>(
    '/threats',
    async (request: FastifyRequest<{ Body: RecordThreatRequest }>, reply: FastifyReply) => {
      const { level, type, description, source, details } = request.body;

      if (!level || !type || !description || !source) {
        return reply.status(400).send({ error: 'level, type, description, source are required' });
      }

      const event = await threatMonitor.recordThreat({
        level,
        type,
        description,
        source,
        details: details || {},
        resolved: false,
      });

      return reply.status(201).send(event);
    }
  );

  // 获取威胁列表
  fastify.get<{ Querystring: ThreatQuery }>(
    '/threats',
    async (request: FastifyRequest<{ Querystring: ThreatQuery }>, reply: FastifyReply) => {
      const { startDate, endDate, level, resolved, limit } = request.query;

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      if (limit) {
        const threats = await threatMonitor.getRecentThreats(Number(limit));
        return reply.send({ threats, total: threats.length });
      }

      const threats = await threatMonitor.getThreats(
        start,
        end,
        level,
        resolved !== undefined ? resolved === 'true' : undefined
      );

      return reply.send({ threats, total: threats.length });
    }
  );

  // 解决威胁
  fastify.patch<{ Params: { id: string }; Body: { resolvedBy: string } }>(
    '/threats/:id/resolve',
    async (request, reply) => {
      const { resolvedBy } = request.body;
      if (!resolvedBy) {
        return reply.status(400).send({ error: 'resolvedBy is required' });
      }

      await threatMonitor.resolveThreat(request.params.id, resolvedBy);
      return reply.send({ success: true });
    }
  );

  // 获取威胁统计
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/threats/stats',
    async (request, reply) => {
      const { startDate, endDate } = request.query;
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const stats = await threatMonitor.getThreatStats(start, end);
      return reply.send({ stats });
    }
  );

  // 生成合规报告
  fastify.post<{ Body: ReportQuery }>(
    '/compliance/report',
    async (request: FastifyRequest<{ Body: ReportQuery }>, reply: FastifyReply) => {
      const { startDate, endDate } = request.body;

      if (!startDate || !endDate) {
        return reply.status(400).send({ error: 'startDate and endDate are required' });
      }

      const report = await complianceReporter.generateReport(
        new Date(startDate),
        new Date(endDate)
      );

      return reply.send(report);
    }
  );

  // 获取安全评分
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/compliance/score',
    async (request, reply) => {
      const { startDate, endDate } = request.query;
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const score = await complianceReporter.getSecurityScore(start, end);
      return reply.send({ score, period: { start, end } });
    }
  );
}
