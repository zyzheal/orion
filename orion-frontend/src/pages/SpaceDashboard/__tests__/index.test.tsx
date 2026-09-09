/**
 * Tests for SpaceDashboard page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Page from '../index';
import type { SpaceData } from '../types';

// Mock the api client module entirely.
// SpaceDashboard 的 fetchSpaceData 直接调 api.get('/space-metrics')。
// 必须 mock 整个 '@/api/client' 模块，否则 axios 真实执行
// （无 MSW handler 时会打到真实网络，且 client.ts 默认带 3 次重试）。
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
  },
}));

vi.mock('@/api/client', () => ({ api: mockApi }));

const mockSpaceData: SpaceData = {
  satisfaction: { score: 82, surveyCount: 45, trend: 3 },
  performance: { buildSuccessRate: 95, avgBuildTime: 8.5, testPassRate: 98 },
  activity: { commits: 320, prs: 42, deployments: 12, linesChanged: 12500 },
  communication: { reviewTurnaround: 4.2, meetingRatio: 0.25 },
  efficiency: { leadTime: 1.8, mttr: 3.5, deploymentFrequency: 5.2 },
};

function renderPage() {
  return render(
    <BrowserRouter>
      <Page />
    </BrowserRouter>
  );
}

describe('SpaceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page with API data', async () => {
    mockApi.get.mockResolvedValue({ data: mockSpaceData });

    renderPage();

    // 页面 if (!data) return null，首帧为空；必须等 query resolve 后才渲染
    await waitFor(() => {
      expect(screen.getByText('SPACE 效能 Dashboard')).toBeTruthy();
    });
    expect(screen.getByText('开发者效能五维度模型 · 基于 SPACE 框架')).toBeTruthy();
    expect(mockApi.get).toHaveBeenCalledWith('/space-metrics', expect.anything());
  });

  it('renders metrics from API data', async () => {
    mockApi.get.mockResolvedValue({ data: mockSpaceData });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('82').length).toBeGreaterThan(0);
    });
    // 构建成功率 95（Statistic value 与 % suffix 分离渲染）
    expect(screen.getAllByText('95').length).toBeGreaterThan(0);
    // PR 数 42
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
  });

  it('falls back to default data when API fails', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));

    renderPage();

    // fetchSpaceData 内部 catch 后返回 getFallbackData()，页面仍能异步渲染
    await waitFor(() => {
      expect(screen.getByText('SPACE 效能 Dashboard')).toBeTruthy();
    });
    expect(screen.getAllByText('82').length).toBeGreaterThan(0);
  });
});
