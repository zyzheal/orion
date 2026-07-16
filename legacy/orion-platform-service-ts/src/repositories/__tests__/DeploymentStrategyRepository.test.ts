import { DeploymentStrategyRepository } from '../DeploymentStrategyRepository';

describe('DeploymentStrategyRepository', () => {
  const mockQuery = jest.fn();
  let repo: DeploymentStrategyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DeploymentStrategyRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByType('test-id', 'test-type');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should delete', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.delete('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

