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
  // C3 生态集成
  | 'missing-timeout-retry'
  | 'missing-rate-limit'
  | 'missing-auth-middleware'
  | 'missing-openapi'
  | 'missing-adapter'
  | 'missing-webhook'
  // C4 可观测性
  | 'missing-metrics'
  | 'missing-alert-rules'
  | 'missing-logging-standard'
  | 'missing-tracing'
  | 'missing-health-check'
  | 'missing-metrics-collection'
  // C5 灾难恢复
  | 'missing-backup-strategy'
  | 'missing-recovery-plan'
  | 'missing-failover'
  // C6 容量规划
  | 'missing-resource-quota'
  | 'missing-autoscaling'
  // C7 部署发布
  | 'missing-rollback-config'
  | 'missing-readiness-probe'
  | 'missing-deployment-strategy'
  // C8 运维自动化
  | 'missing-auto-inspection'
  | 'missing-self-healing';

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

    // C3 生态集成检测
    this.detectMissingTimeoutRetry();
    this.detectMissingRateLimit();
    this.detectMissingAuthMiddleware();

    // C4 可观测性检测
    this.detectMissingMetrics();
    this.detectMissingLoggingStandard();
    this.detectMissingHealthCheck();

    // C2 扩展性检测
    this.detectMissingEventBus();
    this.detectMissingPluginMechanism();

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

    // C6-01: 资源配额
    if (this.filePath.includes('deployment') || this.filePath.includes('resource')) {
      this.detectMissingResourceQuota();
    }

    // C6-02: 扩缩容策略
    if (this.filePath.includes('deployment') || this.filePath.includes('hpa')) {
      this.detectMissingAutoscaling();
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

    // C6-01: 资源配额
    if (this.filePath.includes('deployment')) {
      this.detectMissingResourceQuota();
    }

    // C6-02: 扩缩容策略
    if (this.filePath.includes('hpa')) {
      this.detectMissingAutoscaling();
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
}

// ============ 批量扫描器 ============

export class COperationsScanner {
  private backendDir: string;
  private frontendDir: string;
  private results: OperationsScanResult[] = [];

  constructor(backendDir?: string, frontendDir?: string) {
    this.backendDir = backendDir || path.join(__dirname, '../../../../orion-platform-service/src');
    this.frontendDir = frontendDir || path.join(__dirname, '../../../../orion-frontend/src');
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
  const backendDir = path.join(__dirname, '../../../../orion-platform-service/src');
  const frontendDir = path.join(__dirname, '../../../../orion-frontend/src');

  console.log('=== C 运维层检测器 ===\n');

  const scanner = new COperationsScanner(backendDir, frontendDir);

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
  for (const result of results.slice(0, 20)) {
    for (const issue of result.issues) {
      console.log(`[${issue.checkId}] ${issue.severity} ${issue.file}:${issue.line}`);
      console.log(`  ${issue.message}`);
      console.log(`  ${issue.suggestion}\n`);
    }
  }
}

export { OperationsIssue, OperationsScanResult };