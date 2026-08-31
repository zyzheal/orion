import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAlerts, getAlert, createAlert, getActiveAlerts, getAlertRules, createAlertRule, deleteAlertRule, getAlertStats } from '../alerts';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('Alerts API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should list alerts', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAlerts();
    expect(api.get).toHaveBeenCalledWith('/alert/list', { params: undefined });
  });

  it('should get alert by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: '1' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAlert('1');
    expect(api.get).toHaveBeenCalledWith('/alert/1');
  });

  it('should create alert', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: '1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createAlert({ severity: 'critical', metric: 'cpu', value: 97, threshold: 90, message: 'high cpu' });
    expect(api.post).toHaveBeenCalledWith('/alert/ingest', { severity: 'critical', metric: 'cpu', value: 97, threshold: 90, message: 'high cpu' });
  });

  it('should get active alerts', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getActiveAlerts();
    expect(api.get).toHaveBeenCalledWith('/alert/list', { params: { status: 'active' } });
  });

  it('should get alert rules', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAlertRules();
    expect(api.get).toHaveBeenCalledWith('/monitoring/rules');
  });

  it('should create alert rule', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'r1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createAlertRule({ name: 'high-cpu', metric: 'cpu', condition: '>', threshold: 90, severity: 'warning' });
    expect(api.post).toHaveBeenCalledWith('/monitoring/rules', { name: 'high-cpu', metric: 'cpu', condition: '>', threshold: 90, severity: 'warning' });
  });

  it('should delete alert rule', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteAlertRule('r1');
    expect(api.delete).toHaveBeenCalledWith('/monitoring/rules/r1');
  });

  it('should get alert stats', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { total: 5 } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAlertStats();
    expect(api.get).toHaveBeenCalledWith('/alert/deduplication/stats');
  });
});
