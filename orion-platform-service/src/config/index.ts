/**
 * Configuration Services Index
 * 
 * 统一配置服务模块索引
 */

export { 
  UnifiedConfigService,
  config,
  SystemConfig,
  unifiedConfig,
} from './UnifiedConfigService';

export { 
  default as ConfigVersionService,
  ConfigVersion,
  ConfigSnapshot,
} from '../services/config/ConfigVersionService';

export { 
  default as configEventBus,
  ConfigChangeEvent,
  ConfigHealthEvent,
} from '../services/config/ConfigEventBus';

export { 
  default as ConfigMonitoring,
  checkConfigHealth,
  getMetrics,
  recordConfigLoad,
  recordConfigUpdate,
  recordConfigError,
  addConfigHealthRoutes,
} from '../services/config/ConfigMonitoring';

export { 
  default as ConfigFallbackService,
  ConfigLevel,
  FallbackConfig,
} from '../services/config/ConfigFallbackService';

export { 
  default as RedisConfigCache,
  redisConfigCache,
} from '../services/config/RedisConfigCache';

export { 
  default as configSearchService,
  ConfigMetadata,
  CONFIG_METADATA,
} from '../services/config/ConfigSearchService';

export { 
  default as ConfigGitOpsService,
  GitOpsConfig,
} from '../services/config/ConfigGitOpsService';

export {
  ExtendedSystemConfig,
  EXTENDED_DEFAULTS,
} from './ExtendedConfig';

export {
  EnterpriseSystemConfig,
  ENTERPRISE_DEFAULTS,
} from './EnterpriseConfig';