/**
 * C 运维层检测器
 * 检测运维能力相关的 60 项设计约束
 *
 * C1: 兼容性 (12项) - API版本化、浏览器兼容、迁移脚本
 * C2: 扩展性 (14项) - 插件系统、配置热加载、依赖注入
 * C3: 生态集成 (15项) - RESTful规范、API限流、认证、插件管理
 * C4: 可观测性 (6项) - 监控指标、告警、日志、链路追踪
 * C5: 灾难恢复 (6项) - 备份恢复、故障切换
 * C6: 容量规划 (5项) - 资源配额、扩缩容
 * C7: 部署发布 (6项) - 部署策略、回滚机制
 * C8: 运维自动化 (5项) - 自动化巡检、自愈机制
 *
 * 已实现: P0 级别检测 (API版本化、浏览器兼容、超时重试、限流、认证、监控、日志、健康检查、部署配置等)
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface OperationsIssue {
  file: string;
  line: number;
  column: number;
  type: OperationsIssueType;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  suggestion: string;
  checkId: string; // Cx-xx
  code?: string;
}

export type OperationsIssueType =
  // C1 兼容性
  | 'missing-api-version'
  | 'missing-deprecated-mark'
  | 'missing-migration'
  | 'no-rollback-support'
  | 'missing-browserslist'
  | 'missing-timezone-handling'
  // C2 扩展性
  | 'missing-plugin-mechanism'
  | 'missing-config-hot-reload'
  | 'missing-event-bus'
  | 'missing-stateless-design'
  | 'missing-session-external'
  | 'missing-load-balancing'
  | 'missing-di'
  | 'missing-config-versioning'
  | 'missing-config-rollback'
  // C3 生态集成
  | 'missing-timeout-retry'
  | 'missing-rate-limit'
  | 'missing-auth-middleware'
  | 'missing-openapi'
  | 'missing-adapter'
  | 'missing-webhook'
  | 'non-restful-api'
  | 'missing-restful-method'
  | 'missing-redis-session'
  // C4 可观测性
  | 'missing-metrics'
  | 'missing-alert-rules'
  | 'missing-logging-standard'
  | 'missing-tracing'
  | 'missing-health-check'
  | 'missing-metrics-collection'
  // C5 灾难恢复
  | 'missing-rto-rpo'
  | 'missing-backup-strategy'
  | 'missing-recovery-plan'
  | 'missing-failover'
  | 'missing-multi-region'
  | 'missing-drill'
  // C6 容量规划
  | 'missing-resource-quota'
  | 'missing-autoscaling'
  | 'missing-resource-budget'
  | 'missing-resource-monitoring'
  | 'missing-capacity-alert'
  // C7 部署发布
  | 'missing-rollback-config'
  | 'missing-readiness-probe'
  | 'missing-deployment-strategy'
  | 'missing-release-window'
  | 'missing-canary'
  | 'missing-config-change'
  // C8 运维自动化
  | 'missing-auto-inspection'
  | 'missing-self-healing'
  | 'missing-ops-scripts'
  | 'missing-change-automation'
  | 'missing-fault-detection';

export interface OperationsScanResult {
  file: string;
  issues: OperationsIssue[];
  language: 'frontend' | 'backend' | 'config';
  stats: {
    hasMetrics: boolean;
    hasHealthCheck: boolean;
    hasRateLimit: boolean;
    hasAuth: boolean;
    hasPlugin: boolean;
    hasEventBus: boolean;
    hasVersionedApi: boolean;
    hasTracing: boolean;
  };
}

// ============ 后端运维检测器 ============

export class COperationsAnalyzerBackend {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;
  private issues: OperationsIssue[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
  }

  analyze(): OperationsScanResult {
    this.issues = [];

    // C1 兼容性检测
    this.detectMissingApiVersion();
    this.detectMissingMigration();

    // C2 扩展性检测
    this.detectMissingEventBus();
    this.detectMissingPluginMechanism();
    this.detectMissingConfigHotReload();
    this.detectMissingStatelessDesign();
    this.detectMissingSessionExternal();
    this.detectMissingConfigVersioning();
    this.detectMissingConfigRollback();

    // C3 生态集成检测
    this.detectMissingTimeoutRetry();
    this.detectMissingRateLimit();
    this.detectMissingAuthMiddleware();
    this.detectMissingOpenAPI();
    this.detectRestfulCompliance();

    const stats = this.collectStats();

    return {
      file: this.filePath,
      issues: this.issues,
      language: 'backend',
      stats,
    };
  }

  private collectStats() {
    return {
      hasMetrics: /prometheus|metrics|collectDefaultMetrics/i.test(this.content),
      hasHealthCheck: /health| readiness|liveness|probe/i.test(this.content),
      hasRateLimit: /rateLimit|rate.?limit/i.test(this.content),
      hasAuth: /auth|jwt|middleware|guard/i.test(this.content),
      hasPlugin: /plugin|extension/i.test(this.content),
      hasEventBus: /eventBus|event.?bus|pubSub|publish|subscribe/i.test(this.content),
      hasVersionedApi: /\/v\d+\/|apiVersion|version/i.test(this.content),
      hasTracing: /trace|span|traceId|traceID/i.test(this.content),
    };
  }

  // ============ C1-03: API 版本化策略 (P0) ============

  /**
   * 检测 API 路径是否包含版本号
   * 要求 API 路径包含 /v1/ 或 /v2/ 等版本标识
   */
  private detectMissingApiVersion(): void {
    const apiRoutePatterns = [
      /@fastify\(['"`](.*?)['"`]/,
      /app\.(get|post|put|delete|patch)\(['"`](.*?)['"`]/,
      /router\.(get|post|put|delete|patch)\(['"`](.*?)['"`]/,
      /export.*routes.*=/,
    ];

    // 查找 API 路由文件
    const hasApiRoutes = /routes\.ts|api.*routes/i.test(this.filePath);
    if (!hasApiRoutes) return;

    // 检查是否有版本化路径
    const hasVersionedPath = /\/v\d+\//.test(this.content);
    const hasVersionConfig = /version.*['"`]/i.test(this.content);

    if (!hasVersionedPath && !hasVersionConfig) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-api-version',
        severity: 'P0',
        message: 'API 路由缺少版本化策略',
        suggestion: '建议使用 /v1/, /v2/ 等版本路径，并在 routes.ts 中统一管理',
        checkId: 'C1-03',
      });
    }
  }

  // ============ C3-03: 超时/重试策略 (P0) ============

  /**
   * 检测 axios/fetch 是否有 timeout 和 retry 拦截器
   */
  private detectMissingTimeoutRetry(): void {
    // 只在客户端文件检测
    const isClientFile = /client\.ts|api.*client|http.*client/i.test(this.filePath);
    if (!isClientFile) return;

    const hasTimeout = /timeout\s*:/i.test(this.content);
    const hasRetry = /retry|retries|axios-retry|retryConfig/i.test(this.content);

    if (!hasTimeout) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-timeout-retry',
        severity: 'P0',
        message: 'HTTP 客户端缺少 timeout 配置',
        suggestion: '建议设置合理的 timeout（如 30000ms）',
        checkId: 'C3-03',
      });
    }

    if (!hasRetry) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-timeout-retry',
        severity: 'P1',
        message: 'HTTP 客户端缺少重试机制',
        suggestion: '建议添加 axios-retry 或自定义重试拦截器',
        checkId: 'C3-03',
      });
    }
  }

  // ============ C3-07: API 限流 (P0) ============

  /**
   * 检测是否有 rate limit 中间件
   */
  private detectMissingRateLimit(): void {
    // 只在主服务文件或中间件文件检测
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    const isMiddlewareFile = /middleware|intercepto/i.test(this.filePath);
    if (!isMainFile && !isMiddlewareFile) return;

    const hasRateLimit =
      /rateLimit|@fastify\/rate-limit|rate.?limit|throttle/i.test(this.content);

    if (!hasRateLimit) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-rate-limit',
        severity: 'P0',
        message: '服务缺少 API 限流机制',
        suggestion: '建议使用 @fastify/rate-limit 配置请求限流',
        checkId: 'C3-07',
      });
    }
  }

  // ============ C3-08: API 认证 (P0) ============

  /**
   * 检测是否有 auth 中间件
   */
  private detectMissingAuthMiddleware(): void {
    const isRouteFile = /routes\.ts$|controller/i.test(this.filePath);
    if (!isRouteFile) return;

    const hasAuth =
      /auth|jwt|@fastify\/jwt|verify|middleware|guard/i.test(this.content);

    if (!hasAuth) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-auth-middleware',
        severity: 'P0',
        message: 'API 路由缺少认证中间件',
        suggestion: '建议使用 @fastify/jwt 配置 JWT 认证',
        checkId: 'C3-08',
      });
    }
  }

  // ============ C4-01: 监控指标 (P0) ============

  /**
   * 检测是否有 prometheus metrics 暴露
   */
  private detectMissingMetrics(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    const hasMetrics =
      /prom-client|prometheus|metrics|registerMetrics|collectDefaultMetrics/i.test(
        this.content
      );

    if (!hasMetrics) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-metrics',
        severity: 'P0',
        message: '服务缺少监控指标暴露',
        suggestion: '建议使用 prom-client 暴露 QPS/错误率/延迟 P99 等指标',
        checkId: 'C4-01',
      });
    }
  }

  // ============ C4-03: 日志规范 (P0) ============

  /**
   * 检测日志是否有结构化格式
   */
  private detectMissingLoggingStandard(): void {
    const hasLogger = /logger|log\.|pino|winston/i.test(this.content);
    if (!hasLogger) return;

    // 检测结构化日志（JSON 格式或包含 requestId/traceId）
    const hasStructuredLog =
      /JSON\.stringify|requestId|traceId|traceID|correlationId/i.test(this.content);
    const hasLogLevel = /\.info\(|\.warn\(|\.error\(|\.debug\(/i.test(this.content);

    if (!hasStructuredLog && hasLogLevel) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-logging-standard',
        severity: 'P0',
        message: '日志缺少结构化格式和上下文信息',
        suggestion: '建议使用 JSON 格式日志，包含 requestId/traceId/userId',
        checkId: 'C4-03',
      });
    }
  }

  // ============ C4-05: 健康检查 (P0) ============

  /**
   * 检测是否有 /health 端点
   */
  private detectMissingHealthCheck(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    const hasHealthCheck =
      /health|ready|alive|liveness|probe|get\(['"`]\/health/i.test(this.content);

    if (!hasHealthCheck) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-health-check',
        severity: 'P0',
        message: '服务缺少健康检查端点',
        suggestion: '建议添加 /health 端点，支持存活探针和就绪探针',
        checkId: 'C4-05',
      });
    }
  }

  // ============ C2-07: 事件总线 (P1) ============

  /**
   * 检测是否有事件总线/消息队列
   */
  private detectMissingEventBus(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    const hasEventBus =
      /eventBus|event.?bus|pubSub|publish|subscribe|nats|jetstream|rabbitmq|kafka/i.test(
        this.content
      );

    if (!hasEventBus) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-event-bus',
        severity: 'P1',
        message: '服务缺少事件总线集成',
        suggestion: '建议使用 NATS JetStream 实现事件驱动架构',
        checkId: 'C2-07',
      });
    }
  }

  // ============ C2-01: SPI/Plugin 机制 (P0) ============

  /**
   * 检测是否有插件机制
   */
  private detectMissingPluginMechanism(): void {
    const hasPlugin = /plugin|extension|hook/i.test(this.content);

    if (!hasPlugin) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-plugin-mechanism',
        severity: 'P0',
        message: '服务缺少插件/扩展机制',
        suggestion: '建议实现 Plugin/SPI 机制，支持功能扩展',
        checkId: 'C2-01',
      });
    }
  }

  // ============ C1-04: Schema 迁移 (P0) ============

  /**
   * 检测是否有数据库迁移脚本
   */
  private detectMissingMigration(): void {
    // 只在主服务入口文件检测
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    const hasMigration = /migration|migrate|db\/migration|sequelize.*migrate|typeorm.*migration/i.test(this.content);
    const hasRollback = /rollback|down\s*\(|reverse/i.test(this.content);

    if (!hasMigration) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-migration',
        severity: 'P0',
        message: '服务缺少数据库迁移机制',
        suggestion: '建议实现 SQL 迁移脚本，支持 up/down 双向迁移',
        checkId: 'C1-04',
      });
    }

    if (hasMigration && !hasRollback) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'no-rollback-support',
        severity: 'P0',
        message: '迁移脚本缺少回滚支持',
        suggestion: '建议为每个 migration 添加对应的 rollback 脚本',
        checkId: 'C1-05',
      });
    }
  }

  // ============ C2-04: 动态配置无需重启 (P0) ============

  /**
   * 检测是否支持配置热加载
   */
  private detectMissingConfigHotReload(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    const hasHotReload = /watch|chokidar|fs\.watch|reload.*config|dynamic.*config/i.test(this.content);
    const hasConfigReload = /config.*reload|loadConfig|refreshConfig/i.test(this.content);

    if (!hasHotReload && !hasConfigReload) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-config-hot-reload',
        severity: 'P0',
        message: '服务缺少配置热加载机制',
        suggestion: '建议使用配置文件监控或配置中心实现动态配置更新',
        checkId: 'C2-04',
      });
    }
  }

  // ============ C2-10: 无状态设计 (P0) ============

  /**
   * 检测是否有状态存储（内存缓存、session等）
   */
  private detectMissingStatelessDesign(): void {
    const isRouteFile = /routes\.ts$|controller/i.test(this.filePath);
    if (!isRouteFile) return;

    // 检测是否有 local 变量缓存用户状态
    const hasUserCache = /userCache|userMap|userStore|sessionStore.*local|Map.*user/i.test(this.content);
    const hasMemoryCache = /new Map\(|new WeakMap\(|memoryCache|global\./i.test(this.content);

    if (hasUserCache || hasMemoryCache) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-stateless-design',
        severity: 'P0',
        message: '服务存在本地状态缓存，可能影响水平扩展',
        suggestion: '建议使用 Redis 分布式缓存替代本地内存缓存',
        checkId: 'C2-10',
      });
    }
  }

  // ============ C2-11: 会话外置 (P0) ============

  /**
   * 检测是否使用外部存储存储会话
   */
  private detectMissingSessionExternal(): void {
    const isRouteFile = /routes\.ts$|controller|auth|session/i.test(this.filePath);
    if (!isRouteFile) return;

    const hasSession = /session|token|jwt/i.test(this.content);
    if (!hasSession) return;

    const hasRedisSession = /redis.*session|ioredis.*session|session.*redis|connect-redis/i.test(this.content);
    const hasExternalSession = /sessionStore|externalSession|distributedSession/i.test(this.content);

    if (!hasRedisSession && !hasExternalSession) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-session-external',
        severity: 'P0',
        message: '会话存储缺少外部化配置',
        suggestion: '建议使用 Redis 存储 session，支持水平扩展',
        checkId: 'C2-11',
      });
    }
  }

  // ============ C2-06: 配置版本管理 (P1) ============

  /**
   * 检测是否有配置版本管理
   */
  private detectMissingConfigVersioning(): void {
    const isConfigFile = /config.*\.ts$|config.*routes/i.test(this.filePath);
    if (!isConfigFile) return;

    const hasVersion = /version|versioning|configVersion|history/i.test(this.content);

    if (!hasVersion) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-config-versioning',
        severity: 'P1',
        message: '配置管理缺少版本控制',
        suggestion: '建议实现配置版本管理，支持历史记录和回滚',
        checkId: 'C2-06',
      });
    }
  }

  // ============ C2-05: 配置变更可回滚 (P1) ============

  /**
   * 检测配置变更是否支持回滚
   */
  private detectMissingConfigRollback(): void {
    const isConfigFile = /config.*\.ts$|config.*routes/i.test(this.filePath);
    if (!isConfigFile) return;

    const hasRollback = /rollback|revert|undo/i.test(this.content);

    if (!hasRollback) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-config-rollback',
        severity: 'P1',
        message: '配置变更缺少回滚机制',
        suggestion: '建议实现配置变更回滚功能',
        checkId: 'C2-05',
      });
    }
  }

  // ============ C3-06: OpenAPI 文档 (P0) ============

  /**
   * 检测是否有 OpenAPI/Swagger 文档
   */
  private detectMissingOpenAPI(): void {
    const isRouteFile = /routes\.ts$/i.test(this.filePath);
    if (!isRouteFile) return;

    const hasSwagger = /swagger|@fastify\/swagger|@nestjs\/swagger|swagger-ui|openapi/i.test(this.content);
    const hasApiDoc = /api-doc|apidoc|doc-generator/i.test(this.content);

    if (!hasSwagger && !hasApiDoc) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-openapi',
        severity: 'P0',
        message: 'API 缺少 OpenAPI/Swagger 文档',
        suggestion: '建议使用 @fastify/swagger 或 @nestjs/swagger 生成 API 文档',
        checkId: 'C3-06',
      });
    }
  }

  // ============ C3-04: RESTful 规范 (P0) ============

  /**
   * 检测 API 路径是否符合 RESTful 规范
   */
  private detectRestfulCompliance(): void {
    const isRouteFile = /routes\.ts$/i.test(this.filePath);
    if (!isRouteFile) return;

    // 检测非 RESTful 风格的路径
    const nonRestfulPatterns = [
      { pattern: /get[A-Z]\w+\(/, message: '使用 get + 大驼峰方法名，建议使用小写和下划线' },
      { pattern: /post[A-Z]\w+\(/, message: '使用 post + 大驼峰方法名，建议使用小写和下划线' },
      { pattern: /['"`]\/get\//, message: '路径包含 /get/，应使用 GET 方法而不是路径' },
      { pattern: /['"`]\/create\//, message: '路径包含 /create/，应使用 POST 方法而不是路径' },
      { pattern: /['"`]\/update\//, message: '路径包含 /update/，应使用 PUT/PATCH 方法而不是路径' },
      { pattern: /['"`]\/delete\//, message: '路径包含 /delete/，应使用 DELETE 方法而不是路径' },
    ];

    for (const { pattern, message } of nonRestfulPatterns) {
      if (pattern.test(this.content)) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'non-restful-api',
          severity: 'P0',
          message: 'API 路径不符合 RESTful 规范',
          suggestion: message,
          checkId: 'C3-04',
        });
        break;
      }
    }

    // 检测是否使用了正确的 HTTP 方法
    const hasGet = /\.get\(|app\.get\(/i.test(this.content);
    const hasPost = /\.post\(|app\.post\(/i.test(this.content);
    const hasPut = /\.put\(|app\.put\(/i.test(this.content);
    const hasDelete = /\.delete\(|app\.delete\(/i.test(this.content);

    // 如果只有 GET 和 POST，可能没有正确使用 HTTP 方法
    if ((hasGet || hasPost) && !hasPut && !hasDelete) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-restful-method',
        severity: 'P1',
        message: 'API 缺少 PUT/DELETE 等 HTTP 方法',
        suggestion: 'RESTful API 应正确使用 GET/POST/PUT/DELETE/PATCH 方法',
        checkId: 'C3-04',
      });
    }
  }
}

// ============ 前端运维检测器 ============

export class COperationsAnalyzerFrontend {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;
  private issues: OperationsIssue[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  }

  analyze(): OperationsScanResult {
    this.issues = [];

    // C1 兼容性检测
    this.detectMissingTimezoneHandling();
    this.detectMissingStatelessDesign();
    this.detectMissingSessionStorage();

    const stats = this.collectStats();

    return {
      file: this.filePath,
      issues: this.issues,
      language: 'frontend',
      stats,
    };
  }

  private collectStats() {
    return {
      hasMetrics: false,
      hasHealthCheck: false,
      hasRateLimit: false,
      hasAuth: /auth|token/i.test(this.content),
      hasPlugin: false,
      hasEventBus: false,
      hasVersionedApi: false,
      hasTracing: /traceId|traceID/i.test(this.content),
    };
  }

  // ============ C2-10: 无状态设计 (P0) - 前端 ============

  /**
   * 检测前端是否有本地存储用户状态
   */
  private detectMissingStatelessDesign(): void {
    // 只在 store 或 hook 文件中检测
    const isStoreFile = /store|hook|context/i.test(this.filePath);
    if (!isStoreFile) return;

    const hasLocalStorage = /localStorage|window\.localStorage/i.test(this.content);
    const hasSessionStorage = /sessionStorage|window\.sessionStorage/i.test(this.content);
    const hasUserCache = /userCache|userInfo.*=.*\{|setUser\(|userState/i.test(this.content);

    if (hasLocalStorage || hasSessionStorage) {
      // 警告：前端使用 localStorage/sessionStorage 存储敏感信息
      const hasSensitiveData = /token|password|secret|credential|auth/i.test(this.content);
      if (hasSensitiveData) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-stateless-design',
          severity: 'P0',
          message: '前端使用 localStorage/sessionStorage 存储敏感信息',
          suggestion: '敏感信息应存储在内存中，避免 XSS 攻击风险',
          checkId: 'C2-10',
        });
      }
    }

    if (hasUserCache) {
      // 检测是否有全局用户状态缓存
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-stateless-design',
        severity: 'P1',
        message: '前端存在用户状态缓存，可能导致状态不同步',
        suggestion: '建议使用 React Query/SWR 等状态管理方案',
        checkId: 'C2-10',
      });
    }
  }

  // ============ C2-11: 会话外置 (P0) - 前端 ============

  /**
   * 检测 token 存储位置
   */
  private detectMissingSessionStorage(): void {
    // 只在 api/client 或 auth 文件中检测
    const isAuthFile = /auth|login|client|token/i.test(this.filePath);
    if (!isAuthFile) return;

    const hasLocalStorage = /localStorage.*token|localStorage.*auth/i.test(this.content);
    const hasSessionStorage = /sessionStorage.*token/i.test(this.content);
    const hasCookie = /cookie.*token|document\.cookie/i.test(this.content);

    if (hasLocalStorage) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-session-external',
        severity: 'P0',
        message: 'Token 存储在 localStorage 存在 XSS 风险',
        suggestion: '建议使用 httpOnly cookie 存储 token，或使用 sessionStorage',
        checkId: 'C2-11',
      });
    }

    if (!hasLocalStorage && !hasSessionStorage && !hasCookie) {
      // 没有找到任何存储方式，可能使用内存存储（推荐）
    }
  }

  // ============ C1-12: 时区处理 (P1) ============

  /**
   * 检测时区处理
   */
  private detectMissingTimezoneHandling(): void {
    const hasDateUsage = /Date\(|new Date|timestamp|datetime/i.test(this.content);
    if (!hasDateUsage) return;

    const hasTimezoneLib = /moment-timezone|dayjs.*timezone|luxon.*zone|Intl\.DateTimeFormat/i.test(
      this.content
    );

    if (!hasTimezoneLib) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-timezone-handling',
        severity: 'P1',
        message: '日期处理缺少时区支持',
        suggestion: '建议使用 dayjs 或 moment-timezone 处理时区',
        checkId: 'C1-12',
      });
    }
  }
}

// ============ 配置检测器 ============

export class COperationsAnalyzerConfig {
  private filePath: string;
  private content: string;
  private issues: OperationsIssue[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
  }

  analyze(): OperationsScanResult {
    this.issues = [];

    const ext = path.extname(this.filePath);

    if (ext === '.json') {
      this.analyzeJsonConfig();
    } else if (ext === '.yaml' || ext === '.yml') {
      this.analyzeYamlConfig();
    }

    // C1 兼容性检测 - browserslist
    this.detectMissingBrowserslist();
    this.detectMissingMigration();
    this.detectMissingOpenAPIConfig();

    const stats = this.collectStats();

    return {
      file: this.filePath,
      issues: this.issues,
      language: 'config',
      stats,
    };
  }

  private collectStats() {
    return {
      hasMetrics: false,
      hasHealthCheck: /readinessProbe|livenessProbe|healthCheck/i.test(this.content),
      hasRateLimit: false,
      hasAuth: false,
      hasPlugin: /plugin/i.test(this.content),
      hasEventBus: false,
      hasVersionedApi: false,
      hasTracing: /trace/i.test(this.content),
    };
  }

  // ============ C1-04: Schema 迁移 (P0) ============

  /**
   * 检测数据库迁移目录
   */
  private detectMissingMigration(): void {
    // 检测是否在迁移目录
    if (!this.filePath.includes('/migrations/') && !this.filePath.includes('/migration/')) {
      return;
    }

    // 检查迁移文件是否有 rollback 配对
    const hasUpMigration = /_rollback|\.down\.|_reverse/i.test(this.filePath);
    const hasCorrespondingRollback = this.filePath.includes('_rollback.sql') ||
      this.filePath.includes('.down.') ||
      fs.existsSync(this.filePath.replace('_rollback.sql', '.sql')) ||
      fs.existsSync(this.filePath.replace('.sql', '_rollback.sql'));

    if (!hasUpMigration && !hasCorrespondingRollback) {
      // 正常情况：有 up 迁移
    }
  }

  // ============ C3-06: OpenAPI 配置 ============

  /**
   * 检测 OpenAPI/Swagger 配置文件
   */
  private detectMissingOpenAPIConfig(): void {
    const fileName = path.basename(this.filePath);

    // 检测是否在配置目录中
    const isConfigDir = /config|setting/i.test(this.filePath);

    if (fileName === 'package.json') {
      const hasSwagger = /swagger|@fastify\/swagger|@nestjs\/swagger|swagger-ui-dist/i.test(this.content);
      const hasOpenAPI = /openapi/i.test(this.content);

      if (!hasSwagger && !hasOpenAPI) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-openapi',
          severity: 'P0',
          message: 'package.json 缺少 OpenAPI/Swagger 依赖',
          suggestion: '建议安装 @fastify/swagger 或 @nestjs/swagger',
          checkId: 'C3-06',
        });
      }
    }

    // 检测是否有 .browserslistrc 文件
    if (fileName === '.browserslistrc' || fileName === 'browserslist') {
      // 有专门的 browserslist 文件，这符合要求
    }
  }

  private analyzeJsonConfig(): void {
    // C1-07: 浏览器兼容
    if (this.filePath.includes('package.json') && this.content.includes('browserslist')) {
      this.detectMissingBrowserslist();
    }

    // C7-04: 回滚配置
    if (this.filePath.includes('deployment')) {
      this.detectMissingRollbackConfig();
    }

    // C7-05: 就绪探针
    if (this.filePath.includes('deployment')) {
      this.detectMissingReadinessProbe();
    }

    // C7-01: 部署策略
    if (this.filePath.includes('deployment')) {
      this.detectMissingDeploymentStrategy();
    }

    // C6-01: 资源配额
    if (this.filePath.includes('deployment') || this.filePath.includes('resource')) {
      this.detectMissingResourceQuota();
    }

    // C6-02: 扩缩容策略
    if (this.filePath.includes('deployment') || this.filePath.includes('hpa')) {
      this.detectMissingAutoscaling();
    }

    // C6-04: 资源监控
    if (this.filePath.includes('deployment') || this.filePath.includes('monitoring')) {
      this.detectMissingResourceMonitoring();
    }

    // C6-05: 容量预警
    if (this.filePath.includes('deployment') || this.filePath.includes('alert')) {
      this.detectMissingCapacityAlert();
    }

    // C7-03: 灰度发布
    if (this.filePath.includes('deployment')) {
      this.detectMissingCanary();
    }

    // C7-06: 配置变更
    if (this.filePath.includes('configmap') || this.filePath.includes('config')) {
      this.detectMissingConfigChange();
    }

    // C8-01: 自动化巡检
    if (this.filePath.includes('cronjob') || this.filePath.includes('cron')) {
      this.detectMissingAutoInspection();
    }

    // C8-02: 自愈机制
    if (this.filePath.includes('deployment')) {
      this.detectMissingSelfHealing();
    }

    // C8-03: 运维脚本
    if (this.filePath.includes('package.json')) {
      this.detectMissingOpsScripts();
    }

    // C8-04: 变更自动化
    if (this.filePath.includes('deployment') || this.filePath.includes('ci') || this.filePath.includes('pipeline')) {
      this.detectMissingChangeAutomation();
    }

    // C8-05: 故障自检
    if (this.filePath.includes('deployment')) {
      this.detectMissingFaultDetection();
    }
  }

  private analyzeYamlConfig(): void {
    // C7-04: 回滚配置
    if (this.filePath.includes('deployment')) {
      this.detectMissingRollbackConfig();
    }

    // C7-05: 就绪探针
    if (this.filePath.includes('deployment')) {
      this.detectMissingReadinessProbe();
    }

    // C7-01: 部署策略
    if (this.filePath.includes('deployment')) {
      this.detectMissingDeploymentStrategy();
    }

    // C6-01: 资源配额
    if (this.filePath.includes('deployment')) {
      this.detectMissingResourceQuota();
    }

    // C6-02: 扩缩容策略
    if (this.filePath.includes('hpa')) {
      this.detectMissingAutoscaling();
    }

    // C6-04: 资源监控
    if (this.filePath.includes('deployment') || this.filePath.includes('monitoring')) {
      this.detectMissingResourceMonitoring();
    }

    // C6-05: 容量预警
    if (this.filePath.includes('deployment') || this.filePath.includes('alert')) {
      this.detectMissingCapacityAlert();
    }

    // C7-03: 灰度发布
    if (this.filePath.includes('deployment')) {
      this.detectMissingCanary();
    }

    // C7-06: 配置变更
    if (this.filePath.includes('configmap') || this.filePath.includes('config')) {
      this.detectMissingConfigChange();
    }

    // C8-01: 自动化巡检
    if (this.filePath.includes('cronjob') || this.filePath.includes('cron')) {
      this.detectMissingAutoInspection();
    }

    // C8-02: 自愈机制
    if (this.filePath.includes('deployment')) {
      this.detectMissingSelfHealing();
    }

    // C8-04: 变更自动化
    if (this.filePath.includes('deployment') || this.filePath.includes('ci') || this.filePath.includes('pipeline')) {
      this.detectMissingChangeAutomation();
    }

    // C8-05: 故障自检
    if (this.filePath.includes('deployment')) {
      this.detectMissingFaultDetection();
    }
  }

  // ============ C1-07: 浏览器兼容 (P0) ============

  private detectMissingBrowserslist(): void {
    try {
      const pkg = JSON.parse(this.content);
      if (!pkg.browserslist) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-browserslist',
          severity: 'P0',
          message: 'package.json 缺少 browserslist 配置',
          suggestion: '添加 browserslist 字段定义支持的浏览器版本',
          checkId: 'C1-07',
        });
      }
    } catch (e) {
      // ignore parse error
    }
  }

  // ============ C7-04: 回滚机制 (P0) ============

  private detectMissingRollbackConfig(): void {
    const hasRollback = /rollback|strategy/i.test(this.content);
    const hasRevisionHistory = /revisionHistoryLimit|revisionHistory/i.test(this.content);

    if (!hasRollback && !hasRevisionHistory) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-rollback-config',
        severity: 'P0',
        message: 'Deployment 缺少回滚配置',
        suggestion: '设置 strategy.type 和 revisionHistoryLimit',
        checkId: 'C7-04',
      });
    }
  }

  // ============ C7-05: 部署检查 (P0) ============

  private detectMissingReadinessProbe(): void {
    const hasProbe = /readinessProbe|livenessProbe|startupProbe/i.test(this.content);

    if (!hasProbe) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-readiness-probe',
        severity: 'P0',
        message: 'Deployment 缺少探针配置',
        suggestion: '添加 readinessProbe 和 livenessProbe',
        checkId: 'C7-05',
      });
    }
  }

  // ============ C6-01: 资源配额 (P0) ============

  private detectMissingResourceQuota(): void {
    const hasResources = /resources:|limits:|requests:/i.test(this.content);

    if (!hasResources) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-resource-quota',
        severity: 'P0',
        message: 'Deployment 缺少资源配额配置',
        suggestion: '设置 resources.limits.cpu, resources.limits.memory',
        checkId: 'C6-01',
      });
    }
  }

  // ============ C6-02: 扩缩容策略 (P0) ============

  private detectMissingAutoscaling(): void {
    if (this.filePath.includes('deployment') && !this.filePath.includes('hpa')) {
      // deployment 文件中不会直接包含 HPA，需要单独检查
      return;
    }

    const hasHpa = /kind:\s*HorizontalPodAutoscaler/i.test(this.content);
    const hasAutoscaling = /autoscaling/i.test(this.content);

    if (!hasHpa && !hasAutoscaling && this.filePath.includes('hpa')) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-autoscaling',
        severity: 'P0',
        message: '缺少 HPA 扩缩容配置',
        suggestion: '创建 HorizontalPodAutoscaler 配置',
        checkId: 'C6-02',
      });
    }
  }

  // ============ C7-01: 部署策略 (P0) ============

  private detectMissingDeploymentStrategy(): void {
    const hasStrategy = /strategy:|type:\s*(RollingUpdate|Recreate|BlueGreen)/i.test(this.content);
    const hasMaxSurge = /maxSurge|maxUnavailable/i.test(this.content);

    if (!hasStrategy) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-deployment-strategy',
        severity: 'P0',
        message: 'Deployment 缺少部署策略配置',
        suggestion: '设置 strategy.type (RollingUpdate/Recreate) 和 maxSurge/maxUnavailable',
        checkId: 'C7-01',
      });
    } else if (!hasMaxSurge) {
      // 有策略但没有配置滚动更新参数
    }
  }

  // ============ C6-03: 资源预算 (P1) ============

  private detectMissingResourceBudget(): void {
    // 检测是否有成本/预算相关配置
    const hasBudget = /budget|cost|quota.*limit/i.test(this.content);
    const hasResourceQuota = /ResourceQuota/i.test(this.content);

    if (!hasBudget && !hasResourceQuota && this.filePath.includes('quota')) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-resource-budget',
        severity: 'P1',
        message: '缺少资源预算配置',
        suggestion: '创建 ResourceQuota 限制命名空间资源使用',
        checkId: 'C6-03',
      });
    }
  }

  // ============ C6-04: 资源监控 (P1) ============

  private detectMissingResourceMonitoring(): void {
    const hasMonitoring = /monitoring|prometheus|metrics|monitor/i.test(this.content);
    const hasServiceMonitor = /ServiceMonitor|PodMonitor/i.test(this.content);

    if (!hasMonitoring && !hasServiceMonitor && (this.filePath.includes('deployment') || this.filePath.includes('monitoring'))) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-resource-monitoring',
        severity: 'P1',
        message: '缺少资源监控配置',
        suggestion: '添加 ServiceMonitor 或 PodMonitor 配置 Prometheus 监控',
        checkId: 'C6-04',
      });
    }
  }

  // ============ C6-05: 容量预警 (P1) ============

  private detectMissingCapacityAlert(): void {
    const hasAlert = /alert|alertRule|alertmanager|threshold/i.test(this.content);
    const hasCpuAlert = /cpu.*(alert|threshold)|memory.*(alert|threshold)/i.test(this.content);

    if (!hasAlert && !hasCpuAlert && this.filePath.includes('alert')) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-capacity-alert',
        severity: 'P1',
        message: '缺少容量预警告警规则',
        suggestion: '配置 CPU/内存使用率告警阈值 (如 >80%)',
        checkId: 'C6-05',
      });
    }
  }

  // ============ C7-02: 发布窗口 (P1) ============

  private detectMissingReleaseWindow(): void {
    const hasApproval = /approval|approve|manual|gate/i.test(this.content);
    const hasWindow = /window|schedule|cron|maintenance/i.test(this.content);

    if (!hasApproval && !hasWindow && (this.filePath.includes('ci') || this.filePath.includes('pipeline'))) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-release-window',
        severity: 'P1',
        message: 'CI/CD 缺少发布窗口/审批机制',
        suggestion: '配置发布审批流程或维护时间窗口',
        checkId: 'C7-02',
      });
    }
  }

  // ============ C7-03: 灰度发布 (P1) ============

  private detectMissingCanary(): void {
    const hasCanary = /canary|istio|flagger|traffic.*split|weight/i.test(this.content);
    const hasIngress = /ingress|gateway|virtualService/i.test(this.content);

    if (!hasCanary && !hasIngress && this.filePath.includes('deployment')) {
      // 只提示，不强制要求
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-canary',
        severity: 'P1',
        message: 'Deployment 缺少灰度发布配置',
        suggestion: '考虑使用 Istio/Flagger 实现金丝雀发布',
        checkId: 'C7-03',
      });
    }
  }

  // ============ C7-06: 配置变更 (P0) ============

  private detectMissingConfigChange(): void {
    const hasVersioning = /version|history|annotations.*version/i.test(this.content);
    const hasRollback = /rollback|revert/i.test(this.content);

    if (!hasVersioning && !hasRollback && this.filePath.includes('configmap')) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-config-change',
        severity: 'P0',
        message: 'ConfigMap 缺少版本管理和变更回滚支持',
        suggestion: '使用 ConfigMap 版本注解或配置中心实现配置变更管理',
        checkId: 'C7-06',
      });
    }
  }

  // ============ C8-01: 自动化巡检 (P1) ============

  private detectMissingAutoInspection(): void {
    const hasCronJob = /kind:\s*CronJob/i.test(this.content);
    const hasSchedule = /schedule:/i.test(this.content);

    if (!hasCronJob && !hasSchedule && this.filePath.includes('cron')) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-auto-inspection',
        severity: 'P1',
        message: '缺少自动化巡检任务',
        suggestion: '创建 CronJob 定期执行健康检查和日志收集',
        checkId: 'C8-01',
      });
    }
  }

  // ============ C8-02: 自愈机制 (P1) ============

  private detectMissingSelfHealing(): void {
    const hasRestartPolicy = /restartPolicy/i.test(this.content);
    const hasLiveness = /livenessProbe/i.test(this.content);
    const hasPDB = /PodDisruptionBudget/i.test(this.content);

    // 检查是否有自愈配置
    if (!hasRestartPolicy && !hasLiveness && this.filePath.includes('deployment')) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-self-healing',
        severity: 'P1',
        message: 'Deployment 缺少自愈机制配置',
        suggestion: '配置 restartPolicy: Always 和 livenessProbe',
        checkId: 'C8-02',
      });
    }
  }

  // ============ C8-03: 运维脚本 (P1) ============

  private detectMissingOpsScripts(): void {
    // package.json 检测 - 是否有运维脚本
    try {
      const pkg = JSON.parse(this.content);
      const scripts = pkg.scripts || {};
      const hasOpsScripts = /backup|restore|migrate|health|check|monitor/i.test(Object.keys(scripts).join(' '));

      if (!hasOpsScripts) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-ops-scripts',
          severity: 'P1',
          message: 'package.json 缺少运维脚本',
          suggestion: '添加 backup, restore, health-check 等运维脚本',
          checkId: 'C8-03',
        });
      }
    } catch (e) {
      // ignore parse error
    }
  }

  // ============ C8-04: 变更自动化 (P1) ============

  private detectMissingChangeAutomation(): void {
    const hasCicd = /ci|cd|pipeline|github.*action|gitlab-ci|jenkins/i.test(this.content);
    const hasArgo = /argo|argocd/i.test(this.content);

    if (!hasCicd && !hasArgo && (this.filePath.includes('deployment') || this.filePath.includes('ci'))) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-change-automation',
        severity: 'P1',
        message: '缺少变更自动化配置',
        suggestion: '配置 GitOps 流程或 CI/CD 流水线自动化部署',
        checkId: 'C8-04',
      });
    }
  }

  // ============ C8-05: 故障自检 (P1) ============

  private detectMissingFaultDetection(): void {
    const hasLiveness = /livenessProbe/i.test(this.content);
    const hasReadiness = /readinessProbe/i.test(this.content);
    const hasStartupProbe = /startupProbe/i.test(this.content);

    // 至少应该有 liveness probe 用于故障检测
    if (!hasLiveness && !hasStartupProbe && this.filePath.includes('deployment')) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-fault-detection',
        severity: 'P1',
        message: 'Deployment 缺少故障自检探针',
        suggestion: '配置 livenessProbe 用于故障检测和自动恢复',
        checkId: 'C8-05',
      });
    }
  }
}

// ============ 文档检测器 - 用于 C5 灾难恢复 ============

export class COperationsAnalyzerDocs {
  private filePath: string;
  private content: string;
  private issues: OperationsIssue[] = [];
  private projectRoot: string;

  constructor(filePath: string, projectRoot?: string) {
    this.filePath = filePath;
    this.projectRoot = projectRoot || path.join(__dirname, '../../../../');
    this.content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  }

  analyze(): OperationsScanResult {
    this.issues = [];

    // 检测灾备文档
    this.detectMissingRTORPO();
    this.detectMissingBackupStrategy();
    this.detectMissingRecoveryPlan();
    this.detectMissingFailover();
    this.detectMissingMultiRegion();
    this.detectMissingDrill();

    const stats = this.collectStats();

    return {
      file: this.filePath,
      issues: this.issues,
      language: 'config',
      stats,
    };
  }

  private collectStats() {
    return {
      hasMetrics: false,
      hasHealthCheck: false,
      hasRateLimit: false,
      hasAuth: false,
      hasPlugin: false,
      hasEventBus: false,
      hasVersionedApi: false,
      hasTracing: false,
    };
  }

  // ============ C5-01: RTO/RPO 定义 (P0) ============

  private detectMissingRTORPO(): void {
    // 检测 docs 目录下是否有灾备相关文档
    const isDrDoc = /disaster|dr|backup|recovery|rto|rpo|failover/i.test(this.filePath);
    const hasRTO = /RTO|recovery.*time.*objective/i.test(this.content);
    const hasRPO = /RPO|recovery.*point.*objective/i.test(this.content);

    if (isDrDoc && !hasRTO && !hasRPO) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-rto-rpo',
        severity: 'P0',
        message: '灾备文档缺少 RTO/RPO 定义',
        suggestion: '定义 RTO (恢复时间目标) 和 RPO (恢复点目标)',
        checkId: 'C5-01',
      });
    }
  }

  // ============ C5-02: 备份策略 (P0) ============

  private detectMissingBackupStrategy(): void {
    // 检测是否有 backup 脚本或配置
    const hasBackup = /backup|dump|snapshot/i.test(this.content);
    const hasScript = /script|script.*backup|backup.*script/i.test(this.filePath);

    if (this.filePath.includes('backup') || this.filePath.includes('scripts')) {
      if (!hasBackup && this.content.length > 0) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-backup-strategy',
          severity: 'P0',
          message: '缺少备份策略定义',
          suggestion: '定义数据备份策略（频率、保留周期、存储位置）',
          checkId: 'C5-02',
        });
      }
    }
  }

  // ============ C5-03: 恢复方案 (P0) ============

  private detectMissingRecoveryPlan(): void {
    const hasRecovery = /recovery|restore|fallback/i.test(this.content);
    const hasProcedure = /procedure|step|流程|步骤/i.test(this.content);

    if (this.filePath.includes('recovery') || this.filePath.includes('disaster')) {
      if (!hasRecovery || !hasProcedure) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-recovery-plan',
          severity: 'P0',
          message: '缺少恢复方案详细步骤',
          suggestion: '编写完整的恢复流程文档，包含验证步骤',
          checkId: 'C5-03',
        });
      }
    }
  }

  // ============ C5-04: 故障切换 (P1) ============

  private detectMissingFailover(): void {
    const hasFailover = /failover|ha|high.*availability|主备/i.test(this.content);
    const hasSwitch = /switch|切换/i.test(this.content);

    if (this.filePath.includes('ha') || this.filePath.includes('failover')) {
      if (!hasFailover && this.content.length > 0) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-failover',
          severity: 'P1',
          message: '缺少故障切换机制说明',
          suggestion: '描述自动/手动故障切换流程和判定条件',
          checkId: 'C5-04',
        });
      }
    }
  }

  // ============ C5-05: 多区域部署 (P1) ============

  private detectMissingMultiRegion(): void {
    const hasRegion = /region|zone|availability.*zone|多区域/i.test(this.content);
    const hasMulti = /multi|mirror|replica|副本/i.test(this.content);

    if (this.filePath.includes('disaster') || this.filePath.includes('dr')) {
      if (!hasRegion && !hasMulti && this.content.length > 0) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-multi-region',
          severity: 'P1',
          message: '缺少多区域/多可用区部署规划',
          suggestion: '描述跨区域部署架构和数据同步方案',
          checkId: 'C5-05',
        });
      }
    }
  }

  // ============ C5-06: 演练机制 (P1) ============

  private detectMissingDrill(): void {
    const hasDrill = /drill|演练|test.*recovery|chaos/i.test(this.content);
    const hasSchedule = /schedule|定期|周期/i.test(this.content);

    if (this.filePath.includes('disaster') || this.filePath.includes('dr')) {
      if (!hasDrill && !hasSchedule && this.content.length > 0) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-drill',
          severity: 'P1',
          message: '缺少灾备演练计划',
          suggestion: '制定定期灾备演练计划，验证恢复流程',
          checkId: 'C5-06',
        });
      }
    }
  }
}

// ============ 批量扫描器 ============

export class COperationsScanner {
  private backendDir: string;
  private frontendDir: string;
  private docsDir: string;
  private results: OperationsScanResult[] = [];

  constructor(backendDir?: string, frontendDir?: string, docsDir?: string) {
    // 使用 process.cwd() 作为项目根目录，优先查找 orion-design
    const cwd = process.cwd();
    let projectRoot: string;

    // 尝试从 cwd 向上查找包含 docs 目录的父目录
    let checkDir = cwd;
    for (let i = 0; i < 5; i++) {
      if (fs.existsSync(path.join(checkDir, 'docs')) && fs.existsSync(path.join(checkDir, 'orion-platform-service'))) {
        projectRoot = checkDir;
        break;
      }
      checkDir = path.join(checkDir, '..');
    }

    // 如果没找到，尝试常见模式
    if (!projectRoot) {
      if (cwd.includes('orion-platform-service')) {
        projectRoot = path.join(cwd, '../..');
      } else if (cwd.includes('orion-frontend')) {
        projectRoot = path.join(cwd, '../..');
      } else if (cwd.includes('orion-design')) {
        projectRoot = cwd;
      } else {
        projectRoot = cwd;
      }
    }

    this.backendDir = backendDir || path.join(projectRoot, 'orion-platform-service/src');
    this.frontendDir = frontendDir || path.join(projectRoot, 'orion-frontend/src');
    this.docsDir = docsDir || path.join(projectRoot, 'docs');
  }

  /**
   * 扫描后端目录
   */
  scanBackend(patterns?: string[]): OperationsScanResult[] {
    const files = this.findTypeScriptFiles(this.backendDir, patterns || ['index.ts', 'routes.ts', 'server.ts']);
    console.log(`[C Operations] Found ${files.length} backend files to scan`);

    for (const file of files) {
      try {
        const analyzer = new COperationsAnalyzerBackend(file);
        const result = analyzer.analyze();
        if (result.issues.length > 0) {
          this.results.push(result);
        }
      } catch (e) {
        // skip files that can't be parsed
      }
    }

    return this.results;
  }

  /**
   * 扫描前端目录
   */
  scanFrontend(patterns?: string[]): OperationsScanResult[] {
    const files = this.findTypeScriptFiles(this.frontendDir, patterns || ['api/client.ts']);
    console.log(`[C Operations] Found ${files.length} frontend files to scan`);

    for (const file of files) {
      try {
        const analyzer = new COperationsAnalyzerFrontend(file);
        const result = analyzer.analyze();
        if (result.issues.length > 0) {
          this.results.push(result);
        }
      } catch (e) {
        // skip files that can't be parsed
      }
    }

    return this.results;
  }

  /**
   * 扫描配置文件
   */
  scanConfig(configPaths: string[]): OperationsScanResult[] {
    for (const configPath of configPaths) {
      try {
        if (fs.existsSync(configPath)) {
          const analyzer = new COperationsAnalyzerConfig(configPath);
          const result = analyzer.analyze();
          if (result.issues.length > 0) {
            this.results.push(result);
          }
        }
      } catch (e) {
        // skip files that can't be parsed
      }
    }

    return this.results;
  }

  /**
   * 扫描文档目录 - 用于 C5 灾难恢复检测
   */
  scanDocs(patterns?: string[]): OperationsScanResult[] {
    const searchPatterns = patterns || ['disaster', 'backup', 'recovery', 'dr', 'ha', 'failover'];
    const files: string[] = [];

    if (!fs.existsSync(this.docsDir)) {
      console.log(`[C Operations] Docs directory does not exist: ${this.docsDir}`);
      return this.results;
    }

    // 搜索灾备相关文档
    const searchInDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              searchInDir(fullPath);
            }
          } else if (entry.isFile()) {
            for (const pattern of searchPatterns) {
              if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
                files.push(fullPath);
                break;
              }
            }
          }
        }
      } catch (e) {
        // ignore permission errors
      }
    };

    searchInDir(this.docsDir);
    console.log(`[C Operations] Found ${files.length} disaster recovery docs to scan`);

    for (const file of files) {
      try {
        const analyzer = new COperationsAnalyzerDocs(file, this.docsDir);
        const result = analyzer.analyze();
        if (result.issues.length > 0) {
          this.results.push(result);
        }
      } catch (e) {
        // skip files that can't be parsed
      }
    }

    return this.results;
  }

  /**
   * 扫描指定目录下的所有相关文件
   */
  scanDirectory(dir: string, options?: { extensions?: string[]; exclude?: string[] }): OperationsScanResult[] {
    const extensions = options?.extensions || ['.ts', '.tsx', '.json', '.yaml', '.yml'];
    const exclude = options?.exclude || ['node_modules', 'dist', 'build', '.git'];

    const files = this.findFilesRecursively(dir, extensions, exclude);

    for (const file of files) {
      try {
        const ext = path.extname(file);

        if (ext === '.json') {
          const analyzer = new COperationsAnalyzerConfig(file);
          const result = analyzer.analyze();
          if (result.issues.length > 0) {
            this.results.push(result);
          }
        } else if (ext === '.ts' || ext === '.tsx') {
          if (file.includes('/src/api/') || file.includes('/src/pages/')) {
            const analyzer = new COperationsAnalyzerFrontend(file);
            const result = analyzer.analyze();
            if (result.issues.length > 0) {
              this.results.push(result);
            }
          } else if (file.includes('/src/')) {
            const analyzer = new COperationsAnalyzerBackend(file);
            const result = analyzer.analyze();
            if (result.issues.length > 0) {
              this.results.push(result);
            }
          }
        }
      } catch (e) {
        // skip files that can't be parsed
      }
    }

    return this.results;
  }

  /**
   * 获取汇总统计
   */
  getSummary(): { total: number; p0: number; p1: number; byCheck: Map<string, number> } {
    let p0 = 0;
    let p1 = 0;
    const byCheck = new Map<string, number>();

    for (const result of this.results) {
      for (const issue of result.issues) {
        if (issue.severity === 'P0') p0++;
        if (issue.severity === 'P1') p1++;

        const key = issue.checkId;
        byCheck.set(key, (byCheck.get(key) || 0) + 1);
      }
    }

    return {
      total: p0 + p1,
      p0,
      p1,
      byCheck,
    };
  }

  /**
   * 获取所有结果
   */
  getResults(): OperationsScanResult[] {
    return this.results;
  }

  private findTypeScriptFiles(dir: string, patterns?: string[]): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      console.log(`[C Operations] Directory does not exist: ${dir}`);
      return files;
    }

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          if (patterns) {
            for (const pattern of patterns) {
              if (entry.name.includes(pattern)) {
                files.push(fullPath);
                break;
              }
            }
          } else if (entry.name.endsWith('.ts')) {
            files.push(fullPath);
          }
        }
      }
    };

    walk(dir);
    return files;
  }

  private findFilesRecursively(
    dir: string,
    extensions: string[],
    exclude: string[]
  ): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!exclude.includes(entry.name) && !entry.name.startsWith('.')) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    walk(dir);
    return files;
  }
}

// ============ CLI 入口 ============

if (require.main === module) {
  // 修正项目根目录路径计算 - 优先查找 orion-design
  const cwd = process.cwd();
  let projectRoot: string;

  // 尝试从 cwd 向上查找包含 docs 目录的父目录
  let checkDir = cwd;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(checkDir, 'docs')) && fs.existsSync(path.join(checkDir, 'orion-platform-service'))) {
      projectRoot = checkDir;
      break;
    }
    checkDir = path.join(checkDir, '..');
  }

  // 如果没找到，尝试常见模式
  if (!projectRoot) {
    if (cwd.includes('orion-platform-service')) {
      projectRoot = path.join(cwd, '../..');
    } else if (cwd.includes('orion-frontend')) {
      projectRoot = path.join(cwd, '../..');
    } else if (cwd.includes('orion-design')) {
      projectRoot = cwd;
    } else {
      projectRoot = cwd;
    }
  }

  const backendDir = path.join(projectRoot, 'orion-platform-service/src');
  const frontendDir = path.join(projectRoot, 'orion-frontend/src');
  const docsDir = path.join(projectRoot, 'docs');

  console.log('Project root:', projectRoot);
  console.log('Backend dir:', backendDir);
  console.log('Frontend dir:', frontendDir);
  console.log('Docs dir:', docsDir);

  console.log('=== C 运维层检测器 (扩展 C5-C8) ===\n');

  const scanner = new COperationsScanner(backendDir, frontendDir, docsDir);

  // 扫描后端关键文件
  console.log('Scanning backend...');
  scanner.scanDirectory(backendDir, {
    extensions: ['.ts'],
    exclude: ['node_modules', 'dist', '__tests__', '.git'],
  });

  // 扫描前端 API
  console.log('Scanning frontend...');
  scanner.scanDirectory(frontendDir, {
    extensions: ['.ts', '.tsx'],
    exclude: ['node_modules', 'dist', '.git'],
  });

  // 扫描灾备文档 (C5)
  console.log('Scanning disaster recovery docs...');
  scanner.scanDocs(['disaster', 'backup', 'recovery', 'dr', 'ha', 'failover']);

  const summary = scanner.getSummary();
  const results = scanner.getResults();

  console.log(`\n=== 扫描结果 ===`);
  console.log(`总计: ${summary.total} 个问题`);
  console.log(`P0: ${summary.p0}`);
  console.log(`P1: ${summary.p1}`);

  console.log(`\n=== 按检查项分类 ===`);
  for (const [checkId, count] of summary.byCheck) {
    console.log(`  ${checkId}: ${count}`);
  }

  console.log(`\n=== 问题详情 ===`);
  for (const result of results.slice(0, 30)) {
    for (const issue of result.issues) {
      console.log(`[${issue.checkId}] ${issue.severity} ${issue.file}:${issue.line}`);
      console.log(`  ${issue.message}`);
      console.log(`  ${issue.suggestion}\n`);
    }
  }
}