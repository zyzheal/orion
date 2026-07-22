/**
 * ApkMarketUploaderRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ApkMarketUploaderRepository } from '../ApkMarketUploaderRepository';

const mockQuery = jest.fn();

describe('ApkMarketUploaderRepository', () => {
  let repo: ApkMarketUploaderRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ApkMarketUploaderRepository({ query: mockQuery } as any);
  });

  it('should findByMarketName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByMarketName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActive();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAllMarkets', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAllMarkets();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertRegistration', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertRegistration('test-name', 'active', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-name', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });
});
