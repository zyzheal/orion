/**
 * JestJsonParser Tests
 *
 * Tests for Jest JSON format parsing.
 */

import { JestJsonParser } from '../test-parsers/JestJsonParser';

describe('JestJsonParser', () => {
  let parser: JestJsonParser;

  beforeEach(() => {
    parser = new JestJsonParser();
  });

  test('should parse basic Jest JSON output', () => {
    const json = JSON.stringify({
      numTotalTests: 3,
      numPassedTests: 2,
      numFailedTests: 1,
      numPendingTests: 0,
      elapsed: 1234,
      testResults: [
        {
          name: 'test/basic.test.ts',
          assertionResults: [
            {
              title: 'should pass',
              status: 'passed',
              duration: 100,
              ancestorTitles: ['Basic tests'],
            },
            {
              title: 'should also pass',
              status: 'passed',
              duration: 200,
              ancestorTitles: ['Basic tests'],
            },
            {
              title: 'should fail',
              status: 'failed',
              duration: 50,
              ancestorTitles: ['Basic tests'],
              failureMessages: ['Expected 1 to be 2'],
            },
          ],
        },
      ],
    });

    const result = parser.parse(json);

    expect(result.totalTests).toBe(3);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.durationMs).toBe(1234);
  });

  test('should handle pending/skipped tests', () => {
    const json = JSON.stringify({
      numTotalTests: 2,
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 1,
      elapsed: 500,
      testResults: [
        {
          name: 'test/pending.test.ts',
          assertionResults: [
            {
              title: 'should pass',
              status: 'passed',
              duration: 100,
              ancestorTitles: [],
            },
            {
              title: 'should be pending',
              status: 'pending',
              duration: 0,
              ancestorTitles: [],
            },
          ],
        },
      ],
    });

    const result = parser.parse(json);

    expect(result.skipped).toBe(1);
    expect(result.testCases[1].status).toBe('skipped');
  });

  test('should capture failure messages', () => {
    const json = JSON.stringify({
      numTotalTests: 1,
      numPassedTests: 0,
      numFailedTests: 1,
      numPendingTests: 0,
      elapsed: 100,
      testResults: [
        {
          name: 'test/fail.test.ts',
          assertionResults: [
            {
              title: 'should fail',
              status: 'failed',
              duration: 50,
              ancestorTitles: ['Failing tests'],
              failureMessages: ['Error: Something went wrong', '  at test/fail.test.ts:10:5'],
            },
          ],
        },
      ],
    });

    const result = parser.parse(json);

    expect(result.testCases[0].errorMessage).toBe('Error: Something went wrong');
    expect(result.testCases[0].stackTrace).toContain('test/fail.test.ts');
    expect(result.testCases[0].className).toBe('Failing tests');
  });

  test('should handle empty test results', () => {
    const json = JSON.stringify({
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      elapsed: 0,
      testResults: [],
    });

    const result = parser.parse(json);

    expect(result.totalTests).toBe(0);
    expect(result.testCases).toHaveLength(0);
  });
});
