/**
 * ConfirmationRepository Tests
 */
import { ConfirmationRepository } from '../ConfirmationRepository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: ConfirmationRepository;

const sampleRow = {
  id: 'c-1', scene_type: 'deployment', priority: 'P1', ai_suggestion: 'Deploy to prod',
  ai_confidence: 0.85, status: 'pending', push_time: new Date(), response_time: null,
  responder: null, comment: null, context: null, tenant_id: 'test-tenant',
  created_at: new Date(), updated_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  repo = new ConfirmationRepository({ query: mockQuery } as any);
});

describe('ConfirmationRepository', () => {
  it('should insert confirmation', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleRow], rowCount: 1 });
    const result = await repo.insert({
      sceneType: 'deployment', priority: 'P1', aiSuggestion: 'Deploy to prod',
      aiConfidence: 0.85, tenantId: 'test-tenant',
    });
    expect(result.id).toBe('c-1');
  });

  it('should find by id', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleRow], rowCount: 1 });
    const result = await repo.findById('c-1');
    expect(result?.id).toBe('c-1');
    expect(result?.scene_type).toBe('deployment');
  });

  it('should update status', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.updateStatus('c-1', 'confirmed', 'admin');
    expect(result).toBe(true);
  });

  it('should delete', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.delete('c-1');
    expect(result).toBe(true);
  });

  it('should find all with filters', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [sampleRow], rowCount: 1 });
    const result = await repo.findAll({ tenantId: 'test-tenant', status: 'pending' });
    expect(result.entities).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
