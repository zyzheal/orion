import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startMonitoring, stopMonitoring, getMonitoringHealth, getMetrics,
  recordMetric, getAlertRules, createAlertRule, deleteAlertRule,
  getAlerts, getActiveAlerts, getAlert, acknowledgeAlert } from '../monitoring';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('Monitoring API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should start monitoring', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { status: 'started' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await startMonitoring();
    expect(api.post).toHaveBeenCalledWith('/monitoring/start');
  });

  it('should stop monitoring', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { status: 'stopped' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await stopMonitoring();
    expect(api.post).toHaveBeenCalledWith('/monitoring/stop');
  });

  it('should get monitoring health', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { status: 'healthy' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getMonitoringHealth();
    expect(api.get).toHaveBeenCalledWith('/monitoring/health');
  });

  it('should list metrics', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getMetrics({ tags: 'env:prod' });
    expect(api.get).toHaveBeenCalledWith('/monitoring/metrics', { params: { tags: 'env:prod' } });
  });

  it('should record a metric', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { recorded: true } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await recordMetric({ name: 'cpu_usage', value: 75.5 });
    expect(api.post).toHaveBeenCalledWith('/monitoring/metrics', { name: 'cpu_usage', value: 75.5 });
  });

  it('should list alert rules', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAlertRules();
    expect(api.get).toHaveBeenCalledWith('/monitoring/rules');
  });

  it('should create alert rule', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'r-1' } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createAlertRule({ name: 'high cpu', metric: 'cpu', condition: '>', threshold: 90, severity: 'critical', enabled: true });
    expect(api.post).toHaveBeenCalledWith('/monitoring/rules', { name: 'high cpu', metric: 'cpu', condition: '>', threshold: 90, severity: 'critical', enabled: true });
  });

  it('should delete alert rule', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { data: { deleted: true } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteAlertRule('r-1');
    expect(api.delete).toHaveBeenCalledWith('/monitoring/rules/r-1');
  });

  it('should list alerts', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAlerts({ status: 'active' });
    expect(api.get).toHaveBeenCalledWith('/monitoring/alerts', { params: { status: 'active' } });
  });

  it('should get active alerts', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getActiveAlerts();
    expect(api.get).toHaveBeenCalledWith('/monitoring/alerts/active');
  });

  it('should acknowledge alert', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { acknowledged: true } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await acknowledgeAlert('a-1', { note: 'investigating' });
    expect(api.post).toHaveBeenCalledWith('/monitoring/alerts/a-1/acknowledge', { note: 'investigating' });
  });
});
