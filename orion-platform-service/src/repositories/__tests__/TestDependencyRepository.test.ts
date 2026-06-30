/**
 * TestDependencyRepository Tests
 */
import { TestSuiteDependencyRepository, TestCaseDependencyRepository, TestCodeMappingDependencyRepository } from '../TestDependencyRepository';

const mockQuery = jest.fn();

describe('TestSuiteDependencyRepository', () => {
  let repo: TestSuiteDependencyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TestSuiteDependencyRepository({ query: mockQuery } as any);
  });

  it('should find by tenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'd-1', tenant_id: 't-1', source_suite_id: 's-1', target_suite_id: 's-2', dependency_type: 'hard', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('t-1');
    expect(result).toHaveLength(1);
  });
});

describe('TestCaseDependencyRepository', () => {
  let repo: TestCaseDependencyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TestCaseDependencyRepository({ query: mockQuery } as any);
  });

  it('should find by suite id', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'd-1', tenant_id: 't-1', suite_id: 's-1', source_case_id: 'c-1', target_case_id: 'c-2', dependency_type: 'soft', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySuiteId('s-1');
    expect(result).toHaveLength(1);
  });
});

describe('TestCodeMappingDependencyRepository', () => {
  let repo: TestCodeMappingDependencyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TestCodeMappingDependencyRepository({ query: mockQuery } as any);
  });

  it('should find by test path', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'm-1', tenant_id: 't-1', test_path: 'src/auth.test.ts', code_paths: ['src/auth.ts'], created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTestPath('src/auth.test.ts');
    expect(result).not.toBeNull();
  });
});
