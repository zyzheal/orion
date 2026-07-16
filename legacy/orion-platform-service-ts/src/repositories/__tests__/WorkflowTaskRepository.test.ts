import { WorkflowTaskRepository } from '../WorkflowTaskRepository';

describe('WorkflowTaskRepository', () => {
  const mockQuery = jest.fn();
  let repo: WorkflowTaskRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new WorkflowTaskRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findByInstanceId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByInstanceId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByAssignee', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByAssignee('test-id', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findByStatus('active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findPendingAndAssignedWithOverdueDate', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1' }], rowCount: 1 });
    await repo.findPendingAndAssignedWithOverdueDate('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

