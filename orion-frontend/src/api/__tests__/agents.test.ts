import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAgentProfiles, createAgentProfile, updateAgentProfile, deleteAgentProfile, toggleAgentProfile, getAgentRuns, getAgentRun, triggerAgentRun, cancelAgentRun, retryAgentRun } from '../agents';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('Agents API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should list agent profiles', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAgentProfiles();
    expect(api.get).toHaveBeenCalledWith('/agents');
  });

  it('should create agent profile', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createAgentProfile({ name: 'builder', role: 'builder', enabled: true });
    expect(api.post).toHaveBeenCalledWith('/agents', { name: 'builder', role: 'builder', enabled: true });
  });

  it('should update agent profile', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updateAgentProfile('1', { name: 'updated' });
    expect(api.put).toHaveBeenCalledWith('/agents/1', { name: 'updated' });
  });

  it('should delete agent profile', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteAgentProfile('1');
    expect(api.delete).toHaveBeenCalledWith('/agents/1');
  });

  it('should toggle agent profile', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await toggleAgentProfile('1');
    expect(api.patch).toHaveBeenCalledWith('/agents/1/toggle');
  });

  it('should list agent runs', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAgentRuns();
    expect(api.get).toHaveBeenCalledWith('/agent-runs', { params: undefined });
  });

  it('should get agent run by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: 'r1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAgentRun('r1');
    expect(api.get).toHaveBeenCalledWith('/agent-runs/r1');
  });

  it('should trigger agent run', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'r1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await triggerAgentRun({ agentId: '1', context: { taskId: 't1' } });
    expect(api.post).toHaveBeenCalledWith('/agent-runs', { agentId: '1', context: { taskId: 't1' } });
  });

  it('should cancel agent run', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await cancelAgentRun('r1');
    expect(api.post).toHaveBeenCalledWith('/agent-runs/r1/cancel');
  });

  it('should retry agent run', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'r2' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await retryAgentRun('r1');
    expect(api.post).toHaveBeenCalledWith('/agent-runs/r1/retry');
  });
});
