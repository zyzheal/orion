/**
 * 健康检查中间件
 *
 * 提供 /healthz 端点，检查服务及各依赖的健康状态
 */

import { FastifyRequest, FastifyReply } from 'fastify';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  checks: {
    [key: string]: {
      status: 'up' | 'down';
      message?: string;
    };
  };
}

export class HealthMiddleware {
  private checks: Map<string, () => Promise<{ status: 'up' | 'down'; message?: string }>> = new Map();

  constructor() {
    this.registerCheck('self', async () => ({ status: 'up' }));
  }

  /**
   * 注册健康检查项
   */
  registerCheck(
    name: string,
    checker: () => Promise<{ status: 'up' | 'down'; message?: string }>
  ): void {
    this.checks.set(name, checker);
  }

  /**
   * 健康检查处理器
   */
  async handler(_request: FastifyRequest, reply: FastifyReply): Promise<HealthStatus> {
    const checksResult: HealthStatus['checks'] = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    let hasDown = false;

    for (const [name, checker] of this.checks) {
      try {
        const result = await checker();
        checksResult[name] = result;
        if (result.status === 'down') {
          hasDown = true;
          overallStatus = 'degraded';
        }
      } catch (error) {
        checksResult[name] = {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        hasDown = true;
        overallStatus = 'unhealthy';
      }
    }

    // 如果所有检查都失败，标记为 unhealthy
    const upCount = Object.values(checksResult).filter((c) => c.status === 'up').length;
    if (upCount === 0) {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.VERSION || '1.0.0',
      checks: checksResult,
    };
  }
}

export const healthMiddleware = new HealthMiddleware();
