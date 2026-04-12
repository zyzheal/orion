/**
 * 发布前健康检查服务
 *
 * 职责：
 * - Pipeline 状态检查
 * - 测试结果检查
 * - 代码审查状态检查
 * - 依赖服务健康检查
 * - 基础设施就绪检查
 * - 回滚准备检查
 */

import { v4 as uuidv4 } from 'uuid';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckStatus,
  HealthCheckConfig,
  DEFAULT_HEALTH_CHECK_CONFIG,
} from './types';

/**
 * 依赖服务状态
 */
export interface DependencyServiceStatus {
  /** 服务名称 */
  name: string;
  /** 是否健康 */
  healthy: boolean;
  /** 延迟 (ms) */
  latency?: number;
  /** 最后检查时间 */
  lastChecked: Date;
  /** 状态详情 */
  details?: string;
}

/**
 * 回滚准备状态
 */
export interface RollbackReadiness {
  /** 是否有可用的回滚版本 */
  hasRollbackVersion: boolean;
  /** 回滚版本 */
  rollbackVersion?: string;
  /** 回滚脚本是否就绪 */
  rollbackScriptReady: boolean;
  /** 数据库迁移是否可回滚 */
  databaseMigrationReversible: boolean;
  /** 回滚预计时间 (ms) */
  estimatedRollbackTime?: number;
}

/**
 * 健康检查服务配置
 */
export interface HealthCheckServiceConfig {
  /** 检查配置 */
  config?: Partial<HealthCheckConfig>;
  /** 依赖服务检查函数 */
  checkDependencyFn?: (services: string[]) => Promise<DependencyServiceStatus[]>;
  /** 回滚准备检查函数 */
  checkRollbackFn?: (targetId: string) => Promise<RollbackReadiness>;
}

/**
 * 发布前健康检查服务
 */
export class HealthCheckService {
  private config: HealthCheckConfig;
  private checkDependencyFn: (services: string[]) => Promise<DependencyServiceStatus[]>;
  private checkRollbackFn: (targetId: string) => Promise<RollbackReadiness>;

  constructor(config?: HealthCheckServiceConfig) {
    this.config = {
      ...DEFAULT_HEALTH_CHECK_CONFIG,
      ...(config?.config || {}),
    };
    this.checkDependencyFn = config?.checkDependencyFn || this.defaultCheckDependencies;
    this.checkRollbackFn = config?.checkRollbackFn || this.defaultCheckRollback;
  }

  /**
   * 运行发布前检查
   *
   * 综合所有检查项，返回是否可以继续部署
   */
  async runPreDeploymentChecks(params: {
    targetId: string;
    pipelineStatus?: string;
    testResults?: { total: number; passed: number; failed: number };
    codeReviewStatus?: 'approved' | 'pending' | 'rejected' | 'none';
    dependencies?: string[];
  }): Promise<HealthCheckResult> {
    const checks: HealthCheck[] = [];
    const startTime = Date.now();

    // 1. Pipeline 状态检查
    if (this.config.checkPipelineStatus) {
      checks.push(this.checkPipelineStatus(params.pipelineStatus));
    }

    // 2. 测试结果检查
    if (this.config.checkTestResults && params.testResults) {
      checks.push(this.checkTestResults(params.testResults));
    }

    // 3. 代码审查状态检查
    if (this.config.checkCodeReview && params.codeReviewStatus) {
      checks.push(this.checkCodeReviewStatus(params.codeReviewStatus));
    }

    // 4. 依赖服务健康检查
    if (this.config.checkDependencyHealth && params.dependencies) {
      const depCheck = await this.checkDependencyHealth(params.dependencies);
      checks.push(depCheck);
    }

    // 5. 回滚准备检查
    if (this.config.checkRollbackReadiness) {
      const rollbackCheck = await this.checkRollbackReadiness(params.targetId);
      checks.push(rollbackCheck);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    return this.aggregateResults(checks, duration);
  }

  /**
   * 运行基础健康检查
   *
   * 仅检查核心健康项，不涉及部署决策
   */
  async runHealthChecks(params: {
    dependencies?: string[];
  }): Promise<HealthCheckResult> {
    const checks: HealthCheck[] = [];
    const startTime = Date.now();

    // 基本系统健康检查
    checks.push(this.checkSystemHealth());

    // 依赖服务健康检查
    if (this.config.checkDependencyHealth && params.dependencies) {
      const depCheck = await this.checkDependencyHealth(params.dependencies);
      checks.push(depCheck);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    return this.aggregateResults(checks, duration);
  }

  /**
   * 检查回滚准备情况
   */
  async checkRollbackReadiness(targetId: string): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const readiness = await this.checkRollbackFn(targetId);
      const duration = Date.now() - startTime;

      const issues: string[] = [];
      if (!readiness.hasRollbackVersion) issues.push('无可用回滚版本');
      if (!readiness.rollbackScriptReady) issues.push('回滚脚本未就绪');
      if (!readiness.databaseMigrationReversible) issues.push('数据库迁移不可回滚');

      let status: HealthCheckStatus = 'pass';
      if (issues.length > 0) {
        status = issues.length >= 2 ? 'fail' : 'warn';
      }

      return {
        id: uuidv4(),
        checkName: 'rollbackReadiness',
        status,
        details: issues.length > 0
          ? `回滚准备不足: ${issues.join(', ')}`
          : '回滚准备就绪',
        duration,
        timestamp: new Date(),
        targetId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        id: uuidv4(),
        checkName: 'rollbackReadiness',
        status: 'warn',
        details: `无法检查回滚准备情况: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        timestamp: new Date(),
        targetId,
      };
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 检查 Pipeline 状态
   */
  private checkPipelineStatus(status?: string): HealthCheck {
    const startTime = Date.now();

    let resultStatus: HealthCheckStatus = 'fail';
    let details = 'Pipeline 状态未知';

    if (!status) {
      resultStatus = 'warn';
      details = 'Pipeline 状态未提供';
    } else if (status === 'success' || status === 'completed') {
      resultStatus = 'pass';
      details = 'Pipeline 执行成功';
    } else if (status === 'running' || status === 'pending') {
      resultStatus = 'fail';
      details = `Pipeline 仍在执行中: ${status}`;
    } else if (status === 'failed') {
      resultStatus = 'fail';
      details = 'Pipeline 执行失败，无法部署';
    } else {
      resultStatus = 'warn';
      details = `Pipeline 状态异常: ${status}`;
    }

    return {
      id: uuidv4(),
      checkName: 'pipelineStatus',
      status: resultStatus,
      details,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * 检查测试结果
   */
  private checkTestResults(results: {
    total: number;
    passed: number;
    failed: number;
  }): HealthCheck {
    const startTime = Date.now();

    const passRate = results.total > 0 ? (results.passed / results.total) * 100 : 100;
    let resultStatus: HealthCheckStatus = 'pass';
    let details = `测试通过: ${results.passed}/${results.total} (${Math.round(passRate)}%)`;

    if (results.failed > 0 && passRate < 95) {
      resultStatus = 'fail';
      details = `测试通过率过低: ${Math.round(passRate)}% (${results.failed} 个失败)`;
    } else if (results.failed > 0) {
      resultStatus = 'warn';
      details = `存在 ${results.failed} 个测试失败，但通过率 ${Math.round(passRate)}% 可接受`;
    }

    return {
      id: uuidv4(),
      checkName: 'testResults',
      status: resultStatus,
      details,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * 检查代码审查状态
   */
  private checkCodeReviewStatus(status: string): HealthCheck {
    const startTime = Date.now();

    let resultStatus: HealthCheckStatus = 'fail';
    let details = `代码审查状态: ${status}`;

    switch (status) {
      case 'approved':
        resultStatus = 'pass';
        details = '代码审查已通过';
        break;
      case 'pending':
        resultStatus = 'warn';
        details = '代码审查仍在进行中';
        break;
      case 'rejected':
        resultStatus = 'fail';
        details = '代码审查未通过，需要修复后重新提交';
        break;
      case 'none':
        resultStatus = 'warn';
        details = '未进行代码审查';
        break;
      default:
        resultStatus = 'warn';
        details = `未知的代码审查状态: ${status}`;
    }

    return {
      id: uuidv4(),
      checkName: 'codeReview',
      status: resultStatus,
      details,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * 检查依赖服务健康
   */
  private async checkDependencyHealth(services: string[]): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const statuses = await this.checkDependencyFn(services);
      const duration = Date.now() - startTime;

      const unhealthy = statuses.filter((s) => !s.healthy);
      const unhealthyCount = unhealthy.length;

      let resultStatus: HealthCheckStatus = 'pass';
      let details = `所有 ${services.length} 个依赖服务健康`;

      if (unhealthyCount > 0) {
        const names = unhealthy.map((s) => s.name).join(', ');
        if (unhealthyCount > services.length / 2) {
          resultStatus = 'fail';
          details = `${unhealthyCount} 个依赖服务不健康: ${names}`;
        } else {
          resultStatus = 'warn';
          details = `${unhealthyCount} 个依赖服务不健康: ${names}`;
        }
      }

      return {
        id: uuidv4(),
        checkName: 'dependencyHealth',
        status: resultStatus,
        details,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        id: uuidv4(),
        checkName: 'dependencyHealth',
        status: 'warn',
        details: `无法检查依赖服务健康: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 检查系统健康（基础）
   */
  private checkSystemHealth(): HealthCheck {
    const startTime = Date.now();

    // 基础系统检查：内存、CPU、磁盘
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    let status: HealthCheckStatus = 'pass';
    let details = `系统内存使用: ${memUsedMB}MB / ${memTotalMB}MB`;

    const memRatio = memUsage.heapUsed / memUsage.heapTotal;
    if (memRatio > 0.9) {
      status = 'fail';
      details += ' (内存使用率过高)';
    } else if (memRatio > 0.7) {
      status = 'warn';
      details += ' (内存使用率偏高)';
    }

    return {
      id: uuidv4(),
      checkName: 'systemHealth',
      status,
      details,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * 汇总检查结果
   */
  private aggregateResults(checks: HealthCheck[], totalDuration: number): HealthCheckResult {
    const passed = checks.filter((c) => c.status === 'pass').length;
    const failed = checks.filter((c) => c.status === 'fail').length;
    const warnings = checks.filter((c) => c.status === 'warn').length;
    const skipped = checks.filter((c) => c.status === 'skip').length;

    // 如果有失败项，不允许继续
    const canProceed = failed === 0;

    return {
      totalChecks: checks.length,
      passed,
      failed,
      warnings,
      skipped,
      canProceed,
      checks,
      executedAt: new Date(),
    };
  }

  /**
   * 默认依赖服务检查（模拟）
   */
  private async defaultCheckDependencies(
    services: string[]
  ): Promise<DependencyServiceStatus[]> {
    return services.map((name) => ({
      name,
      healthy: true,
      lastChecked: new Date(),
      details: '模拟检查 - 服务健康',
    }));
  }

  /**
   * 默认回滚准备检查（模拟）
   */
  private async defaultCheckRollback(
    _targetId: string
  ): Promise<RollbackReadiness> {
    return {
      hasRollbackVersion: true,
      rollbackVersion: 'previous-version',
      rollbackScriptReady: true,
      databaseMigrationReversible: true,
      estimatedRollbackTime: 60000,
    };
  }
}
