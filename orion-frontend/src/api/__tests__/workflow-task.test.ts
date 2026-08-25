import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTasks, getTask, claimTask, completeTask } from '../workflow-task';
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

const mockTask = {
  id: 'wt-1',
  instance_id: 'inst-1',
  node_id: 'n1',
  task_type: 'manual' as const,
  assignee_type: 'user' as const,
  title: 'Review PR',
  status: 'pending' as const,
  priority: 'normal' as const,
  created_at: '2026-08-26T12:00:00Z',
  updated_at: '2026-08-26T12:00:00Z',
};

describe('WorkflowTask API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get tasks without params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: [mockTask],
        pagination: { total: 1, limit: 20, offset: 0 },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getTasks();
    expect(api.get).toHaveBeenCalledWith('/workflow-tasks');
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('should get tasks with query params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: [],
        pagination: { total: 0, limit: 10, offset: 0 },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await getTasks({ assigneeId: 'u1', status: 'pending', limit: 10, offset: 0 });
    expect(api.get).toHaveBeenCalledWith('/workflow-tasks?assigneeId=u1&status=pending&limit=10');
  });

  it('should get a single task', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: mockTask,
        message: 'OK',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getTask('wt-1');
    expect(api.get).toHaveBeenCalledWith('/workflow-tasks/wt-1');
    expect(result.id).toBe('wt-1');
    expect(result.title).toBe('Review PR');
  });

  it('should claim a task', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: { ...mockTask, status: 'assigned' as const, assignee_id: 'u1' },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await claimTask('wt-1', { comment: 'I will handle this' });
    expect(api.post).toHaveBeenCalledWith('/workflow-tasks/wt-1/claim', {
      comment: 'I will handle this',
    });
    expect(result.status).toBe('assigned');
  });

  it('should claim a task without data', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: { ...mockTask, status: 'assigned' as const },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await claimTask('wt-2');
    expect(api.post).toHaveBeenCalledWith('/workflow-tasks/wt-2/claim', undefined);
  });

  it('should complete a task with comment and form data', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: { ...mockTask, status: 'completed' as const, completed_by: 'u1' },
        warning: 'This is the final approval',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await completeTask('wt-1', {
      comment: 'Approved',
      formData: { approved: true },
    });
    expect(api.post).toHaveBeenCalledWith('/workflow-tasks/wt-1/complete', {
      comment: 'Approved',
      formData: { approved: true },
    });
    expect(result.task.status).toBe('completed');
    expect(result.warning).toBe('This is the final approval');
  });

  it('should complete a task without data', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: { ...mockTask, status: 'completed' as const },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await completeTask('wt-3');
    expect(api.post).toHaveBeenCalledWith('/workflow-tasks/wt-3/complete', undefined);
  });
});
