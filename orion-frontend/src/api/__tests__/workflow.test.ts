import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorkflowList,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
  getExecutionHistory,
  getExecutionDetail,
  suspendWorkflow,
  resumeWorkflow,
  terminateWorkflow,
} from '../workflow';
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

const mockWorkflow = {
  id: 'wf-1',
  tenantId: 't1',
  name: 'Approval Flow',
  description: 'Standard approval',
  version: 1,
  enabled: true,
  nodes: [],
  edges: [],
  createdBy: 'admin',
  createdAt: '2026-08-26T12:00:00Z',
  updatedAt: '2026-08-26T12:00:00Z',
};

describe('Workflow API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get workflow list without params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [mockWorkflow] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getWorkflowList();
    expect(api.get).toHaveBeenCalledWith('/workflows');
    expect(result).toHaveLength(1);
  });

  it('should get workflow list with params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await getWorkflowList({ status: 'active', domain: 'payments', limit: 20 });
    expect(api.get).toHaveBeenCalledWith('/workflows?status=active&domain=payments&limit=20');
  });

  it('should get a workflow by ID', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: mockWorkflow,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getWorkflow('wf-1');
    expect(api.get).toHaveBeenCalledWith('/workflows/wf-1');
    expect(result.name).toBe('Approval Flow');
  });

  it('should create a workflow', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { ...mockWorkflow, id: 'wf-new' },
      status: 201,
      statusText: 'Created',
      headers: {},
      config: {},
    } as any);

    const result = await createWorkflow({
      name: 'New Flow',
      description: 'A new workflow',
      steps: [{ id: 's1', type: 'approval', name: 'Approve', config: {} }],
    });
    expect(api.post).toHaveBeenCalledWith('/workflows', {
      name: 'New Flow',
      description: 'A new workflow',
      steps: [{ id: 's1', type: 'approval', name: 'Approve', config: {} }],
    });
    expect(result.id).toBe('wf-new');
  });

  it('should update a workflow', async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: { ...mockWorkflow, name: 'Updated Flow', version: 2 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await updateWorkflow('wf-1', { name: 'Updated Flow', enabled: true });
    expect(api.put).toHaveBeenCalledWith('/workflows/wf-1', {
      name: 'Updated Flow',
      enabled: true,
    });
    expect(result.version).toBe(2);
  });

  it('should delete a workflow', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await deleteWorkflow('wf-1');
    expect(api.delete).toHaveBeenCalledWith('/workflows/wf-1');
  });

  it('should execute a workflow with defaults', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'exec-1',
        workflowId: 'wf-1',
        status: 'running',
        triggeredBy: 'system',
        input: {},
        history: [],
        createdAt: '2026-08-26T12:00:00Z',
        updatedAt: '2026-08-26T12:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await executeWorkflow('wf-1');
    expect(api.post).toHaveBeenCalledWith('/workflows/wf-1/execute', {
      triggeredBy: 'system',
      initialInput: {},
    });
    expect(result.status).toBe('running');
  });

  it('should execute a workflow with custom input', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 'exec-2', status: 'running' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await executeWorkflow('wf-1', {
      triggeredBy: 'admin',
      initialInput: { amount: 100 },
    });
    expect(api.post).toHaveBeenCalledWith('/workflows/wf-1/execute', {
      triggeredBy: 'admin',
      initialInput: { amount: 100 },
    });
  });

  it('should get execution history', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [
          { id: 'exec-1', workflowId: 'wf-1', status: 'completed' },
          { id: 'exec-2', workflowId: 'wf-1', status: 'failed' },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getExecutionHistory('wf-1');
    expect(api.get).toHaveBeenCalledWith('/workflows/wf-1/executions');
    expect(result).toHaveLength(2);
  });

  it('should get execution detail', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { id: 'exec-1', status: 'completed', output: { result: 'ok' } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getExecutionDetail('exec-1');
    expect(api.get).toHaveBeenCalledWith('/workflows/executions/exec-1');
    expect(result.output).toEqual({ result: 'ok' });
  });

  it('should suspend a workflow', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { ...mockWorkflow, enabled: false },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await suspendWorkflow('wf-1');
    expect(api.post).toHaveBeenCalledWith('/workflows/wf-1/pause');
    expect(result.enabled).toBe(false);
  });

  it('should resume a workflow', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { ...mockWorkflow, enabled: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await resumeWorkflow('wf-1');
    expect(api.post).toHaveBeenCalledWith('/workflows/wf-1/resume');
    expect(result.enabled).toBe(true);
  });

  it('should terminate a workflow (stub)', async () => {
    await terminateWorkflow('wf-1');
    // No API call expected - stub implementation
    expect(api.delete).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});
