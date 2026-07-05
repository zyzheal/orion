/**
 * Unified Logger Factory
 *
 * 提供统一的 logger 工厂函数，自动注入 traceId（从 AsyncLocalStorage 请求上下文获取）。
 * 所有模块统一使用此工厂替代直接的 `pino({ name: 'xxx' })` 调用。
 *
 * 使用示例：
 * ```typescript
 * import { createLogger } from '../utils/logger';
 * const logger = createLogger('my-module');
 * logger.info({ userId: 123 }, 'User created');
 * logger.error({ err }, 'Something failed');
 * ```
 *
 * 自动注入 traceId：
 * - 在 HTTP 请求上下文中：从 tenantContextStorage 的 traceId 字段自动获取
 * - 在后台任务中：traceId 为空字符串
 * - 也可手动传入 traceId 覆盖自动值
 */

import pino from 'pino';
import { getCurrentTraceId } from '../db/tenant-context-storage';

// 全局 pino 实例（根 logger），其他实例通过 child() 派生
const rootLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  // 禁用 pino 的默认 prettyPrint（用结构化 JSON）
  redact: {
    paths: ['password', 'secret', 'token', 'authorization', 'cookie'],
    censor: '***',
  },
});

/**
 * 创建带模块名称前缀的 logger 实例。
 * 自动从 AsyncLocalStorage 获取 traceId 并注入到结构化日志中。
 *
 * @param name - 模块名称（如 'auth', 'pipeline', 'tenant'）
 * @returns 带 name 前缀且自动注入 traceId 的 pino logger 实例
 *
 * 自动行为：
 * - 自动从 AsyncLocalStorage 获取当前请求的 traceId
 * - 自动注入到每条日志的结构化参数中
 * - 支持在调用时手动传入 traceId 覆盖自动值
 */
export function createLogger(name: string): pino.Logger {
  // 防御性 guard：测试中 jest.mock('pino') 工厂常返回不含 .child 的 mock，
  // 此处回退到 rootLogger 本身，避免 `rootLogger.child is not a function`。
  // 生产环境 pino 实例恒有 .child，行为不受影响。
  const baseLogger: any =
    typeof (rootLogger as any).child === 'function'
      ? (rootLogger as any).child({ module: name })
      : (rootLogger as any);

  return new Proxy(baseLogger, {
    get(target, prop: string | symbol) {
      const method = target[prop as keyof typeof target];
      if (typeof method !== 'function') return method;

      // 只对 info/warn/error/debug 方法进行增强
      if (!['info', 'warn', 'error', 'debug'].includes(prop as string)) {
        return method;
      }

      return (...args: unknown[]) => {
        // 如果第一个参数是对象且没有 traceId，自动注入
        if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
          const firstArg = args[0] as Record<string, unknown>;
          if (!firstArg.traceId || firstArg.traceId === '') {
            const autoTraceId = getCurrentTraceId();
            if (autoTraceId) {
              firstArg.traceId = autoTraceId;
            }
          }
        } else if (args.length > 0 && typeof args[0] === 'string') {
          // 纯字符串日志，将 traceId 作为独立参数注入
          const autoTraceId = getCurrentTraceId();
          if (autoTraceId) {
            const hasObjArg = args.findIndex(a => typeof a === 'object' && a !== null && !Array.isArray(a));
            if (hasObjArg >= 0 && !(args[hasObjArg] as Record<string, unknown>).traceId) {
              (args[hasObjArg] as Record<string, unknown>).traceId = autoTraceId;
            }
          }
        }
        // 使用 call 保留 pino 内部 this 绑定（Symbol(pino.msgPrefix) 等）
        return (method as Function).call(target, ...args);
      };
    },
  });
}

/**
 * 增强的日志工厂函数（兼容别名，内部直接调用 createLogger）。
 */
export function createTraceAwareLogger(name: string): pino.Logger {
  return createLogger(name);
}

// 增强的 logger 接口
export interface EnhancedLogger extends pino.Logger {
  info: pino.LogFn;
  warn: pino.LogFn;
  error: pino.LogFn;
  debug: pino.LogFn;
}

// 默认导出基础工厂（兼容简洁导入）
export default createLogger;