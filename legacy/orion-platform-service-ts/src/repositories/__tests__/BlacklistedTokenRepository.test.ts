/**
 * BlacklistedTokenRepository Tests
 */
import { BlacklistedTokenRepository } from '../BlacklistedTokenRepository';

const mockQuery = jest.fn();

describe('BlacklistedTokenRepository', () => {
  let repo: BlacklistedTokenRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new BlacklistedTokenRepository({ query: mockQuery } as any);
  });

  it('should findByHash', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByHash('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should revokeAllUserTokens', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.revokeAllUserTokens('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should revokeAllTenantTokens', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.revokeAllTenantTokens('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should cleanupExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.cleanupExpired();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getUserRevokedCount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getUserRevokedCount('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getStats', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getStats();
    expect(mockQuery).toHaveBeenCalled();
  });
});
