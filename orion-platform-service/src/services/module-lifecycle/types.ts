// src/services/module-lifecycle/types.ts

/**
 * 模块生命周期状态
 */
export type ModuleState = 'registered' | 'starting' | 'active' | 'stopping' | 'stopped' | 'failed';

/**
 * 模块层级
 */
export type ModuleLevel = 'core' | 'domain' | 'service' | 'feature';

/**
 * 模块配置
 */
export interface ModuleConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 是否自动启动 */
  autoStart?: boolean;
  /** 依赖的模块 ID 列表 */
  dependencies?: string[];
  /** 启动优先级（数字越小越先启动） */
  priority?: number;
}

/**
 * 模块描述
 */
export interface ModuleDescriptor {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 层级 */
  level: ModuleLevel;
  /** 所属功能域 */
  domain?: string;
  /** 当前状态 */
  state: ModuleState;
  /** 配置 */
  config: ModuleConfig;
  /** 路由前缀（如果有） */
  routePrefix?: string;
  /** 错误信息（如果状态为 failed） */
  error?: string;
}

/**
 * 模块生命周期接口
 * 所有可配置模块应实现此接口
 */
export interface ModuleLifecycle {
  /** 初始化模块（创建服务实例、准备资源） */
  initialize?(): Promise<void>;
  /** 启动模块（注册路由、启动定时任务、订阅 EventBus） */
  start?(): Promise<void>;
  /** 停止模块（清理资源、取消订阅） */
  stop?(): Promise<void>;
  /** 健康检查 */
  healthCheck?(): Promise<boolean>;
}

/**
 * 模块注册信息
 */
export interface ModuleRegistration {
  descriptor: ModuleDescriptor;
  lifecycle?: ModuleLifecycle;
  /** 启动函数（返回 Fastify 路由注册函数或 undefined） */
  routeRegistrar?: (app: any, options?: Record<string, unknown>) => Promise<void>;
}

/**
 * 依赖校验结果
 */
export interface DependencyValidationResult {
  valid: boolean;
  /** 不满足的依赖列表 */
  missingDependencies: string[];
  /** 循环依赖链（如果有） */
  circularDependencies?: string[][];
}

/**
 * 模块管理器配置
 */
export interface ModuleManagerConfig {
  /** 核心模块配置（不可禁用） */
  core?: Record<string, { enabled: boolean }>;
  /** 功能域配置 */
  domains?: Record<string, ModuleConfig>;
  /** 服务级配置 */
  services?: Record<string, ModuleConfig>;
  /** 特性级配置 */
  features?: Record<string, { enabled: boolean }>;
}
