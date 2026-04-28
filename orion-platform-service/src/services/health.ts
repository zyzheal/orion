/**
 * 健康检查
 *
 * 提供三个端点，符合 Kubernetes Probe 规范:
 * - /livez  — 进程是否存活（无依赖检查，最快）
 * - /readyz — 进程是否就绪（关键依赖检查，用于 K8s readiness probe）
 * - /healthz — 综合健康状态（所有依赖检查，用于人工查看）
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

export interface CheckerResult {
  status: 'up' | 'down';
  message?: string;
  latency?: number;
}

export type HealthCheckFn = () => Promise<CheckerResult>;

export class HealthChecker {
  private serviceName: string;
  private allChecks: Map<string, HealthCheckFn> = new Map();
  private readyChecks: Set<string> = new Set();
  /** I5 Fix: Default timeout for individual health checks (ms) */
  private checkTimeoutMs: number;

  constructor(serviceName: string, options?: { checkTimeoutMs?: number }) {
    this.serviceName = serviceName;
    this.checkTimeoutMs = options?.checkTimeoutMs ?? 5000;
    this.registerCheck('self', async () => ({ status: 'up' }));
    // 'self' 是 readiness 的关键检查
    this.markAsReadyCheck('self');
  }

  /**
   * I5 Fix: Wrap a check with timeout protection
   */
  private async withTimeout(name: string, checker: HealthCheckFn): Promise<CheckerResult> {
    const timeoutPromise = new Promise<CheckerResult>((resolve) => {
      setTimeout(() => {
        resolve({
          status: 'down',
          message: `Check timed out after ${this.checkTimeoutMs}ms`,
        });
      }, this.checkTimeoutMs);
    });

    return Promise.race([checker(), timeoutPromise]);
  }

  /**
   * 注册健康检查项
   */
  registerCheck(name: string, checker: HealthCheckFn): void {
    this.allChecks.set(name, checker);
  }

  /**
   * 标记某个检查项为 readiness 关键项
   * readiness 检查失败的依赖（如数据库）应标记为此类
   */
  markAsReadyCheck(name: string): void {
    this.readyChecks.add(name);
  }

  /**
   * 执行所有健康检查（用于 /healthz）
   * I5 Fix: Each check is wrapped with timeout protection
   */
  async check(): Promise<HealthStatus> {
    const checksResult: HealthStatus['checks'] = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    let hasDown = false;

    for (const [name, checker] of this.allChecks) {
      try {
        const startTime = Date.now();
        const result = await this.withTimeout(name, checker);
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
   * 执行 readiness 检查（用于 /readyz）
   * 只检查关键依赖，超时更严格
   * I5 Fix: Each check is wrapped with timeout protection
   */
  async checkReady(): Promise<{ ready: boolean; checks: Record<string, CheckerResult> }> {
    const checksResult: Record<string, CheckerResult> = {};
    let ready = true;

    for (const name of this.readyChecks) {
      const checker = this.allChecks.get(name);
      if (!checker) continue;

      try {
        const startTime = Date.now();
        const result = await this.withTimeout(name, checker);
        const latency = Date.now() - startTime;
        checksResult[name] = { ...result, latency };
        if (result.status === 'down') {
          ready = false;
        }
      } catch (error) {
        checksResult[name] = {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        ready = false;
      }
    }

    return { ready, checks: checksResult };
  }

  /**
   * 获取所有注册的检查项
   */
  getRegisteredChecks(): string[] {
    return Array.from(this.allChecks.keys());
  }

  /**
   * 获取 readiness 检查项
   */
  getReadyChecks(): string[] {
    return Array.from(this.readyChecks);
  }
}
