/**
 * SubAppRoute 组件测试
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock orion-mf
vi.mock('@orion-mf/core', () => ({
  loadSubApp: vi.fn().mockResolvedValue(undefined),
  destroySubApp: vi.fn().mockResolvedValue(undefined),
  getSubApp: vi.fn(),
  getBridge: vi.fn().mockReturnValue({ loadSubApp: vi.fn(), destroy: vi.fn() }),
  setBridge: vi.fn(),
  SubAppRegistry: { getInstance: () => ({ register: vi.fn() }) },
  getSubAppRegistry: vi.fn().mockReturnValue({ register: vi.fn() }),
  EventBus: { getInstance: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn() }) },
  eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  MFSandboxBridge: vi.fn(),
  PreloadStrategy: { getInstance: () => ({ prefetch: vi.fn() }) },
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '/dba/some-path',
    search: '',
    hash: '',
    state: null,
    key: 'test-key',
  }),
  BrowserRouter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  Routes: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  Route: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock microfront/config (SubAppRoute imports from config, not index)
vi.mock('@/microfront/config', () => ({
  getSubAppConfig: (key: string) => {
    if (key === 'dba') {
      return {
        key: 'dba',
        name: '数据库管理',
        path: '/dba/*',
        url: 'http://localhost:3001/orion-dba',
        container: '#app-dba',
        enabled: true,
        keepAlive: true,
        preload: false,
      };
    }
    return undefined;
  },
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
  initMicroFrontend: vi.fn(),
  unloadSubApp: vi.fn(),
  injectGlobalState: vi.fn(),
  startSubApp: vi.fn().mockResolvedValue(undefined),
}));

// Mock app store
vi.mock('@/stores/appStore', () => ({
  useAppStore: () => ({
    theme: 'light' as const,
    setTheme: vi.fn(),
    breadcrumbs: [],
    setBreadcrumbs: vi.fn(),
  }),
}));

// Mock Loading component
vi.mock('@/components/Loading', () => ({
  Loading: ({ fullscreen }: { fullscreen?: boolean }) =>
    React.createElement(
      'div',
      { 'data-testid': 'loading', 'data-fullscreen': fullscreen },
      'Loading'
    ),
}));

describe('SubAppRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any created containers
    document.querySelectorAll('[id^="app-"]').forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render a container div when app key is determined', async () => {
    const SubAppRoute = (await import('@/components/SubAppRoute')).default;
    const { container } = render(React.createElement(SubAppRoute));

    await waitFor(() => {
      const containerDiv = container.querySelector('.sub-app-container');
      expect(containerDiv).toBeTruthy();
    });
  });

  it.skip('should create container with correct ID based on app key', async () => {
    const SubAppRoute = (await import('@/components/SubAppRoute')).default;
    const { container } = render(React.createElement(SubAppRoute));

    await waitFor(() => {
      const containerDiv = container.querySelector('[id="app-dba"]');
      expect(containerDiv).toBeTruthy();
    });
  });
});
