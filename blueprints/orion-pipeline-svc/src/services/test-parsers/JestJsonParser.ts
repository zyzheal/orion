export interface JestTestResult {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  testCases: ParsedTestCase[];
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  testResults?: Array<{
    name: string;
    status: 'passed' | 'failed' | 'pending';
    duration?: number;
    failureMessages?: string[];
  }>;
}

export interface ParsedTestCase {
  name: string;
  classname: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  failureMessage?: string;
}

export class JestJsonParser {
  parse(_content: string): JestTestResult {
    return { totalTests: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0, testCases: [], numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, numPendingTests: 0, testResults: [] };
  }
}
