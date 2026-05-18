/**
 * 子应用配置
 * 定义所有可加载的子应用
 */
import { SubAppConfig } from './types';

// 开发环境配置
const isDev = import.meta.env.DEV;

// 子应用 URL 配置
// 开发模式：通过 Vite 代理访问（同源），避免 wujie 跨域 iframe 问题
// 生产模式：指向构建后的静态资源路径
const APP_URLS: Record<string, string> = {
  dba: isDev ? 'http://localhost:3000/orion-dba/' : '/orion-dba/index.html',
  knowledge: isDev ? 'http://localhost:3000/orion-knowledge/' : '/orion-knowledge/index.html',
  visor: isDev ? 'http://localhost:3000/orion-visor/' : '/orion-visor/index.html',
};

/**
 * 子应用配置列表
 */
export const subAppConfigs: SubAppConfig[] = [
  {
    name: '数据库管理',
    key: 'dba',
    path: '/dba/*',
    url: APP_URLS['dba'],
    container: '#wujie-dba',
    enabled: true,
    keepAlive: false,
    preload: false,
  },
  {
    name: '知识库',
    key: 'knowledge',
    path: '/knowledge/*',
    url: APP_URLS['knowledge'],
    container: '#wujie-knowledge',
    enabled: true,
    keepAlive: false,
    preload: false,
  },
  {
    name: '监控中心',
    key: 'visor',
    path: '/visor/*',
    url: APP_URLS['visor'],
    container: '#wujie-visor',
    enabled: true,
    keepAlive: false,
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
