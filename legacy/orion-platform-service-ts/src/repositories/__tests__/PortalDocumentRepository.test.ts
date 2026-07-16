/**
 * PortalDocumentRepository Tests
 */
import { PortalDocumentRepository } from '../PortalDocumentRepository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: PortalDocumentRepository;

const sampleRow = {
  id: 'doc-1', tenant_id: 'test-tenant', title: 'API Guide', slug: 'api-guide',
  content: '{"blocks":[]}', type: 'guide', category: 'api', tags: '["reference"]',
  author: 'admin', status: 'published', version: 3, view_count: 100, helpful_yes: 10, helpful_no: 1,
  created_at: new Date(), updated_at: new Date(), published_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  repo = new PortalDocumentRepository({ query: mockQuery } as any);
});

describe('PortalDocumentRepository', () => {
  it('should find by slug', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleRow], rowCount: 1 });
    const result = await repo.findBySlug('test-tenant', 'api-guide');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('slug = $2'),
      expect.arrayContaining(['test-tenant', 'api-guide']),
    );
  });

  it('should search documents', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleRow], rowCount: 1 });
    const result = await repo.search('test-tenant', 'API');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      expect.arrayContaining(['test-tenant']),
    );
  });

  it('should increment view count', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await repo.incrementViewCount('doc-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('view_count'),
      ['doc-1'],
    );
  });

  it('should get categories', async () => {
    mockQuery.mockResolvedValue({ rows: [{ category: 'api', count: '5' }], rowCount: 1 });
    const result = await repo.getCategories('test-tenant');
    expect(result[0].category).toBe('api');
  });
});
