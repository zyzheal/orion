/**
 * 子应用配置
 *
 * 迁移说明 (2026-05-21):
 * - Phase 4: 移除 Wujie 依赖，纯 Orion-MF 实现
 * - 从 SubAppStore 动态读取配置
 */
import { SubAppConfig as StoreSubAppConfig, useSubAppStore } from '@/stores/subappStore';

// 获取 store 实例
const getStoreState = () => useSubAppStore.getState();

// 开发环境配置
const isDev = import.meta.env.DEV;

/**
 * 子应用配置（Orion-MF 格式）
 */
export interface SubAppConfig {
  key: string;
  name: string;
  path: string;
  url: string;
  container: string;
  cssIsolation: 'shadow-dom' | 'scoped-css' | 'none';
  enabled: boolean;
  keepAlive: boolean;
  preload: boolean;
}

/**
 * 将后端配置转换为子应用配置
 */
function convertToConfig(storeConfig: StoreSubAppConfig): SubAppConfig {
  // 根据环境选择入口
  const url = isDev ? storeConfig.entry_dev : storeConfig.entry_prod;

  return {
    name: storeConfig.name,
    key: storeConfig.key,
    // 从 routes 数组取第一个路由，添加通配符
    path: storeConfig.routes?.[0] ? `${storeConfig.routes[0]}/*` : `/${storeConfig.key}/*`,
    url,
    // 容器 ID - Orion-MF 使用固定前缀
    container: `#app-${storeConfig.key}`,
    cssIsolation: storeConfig.css_isolation || 'shadow-dom',
    enabled: storeConfig.status === 'enabled',
    keepAlive: storeConfig.keep_alive,
    preload: storeConfig.preload,
  };
}

/**
 * 获取子应用配置
 * 从 Store 动态读取
 */
export const getSubAppConfig = (key: string): SubAppConfig | undefined => {
  // 尝试从 Store 获取
  const storeApps = getStoreState().apps;
  if (storeApps.length > 0) {
    const storeConfig = storeApps.find((app) => app.key === key);
    if (storeConfig) {
      return convertToConfig(storeConfig);
    }
  }

  // Fallback：返回 null 让调用方处理
  return undefined;
};

/**
 * 获取所有子应用配置
 */
export const getSubAppConfigs = (): SubAppConfig[] => {
  const storeApps = getStoreState().apps;
  if (storeApps.length > 0) {
    return storeApps
      .filter((app) => app.status === 'enabled')
      .map(convertToConfig);
  }

  return [];
};

/**
 * 获取启用的子应用
 */
export const getEnabledApps = (): SubAppConfig[] => {
  return getSubAppConfigs().filter((app) => app.enabled);
};

// 保留向后兼容的默认导出（返回空数组，运行时从 Store 读取）
export const subAppConfigs: SubAppConfig[] = [];

export default subAppConfigs;