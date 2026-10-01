/**
 * 灰度路由中间件（Phase 5 P0-4）
 *
 * Fastify onRequest hook，用于在代理前根据灰度发布配置决定目标后端。
 *
 * 工作流：
 * 1. 检查 GRAY_RELEASE_ENABLED 环境变量（灰度发布启用）或 MODULE_ROUTING（模块级路由）
 * 2. 调用 GrayReleaseService.getTarget() 解析目标
 * 3. 将解析结果写入请求上下文（request.grayReleaseResult）
 * 4. proxy middleware 读取该上下文决定最终代理目标
 *
 * 优雅降级：
 * - 灰度发布未启用 → 跳过，使用 proxy middleware 的默认行为
 * - Redis 不可用 → 降级到环境变量 MODULE_ROUTING
 * - 所有配置均不可用 → 使用原始路由配置
 *
 * 集成方式：
 * app.addHook('onRequest', createGrayRouteHook(grayReleaseService))
 * 注册在 tenant middleware 之后、proxy middleware 之前
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { GrayReleaseService, GrayRoutingResult } from '../services/gray-release.service';

// 声明 Fastify 请求扩展
declare module 'fastify' {
  interface FastifyRequest {
    grayReleaseResult?: GrayRoutingResult;
  }
}

/**
 * 需要跳过的路径（系统路径不参与灰度路由）
 */
const SKIP_PATHS = [
  '/healthz',
  '/readyz',
  '/metrics',
  '/version',
  '/swagger',
  '/favicon.ico',
  '/ws',
];

/**
 * 创建灰度路由 hook 工厂
 */
export function createGrayRouteHook(service: GrayReleaseService) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const url = request.raw.url || '';

    // 跳过系统路径
    if (isSkipPath(url)) {
      return;
    }

    // 如果灰度发布完全未启用且没有模块级路由配置，跳过
    const isGrayEnabled = service.isEnabled();
    const moduleRouting = (service as any).config?.moduleRouting || {}; // 运行时配置不含此字段，使用降级逻辑
    if (!isGrayEnabled && !service.getConfig()) {
      // 灰度发布未启用，由 proxy middleware 处理（使用 moduleRoutingService）
      return;
    }

    try {
      // 解析目标
      const result = service.getTarget(url, request);

      // 写入请求上下文
      request.grayReleaseResult = result;

      // 设置响应头（用于调试/可观测性）
      reply.header('X-Gray-Release-Source', result.source);
      reply.header('X-Gray-Release-Target', result.targetId);
    } catch (err) {
      // 灰度路由失败时静默降级，不阻塞请求
      console.error('[GrayRoute] Failed to resolve target:', err);
    }
  };
}

/**
 * 检查路径是否需要跳过
 */
function isSkipPath(url: string): boolean {
  return SKIP_PATHS.some((path) => url.startsWith(path));
}
