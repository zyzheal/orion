import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCIs, getCI, createCI, updateCI, deleteCI, getCIRelations, createRelation, deleteRelation, getTopology } from '../cmdb';
import client from '../client';

vi.mock('../client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

const mockedClient = client as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

describe('CMDB API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should list CIs', async () => {
    vi.mocked(mockedClient.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getCIs();
    expect(mockedClient.get).toHaveBeenCalledWith('/cmdb/cis', { params: undefined });
  });

  it('should get CI by id', async () => {
    vi.mocked(mockedClient.get).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getCI('1');
    expect(mockedClient.get).toHaveBeenCalledWith('/cmdb/cis/1');
  });

  it('should create CI', async () => {
    vi.mocked(mockedClient.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createCI({ name: 'server-01', type: 'host' });
    expect(mockedClient.post).toHaveBeenCalledWith('/cmdb/cis', { name: 'server-01', type: 'host' });
  });

  it('should update CI', async () => {
    vi.mocked(mockedClient.put).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updateCI('1', { name: 'server-02' });
    expect(mockedClient.put).toHaveBeenCalledWith('/cmdb/cis/1', { name: 'server-02' });
  });

  it('should delete CI', async () => {
    vi.mocked(mockedClient.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteCI('1');
    expect(mockedClient.delete).toHaveBeenCalledWith('/cmdb/cis/1');
  });

  it('should get CI relations', async () => {
    vi.mocked(mockedClient.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getCIRelations('1');
    expect(mockedClient.get).toHaveBeenCalledWith('/cmdb/cis/1/relations');
  });

  it('should create relation', async () => {
    vi.mocked(mockedClient.post).mockResolvedValue({ data: { data: { id: 'r1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createRelation({ sourceId: '1', targetId: '2', type: 'deploys_to' });
    expect(mockedClient.post).toHaveBeenCalledWith('/cmdb/relations', { sourceId: '1', targetId: '2', type: 'deploys_to' });
  });

  it('should delete relation', async () => {
    vi.mocked(mockedClient.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteRelation('r1');
    expect(mockedClient.delete).toHaveBeenCalledWith('/cmdb/relations/r1');
  });

  it('should get topology', async () => {
    vi.mocked(mockedClient.get).mockResolvedValue({ data: { data: { nodes: [], edges: [] } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getTopology();
    expect(mockedClient.get).toHaveBeenCalledWith('/cmdb/topology', { params: undefined });
  });
});
