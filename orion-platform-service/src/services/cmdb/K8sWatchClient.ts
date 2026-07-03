/**
 * K8s Watch Client
 *
 * 提供 Kubernetes 资源的 Watch 能力：
 * - 连接 K8s API Server
 * - 监听资源变化（Cluster/Namespace/Deployment/Pod）
 * - 断线自动重连（指数退避）
 * - Watch 消息处理
 */

import { createLogger } from '../utils/logger';
import * as k8s from '@kubernetes/client-node';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Watch 事件类型
 */
export type WatchEventType = 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR' | 'BOOKMARK';

/**
 * Watch 事件
 */
export interface WatchEvent<T = any> {
  type: WatchEventType;
  object: T;
  raw?: string;
}

/**
 * K8s 资源类型
 */
export type K8sResourceKind = 'Cluster' | 'Namespace' | 'Deployment' | 'Pod' | 'Service' | 'ConfigMap' | 'Secret';

/**
 * Watch 配置
 */
export interface WatchConfig {
  /** K8s API Server URL */
  apiServerUrl?: string;
  /** Bearer Token */
  token?: string;
  /** CA 证书（Base64 编码） */
  caCert?: string;
  /** 是否使用集群内配置 */
  useClusterConfig?: boolean;
  /** 命名空间（为空表示所有命名空间） */
  namespace?: string;
  /** 命名空间列表 */
  namespaces?: string[];
  /** 资源版本（用于断点续传） */
  resourceVersion?: string;
  /** 重连配置 */
  reconnect?: {
    /** 初始重连间隔（毫秒） */
    initialDelayMs?: number;
    /** 最大重连间隔（毫秒） */
    maxDelayMs?: number;
    /** 最大重试次数（0 表示无限） */
    maxRetries?: number;
  };
}

/**
 * 同步状态
 */
export type SyncStatus = 'L0_NORMAL' | 'L1_REDUCED' | 'L2_PAUSED' | 'L3_DEGRADED';

/**
 * K8s Watch 客户端状态
 */
export interface WatchClientStatus {
  connected: boolean;
  reconnectAttempts: number;
  lastConnectedAt?: Date;
  lastError?: string;
  resourcesWatched: K8sResourceKind[];
  syncStatus: SyncStatus;
}

/**
 * 资源处理器
 */
export type ResourceHandler<T = any> = (event: WatchEvent<T>) => void | Promise<void>;

/**
 * K8s Watch 客户端
 */
export class K8sWatchClient {
  private kubeConfig: k8s.KubeConfig;
  private watchClient: k8s.Watch;
  private config: WatchConfig;
  private abortController: AbortController | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private lastConnectedAt?: Date;
  private lastError?: string;
  private watchedResources: Set<K8sResourceKind> = new Set();
  private resourceVersions: Map<K8sResourceKind, string> = new Map();
  private handlers: Map<K8sResourceKind, ResourceHandler> = new Map();
  private syncStatus: SyncStatus = 'L0_NORMAL';
  private reconnectDelayMs: number;
  private maxReconnectDelayMs: number;
  private maxRetries: number;

  constructor(config: WatchConfig = {}) {
    this.config = config;
    this.kubeConfig = new k8s.KubeConfig();
    this.watchClient = new k8s.Watch(this.kubeConfig);

    // 重连配置
    const reconnectConfig = config.reconnect || {};
    this.reconnectDelayMs = reconnectConfig.initialDelayMs || 1000;
    this.maxReconnectDelayMs = reconnectConfig.maxDelayMs || 30000;
    this.maxRetries = reconnectConfig.maxRetries || 0; // 0 表示无限

    // 初始化 KubeConfig
    this.initializeKubeConfig();
  }

  /**
   * 初始化 KubeConfig
   */
  private initializeKubeConfig(): void {
    if (this.config.useClusterConfig || (!this.config.apiServerUrl && !this.config.token)) {
      // 使用集群内配置（Pod 中运行时）
      try {
        this.kubeConfig.loadFromCluster();
        logger.info('Loaded KubeConfig from cluster');
      } catch (err) {
        logger.warn({ err }, 'Failed to load cluster config, trying default');
        this.kubeConfig.loadFromDefault();
      }
    } else if (this.config.apiServerUrl && this.config.token) {
      // 使用显式配置
      const cluster = {
        name: 'orion-cluster',
        server: this.config.apiServerUrl,
        skipTLSVerify: !this.config.caCert,
        caData: this.config.caCert,
      };

      const user = {
        name: 'orion-sa',
        token: this.config.token,
      };

      const context = {
        name: 'orion-context',
        cluster: cluster.name,
        user: user.name,
      };

      this.kubeConfig.addCluster(cluster);
      this.kubeConfig.addUser(user);
      this.kubeConfig.addContext(context);
      this.kubeConfig.setCurrentContext(context.name);

      logger.info({ server: this.config.apiServerUrl }, 'Loaded explicit KubeConfig');
    } else {
      // 使用默认配置（本地开发时 ~/.kube/config）
      this.kubeConfig.loadFromDefault();
      logger.info('Loaded default KubeConfig');
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): WatchClientStatus {
    return {
      connected: this.abortController !== null && !this.abortController.signal.aborted,
      reconnectAttempts: this.reconnectAttempts,
      lastConnectedAt: this.lastConnectedAt,
      lastError: this.lastError,
      resourcesWatched: Array.from(this.watchedResources),
      syncStatus: this.syncStatus,
    };
  }

  /**
   * 注册资源处理器
   */
  registerHandler(kind: K8sResourceKind, handler: ResourceHandler): void {
    this.handlers.set(kind, handler);
    logger.info({ kind }, 'Registered resource handler');
  }

  /**
   * 注销资源处理器
   */
  unregisterHandler(kind: K8sResourceKind): void {
    this.handlers.delete(kind);
    logger.info({ kind }, 'Unregistered resource handler');
  }

  /**
   * 启动 Watch
   */
  async start(): Promise<void> {
    if (this.abortController) {
      logger.warn('Watch already started');
      return;
    }

    this.abortController = new AbortController();
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.syncStatus = 'L0_NORMAL';
    this.lastError = undefined;

    logger.info('Starting K8s Watch client');

    // Watch 各资源类型
    const watchPromises: Promise<void>[] = [];

    if (this.handlers.has('Namespace')) {
      watchPromises.push(this.watchResource('Namespace'));
    }
    if (this.handlers.has('Deployment')) {
      watchPromises.push(this.watchResource('Deployment'));
    }
    if (this.handlers.has('Pod')) {
      watchPromises.push(this.watchResource('Pod'));
    }
    if (this.handlers.has('Service')) {
      watchPromises.push(this.watchResource('Service'));
    }
    if (this.handlers.has('ConfigMap')) {
      watchPromises.push(this.watchResource('ConfigMap'));
    }

    // 并行启动所有 Watch
    await Promise.allSettled(watchPromises);
  }

  /**
   * 停止 Watch
   */
  stop(): void {
    logger.info('Stopping K8s Watch client');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.isReconnecting = false;
    this.watchedResources.clear();
    this.syncStatus = 'L2_PAUSED';
  }

  /**
   * Watch 指定资源
   */
  private async watchResource(kind: K8sResourceKind): Promise<void> {
    if (!this.abortController || this.abortController.signal.aborted) {
      return;
    }

    const handler = this.handlers.get(kind);
    if (!handler) {
      logger.warn({ kind }, 'No handler registered for resource');
      return;
    }

    const path = this.getResourcePath(kind);
    const namespace = this.config.namespace;
    const resourceVersion = this.resourceVersions.get(kind);

    try {
      this.watchedResources.add(kind);
      this.lastConnectedAt = new Date();
      this.lastError = undefined;

      logger.info({ kind, path, namespace }, 'Starting watch for resource');

      await this.watchClient.watch(
        path,
        {
          labelSelector: undefined,
          fieldSelector: undefined,
          namespace,
          resourceVersion,
        },
        (type: string, obj: any) => {
          // 更新 resourceVersion（用于断点续传）
          if (obj?.metadata?.resourceVersion) {
            this.resourceVersions.set(kind, obj.metadata.resourceVersion);
          }

          // 重置重连计数（收到事件表示连接正常）
          this.reconnectAttempts = 0;
          this.syncStatus = 'L0_NORMAL';

          const event: WatchEvent = {
            type: type as WatchEventType,
            object: obj,
          };

          // Handle event - handler is async but we don't block the watch
          // Errors are logged by the handler itself
          const result = handler(event);
          if (result instanceof Promise) {
            result.catch((err: unknown) => {
              logger.error({ kind, err }, 'Handler error');
            });
          }
        },
        (err: Error) => {
          // 连接断开
          this.handleWatchError(kind, err);
        }
      );
    } catch (err) {
      this.handleWatchError(kind, err as Error);
    }
  }

  /**
   * 获取资源 API 路径
   */
  private getResourcePath(kind: K8sResourceKind): string {
    const paths: Record<K8sResourceKind, string> = {
      'Namespace': '/api/v1/namespaces',
      'Deployment': '/apis/apps/v1/deployments',
      'Pod': '/api/v1/pods',
      'Service': '/api/v1/services',
      'ConfigMap': '/api/v1/configmaps',
      'Secret': '/api/v1/secrets',
      'Cluster': '/api/v1', // Cluster 级别通常是节点信息
    };
    return paths[kind] || '/api/v1';
  }

  /**
   * 处理 Watch 错误
   */
  private handleWatchError(kind: K8sResourceKind, err: Error): void {
    this.watchedResources.delete(kind);
    this.lastError = err.message;

    // 检查是否为正常停止
    if (this.abortController?.signal.aborted) {
      logger.info({ kind }, 'Watch stopped normally');
      return;
    }

    logger.error({ kind, err }, 'Watch error occurred');

    // 更新同步状态
    this.updateSyncStatus();

    // 尝试重连
    this.scheduleReconnect(kind);
  }

  /**
   * 更新同步状态（降级策略）
   * L0_NORMAL -> L1_REDUCED -> L2_PAUSED -> L3_DEGRADED
   */
  private updateSyncStatus(): void {
    if (this.reconnectAttempts === 0) {
      this.syncStatus = 'L0_NORMAL';
    } else if (this.reconnectAttempts < 3) {
      this.syncStatus = 'L1_REDUCED';
      logger.warn('Sync status degraded to L1_REDUCED');
    } else if (this.reconnectAttempts < 10) {
      this.syncStatus = 'L2_PAUSED';
      logger.error('Sync status degraded to L2_PAUSED');
    } else {
      this.syncStatus = 'L3_DEGRADED';
      logger.error('Sync status degraded to L3_DEGRADED');
    }
  }

  /**
   * 调度重连
   * 指数退避：1s -> 2s -> 4s -> 8s -> 16s -> 30s
   */
  private scheduleReconnect(kind: K8sResourceKind): void {
    if (this.isReconnecting) {
      return;
    }

    // 检查最大重试次数
    if (this.maxRetries > 0 && this.reconnectAttempts >= this.maxRetries) {
      logger.error(
        { kind, attempts: this.reconnectAttempts },
        'Max reconnect attempts reached, stopping'
      );
      return;
    }

    // 检查是否已停止
    if (!this.abortController || this.abortController.signal.aborted) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // 计算指数退避延迟
    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelayMs
    );

    logger.info(
      { kind, attempts: this.reconnectAttempts, delayMs: delay },
      'Scheduling reconnect'
    );

    this.reconnectTimer = setTimeout(() => {
      this.isReconnecting = false;
      this.watchResource(kind).catch((err) => {
        logger.error({ kind, err }, 'Reconnect failed');
      });
    }, delay);
  }

  /**
   * 手动触发重连
   */
  async reconnect(): Promise<void> {
    this.reconnectAttempts = 0;
    this.syncStatus = 'L0_NORMAL';
    this.lastError = undefined;

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    await this.start();
  }

  /**
   * 获取当前同步状态
   */
  getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    status: WatchClientStatus;
    message: string;
  }> {
    const status = this.getStatus();
    let healthy = false;
    let message = '';

    switch (status.syncStatus) {
      case 'L0_NORMAL':
        healthy = true;
        message = 'Watch connection is healthy';
        break;
      case 'L1_REDUCED':
        healthy = true;
        message = 'Watch connection is degraded but functional';
        break;
      case 'L2_PAUSED':
        healthy = false;
        message = 'Watch connection is paused due to errors';
        break;
      case 'L3_DEGRADED':
        healthy = false;
        message = 'Watch connection is severely degraded';
        break;
    }

    return { healthy, status, message };
  }
}

export default K8sWatchClient;