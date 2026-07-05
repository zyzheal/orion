/**
 * TestReportService — 测试报告管理服务
 *
 * 职责：
 * - 解析测试报告文件（JUnit XML, Jest JSON）
 * - 存储测试报告到数据库
 * - 查询测试报告和用例
 * - 计算覆盖率统计
 */

import { createLogger } from '../../utils/logger';
import { TestReportRepository } from '../../repositories/TestReportRepository';
import {
  TestReport,
  TestReportCreateInput,
  TestCase,
  TestCaseCreateInput,
  ParsedTestCase,
  TestReportQueryOptions,
} from '../../models/TestReport';
import { JUnitXmlParser, JUnitTestResult } from './test-parsers/JUnitXmlParser';
import { JestJsonParser, JestTestResult } from './test-parsers/JestJsonParser';
import { OrionError } from '../../errors';

const logger = createLogger('test-report-service');

export type ReportFormat = 'junit' | 'jest';

export interface ParsedReport {
  report: TestReportCreateInput;
  cases: ParsedTestCase[];
}

export class TestReportService {
  private repository: TestReportRepository;
  private junitParser: JUnitXmlParser;
  private jestParser: JestJsonParser;

  constructor(repository: TestReportRepository) {
    this.repository = repository;
    this.junitParser = new JUnitXmlParser();
    this.jestParser = new JestJsonParser();
  }

  /**
   * 解析并存储测试报告
   */
  async parseAndStore(
    format: ReportFormat,
    content: string,
    context: { runId: string; stageId: string; taskId: string }
  ): Promise<{ report: TestReport; caseCount: number }> {
    const parsed = this.parseReport(format, content, context);

    // 创建报告
    const report = await this.repository.createReport(parsed.report);

    // 批量创建用例
    const caseInputs: TestCaseCreateInput[] = parsed.cases.map((tc) => ({
      reportId: report.id,
      name: tc.name,
      className: tc.className,
      status: tc.status,
      durationMs: tc.durationMs,
      errorMessage: tc.errorMessage,
      stackTrace: tc.stackTrace,
    }));

    await this.repository.createCases(caseInputs);

    logger.info(
      { reportId: report.id, format, caseCount: parsed.cases.length },
      'Test report stored'
    );

    return { report, caseCount: parsed.cases.length };
  }

  /**
   * 解析测试报告内容
   */
  parseReport(
    format: ReportFormat,
    content: string,
    context: { runId: string; stageId: string; taskId: string }
  ): ParsedReport {
    let result: JUnitTestResult | JestTestResult;

    switch (format) {
      case 'junit':
        result = this.junitParser.parse(content);
        break;
      case 'jest':
        result = this.jestParser.parse(content);
        break;
      default:
        throw new OrionError(`Unsupported report format: ${format}`, 'VALIDATION_ERROR')
    }

    const report: TestReportCreateInput = {
      runId: context.runId,
      stageId: context.stageId,
      taskId: context.taskId,
      format,
      totalTests: result.totalTests,
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      durationMs: result.durationMs,
    };

    return {
      report,
      cases: result.testCases,
    };
  }

  /**
   * 查询测试报告
   */
  async findReports(options: TestReportQueryOptions): Promise<{ reports: TestReport[]; total: number }> {
    return this.repository.findReports(options);
  }

  /**
   * 获取报告详情
   */
  async getReport(id: string): Promise<TestReport | null> {
    return this.repository.getReportById(id);
  }

  /**
   * 获取报告的测试用例
   */
  async getCases(reportId: string, statusFilter?: string): Promise<TestCase[]> {
    return this.repository.getCasesByReportId(reportId, statusFilter);
  }

  /**
   * 获取 Run 的所有测试报告
   */
  async getReportsByRun(runId: string): Promise<TestReport[]> {
    return this.repository.getReportsByRunId(runId);
  }

  /**
   * 获取 Run 的汇总测试统计
   */
  async getRunSummary(runId: string): Promise<{
    totalReports: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
    totalDurationMs: number;
  }> {
    const reports = await this.repository.getReportsByRunId(runId);

    return {
      totalReports: reports.length,
      totalTests: reports.reduce((sum, r) => sum + r.totalTests, 0),
      totalPassed: reports.reduce((sum, r) => sum + r.passed, 0),
      totalFailed: reports.reduce((sum, r) => sum + r.failed, 0),
      totalSkipped: reports.reduce((sum, r) => sum + r.skipped, 0),
      totalDurationMs: reports.reduce((sum, r) => sum + r.durationMs, 0),
    };
  }
}
