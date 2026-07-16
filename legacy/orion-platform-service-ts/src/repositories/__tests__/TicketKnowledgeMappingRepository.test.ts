/**
 * TicketKnowledgeMappingRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TicketKnowledgeMappingRepository } from '../TicketKnowledgeMappingRepository';

const mockQuery = jest.fn();

describe('TicketKnowledgeMappingRepository', () => {
  let repo: TicketKnowledgeMappingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TicketKnowledgeMappingRepository({ query: mockQuery } as any);
  });

  it('should findByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTicketId('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByKnowledgeDocId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByKnowledgeDocId('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should existsByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.existsByTicketId('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByConvertedBy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByConvertedBy('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
