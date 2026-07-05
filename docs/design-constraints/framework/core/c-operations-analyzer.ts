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
 * 已实现: C2 扩展性完整 14 项检测
 *   - C2-01: SPI/Plugin (P0) - 插件/扩展机制
 *   - C2-02: 插件热插拔 (P1) - 动态加载/卸载插件
 *   - C2-03: 插件隔离 (P1) - Sandbox/VM 隔离
 *   - C2-04: 动态配置 (P0) - 配置热加载
 *   - C2-05: 配置回滚 (P1) - 变更可回滚
 *   - C2-06: 配置版本 (P1) - 版本管理
 *   - C2-07: 事件总线 (P1) - 事件驱动架构
 *   - C2-08: 事件溯源 (P1) - EventSourcing 模式
 *   - C2-09: 事件版本兼容 (P1) - Schema 演化
 *   - C2-10: 无状态设计 (P0) - 分布式缓存
 *   - C2-11: 会话外置 (P0) - Redis session
 *   - C2-12: 负载均衡 (P0) - K8s/Inginx 策略
 *   - C2-13: 依赖注入 (P1) - IoC 容器
 *   - C2-14: 接口抽象 (P1) - interface/抽象类
 *
 * 已实现: C3 生态集成完整 15 项检测
 *   - C3-01: Adapter 适配器 (P1) - 外部系统集成
 *   - C3-02: 错误转换 (P1) - 错误码转换
 *   - C3-03: 超时/重试 (P0) - HTTP 超时和重试
 *   - C3-04: RESTful 规范 (P0) - RESTful API
 *   - C3-05: GraphQL 支持 (P1) - GraphQL API
 *   - C3-06: OpenAPI 文档 (P0) - Swagger/OpenAPI
 *   - C3-07: API 限流 (P0) - Rate Limit
 *   - C3-08: API 认证 (P0) - JWT/Auth
 *   - C3-09: 插件发现 (P1) - 插件注册表/市场
 *   - C3-10: 插件安装/卸载 (P1) - 动态安装启用
 *   - C3-11: 插件版本管理 (P1) - 语义化版本
 *   - C3-12: 跨服务事件通信 (P1) - Kafka/NATS
 *   - C3-13: 事件订阅管理 (P1) - 订阅/过滤
 *   - C3-14: Webhook (P1) - Webhook 注册触发
 *   - C3-15: Webhook 重试 (P1) - 失败重试
 *
 * 已实现: C4 可观测性完整 6 项检测
 *   - C4-01: 监控指标 (P0) - prometheus metrics 暴露
 *   - C4-02: 告警规则 (P0) - 阈值/级别/渠道/抑制
 *   - C4-03: 日志规范 (P0) - 结构化日志/字段/脱敏
 *   - C4-04: 链路追踪 (P1) - TraceID/Span/拓扑
 *   - C4-05: 健康检查 (P0) - 存活/就绪探针
 *   - C4-06: 指标采集 (P1) - Prometheus格式/间隔
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
  | 'missing-optional-fields'
  | 'missing-deprecated-fields'
  | 'missing-data-safety'
  | 'missing-mobile-adaptation'
  | 'missing-dark-mode'
  | 'missing-old-client-support'
  | 'missing-degradation-hint'
  // C2 扩展性
  | 'missing-plugin-mechanism'
  | 'missing-plugin-hot-swap'
  | 'missing-plugin-isolation'
  | 'missing-config-hot-reload'
  | 'missing-event-bus'
  | 'missing-event-sourcing'
  | 'missing-event-version'
  | 'missing-stateless-design'
  | 'missing-session-external'
  | 'missing-load-balancing'
  | 'missing-di'
  | 'missing-interface-abstract'
  | 'missing-config-versioning'
  | 'missing-config-rollback'
  // C3 生态集成
  | 'missing-timeout-retry'
  | 'missing-rate-limit'
  | 'missing-auth-middleware'
  | 'missing-openapi'
  | 'missing-adapter'
  | 'missing-webhook'
  | 'missing-graphql'
  | 'missing-plugin-discovery'
  | 'missing-plugin-install'
  | 'missing-plugin-version'
  | 'missing-event-communication'
  | 'missing-event-subscription'
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
    this.detectMissingDataSafety();
    this.detectMissingDegradationHint();

    // C2 扩展性检测
    this.detectMissingEventBus();
    this.detectMissingEventSourcing();      // C2-08: 事件溯源 (P1)
    this.detectMissingEventVersion();       // C2-09: 事件版本兼容 (P1)
    this.detectMissingPluginMechanism();    // C2-01: SPI/Plugin (P0) - 已实现
    this.detectMissingPluginHotSwap();      // C2-02: 插件热插拔 (P1)
    this.detectMissingPluginIsolation();    // C2-03: 插件隔离 (P1)
    this.detectMissingConfigHotReload();    // C2-04: 动态配置 (P0) - 已实现
    this.detectMissingConfigRollback();     // C2-05: 配置回滚 (P1) - 已实现
    this.detectMissingConfigVersioning();   // C2-06: 配置版本 (P1) - 已实现
    this.detectMissingLoadBalancing();      // C2-12: 负载均衡 (P0)
    this.detectMissingDependencyInjection(); // C2-13: 依赖注入 (P1)
    this.detectMissingInterfaceAbstract();  // C2-14: 接口抽象 (P1)
    this.detectMissingStatelessDesign();    // C2-10: 无状态设计 (P0) - 已实现
    this.detectMissingSessionExternal();    // C2-11: 会话外置 (P0) - 已实现

    // C3 生态集成检测 (15项)
    this.detectMissingTimeoutRetry();        // C3-03: 超时/重试 (P0) - 已实现
    this.detectMissingRateLimit();           // C3-07: API限流 (P0) - 已实现
    this.detectMissingAuthMiddleware();      // C3-08: API认证 (P0) - 已实现
    this.detectMissingOpenAPI();             // C3-06: OpenAPI (P0) - 已实现
    this.detectRestfulCompliance();          // C3-04: RESTful (P0) - 已实现
    this.detectMissingAdapter();             // C3-01: Adapter (P1) - 已实现
    this.detectMissingWebhook();             // C3-14: Webhook (P1) - 已实现
    this.detectMissingWebhookRetry();        // C3-15: Webhook重试 (P1) - 新增
    // 新增 6 项检测
    this.detectMissingGraphQL();             // C3-05: GraphQL支持 (P1)
    this.detectMissingPluginDiscovery();     // C3-09: 插件发现机制 (P1)
    this.detectMissingPluginInstall();       // C3-10: 插件安装/卸载 (P1)
    this.detectMissingPluginVersion();       // C3-11: 插件版本管理 (P1)
    this.detectMissingEventCommunication();  // C3-12: 跨服务事件通信 (P1)
    this.detectMissingEventSubscription();   // C3-13: 事件订阅管理 (P1)

    // C4 可观测性检测 (完整 6 项)
    this.detectMissingMetrics();      // C4-01: 监控指标 (P0) - 已实现
    this.detectMissingAlertRules();    // C4-02: 告警规则 (P0) - 新增
    this.detectMissingLoggingStandard(); // C4-03: 日志规范 (P0) - 已实现
    this.detectMissingTracing();       // C4-04: 链路追踪 (P1) - 新增
    this.detectMissingHealthCheck();   // C4-05: 健康检查 (P0) - 已实现
    this.detectMissingMetricsCollection(); // C4-06: 指标采集 (P1) - 新增

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

  // ============ C4-02: 告警规则 (P0) ============

  /**
   * 检测是否有告警规则配置
   * 要求: 阈值定义、告警级别、通知渠道、告警抑制规则
   */
  private detectMissingAlertRules(): void {
    // 只在主服务文件或配置文件目录中检测
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    const isConfigFile = /config|alert|alarm/i.test(this.filePath);
    if (!isMainFile && !isConfigFile) return;

    // 检测告警相关配置
    const hasAlertRules = /alert|alarm|warning.*threshold|notify|webhook.*alert|alertmanager/i.test(this.content);

    // 检测 Prometheus alert 规则
    const hasPrometheusAlert = /groups:|alerting:|alert_name|alert\(.*\)/i.test(this.content);

    // 检测告警阈值定义
    const hasThreshold = /threshold|for:|annotations:|labels:/i.test(this.content);

    // 检测通知渠道
    const hasNotificationChannel = /receiver|route|slack|email|dingtalk|webhook.*notify/i.test(this.content);

    if (!hasAlertRules && !hasPrometheusAlert) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-alert-rules',
        severity: 'P0',
        message: '服务缺少告警规则配置',
        suggestion: '建议配置 Prometheus Alert 规则，定义告警阈值、级别、通知渠道',
        checkId: 'C4-02',
      });
    } else if ((hasAlertRules || hasPrometheusAlert) && !hasThreshold) {
      // 有告警配置但缺少阈值定义
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-alert-rules',
        severity: 'P1',
        message: '告警规则缺少阈值定义',
        suggestion: '建议为每个告警规则定义明确的阈值 (for: duration, annotations: description)',
        checkId: 'C4-02',
      });
    } else if (!hasNotificationChannel) {
      // 有告警配置但缺少通知渠道
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-alert-rules',
        severity: 'P1',
        message: '告警规则缺少通知渠道配置',
        suggestion: '建议配置 AlertManager receiver (email/slack/dingtalk/webhook)',
        checkId: 'C4-02',
      });
    }
  }

  // ============ C4-04: 链路追踪 (P1) ============

  /**
   * 检测是否使用链路追踪
   * 要求: TraceID/Span 生成、trace 传递、拓扑关系
   */
  private detectMissingTracing(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    // 检测是否使用链路追踪框架
    const hasTracing = /traceId|traceID|spanId|Span|opentelemetry|jaeger|zipkin|skywalking|@sentry|tracing/i.test(this.content);

    // 检测是否有 trace 传递
    const hasTracePropagation = /x-trace-id|traceparent|b3 propagation|propagate.*trace|extract|inject/i.test(this.content);

    // 检测是否有 tracing 中间件
    const hasTracingMiddleware = /tracing.*middleware|middleware.*tracing|createPlugin.*tracing/i.test(this.content);

    if (!hasTracing) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-tracing',
        severity: 'P1',
        message: '服务缺少链路追踪集成',
        suggestion: '建议使用 OpenTelemetry/jaeger/zipkin 实现分布式追踪',
        checkId: 'C4-04',
      });
    } else if (hasTracing && !hasTracePropagation) {
      // 有 tracing 但没有 trace 传递
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-tracing',
        severity: 'P1',
        message: '链路追踪缺少 trace 传递机制',
        suggestion: '建议实现 HTTP header 传递 (traceparent/b3)，确保请求链路完整',
        checkId: 'C4-04',
      });
    }
  }

  // ============ C4-06: 指标采集 (P1) ============

  /**
   * 检测 Prometheus 指标采集配置
   * 要求: Prometheus 格式暴露、采集间隔、指标命名规范
   */
  private detectMissingMetricsCollection(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    // 检测 Prometheus 指标暴露
    const hasPrometheusMetrics = /prom-client|prometheus-metrics|register.*default|ioredis.*prometheus|client\.register/i.test(this.content);

    // 检测指标命名规范 (后缀约定)
    const hasMetricNaming = /_total|_seconds|_bytes|histogram|summary|gauge|counter/i.test(this.content);

    // 检测自定义指标注册
    const hasCustomMetrics = /new Counter|new Gauge|new Histogram|new Summary|createMetric/i.test(this.content);

    // 检测采集端点
    const hasMetricsEndpoint = /\/metrics|get\(['"`]\/metrics/i.test(this.content);

    if (!hasPrometheusMetrics) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-metrics-collection',
        severity: 'P1',
        message: '缺少 Prometheus 指标采集配置',
        suggestion: '建议使用 prom-client 注册指标并暴露 /metrics 端点',
        checkId: 'C4-06',
      });
    } else if (hasPrometheusMetrics && !hasMetricsEndpoint) {
      // 有 prom-client 但没有 /metrics 端点
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-metrics-collection',
        severity: 'P1',
        message: '指标端点未暴露',
        suggestion: '确保 /metrics 端点可访问，供 Prometheus 抓取',
        checkId: 'C4-06',
      });
    } else if (hasPrometheusMetrics && !hasMetricNaming && !hasCustomMetrics) {
      // 有 prom-client 但可能没有按规范命名
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-metrics-collection',
        severity: 'P2',
        message: '指标命名可能不符合 Prometheus 规范',
        suggestion: '建议使用 _total (counter), _seconds (histogram), _bytes (gauge) 等后缀',
        checkId: 'C4-06',
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

  // ============ C1-06: 迁移不影响现有数据 (P0) ============

  /**
   * 检测迁移脚本是否有数据保护措施
   */
  private detectMissingDataSafety(): void {
    // 只在 migration 相关文件中检测
    const isMigrationFile = /migration|migrate/i.test(this.filePath);
    if (!isMigrationFile) return;

    // 检测是否有数据备份/保护逻辑
    const hasDataProtection = [
      /backup/i,
      /copy.*before/i,
      /CREATE.*TABLE.*AS.*SELECT/i,
      /INSERT INTO.*SELECT/i,
      /NOT NULL/i,
      /DEFAULT/i,
      /preserve/i,
      /cascade.*false/i,
    ];

    const hasProtection = hasDataProtection.some(p => p.test(this.content));

    // 检测是否有不安全的操作
    const hasDangerousOps = [
      /DROP.*TABLE/i,
      /TRUNCATE/i,
      /DELETE FROM.*WHERE/i,
      /ALTER.*DROP/i,
    ];

    const hasDangerous = hasDangerousOps.some(p => p.test(this.content));

    if (hasDangerous && !hasProtection) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-data-safety',
        severity: 'P0',
        message: '迁移脚本缺少数据安全保护措施',
        suggestion: '迁移前应备份数据，使用 ALTER 而非 DROP，使用 DEFAULT 值保护必填字段',
        checkId: 'C1-06',
      });
    }
  }

  // ============ C1-11: 降级提示清晰 (P0) ============

  /**
   * 检测是否有清晰的降级提示
   */
  private detectMissingDegradationHint(): void {
    // 只在服务入口或中间件文件中检测
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    const isMiddlewareFile = /middleware|intercepto|error/i.test(this.filePath);
    if (!isMainFile && !isMiddlewareFile) return;

    // 检测错误处理是否有用户友好的提示
    const hasErrorHandler = /error.*handler|catch|try.*catch/i.test(this.content);
    const hasUserMessage = [
      /message\./i,
      /notify.*user/i,
      /user.*notify/i,
      /fallback.*message/i,
      /degradation.*message/i,
    ];

    const hasMessage = hasUserMessage.some(p => p.test(this.content));

    if (hasErrorHandler && !hasMessage) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-degradation-hint',
        severity: 'P0',
        message: '错误处理缺少用户友好的降级提示',
        suggestion: '建议在 catch 块中向用户提供清晰的错误提示和降级方案',
        checkId: 'C1-11',
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

  // ============ C2-02: 插件热插拔 (P1) ============

  /**
   * 检测是否支持插件热插拔
   * 要求: 动态加载/卸载插件，无需重启服务
   */
  private detectMissingPluginHotSwap(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    // 检测是否有热插拔相关实现
    const hasHotReload = /unload.*plugin|loadPlugin|dynamic.*import\(|plugin.*register|registerPlugin/i.test(this.content);
    const hasWatchMode = /watch.*plugin|plugin.*watch|fs\.watch/i.test(this.content);

    if (!hasHotReload && !hasWatchMode) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-plugin-hot-swap',
        severity: 'P1',
        message: '插件系统缺少热插拔支持',
        suggestion: '建议实现插件热插拔，支持动态加载/卸载插件，无需重启服务',
        checkId: 'C2-02',
      });
    }
  }

  // ============ C2-03: 插件隔离 (P1) ============

  /**
   * 检测是否有插件隔离机制
   * 要求: 使用 Sandbox/iframe/WebWorker 等隔离技术
   */
  private detectMissingPluginIsolation(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    // 检测是否有隔离机制
    const hasSandbox = /sandbox|vm2|isolatedModules|webWorker|iframe|worker_threads|child_process/i.test(this.content);
    const hasNamespace = /namespace.*plugin|plugin.*namespace|module.*isolation/i.test(this.content);

    if (!hasSandbox && !hasNamespace) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-plugin-isolation',
        severity: 'P1',
        message: '插件系统缺少隔离机制',
        suggestion: '建议使用 Sandbox/VM2/worker_threads 等技术隔离插件运行环境',
        checkId: 'C2-03',
      });
    }
  }

  // ============ C2-08: 事件溯源 (P1) ============

  /**
   * 检测是否实现事件溯源
   * 要求: EventStore/EventSourcing 模式，聚合根ID，状态变更历史
   */
  private detectMissingEventSourcing(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    const isServiceFile = /service|domain/i.test(this.filePath);
    if (!isMainFile && !isServiceFile) return;

    // 检测事件溯源相关模式
    const hasEventStore = /eventStore|EventStore|eventRepository|eventLog/i.test(this.content);
    const hasAggregateId = /aggregateId|aggregate.*id|entity.*id/i.test(this.content);
    const hasStateHistory = /stateHistory|history|snapshot|event.*stream/i.test(this.content);

    if (!hasEventStore && !hasAggregateId && !hasStateHistory) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-event-sourcing',
        severity: 'P1',
        message: '服务缺少事件溯源机制',
        suggestion: '建议使用 EventSourcing 模式，记录完整的状态变更历史',
        checkId: 'C2-08',
      });
    }
  }

  // ============ C2-09: 事件版本兼容 (P1) ============

  /**
   * 检测是否有事件版本兼容性处理
   * 要求: 事件版本号，Schema 演化，向后兼容
   */
  private detectMissingEventVersion(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    const isEventFile = /event|message|queue/i.test(this.filePath);
    if (!isMainFile && !isEventFile) return;

    // 检测事件版本相关实现
    const hasEventVersion = /eventVersion|event.*version|messageVersion|protocolVersion/i.test(this.content);
    const hasSchemaVersion = /schema.*version|schemaVersion|version.*schema/i.test(this.content);
    const hasBackwardCompat = /backward.*compat|forward.*compat|compatible|transform.*event/i.test(this.content);

    if (!hasEventVersion && !hasSchemaVersion && !hasBackwardCompat) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-event-version',
        severity: 'P1',
        message: '事件/消息缺少版本兼容机制',
        suggestion: '建议为事件添加版本号，实现 Schema 演化和向后兼容处理',
        checkId: 'C2-09',
      });
    }
  }

  // ============ C2-12: 负载均衡支持 (P0) ============

  /**
   * 检测是否支持负载均衡
   * 要求: 支持 K8s Service/Ingress/Nginx 负载均衡
   */
  private detectMissingLoadBalancing(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    // 检测负载均衡相关配置
    const hasLoadBalancer = /loadBalancer|kubernetes|service.*type.*LoadBalancer/i.test(this.content);
    const hasIngress = /ingress|nginx|reverseProxy|proxy.*pass/i.test(this.content);
    const hasRoundRobin = /roundRobin|leastConnection|sourceHash/i.test(this.content);
    const hasHealthCheck = /health.*check|heartbeat|keepalive/i.test(this.content);

    if (!hasLoadBalancer && !hasIngress && !hasRoundRobin) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-load-balancing',
        severity: 'P0',
        message: '服务缺少负载均衡支持配置',
        suggestion: '建议配置 K8s Service/Ingress 或 Nginx 负载均衡策略',
        checkId: 'C2-12',
      });
    } else if ((hasLoadBalancer || hasIngress) && !hasHealthCheck) {
      // 有负载均衡但缺少健康检查
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-load-balancing',
        severity: 'P1',
        message: '负载均衡缺少健康检查配置',
        suggestion: '建议配置健康检查，确保流量只分发到健康实例',
        checkId: 'C2-12',
      });
    }
  }

  // ============ C2-13: 依赖注入 (P1) ============

  /**
   * 检测是否使用依赖注入
   * 要求: 使用 IoC 容器，@Inject 装饰器，Reflect metadata
   */
  private detectMissingDependencyInjection(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    const isServiceFile = /service|controller|module/i.test(this.filePath);
    if (!isMainFile && !isServiceFile) return;

    // 检测依赖注入相关实现
    const hasInject = /@Inject|inject\(|Container\.get|Reflect\.metadata|decorate.*injectable/i.test(this.content);
    const hasDIFramework = /tsyringe|inversify|typedi|nestjs.*di|ioc.*container/i.test(this.content);
    const hasProvider = /provider|provides|register.*singleton/i.test(this.content);

    if (!hasInject && !hasDIFramework && !hasProvider) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-di',
        severity: 'P1',
        message: '服务缺少依赖注入机制',
        suggestion: '建议使用 tsyringe/inversify/NestJS 等实现依赖注入',
        checkId: 'C2-13',
      });
    }
  }

  // ============ C2-14: 接口抽象 (P1) ============

  /**
   * 检测是否有接口抽象
   * 要求: 使用 interface 或抽象类定义抽象层
   */
  private detectMissingInterfaceAbstract(): void {
    const isServiceFile = /service|repository|adapter/i.test(this.filePath);
    if (!isServiceFile) return;

    // 检测是否有接口或抽象类定义
    const hasInterface = /interface\s+\w+|type\s+\w+\s*=/i.test(this.content);
    const hasAbstractClass = /abstract\s+class/i.test(this.content);
    const hasIMethod = /\s+I\w+|implements\s+\w+Interface/i.test(this.content);

    if (!hasInterface && !hasAbstractClass && !hasIMethod) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-interface-abstract',
        severity: 'P1',
        message: '服务层缺少接口抽象',
        suggestion: '建议使用 interface 或抽象类定义抽象层，便于实现替换',
        checkId: 'C2-14',
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
    this.detectMissingOptionalFields();
    this.detectMissingDeprecatedFields();
    this.detectMissingTimezoneHandling();
    this.detectMissingMobileAdaptation();
    this.detectMissingDarkMode();
    this.detectMissingOldClientSupport();
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

  // ============ C1-01: 新增字段不破坏旧版 (P0) ============

  /**
   * 检测 API response 类型是否使用可选字段
   * 新增字段必须为可选，否则会破坏旧版客户端
   */
  private detectMissingOptionalFields(): void {
    // 只在 API 类型定义文件中检测
    const isApiFile = /api|type|interface|dto|response/i.test(this.filePath);
    if (!isApiFile) return;

    // 检测是否有必填字段定义（没有 ? 的字段）
    // 使用正则检测 interface 或 type 定义中的必填字段
    const hasInterface = /interface\s+\w+/.test(this.content);
    const hasRequiredFields = /:\s*\w+\s*[,;=](?!\s*\?)/.test(this.content);

    // 如果有 interface 但没有检测到可选字段模式，可能有问题
    if (hasInterface && !/\?\s*[:=]/.test(this.content) && hasRequiredFields) {
      // 检查是否所有新字段都是可选的
      const fieldMatches = this.content.match(/(\w+)\s*:\s*[\w\[\]<>|]+/g) || [];
      const requiredFields = fieldMatches.filter(f => !f.includes('?'));

      if (requiredFields.length > 5) {
        // 大部分字段都是必填的，可能有问题
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-optional-fields',
          severity: 'P0',
          message: 'API 响应类型缺少可选字段标记',
          suggestion: '新增字段应使用可选 (?) 类型，避免破坏旧版客户端',
          checkId: 'C1-01',
        });
      }
    }
  }

  // ============ C1-02: 废弃字段标记 deprecated (P0) ============

  /**
   * 检测是否使用 @deprecated 注解标记废弃字段
   */
  private detectMissingDeprecatedFields(): void {
    // 只在类型定义或路由文件中检测
    const isApiFile = /api|type|interface|routes|controller/i.test(this.filePath);
    if (!isApiFile) return;

    // 检测废弃字段模式
    const deprecatedPatterns = [
      /@deprecated/,
      /@Deprecate/,
      /deprecated:\s*true/i,
      /\/\*\*[\s\S]*?@deprecated/,
      /\/\/\s*@deprecated/,
    ];

    // 查找可能的废弃字段（包含 old, deprecated, obsolete, removed 等关键词的字段）
    const deprecatedFieldPatterns = [
      /(\w*(?:old|deprecated|obsolete|removed)\w*)\s*:/gi,
      /(\w+)\s*:\s*[\w\[\]<>]+\s*,\s*\/\/\s*(?:deprecated|obsolete|removed)/gi,
    ];

    let foundDeprecated = false;
    for (const pattern of deprecatedPatterns) {
      if (pattern.test(this.content)) {
        foundDeprecated = true;
        break;
      }
    }

    // 检测可能的废弃字段但没有标记
    for (const pattern of deprecatedFieldPatterns) {
      const matches = this.content.match(pattern);
      if (matches && matches.length > 0 && !foundDeprecated) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-deprecated-fields',
          severity: 'P0',
          message: '存在可能的废弃字段但缺少 @deprecated 标记',
          suggestion: '建议使用 @deprecated 注解标记废弃字段，说明迁移方案',
          checkId: 'C1-02',
        });
        break;
      }
    }
  }

  // ============ C1-08: 移动端适配 (P1) ============

  /**
   * 检测是否有响应式/移动端适配
   */
  private detectMissingMobileAdaptation(): void {
    // 只在页面组件中检测
    const isPageFile = /pages|page|index|view/i.test(this.filePath);
    if (!isPageFile) return;

    const hasResponsivePatterns = [
      /@media/,
      /responsive/,
      /isMobile/,
      /useMediaQuery/,
      /mobile/,
      /screen.*width/,
      /antd.*responsive/i,
      /Row.*Col|Col.*Row/,
    ];

    const hasResponsive = hasResponsivePatterns.some(p => p.test(this.content));

    if (!hasResponsive) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-mobile-adaptation',
        severity: 'P1',
        message: '页面缺少移动端适配',
        suggestion: '建议添加响应式布局或移动端专用样式',
        checkId: 'C1-08',
      });
    }
  }

  // ============ C1-09: 暗色模式支持 (P1) ============

  /**
   * 检测是否使用暗色模式
   */
  private detectMissingDarkMode(): void {
    // 只在样式相关文件中检测
    const isStyleFile = /styles?|css|theme|token/i.test(this.filePath);
    const isPageFile = /pages|components/i.test(this.filePath);
    if (!isStyleFile && !isPageFile) return;

    const hasDarkModePatterns = [
      /darkTheme/,
      /theme\.dark/,
      /ConfigProvider.*dark/,
      /dark.*mode/,
      /darkMode/,
      /dark:/,
      /\[\s*className.*dark\s*\]/,
      /token.*dark/i,
    ];

    const hasDarkMode = hasDarkModePatterns.some(p => p.test(this.content));

    if (!hasDarkMode) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-dark-mode',
        severity: 'P1',
        message: '缺少暗色模式支持',
        suggestion: '建议使用 antd ConfigProvider 的 darkTheme 或自定义暗色主题',
        checkId: 'C1-09',
      });
    }
  }

  // ============ C1-10: 旧版本客户端可用 (P0) ============

  /**
   * 检测是否有旧版本客户端兼容策略
   */
  private detectMissingOldClientSupport(): void {
    // 只在 API 入口文件中检测
    const isApiEntry = /index\.ts|server\.ts|app\.ts|routes\.ts/i.test(this.filePath);
    if (!isApiEntry) return;

    // 检测版本兼容策略
    const hasVersionStrategy = [
      /\/\/.*version.*compatible/i,
      /version.*check/i,
      /legacy.*support/i,
      /backward.*compat/i,
      /graceful.*degradation/i,
      /feature.*flag/i,
      /compatibility/i,
    ];

    const hasStrategy = hasVersionStrategy.some(p => p.test(this.content));

    if (!hasStrategy) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-old-client-support',
        severity: 'P0',
        message: '缺少旧版本客户端兼容策略',
        suggestion: '建议实现版本检测和降级逻辑，确保旧客户端可用',
        checkId: 'C1-10',
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

  // ============ C3-05: GraphQL 支持 (P1) ============

  /**
   * 检测是否使用 GraphQL
   * 要求: 使用 GraphQL 客户端或服务器
   */
  private detectMissingGraphQL(): void {
    const isApiFile = /routes\.ts$|api|graphql/i.test(this.filePath);
    if (!isApiFile) return;

    const hasGraphQL = /graphql|apollo-client|apollo-server|useQuery|useMutation|@Query|@Mutation|graphql-tag/i.test(this.content);

    if (!hasGraphQL) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-graphql',
        severity: 'P1',
        message: '服务缺少 GraphQL 支持',
        suggestion: '考虑使用 GraphQL 提供更灵活的 API（可选，仅当 REST 不满足需求时）',
        checkId: 'C3-05',
      });
    }
  }

  // ============ C3-09: 插件发现机制 (P1) ============

  /**
   * 检测是否有插件发现机制
   * 要求: 支持动态发现可用插件
   */
  private detectMissingPluginDiscovery(): void {
    const isPluginFile = /plugin|extension/i.test(this.filePath);
    if (!isPluginFile) return;

    const hasPluginDiscovery = /plugin.*registry|discoverPlugins|scanPlugins|plugin.*list|marketplace|getPlugins|findPlugins/i.test(this.content);

    if (!hasPluginDiscovery) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-plugin-discovery',
        severity: 'P1',
        message: '插件系统缺少发现机制',
        suggestion: '实现插件注册表或市场，支持动态扫描和发现可用插件',
        checkId: 'C3-09',
      });
    }
  }

  // ============ C3-10: 插件安装/卸载 (P1) ============

  /**
   * 检测是否支持插件安装/卸载
   * 要求: 支持动态安装、卸载、启用、禁用插件
   */
  private detectMissingPluginInstall(): void {
    const isPluginFile = /plugin|extension/i.test(this.filePath);
    if (!isPluginFile) return;

    const hasPluginInstall = /installPlugin|uninstallPlugin|enablePlugin|disablePlugin|addPlugin|removePlugin/i.test(this.content);

    if (!hasPluginInstall) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-plugin-install',
        severity: 'P1',
        message: '插件系统缺少安装/卸载机制',
        suggestion: '实现插件的安装、卸载、启用、禁用功能',
        checkId: 'C3-10',
      });
    }
  }

  // ============ C3-11: 插件版本管理 (P1) ============

  /**
   * 检测是否有插件版本管理
   * 要求: 使用语义化版本控制
   */
  private detectMissingPluginVersion(): void {
    const isPluginFile = /plugin|extension/i.test(this.filePath);
    if (!isPluginFile) return;

    const hasPluginVersion = /plugin.*version|semantic.*version|semver|pluginVersion/i.test(this.content);
    const hasVersionCheck = /version.*check|checkVersion|compatible/i.test(this.content);

    if (!hasPluginVersion && !hasVersionCheck) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-plugin-version',
        severity: 'P1',
        message: '插件缺少版本管理',
        suggestion: '为插件添加语义化版本，支持版本兼容检查和升级提示',
        checkId: 'C3-11',
      });
    }
  }

  // ============ C3-12: 跨服务事件通信 (P1) ============

  /**
   * 检测是否支持跨服务事件通信
   * 要求: 使用消息队列或事件总线实现服务间通信
   */
  private detectMissingEventCommunication(): void {
    const isMainFile = /index\.ts$|server\.ts$|app\.ts$/i.test(this.filePath);
    if (!isMainFile) return;

    const hasEventBus = /EventBus|emit.*event|publish.*subscribe|kafka|rabbitmq|jetstream|nats/i.test(this.content);
    const hasEventBridge = /eventBridge|event.*bridge|aws.*event|bridge.*event/i.test(this.content);

    if (!hasEventBus && !hasEventBridge) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-event-communication',
        severity: 'P1',
        message: '缺少跨服务事件通信机制',
        suggestion: '使用 Kafka/NATS/RabbitMQ 实现服务间事件通信',
        checkId: 'C3-12',
      });
    }
  }

  // ============ C3-13: 事件订阅管理 (P1) ============

  /**
   * 检测是否有事件订阅管理
   * 要求: 支持事件订阅、取消订阅、事件过滤
   */
  private detectMissingEventSubscription(): void {
    const isEventFile = /event|listener|handler/i.test(this.filePath);
    if (!isEventFile) return;

    const hasEventSubscription = /subscribe.*event|listener.*event|on.*event|addEventListener|removeEventListener|unsubscribe/i.test(this.content);
    const hasEventFilter = /event.*filter|filter.*event|event.*selector|topic.*filter/i.test(this.content);

    if (!hasEventSubscription && !hasEventFilter) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-event-subscription',
        severity: 'P1',
        message: '缺少事件订阅管理机制',
        suggestion: '实现事件订阅/取消订阅机制，支持事件过滤和路由',
        checkId: 'C3-13',
      });
    }
  }

  // ============ C3-14: Adapter 适配器 (P1) ============

  /**
   * 检测是否有 Adapter 模式实现
   * 要求: 外部系统集成使用 Adapter 模式
   */
  private detectMissingAdapter(): void {
    const isServiceFile = /service|adapter/i.test(this.filePath);
    if (!isServiceFile) return;

    const hasAdapter = /Adapter|adapter.*pattern|external.*adapter|adapt.*external/i.test(this.content);
    const hasInterface = /interface.*Adapter|class.*Adapter.*implements/i.test(this.content);

    if (!hasAdapter && !hasInterface) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-adapter',
        severity: 'P1',
        message: '外部系统集成缺少 Adapter 模式',
        suggestion: '使用 Adapter 模式封装外部系统集成，便于替换实现',
        checkId: 'C3-01',
      });
    }
  }

  // ============ C3-14: Webhook (P1) ============

  /**
   * 检测是否有 Webhook 支持
   * 要求: 支持 Webhook 注册、调用、重试
   */
  private detectMissingWebhook(): void {
    const isRouteFile = /routes\.ts$|webhook|hook/i.test(this.filePath);
    const isConfigFile = /config|setting/i.test(this.filePath);
    if (!isRouteFile && !isConfigFile) return;

    const hasWebhook = /webhook|hook.*register|registerHook|trigger.*hook/i.test(this.content);

    if (!hasWebhook) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-webhook',
        severity: 'P1',
        message: '缺少 Webhook 支持',
        suggestion: '实现 Webhook 注册和触发机制，支持外部系统集成',
        checkId: 'C3-14',
      });
    }
  }

  // ============ C3-15: Webhook 重试 (P1) ============

  /**
   * 检测是否有 Webhook 重试机制
   * 要求: 支持失败重试、指数退避
   */
  private detectMissingWebhookRetry(): void {
    const hasWebhook = /webhook|hook/i.test(this.filePath);
    if (!hasWebhook) return;

    const hasRetry = /webhook.*retry|retry.*webhook|hook.*retry|exponential.*backoff/i.test(this.content);
    const hasRetryConfig = /retry.*count|retry.*interval|maxRetry|backoff/i.test(this.content);

    if (!hasRetry && !hasRetryConfig) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-webhook',
        severity: 'P1',
        message: 'Webhook 缺少重试机制',
        suggestion: '实现 Webhook 失败重试，支持指数退避策略',
        checkId: 'C3-15',
      });
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
    let projectRoot: string = cwd;

    // 尝试从 cwd 向上查找包含 docs 目录的父目录
    let checkDir = cwd;
    let foundProjectRoot = false;
    for (let i = 0; i < 5; i++) {
      if (fs.existsSync(path.join(checkDir, 'docs')) && fs.existsSync(path.join(checkDir, 'orion-platform-service'))) {
        projectRoot = checkDir;
        foundProjectRoot = true;
        break;
      }
      checkDir = path.join(checkDir, '..');
    }

    // 如果没找到，尝试常见模式
    if (!foundProjectRoot) {
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
  let projectRoot: string = cwd;

  // 尝试从 cwd 向上查找包含 docs 目录的父目录
  let checkDir = cwd;
  let foundProjectRoot = false;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(checkDir, 'docs')) && fs.existsSync(path.join(checkDir, 'orion-platform-service'))) {
      projectRoot = checkDir;
      foundProjectRoot = true;
      break;
    }
    checkDir = path.join(checkDir, '..');
  }

  // 如果没找到，尝试常见模式
  if (!foundProjectRoot) {
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