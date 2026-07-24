/**
 * Connector Configuration Service
 *
 * 提供连接器全局/分类配置的统一管理能力。
 * 支持为每种连接器类型设置独立的超时、重试、熔断器参数。
 */

import { createLogger } from '../../utils/logger';
import { ConnectorType, ConnectorConfig, ReconnectPolicy } from './InfrastructureService';

const logger = createLogger('Infrastructure-ConnectorConfig');

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * 连接器类型级配置覆盖
 */
export interface ConnectorTypeConfig {
  /** 连接超时（毫秒），默认 5000 */
  timeoutMs: number;
  /** 最大重试次数，默认 5 */
  maxRetries: number;
  /** 重连初始退避延迟（毫秒），默认 1000 */
  reconnectInitialDelayMs: number;
  /** 重连最大退避延迟（毫秒），默认 30000 */
  reconnectMaxDelayMs: number;
  /** 熔断失败阈值，默认 5 */
  circuitBreakerFailureThreshold: number;
  /** 熔断恢复超时（毫秒），默认 60000 */
  circuitBreakerRecoveryTimeoutMs: number;
}

/**
 * 完整连接器配置（全局 + 类型覆盖）
 */
export interface ConnectorConfiguration {
  /** 全局默认配置 */
  defaults: Required<Omit<ConnectorConfig, 'type' | 'name' | 'endpoint' | 'credentials'>>;
  /** 按类型的配置覆盖 */
  typeOverrides: Partial<Record<ConnectorType, ConnectorTypeConfig>>;
}

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_TYPE_CONFIG: ConnectorTypeConfig = {
  timeoutMs: 5000,
  maxRetries: 5,
  reconnectInitialDelayMs: 1000,
  reconnectMaxDelayMs: 30000,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerRecoveryTimeoutMs: 60000,
};

const DEFAULT_GLOBAL_CONFIG = {
  timeoutMs: 5000,
  maxRetries: 5,
  metadata: {},
};

// ============================================================================
// ConnectorConfigService
// ============================================================================

/**
 * 连接器配置服务
 *
 * 职责:
 * 1. 管理全局默认连接器配置
 * 2. 按连接器类型维护配置覆盖
 * 3. 根据连接器类型返回最终生效的配置
 * 4. 支持运行时动态更新配置
 */
export class ConnectorConfigService {
  private globalDefaults: Required<Omit<ConnectorConfig, 'type' | 'name' | 'endpoint' | 'credentials'>>;
  private typeOverrides: Map<ConnectorType, ConnectorTypeConfig>;

  constructor(initialConfig?: Partial<ConnectorConfiguration>) {
    this.globalDefaults = {
      ...DEFAULT_GLOBAL_CONFIG,
      ...(initialConfig?.defaults ?? {}),
    };
    this.typeOverrides = new Map();

    // 初始化各类型配置
    for (const type of Object.values(ConnectorType)) {
      const override = initialConfig?.typeOverrides?.[type];
      this.typeOverrides.set(type, { ...DEFAULT_TYPE_CONFIG, ...override });
    }

    logger.info(
      { globalDefaults: this.globalDefaults, typeCount: this.typeOverrides.size },
      'ConnectorConfigService initialized'
    );
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * 获取全局默认配置
   */
  getGlobalDefaults(): Required<Omit<ConnectorConfig, 'type' | 'name' | 'endpoint' | 'credentials'>> {
    return { ...this.globalDefaults };
  }

  /**
   * 获取指定类型的配置覆盖
   */
  getTypeConfig(type: ConnectorType): ConnectorTypeConfig {
    return this.typeOverrides.get(type) ?? { ...DEFAULT_TYPE_CONFIG };
  }

  /**
   * 根据类型返回完整的 ReconnectPolicy
   */
  getReconnectPolicy(type: ConnectorType): ReconnectPolicy {
    const cfg = this.getTypeConfig(type);
    return {
      maxRetries: cfg.maxRetries,
      initialDelayMs: cfg.reconnectInitialDelayMs,
      maxDelayMs: cfg.reconnectMaxDelayMs,
      backoffMultiplier: 2,
      jitterMs: 500,
    };
  }

  /**
   * 根据类型返回连接超时（毫秒）
   */
  getTimeoutMs(type: ConnectorType): number {
    return this.getTypeConfig(type).timeoutMs;
  }

  /**
   * 根据类型返回熔断器配置
   */
  getCircuitBreakerConfig(type: ConnectorType): { failureThreshold: number; recoveryTimeoutMs: number; successThreshold: number } {
    const cfg = this.getTypeConfig(type);
    return {
      failureThreshold: cfg.circuitBreakerFailureThreshold,
      recoveryTimeoutMs: cfg.circuitBreakerRecoveryTimeoutMs,
      successThreshold: 1,
    };
  }

  // ==========================================================================
  // Mutation Methods
  // ==========================================================================

  /**
   * 更新全局默认配置
   */
  updateGlobalDefaults(partial: Partial<Required<Omit<ConnectorConfig, 'type' | 'name' | 'endpoint' | 'credentials'>>>): void {
    this.globalDefaults = { ...this.globalDefaults, ...partial };
    logger.info({ updated: partial }, 'Global connector defaults updated');
  }

  /**
   * 更新指定类型的配置覆盖
   */
  updateTypeConfig(type: ConnectorType, partial: Partial<ConnectorTypeConfig>): void {
    const existing = this.typeOverrides.get(type) ?? { ...DEFAULT_TYPE_CONFIG };
    this.typeOverrides.set(type, { ...existing, ...partial });
    logger.info({ type, updated: partial }, 'Connector type config updated');
  }

  /**
   * 批量导入配置
   */
  importConfig(config: Partial<ConnectorConfiguration>): void {
    if (config.defaults) {
      this.updateGlobalDefaults(config.defaults);
    }
    if (config.typeOverrides) {
      for (const [type, override] of Object.entries(config.typeOverrides)) {
        this.updateTypeConfig(type as ConnectorType, override);
      }
    }
  }

  /**
   * 导出当前完整配置快照
   */
  exportConfig(): ConnectorConfiguration {
    const typeOverrides: Record<string, ConnectorTypeConfig> = {};
    for (const [type, cfg] of this.typeOverrides.entries()) {
      typeOverrides[type] = { ...cfg };
    }
    return {
      defaults: { ...this.globalDefaults },
      typeOverrides,
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * 将 ConnectorTypeConfig 合并到 ConnectorConfig
   */
  applyTypeConfigToConnectorConfig(base: ConnectorConfig): ConnectorConfig {
    const typeCfg = this.getTypeConfig(base.type);
    return {
      ...base,
      timeoutMs: base.timeoutMs ?? typeCfg.timeoutMs,
      maxRetries: base.maxRetries ?? typeCfg.maxRetries,
      metadata: base.metadata ?? {},
    };
  }
}
