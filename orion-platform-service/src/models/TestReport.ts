/**
 * TestReport — 测试报告与测试用例数据模型
 *
 * 存储 CI 流水线中测试任务的执行结果，支持 JUnit、Jest、PyTest 等格式。
 * 测试用例独立存储（非 JSONB），支持查询、统计、趋势分析。
 */

import { v4 as uuidv4 } from 'uuid';

export type TestReportFormat = 'junit' | 'jest' | 'pytest' | 'go' | 'allure' | 'custom';
export type TestCaseStatus = 'passed' | 'failed' | 'skipped';

/**
 * 覆盖率汇总
 */
export interface CoverageSummary {
  lines: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  statements: { total: number; covered: number; pct: number };
}

/**
 * 测试报告（汇总信息）
 */
export interface TestReport {
  id: string;
  runId: string;
  stageId: string;
  taskId: string;
  format: TestReportFormat;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  coverage?: CoverageSummary;
  createdAt: Date;
}

/**
 * 单个测试用例
 */
export interface TestCase {
  id: string;
  reportId: string;
  name: string;
  className?: string;
  status: TestCaseStatus;
  durationMs?: number;
  errorMessage?: string;
  stackTrace?: string;
}

/**
 * 创建测试报告的输入参数
 */
export interface TestReportCreateInput {
  runId: string;
  stageId: string;
  taskId: string;
  format: TestReportFormat;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  coverage?: CoverageSummary;
}

/**
 * 创建测试用例的输入参数
 */
export interface TestCaseCreateInput {
  reportId: string;
  name: string;
  className?: string;
  status: TestCaseStatus;
  durationMs?: number;
  errorMessage?: string;
  stackTrace?: string;
}

/**
 * 查询选项
 */
export interface TestReportQueryOptions {
  runId?: string;
  stageId?: string;
  taskId?: string;
  format?: TestReportFormat;
  statusFilter?: TestCaseStatus;
  limit?: number;
  offset?: number;
}

/**
 * 工具函数：创建 TestReport 实例（不持久化）
 */
export function createTestReport(input: TestReportCreateInput): TestReport {
  return {
    id: uuidv4(),
    runId: input.runId,
    stageId: input.stageId,
    taskId: input.taskId,
    format: input.format,
    totalTests: input.totalTests,
    passed: input.passed,
    failed: input.failed,
    skipped: input.skipped,
    durationMs: input.durationMs,
    coverage: input.coverage,
    createdAt: new Date(),
  };
}

/**
 * 工具函数：创建 TestCase 实例（不持久化）
 */
export function createTestCase(input: TestCaseCreateInput): TestCase {
  return {
    id: uuidv4(),
    reportId: input.reportId,
    name: input.name,
    className: input.className,
    status: input.status,
    durationMs: input.durationMs,
    errorMessage: input.errorMessage,
    stackTrace: input.stackTrace,
  };
}
