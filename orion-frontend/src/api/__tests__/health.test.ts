import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getHealthDashboard,
  getHealthScore,
  getServiceHealthList,
  getHealthAlerts,
  getHealthTrend,
} from '../health';
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

describe('Health API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get health dashboard', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        score: { score: 85, level: 'healthy', updatedAt: '2026-08-26T12:00:00Z' },
        activeAlerts: 0,
        avgLatencyMs: 45,
        errorRate: 0.001,
        services: [
          {
            serviceId: 'svc-1',
            serviceName: 'gateway',
            status: 'healthy',
            latencyMs: 12,
            errorRate: 0,
            uptimePercent: 99.99,
            lastChecked: '2026-08-26T12:00:00Z',
          },
        ],
        alerts: [],
        trend: [],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getHealthDashboard();
    expect(api.get).toHaveBeenCalledWith('/service-health/dashboard');
    expect(result.score.score).toBe(85);
    expect(result.score.level).toBe('healthy');
  });

  it('should get health score', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { score: 72, level: 'warning', updatedAt: '2026-08-26T12:00:00Z' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getHealthScore();
    expect(api.get).toHaveBeenCalledWith('/service-health/score');
    expect(result.score).toBe(72);
    expect(result.level).toBe('warning');
  });

  it('should get service health list', async () => {
    const mockServices = [
      {
        serviceId: 'svc-1',
        serviceName: 'gateway',
        status: 'healthy',
        latencyMs: 10,
        errorRate: 0,
        uptimePercent: 99.99,
        lastChecked: '2026-08-26T12:00:00Z',
      },
      {
        serviceId: 'svc-2',
        serviceName: 'auth',
        status: 'degraded',
        latencyMs: 250,
        errorRate: 0.05,
        uptimePercent: 98.5,
        lastChecked: '2026-08-26T12:00:00Z',
      },
    ];

    vi.mocked(api.get).mockResolvedValue({
      data: mockServices,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getServiceHealthList();
    expect(api.get).toHaveBeenCalledWith('/service-health/services');
    expect(result).toHaveLength(2);
    expect(result[1].serviceName).toBe('auth');
    expect(result[1].status).toBe('degraded');
  });

  it('should get health alerts without params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id: 'alert-1',
          serviceName: 'db',
          severity: 'critical',
          message: 'Connection pool exhausted',
          status: 'active',
          triggeredAt: '2026-08-26T11:50:00Z',
        },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getHealthAlerts();
    expect(api.get).toHaveBeenCalledWith('/service-health/alerts', { params: undefined });
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
  });

  it('should get health alerts with filters', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await getHealthAlerts({ status: 'active', limit: 10 });
    expect(api.get).toHaveBeenCalledWith('/service-health/alerts', {
      params: { status: 'active', limit: 10 },
    });
  });

  it('should get health trend without since', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { timestamp: '2026-08-26T11:00:00Z', healthScore: 80, errorRate: 0.01, latencyMs: 50 },
        { timestamp: '2026-08-26T12:00:00Z', healthScore: 85, errorRate: 0.001, latencyMs: 45 },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await getHealthTrend();
    expect(api.get).toHaveBeenCalledWith('/service-health/trend', { params: { since: undefined } });
    expect(result).toHaveLength(2);
  });

  it('should get health trend with since', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await getHealthTrend('2026-08-25T00:00:00Z');
    expect(api.get).toHaveBeenCalledWith('/service-health/trend', {
      params: { since: '2026-08-25T00:00:00Z' },
    });
  });
});
