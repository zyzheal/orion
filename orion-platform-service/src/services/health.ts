/**
 * 健康检查
 *
 * 提供 /healthz 端点，检查服务及各依赖的健康状态
 */

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  service: string;
  checks: {
    [key: string]: {
      status: 'up' | 'down';
      message?: string;
      latency?: number;
    };
  };
}

export class HealthChecker {
  private checks: Map<
    string,
    () => Promise<{ status: 'up' | 'down'; message?: string; latency?: number }>
  > = new Map();

  constructor(private serviceName: string) {
    this.registerCheck('self', async () => ({ status: 'up' }));
  }

  /**
   * 注册健康检查项
   */
  registerCheck(
    name: string,
    checker: () => Promise<{ status: 'up' | 'down'; message?: string; latency?: number }>
  ): void {
    this.checks.set(name, checker);
  }

  /**
   * 执行健康检查
   */
  async check(): Promise<HealthStatus> {
    const checksResult: HealthStatus['checks'] = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    let hasDown = false;

    for (const [name, checker] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await checker();
        const latency = Date.now() - startTime;
        checksResult[name] = { ...result, latency };
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
      service: this.serviceName,
      checks: checksResult,
    };
  }

  /**
   * 获取所有注册的检查项
   */
  getRegisteredChecks(): string[] {
    return Array.from(this.checks.keys());
  }
}
