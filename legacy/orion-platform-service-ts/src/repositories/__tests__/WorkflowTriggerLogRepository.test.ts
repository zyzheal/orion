/**
 * WorkflowTriggerLogRepository Tests
 */
import { WorkflowTriggerLogRepository } from '../WorkflowTriggerLogRepository';

const mockQuery = jest.fn();

describe('WorkflowTriggerLogRepository', () => {
  let repo: WorkflowTriggerLogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new WorkflowTriggerLogRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTriggerId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTriggerId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
