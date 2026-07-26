export interface JUnitTestResult {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  testCases: ParsedTestCase[];
  testsuites?: Array<{
    name?: string;
    tests?: number;
    failures?: number;
    errors?: number;
    time?: number;
    testcases?: Array<{
      name: string;
      classname: string;
      time: number;
      failure?: string;
      error?: string;
      skipped?: boolean;
    }>;
  }>;
}

export interface ParsedTestCase {
  name: string;
  classname: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  failureMessage?: string;
}

export class JUnitXmlParser {
  parse(_content: string): JUnitTestResult {
    return { totalTests: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0, testCases: [], testsuites: [] };
  }
}
