/** TestReport model */

export interface TestReport {
  id: string;
  runId: string;
  stageId: string;
  taskId: string;
  format: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  coverage?: Record<string, any>;
  createdAt: Date;
}

export interface TestCase {
  id: string;
  reportId: string;
  name: string;
  className?: string;
  status: string;
  durationMs?: number;
  errorMessage?: string;
  stackTrace?: string;
}

export interface TestReportCreateInput {
  runId: string;
  stageId: string;
  taskId: string;
  format: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  coverage?: Record<string, any>;
}

export interface TestCaseCreateInput {
  reportId: string;
  name: string;
  className?: string;
  status: string;
  durationMs?: number;
  errorMessage?: string;
  stackTrace?: string;
}

export interface TestReportQueryOptions {
  runId?: string;
  stageId?: string;
  format?: string;
  limit?: number;
  offset?: number;
}

export function createTestReport(input: TestReportCreateInput): TestReport {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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

export function createTestCase(input: TestCaseCreateInput): TestCase {
  return {
    id: `tc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    reportId: input.reportId,
    name: input.name,
    className: input.className,
    status: input.status,
    durationMs: input.durationMs,
    errorMessage: input.errorMessage,
    stackTrace: input.stackTrace,
  };
}
