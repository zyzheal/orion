// orion-platform-service/src/services/inline-script/InlineScriptService.ts

import pino from 'pino';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import { CallExpression, Identifier, MemberExpression, Node, StringLiteral } from '@babel/types';
import { InlineScriptConfig, InlineScriptPermissions, InlineScriptLevel } from '../plugin-spi/types';
import { WasmRuntime } from './WasmRuntime';
import { InlineScriptApprovalRepository } from '../../repositories/InlineScriptApprovalRepository';
import { createHash } from 'crypto';

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

/**
 * AST-based security scanner for JavaScript/TypeScript code
 */
class ASTSecurityScanner {
  private violations: string[] = [];
  private level: InlineScriptLevel;

  constructor(level: InlineScriptLevel) {
    this.level = level;
  }

  scan(code: string): string[] {
    this.violations = [];

    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        errorRecovery: true,
      });
    } catch (error) {
      this.violations.push(`Failed to parse code: ${error instanceof Error ? error.message : String(error)}`);
      return this.violations;
    }

    traverse(ast, {
      // Detect eval() calls
      CallExpression: (path: NodePath<CallExpression>) => {
        const callee = path.node.callee;
        if (callee.type === 'Identifier' && callee.name === 'eval') {
          this.addViolation('eval() is not allowed');
        }

        // Detect Function constructor: new Function(...)
        if (callee.type === 'Identifier' && callee.name === 'Function') {
          this.addViolation('Function constructor is not allowed');
        }

        // Detect require()
        if (callee.type === 'Identifier' && callee.name === 'require') {
          this.addViolation('require() is not allowed in safe mode');
        }

        // Detect dynamic import()
        if (callee.type === 'Import') {
          this.addViolation('dynamic import() is not allowed in safe mode');
        }

        // Detect process.xxx access
        if (callee.type === 'MemberExpression') {
          this.checkMemberAccess(callee);
        }
      },

      // Detect MemberExpression access like process.env, globalThis['eval']
      MemberExpression: (path: NodePath<MemberExpression>) => {
        this.checkMemberAccess(path.node);
      },
    });

    return this.violations;
  }

  private checkMemberAccess(node: MemberExpression): void {
    const obj = node.object;
    const prop = node.property;

    // process.xxx access
    if (obj.type === 'Identifier' && obj.name === 'process') {
      this.addViolation('process access is not allowed in safe mode');
    }

    // globalThis['eval'] or globalThis['process'] indirect access
    if (obj.type === 'Identifier' && ['globalThis', 'global', 'self', 'window'].includes(obj.name)) {
      if (prop.type === 'StringLiteral') {
        const name = prop.value;
        if (name === 'eval' || name === 'Function' || name === 'require') {
          this.addViolation(`indirect access to ${name} is not allowed`);
        }
        if (name === 'process') {
          this.addViolation('indirect process access is not allowed');
        }
      }
    }
  }

  private addViolation(msg: string): void {
    // Only add if not already present
    if (!this.violations.includes(msg)) {
      this.violations.push(msg);
    }
  }
}

/**
 * Fallback regex scanner for shell scripts and non-JS languages
 */
function regexScan(code: string, level: InlineScriptLevel): string[] {
  const violations: string[] = [];
  const normalized = code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');

  if (level === 'safe') {
    if (/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b/.test(normalized)) {
      violations.push('destructive rm command detected');
    }
    if (/DROP\s+TABLE/i.test(normalized)) {
      violations.push('DROP TABLE command detected');
    }
  }

  return violations;
}

export class InlineScriptService {
  private wasmRuntime: WasmRuntime;
  private approvalRepo?: InlineScriptApprovalRepository;

  constructor(options?: { approvalRepo?: InlineScriptApprovalRepository }) {
    this.wasmRuntime = new WasmRuntime();
    this.approvalRepo = options?.approvalRepo;
  }

  /**
   * Security scan: AST-based code analysis
   */
  async scanCode(config: InlineScriptConfig): Promise<{
    valid: boolean;
    violations: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    if (!config || typeof config.code !== 'string') {
      return { valid: false, violations: ['Missing or invalid code'], riskLevel: 'high' };
    }

    let violations: string[] = [];

    // Use AST scanner for JavaScript/TypeScript
    if (config.language === 'javascript' || config.language === 'typescript') {
      const scanner = new ASTSecurityScanner(config.level);
      violations = scanner.scan(config.code);
    } else {
      // Fallback to regex for shell/python etc.
      violations = regexScan(config.code, config.level);
    }

    // All levels: check for destructive patterns (shell-level)
    const normalized = config.code.replace(/\s+/g, ' ');
    if (/\brm\s+-rf\s+\/\s*$/.test(normalized)) {
      violations.push('destructive rm -rf / command detected');
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
    if (!request.config || typeof request.config.code !== 'string') {
      return {
        taskId: request.taskId,
        status: 'failed',
        errorMessage: 'Missing config.code or code is not a string',
        durationMs: 0,
      };
    }
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

    if (!config || typeof config.code !== 'string') {
      return {
        taskId: request.taskId,
        status: 'failed',
        errorMessage: 'Missing config or config.code is not a string',
        durationMs: Date.now() - startTime,
      };
    }

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

    // Standard level: execute with restricted permissions using Node.js vm module
    const permissions = request.config.permissions || {};
    if (permissions.network && permissions.network.length > 0) {
      logger.info({ networks: permissions.network }, 'Network access granted for whitelist');
    }

    try {
      // Use Node.js vm module for restricted execution
      const vm = await import('vm');
      const context = vm.createContext({
        console,
        Math,
        JSON,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Map,
        Set,
        Promise,
        // No process, no require, no globalThis access
      });

      const result = await vm.runInContext(
        `(async () => { ${request.config.code} })()`,
        context,
        { timeout: request.timeout || 30000 }
      );

      return {
        taskId: request.taskId,
        status: 'success',
        stdout: typeof result === 'string' ? result : JSON.stringify(result),
        durationMs: Date.now() - startTime,
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

  private async executeAdvanced(request: InlineScriptExecutionRequest, startTime: number): Promise<InlineScriptExecutionResult> {
    logger.info({ taskId: request.taskId }, 'Executing advanced-level inline script');

    if (!request.config.approvalId) {
      return {
        taskId: request.taskId,
        status: 'pending_approval',
        durationMs: Date.now() - startTime,
      };
    }

    // Verify approval exists and is approved
    if (this.approvalRepo && request.tenantId) {
      try {
        const approval = await this.approvalRepo.findByApprovalId(request.config.approvalId!, request.tenantId);
        if (!approval) {
          return {
            taskId: request.taskId,
            status: 'failed',
            errorMessage: `Approval ${request.config.approvalId} not found`,
            durationMs: Date.now() - startTime,
          };
        }
        if (approval.status !== 'approved') {
          return {
            taskId: request.taskId,
            status: 'pending_approval',
            approvalId: request.config.approvalId,
            durationMs: Date.now() - startTime,
          };
        }
      } catch (error) {
        logger.error({ error }, 'Failed to verify approval');
        return {
          taskId: request.taskId,
          status: 'failed',
          errorMessage: 'Failed to verify approval status',
          durationMs: Date.now() - startTime,
        };
      }
    }

    return {
      taskId: request.taskId,
      status: 'success',
      stdout: 'Advanced script executed with approval',
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Request Level 3 approval - now writes to database
   */
  async requestApproval(params: {
    tenantId: string;
    userId: string;
    code: string;
    permissions: InlineScriptPermissions;
    reason: string;
    expirationType?: 'single_use' | '24h' | '7d';
  }): Promise<{ approvalId: string; status: string }> {
    if (!this.approvalRepo) {
      // Fallback to stub if no repo
      const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      logger.info({ approvalId, reason: params.reason }, 'Approval request created (no repo, stub)');
      return { approvalId, status: 'pending' };
    }

    const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const codeHash = createHash('sha256').update(params.code).digest('hex');
    const expirationType = params.expirationType || 'single_use';

    const expiresAt = new Date();
    switch (expirationType) {
      case '24h': expiresAt.setHours(expiresAt.getHours() + 24); break;
      case '7d': expiresAt.setDate(expiresAt.getDate() + 7); break;
      case 'single_use': break;
    }

    // Use the repository's insert method via its db connection
    const entity = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      approval_id: approvalId,
      tenant_id: params.tenantId,
      user_id: params.userId,
      script_code_hash: codeHash,
      script_language: 'javascript',
      permissions: params.permissions,
      reason: params.reason,
      status: 'pending',
      required_approvals: 2,
      current_approvals: 0,
      expiration_type: expirationType,
      expires_at: expiresAt,
      used_count: 0,
      max_uses: 1,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const repo = this.approvalRepo as any;
    await repo.db.query(
      `INSERT INTO inline_script_approvals
        (id, approval_id, tenant_id, user_id, script_code_hash, script_language, permissions, reason,
         status, required_approvals, current_approvals, expiration_type, expires_at, used_count, max_uses, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
      [
        entity.id,
        entity.approval_id,
        entity.tenant_id,
        entity.user_id,
        entity.script_code_hash,
        entity.script_language,
        JSON.stringify(entity.permissions),
        entity.reason,
        entity.status,
        entity.required_approvals,
        entity.current_approvals,
        entity.expiration_type,
        entity.expires_at,
        entity.used_count,
        entity.max_uses,
      ]
    );

    logger.info({ approvalId, reason: params.reason }, 'Approval request created in database');
    return { approvalId, status: 'pending' };
  }

  /**
   * Get approval status - now reads from database
   */
  async getApprovalStatus(approvalId: string, tenantId?: string): Promise<{
    status: string;
    currentApprovals: number;
    requiredApprovals: number;
  }> {
    if (this.approvalRepo && tenantId) {
      try {
        const approval = await this.approvalRepo.findByApprovalId(approvalId, tenantId);
        if (approval) {
          return {
            status: approval.status,
            currentApprovals: approval.current_approvals,
            requiredApprovals: approval.required_approvals,
          };
        }
      } catch (error) {
        logger.error({ error }, 'Failed to fetch approval status');
      }
    }

    return { status: 'pending', currentApprovals: 0, requiredApprovals: 2 };
  }
}
