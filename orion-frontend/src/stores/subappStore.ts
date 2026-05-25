/**
 * SubApp Store - Zustand store for sub-app configuration management
 *
 * Manages sub-application configurations with caching and optimistic updates
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ==================== Types ====================

export interface SubAppConfig {
  id: string;
  name: string;
  key: string;
  version: string;
  entry_dev: string;
  entry_prod: string;
  routes: string[];
  permissions: string[];
  keep_alive: boolean;
  preload: boolean;
  description: string | null;
  icon: string | null;
  api_domain: string | null;
  /** CSS isolation strategy: 'shadow-dom' for full isolation, 'scoped-css' for Ant Design compatibility */
  css_isolation: 'shadow-dom' | 'scoped-css' | 'none';
  /** Whether to share dependencies with the host app (default: false).
   * When true, the sub-app excludes shared deps (e.g., react) and loads from host at runtime.
   * Requires the sub-app to use the same framework version as the host. */
  use_shared: boolean;
  status: 'enabled' | 'disabled';
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubAppConfigHistory {
  id: string;
  subapp_key: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed';
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  changed_by: string | null;
  change_summary: string | null;
  created_at: string;
}

interface SubAppStore {
  // State
  apps: SubAppConfig[];
  loading: boolean;
  error: string | null;
  lastFetchTime: number;

  // Actions
  fetchApps: () => Promise<void>;
  fetchEnabledApps: () => Promise<void>;
  createApp: (app: Partial<SubAppConfig>) => Promise<SubAppConfig>;
  updateApp: (key: string, app: Partial<SubAppConfig>) => Promise<SubAppConfig>;
  deleteApp: (key: string) => Promise<void>;
  toggleStatus: (key: string) => Promise<SubAppConfig>;
  getAppByKey: (key: string) => SubAppConfig | undefined;
  getHistory: (key: string) => Promise<SubAppConfigHistory[]>;
  clearError: () => void;
}

// ==================== API Functions ====================

const API_BASE = '/api/v1';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('access_token');

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText || `HTTP ${response.status}` }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data as T;
}

// ==================== Store ====================

export const useSubAppStore = create<SubAppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      apps: [],
      loading: false,
      error: null,
      lastFetchTime: 0,

      // Fetch all apps
      fetchApps: async () => {
        set({ loading: true, error: null });
        try {
          const response = await fetchApi<{ success: boolean; data: SubAppConfig[] }>('/subapps');
          if (response.success) {
            set({
              apps: response.data,
              lastFetchTime: Date.now(),
              loading: false,
            });
          } else {
            throw new Error('Failed to fetch sub-apps');
          }
        } catch (error: any) {
          set({ error: error.message, loading: false });
          console.error('[SubAppStore] Failed to fetch apps:', error);
        }
      },

      // Fetch enabled apps only
      fetchEnabledApps: async () => {
        set({ loading: true, error: null });
        try {
          const response = await fetchApi<{ success: boolean; data: SubAppConfig[] }>('/subapps/enabled');
          if (response.success) {
            set({
              apps: response.data,
              lastFetchTime: Date.now(),
              loading: false,
            });
          } else {
            throw new Error('Failed to fetch enabled sub-apps');
          }
        } catch (error: any) {
          set({ error: error.message, loading: false });
          console.error('[SubAppStore] Failed to fetch enabled apps:', error);
        }
      },

      // Create new app
      createApp: async (appData: Partial<SubAppConfig>) => {
        set({ loading: true, error: null });
        try {
          const response = await fetchApi<{ success: boolean; data: SubAppConfig }>('/subapps', {
            method: 'POST',
            body: JSON.stringify(appData),
          });

          if (response.success) {
            set((state) => ({
              apps: [...state.apps, response.data],
              loading: false,
            }));
            return response.data;
          } else {
            throw new Error('Failed to create sub-app');
          }
        } catch (error: any) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      // Update app
      updateApp: async (key: string, appData: Partial<SubAppConfig>) => {
        set({ loading: true, error: null });
        try {
          const response = await fetchApi<{ success: boolean; data: SubAppConfig }>(`/subapps/${key}`, {
            method: 'PUT',
            body: JSON.stringify(appData),
          });

          if (response.success) {
            set((state) => ({
              apps: state.apps.map((app) => (app.key === key ? response.data : app)),
              loading: false,
            }));
            return response.data;
          } else {
            throw new Error('Failed to update sub-app');
          }
        } catch (error: any) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      // Delete app
      deleteApp: async (key: string) => {
        set({ loading: true, error: null });
        try {
          const response = await fetchApi<{ success: boolean }>(`/subapps/${key}`, {
            method: 'DELETE',
          });

          if (response.success) {
            set((state) => ({
              apps: state.apps.filter((app) => app.key !== key),
              loading: false,
            }));
          } else {
            throw new Error('Failed to delete sub-app');
          }
        } catch (error: any) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      // Toggle status
      toggleStatus: async (key: string) => {
        set({ loading: true, error: null });
        try {
          const response = await fetchApi<{ success: boolean; data: SubAppConfig }>(`/subapps/${key}/status`, {
            method: 'PUT',
            body: JSON.stringify({}),
          });

          if (response.success) {
            set((state) => ({
              apps: state.apps.map((app) => (app.key === key ? response.data : app)),
              loading: false,
            }));
            return response.data;
          } else {
            throw new Error('Failed to toggle sub-app status');
          }
        } catch (error: any) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      // Get app by key from local state
      getAppByKey: (key: string) => {
        return get().apps.find((app) => app.key === key);
      },

      // Get history
      getHistory: async (key: string) => {
        const response = await fetchApi<{ success: boolean; data: SubAppConfigHistory[] }>(
          `/subapps/${key}/history`
        );
        if (response.success) {
          return response.data;
        }
        return [];
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'subapp-storage',
      version: 3, // 强制刷新缓存
      partialize: (state) => ({
        // Only persist apps and lastFetchTime
        apps: state.apps,
        lastFetchTime: state.lastFetchTime,
      }),
      migrate: (_persistedState: any, _version: number) => {
        // 强制清除缓存，触发重新获取
        console.log('[SubAppStore] Migrating - clearing cache');
        return {};
      },
    }
  )
);

export default useSubAppStore;