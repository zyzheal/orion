/**
 * TestSelectorRepository Tests
 */
import { TestCaseRepository, TestSuiteRepository } from '../TestSelectorRepository';

const mockQuery = jest.fn();

const sampleCaseRow = {
  id: 'tc-1', name: 'Login test', class_name: 'AuthTest', status: 'passed',
  duration_ms: 150, error_message: null, stack_trace: null, suite_name: 'auth',
  tags: '["smoke"]', flaky: false, flaky_count: 0,
  last_run_at: new Date(), pipeline_run_id: 'pr-1', artifact_id: 'a-1', environment: 'staging',
  report_id: 'r-1',
};

describe('TestCaseRepository', () => {
  let repo: TestCaseRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TestCaseRepository({ query: mockQuery } as any);
  });

  it('should find by suite', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleCaseRow], rowCount: 1 });
    const result = await repo.findBySuite('auth');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Login test');
  });

  it('should create test case', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleCaseRow], rowCount: 1 });
    const result = await repo.create({ name: 'Login test', status: 'passed' });
    expect(result.id).toBe('tc-1');
  });

  it('should find flaky tests', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleCaseRow], rowCount: 1 });
    const result = await repo.findFlaky();
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('flaky = true'));
  });

  it('should find by pipeline run', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleCaseRow], rowCount: 1 });
    const result = await repo.findByPipelineRun('pr-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('pipeline_run_id'),
      ['pr-1'],
    );
  });
});
