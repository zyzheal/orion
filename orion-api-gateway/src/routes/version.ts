/**
 * API 版本管理器
 *
 * 处理 API 版本控制、版本路由和弃用通知
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * API 版本信息
 */
export interface ApiVersion {
  version: string;
  status: 'beta' | 'stable' | 'deprecated' | 'withdrawn';
  releaseDate: string;
  deprecationDate?: string;
  withdrawalDate?: string;
  successor?: string;
  migrationGuide?: string;
}

/**
 * 版本配置
 */
export interface VersionConfig {
  currentVersion: string;
  supportedVersions: ApiVersion[];
  defaultDeprecationPeriodMonths: number;
}

/**
 * 默认版本配置
 */
const DEFAULT_VERSION_CONFIG: VersionConfig = {
  currentVersion: 'v1',
  supportedVersions: [
    {
      version: 'v1',
      status: 'stable',
      releaseDate: '2026-04-11',
    },
  ],
  defaultDeprecationPeriodMonths: 12,
};

/**
 * 版本注册表
 */
export class VersionRegistry {
  public config: VersionConfig;
  private versionRoutes: Map<string, RouteHandler[]> = new Map();

  constructor(config: Partial<VersionConfig> = {}) {
    // 深拷贝以避免共享引用
    this.config = {
      currentVersion: DEFAULT_VERSION_CONFIG.currentVersion,
      defaultDeprecationPeriodMonths: DEFAULT_VERSION_CONFIG.defaultDeprecationPeriodMonths,
      supportedVersions: DEFAULT_VERSION_CONFIG.supportedVersions.map(v => ({ ...v })),
      ...config,
    };
  }

  /**
   * 注册版本路由
   */
  registerRoute(version: string, handler: RouteHandler): void {
    if (!this.versionRoutes.has(version)) {
      this.versionRoutes.set(version, []);
    }
    this.versionRoutes.get(version)!.push(handler);
  }

  /**
   * 获取版本信息
   */
  getVersionInfo(version: string): ApiVersion | undefined {
    return this.config.supportedVersions.find((v) => v.version === version);
  }

  /**
   * 检查版本是否已弃用
   */
  isDeprecated(version: string): boolean {
    const versionInfo = this.getVersionInfo(version);
    return versionInfo?.status === 'deprecated';
  }

  /**
   * 检查版本是否受支持
   */
  isSupported(version: string): boolean {
    const versionInfo = this.getVersionInfo(version);
    return versionInfo !== undefined && versionInfo.status !== 'withdrawn';
  }

  /**
   * 获取所有支持的版本
   */
  getSupportedVersions(): ApiVersion[] {
    return this.config.supportedVersions.filter((v) => v.status !== 'withdrawn');
  }

  /**
   * 弃用版本
   */
  deprecateVersion(version: string, successor: string, withdrawalDate: string): void {
    const versionInfo = this.getVersionInfo(version);
    if (versionInfo) {
      versionInfo.status = 'deprecated';
      versionInfo.deprecationDate = new Date().toISOString();
      versionInfo.successor = successor;
      versionInfo.withdrawalDate = withdrawalDate;
    }
  }

  /**
   * 添加新版本
   */
  addVersion(version: ApiVersion): void {
    this.config.supportedVersions.push(version);
  }

  /**
   * 获取弃用警告信息
   */
  getDeprecationWarning(version: string): DeprecationWarning | undefined {
    const versionInfo = this.getVersionInfo(version);
    if (!versionInfo || versionInfo.status !== 'deprecated') {
      return undefined;
    }

    return {
      code: 'API_DEPRECATED',
      message: `This API version (${version}) is deprecated and will be removed on ${versionInfo.withdrawalDate || 'TBD'}. Please migrate to /api/${versionInfo.successor || 'the latest version'}`,
      link: versionInfo.migrationGuide || `/docs/migration/${version}-to-${versionInfo.successor || 'latest'}`,
      successor: versionInfo.successor || 'latest',
      sunset: versionInfo.withdrawalDate || 'TBD',
    };
  }
}

export interface DeprecationWarning {
  code: string;
  message: string;
  link: string;
  successor: string;
  sunset: string;
}

export interface RouteHandler {
  path: string;
  method: string;
  handler: any;
}

/**
 * 版本中间件
 *
 * 用于添加版本相关的响应头
 */
export class VersionMiddleware {
  private registry: VersionRegistry;

  constructor(registry: VersionRegistry) {
    this.registry = registry;
  }

  /**
   * 版本处理中间件
   */
  handler(request: FastifyRequest, reply: FastifyReply): void {
    const version = this.extractVersion(request);

    // 添加版本响应头
    reply.header('X-API-Version', version);

    // 如果版本已弃用，添加弃用通知
    if (this.registry.isDeprecated(version)) {
      const warning = this.registry.getDeprecationWarning(version);
      if (warning) {
        reply.header('X-API-Deprecated', 'true');
        reply.header('X-API-Sunset', warning.sunset);
        reply.header(
          'Link',
          `</api/${warning.successor}>; rel="successor-version"`
        );
      }
    }
  }

  /**
   * 从请求中提取版本号
   */
  private extractVersion(request: FastifyRequest): string {
    // 优先从 URL 路径提取
    const pathMatch = request.url.match(/\/api\/(v\d+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    // 其次从请求头提取
    const headerVersion = request.headers['x-api-version'] as string;
    if (headerVersion) {
      return headerVersion;
    }

    // 默认版本
    return 'v1';
  }
}

/**
 * 版本路由管理器
 *
 * 注册和管理版本化的 API 路由
 */
export class VersionedRouter {
  private registry: VersionRegistry;
  private middleware: VersionMiddleware;

  constructor(config?: Partial<VersionConfig>) {
    this.registry = new VersionRegistry(config);
    this.middleware = new VersionMiddleware(this.registry);
  }

  /**
   * 注册版本化路由
   */
  register(app: FastifyInstance): void {
    // 注册版本信息路由
    app.get('/api/version', this.getVersionHandler.bind(this));
    app.get('/api/versions', this.getSupportedVersionsHandler.bind(this));

    // 添加版本中间件到所有 /api/v* 路由
    app.addHook('onRequest', (request, reply, done) => {
      if (request.url.startsWith('/api/v')) {
        this.middleware.handler(request, reply);
      }
      done();
    });
  }

  /**
   * 获取版本信息处理器
   */
  private getVersionHandler(request: FastifyRequest, reply: FastifyReply) {
    const version = this.extractVersionFromPath(request.url);
    const versionInfo = this.registry.getVersionInfo(version);

    if (!versionInfo) {
      reply.code(404).send({
        error: 'VERSION_NOT_FOUND',
        message: `Version ${version} not found`,
      });
      return;
    }

    reply.send({
      data: versionInfo,
      warnings: this.registry.isDeprecated(version)
        ? [this.registry.getDeprecationWarning(version)]
        : [],
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * 获取支持的版本列表处理器
   */
  private getSupportedVersionsHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const versions = this.registry.getSupportedVersions();

    reply.send({
      data: versions,
      current: this.registry.config.currentVersion,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * 从路径提取版本号
   */
  private extractVersionFromPath(url: string): string {
    const match = url.match(/\/api\/(v\d+)/);
    return match ? match[1] : 'v1';
  }

  /**
   * 获取版本注册表
   */
  getRegistry(): VersionRegistry {
    return this.registry;
  }

  /**
   * 弃用版本
   */
  deprecateVersion(
    version: string,
    successor: string,
    withdrawalDate?: string
  ): void {
    const withdrawal =
      withdrawalDate ||
      new Date(
        Date.now() +
          this.registry.config.defaultDeprecationPeriodMonths *
            30 *
            24 *
            60 *
            60 *
            1000
      ).toISOString();

    this.registry.deprecateVersion(version, successor, withdrawal);
  }
}

/**
 * 版本感知响应包装器
 *
 * 根据版本添加弃用警告
 */
export function wrapResponse<T>(
  data: T,
  request: FastifyRequest,
  registry: VersionRegistry
): VersionedResponse<T> {
  const version = extractVersionFromRequest(request);
  const warnings: DeprecationWarning[] = [];

  if (registry.isDeprecated(version)) {
    const warning = registry.getDeprecationWarning(version);
    if (warning) {
      warnings.push(warning);
    }
  }

  return {
    data,
    warnings: warnings.length > 0 ? warnings : undefined,
    meta: {
      version,
      timestamp: new Date().toISOString(),
    },
  };
}

export interface VersionedResponse<T> {
  data: T;
  warnings?: DeprecationWarning[];
  meta: {
    version: string;
    timestamp: string;
  };
}

/**
 * 从请求中提取版本号
 */
function extractVersionFromRequest(request: FastifyRequest): string {
  const pathMatch = request.url.match(/\/api\/(v\d+)/);
  if (pathMatch) {
    return pathMatch[1];
  }

  const headerVersion = request.headers['x-api-version'] as string;
  if (headerVersion) {
    return headerVersion;
  }

  return 'v1';
}

// 导出单例
export const versionedRouter = new VersionedRouter();
