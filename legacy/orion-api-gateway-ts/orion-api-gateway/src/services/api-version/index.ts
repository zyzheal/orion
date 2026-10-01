/**
 * API 版本管理模块导出
 */

export {
  ApiVersionRegistry,
  VersionDefinition,
  VersionStatus,
  VersionChangeRecord,
  DeprecationNotice,
  ApiVersionRegistryConfig,
  versionRegistry,
} from '../ApiVersionRegistry';

export {
  ApiVersionManager,
  VersionNegotiationResult,
  VersionNegotiationOptions,
  VersionWarningHeaders,
} from '../ApiVersionManager';