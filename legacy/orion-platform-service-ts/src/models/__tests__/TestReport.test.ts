/**
 * TestReport 模型测试
 */
import { createTestReport, createTestCase } from '../TestReport';

describe('TestReport', () => {
  describe('createTestReport', () => {
    it('should create report with required fields', () => {
      const report = createTestReport({
        runId: 'run-1',
        stageId: 'stage-1',
        taskId: 'task-1',
        format: 'junit',
        totalTests: 100,
        passed: 95,
        failed: 3,
        skipped: 2,
        durationMs: 5000,
      });

      expect(report.id).toBeDefined();
      expect(report.runId).toBe('run-1');
      expect(report.stageId).toBe('stage-1');
      expect(report.taskId).toBe('task-1');
      expect(report.format).toBe('junit');
      expect(report.totalTests).toBe(100);
      expect(report.passed).toBe(95);
      expect(report.failed).toBe(3);
      expect(report.skipped).toBe(2);
      expect(report.durationMs).toBe(5000);
      expect(report.createdAt).toBeInstanceOf(Date);
    });

    it('should accept coverage data', () => {
      const report = createTestReport({
        runId: 'r1',
        stageId: 's1',
        taskId: 't1',
        format: 'jest',
        totalTests: 50,
        passed: 50,
        failed: 0,
        skipped: 0,
        durationMs: 3000,
        coverage: {
          lines: { total: 1000, covered: 850, pct: 85 },
          branches: { total: 200, covered: 160, pct: 80 },
          functions: { total: 100, covered: 90, pct: 90 },
          statements: { total: 1000, covered: 850, pct: 85 },
        },
      });

      expect(report.coverage).toBeDefined();
      expect(report.coverage!.lines.pct).toBe(85);
      expect(report.coverage!.branches.pct).toBe(80);
    });
  });

  describe('createTestCase', () => {
    it('should create test case with required fields', () => {
      const tc = createTestCase({
        reportId: 'report-1',
        name: 'should add two numbers',
        status: 'passed',
      });

      expect(tc.id).toBeDefined();
      expect(tc.reportId).toBe('report-1');
      expect(tc.name).toBe('should add two numbers');
      expect(tc.status).toBe('passed');
    });

    it('should accept optional fields', () => {
      const tc = createTestCase({
        reportId: 'r1',
        name: 'test',
        className: 'MathTest',
        status: 'failed',
        durationMs: 150,
        errorMessage: 'Expected 3 but got 4',
        stackTrace: 'at MathTest.test (math.test.ts:10)',
      });

      expect(tc.className).toBe('MathTest');
      expect(tc.status).toBe('failed');
      expect(tc.durationMs).toBe(150);
      expect(tc.errorMessage).toBe('Expected 3 but got 4');
      expect(tc.stackTrace).toContain('MathTest');
    });
  });
});
