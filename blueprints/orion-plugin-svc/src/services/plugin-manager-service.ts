/**
 * Plugin Manager Service
 *
 * 负责插件的生命周期管理：
 * - 插件下载/安装/卸载
 * - 插件激活/停用
 * - 插件配置
 * - 插件运行时管理
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { EventBusService } from './event-bus-service';
import { PluginRepository } from '../repositories/PluginRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 插件类型
 */
export type PluginType =
  | 'CUSTOM_TASK'
  | 'WEBHOOK_HANDLER'
  | 'AI_SKILL'
  | 'APPROVAL_PROVIDER'
  | 'NOTIFICATION_CHANNEL'
  | 'DEPLOYMENT_STRATEGY';

/**
 * 安全等级
 */
export type SecurityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * 插件状态
 */
export type PluginState =
  | 'AVAILABLE'
  | 'DOWNLOADED'
  | 'INSTALLED'
  | 'ACTIVE'
  | 'CONFIGURED'
  | 'INACTIVE'
  | 'UNINSTALLED';

/**
 * 插件元数据
 */
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  type: PluginType;
  securityLevel: SecurityLevel;
  configSchema: Record<string, ConfigField>;
}

/**
 * 配置字段定义
 */
export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: any;
  enum?: string[];
}

/**
 * 插件信息
 */
export interface PluginInfo extends PluginMetadata {
  state: PluginState;
  installedAt?: Date;
  updatedAt?: Date;
  config?: Record<string, any>;
}

/**
 * 插件运行时信息
 */
export interface PluginRuntimeInfo {
  processId?: string;
  containerId?: string;
  resourceUsage?: ResourceUsage;
  healthChecks?: HealthCheckStatus[];
}

/**
 * 资源使用情况
 */
export interface ResourceUsage {
  cpuPercent: number;
  memoryBytes: number;
  diskBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

/**
 * 健康检查状态
 */
export interface HealthCheckStatus {
  checkName: string;
  healthy: boolean;
  message?: string;
  lastCheckedAt: Date;
}

/**
 * 插件管理器配置
 */
export interface PluginManagerServiceConfig {
  eventBus?: EventBusService;
  pluginRepository?: PluginRepository;
}

/**
 * 插件管理器
 */
export class PluginManagerService extends EventEmitter {
  private plugins: Map<string, PluginInfo> = new Map();
  private runtimes: Map<string, PluginRuntimeInfo> = new Map();
  private eventBus?: EventBusService;
  private pluginRepository?: PluginRepository;

  constructor(config?: PluginManagerServiceConfig) {
    super();
    this.eventBus = config?.eventBus;
    this.pluginRepository = config?.pluginRepository;
  }

  /**
   * 列出可用插件
   */
  async listAvailablePlugins(options?: {
    typeFilter?: PluginType;
    tagsFilter?: string[];
  }): Promise<PluginInfo[]> {
    logger.info({ options }, 'Listing available plugins');

    // 合并内存中已加载的插件和注册表中的插件
    const merged = new Map<string, PluginInfo>();

    // 先从注册表加载默认插件
    const registryPlugins: PluginInfo[] = [
      {
        id: 'security-scan',
        name: 'security-scan',
        version: '1.0.0',
        description: 'Execute security scans using Trivy/Semgrep',
        author: 'Orion Team',
        tags: ['security', 'vulnerability'],
        type: 'CUSTOM_TASK',
        securityLevel: 'MEDIUM',
        state: 'AVAILABLE',
        configSchema: {
          scanType: { type: 'string', description: '扫描类型', required: true },
          severity: { type: 'string', description: '严重程度', default: 'CRITICAL,HIGH,MEDIUM' },
        },
      },
      {
        id: 'code-quality',
        name: 'code-quality',
        version: '1.0.0',
        description: 'Execute ESLint code quality checks',
        author: 'Orion Team',
        tags: ['code-quality', 'eslint'],
        type: 'CUSTOM_TASK',
        securityLevel: 'LOW',
        state: 'AVAILABLE',
        configSchema: {
          eslintConfig: { type: 'string', description: 'ESLint 配置路径', default: '.eslintrc.js' },
        },
      },
    ];

    // 合并：内存中的插件优先（可能有更新的状态）
    for (const plugin of this.plugins.values()) {
      merged.set(plugin.id, plugin);
    }
    // 注册表中的插件作为补充
    for (const plugin of registryPlugins) {
      if (!merged.has(plugin.id)) {
        merged.set(plugin.id, plugin);
      }
    }

    let filtered = Array.from(merged.values());

    if (options?.typeFilter) {
      filtered = filtered.filter((p) => p.type === options.typeFilter);
    }

    if (options?.tagsFilter?.length) {
      filtered = filtered.filter((p) =>
        options.tagsFilter!.some((tag) => p.tags.includes(tag))
      );
    }

    return filtered;
  }

  /**
   * 安装插件
   */
  async installPlugin(
    pluginId: string,
    version: string,
    config?: Record<string, any>
  ): Promise<PluginInfo> {
    logger.info({ pluginId, version }, 'Installing plugin');

    // 检查插件是否已存在
    let existing = this.plugins.get(pluginId);
    if (existing && existing.state !== 'UNINSTALLED') {
      throw new Error(`Plugin ${pluginId} is already installed`);
    }

    // 如果有仓库，先检查数据库
    if (this.pluginRepository) {
      existing = await this.pluginRepository.findById(pluginId);
      if (existing && existing.state !== 'UNINSTALLED') {
        throw new Error(`Plugin ${pluginId} is already installed`);
      }
    }

    // 获取插件元数据（从注册表）
    const availablePlugins = await this.listAvailablePlugins();
    const plugin = availablePlugins.find((p) => p.id === pluginId);

    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // 创建插件实例
    const pluginInfo: PluginInfo = {
      ...plugin,
      version,
      state: 'INSTALLED',
      installedAt: new Date(),
      updatedAt: new Date(),
      config,
    };

    // 保存到数据库
    if (this.pluginRepository) {
      await this.pluginRepository.create(pluginInfo);
    }

    this.plugins.set(pluginId, pluginInfo);

    // 发布事件
    await this.publishEvent('plugin.installed', {
      pluginId,
      version,
      installedAt: pluginInfo.installedAt,
    });

    logger.info({ pluginId }, 'Plugin installed');
    return pluginInfo;
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(pluginId: string): Promise<PluginInfo> {
    logger.info({ pluginId }, 'Uninstalling plugin');

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // 如果插件正在运行，先停用
    if (plugin.state === 'ACTIVE' || plugin.state === 'CONFIGURED') {
      await this.deactivatePlugin(pluginId);
    }

    plugin.state = 'UNINSTALLED';
    plugin.updatedAt = new Date();

    // 清理运行时信息
    this.runtimes.delete(pluginId);

    // 保存到数据库
    if (this.pluginRepository) {
      await this.pluginRepository.softDelete(pluginId);
      // Also update the full plugin record in DB to reflect the UNINSTALLED state
      await this.pluginRepository.updateState(pluginId, 'UNINSTALLED');
    }

    await this.publishEvent('plugin.uninstalled', {
      pluginId,
      uninstalledAt: new Date(),
    });

    logger.info({ pluginId }, 'Plugin uninstalled');
    return plugin;
  }

  /**
   * 激活插件
   */
  async activatePlugin(pluginId: string): Promise<PluginInfo> {
    logger.info({ pluginId }, 'Activating plugin');

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.state === 'UNINSTALLED') {
      throw new Error(`Plugin ${pluginId} is uninstalled`);
    }

    // 根据安全等级启动运行时
    const runtimeInfo = await this.startPluginRuntime(pluginId, plugin.securityLevel);

    plugin.state = 'ACTIVE';
    plugin.updatedAt = new Date();
    this.runtimes.set(pluginId, runtimeInfo);

    // Persist to database
    if (this.pluginRepository) {
      await this.pluginRepository.updateState(pluginId, 'ACTIVE');
    }

    await this.publishEvent('plugin.activated', {
      pluginId,
      activatedAt: new Date(),
    });

    logger.info({ pluginId }, 'Plugin activated');
    return plugin;
  }

  /**
   * 停用插件
   */
  async deactivatePlugin(pluginId: string): Promise<PluginInfo> {
    logger.info({ pluginId }, 'Deactivating plugin');

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // 停止运行时
    await this.stopPluginRuntime(pluginId);

    plugin.state = 'INACTIVE';
    plugin.updatedAt = new Date();

    // Persist to database
    if (this.pluginRepository) {
      await this.pluginRepository.updateState(pluginId, 'INACTIVE');
    }

    await this.publishEvent('plugin.deactivated', {
      pluginId,
      deactivatedAt: new Date(),
    });

    logger.info({ pluginId }, 'Plugin deactivated');
    return plugin;
  }

  /**
   * 配置插件
   */
  async configurePlugin(
    pluginId: string,
    config: Record<string, any>
  ): Promise<PluginInfo> {
    logger.info({ pluginId, config }, 'Configuring plugin');

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // 验证配置
    this.validateConfig(plugin, config);

    plugin.config = config;
    plugin.state = 'CONFIGURED';
    plugin.updatedAt = new Date();

    // Persist to database
    if (this.pluginRepository) {
      await this.pluginRepository.updateConfig(pluginId, config);
      await this.pluginRepository.updateState(pluginId, 'CONFIGURED');
    }

    await this.publishEvent('plugin.configured', {
      pluginId,
      configuredAt: new Date(),
    });

    logger.info({ pluginId }, 'Plugin configured');
    return plugin;
  }

  /**
   * 获取插件详情
   */
  async getPluginDetails(pluginId: string): Promise<PluginInfo & { runtimeInfo?: PluginRuntimeInfo }> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      // 从可用插件中查找
      const availablePlugins = await this.listAvailablePlugins();
      const availablePlugin = availablePlugins.find((p) => p.id === pluginId);

      if (!availablePlugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      return {
        ...availablePlugin,
      };
    }

    const runtimeInfo = this.runtimes.get(pluginId);

    return {
      ...plugin,
      runtimeInfo,
    };
  }

  /**
   * 列出已安装插件
   */
  async listInstalledPlugins(options?: {
    typeFilter?: PluginType;
    stateFilter?: PluginState;
  }): Promise<PluginInfo[]> {
    logger.info({ options }, 'Listing installed plugins');

    let installed = Array.from(this.plugins.values());

    if (options?.typeFilter) {
      installed = installed.filter((p) => p.type === options.typeFilter);
    }

    if (options?.stateFilter) {
      installed = installed.filter((p) => p.state === options.stateFilter);
    }

    return installed;
  }

  /**
   * 启动插件运行时
   */
  private async startPluginRuntime(
    pluginId: string,
    securityLevel: SecurityLevel
  ): Promise<PluginRuntimeInfo> {
    logger.info({ pluginId, securityLevel }, 'Starting plugin runtime');

    // 根据安全等级选择不同的运行时策略
    switch (securityLevel) {
      case 'HIGH':
        // WASM 沙箱
        return this.startWASMRuntime(pluginId);
      case 'MEDIUM':
        // 容器隔离
        return this.startContainerRuntime(pluginId);
      case 'LOW':
        // 独立进程
        return this.startProcessRuntime(pluginId);
    }
  }

  /**
   * 启动 WASM 运行时
   */
  private async startWASMRuntime(pluginId: string): Promise<PluginRuntimeInfo> {
    logger.info({ pluginId }, 'Starting WASM runtime (simulated)');

    // 模拟 WASM 运行时启动
    return {
      processId: `wasm-${pluginId}-${Date.now()}`,
      resourceUsage: {
        cpuPercent: 0,
        memoryBytes: 0,
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
      },
      healthChecks: [
        {
          checkName: 'wasm_sandbox',
          healthy: true,
          lastCheckedAt: new Date(),
        },
      ],
    };
  }

  /**
   * 启动容器运行时
   */
  private async startContainerRuntime(pluginId: string): Promise<PluginRuntimeInfo> {
    logger.info({ pluginId }, 'Starting container runtime (simulated)');

    return {
      containerId: `container-${pluginId}-${Date.now()}`,
      resourceUsage: {
        cpuPercent: 0,
        memoryBytes: 0,
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
      },
      healthChecks: [
        {
          checkName: 'container_health',
          healthy: true,
          lastCheckedAt: new Date(),
        },
      ],
    };
  }

  /**
   * 启动进程运行时
   */
  private async startProcessRuntime(pluginId: string): Promise<PluginRuntimeInfo> {
    logger.info({ pluginId }, 'Starting process runtime (simulated)');

    return {
      processId: `process-${pluginId}-${Date.now()}`,
      resourceUsage: {
        cpuPercent: 0,
        memoryBytes: 0,
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
      },
      healthChecks: [
        {
          checkName: 'process_alive',
          healthy: true,
          lastCheckedAt: new Date(),
        },
      ],
    };
  }

  /**
   * 停止插件运行时
   */
  private async stopPluginRuntime(pluginId: string): Promise<void> {
    logger.info({ pluginId }, 'Stopping plugin runtime');

    this.runtimes.delete(pluginId);
  }

  /**
   * 验证配置
   */
  private validateConfig(plugin: PluginInfo, config: Record<string, any>): void {
    for (const [key, field] of Object.entries(plugin.configSchema)) {
      if (field.required && !(key in config)) {
        throw new Error(`Missing required config field: ${key}`);
      }
    }
  }

  /**
   * 发布事件
   */
  private async publishEvent(type: string, data: any): Promise<void> {
    if (this.eventBus) {
      try {
        await this.eventBus.publish(type, data, { source: 'plugin-manager' });
      } catch (error) {
        logger.warn({ error, type }, 'Failed to publish event');
      }
    }
  }

  /**
   * 从数据库加载插件
   */
  async loadPluginsFromDatabase(): Promise<void> {
    if (!this.pluginRepository) {
      return;
    }

    try {
      // Load ALL plugins from DB, not just AVAILABLE ones
      const { plugins } = await this.pluginRepository.list({});

      for (const plugin of plugins) {
        this.plugins.set(plugin.id, plugin);
      }

      logger.info({ count: plugins.length }, 'Plugins loaded from database');
    } catch (error) {
      logger.error({ error }, 'Failed to load plugins from database');
    }
  }

  /**
   * 更新插件配置
   */
  async updatePluginConfig(pluginId: string, config: Record<string, any>): Promise<PluginInfo> {
    logger.info({ pluginId }, 'Updating plugin config');

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // 验证配置
    this.validateConfig(plugin, config);

    // 更新配置
    plugin.config = config;
    plugin.updatedAt = new Date();

    // 保存到数据库
    if (this.pluginRepository) {
      await this.pluginRepository.updateConfig(pluginId, config);
    }

    await this.publishEvent('plugin.config_updated', {
      pluginId,
      config,
      updatedAt: plugin.updatedAt,
    });

    logger.info({ pluginId }, 'Plugin config updated');
    return plugin;
  }

  /**
   * 更新插件状态
   */
  async updatePluginState(pluginId: string, state: PluginState): Promise<PluginInfo> {
    logger.info({ pluginId, state }, 'Updating plugin state');

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    plugin.state = state;
    plugin.updatedAt = new Date();

    // 保存到数据库
    if (this.pluginRepository) {
      await this.pluginRepository.updateState(pluginId, state);
    }

    await this.publishEvent('plugin.state_changed', {
      pluginId,
      state,
      updatedAt: plugin.updatedAt,
    });

    logger.info({ pluginId, state }, 'Plugin state updated');
    return plugin;
  }

  /**
   * 获取插件统计信息
   */
  async getPluginStats(): Promise<any> {
    if (!this.pluginRepository) {
      return {
        total: this.plugins.size,
        byType: {},
        byState: {}
      };
    }

    return await this.pluginRepository.getStats();
  }

  /**
   * 搜索插件
   */
  async searchPlugins(query: string): Promise<PluginInfo[]> {
    if (!this.pluginRepository) {
      return [];
    }

    const plugins = await this.pluginRepository.search(query);
    return plugins.map((plugin: PluginInfo) => {
      // Merge: preserve in-memory state if plugin already loaded
      const existing = this.plugins.get(plugin.id);
      if (existing) {
        // Update DB fields but keep runtime state from memory
        return { ...plugin, state: existing.state, config: existing.config, updatedAt: existing.updatedAt };
      }
      this.plugins.set(plugin.id, plugin);
      return plugin;
    });
  }

  /**
   * 添加插件标签
   */
  async addPluginTag(pluginId: string, tag: string): Promise<void> {
    if (!this.pluginRepository) {
      return;
    }

    await this.pluginRepository.addTag(pluginId, tag);
    
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.tags.push(tag);
      plugin.updatedAt = new Date();
    }

    logger.info({ pluginId, tag }, 'Plugin tag added');
  }

  /**
   * 移除插件标签
   */
  async removePluginTag(pluginId: string, tag: string): Promise<void> {
    if (!this.pluginRepository) {
      return;
    }

    await this.pluginRepository.removeTag(pluginId, tag);
    
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.tags = plugin.tags.filter(t => t !== tag);
      plugin.updatedAt = new Date();
    }

    logger.info({ pluginId, tag }, 'Plugin tag removed');
  }
}
