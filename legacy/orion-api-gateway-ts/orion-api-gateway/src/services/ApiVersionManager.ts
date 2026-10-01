/**
 * API 版本管理器
 *
 * 提供版本注册、协商、状态管理和弃用告警功能
 */

import {
  ApiVersionRegistry,
  VersionDefinition,
  VersionStatus,
  DeprecationNotice,
} from './ApiVersionRegistry';
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

/**
 * 版本协商结果
 */
export interface VersionNegotiationResult {
  requestedVersion: string | null;
  resolvedVersion: string;
  source: 'header' | 'url' | 'default';
  isDeprecated: boolean;
  deprecationNotice?: DeprecationNotice;
}

/**
 * 版本协商选项
 */
export interface VersionNegotiationOptions {
  headerName?: string;          // Header 名称，默认 'x-api-version'
  urlPrefix?: string;           // URL 前缀，默认 '/api/'
  fallbackToDefault?: boolean;  // 无版本时是否回退到默认版本
  rejectRetired?: boolean;      // 是否拒绝已退役版本
  warnDeprecated?: boolean;     // 是否警告已弃用版本
}

/**
 * API 版本警告响应头
 */
export interface VersionWarningHeaders {
  'X-API-Version': string;
  'X-API-Deprecated'?: string;
  'X-API-Deprecation-Date'?: string;
  'X-API-Sunset-Date'?: string;
  'X-API-Migration-Guide'?: string;
  'Warning'?: string;
}

/**
 * API 版本管理器
 *
 * 管理版本协商、状态转换和弃用告警
 */
export class ApiVersionManager {
  private registry: ApiVersionRegistry;
  private options: Required<VersionNegotiationOptions>;
  private deprecationWarnings: Map<string, Set<string>> = new Map(); // version -> Set of clientIds

  constructor(
    registry: ApiVersionRegistry,
    options?: VersionNegotiationOptions
  ) {
    this.registry = registry;
    this.options = {
      headerName: options?.headerName || 'x-api-version',
      urlPrefix: options?.urlPrefix || '/api/',
      fallbackToDefault: options?.fallbackToDefault ?? true,
      rejectRetired: options?.rejectRetired ?? true,
      warnDeprecated: options?.warnDeprecated ?? true,
    };

    // 监听注册表事件
    this.setupEventListeners();
  }

  /**
   * 初始化版本管理器
   */
  async initialize(): Promise<void> {
    // 注册默认版本（如果未注册）
    const config = this.registry.getConfig();

    if (!this.registry.hasVersion(config.currentVersion)) {
      this.registry.registerVersion({
        version: config.currentVersion,
        status: 'stable',
        features: ['core'],
      });
    }

    if (config.defaultVersion !== config.currentVersion && !this.registry.hasVersion(config.defaultVersion)) {
      this.registry.registerVersion({
        version: config.defaultVersion,
        status: 'stable',
        features: ['core'],
      });
    }
  }

  /**
   * 版本协商
   *
   * Header 优先，URL 其次，最后默认版本
   */
  negotiateVersion(request: FastifyRequest): VersionNegotiationResult {
    const { headerName, urlPrefix, fallbackToDefault, rejectRetired } = this.options;

    // 1. 从 Header 提取版本
    const headerVersion = request.headers[headerName] as string | undefined;
    if (headerVersion) {
      const parsed = this.registry.parseVersion(headerVersion);
      if (parsed && this.registry.hasVersion(parsed)) {
        return this.buildNegotiationResult(parsed, 'header', request);
      }
    }

    // 2. 从 URL 提取版本
    const url = request.url || request.originalUrl || '';
    const urlMatch = url.match(new RegExp(`${urlPrefix.replace(/\//g, '\\/')}([^/]+)`));
    if (urlMatch) {
      const parsed = this.registry.parseVersion(urlMatch[1]);
      if (parsed && this.registry.hasVersion(parsed)) {
        return this.buildNegotiationResult(parsed, 'url', request);
      }
    }

    // 3. 使用默认版本
    if (fallbackToDefault) {
      const defaultVersion = this.registry.getConfig().defaultVersion;
      return this.buildNegotiationResult(defaultVersion, 'default', request);
    }

    // 4. 无法确定版本
    throw new Error('Unable to determine API version');
  }

  /**
   * 构建协商结果
   */
  private buildNegotiationResult(
    version: string,
    source: 'header' | 'url' | 'default',
    request: FastifyRequest
  ): VersionNegotiationResult {
    const versionDef = this.registry.getVersion(version);
    const isDeprecated = this.registry.isVersionDeprecated(version);
    const deprecationNotice = isDeprecated ? this.registry.getDeprecationNotice(version) : undefined;

    // 检查是否拒绝已退役版本
    if (this.options.rejectRetired && versionDef?.status === 'retired') {
      throw new Error(`API version ${version} has been retired and is no longer available`);
    }

    // 记录弃用警告
    if (isDeprecated && this.options.warnDeprecated) {
      const clientId = this.getClientId(request);
      this.recordDeprecationWarning(version, clientId);
    }

    return {
      requestedVersion: version,
      resolvedVersion: version,
      source,
      isDeprecated,
      deprecationNotice,
    };
  }

  /**
   * 获取版本警告头
   */
  getVersionWarningHeaders(result: VersionNegotiationResult): VersionWarningHeaders {
    const headers: VersionWarningHeaders = {
      'X-API-Version': result.resolvedVersion,
    };

    if (result.isDeprecated && result.deprecationNotice) {
      const notice = result.deprecationNotice;
      headers['X-API-Deprecated'] = 'true';
      headers['X-API-Deprecation-Date'] = notice.deprecationDate.toISOString().split('T')[0];
      headers['X-API-Sunset-Date'] = notice.sunsetDate.toISOString().split('T')[0];

      if (notice.migrationGuide) {
        headers['X-API-Migration-Guide'] = notice.migrationGuide;
      }

      // RFC 7234 Warning header
      headers['Warning'] = `299 - "API version ${result.resolvedVersion} is deprecated and will be removed on ${notice.sunsetDate.toISOString().split('T')[0]}"`;
    }

    return headers;
  }

  /**
   * 注册版本
   */
  registerVersion(
    version: string,
    status: VersionStatus,
    options?: {
      features?: string[];
      breakingChanges?: string[];
      successorVersion?: string;
      migrationGuide?: string;
      changelog?: string;
    }
  ): VersionDefinition {
    return this.registry.registerVersion({
      version,
      status,
      features: options?.features || [],
      breakingChanges: options?.breakingChanges,
      successorVersion: options?.successorVersion,
      migrationGuide: options?.migrationGuide,
      changelog: options?.changelog,
    });
  }

  /**
   * 弃用版本
   */
  deprecateVersion(
    version: string,
    options: {
      deprecationDate: Date;
      sunsetDate: Date;
      migrationGuide?: string;
      changedBy?: string;
      reason?: string;
    }
  ): VersionDefinition {
    return this.registry.updateVersionStatus(version, 'deprecated', options);
  }

  /**
   * 退役版本
   */
  retireVersion(
    version: string,
    options?: {
      changedBy?: string;
      reason?: string;
    }
  ): VersionDefinition {
    return this.registry.updateVersionStatus(version, 'retired', options);
  }

  /**
   * 获取版本信息
   */
  getVersion(version: string): VersionDefinition | undefined {
    return this.registry.getVersion(version);
  }

  /**
   * 获取所有版本
   */
  getAllVersions(): VersionDefinition[] {
    return this.registry.getAllVersions();
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(): VersionDefinition | undefined {
    return this.registry.getCurrentVersion();
  }

  /**
   * 获取支持的版本
   */
  getSupportedVersions(): VersionDefinition[] {
    return this.registry.getSupportedVersions();
  }

  /**
   * 获取弃用公告
   */
  getDeprecationNotice(version: string): DeprecationNotice | undefined {
    return this.registry.getDeprecationNotice(version);
  }

  /**
   * 获取所有弃用公告
   */
  getAllDeprecationNotices(): DeprecationNotice[] {
    return this.registry.getAllDeprecationNotices();
  }

  /**
   * 获取版本变更历史
   */
  getVersionHistory(version?: string) {
    return this.registry.getVersionHistory(version);
  }

  /**
   * 检查版本兼容性
   */
  checkCompatibility(requestedVersion: string, minimumVersion: string): {
    compatible: boolean;
    message?: string;
  } {
    const comparison = this.registry.compareVersions(requestedVersion, minimumVersion);

    if (comparison < 0) {
      return {
        compatible: false,
        message: `Version ${requestedVersion} is not compatible. Minimum required: ${minimumVersion}`,
      };
    }

    return { compatible: true };
  }

  /**
   * 获取客户端 ID（用于追踪弃用警告）
   */
  private getClientId(request: FastifyRequest): string {
    // 优先使用认证用户 ID
    const authContext = (request as any).authContext;
    if (authContext?.user?.sub) {
      return `user:${authContext.user.sub}`;
    }

    // 使用 IP 地址
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  /**
   * 记录弃用警告
   */
  private recordDeprecationWarning(version: string, clientId: string): void {
    if (!this.deprecationWarnings.has(version)) {
      this.deprecationWarnings.set(version, new Set());
    }
    this.deprecationWarnings.get(version)!.add(clientId);
  }

  /**
   * 获取弃用警告统计
   */
  getDeprecationWarningStats(): Map<string, number> {
    const stats = new Map<string, number>();
    this.deprecationWarnings.forEach((clients, version) => {
      stats.set(version, clients.size);
    });
    return stats;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.registry.on('version:registered', (version: VersionDefinition) => {
      console.log(`[ApiVersionManager] Version registered: ${version.version} (${version.status})`);
    });

    this.registry.on('version:status:changed', (data: any) => {
      console.log(
        `[ApiVersionManager] Version status changed: ${data.version.version} (${data.previousStatus} -> ${data.newStatus})`
      );
    });

    this.registry.on('deprecation:notice', (notice: DeprecationNotice) => {
      console.log(
        `[ApiVersionManager] Deprecation notice: ${notice.version} (sunset: ${notice.sunsetDate.toISOString().split('T')[0]})`
      );
    });
  }

  /**
   * 获取注册表（用于高级操作）
   */
  getRegistry(): ApiVersionRegistry {
    return this.registry;
  }
}

// 默认导出
export { VersionDefinition, VersionStatus, DeprecationNotice } from './ApiVersionRegistry';