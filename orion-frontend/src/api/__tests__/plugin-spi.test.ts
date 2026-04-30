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
    vi.mocked(api.get).mockResolvedValue({ data: { stats: { totalExtensionPoints: 12, activePoints: 8, totalRegistrations: 34 } } });
    const result = await getSPIStats();
    expect(api.get).toHaveBeenCalledWith('/v1/plugin-spi/stats');
    expect(result.data.stats.activePoints).toBe(8);
  });

  it('should get extension points', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { extensionPoints: [] } });
    const result = await getExtensionPoints();
    expect(api.get).toHaveBeenCalledWith('/v1/plugin-spi/extension-points');
    expect(Array.isArray(result.data.extensionPoints)).toBe(true);
  });

  it('should get plugin registrations', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { registrations: [] } });
    const result = await getPluginRegistrations();
    expect(api.get).toHaveBeenCalledWith('/v1/plugin-spi/registrations');
    expect(Array.isArray(result.data.registrations)).toBe(true);
  });

  it('should get SPI configs', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { configs: [] } });
    const result = await getSPIConfigs();
    expect(api.get).toHaveBeenCalledWith('/v1/plugin-spi/configs');
    expect(Array.isArray(result.data.configs)).toBe(true);
  });
});
