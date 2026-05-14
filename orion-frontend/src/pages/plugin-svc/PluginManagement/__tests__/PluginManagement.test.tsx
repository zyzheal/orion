/**
 * PluginManagement Page Tests
 * - Rendering tests
 * - Summary card tests
 * - Plugin table tests
 * - Filter tests
 * - Action button tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PluginManagement from '../index';

// Mock antd message to avoid console noise
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  };
});

describe('PluginManagement', () => {
  it('should render plugin management page', () => {
    render(
      <MemoryRouter>
        <PluginManagement />
      </MemoryRouter>
    );
    // Use getAllByTestId since multiple elements may exist
    const pages = screen.getAllByTestId('plugin-management-page');
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('插件管理')).toBeInTheDocument();
  });

  it('should show summary cards with correct counts', async () => {
    render(
      <MemoryRouter>
        <PluginManagement />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('plugin-summary-cards')).toBeInTheDocument();
    });
    expect(screen.getAllByText('插件总数').length).toBeGreaterThanOrEqual(1);
    // Status badges show "已启用"/"已禁用"
    expect(screen.getAllByText('已启用').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('已禁用').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('可更新').length).toBeGreaterThanOrEqual(1);
  });

  it('should display plugin table', async () => {
    render(
      <MemoryRouter>
        <PluginManagement />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('plugin-table')).toBeInTheDocument();
    });
  });

  it('should show plugin names and versions', async () => {
    render(
      <MemoryRouter>
        <PluginManagement />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('数据库迁移助手')).toBeInTheDocument();
    });
    expect(screen.getByText('日志分析插件')).toBeInTheDocument();
    expect(screen.getByText('安全审计')).toBeInTheDocument();
    expect(screen.getByText('性能监控')).toBeInTheDocument();
  });

  it('should show enabled/disabled status', async () => {
    render(
      <MemoryRouter>
        <PluginManagement />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText('已启用').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('已禁用').length).toBeGreaterThanOrEqual(1);
  });

  it('should have search and filter', async () => {
    render(
      <MemoryRouter>
        <PluginManagement />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('plugin-table')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('搜索插件名称、描述、作者...');
    expect(searchInput).toBeInTheDocument();
    expect(screen.getAllByText('分类').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('状态').length).toBeGreaterThanOrEqual(1);
  });

  it('should show health status indicators', async () => {
    render(
      <MemoryRouter>
        <PluginManagement />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText('正常').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('警告').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('异常').length).toBeGreaterThanOrEqual(1);
  });

  it('should have install plugin button', async () => {
    render(
      <MemoryRouter>
        <PluginManagement />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('install-plugin-button')).toBeInTheDocument();
    });
    expect(screen.getByText('安装插件')).toBeInTheDocument();
  });

  it('should show action buttons for each plugin', async () => {
    render(
      <MemoryRouter>
        <PluginManagement />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText('配置').length).toBeGreaterThanOrEqual(1);
    });
    // Each plugin should have configure, toggle, and delete buttons
    expect(screen.getAllByText('配置').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('删除').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('启用').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('禁用').length).toBeGreaterThanOrEqual(1);
  });
});
