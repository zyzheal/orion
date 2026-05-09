/**
 * JestJsonParser — Jest JSON 格式测试报告解析器
 *
 * 解析 Jest --json 输出格式：
 * {
 *   "numTotalTests": 10,
 *   "numPassedTests": 8,
 *   "numFailedTests": 1,
 *   "numPendingTests": 1,
 *   "elapsed": 1234,
 *   "testResults": [{
 *     "name": "path/to/test.ts",
 *     "assertionResults": [{
 *       "title": "test name",
 *       "status": "passed",
 *       "duration": 123,
 *       "failureMessages": ["..."],
 *       "ancestorTitles": ["suite name"]
 *     }]
 *   }]
 * }
 */

import { TestCaseCreateInput, TestCaseStatus } from '../../../models/TestReport';

export interface JestTestResult {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  testCases: TestCaseCreateInput[];
}

export class JestJsonParser {
  /**
   * 解析 Jest JSON 字符串
   */
  parse(jsonContent: string): JestTestResult {
    const data = JSON.parse(jsonContent);

    const testCases: TestCaseCreateInput[] = [];
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let totalDurationMs = 0;

    const testResults = data.testResults || [];

    for (const result of testResults) {
      const fileName = result.name || '';
      const assertions = result.assertionResults || [];

      for (const assertion of assertions) {
        totalTests++;
        const status = this.mapJestStatus(assertion.status);
        const durationMs = Math.round(assertion.duration || 0);
        totalDurationMs += durationMs;

        const className = assertion.ancestorTitles?.join(' > ') || fileName;
        const name = assertion.title || 'unknown';

        let errorMessage: string | undefined;
        let stackTrace: string | undefined;

        if (status === 'failed' && assertion.failureMessages?.length > 0) {
          errorMessage = assertion.failureMessages[0];
          stackTrace = assertion.failureMessages.join('\n');
        }

        testCases.push({
          name,
          className,
          status,
          durationMs,
          errorMessage,
          stackTrace,
        });

        switch (status) {
          case 'passed': passed++; break;
          case 'failed': failed++; break;
          case 'skipped': skipped++; break;
        }
      }
    }

    return {
      totalTests,
      passed,
      failed,
      skipped,
      durationMs: data.elapsed ?? totalDurationMs,
      testCases,
    };
  }

  /**
   * 映射 Jest 状态到标准状态
   */
  private mapJestStatus(status: string): TestCaseStatus {
    switch (status?.toLowerCase()) {
      case 'passed':
        return 'passed';
      case 'failed':
        return 'failed';
      case 'pending':
      case 'todo':
        return 'skipped';
      default:
        return 'skipped';
    }
  }
}
