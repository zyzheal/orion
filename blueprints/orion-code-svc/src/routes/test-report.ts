/**
 * Test Report API Routes
 *
 * - POST   /api/v1/test-reports/upload          — Upload & parse test report
 * - GET    /api/v1/test-reports                  — List test reports
 * - GET    /api/v1/test-reports/:id              — Get report details
 * - GET    /api/v1/test-reports/:id/cases        — Get test cases for a report
 * - GET    /api/v1/test-reports/run/:runId       — Get all reports for a run
 * - GET    /api/v1/test-reports/run/:runId/summary — Get run test summary
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TestReportService } from '../services/pipeline/TestReportService';
import { PostgresTestReportRepository } from '../repositories/TestReportRepository';

export default async function testReportRoutes(app: FastifyInstance, opts: { database?: any }): Promise<void> {
  if (!opts.database) {
    app.get('/health', async () => ({ status: 'unavailable', reason: 'database not configured' }));
    return;
  }

  const repository = new PostgresTestReportRepository(opts.database);
  const service = new TestReportService(repository);

  // POST /api/v1/test-reports/upload — Upload & parse test report (JUnit XML or Jest JSON)
  app.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const { format, content, runId, stageId, taskId } = body;

    if (!format || !content || !runId || !stageId || !taskId) {
      return reply.code(400).send({
        error: 'Missing required fields: format, content, runId, stageId, taskId',
      });
    }

    if (format !== 'junit' && format !== 'jest') {
      return reply.code(400).send({
        error: `Unsupported format: ${format}. Supported: junit, jest`,
      });
    }

    const result = await service.parseAndStore(format, content, { runId, stageId, taskId });

    return reply.code(201).send({
      reportId: result.report.id,
      caseCount: result.caseCount,
      totalTests: result.report.totalTests,
      passed: result.report.passed,
      failed: result.report.failed,
      skipped: result.report.skipped,
      durationMs: result.report.durationMs,
    });
  });

  // GET /api/v1/test-reports — List test reports
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const options = {
      runId: query.runId,
      stageId: query.stageId,
      format: query.format,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };

    const result = await service.findReports(options);

    return reply.send({
      data: result.reports,
      total: result.total,
      limit: options.limit,
      offset: options.offset,
    });
  });

  // GET /api/v1/test-reports/:id — Get report details
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const report = await service.getReport(params.id);

    if (!report) {
      return reply.code(404).send({ error: 'Test report not found' });
    }

    return reply.send({ data: report });
  });

  // GET /api/v1/test-reports/:id/cases — Get test cases for a report
  app.get('/:id/cases', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const query = request.query as any;
    const statusFilter = query.status;

    const report = await service.getReport(params.id);
    if (!report) {
      return reply.code(404).send({ error: 'Test report not found' });
    }

    const cases = await service.getCases(params.id, statusFilter);

    return reply.send({
      data: cases,
      total: cases.length,
      report: {
        id: report.id,
        totalTests: report.totalTests,
        passed: report.passed,
        failed: report.failed,
        skipped: report.skipped,
      },
    });
  });

  // GET /api/v1/test-reports/run/:runId — Get all reports for a run
  app.get('/run/:runId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const reports = await service.getReportsByRun(params.runId);

    return reply.send({
      data: reports,
      total: reports.length,
    });
  });

  // GET /api/v1/test-reports/run/:runId/summary — Get run test summary
  app.get('/run/:runId/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const summary = await service.getRunSummary(params.runId);

    return reply.send({ data: summary });
  });
}
