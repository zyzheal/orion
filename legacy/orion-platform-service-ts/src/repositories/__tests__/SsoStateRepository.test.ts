/**
 * SsoStateRepository Tests
 */
import { SsoStateRepository } from '../SsoStateRepository';

const mockQuery = jest.fn();

describe('SsoStateRepository', () => {
  let repo: SsoStateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SsoStateRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createState('test-arg', 'test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByState', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByState('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByState', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByState('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should cleanupExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.cleanupExpired();
    expect(mockQuery).toHaveBeenCalled();
  });
});
