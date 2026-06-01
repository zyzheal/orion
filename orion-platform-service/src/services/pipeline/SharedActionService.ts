/**
 * SharedActionService — 共享 Action 库服务
 *
 * 职责：
 * - 解析本地/远程/内置/注册表 Action 引用
 * - 安全约束：SHA 固定、白名单、最大深度 5
 * - 变量替换 ${inputs.xxx} → 实际值
 * - 循环引用检测
 */

import * as yaml from 'js-yaml';
import { spawn } from 'child_process';
import pino from 'pino';
import { PipelineStep } from '../../engine/YamlPreprocessor';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ name: 'shared-action-service' });

export interface ActionDefinition {
  name: string;
  description: string;
  inputs?: Record<string, { description: string; default?: string }>;
  runs: {
    steps: Array<{ name: string; uses: string; with?: Record<string, unknown> }>;
  };
}

const MAX_DEPTH = 5;

export class SharedActionService {
  private registryWhitelist: string[];
  private workspaceRoot: string;

  constructor(options?: { registryWhitelist?: string[]; workspaceRoot?: string }) {
    this.registryWhitelist = options?.registryWhitelist || [];
    this.workspaceRoot = options?.workspaceRoot || process.cwd();
  }

  /**
   * 将 Action 引用展开为具体 PipelineSteps。
   */
  async resolveActionRef(
    ref: string,
    inputs: Record<string, unknown>,
    visited: Set<string> = new Set(),
    depth: number = 0,
  ): Promise<PipelineStep[]> {
    if (visited.has(ref)) {
      throw new OrionError(`Circular action reference detected: ${ref}`, ErrorCode.NOT_FOUND);
    }

    if (depth > MAX_DEPTH) {
      throw new OrionError(`Action nesting depth exceeds maximum (${MAX_DEPTH}): ${ref}`, ErrorCode.NOT_FOUND);
    }

    visited.add(ref);

    let actionYaml: string;

    if (ref.startsWith('./')) {
      actionYaml = await this.loadLocalAction(ref);
    } else if (ref.startsWith('builtin:')) {
      const builtinName = ref.replace('builtin:', '');
      const builtin = this.getBuiltinAction(builtinName);
      if (builtin) {
        return this.expandAction(builtin, inputs);
      }
      throw new OrionError(`Unknown builtin action: ${ref}`, ErrorCode.NOT_FOUND);
    } else if (ref.includes('/')) {
      actionYaml = await this.loadRemoteAction(ref);
    } else {
      const builtin = this.getBuiltinAction(ref);
      if (builtin) {
        return this.expandAction(builtin, inputs);
      }
      throw new OrionError(`Unknown action: ${ref}`, ErrorCode.NOT_FOUND);
    }

    const action = yaml.load(actionYaml) as ActionDefinition;
    return this.expandAction(action, inputs);
  }

  private async loadLocalAction(ref: string): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    const resolvedPath = path.resolve(this.workspaceRoot, ref, 'action.yml');

    // Path traversal protection
    if (!resolvedPath.startsWith(path.resolve(this.workspaceRoot))) {
      throw new OrionError(`Path traversal detected: action path must be within workspace root`, ErrorCode.NOT_FOUND);
    }

    if (!fs.existsSync(resolvedPath)) {
      const altPath = path.resolve(this.workspaceRoot, ref, 'action.yaml');
      if (!altPath.startsWith(path.resolve(this.workspaceRoot))) {
        throw new OrionError(`Path traversal detected: action path must be within workspace root`, 'VALIDATION_ERROR')
      }
      if (!fs.existsSync(altPath)) {
        throw new OrionError(`Local action not found: ${ref}`, 'NOT_FOUND')
      }
      return fs.readFileSync(altPath, 'utf-8');
    }
    return fs.readFileSync(resolvedPath, 'utf-8');
  }

  private async loadRemoteAction(ref: string): Promise<string> {
    const [repo, version] = ref.split('@');

    // Validate repo format: only allow org/repo pattern with alphanumeric chars
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
      throw new OrionError(`Invalid repository format: ${repo}. Expected: org/repo`, ErrorCode.NOT_FOUND);
    }

    if (!version || /^(main|master|HEAD)$/i.test(version)) {
      throw new OrionError('Version must use SHA or version tag', ErrorCode.VALIDATION_ERROR);
    }

    if (this.registryWhitelist.length > 0) {
      const org = repo.split('/')[0];
      if (!this.registryWhitelist.includes(org)) {
        throw new OrionError(`Registry not in whitelist: ${org}`, ErrorCode.NOT_FOUND);
      }
    }

    const tmpDir = `/tmp/orion-action-${Date.now()}`;
    await this.gitClone(repo, version, tmpDir);

    const fs = require('fs');
    const path = require('path');
    const actionPath = path.join(tmpDir, 'action.yml');
    if (!fs.existsSync(actionPath)) {
      throw new OrionError(`action.yml not found in remote: ${ref}`, ErrorCode.NOT_FOUND);
    }
    return fs.readFileSync(actionPath, 'utf-8');
  }

  private gitClone(repo: string, version: string, targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'git',
        [
          'clone',
          '--depth',
          '1',
          '--branch',
          version,
          `https://github.com/${repo}.git`,
          targetDir,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      child.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`git clone failed: exit ${code}`)),
      );
      child.on('error', reject);
    });
  }

  expandAction(action: ActionDefinition, inputs: Record<string, unknown>): PipelineStep[] {
    const steps: PipelineStep[] = [];

    for (const step of action.runs.steps) {
      const expandedStep = {
        name: step.name,
        uses: step.uses,
        with: this.resolveInputs(step.with || {}, inputs, action.inputs || {}),
      };
      steps.push(expandedStep);
    }

    return steps;
  }

  private resolveInputs(
    stepWith: Record<string, unknown>,
    inputs: Record<string, unknown>,
    actionInputs: Record<string, { description: string; default?: string }>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(stepWith)) {
      if (typeof value === 'string') {
        result[key] = value.replace(/\$\{inputs\.([\w-]+)\}/g, (_, inputName) => {
          return (
            inputs[inputName] ?? actionInputs[inputName]?.default ?? `\${inputs.${inputName}}`
          ) as string;
        });
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private getBuiltinAction(name: string): ActionDefinition | null {
    const builtins: Record<string, ActionDefinition> = {
      checkout: {
        name: 'checkout',
        description: 'Checkout repository',
        runs: {
          steps: [{ name: 'checkout', uses: 'builtin:git/clone@v1', with: {} }],
        },
      },
    };
    return builtins[name] || null;
  }
}
