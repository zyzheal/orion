// orion-platform-service/src/services/inline-script/InlineScriptService.ts

import pino from 'pino';
import { InlineScriptConfig, InlineScriptPermissions, InlineScriptLevel } from '../plugin-spi/types';
import { WasmRuntime } from './WasmRuntime';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface InlineScriptExecutionRequest {
  taskId: string;
  pipelineRunId: string;
  stageId: string;
  config: InlineScriptConfig;
  workspace?: { rootPath: string };
  env?: Record<string, string>;
  timeout?: number;
  userId?: string;
  tenantId?: string;
}

export interface InlineScriptExecutionResult {
  taskId: string;
  status: 'success' | 'failed' | 'timeout' | 'pending_approval';
  stdout?: string;
  stderr?: string;
  durationMs: number;
  errorMessage?: string;
  approvalId?: string;
}

export class InlineScriptService {
  private wasmRuntime: WasmRuntime;

  constructor() {
    this.wasmRuntime = new WasmRuntime();
  }

  /**
   * Security scan: static code analysis
   */
  async scanCode(config: InlineScriptConfig): Promise<{
    valid: boolean;
    violations: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const violations: string[] = [];

    // Level 1 (Safe): no dangerous operations
    if (config.level === 'safe') {
      if (config.code.includes('eval(') || config.code.includes('Function(')) {
        violations.push('eval/Function constructor not allowed in safe mode');
      }
      if (/require\s*\(/.test(config.code) || /import\s+/.test(config.code)) {
        violations.push('module imports not allowed in safe mode');
      }
      if (config.code.includes('process.env') || config.code.includes('process.')) {
        violations.push('process access not allowed in safe mode');
      }
    }

    // All levels: check for destructive patterns
    if (config.code.includes('rm -rf') || config.code.includes('DROP TABLE')) {
      violations.push('destructive commands detected');
    }

    return {
      valid: violations.length === 0,
      violations,
      riskLevel: violations.length > 2 ? 'high' : violations.length > 0 ? 'medium' : 'low',
    };
  }

  /**
   * Dry run: validate without executing
   */
  async dryRun(request: InlineScriptExecutionRequest): Promise<InlineScriptExecutionResult> {
    const scan = await this.scanCode(request.config);
    if (!scan.valid) {
      return {
        taskId: request.taskId,
        status: 'failed',
        errorMessage: `Security scan failed: ${scan.violations.join(', ')}`,
        durationMs: 0,
      };
    }

    return {
      taskId: request.taskId,
      status: 'success',
      stdout: 'Dry run passed - code is safe to execute',
      durationMs: 0,
    };
  }

  /**
   * Execute inline script based on level
   */
  async execute(request: InlineScriptExecutionRequest): Promise<InlineScriptExecutionResult> {
    const startTime = Date.now();
    const { config } = request;

    // Step 1: Security scan
    const scan = await this.scanCode(config);
    if (!scan.valid) {
      return {
        taskId: request.taskId,
        status: 'failed',
        errorMessage: `Security scan failed: ${scan.violations.join(', ')}`,
        durationMs: Date.now() - startTime,
      };
    }

    // Step 2: Level-based execution
    switch (config.level) {
      case 'safe':
        return this.executeSafe(request, startTime);
      case 'standard':
        return this.executeStandard(request, startTime);
      case 'advanced':
        return this.executeAdvanced(request, startTime);
      default:
        return {
          taskId: request.taskId,
          status: 'failed',
          errorMessage: `Unknown script level: ${config.level}`,
          durationMs: Date.now() - startTime,
        };
    }
  }

  private async executeSafe(request: InlineScriptExecutionRequest, startTime: number): Promise<InlineScriptExecutionResult> {
    logger.info({ taskId: request.taskId }, 'Executing safe-level inline script');

    try {
      const result = await this.wasmRuntime.execute({
        code: request.config.code,
        timeout: request.timeout || 60000,
        memoryLimit: 256 * 1024 * 1024,
      });

      return {
        taskId: request.taskId,
        status: result.success ? 'success' : 'failed',
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: Date.now() - startTime,
        errorMessage: result.error,
      };
    } catch (error) {
      return {
        taskId: request.taskId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async executeStandard(request: InlineScriptExecutionRequest, startTime: number): Promise<InlineScriptExecutionResult> {
    logger.info({ taskId: request.taskId }, 'Executing standard-level inline script');

    const permissions = request.config.permissions || {};
    if (permissions.network && permissions.network.length > 0) {
      logger.info({ networks: permissions.network }, 'Network access granted for whitelist');
    }

    return {
      taskId: request.taskId,
      status: 'success',
      stdout: 'Standard script executed (simulated)',
      durationMs: Date.now() - startTime,
    };
  }

  private async executeAdvanced(request: InlineScriptExecutionRequest, startTime: number): Promise<InlineScriptExecutionResult> {
    logger.info({ taskId: request.taskId }, 'Executing advanced-level inline script');

    if (!request.config.approvalId) {
      return {
        taskId: request.taskId,
        status: 'pending_approval',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      taskId: request.taskId,
      status: 'success',
      stdout: 'Advanced script executed with approval (simulated)',
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Request Level 3 approval
   */
  async requestApproval(params: {
    tenantId: string;
    userId: string;
    code: string;
    permissions: InlineScriptPermissions;
    reason: string;
    expirationType?: 'single_use' | '24h' | '7d';
  }): Promise<{ approvalId: string; status: string }> {
    const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    logger.info({ approvalId, reason: params.reason }, 'Approval request created');
    return { approvalId, status: 'pending' };
  }

  /**
   * Get approval status
   */
  async getApprovalStatus(approvalId: string): Promise<{
    status: string;
    currentApprovals: number;
    requiredApprovals: number;
  }> {
    return { status: 'pending', currentApprovals: 0, requiredApprovals: 2 };
  }
}
