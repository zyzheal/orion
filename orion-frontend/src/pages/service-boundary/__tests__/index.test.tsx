import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/tests/render';
import ServiceBoundaryPage from '../index';

vi.mock('@/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
  API_BASE_URL: '/api/v1',
}));

import { api } from '@/api/client';

const mockedGet = vi.mocked(api.get);

const sampleModules = [
  { module: 'ai', references: 153, risk: 'high' as const, files: 218, lines: 23346, hasInterface: false },
  { module: 'middleware', references: 243, risk: 'low' as const, files: 0, lines: 0, hasInterface: true },
];

describe('ServiceBoundaryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('通过统一 api client 拉取模块耦合数据', async () => {
    mockedGet.mockResolvedValue({ data: sampleModules } as never);

    renderWithProviders(<ServiceBoundaryPage />);

    await vi.waitFor(() => {
      // 注意：无 query 参数时只传 URL —— 相对路径由 client.ts 拼接 baseURL
      expect(mockedGet).toHaveBeenCalledWith('/architecture/module-coupling');
    });
  });

  it('渲染模块总数与标题', async () => {
    mockedGet.mockResolvedValue({ data: sampleModules } as never);

    renderWithProviders(<ServiceBoundaryPage />);

    await vi.waitFor(() => {
      expect(screen.getByText('服务边界与模块耦合分析')).toBeDefined();
      expect(screen.getByText('ai')).toBeDefined();
    });
  });

  it('请求失败时回退到 FALLBACK_MODULES，不崩溃', async () => {
    mockedGet.mockRejectedValue(new Error('boom'));

    renderWithProviders(<ServiceBoundaryPage />);

    await vi.waitFor(() => {
      expect(screen.getByText('infrastructure')).toBeDefined();
    });
  });
});
