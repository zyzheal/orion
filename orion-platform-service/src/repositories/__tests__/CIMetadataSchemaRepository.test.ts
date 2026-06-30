/**
 * CIMetadataSchemaRepository Tests
 */
import { CIMetadataSchemaRepository, CITypeAttributeRepository } from '../CIMetadataSchemaRepository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();

const sampleSchemaRow = {
  id: 's-1', tenant_id: 'test-tenant', name: 'server', display_name: 'Server',
  description: 'A server', icon: 'server', parent_type_id: null, k8s_type: 'Deployment',
  is_system: false, status: 'active', sort_order: 1, metadata: '{}',
  created_by: 'admin', created_at: new Date(), updated_at: new Date(), deleted_at: null,
};

const sampleAttrRow = {
  id: 'a-1', tenant_id: 'test-tenant', ci_type_id: 's-1', name: 'ip',
  display_name: 'IP Address', data_type: 'string', required: true,
  default_value: null, options: null, reference_type: null, validation: null,
  description: 'IP', sort_order: 1, is_system: false, is_searchable: true,
  is_hidden: false, metadata: '{}', created_by: 'admin',
  created_at: new Date(), updated_at: new Date(), deleted_at: null,
};

describe('CIMetadataSchemaRepository', () => {
  let repo: CIMetadataSchemaRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CIMetadataSchemaRepository({ query: mockQuery } as any);
  });

  it('should find by tenant', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleSchemaRow], rowCount: 1, total: 1 });
    const result = await repo.findByTenant('test-tenant');
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('server');
  });

  it('should find by name', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleSchemaRow], rowCount: 1 });
    const result = await repo.findByName('test-tenant', 'server');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('name = $2'),
      expect.arrayContaining(['test-tenant', 'server']),
    );
  });

  it('should soft delete', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.softDelete('s-1');
    expect(result).toBe(true);
  });
});

describe('CITypeAttributeRepository', () => {
  let repo: CITypeAttributeRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CITypeAttributeRepository({ query: mockQuery } as any);
  });

  it('should find by type', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleAttrRow], rowCount: 1 });
    const result = await repo.findByType('s-1', 'test-tenant');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ip');
  });

  it('should create attribute', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleAttrRow], rowCount: 1 });
    const result = await repo.createAttribute({
      tenantId: 'test-tenant', ciTypeId: 's-1', name: 'ip', displayName: 'IP Address',
      dataType: 'string', required: true,
    } as any);
    expect(result.id).toBe('a-1');
  });
});
