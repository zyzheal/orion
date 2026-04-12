/**
 * 子应用配置
 * 定义所有可加载的子应用
 */
import { SubAppConfig } from './types';

// 开发环境配置
const isDev = import.meta.env.DEV;

// 子应用基础 URL 配置
const APP_BASE_URLS: Record<string, string> = {
  // 本地开发使用 localhost
  'dba': isDev ? 'http://localhost:3001' : '/orion-dba',
  'knowledge': isDev ? 'http://localhost:3002' : '/orion-knowledge',
  'visor': isDev ? 'http://localhost:3003' : '/orion-visor',
};

/**
 * 子应用配置列表
 */
export const subAppConfigs: SubAppConfig[] = [
  {
    name: '数据库管理',
    key: 'dba',
    path: '/dba/*',
    url: `${APP_BASE_URLS['dba']}/orion-dba`,
    container: '#wujie-dba',
    enabled: true,
    keepAlive: true,
    preload: false,
  },
  {
    name: '知识库',
    key: 'knowledge',
    path: '/knowledge/*',
    url: `${APP_BASE_URLS['knowledge']}/orion-knowledge`,
    container: '#wujie-knowledge',
    enabled: true,
    keepAlive: true,
    preload: false,
  },
  {
    name: '监控中心',
    key: 'visor',
    path: '/visor/*',
    url: `${APP_BASE_URLS['visor']}/orion-visor`,
    container: '#wujie-visor',
    enabled: true,
    keepAlive: true,
    preload: false,
  },
];

/**
 * 获取子应用配置
 */
export const getSubAppConfig = (key: string): SubAppConfig | undefined => {
  return subAppConfigs.find((app) => app.key === key);
};

/**
 * 获取启用的子应用
 */
export const getEnabledApps = (): SubAppConfig[] => {
  return subAppConfigs.filter((app) => app.enabled);
};

export default subAppConfigs;
