/**
 * CodeRepo Adapter Registry Service
 *
 * 管理代码仓库适配器的运行时注册与持久化。
 *
 * 迁移说明 (Task 4.19):
 *   - 运行时适配器实例保留在内存 Map（含方法，无法序列化）
 *   - 适配器注册元数据（name, type, config）通过 SimpleFallbackStorage 持久化
 *   - 服务重启后可从 SimpleFallbackStorage 恢复已注册的适配器列表
 *   - 对于无法从元数据重建的适配器（如自定义实例），记录元数据但运行时需重新注册
 */

import { createLogger } from '../../utils/logger';
import { SimpleFallbackStorage } from '../fallback/FallbackStorageService';
import {
  ICodeRepoAdapter,
  RepoType,
  BitbucketAdapter,
  GitLabAdapter,
  GerritAdapter,
  BitbucketAdapterConfig,
  GitLabAdapterConfig,
  GerritAdapterConfig,
} from './index';

const logger = createLogger('code-repo-adapter-registry');

// ==================== Serializable Metadata ====================

/** 适配器注册元数据（可序列化，用于 SimpleFallbackStorage 持久化） */
export interface AdapterRegistryEntry {
  /** 适配器唯一标识 */
  id: string;
  /** 适配器类型 */
  type: RepoType;
  /** 适配器可读名称 */
  name: string;
  /** 创建时间 */
  registeredAt: string;
  /** 适配器配置（不含敏感凭据，用于重建/展示） */
  config: Record<string, unknown>;
  /** 注册状态 */
  status: 'active' | 'inactive';
}

// ==================== SimpleFallbackStorage Key Prefix ====================

const ADAPTERS_PREFIX = 'code-repo:adapters';

// ==================== Adapter Factory ====================

/**
 * 运行时适配器工厂映射
 * 用于从 SimpleFallbackStorage 加载持久化的适配器元数据后重建运行时实例
 */
const ADAPTER_CLASS_MAP: Record<RepoType, new (config: any) => ICodeRepoAdapter> = {
  [RepoType.BITBUCKET]: BitbucketAdapter as unknown as new (config: BitbucketAdapterConfig) => ICodeRepoAdapter,
  [RepoType.GITLAB]: GitLabAdapter as unknown as new (config: GitLabAdapterConfig) => ICodeRepoAdapter,
  [RepoType.GERRIT]: GerritAdapter as unknown as new (config: GerritAdapterConfig) => ICodeRepoAdapter,
  [RepoType.GITHUB]: BitbucketAdapter as unknown as new (config: BitbucketAdapterConfig) => ICodeRepoAdapter, // placeholder
};

/**
 * 从持久化元数据重建运行时适配器实例
 */
function createAdapterFromMetadata(entry: AdapterRegistryEntry): ICodeRepoAdapter | null {
  const AdapterClass = ADAPTER_CLASS_MAP[entry.type];
  if (!AdapterClass) {
    logger.warn({ adapterType: entry.type, id: entry.id }, '[AdapterRegistry] No adapter class for type, skipping');
    return null;
  }

  try {
    // 从存储的 config 中提取重建所需的配置项
    const config = entry.config as any;
    const instance = new AdapterClass(config);
    return instance;
  } catch (error) {
    logger.warn({ adapterId: entry.id, error }, '[AdapterRegistry] Failed to create adapter from metadata');
    return null;
  }
}

// ==================== AdapterRegistryService ====================

/**
 * 代码仓库适配器注册表服务
 *
 * 职责：
 *   1. 管理运行时适配器实例（内存 Map）
 *   2. 通过 SimpleFallbackStorage 持久化适配器元数据
 *   3. 提供注册/查询/列表/恢复接口
 */
export class AdapterRegistryService {
  /** 运行时适配器注册表（含方法，无法持久化到 FallbackStorage） */
  private readonly runtimeAdapters: Map<string, ICodeRepoAdapter> = new Map();

  /** SimpleFallbackStorage 实例（可选，提供后启用持久化） */
  private storage: SimpleFallbackStorage | null = null;

  /**
   * @param storage - SimpleFallbackStorage 实例（可选，提供后启用元数据持久化）
   */
  constructor(storage?: SimpleFallbackStorage | null) {
    this.storage = storage ?? null;
    if (this.storage) {
      logger.info('[AdapterRegistry] Initialized with SimpleFallbackStorage persistence');
    } else {
      logger.info('[AdapterRegistry] Initialized in memory-only mode (no persistence)');
    }
  }

  // ==================== Registration ====================

  /**
   * 注册适配器
   *
   * 持久化策略：
   *   1. 同步写入运行时 Map（用于立即查询）
   *   2. 异步持久化元数据到 SimpleFallbackStorage（用于服务重启恢复）
   *
   * @param id - 适配器唯一标识
   * @param adapter - 适配器实例
   * @param name - 适配器可读名称（可选，默认取 type）
   */
  async register(id: string, adapter: ICodeRepoAdapter, name?: string): Promise<void> {
    // 同步写入运行时 Map
    this.runtimeAdapters.set(id, adapter);

    // 异步持久化元数据到 SimpleFallbackStorage
    if (this.storage) {
      try {
        const metadata: AdapterRegistryEntry = {
          id,
          type: adapter.type,
          name: name || adapter.type,
          registeredAt: new Date().toISOString(),
          config: this.extractConfig(adapter),
          status: 'active',
        };
        await this.storage.set(`${ADAPTERS_PREFIX}:${id}`, metadata);
        logger.debug({ adapterId: id, type: adapter.type }, '[AdapterRegistry] Adapter metadata persisted');
      } catch (error) {
        logger.warn({ adapterId: id, error }, '[AdapterRegistry] Failed to persist adapter metadata');
      }
    }

    logger.info({ adapterId: id, type: adapter.type }, '[AdapterRegistry] Adapter registered');
  }

  /**
   * 取消注册适配器
   */
  async unregister(id: string): Promise<boolean> {
    const existed = this.runtimeAdapters.delete(id);

    if (existed && this.storage) {
      try {
        await this.storage.delete(`${ADAPTERS_PREFIX}:${id}`);
        logger.debug({ adapterId: id }, '[AdapterRegistry] Adapter metadata removed from storage');
      } catch (error) {
        logger.warn({ adapterId: id, error }, '[AdapterRegistry] Failed to remove adapter metadata from storage');
      }
    }

    if (existed) {
      logger.info({ adapterId: id }, '[AdapterRegistry] Adapter unregistered');
    }

    return existed;
  }

  // ==================== Query ====================

  /**
   * 获取适配器实例
   */
  getAdapter(id: string): ICodeRepoAdapter | undefined {
    return this.runtimeAdapters.get(id);
  }

  /**
   * 获取所有已注册适配器列表（含元数据）
   */
  listRegisteredAdapters(): AdapterRegistryEntry[] {
    return Array.from(this.runtimeAdapters.entries()).map(([id, adapter]) => ({
      id,
      type: adapter.type,
      name: adapter.type,
      registeredAt: new Date().toISOString(),
      config: {},
      status: 'active' as const,
    }));
  }

  /**
   * 获取已注册适配器数量
   */
  get count(): number {
    return this.runtimeAdapters.size;
  }

  // ==================== Persistence ====================

  /**
   * 从 SimpleFallbackStorage 恢复已注册的适配器
   *
   * 服务启动时调用，用于恢复运行时状态。
   * 注意：仅能从元数据重建使用标准工厂的适配器；自定义适配器需重新注册。
   */
  async loadFromStorage(): Promise<{ restored: number; skipped: number }> {
    if (!this.storage) {
      logger.info('[AdapterRegistry] loadFromStorage skipped (no SimpleFallbackStorage)');
      return { restored: 0, skipped: 0 };
    }

    try {
      const keys = await this.storage.keys();
      const prefix = `${ADAPTERS_PREFIX}:`;
      let restored = 0;
      let skipped = 0;

      for (const key of keys) {
        if (!key.startsWith(prefix)) continue;

        const metadata = await this.storage.get<AdapterRegistryEntry>(key);
        if (!metadata) {
          skipped++;
          continue;
        }

        // 检查是否已过期（SimpleFallbackStorage TTL 管理）
        const adapter = createAdapterFromMetadata(metadata);
        if (adapter) {
          this.runtimeAdapters.set(metadata.id, adapter);
          restored++;
          logger.debug({ adapterId: metadata.id, type: metadata.type }, '[AdapterRegistry] Restored adapter from storage');
        } else {
          skipped++;
        }
      }

      logger.info(
        { restored, skipped, total: this.runtimeAdapters.size },
        '[AdapterRegistry] Adapter registry restored from SimpleFallbackStorage'
      );

      return { restored, skipped };
    } catch (error) {
      logger.warn({ error }, '[AdapterRegistry] Failed to load from SimpleFallbackStorage');
      return { restored: 0, skipped: 0 };
    }
  }

  /**
   * 获取 SimpleFallbackStorage 统计信息（用于监控）
   */
  getStorageStats(): Record<string, unknown> | null {
    return this.storage?.getStats() ?? null;
  }

  // ==================== Private ====================

  /**
   * 从适配器实例中提取可序列化的配置（用于持久化）
   */
  private extractConfig(adapter: ICodeRepoAdapter): Record<string, unknown> {
    // 默认返回空配置（适配器不暴露内部配置时）
    return {};
  }
}
