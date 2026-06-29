// orion-platform-service/src/services/inline-script/InlineScriptService.ts

import pino from 'pino';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import { CallExpression, Identifier, MemberExpression, Node, StringLiteral } from '@babel/types';
import { InlineScriptConfig, InlineScriptPermissions, InlineScriptLevel } from '../plugin-spi/types';
import { WasmRuntime } from './WasmRuntime';
import { InlineScriptApprovalRepository } from '../../repositories/InlineScriptApprovalRepository';
import { InlineScriptRepository } from '../../repositories/InlineScriptRepository';
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
      CallExpression: (path: NodePath<CallExpression>) => {
        const callee = path.node.callee;

        // Direct eval(), Function(), require()
        if (callee.type === 'Identifier') {
          if (callee.name === 'eval') this.addViolation('eval() is not allowed');
          if (callee.name === 'Function') this.addViolation('Function constructor is not allowed');
          if (this.level === 'safe' && callee.name === 'require') this.addViolation('require() is not allowed');
          // setTimeout/setInterval with string argument (eval equivalent)
          if ((callee.name === 'setTimeout' || callee.name === 'setInterval') && path.node.arguments[0]?.type === 'StringLiteral') {
            this.addViolation(`${callee.name} with string argument is not allowed`);
          }
        }

        // Dynamic import()
        if (callee.type === 'Import') {
          this.addViolation('dynamic import() is not allowed in safe mode');
        }

        // this.constructor.constructor('code')() - vm escape
        if (callee.type === 'MemberExpression') {
          this.checkConstructorChain(callee);
          this.checkMemberAccess(callee);
        }
      },

      MemberExpression: (path: NodePath<MemberExpression>) => {
        this.checkConstructorChain(path.node);
        this.checkMemberAccess(path.node);
      },

      // Detect bare identifiers like eval, Function used as values
      Identifier: (path: NodePath<Identifier>) => {
        // Skip if used as call expression callee (handled above)
        const parent = path.parent;
        if (parent.type === 'CallExpression' && parent.callee === path.node) return;
        // Skip if it's a property access (e.g., obj.eval is not a bare eval call)
        if (parent.type === 'MemberExpression' && parent.property === path.node) return;
        // Skip if it's in a variable declaration (e.g., const eval = ...)
        if (parent.type === 'VariableDeclarator' && parent.id === path.node) return;
        // Flag bare eval/Function references used as values (not in declaration/call/property context)
        if (path.node.name === 'eval' || path.node.name === 'Function') {
          this.addViolation(`bare ${path.node.name} reference is not allowed`);
        }
      },
    });

    return this.violations;
  }

  /**
   * Detect constructor chain escapes: this.constructor.constructor, Object.constructor, etc.
   */
  private checkConstructorChain(node: MemberExpression): void {
    // Walk the chain looking for .constructor access
    let current: Node | undefined = node;
    let depth = 0;
    while (current && depth < 5) {
      if (current.type === 'MemberExpression') {
        const prop = current.property;
        // Detect .constructor access
        if (prop.type === 'Identifier' && prop.name === 'constructor') {
          this.addViolation('constructor chain access is not allowed (vm escape vector)');
          return;
        }
        // Detect ['constructor'] string access
        if (prop.type === 'StringLiteral' && prop.value === 'constructor') {
          this.addViolation('constructor chain access is not allowed (vm escape vector)');
          return;
        }
        current = current.object;
      } else {
        break;
      }
      depth++;
    }
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
  private scriptRepo?: InlineScriptRepository;

  constructor(options?: { approvalRepo?: InlineScriptApprovalRepository; scriptRepo?: InlineScriptRepository }) {
    this.wasmRuntime = new WasmRuntime();
    this.approvalRepo = options?.approvalRepo;
    this.scriptRepo = options?.scriptRepo;
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

    // Standard level: route through WASM runtime for safe execution
    // vm module is NOT a security boundary - use WASM instead
    const permissions = request.config.permissions || {};
    if (permissions.network && permissions.network.length > 0) {
      logger.info({ networks: permissions.network }, 'Network access granted for whitelist');
    }

    try {
      // Use WASM runtime for safe execution (vm.createContext is escapable)
      const result = await this.wasmRuntime.execute({
        code: request.config.code,
        timeout: request.timeout || 30000,
        memoryLimit: 512 * 1024 * 1024,
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

  private async executeAdvanced(request: InlineScriptExecutionRequest, startTime: number): Promise<InlineScriptExecutionResult> {
    logger.info({ taskId: request.taskId }, 'Executing advanced-level inline script');

    if (!request.config.approvalId) {
      return {
        taskId: request.taskId,
        status: 'pending_approval',
        durationMs: Date.now() - startTime,
      };
    }

    // Approval verification is MANDATORY - fail if repo is not available
    if (!this.approvalRepo) {
      return {
        taskId: request.taskId,
        status: 'failed',
        errorMessage: 'Advanced scripts require approval repository. Cannot execute without DB connection.',
        durationMs: Date.now() - startTime,
      };
    }

    if (!request.tenantId) {
      return {
        taskId: request.taskId,
        status: 'failed',
        errorMessage: 'Advanced scripts require tenant ID for approval verification.',
        durationMs: Date.now() - startTime,
      };
    }

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

      // Check expiration
      if (approval.expires_at && new Date() > approval.expires_at) {
        return {
          taskId: request.taskId,
          status: 'failed',
          errorMessage: `Approval ${request.config.approvalId} has expired`,
          durationMs: Date.now() - startTime,
        };
      }

      // Check usage limit for single_use approvals
      if (approval.expiration_type === 'single_use' && approval.used_count >= approval.max_uses) {
        return {
          taskId: request.taskId,
          status: 'failed',
          errorMessage: `Approval ${request.config.approvalId} has been used up`,
          durationMs: Date.now() - startTime,
        };
      }

      // CRITICAL: Verify the code being executed matches the approved code hash
      const codeHash = createHash('sha256').update(request.config.code).digest('hex');
      if (codeHash !== approval.script_code_hash) {
        return {
          taskId: request.taskId,
          status: 'failed',
          errorMessage: 'Code hash does not match approved script. Script may have been modified after approval.',
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

    // All verification passed - execute the approved script
    try {
      const result = await this.wasmRuntime.execute({
        code: request.config.code,
        timeout: request.timeout || 60000,
        memoryLimit: 512 * 1024 * 1024,
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
        errorMessage: error instanceof Error ? error.message : 'Unknown error during execution',
        durationMs: Date.now() - startTime,
      };
    }
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

    // Persist via repository
    await this.approvalRepo.createApproval({
      approvalId: approvalId,
      tenantId: params.tenantId,
      userId: params.userId,
      scriptCodeHash: codeHash,
      scriptLanguage: 'javascript',
      permissions: params.permissions,
      reason: params.reason,
      expirationType: expirationType,
      expiresAt: expiresAt,
    });

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

  // ---- Script CRUD methods ----

  /**
   * Save an inline script (create if not exists, update if exists).
   * DB failure degrades gracefully to in-memory store.
   */
  async saveScript(params: {
    tenantId: string;
    userId?: string;
    name: string;
    scriptContent: string;
    language?: string;
    description?: string;
  }): Promise<{ id: string; name: string }> {
    if (!this.scriptRepo) {
      logger.warn({ name: params.name }, 'Script save skipped: no scriptRepo configured');
      return { id: `stub-${Date.now()}`, name: params.name };
    }

    try {
      const existing = await this.scriptRepo.findByTenantAndName(params.tenantId, params.name);
      if (existing) {
        await this.scriptRepo.update(existing.id, {
          scriptContent: params.scriptContent,
          language: params.language,
          description: params.description,
        }, params.tenantId);
        logger.info({ id: existing.id, name: params.name }, 'Inline script updated');
        return { id: existing.id, name: params.name };
      }

      // Check for duplicate name within tenant
      const exists = await this.scriptRepo.existsByTenantAndName(params.tenantId, params.name);
      if (exists) {
        throw new Error(`Script with name '${params.name}' already exists for this tenant`);
      }

      const script = await this.scriptRepo.create({
        tenantId: params.tenantId,
        name: params.name,
        scriptContent: params.scriptContent,
        language: params.language || 'shell',
        description: params.description,
        createdBy: params.userId,
      });

      logger.info({ id: script.id, name: script.name }, 'Inline script saved');
      return { id: script.id, name: script.name };
    } catch (error) {
      logger.error({ error, name: params.name }, 'Failed to save inline script');
      throw error;
    }
  }

  /**
   * Get a script by name for a given tenant.
   */
  async getScript(tenantId: string, name: string): Promise<{
    id: string;
    name: string;
    scriptContent: string;
    language: string;
    description?: string;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    if (!this.scriptRepo) return null;

    try {
      const script = await this.scriptRepo.findByTenantAndName(tenantId, name);
      if (!script) return null;
      return {
        id: script.id,
        name: script.name,
        scriptContent: script.scriptContent,
        language: script.language,
        description: script.description,
        createdBy: script.createdBy,
        createdAt: script.createdAt,
        updatedAt: script.updatedAt,
      };
    } catch (error) {
      logger.error({ error, tenantId, name }, 'Failed to get inline script');
      return null;
    }
  }

  /**
   * List all scripts for a tenant.
   */
  async listScripts(tenantId: string, _page?: number, _pageSize?: number): Promise<{
    scripts: Array<{
      id: string;
      name: string;
      language: string;
      description?: string;
      createdBy?: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    total: number;
  }> {
    if (!this.scriptRepo) {
      return { scripts: [], total: 0 };
    }

    try {
      const limit = _pageSize || 20;
      const offset = (_page || 0) * limit;
      const result = await this.scriptRepo.listByTenant(tenantId, { limit, offset });
      return {
        scripts: result.entities.map(s => ({
          id: s.id,
          name: s.name,
          language: s.language,
          description: s.description,
          createdBy: s.createdBy,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        total: result.total,
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to list inline scripts');
      return { scripts: [], total: 0 };
    }
  }

  /**
   * Update an existing script.
   */
  async updateScript(tenantId: string, name: string, updates: {
    scriptContent?: string;
    language?: string;
    description?: string;
  }): Promise<{ id: string; name: string } | null> {
    if (!this.scriptRepo) return null;

    try {
      const existing = await this.scriptRepo.findByTenantAndName(tenantId, name);
      if (!existing) return null;

      await this.scriptRepo.update(existing.id, updates, tenantId);
      logger.info({ id: existing.id, name }, 'Inline script updated');
      return { id: existing.id, name: existing.name };
    } catch (error) {
      logger.error({ error, tenantId, name }, 'Failed to update inline script');
      return null;
    }
  }

  /**
   * Delete a script by name.
   */
  async deleteScript(tenantId: string, name: string): Promise<boolean> {
    if (!this.scriptRepo) return false;

    try {
      const existing = await this.scriptRepo.findByTenantAndName(tenantId, name);
      if (!existing) return false;

      await this.scriptRepo.delete(existing.id, tenantId);
      logger.info({ id: existing.id, name }, 'Inline script deleted');
      return true;
    } catch (error) {
      logger.error({ error, tenantId, name }, 'Failed to delete inline script');
      return false;
    }
  }
}
