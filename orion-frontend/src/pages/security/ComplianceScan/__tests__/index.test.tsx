import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/tests/render';
import ComplianceScanPage from '../index';

vi.mock('@/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
  API_BASE_URL: '/api/v1',
}));

import { api } from '@/api/client';

const mockedGet = vi.mocked(api.get);

describe('ComplianceScanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('通过统一 api client 并发拉取 findings 与 baselines', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: [{ id: 'f1' }] } as never)
      .mockResolvedValueOnce({ data: [{ id: 'b1' }] } as never);

    renderWithProviders(<ComplianceScanPage />);

    await vi.waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith('/compliance/findings');
      expect(mockedGet).toHaveBeenCalledWith('/compliance/baselines');
    });
  });

  it('加载失败时展示提示，不静默吞掉错误', async () => {
    mockedGet.mockRejectedValue(new Error('boom'));

    renderWithProviders(<ComplianceScanPage />);

    await vi.waitFor(() => {
      expect(screen.getByText('安全合规检查')).toBeDefined();
      expect(screen.getByText('合规数据加载失败，显示默认状态')).toBeDefined();
    });
  });
});
