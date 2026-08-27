import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWorkflowList, getWorkflow, createWorkflow, updateWorkflow, deleteWorkflow,
  executeWorkflow, getExecutionHistory, suspendWorkflow, resumeWorkflow } from '../workflow';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('Workflow API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should list workflows', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getWorkflowList({ status: 'active' });
    expect(api.get).toHaveBeenCalled();
    expect(api.get.mock.calls[0][0]).toMatch(/^\/workflows(\?|$)/);
  });

  it('should get workflow by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: '1', nodes: [], edges: [] } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getWorkflow('1');
    expect(api.get).toHaveBeenCalledWith('/workflows/1');
  });

  it('should create workflow', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createWorkflow({ name: 'test-workflow', steps: [] });
    expect(api.post).toHaveBeenCalledWith('/workflows', { name: 'test-workflow', steps: [] });
  });

  it('should update workflow', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updateWorkflow('1', { name: 'updated' });
    expect(api.put).toHaveBeenCalledWith('/workflows/1', { name: 'updated' });
  });

  it('should delete workflow', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteWorkflow('1');
    expect(api.delete).toHaveBeenCalledWith('/workflows/1');
  });

  it('should execute workflow', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'exec-1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await executeWorkflow('1', { triggeredBy: 'user' });
    expect(api.post).toHaveBeenCalledWith('/workflows/1/execute', { triggeredBy: 'user', initialInput: {} });
  });

  it('should get execution history', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getExecutionHistory('1');
    expect(api.get).toHaveBeenCalledWith('/workflows/1/executions');
  });

  it('should suspend workflow', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await suspendWorkflow('1');
    expect(api.post).toHaveBeenCalledWith('/workflows/1/pause');
  });

  it('should resume workflow', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await resumeWorkflow('1');
    expect(api.post).toHaveBeenCalledWith('/workflows/1/resume');
  });
});
