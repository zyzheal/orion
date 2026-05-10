/**
 * Test Report API Service
 * Test report upload, query, and analysis
 */
import { api } from './client';

export interface TestCase {
  id: string;
  reportId: string;
  name: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  errorMessage?: string;
  failureMessage?: string;
  className?: string;
  fileName?: string;
}

export interface TestReport {
  id: string;
  runId: string;
  stageId?: string;
  taskId?: string;
  format: 'junit' | 'jest';
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TestReportUploadResult {
  reportId: string;
  caseCount: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface TestReportSummary {
  totalReports: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  avgDuration: number;
  passRate: number;
  reports: TestReport[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * Upload test report (JUnit XML or Jest JSON)
 */
export function uploadTestReport(params: {
  format: 'junit' | 'jest';
  content: string;
  runId: string;
  stageId?: string;
  taskId?: string;
}) {
  return api.post<TestReportUploadResult>('/api/test-reports/upload', params);
}

/**
 * List test reports
 */
export function getTestReports(params: {
  runId?: string;
  stageId?: string;
  format?: string;
  page?: number;
  pageSize?: number;
}) {
  return api.get<PaginatedResult<TestReport>>('/api/test-reports', { params });
}

/**
 * Get test report detail
 */
export function getTestReport(id: string) {
  return api.get<TestReport>(`/api/test-reports/${id}`);
}

/**
 * Get test cases for a report
 */
export function getTestCases(reportId: string, params?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return api.get<PaginatedResult<TestCase>>(`/api/test-reports/${reportId}/cases`, { params });
}

/**
 * Get all reports for a run
 */
export function getRunReports(runId: string) {
  return api.get<TestReport[]>(`/api/test-reports/run/${runId}`);
}

/**
 * Get test summary for a run
 */
export function getRunSummary(runId: string) {
  return api.get<TestReportSummary>(`/api/test-reports/run/${runId}/summary`);
}
