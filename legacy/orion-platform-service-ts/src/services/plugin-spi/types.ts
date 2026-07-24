/**
 * Plugin SPI Types
 *
 * Type definitions for the Plugin SPI (Service Provider Interface) system.
 * Covers plugin manifests, lifecycle states, execution results, sandbox configs,
 * and dependency management.
 */

/**
 * Plugin status in the lifecycle
 */
export type PluginStatus = 'installed' | 'enabled' | 'disabled' | 'error' | 'uninstalling';

/**
 * Security level for plugin sandboxing
 */
export type PluginSecurityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Plugin capability that it provides to the system
 */
export type PluginCapability =
  | 'CUSTOM_TASK'
  | 'WEBHOOK_HANDLER'
  | 'AI_SKILL'
  | 'APPROVAL_PROVIDER'
  | 'NOTIFICATION_CHANNEL'
  | 'DEPLOYMENT_STRATEGY'
  | 'SECURITY_SCANNER'
  | 'CODE_ANALYZER'
  | 'TEST_RUNNER';

/**
 * Plugin manifest - metadata describing a plugin
 */
export interface PluginManifest {
  /** Unique plugin identifier (e.g., "com.orion.security-scan") */
  name: string;
  /** Semantic version string (e.g., "1.2.3") */
  version: string;
  /** Human-readable description */
  description: string;
  /** Author or organization */
  author: string;
  /** Plugin entry point file path or module name */
  entryPoint: string;
  /** Capabilities this plugin provides */
  capabilities: PluginCapability[];
  /** Plugin-to-plugin dependencies */
  dependencies: PluginDependency[];
  /** Minimum platform version this plugin requires */
  minPlatformVersion?: string;
  /** Maximum platform version this plugin supports */
  maxPlatformVersion?: string;
  /** Security level requirement */
  securityLevel?: PluginSecurityLevel;
  /** Plugin tags for categorization */
  tags?: string[];
  /** Plugin icon URL or path */
  icon?: string;
  /** Homepage URL */
  homepage?: string;
  /** License identifier */
  license?: string;
}

/**
 * Plugin-to-plugin dependency declaration
 */
export interface PluginDependency {
  /** Name of the depended-on plugin */
  name: string;
  /** Semver range (e.g., ">=1.0.0 <2.0.0") */
  version: string;
  /** Whether this dependency is optional */
  optional?: boolean;
}

/**
 * Resource limits for plugin sandbox
 */
export interface PluginSandboxConfig {
  /** Memory limit in bytes */
  memoryLimit: number;
  /** Execution timeout in milliseconds */
  timeout: number;
  /** Maximum CPU cores */
  cpuCores: number;
  /** Maximum concurrent executions */
  maxConcurrent: number;
  /** Allowed file system paths */
  allowedPaths?: string[];
  /** Allowed network hosts */
  allowedHosts?: string[];
  /** Allowed environment variables */
  allowedEnvVars?: string[];
  /** Whether to enable output DLP sanitization */
  enableDLPSanitization?: boolean;
}

/**
 * Full plugin info combining manifest, status, and runtime metadata
 */
export interface PluginInfo {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Plugin version (derived from manifest) */
  version: string;
  /** Current lifecycle status */
  status: PluginStatus;
  /** Installation timestamp */
  installDate: Date;
  /** Last enabled timestamp */
  enabledDate?: Date;
  /** Last error message if status is 'error' */
  error?: string;
  /** Plugin configuration */
  config?: Record<string, any>;
  /** Sandbox configuration overrides */
  sandboxConfig?: PluginSandboxConfig;
}

/**
 * Result of a plugin execution
 */
export interface PluginExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Execution output data */
  output?: Record<string, any>;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Whether execution was killed */
  killed?: boolean;
  /** Reason for kill */
  killReason?: string;
}

/**
 * Default sandbox configuration by security level
 */
export const DEFAULT_SANDBOX_CONFIGS: Record<PluginSecurityLevel, PluginSandboxConfig> = {
  HIGH: {
    memoryLimit: 512 * 1024 * 1024, // 512MB
    timeout: 30000, // 30s
    cpuCores: 1,
    maxConcurrent: 5,
    enableDLPSanitization: true,
  },
  MEDIUM: {
    memoryLimit: 1024 * 1024 * 1024, // 1GB
    timeout: 60000, // 60s
    cpuCores: 2,
    maxConcurrent: 10,
    enableDLPSanitization: true,
  },
  LOW: {
    memoryLimit: 2 * 1024 * 1024 * 1024, // 2GB
    timeout: 120000, // 120s
    cpuCores: 4,
    maxConcurrent: 20,
    enableDLPSanitization: false,
  },
};

/**
 * Plugin health status
 */
export interface PluginHealthStatus {
  pluginId: string;
  healthy: boolean;
  lastChecked: Date;
  message?: string;
  metrics?: {
    executionCount: number;
    successRate: number;
    avgDurationMs: number;
    errorCount: number;
  };
}

/**
 * Dependency resolution result
 */
export interface DependencyResolutionResult {
  /** Resolved install order */
  installOrder: string[];
  /** Plugins with missing dependencies */
  missing: { pluginId: string; missingDependency: string }[];
  /** Circular dependency cycles detected */
  cycles: string[][];
  /** Whether resolution was successful */
  resolved: boolean;
}

/**
 * Plugin event types
 */
export type PluginEventType =
  | 'plugin:registered'
  | 'plugin:installed'
  | 'plugin:enabled'
  | 'plugin:disabled'
  | 'plugin:uninstalling'
  | 'plugin:uninstalled'
  | 'plugin:error'
  | 'plugin:executing'
  | 'plugin:executed';

/**
 * Platform version for compatibility checking
 */
export const PLATFORM_VERSION = '1.0.0';

/**
 * Isolation Tier - 插件执行隔离等级
 */
export type PluginIsolationTier = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';

/**
 * Inline Script Level - 用户脚本安全能力等级
 */
export type InlineScriptLevel = 'safe' | 'standard' | 'advanced';

/**
 * Inline Script 权限配置
 */
export interface InlineScriptPermissions {
  network?: string[];      // 允许的域名白名单
  files?: {
    read?: string[];       // 允许读取的路径
    write?: string[];      // 允许写入的路径
  };
  commands?: string[];     // 允许执行的命令
  envVars?: string[];      // 允许读取的环境变量
  kubernetes?: boolean;    // 是否允许 K8s API (advanced only)
  database?: string[];     // 允许连接的数据库 (advanced only)
}

/**
 * Inline Script 配置
 */
export interface InlineScriptConfig {
  level: InlineScriptLevel;
  language: string;         // 'javascript', 'python' 等
  code: string;
  permissions?: InlineScriptPermissions;
  approvalId?: string;      // advanced level 需要审批 ID
}

/**
 * 插件源类型
 */
export type PluginSource = 'builtin' | 'marketplace' | 'remote' | 'inline-script';

/**
 * 扩展后的插件信息（包含源和隔离层）
 */
export interface ExtendedPluginInfo extends PluginInfo {
  source: PluginSource;
  isolationTier: PluginIsolationTier;
  marketplaceId?: string;   // Marketplace 插件 ID
}
