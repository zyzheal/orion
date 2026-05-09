/**
 * TestReportService Tests
 *
 * Tests for test report parsing and management.
 */

import { TestReportService } from '../TestReportService';

// Mock repository
const mockRepository = {
  createReport: jest.fn().mockImplementation((input) => Promise.resolve({
    id: 'report-1',
    ...input,
    createdAt: new Date(),
  })),
  findReports: jest.fn().mockResolvedValue({ reports: [], total: 0 }),
  getReportById: jest.fn().mockResolvedValue(null),
  createCases: jest.fn().mockResolvedValue(undefined),
  createCase: jest.fn().mockResolvedValue({ id: 'case-1' }),
  getCasesByReportId: jest.fn().mockResolvedValue([]),
  getReportsByRunId: jest.fn().mockResolvedValue([]),
};

describe('TestReportService', () => {
  let service: TestReportService;

  beforeEach(() => {
    mockRepository.createReport.mockClear();
    mockRepository.createCases.mockClear();
    service = new TestReportService(mockRepository as any);
  });

  describe('parseReport', () => {
    test('should parse JUnit XML format', () => {
      const xml = `<testsuites>
        <testsuite name="Test">
          <testcase name="test1" classname="A" time="0.1"/>
          <testcase name="test2" classname="B" time="0.2"/>
        </testsuite>
      </testsuites>`;

      const result = service.parseReport('junit', xml, {
        runId: 'run-1',
        stageId: 'stage-1',
        taskId: 'task-1',
      });

      expect(result.report.format).toBe('junit');
      expect(result.report.totalTests).toBe(2);
      expect(result.cases).toHaveLength(2);
    });

    test('should parse Jest JSON format', () => {
      const json = JSON.stringify({
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        numPendingTests: 0,
        elapsed: 100,
        testResults: [
          {
            name: 'test/basic.test.ts',
            assertionResults: [
              { title: 'should pass', status: 'passed', duration: 50, ancestorTitles: [] },
            ],
          },
        ],
      });

      const result = service.parseReport('jest', json, {
        runId: 'run-1',
        stageId: 'stage-1',
        taskId: 'task-1',
      });

      expect(result.report.format).toBe('jest');
      expect(result.report.totalTests).toBe(1);
      expect(result.report.passed).toBe(1);
    });

    test('should throw for unsupported format', () => {
      expect(() => {
        service.parseReport('unknown' as any, 'content', {
          runId: 'run-1',
          stageId: 'stage-1',
          taskId: 'task-1',
        });
      }).toThrow('Unsupported report format');
    });
  });

  describe('parseAndStore', () => {
    test('should parse and store JUnit report', async () => {
      const xml = `<testsuites>
        <testsuite name="Test">
          <testcase name="test1" classname="A" time="0.1"/>
        </testsuite>
      </testsuites>`;

      const result = await service.parseAndStore('junit', xml, {
        runId: 'run-1',
        stageId: 'stage-1',
        taskId: 'task-1',
      });

      expect(mockRepository.createReport).toHaveBeenCalled();
      expect(mockRepository.createCases).toHaveBeenCalled();
      expect(result.caseCount).toBe(1);
    });
  });
});
