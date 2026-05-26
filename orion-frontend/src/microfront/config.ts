/**
 * 微前端主应用配置
 *
 * 使用 Orion-MF 替代 wujie (2026-05-21)
 */
import { getDefaultChannel, DEFAULT_CHANNEL, createSubAppChannel } from './eventBus';
import type { EventBusPayload } from '@orion-mf/core';
import {
  loadSubApp,
  destroySubApp,
  getSubApp,
  PreloadStrategy,
  getPreloadStrategy as getPreloadStrategyFromCore,
} from '@orion-mf/core';
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
 *
 * Phase 4: 子应用按需加载（通过 SubAppRouteDynamic），不再预先注册
 */
export const initMicroFrontend = (): void => {
  // 子应用改为按需动态加载，不需要预先注册
  // 此函数保留用于未来的全局初始化
};

/**
 * 获取预加载策略实例
 */
function getPreloadStrategy(): PreloadStrategy {
  return getPreloadStrategyFromCore();
}

/**
 * 清理子应用资源（HMR 时调用，释放 Orion-MF 内部状态）
 */
export const cleanupMicroFrontend = async (): Promise<void> => {
  for (const app of getEnabledApps()) {
    try {
      await destroySubApp(app.key);
    } catch {
      // 子应用未启动时安全忽略
    }
    const container = document.querySelector(app.container);
    if (container) {
      (container as HTMLElement).innerHTML = '';
    }
  }
};

/**
 * 卸载子应用（异步等待销毁完成后再清理 DOM）
 */
export const unloadSubApp = async (appKey: string): Promise<void> => {
  const app = getSubAppConfig(appKey);
  if (!app) return;

  await destroySubApp(appKey).catch(() => {});

  // 销毁完成后再清除容器内容
  const container = document.querySelector(app.container);
  if (container) {
    (container as HTMLElement).innerHTML = '';
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
      console.warn('[OrionMF] Failed to parse user data:', e);
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

  // 通过 Orion-MF EventBus Channel 通知子应用
  getDefaultChannel().emit('orionAuth', authState);

  console.log('[OrionMF] Auth state injected:', {
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
 * handler 通过 payload.data 获取 OrionAuthState
 */
export const subscribeAuthState = (
  callback: (state: OrionAuthState) => void,
  owner?: string,
): (() => void) => {
  const channel = getDefaultChannel();
  const handler = (payload: EventBusPayload) => {
    callback(payload.data as OrionAuthState);
  };
  channel.on('orionAuth', handler, owner);
  return () => channel.off('orionAuth', handler);
};

/**
 * 全局状态注入 (兼容旧接口)
 */
export const injectGlobalState = (state: Record<string, unknown>): void => {
  window.$orion = state as OrionAuthState;
};

// ============================================================================
// SubApp loading convenience function (替代 wujie.startApp)
// ============================================================================

/**
 * 启动子应用 (替代 wujie.startApp)
 */
export const startSubApp = async (
  appKey: string,
  options?: {
    url?: string;
    container?: string;
    keepAlive?: boolean;
    props?: Record<string, unknown>;
    basename?: string;
  }
) => {
  const config = getSubAppConfig(appKey);
  if (!config) {
    throw new Error(`Sub-app "${appKey}" not found in registry`);
  }

  const entryUrl = options?.url || config.url;

  // 注入 props 到 window.$orion
  if (options?.props) {
    const orion = (options.props as { $orion?: OrionAuthState }).$orion;
    window.$orion = {
      token: orion?.token || '',
      tenantId: orion?.tenantId || localStorage.getItem('tenant_id') || '',
      user: orion?.user || { id: '', username: '' },
    };
  }

  // 计算 basename：优先使用传入的，否则根据 appKey 推断
  const basename = options?.basename || `/${appKey}`;

  return loadSubApp({
    key: appKey,
    name: config.name,
    remoteEntry: entryUrl,
    props: {
      ...(options?.props || {}),
      basename,
      container: options?.container ? document.querySelector(options.container) : undefined,
    },
  });
};

export default {
  initMicroFrontend,
  unloadSubApp,
  cleanupMicroFrontend,
  injectGlobalState,
  injectAuthState,
  getAuthState,
  subscribeAuthState,
  startSubApp,
};
