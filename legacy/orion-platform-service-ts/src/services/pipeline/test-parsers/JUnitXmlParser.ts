/**
 * JUnitXmlParser — JUnit XML 格式测试报告解析器
 *
 * 解析标准 JUnit XML 格式：
 * <testsuite name="..." tests="10" failures="2" skipped="1" time="1.234">
 *   <testcase name="..." classname="..." time="0.123">
 *     <failure message="...">stack trace</failure>
 *   </testcase>
 * </testsuite>
 */

import { ParsedTestCase, TestCaseStatus } from '../../../models/TestReport';

export interface JUnitTestResult {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  testCases: ParsedTestCase[];
}

export class JUnitXmlParser {
  /**
   * 解析 JUnit XML 字符串
   */
  parse(xmlContent: string): JUnitTestResult {
    const testCases: ParsedTestCase[] = [];
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let totalDurationMs = 0;

    // Simple XML parsing (no external dependencies)
    const suites = this.extractTestSuites(xmlContent);

    for (const suite of suites) {
      const cases = this.extractTestCases(suite);

      for (const testCase of cases) {
        totalTests++;
        const durationMs = Math.round(testCase.time * 1000);
        totalDurationMs += durationMs;

        const input: ParsedTestCase = {
          name: testCase.name,
          className: testCase.classname,
          status: testCase.status,
          durationMs,
          errorMessage: testCase.errorMessage,
          stackTrace: testCase.stackTrace,
        };

        testCases.push(input);

        switch (testCase.status) {
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
      durationMs: totalDurationMs,
      testCases,
    };
  }

  /**
   * 提取 testsuite 元素内容
   */
  private extractTestSuites(xml: string): string[] {
    const suites: string[] = [];
    const suiteRegex = /<testsuite[^>]*>([\s\S]*?)<\/testsuite>/g;
    let match;

    while ((match = suiteRegex.exec(xml)) !== null) {
      suites.push(match[1]);
    }

    return suites;
  }

  /**
   * 提取 testcase 元素
   */
  private extractTestCases(suiteContent: string): Array<{
    name: string;
    classname?: string;
    status: TestCaseStatus;
    time: number;
    errorMessage?: string;
    stackTrace?: string;
  }> {
    const cases: Array<{
      name: string;
      classname?: string;
      status: TestCaseStatus;
      time: number;
      errorMessage?: string;
      stackTrace?: string;
    }> = [];

    // Match self-closing: <testcase .../>
    // Or with content: <testcase ...>...</testcase>
    const caseRegex = /<testcase\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    let match;

    while ((match = caseRegex.exec(suiteContent)) !== null) {
      const attrs = match[1];
      const content = match[2] || '';

      const name = this.extractAttribute(attrs, 'name') || 'unknown';
      const classname = this.extractAttribute(attrs, 'classname') || undefined;
      const time = parseFloat(this.extractAttribute(attrs, 'time') || '0');

      let status: TestCaseStatus = 'passed';
      let errorMessage: string | undefined;
      let stackTrace: string | undefined;

      if (content.includes('<failure')) {
        status = 'failed';
        const failureMatch = content.match(/<failure[^>]*message="([^"]*)"[^>]*>([\s\S]*?)<\/failure>/);
        if (failureMatch) {
          errorMessage = failureMatch[1];
          stackTrace = failureMatch[2].trim();
        }
      } else if (content.includes('<skipped')) {
        status = 'skipped';
      }

      cases.push({ name, classname, status, time, errorMessage, stackTrace });
    }

    return cases;
  }

  /**
   * 从属性字符串中提取属性值
   */
  private extractAttribute(attrs: string, name: string): string | undefined {
    const regex = new RegExp(`${name}="([^"]*)"`, 'i');
    const match = attrs.match(regex);
    return match ? match[1] : undefined;
  }
}
