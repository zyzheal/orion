import { create } from 'zustand';

interface AppState {
  // 主题
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  // 侧边栏
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // 面包屑
  breadcrumbs: Array<{ title: string; path?: string }>;
  setBreadcrumbs: (breadcrumbs: Array<{ title: string; path?: string }>) => void;

  // 标签页
  tabs: Array<{ key: string; title: string; path: string; active: boolean }>;
  addTab: (key: string, title: string, path: string) => void;
  removeTab: (key: string) => void;
  setActiveTab: (key: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  breadcrumbs: [],
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),

  tabs: [],
  addTab: (key, title, path) => {
    const tabs = get().tabs;
    const existingTab = tabs.find((tab) => tab.key === key);
    if (existingTab) {
      set({
        tabs: tabs.map((tab) => ({
          ...tab,
          active: tab.key === key,
        })),
      });
    } else {
      set({
        tabs: [
          ...tabs.map((tab) => ({ ...tab, active: false })),
          { key, title, path, active: true },
        ],
      });
    }
  },
  removeTab: (key) => {
    const tabs = get().tabs.filter((tab) => tab.key !== key);
    if (tabs.length > 0 && !tabs.some((tab) => tab.active)) {
      tabs[tabs.length - 1].active = true;
    }
    set({ tabs });
  },
  setActiveTab: (key) => {
    set({
      tabs: get().tabs.map((tab) => ({
        ...tab,
        active: tab.key === key,
      })),
    });
  },
}));
