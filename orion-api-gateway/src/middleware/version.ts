/**
 * 版本协商中间件
 *
 * 从 Header 或 URL 提取 API 版本，处理版本兼容性检查和弃用告警响应
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { ApiVersionManager, VersionNegotiationResult } from '../services/ApiVersionManager';

// 声明 Fastify 请求扩展
declare module 'fastify' {
  interface FastifyRequest {
    versionContext?: {
      version: string;
      source: 'header' | 'url' | 'default';
      isDeprecated: boolean;
      deprecationNotice?: {
        version: string;
        warning: string;
        deprecationDate: Date;
        sunsetDate: Date;
        migrationGuide?: string;
      };
    };
  }
}

/**
 * 版本中间件配置
 */
export interface VersionMiddlewareOptions {
  headerName?: string;
  urlPrefix?: string;
  fallbackToDefault?: boolean;
  rejectRetired?: boolean;
  warnDeprecated?: boolean;
  publicPaths?: string[];   // 不需要版本检查的路径
}

/**
 * 版本中间件类
 */
export class VersionMiddleware {
  private manager: ApiVersionManager;
  private options: Required<VersionMiddlewareOptions>;

  constructor(
    manager: ApiVersionManager,
    options?: VersionMiddlewareOptions
  ) {
    this.manager = manager;
    this.options = {
      headerName: options?.headerName || 'x-api-version',
      urlPrefix: options?.urlPrefix || '/api/',
      fallbackToDefault: options?.fallbackToDefault ?? true,
      rejectRetired: options?.rejectRetired ?? true,
      warnDeprecated: options?.warnDeprecated ?? true,
      publicPaths: options?.publicPaths || [
        '/healthz',
        '/readyz',
        '/version',
        '/swagger',
        '/favicon.ico',
      ],
    };
  }

  /**
   * 添加公开路径（不需要版本检查）
   */
  addPublicPath(path: string): void {
    this.options.publicPaths.push(path);
  }

  /**
   * 检查路径是否需要版本检查
   */
  private isPublicPath(url: string): boolean {
    return this.options.publicPaths.some((path) => url.startsWith(path));
  }

  /**
   * 中间件处理器
   */
  handler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const url = request.url || request.originalUrl || '';

    // 公开路径跳过版本检查
    if (this.isPublicPath(url)) {
      return Promise.resolve();
    }

    // 版本协商和处理
    return this.processVersion(request, reply);
  }

  /**
   * 处理版本协商
   */
  private async processVersion(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // 版本协商
      const result = this.manager.negotiateVersion(request);

      // 设置版本上下文
      request.versionContext = {
        version: result.resolvedVersion,
        source: result.source,
        isDeprecated: result.isDeprecated,
        deprecationNotice: result.deprecationNotice ? {
          version: result.deprecationNotice.version,
          warning: result.deprecationNotice.warning,
          deprecationDate: result.deprecationNotice.deprecationDate,
          sunsetDate: result.deprecationNotice.sunsetDate,
          migrationGuide: result.deprecationNotice.migrationGuide,
        } : undefined,
      };

      // 设置响应头
      const headers = this.manager.getVersionWarningHeaders(result);
      for (const [key, value] of Object.entries(headers)) {
        reply.header(key, value);
      }
    } catch (error) {
      // 版本协商失败
      if (error instanceof Error) {
        if (error.message.includes('retired')) {
          reply.code(410).send({
            error: 'VERSION_RETIRED',
            message: error.message,
            code: '10601',
            details: {
              suggestion: 'Please upgrade to a supported API version',
              supportedVersions: this.manager.getSupportedVersions().map(v => v.version),
            },
          });
          return;
        }

        if (error.message.includes('Unable to determine')) {
          reply.code(400).send({
            error: 'VERSION_REQUIRED',
            message: 'API version is required. Please specify version via X-API-Version header or URL path.',
            code: '10602',
            details: {
              currentVersion: this.manager.getCurrentVersion()?.version,
              supportedVersions: this.manager.getSupportedVersions().map(v => v.version),
            },
          });
          return;
        }
      }

      // 其他错误
      reply.code(500).send({
        error: 'VERSION_ERROR',
        message: 'Failed to process API version',
        code: '10603',
      });
    }
  }

  /**
   * 注册版本路由
   */
  registerRoutes(app: FastifyInstance): void {
    // 版本信息路由
    app.get('/api/version/info', async (request, reply) => {
      const versions = this.manager.getAllVersions();
      return {
        currentVersion: this.manager.getCurrentVersion()?.version,
        supportedVersions: this.manager.getSupportedVersions().map(v => ({
          version: v.version,
          status: v.status,
          releaseDate: v.releaseDate,
        })),
        deprecatedVersions: versions
          .filter(v => v.status === 'deprecated')
          .map(v => ({
            version: v.version,
            deprecationDate: v.deprecationDate,
            sunsetDate: v.sunsetDate,
            migrationGuide: v.migrationGuide,
          })),
      };
    });

    // 版本弃用公告路由
    app.get('/api/version/deprecation', async (request, reply) => {
      const notices = this.manager.getAllDeprecationNotices();
      return {
        notices: notices.map(n => ({
          version: n.version,
          warning: n.warning,
          deprecationDate: n.deprecationDate,
          sunsetDate: n.sunsetDate,
          migrationGuide: n.migrationGuide,
        })),
        warningStats: Object.fromEntries(this.manager.getDeprecationWarningStats()),
      };
    });

    // 版本历史路由
    app.get('/api/version/history', async (request, reply) => {
      const version = (request.query as any)?.version as string | undefined;
      return {
        history: this.manager.getVersionHistory(version),
      };
    });
  }
}

/**
 * 创建版本中间件工厂函数
 */
export function createVersionMiddleware(
  manager: ApiVersionManager,
  options?: VersionMiddlewareOptions
): VersionMiddleware {
  return new VersionMiddleware(manager, options);
}

/**
 * 默认版本中间件实例
 */
export let versionMiddleware: VersionMiddleware | null = null;

/**
 * 初始化版本中间件
 */
export function initVersionMiddleware(
  manager: ApiVersionManager,
  options?: VersionMiddlewareOptions
): VersionMiddleware {
  versionMiddleware = new VersionMiddleware(manager, options);
  return versionMiddleware;
}