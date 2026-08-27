import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIncidents, getIncident, createIncident, updateIncident, deleteIncident,
  updateIncidentStatus, assignIncident, escalateIncident, getIncidentTimeline,
  getPostmortem, createPostmortem, getIncidentStats } from '../incident';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('Incident API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should list incidents', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], meta: { total: 0 } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getIncidents();
    expect(api.get).toHaveBeenCalledWith('/incidents', { params: undefined });
  });

  it('should get incident by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getIncident('1');
    expect(api.get).toHaveBeenCalledWith('/incidents/1');
  });

  it('should create incident', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createIncident({ title: 'test', type: 'outage', severity: 'critical' });
    expect(api.post).toHaveBeenCalledWith('/incidents', { title: 'test', type: 'outage', severity: 'critical' });
  });

  it('should update incident', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updateIncident('1', { title: 'updated' });
    expect(api.put).toHaveBeenCalledWith('/incidents/1', { title: 'updated' });
  });

  it('should delete incident', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteIncident('1');
    expect(api.delete).toHaveBeenCalledWith('/incidents/1');
  });

  it('should update incident status', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updateIncidentStatus('1', 'acknowledged');
    expect(api.patch).toHaveBeenCalledWith('/incidents/1/status', { status: 'acknowledged', note: undefined });
  });

  it('should assign incident', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await assignIncident('1', 'user-1');
    expect(api.patch).toHaveBeenCalledWith('/incidents/1/assign', { commander_id: 'user-1' });
  });

  it('should escalate incident', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: {} }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await escalateIncident('1', { to_level: 2, reason: 'P1 breach' });
    expect(api.post).toHaveBeenCalledWith('/incidents/1/escalate', { to_level: 2, reason: 'P1 breach' });
  });

  it('should get incident timeline', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getIncidentTimeline('1');
    expect(api.get).toHaveBeenCalledWith('/incidents/1/timeline');
  });

  it('should create postmortem', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'pm-1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createPostmortem('1', { title: 'PM', summary: 's', root_cause: 'rc' });
    expect(api.post).toHaveBeenCalledWith('/incidents/1/postmortem', { title: 'PM', summary: 's', root_cause: 'rc' });
  });

  it('should get incident stats', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { total: 10 } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getIncidentStats();
    expect(api.get).toHaveBeenCalledWith('/incidents/stats');
  });
});
