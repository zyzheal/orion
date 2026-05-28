/**
 * Plugin Hot Reload Service
 *
 * 支持插件在运行时热加载更新，无需重启服务
 *
 * 功能:
 * 1. 监听插件文件变更 (通过 fs.watch 或 git webhook)
 * 2. 自动检测插件版本变更
 * 3. 安全卸载旧版本 + 加载新版本
 * 4. 保留插件配置和状态
 * 5. 支持回滚到上一个版本
 */
import { EventEmitter } from 'events';
import { PluginLifecycleManager, ActivationHook, DeactivationHook } from './PluginLifecycleManager';
import { PluginRegistry } from './PluginRegistry';
import { PluginManifest, PluginInfo } from './types';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface HotReloadConfig {
  watchPaths: string[]; // 插件目录路径
  autoReload: boolean; // 自动热加载
  reloadDelay: number; // 检测变更后延迟加载时间 (ms)
  maxRetries: number; // 加载失败最大重试次数
  rollbackEnabled: boolean; // 是否启用回滚
  notifyOnReload: boolean; // 是否通知客户端
}

export interface PluginVersionSnapshot {
  pluginId: string;
  version: string;
  manifest: PluginManifest;
  config: Record<string, any>;
  status: PluginInfo['status'];
  timestamp: Date;
  checksum?: string; // 文件 checksum 用于检测变更
}

export interface HotReloadEvent {
  type: 'detected' | 'started' | 'completed' | 'failed' | 'rolled_back';
  pluginId: string;
  oldVersion?: string;
  newVersion?: string;
  error?: string;
  timestamp: Date;
}

const DEFAULT_CONFIG: HotReloadConfig = {
  watchPaths: [],
  autoReload: true,
  reloadDelay: 1000, // 1 秒延迟
  maxRetries: 3,
  rollbackEnabled: true,
  notifyOnReload: true,
};

/**
 * Plugin Hot Reload Service
 */
export class PluginHotReloadService extends EventEmitter {
  private lifecycleManager: PluginLifecycleManager;
  private registry: PluginRegistry;
  private config: HotReloadConfig;

  // 版本快照存储 (用于回滚)
  private versionSnapshots: Map<string, PluginVersionSnapshot[]> = new Map();
  private maxSnapshots = 5; // 每个插件最多保存 5 个版本快照

  // 监控器
  private watchers: Map<string, any> = new Map();
  private pendingReloads: Map<string, NodeJS.Timeout> = new Map();

  // 热加载状态
  private reloadingPlugins: Set<string> = new Set();

  constructor(
    lifecycleManager: PluginLifecycleManager,
    registry: PluginRegistry,
    config: Partial<HotReloadConfig> = {}
  ) {
    super();
    this.lifecycleManager = lifecycleManager;
    this.registry = registry;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 监听生命周期事件
    this.setupEventListeners();
  }

  /**
   * 获取当前配置 (public getter for private config)
   */
  getConfig(): HotReloadConfig {
    return this.config;
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 在插件启用时保存快照
    this.lifecycleManager.on('plugin:enabled', ({ pluginId }) => {
      this.saveSnapshot(pluginId);
    });

    // 在插件安装时保存快照
    this.lifecycleManager.on('plugin:installed', ({ pluginId, version }) => {
      this.saveSnapshot(pluginId);
    });
  }

  /**
   * 启动插件目录监控
   */
  startWatching(): void {
    // Browser detection - use any to avoid TS errors in Node.js
    const isBrowser = typeof (globalThis as any).window !== 'undefined';
    if (isBrowser || typeof (global as any).require === 'undefined') {
      logger.warn('File watching not available in browser environment');
      return;
    }

    const fs = (global as any).require('fs');
    const path = (global as any).require('path');

    for (const watchPath of this.config.watchPaths) {
      try {
        // 检查路径是否存在
        if (!fs.existsSync(watchPath)) {
          logger.warn({ watchPath }, 'Watch path does not exist');
          continue;
        }

        // 创建文件监听器
        const watcher = fs.watch(
          watchPath,
          { recursive: true },
          (eventType: string, filename: string) => {
            this.handleFileChange(watchPath, eventType, filename);
          }
        );

        // 监听器错误处理
        watcher.on('error', (error: Error) => {
          logger.error({ watchPath, error: error.message }, 'Watcher error');
        });

        this.watchers.set(watchPath, watcher);
        logger.info({ watchPath }, 'Started watching plugin directory');
      } catch (error) {
        logger.error({ watchPath, error }, 'Failed to start watcher');
      }
    }
  }

  /**
   * 停止所有监控
   */
  stopWatching(): void {
    for (const [path, watcher] of this.watchers) {
      try {
        watcher.close();
        this.watchers.delete(path);
      } catch (error) {
        logger.error({ path, error }, 'Failed to close watcher');
      }
    }

    // 清理待处理的重新加载
    for (const [pluginId, timeout] of this.pendingReloads) {
      clearTimeout(timeout);
      this.pendingReloads.delete(pluginId);
    }
  }

  /**
   * 处理文件变更
   */
  private handleFileChange(watchPath: string, eventType: string, filename: string): void {
    // 只处理特定文件类型
    if (!filename.endsWith('.js') && !filename.endsWith('.json') && !filename.endsWith('.ts')) {
      return;
    }

    logger.info({ watchPath, eventType, filename }, 'Plugin file changed');

    // 从文件路径推断插件 ID
    const pluginId = this.extractPluginId(watchPath, filename);
    if (!pluginId) {
      logger.warn({ filename }, 'Could not determine plugin ID from file path');
      return;
    }

    // 如果已有待处理的重新加载，取消它
    const existingTimeout = this.pendingReloads.get(pluginId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // 设置延迟重新加载 (避免频繁变更导致多次加载)
    if (this.config.autoReload) {
      const timeout = setTimeout(() => {
        this.pendingReloads.delete(pluginId);
        this.hotReload(pluginId).catch(error => {
          logger.error({ pluginId, error }, 'Hot reload failed');
        });
      }, this.config.reloadDelay);

      this.pendingReloads.set(pluginId, timeout);

      this.emit('hotreload:detected', {
        type: 'detected',
        pluginId,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 从文件路径提取插件 ID
   */
  private extractPluginId(watchPath: string, filename: string): string | null {
    // 简单实现: 假设目录名就是插件 ID
    // 例如: /plugins/my-plugin/index.js -> my-plugin
    const parts = filename.split('/');
    if (parts.length >= 2) {
      return parts[0];
    }
    return null;
  }

  /**
   * 执行插件热加载
   */
  async hotReload(pluginId: string, newManifest?: PluginManifest): Promise<PluginInfo> {
    // 防止重复加载
    if (this.reloadingPlugins.has(pluginId)) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Plugin "${pluginId}" is already being reloaded`);
    }

    this.reloadingPlugins.add(pluginId);

    try {
      // 获取当前插件信息
      const currentPlugin = this.registry.getPlugin(pluginId);
      if (!currentPlugin) {
        throw new Error(`Plugin "${pluginId}" not found`);
      }

      const oldVersion = currentPlugin.version;
      logger.info({ pluginId, oldVersion }, 'Starting hot reload');

      this.emit('hotreload:started', {
        type: 'started',
        pluginId,
        oldVersion,
        timestamp: new Date(),
      });

      // 保存当前版本快照 (用于回滚)
      this.saveSnapshot(pluginId);

      // 如果插件已启用，先禁用
      if (currentPlugin.status === 'enabled') {
        await this.lifecycleManager.disablePlugin(pluginId);
      }

      // 卸载旧版本
      await this.lifecycleManager.uninstallPlugin(pluginId);

      // 加载新版本 (如果提供了 manifest)
      if (!newManifest) {
        // 从文件系统加载新的 manifest
        newManifest = await this.loadManifestFromFile(pluginId);
      }

      // 安装新版本
      const newPlugin = await this.lifecycleManager.installPlugin(newManifest, currentPlugin.config);

      // 自动启用 (如果之前是启用的)
      if (currentPlugin.status === 'enabled') {
        await this.lifecycleManager.enablePlugin(pluginId);
      }

      logger.info({ pluginId, newVersion: newPlugin.version }, 'Hot reload completed');

      this.emit('hotreload:completed', {
        type: 'completed',
        pluginId,
        oldVersion,
        newVersion: newPlugin.version,
        timestamp: new Date(),
      });

      // 通知客户端 (通过 EventBus)
      if (this.config.notifyOnReload) {
        this.notifyClients(pluginId, oldVersion, newPlugin.version);
      }

      return newPlugin;
    } catch (error) {
      logger.error({ pluginId, error }, 'Hot reload failed');

      this.emit('hotreload:failed', {
        type: 'failed',
        pluginId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });

      // 尝试回滚
      if (this.config.rollbackEnabled) {
        await this.rollback(pluginId);
      }

      throw error;
    } finally {
      this.reloadingPlugins.delete(pluginId);
    }
  }

  /**
   * 从文件加载 Manifest
   */
  private async loadManifestFromFile(pluginId: string): Promise<PluginManifest> {
    // 浏览器环境不支持
    const isBrowser = typeof (globalThis as any).window !== 'undefined';
    if (isBrowser) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'File loading not supported in browser');
    }

    const fs = (global as any).require('fs');
    const path = (global as any).require('path');

    // 尝试多个可能的 manifest 文件名
    const manifestFiles = ['manifest.json', 'plugin.json', 'package.json'];

    for (const manifestFile of manifestFiles) {
      for (const watchPath of this.config.watchPaths) {
        const manifestPath = path.join(watchPath, pluginId, manifestFile);

        if (fs.existsSync(manifestPath)) {
          try {
            const content = fs.readFileSync(manifestPath, 'utf-8');
            const manifest = JSON.parse(content);

            // 验证 manifest
            this.registry.validateManifest(manifest);

            return manifest;
          } catch (error) {
            logger.warn({ manifestPath, error }, 'Failed to load manifest');
          }
        }
      }
    }

    throw new OrionError(ErrorCode.NOT_FOUND, `Manifest not found for plugin "${pluginId}"`);
  }

  /**
   * 回滚到上一个版本
   */
  async rollback(pluginId: string, targetVersion?: string): Promise<PluginInfo> {
    const snapshots = this.versionSnapshots.get(pluginId);
    if (!snapshots || snapshots.length === 0) {
      throw new OrionError(ErrorCode.NOT_FOUND, `No snapshots available for plugin "${pluginId}"`);
    }

    // 找到目标版本快照
    let targetSnapshot: PluginVersionSnapshot | undefined;
    if (targetVersion) {
      targetSnapshot = snapshots.find(s => s.version === targetVersion);
    } else {
      // 使用最近的一个快照 (排除当前版本)
      targetSnapshot = snapshots[snapshots.length - 2];
    }

    if (!targetSnapshot) {
      throw new Error(`Snapshot not found for version "${targetVersion || 'previous'}"`);
    }

    logger.info({ pluginId, targetVersion: targetSnapshot.version }, 'Rolling back plugin');

    try {
      // 使用快照数据重新安装
      const result = await this.hotReload(pluginId, targetSnapshot.manifest);

      this.emit('hotreload:rolled_back', {
        type: 'rolled_back',
        pluginId,
        oldVersion: snapshots[snapshots.length - 1]?.version,
        newVersion: targetSnapshot.version,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      logger.error({ pluginId, error }, 'Rollback failed');
      throw error;
    }
  }

  /**
   * 保存版本快照
   */
  private saveSnapshot(pluginId: string): void {
    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin) return;

    const snapshot: PluginVersionSnapshot = {
      pluginId,
      version: plugin.version,
      manifest: plugin.manifest,
      config: plugin.config || {},
      status: plugin.status,
      timestamp: new Date(),
    };

    let snapshots = this.versionSnapshots.get(pluginId) || [];
    snapshots.push(snapshot);

    // 限制快照数量
    if (snapshots.length > this.maxSnapshots) {
      snapshots = snapshots.slice(-this.maxSnapshots);
    }

    this.versionSnapshots.set(pluginId, snapshots);
    logger.debug({ pluginId, version: plugin.version }, 'Snapshot saved');
  }

  /**
   * 通知客户端插件已更新
   */
  private notifyClients(pluginId: string, oldVersion: string, newVersion: string): void {
    // 通过 EventEmitter 广播
    this.emit('plugin:updated', {
      pluginId,
      oldVersion,
      newVersion,
      timestamp: new Date(),
    });
  }

  /**
   * 获取插件版本历史
   */
  getVersionHistory(pluginId: string): PluginVersionSnapshot[] {
    return this.versionSnapshots.get(pluginId) || [];
  }

  /**
   * 获取热加载统计
   */
  getStats(): {
    watchedPaths: number;
    pendingReloads: number;
    activeReloads: number;
    totalSnapshots: number;
  } {
    return {
      watchedPaths: this.watchers.size,
      pendingReloads: this.pendingReloads.size,
      activeReloads: this.reloadingPlugins.size,
      totalSnapshots: Array.from(this.versionSnapshots.values()).reduce(
        (sum, snapshots) => sum + snapshots.length,
        0
      ),
    };
  }

  /**
   * 手动触发热加载 (用于 API 调用)
   */
  async triggerReload(pluginId: string, manifest?: PluginManifest): Promise<PluginInfo> {
    return this.hotReload(pluginId, manifest);
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.stopWatching();
    this.versionSnapshots.clear();
    this.pendingReloads.clear();
    this.reloadingPlugins.clear();
  }
}

export default PluginHotReloadService;