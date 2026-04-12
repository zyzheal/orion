/**
 * wujie 微前端主应用配置
 */
import { setupApp, preloadApp } from 'wujie';
import { subAppConfigs, getSubAppConfig } from './apps';

// 扩展 window 类型以包含 $orion
declare global {
  interface Window {
    $orion?: unknown;
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
 * 全局状态注入
 * 在应用启动时设置
 */
export const injectGlobalState = (state: Record<string, unknown>): void => {
  window.$orion = state;
};

export default {
  initMicroFrontend,
  unloadSubApp,
  injectGlobalState,
};
