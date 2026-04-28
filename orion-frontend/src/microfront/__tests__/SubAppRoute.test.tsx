/**
 * SubAppRoute 组件测试
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock wujie
vi.mock('wujie', () => ({
  startApp: vi.fn().mockResolvedValue(undefined),
  preloadApp: vi.fn(),
  setupApp: vi.fn(),
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

// Mock microfront
vi.mock('@/microfront', () => ({
  getSubAppConfig: (key: string) => {
    if (key === 'dba') {
      return {
        key: 'dba',
        name: '数据库管理',
        path: '/dba/*',
        url: 'http://localhost:3001/orion-dba',
        container: '#wujie-dba',
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
    document.querySelectorAll('[id^="wujie-"]').forEach((el) => el.remove());
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

  it('should create container with correct ID based on app key', async () => {
    const SubAppRoute = (await import('@/components/SubAppRoute')).default;
    const { container } = render(React.createElement(SubAppRoute));

    await waitFor(() => {
      const containerDiv = container.querySelector('#wujie-dba');
      expect(containerDiv).toBeTruthy();
    });
  });
});
