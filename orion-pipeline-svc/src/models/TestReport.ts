export interface ParsedTestCase {
  name: string;
  className?: string;
  classname?: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  durationMs?: number;
  failureMessage?: string;
  errorMessage?: string;
  stackTrace?: string;
}

export interface TestCase {
  id?: string;
  name: string;
  classname: string;
  status: string;
  duration?: number;
  failureMessage?: string;
}

export interface TestCaseCreateInput {
  reportId?: string;
  name: string;
  className?: string;
  classname?: string;
  status: string;
  durationMs?: number;
  duration?: number;
  errorMessage?: string;
  failureMessage?: string;
  stackTrace?: string;
}

export interface TestReportQueryOptions {
  runId?: string;
  stageName?: string;
  format?: string;
}

export interface TestReportCreateInput {
  runId: string;
  stageId?: string;
  stageName?: string;
  taskId?: string;
  format: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  testCases?: ParsedTestCase[];
  rawResult?: Record<string, unknown>;
}

export interface TestReport {
  id: string;
  runId: string;
  stageName: string;
  format: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  testCases: ParsedTestCase[];
  createdAt: Date;
}
