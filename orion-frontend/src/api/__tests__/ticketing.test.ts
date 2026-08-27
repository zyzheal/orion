import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTicket, getTicket, getTickets, updateTicket, deleteTicket,
  transitionStatus, assignTicket, closeTicket, getWorkflowHistory,
  addAssignmentRule, getAssignmentRules } from '../ticketing';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('Ticketing API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should create ticket', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createTicket({ title: 'test ticket', description: 'd', priority: 'P1' });
    expect(api.post).toHaveBeenCalledWith('/tickets', { title: 'test ticket', description: 'd', priority: 'P1' });
  });

  it('should get ticket by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getTicket('1');
    expect(api.get).toHaveBeenCalledWith('/tickets/1');
  });

  it('should list tickets', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], total: 0 }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getTickets({ status: 'open' });
    expect(api.get).toHaveBeenCalledWith('/tickets', { params: { status: 'open' } });
  });

  it('should update ticket', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updateTicket('1', { title: 'updated' });
    expect(api.put).toHaveBeenCalledWith('/tickets/1', { title: 'updated' });
  });

  it('should delete ticket', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteTicket('1');
    expect(api.delete).toHaveBeenCalledWith('/tickets/1');
  });

  it('should transition ticket status', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: {} }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await transitionStatus('1', { toStatus: 'resolved' as any, performedBy: 'user-1' });
    expect(api.post).toHaveBeenCalledWith('/tickets/1/transition', { toStatus: 'resolved', performedBy: 'user-1' });
  });

  it('should close ticket', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: {} }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await closeTicket('1', 'resolved');
    expect(api.post).toHaveBeenCalledWith('/tickets/1/close', { reason: 'resolved' });
  });

  it('should get workflow history', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getWorkflowHistory('1');
    expect(api.get).toHaveBeenCalledWith('/tickets/1/history');
  });

  it('should add assignment rule', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'r-1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await addAssignmentRule({ name: 'rule', pattern: 'P1' });
    expect(api.post).toHaveBeenCalledWith('/ticketing/rules', { name: 'rule', pattern: 'P1' });
  });

  it('should get assignment rules', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAssignmentRules();
    expect(api.get).toHaveBeenCalledWith('/ticketing/rules');
  });
});
