import { DeploymentStepTrackerRepository } from '../DeploymentStepTrackerRepository';

describe('DeploymentStepTrackerRepository', () => {
  const mockQuery = jest.fn();
  let repo: DeploymentStepTrackerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DeploymentStepTrackerRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should getHealthChecks', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.getHealthChecks('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getHealthChecksForStep', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.getHealthChecksForStep('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should isStepHealthy', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.isStepHealthy('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

