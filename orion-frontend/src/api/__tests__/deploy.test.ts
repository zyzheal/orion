import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDeployDeploy,
  getDeploy,
  listDeploy,
  createDeployDeployRollback,
  createDeployDeployCancel,
  getReleaseNotes,
  generateReleaseNotes,
  getReleaseNotesByTenant,
} from '../deploy';
import { api } from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Deploy API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a deployment', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 'd1', name: 'deploy-1', status: 'pending' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await createDeployDeploy({ name: 'deploy-1' });
    expect(api.post).toHaveBeenCalledWith('/deploy/deploy', { name: 'deploy-1' });
    expect(result.id).toBe('d1');
  });

  it('should get a deployment by ID', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { id: 'd1', name: 'deploy-1', status: 'running' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getDeploy('d1');
    expect(api.get).toHaveBeenCalledWith('/deploy/deploy/d1');
    expect(result.id).toBe('d1');
    expect(result.status).toBe('running');
  });

  it('should list deployments without params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [{ id: 'd1' }, { id: 'd2' }], total: 2 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await listDeploy();
    expect(api.get).toHaveBeenCalledWith('/deploy/deploy/history', { params: undefined });
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should list deployments with params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [], total: 0 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await listDeploy({ status: 'success', limit: 10 });
    expect(api.get).toHaveBeenCalledWith('/deploy/deploy/history', {
      params: { status: 'success', limit: 10 },
    });
  });

  it('should create a rollback deployment', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 'd2', name: 'deploy-1-rollback', status: 'pending' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await createDeployDeployRollback('d1', { reason: 'bug fix' });
    expect(api.post).toHaveBeenCalledWith('/deploy/deploy/d1/rollback', {
      reason: 'bug fix',
    });
    expect(result.id).toBe('d2');
  });

  it('should cancel a deployment', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 'd1', status: 'cancelled' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await createDeployDeployCancel('d1', {});
    expect(api.post).toHaveBeenCalledWith('/deploy/deploy/d1/cancel', {});
    expect(result.status).toBe('cancelled');
  });

  it('should get release notes', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 'rn1',
        deploymentId: 'd1',
        version: 'v1.0.0',
        environment: 'production',
        generatedAt: '2026-08-26T12:00:00Z',
        summary: 'Initial release',
        changes: [],
        metrics: {
          totalCommits: 10,
          totalChanges: 5,
          breakingChanges: 0,
          features: 3,
          fixes: 2,
          improvements: 0,
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getReleaseNotes('d1');
    expect(api.get).toHaveBeenCalledWith('/deploy/d1/release-notes');
    expect(result!.version).toBe('v1.0.0');
  });

  it('should generate release notes', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'rn2',
        deploymentId: 'd1',
        version: 'v1.1.0',
        changes: [{ type: 'feature', description: 'New endpoint', commit: 'abc123', author: 'dev' }],
        metrics: { totalCommits: 5, totalChanges: 1, breakingChanges: 0, features: 1, fixes: 0, improvements: 0 },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await generateReleaseNotes('d1', { fromCommit: 'abc', toCommit: 'def' });
    expect(api.post).toHaveBeenCalledWith('/deploy/d1/release-notes/generate', {
      fromCommit: 'abc',
      toCommit: 'def',
    });
    expect(result.changes).toHaveLength(1);
  });

  it('should get release notes by tenant with default limit', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [{ id: 'rn1' }], total: 1, limit: 50 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getReleaseNotesByTenant('t1');
    expect(api.get).toHaveBeenCalledWith('/deploy/release-notes/tenant/t1', {
      params: { limit: '50' },
    });
    expect(result.total).toBe(1);
  });

  it('should get release notes by tenant with custom limit', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [], total: 0, limit: 10 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await getReleaseNotesByTenant('t2', 10);
    expect(api.get).toHaveBeenCalledWith('/deploy/release-notes/tenant/t2', {
      params: { limit: '10' },
    });
  });
});
