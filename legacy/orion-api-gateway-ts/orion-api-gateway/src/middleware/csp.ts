/**
 * CSP (Content Security Policy) Middleware
 *
 * Phase 0, Task 0.3: Gateway CSP 中间件
 *
 * 功能：
 * 1. 为子应用加载设置严格的 CSP 策略
 * 2. 允许子应用从可信源加载脚本和样式
 * 3. 防止 XSS 攻击
 * 4. 支持报告 URI 用于监控 CSP 违规
 *
 * 参考：
 * - 微前端规范中的 CSP 配置示例
 * - OWASP CSP 最佳实践
 */
import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginAsync } from 'fastify';

// ==================== 类型定义 ====================

export interface CSPConfig {
  /** 是否启用 CSP */
  enabled?: boolean;
  /** 是否使用 Report-Only 模式（用于测试） */
  reportOnly?: boolean;
  /** 报告 URI */
  reportUri?: string;
  /** 可信源列表 */
  trustedSources?: TrustedSources;
  /** 是否允许 inline 脚本（不推荐） */
  allowInlineScripts?: boolean;
  /** 是否允许 eval（不推荐，但某些框架需要） */
  allowEval?: boolean;
}

export interface TrustedSources {
  /** 脚本源 */
  scriptSrc?: string[];
  /** 样式源 */
  styleSrc?: string[];
  /** 图片源 */
  imgSrc?: string[];
  /** 字体源 */
  fontSrc?: string[];
  /** 连接源 */
  connectSrc?: string[];
  /** iframe 源 */
  frameSrc?: string[];
  /** 媒体源 */
  mediaSrc?: string[];
  /** 对象源 */
  objectSrc?: string[];
  /** 基础 URI */
  baseUri?: string[];
  /** 表单动作 */
  formAction?: string[];
}

// ==================== 默认配置 ====================

const DEFAULT_TRUSTED_SOURCES: TrustedSources = {
  scriptSrc: [
    "'self'",
    // 子应用域名（动态添加）
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // 子应用可能需要 inline 样式
  ],
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
  ],
  fontSrc: [
    "'self'",
    'data:',
  ],
  connectSrc: [
    "'self'",
    // API 端点（动态添加）
  ],
  frameSrc: [
    // iframe 降级源（动态添加）
  ],
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"], // 禁止 object 标签
  baseUri: ["'self'"],
  formAction: ["'self'"],
};

const DEFAULT_CSP_CONFIG: Required<CSPConfig> = {
  enabled: true,
  reportOnly: false,
  reportUri: '/api/v1/csp-report',
  trustedSources: DEFAULT_TRUSTED_SOURCES,
  allowInlineScripts: false,
  allowEval: false,
};

// ==================== CSP 构建器 ====================

/**
 * 构建 CSP 字符串
 */
function buildCSPString(config: Required<CSPConfig>): string {
  const { trustedSources, allowInlineScripts, allowEval, reportUri } = config;
  const directives: string[] = [];

  // script-src
  const scriptSrc = [...(trustedSources.scriptSrc || ["'self'"])];
  if (allowInlineScripts) {
    scriptSrc.push("'unsafe-inline'");
  }
  if (allowEval) {
    scriptSrc.push("'unsafe-eval'");
  }
  directives.push(`script-src ${scriptSrc.join(' ')}`);

  // style-src
  const styleSrc = trustedSources.styleSrc || ["'self'", "'unsafe-inline'"];
  directives.push(`style-src ${styleSrc.join(' ')}`);

  // img-src
  const imgSrc = trustedSources.imgSrc || ["'self'", 'data:'];
  directives.push(`img-src ${imgSrc.join(' ')}`);

  // font-src
  const fontSrc = trustedSources.fontSrc || ["'self'"];
  directives.push(`font-src ${fontSrc.join(' ')}`);

  // connect-src
  const connectSrc = trustedSources.connectSrc || ["'self'"];
  directives.push(`connect-src ${connectSrc.join(' ')}`);

  // frame-src
  const frameSrc = trustedSources.frameSrc || [];
  if (frameSrc.length > 0) {
    directives.push(`frame-src ${frameSrc.join(' ')}`);
  }

  // media-src
  const mediaSrc = trustedSources.mediaSrc || ["'self'"];
  directives.push(`media-src ${mediaSrc.join(' ')}`);

  // object-src
  const objectSrc = trustedSources.objectSrc || ["'none'"];
  directives.push(`object-src ${objectSrc.join(' ')}`);

  // base-uri
  const baseUri = trustedSources.baseUri || ["'self'"];
  directives.push(`base-uri ${baseUri.join(' ')}`);

  // form-action
  const formAction = trustedSources.formAction || ["'self'"];
  directives.push(`form-action ${formAction.join(' ')}`);

  // 添加报告 URI
  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
    directives.push(`report-to csp-endpoint`);
  }

  return directives.join('; ');
}

// ==================== 动态源添加 ====================

/**
 * 根据子应用配置动态添加可信源
 */
function addSubAppSources(
  config: Required<CSPConfig>,
  subAppEntries: string[]
): Required<CSPConfig> {
  const updated = { ...config };
  const trustedSources = { ...config.trustedSources };

  // 为每个子应用入口添加脚本源
  if (trustedSources.scriptSrc) {
    trustedSources.scriptSrc = [
      ...trustedSources.scriptSrc,
      ...subAppEntries.map((entry) => new URL(entry).origin),
    ];
  }

  // 为每个子应用添加连接源（API 调用）
  if (trustedSources.connectSrc) {
    trustedSources.connectSrc = [
      ...trustedSources.connectSrc,
      ...subAppEntries.map((entry) => new URL(entry).origin),
    ];
  }

  updated.trustedSources = trustedSources;
  return updated;
}

// ==================== 中间件工厂 ====================

/**
 * 创建 CSP 中间件
 */
export function createCSPMiddleware(config: CSPConfig = {}) {
  const effectiveConfig: Required<CSPConfig> = {
    ...DEFAULT_CSP_CONFIG,
    ...config,
    trustedSources: {
      ...DEFAULT_TRUSTED_SOURCES,
      ...(config.trustedSources || {}),
    },
  };

  const cspHeader = effectiveConfig.reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  const cspValue = buildCSPString(effectiveConfig);

  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    if (!effectiveConfig.enabled) {
      return;
    }

    // 设置 CSP 头部
    reply.header(cspHeader, cspValue);

    // 添加额外的安全头部
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  };
}

// ==================== Fastify 插件 ====================

/**
 * Fastify CSP 插件
 *
 * 使用方式：
 * ```typescript
 * import { cspPlugin } from './middleware/csp';
 *
 * await fastify.register(cspPlugin, {
 *   reportOnly: process.env.NODE_ENV === 'development',
 *   reportUri: '/api/v1/csp-report',
 * });
 * ```
 */
export const cspPlugin: FastifyPluginAsync<CSPConfig> = async (
  fastify: FastifyInstance,
  options: CSPConfig
) => {
  const middleware = createCSPMiddleware(options);

  // 注册 CSP 中间件到所有路由
  fastify.addHook('onRequest', middleware);

  // 注册 CSP 报告端点
  if (options.reportUri) {
    fastify.post(options.reportUri, async (request, reply) => {
      const report = request.body;
      fastify.log.warn({ cspReport: report }, 'CSP violation reported');

      // 可以在这里添加监控告警逻辑
      // 例如：发送到 Sentry、Prometheus 等

      reply.code(204).send();
    });
  }
};

// ==================== 辅助函数 ====================

/**
 * 为微前端场景创建 CSP 配置
 *
 * @param subAppEntries 子应用入口列表
 * @param options 额外选项
 */
export function createMicroFrontendCSP(
  subAppEntries: string[],
  options: {
    reportOnly?: boolean;
    allowEval?: boolean;
    reportUri?: string;
  } = {}
) {
  const baseConfig: Required<CSPConfig> = {
    ...DEFAULT_CSP_CONFIG,
    reportOnly: options.reportOnly ?? false,
    allowEval: options.allowEval ?? false,
    reportUri: options.reportUri || DEFAULT_CSP_CONFIG.reportUri,
  };

  // 添加子应用源
  const config = addSubAppSources(baseConfig, subAppEntries);

  // 微前端场景通常需要 unsafe-inline 样式（子应用可能注入样式）
  if (config.trustedSources.styleSrc) {
    if (!config.trustedSources.styleSrc.includes("'unsafe-inline'")) {
      config.trustedSources.styleSrc.push("'unsafe-inline'");
    }
  }

  // 微前端场景通常需要 unsafe-eval（某些框架需要）
  if (config.allowEval && config.trustedSources.scriptSrc) {
    if (!config.trustedSources.scriptSrc.includes("'unsafe-eval'")) {
      config.trustedSources.scriptSrc.push("'unsafe-eval'");
    }
  }

  return config;
}

// ==================== 导出 ====================

export type { CSPConfig, TrustedSources };
export { DEFAULT_CSP_CONFIG, DEFAULT_TRUSTED_SOURCES, buildCSPString, addSubAppSources };
