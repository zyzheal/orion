/**
 * Plugin SPI Service Module
 *
 * Exports all components of the Plugin SPI (Service Provider Interface) system:
 * - PluginService: Main orchestration service
 * - PluginRegistry: Registration and discovery
 * - PluginLifecycleManager: Lifecycle management
 * - PluginSandboxSPI: Execution sandbox
 * - PluginDependencyResolver: Dependency management
 * - Types: All shared type definitions
 */

export { PluginService } from './PluginService';
export { PluginRegistry } from './PluginRegistry';
export { PluginLifecycleManager } from './PluginLifecycleManager';
export { PluginSandboxSPI } from './PluginSandbox';
export { PluginDependencyResolver } from './PluginDependencyResolver';

export type {
  PluginManifest,
  PluginDependency,
  PluginStatus,
  PluginSecurityLevel,
  PluginCapability,
  PluginInfo,
  PluginExecutionResult,
  PluginSandboxConfig,
  PluginHealthStatus,
  DependencyResolutionResult,
  PluginEventType,
  PluginIsolationTier,
  InlineScriptLevel,
  InlineScriptPermissions,
  InlineScriptConfig,
  PluginSource,
  ExtendedPluginInfo,
} from './types';

export { DEFAULT_SANDBOX_CONFIGS, PLATFORM_VERSION } from './types';
