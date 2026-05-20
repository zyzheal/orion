/**
 * wujie 微前端主应用配置
 */
import { setupApp, preloadApp, bus, destroyApp } from 'wujie';
import { subAppConfigs, getSubAppConfig, getEnabledApps } from './apps';

// Re-export for direct access
export { subAppConfigs, getSubAppConfig, getEnabledApps };

// Orion 认证状态类型
export interface OrionAuthState {
  token: string;
  tenantId: string;
  user: {
    id: string;
    username: string;
    email?: string;
  };
}

// 扩展 window 类型以包含 $orion
declare global {
  interface Window {
    $orion?: OrionAuthState;
  }
}

/**
 * 初始化微前端配置
 */
export const initMicroFrontend = (): void => {
  // 配置子应用
  subAppConfigs.forEach((app) => {
    if (!app.enabled) return;

    setupApp({
      name: app.key,
      url: app.url,
      el: app.container,
      props: {
        // 注入全局状态
        $orion: window.$orion,
      },
      // 子应用生命周期回调
      beforeMount: () => {
        console.log(`[wujie] ${app.key} before mount`);
      },
      afterMount: () => {
        console.log(`[wujie] ${app.key} after mount`);
      },
      beforeUnmount: () => {
        console.log(`[wujie] ${app.key} before unmount`);
      },
      afterUnmount: () => {
        console.log(`[wujie] ${app.key} after unmount`);
      },
      // Keep-Alive 生命周期
      activated: () => {
        console.log(`[wujie] ${app.key} activated`);
        // 子应用激活时重新注入最新的认证状态
        // 使用 requestAnimationFrame 延迟注入，确保子应用沙箱已就绪
        requestAnimationFrame(() => {
          injectAuthState();
        });
      },
      deactivated: () => {
        console.log(`[wujie] ${app.key} deactivated`);
      },
    });
  });

  // 预加载常用子应用
  const enabledApps = getSubAppConfig('dba');
  if (enabledApps) {
    preloadApp({ name: 'dba' });
  }
};

/**
 * 清理子应用资源（HMR 时调用，释放 wujie 内部状态）
 */
export const cleanupMicroFrontend = (): void => {
  subAppConfigs.forEach((app) => {
    try {
      destroyApp(app.key);
    } catch {
      // 子应用未启动时 destroyApp 可能抛异常，安全忽略
    }
    // 兜底：清理容器 DOM
    const container = document.querySelector(app.container);
    if (container) {
      (container as HTMLElement).innerHTML = '';
    }
  });
};

/**
 * 卸载子应用
 */
export const unloadSubApp = (appKey: string): void => {
  const app = getSubAppConfig(appKey);
  if (!app) return;

  // 清除容器内容
  const container = document.querySelector(app.container);
  if (container) {
    container.innerHTML = '';
  }
};

/**
 * 注入认证状态到子应用
 * 在主应用登录后调用
 */
export const injectAuthState = (): void => {
  const token = localStorage.getItem('access_token');
  const tenantId = localStorage.getItem('tenant_id');
  const userStr = localStorage.getItem('user');

  // 安全解析JSON，避免解析失败导致异常
  let user = { id: '', username: '' };
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.warn('[Wujie] Failed to parse user data:', e);
    }
  }

  const authState: OrionAuthState = {
    token: token || '',
    tenantId: tenantId || '',
    user,
  };

  // 变更检测：无变化时跳过，避免重复通知
  const current = window.$orion;
  if (
    current &&
    current.token === authState.token &&
    current.tenantId === authState.tenantId &&
    current.user?.id === authState.user.id
  ) {
    return;
  }

  // 设置全局状态
  window.$orion = authState;

  // 通过 Wujie bus 事件通知子应用
  bus.$emit('orionAuth', authState);

  console.log('[Wujie] Auth state injected:', {
    hasToken: !!token,
    tenantId,
    userId: authState.user.id,
  });
};

/**
 * 获取当前认证状态
 */
export const getAuthState = (): OrionAuthState | null => {
  return window.$orion || null;
};

/**
 * 监听认证状态变化
 */
export const subscribeAuthState = (callback: (state: OrionAuthState) => void): (() => void) => {
  bus.$on('orionAuth', callback);
  return () => bus.$off('orionAuth', callback);
};

/**
 * 全局状态注入 (兼容旧接口)
 */
export const injectGlobalState = (state: Record<string, unknown>): void => {
  window.$orion = state as OrionAuthState;
};

export default {
  initMicroFrontend,
  unloadSubApp,
  cleanupMicroFrontend,
  injectGlobalState,
  injectAuthState,
  getAuthState,
  subscribeAuthState,
};
