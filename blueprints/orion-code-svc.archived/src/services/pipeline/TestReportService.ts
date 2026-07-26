/**
 * Test Report Service - 测试报告服务 (stub)
 */

import { PostgresTestReportRepository } from '../../repositories/TestReportRepository';

export class TestReportService {
  constructor(private repository: PostgresTestReportRepository) {}

  async parseAndStore(format: string, content: string, context: { runId: string; stageId: string; taskId: string }): Promise<any> {
    return {
      report: {
        id: 'stub-report',
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        durationMs: 0,
      },
      caseCount: 0,
    };
  }

  async findReports(options?: { runId?: string; stageId?: string; format?: string; limit?: number; offset?: number }): Promise<any> {
    return await this.repository.findAll(options);
  }

  async getReport(id: string): Promise<any> {
    return await this.repository.findById(id);
  }

  async getCases(reportId: string, statusFilter?: string): Promise<any[]> {
    return [];
  }

  async getReportsByRun(runId: string): Promise<any[]> {
    return await this.repository.findByRun(runId);
  }

  async getRunSummary(runId: string): Promise<any> {
    return { runId, totalTests: 0, passed: 0, failed: 0, skipped: 0 };
  }
}
