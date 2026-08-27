import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAIRequest, getScenarioHealth, getAllHealth, getGatewayStatus, getRules, getConfig, updateConfig } from '../ai-gateway';
import { api } from '../client';

vi.mock('../client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

describe('AI Gateway API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should execute AI request', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { result: 'ok' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await executeAIRequest({ scenario: 'code_review', input: { code: 'x=1' } });
    expect(api.post).toHaveBeenCalledWith('/ai-gateway/execute', { scenario: 'code_review', input: { code: 'x=1' } });
  });

  it('should get scenario health', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { status: 'healthy' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getScenarioHealth('code_review');
    expect(api.get).toHaveBeenCalledWith('/ai-gateway/health/code_review');
  });

  it('should get all health', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: {} }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getAllHealth();
    expect(api.get).toHaveBeenCalledWith('/ai-gateway/health/all');
  });

  it('should get gateway status', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { version: '1.0' } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getGatewayStatus();
    expect(api.get).toHaveBeenCalledWith('/ai-gateway/status');
  });

  it('should get rules', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getRules();
    expect(api.get).toHaveBeenCalledWith('/ai-gateway/rules');
  });

  it('should get config', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: {} }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getConfig();
    expect(api.get).toHaveBeenCalledWith('/ai-gateway/config');
  });

  it('should update config', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updateConfig({ timeout: 30 });
    expect(api.put).toHaveBeenCalledWith('/ai-gateway/config', { timeout: 30 });
  });
});
