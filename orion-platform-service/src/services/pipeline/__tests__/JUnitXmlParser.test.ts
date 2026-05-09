/**
 * JUnitXmlParser Tests
 *
 * Tests for JUnit XML format parsing.
 */

import { JUnitXmlParser } from '../test-parsers/JUnitXmlParser';

describe('JUnitXmlParser', () => {
  let parser: JUnitXmlParser;

  beforeEach(() => {
    parser = new JUnitXmlParser();
  });

  test('should parse basic JUnit XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="TestSuite" tests="3" failures="1" skipped="1" time="1.234">
    <testcase name="should pass" classname="MyTest" time="0.123"/>
    <testcase name="should fail" classname="MyTest" time="0.456">
      <failure message="Assertion failed">stack trace here</failure>
    </testcase>
    <testcase name="should skip" classname="MyTest" time="0.001">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>`;

    const result = parser.parse(xml);

    expect(result.totalTests).toBe(3);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.testCases).toHaveLength(3);
  });

  test('should parse failure message and stack trace', () => {
    const xml = `<testsuite name="Test">
  <testcase name="failing test" classname="MyTest" time="0.5">
    <failure message="Expected 1 to be 2">Error: Expected 1 to be 2
    at Object.&lt;anonymous&gt; (test.spec.ts:10:5)</failure>
  </testcase>
</testsuite>`;

    const result = parser.parse(xml);

    expect(result.testCases[0].status).toBe('failed');
    expect(result.testCases[0].errorMessage).toBe('Expected 1 to be 2');
    expect(result.testCases[0].stackTrace).toContain('test.spec.ts');
  });

  test('should handle empty test suite', () => {
    const xml = `<testsuite name="Empty"></testsuite>`;
    const result = parser.parse(xml);

    expect(result.totalTests).toBe(0);
    expect(result.testCases).toHaveLength(0);
  });

  test('should handle multiple test suites', () => {
    const xml = `<testsuites>
  <testsuite name="Suite1">
    <testcase name="test1" classname="A" time="0.1"/>
  </testsuite>
  <testsuite name="Suite2">
    <testcase name="test2" classname="B" time="0.2"/>
  </testsuite>
</testsuites>`;

    const result = parser.parse(xml);

    expect(result.totalTests).toBe(2);
    expect(result.testCases).toHaveLength(2);
  });
});
