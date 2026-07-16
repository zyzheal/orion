/**
 * JwtKeyRotationRepository Tests
 */
import { JwtKeyRotationRepository } from '../JwtKeyRotationRepository';

const mockQuery = jest.fn();

describe('JwtKeyRotationRepository', () => {
  let repo: JwtKeyRotationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new JwtKeyRotationRepository({ query: mockQuery } as any);
  });

  it('should findByKeyId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByKeyId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatuses', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatuses('active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActiveKey', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActiveKey();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findExpiringKeys', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findExpiringKeys();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateByKeyId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateByKeyId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByKeyId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByKeyId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAll();
    expect(mockQuery).toHaveBeenCalled();
  });
});
