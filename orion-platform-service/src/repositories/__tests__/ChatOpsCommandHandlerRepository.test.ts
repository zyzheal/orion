/**
 * ChatOpsCommandHandlerRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ChatOpsCommandHandlerRepository } from '../ChatOpsCommandHandlerRepository';

const mockQuery = jest.fn();

describe('ChatOpsCommandHandlerRepository', () => {
  let repo: ChatOpsCommandHandlerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ChatOpsCommandHandlerRepository({ query: mockQuery } as any);
  });

  it('should findByCommandName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByCommandName('test-name', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByCommandName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByCommandName('test-name', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should disableByCommandName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.disableByCommandName('test-name', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
