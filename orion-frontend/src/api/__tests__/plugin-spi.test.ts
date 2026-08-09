/**
 * Plugin SPI API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSPIStats,
  getExtensionPoints,
  getPluginRegistrations,
  getSPIConfigs,
} from '../plugin-spi';
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

describe('Plugin SPI API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get SPI stats', async () => {
    const mockResponse: any = {
      data: { totalPlugins: 12, enabledPlugins: 8, disabledPlugins: 3, errorPlugins: 1, activeExecutions: 5 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };
    vi.mocked(api.get).mockResolvedValue(mockResponse);
    const result = await getSPIStats();
    expect(api.get).toHaveBeenCalledWith('/api/v1/plugins-spi/stats');
    expect(result.totalPlugins).toBe(12);
  });

  it('should get extension points', async () => {
    const mockResponse: any = {
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };
    vi.mocked(api.get).mockResolvedValue(mockResponse);
    const result = await getExtensionPoints();
    expect(api.get).toHaveBeenCalledWith('/api/v1/plugins-spi/plugins');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should get plugin registrations', async () => {
    const mockResponse: any = {
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };
    vi.mocked(api.get).mockResolvedValue(mockResponse);
    const result = await getPluginRegistrations();
    expect(api.get).toHaveBeenCalledWith('/api/v1/plugins-spi/plugins');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should get SPI configs', async () => {
    const mockResponse: any = {
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };
    vi.mocked(api.get).mockResolvedValue(mockResponse);
    const result = await getSPIConfigs();
    expect(Array.isArray(result)).toBe(true);
  });
});
