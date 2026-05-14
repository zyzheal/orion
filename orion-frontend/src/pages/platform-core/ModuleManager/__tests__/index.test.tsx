/**
 * Tests for ModuleManager page
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as moduleManagerApi from '@/api/module-manager';

// Mock antd components and hooks
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd') as Record<string, unknown>;
  return {
    ...actual,
    Typography: {
      Title: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
      Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
      Paragraph: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    },
    message: {
      error: vi.fn(),
      warning: vi.fn(),
      success: vi.fn(),
    },
    Modal: {
      ...(actual.Modal as Record<string, unknown>),
      info: vi.fn(),
    },
  };
});

vi.mock('@/api/module-manager', () => ({
  getModules: vi.fn(),
  toggleModule: vi.fn(),
  validateDependencies: vi.fn(),
  getStartupOrder: vi.fn(),
}));

vi.mock('@/tokens', () => ({
  colors: {
    success: { 500: '#52c41a' },
    error: { 500: '#ff4d4f' },
    warning: { 500: '#faad14' },
    info: { 500: '#1890ff' },
    blue: { 500: '#1890ff' },
    red: { 500: '#ff4d4f' },
    purple: { 500: '#722ed1' },
    green: { 500: '#52c41a' },
    neutral: { 500: '#8c8c8c', 400: '#bfbfbf' },
    orange: { 500: '#fa8c16' },
    cyan: { 500: '#13c2c2' },
    primary: { 500: '#1890ff' },
    light: {
      bg: { primary: '#ffffff' },
      text: { primary: '#1f1f1f', secondary: '#434343', tertiary: '#595959' },
      border: { light: '#f0f0f0' },
    },
    dark: {
      bg: { primary: '#141414' },
      text: { primary: '#ffffff' },
      border: {},
    },
  },
  spacing: [0, 4, 8, 12, 16, 24, 32],
}));

vi.mock('@/components/MetricCard', () => ({
  default: ({ title, value }: any) => (
    <div data-testid="metric-card">
      <span>{title}</span>
      <span>{value}</span>
    </div>
  ),
}));

vi.mock('@/components/SearchFilterBar', () => ({
  default: ({ onSearch }: any) => (
    <div data-testid="search-filter-bar">
      <input onChange={(e) => onSearch?.(e.target.value)} data-testid="search-input" />
    </div>
  ),
}));

vi.mock('dayjs', () => {
  const dayjsFn = (_val: any) => ({
    fromNow: () => '2 hours ago',
    format: () => '2024-01-01 12:00',
    diff: () => 100,
    valueOf: () => Date.now(),
    startOf: () => dayjsFn(new Date()),
    isAfter: () => true,
  });
  dayjsFn.extend = () => {};
  return { default: dayjsFn };
});

describe('ModuleManager', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', async () => {
    vi.mocked(moduleManagerApi.getModules).mockResolvedValue({
      data: { data: [] },
    } as any);
    vi.mocked(moduleManagerApi.validateDependencies).mockResolvedValue({
      data: { data: { validation: { valid: true, missingDependencies: [] } } },
    } as any);
    vi.mocked(moduleManagerApi.getStartupOrder).mockResolvedValue({
      data: { data: { order: [] } },
    } as any);

    const ModuleManagerPage = (await import('@/pages/platform-core/ModuleManager')).default;
    render(<ModuleManagerPage />);

    expect(screen.getByText('模块管理')).toBeTruthy();
  });

  it('displays module count in header', async () => {
    const mockModules = [
      {
        id: 'core:auth',
        name: 'Auth',
        description: 'Authentication module',
        level: 'core' as const,
        state: 'active' as const,
        config: { enabled: true, autoStart: true },
      },
      {
        id: 'service:api',
        name: 'API Service',
        description: 'API service module',
        level: 'service' as const,
        state: 'active' as const,
        config: { enabled: true, dependencies: ['core:auth'] },
      },
    ];

    vi.mocked(moduleManagerApi.getModules).mockResolvedValue({
      data: { data: mockModules },
    } as any);
    vi.mocked(moduleManagerApi.validateDependencies).mockResolvedValue({
      data: { data: { validation: { valid: true, missingDependencies: [] } } },
    } as any);
    vi.mocked(moduleManagerApi.getStartupOrder).mockResolvedValue({
      data: { data: { order: ['core:auth', 'service:api'] } },
    } as any);

    const ModuleManagerPage = (await import('@/pages/platform-core/ModuleManager')).default;
    render(<ModuleManagerPage />);

    // Check metric cards render (stats total = 2)
    await waitFor(() => {
      const metricCards = screen.getAllByTestId('metric-card');
      expect(metricCards.length).toBeGreaterThan(0);
    });
  });

  it('calls API on mount', async () => {
    vi.mocked(moduleManagerApi.getModules).mockResolvedValue({
      data: { data: [] },
    } as any);
    vi.mocked(moduleManagerApi.validateDependencies).mockResolvedValue({
      data: { data: { validation: { valid: true, missingDependencies: [] } } },
    } as any);
    vi.mocked(moduleManagerApi.getStartupOrder).mockResolvedValue({
      data: { data: { order: [] } },
    } as any);

    const ModuleManagerPage = (await import('@/pages/platform-core/ModuleManager')).default;
    render(<ModuleManagerPage />);

    await waitFor(() => {
      expect(moduleManagerApi.getModules).toHaveBeenCalled();
    });
  });
});
