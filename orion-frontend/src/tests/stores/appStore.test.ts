import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/appStore';

describe('appStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useAppStore.setState({
      theme: 'light',
      sidebarCollapsed: false,
      breadcrumbs: [],
      tabs: [],
    });
  });

  it('should initialize with default state', () => {
    const state = useAppStore.getState();
    expect(state.theme).toBe('light');
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.breadcrumbs).toEqual([]);
    expect(state.tabs).toEqual([]);
  });

  it('should set theme', () => {
    useAppStore.getState().setTheme('dark');
    expect(useAppStore.getState().theme).toBe('dark');

    useAppStore.getState().setTheme('light');
    expect(useAppStore.getState().theme).toBe('light');
  });

  it('should set sidebar collapsed', () => {
    useAppStore.getState().setSidebarCollapsed(true);
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);

    useAppStore.getState().setSidebarCollapsed(false);
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });

  it('should set breadcrumbs', () => {
    const breadcrumbs = [
      { title: '首页', path: '/' },
      { title: '项目管理', path: '/projects' },
    ];

    useAppStore.getState().setBreadcrumbs(breadcrumbs);
    expect(useAppStore.getState().breadcrumbs).toEqual(breadcrumbs);
  });

  it('should add tab', () => {
    useAppStore.getState().addTab('projects', '项目管理', '/projects');
    expect(useAppStore.getState().tabs).toHaveLength(1);
    expect(useAppStore.getState().tabs[0]).toEqual({
      key: 'projects',
      title: '项目管理',
      path: '/projects',
      active: true,
    });
  });

  it('should remove tab', () => {
    useAppStore.getState().addTab('projects', '项目管理', '/projects');
    useAppStore.getState().addTab('settings', '系统设置', '/settings');

    useAppStore.getState().removeTab('projects');
    expect(useAppStore.getState().tabs).toHaveLength(1);
    expect(useAppStore.getState().tabs[0].key).toBe('settings');
  });

  it('should set active tab', () => {
    useAppStore.getState().addTab('projects', '项目管理', '/projects');
    useAppStore.getState().addTab('settings', '系统设置', '/settings');

    useAppStore.getState().setActiveTab('projects');
    const tabs = useAppStore.getState().tabs;
    expect(tabs.find((t) => t.key === 'projects')?.active).toBe(true);
    expect(tabs.find((t) => t.key === 'settings')?.active).toBe(false);
  });
});
