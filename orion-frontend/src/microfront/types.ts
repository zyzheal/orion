/**
 * 子应用配置类型定义
 */
export interface SubAppConfig {
  /** 子应用名称 */
  name: string;
  /** 子应用唯一标识 */
  key: string;
  /** 子应用访问路径 */
  path: string;
  /** 子应用资源地址 */
  url: string;
  /** 子应用容器选择器 */
  container: string;
  /** 是否启用 */
  enabled: boolean;
  /** 是否 Keep-Alive */
  keepAlive?: boolean;
  /** 预加载配置 */
  preload?: boolean;
  /** 子应用属性 */
  props?: Record<string, unknown>;
}

/**
 * 子应用生命周期回调
 */
export interface SubAppLifecycle {
  /** 挂载前 */
  beforeMount?: () => void;
  /** 挂载后 */
  afterMount?: () => void;
  /** 卸载前 */
  beforeUnmount?: () => void;
  /** 卸载后 */
  afterUnmount?: () => void;
  /** 激活时 */
  onActivate?: () => void;
  /** 失活时 */
  onDeactivate?: () => void;
}

/**
 * 全局状态接口
 */
export interface OrionGlobalState {
  /** 用户信息 */
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
    tenantId: string;
  } | null;
  /** 认证 Token */
  token: string | null;
  /** 主题 */
  theme: 'light' | 'dark';
  /** 侧边栏状态 */
  sidebarCollapsed: boolean;
  /** 面包屑 */
  breadcrumbs: Array<{ title: string; path?: string }>;
  /** 权限列表 */
  permissions: string[];
  /** API 基础路径 */
  getApiBase: () => string;
  /** 事件总线 */
  eventBus: {
    emit: (event: string, data: unknown) => void;
    on: (event: string, callback: (data: unknown) => void) => void;
    off: (event: string, callback: (data: unknown) => void) => void;
  };
}

/**
 * 主应用配置接口
 */
export interface MainAppConfig {
  /** 子应用列表 */
  apps: SubAppConfig[];
  /** 全局状态 */
  globalState: OrionGlobalState;
  /** 默认子应用 */
  defaultApp?: string;
  /** 路由前缀 */
  routePrefix?: string;
}
