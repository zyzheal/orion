/**
 * ServiceRequestRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ServiceRequestRepository, CatalogTimelineRepository } from '../ServiceRequestRepository';

const mockQuery = jest.fn();

describe('ServiceRequestRepository', () => {
  let repo: ServiceRequestRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ServiceRequestRepository({ query: mockQuery } as any);
  });

  it('should createRequest', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createRequest('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateRequest', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateRequest('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByService', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByService('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByRequester', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRequester('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatus('test-id', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findSlaBreaches', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findSlaBreaches('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should detectSlaBreaches', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.detectSlaBreaches('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getStats', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getStats('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('CatalogTimelineRepository', () => {
  let repo: CatalogTimelineRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CatalogTimelineRepository({ query: mockQuery } as any);
  });

  it('should createEvent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createEvent('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByRequestId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRequestId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
