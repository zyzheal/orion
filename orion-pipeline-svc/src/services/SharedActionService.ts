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
import { PipelineStep } from '../engine/YamlPreprocessor';

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
      throw new Error(`Circular action reference detected: ${ref}`);
    }

    if (depth > MAX_DEPTH) {
      throw new Error(`Action nesting depth exceeds maximum (${MAX_DEPTH}): ${ref}`);
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
      throw new Error(`Unknown builtin action: ${ref}`);
    } else if (ref.includes('/')) {
      actionYaml = await this.loadRemoteAction(ref);
    } else {
      const builtin = this.getBuiltinAction(ref);
      if (builtin) {
        return this.expandAction(builtin, inputs);
      }
      throw new Error(`Unknown action: ${ref}`);
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
      throw new Error(`Path traversal detected: action path must be within workspace root`);
    }

    if (!fs.existsSync(resolvedPath)) {
      const altPath = path.resolve(this.workspaceRoot, ref, 'action.yaml');
      if (!altPath.startsWith(path.resolve(this.workspaceRoot))) {
        throw new Error(`Path traversal detected: action path must be within workspace root`);
      }
      if (!fs.existsSync(altPath)) {
        throw new Error(`Local action not found: ${ref}`);
      }
      return fs.readFileSync(altPath, 'utf-8');
    }
    return fs.readFileSync(resolvedPath, 'utf-8');
  }

  private async loadRemoteAction(ref: string): Promise<string> {
    const [repo, version] = ref.split('@');

    // Validate repo format: only allow org/repo pattern with alphanumeric chars
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
      throw new Error(`Invalid repository format: ${repo}. Expected: org/repo`);
    }

    if (!version || /^(main|master|HEAD)$/i.test(version)) {
      throw new Error(
        `Remote actions must use SHA or version tag, not branch names: ${ref}`
      );
    }

    if (this.registryWhitelist.length > 0) {
      const org = repo.split('/')[0];
      if (!this.registryWhitelist.includes(org)) {
        throw new Error(`Registry not in whitelist: ${org}`);
      }
    }

    const fs = require('fs');
    const path = require('path');
    const tmpDir = `/tmp/orion-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      await this.gitClone(repo, version, tmpDir);

      const actionPath = path.join(tmpDir, 'action.yml');
      if (!fs.existsSync(actionPath)) {
        throw new Error(`action.yml not found in remote: ${ref}`);
      }
      return fs.readFileSync(actionPath, 'utf-8');
    } finally {
      // 清理临时目录
      try {
        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        logger.warn({ error: cleanupError }, 'Failed to cleanup temp action directory');
      }
    }
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
      const resolvedWith = this.resolveInputs(step.with || {}, inputs, action.inputs || {});
      const expandedStep: PipelineStep = {
        id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: step.name,
        type: step.uses?.startsWith('builtin:') ? 'command' : 'action',
        command: step.uses?.startsWith('builtin:') ? this.extractBuiltinCommand(step.uses, resolvedWith) : undefined,
        actionRef: step.uses?.startsWith('builtin:') ? undefined : step.uses,
        actionInputs: step.uses?.startsWith('builtin:') ? undefined : resolvedWith,
        env: {},
      };
      steps.push(expandedStep);
    }

    return steps;
  }

  /**
   * 从 builtin action 引用中提取命令
   * 使用安全的参数化形式，防止注入
   */
  private extractBuiltinCommand(uses: string, withParams: Record<string, unknown>): string {
    const actionName = uses.replace('builtin:', '');
    const params = withParams as Record<string, string>;

    // 简单的参数转义，防止注入
    const escapeArg = (arg: string): string => {
      // 移除危险字符
      return arg.replace(/[;&|`$()><]/g, '').trim();
    };

    switch (actionName) {
      case 'command':
      case 'exec':
        return params.command || '';
      case 'git/clone':
        // 使用数组形式构建命令，然后在 PipelineEngine 中解析
        return `git clone --depth ${escapeArg(params.depth || '1')} --branch ${escapeArg(params.ref || 'main')} ${escapeArg(params.repository || '')} ${escapeArg(params.path || '.')}`;
      case 'node/install':
        return `npm install${params.registry ? ` --registry=${escapeArg(params.registry)}` : ''}`;
      case 'node/build':
        return `npm run ${escapeArg(params.script || 'build')}`;
      case 'node/test':
        return `npm run ${escapeArg(params.script || 'test')}${params.coverage === 'true' ? ' -- --coverage' : ''}`;
      case 'python/install':
        return `pip install -r ${escapeArg(params.requirements || 'requirements.txt')}`;
      case 'python/test':
        return `${escapeArg(params.framework || 'pytest')} ${escapeArg(params.testdir || 'tests')}`;
      case 'go/build':
        return `go build -o ${escapeArg(params.output || 'app')}`;
      case 'go/test':
        return `go test ${escapeArg(params.args || './...')}${params.cover === 'true' ? ' -cover' : ''}`;
      case 'docker/push':
        return `docker push ${escapeArg(params.image)}:${escapeArg(params.tag || 'latest')}`;
      case 'artifact/upload':
        return `echo "Upload artifact ${escapeArg(params.name)} from ${escapeArg(params.path)}"`;
      case 'artifact/download':
        return `echo "Download artifact ${escapeArg(params.name)} to ${escapeArg(params.path)}"`;
      case 'notify':
        return `echo "Notify ${escapeArg(params.channel)}: ${escapeArg(params.message)}"`;
      default:
        return '';
    }
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
      // Git 操作
      checkout: {
        name: 'checkout',
        description: 'Checkout repository code',
        inputs: {
          repository: { description: 'Repository URL', default: '${inputs.repository}' },
          ref: { description: 'Branch or tag', default: 'main' },
          path: { description: 'Checkout path', default: '.' },
        },
        runs: {
          steps: [
            { name: 'checkout', uses: 'builtin:git/clone', with: { ref: '${inputs.ref}', path: '${inputs.path}' } },
          ],
        },
      },
      'git/clone': {
        name: 'git/clone',
        description: 'Clone a git repository',
        inputs: {
          repository: { description: 'Repository URL' },
          ref: { description: 'Branch or tag', default: 'main' },
          path: { description: 'Checkout path', default: '.' },
          depth: { description: 'Clone depth', default: '1' },
        },
        runs: {
          steps: [
            { name: 'clone', uses: 'builtin:command', with: { command: 'git clone --depth ${inputs.depth} --branch ${inputs.ref} ${inputs.repository} ${inputs.path}' } },
          ],
        },
      },

      // Node.js 构建
      'node/setup': {
        name: 'node/setup',
        description: 'Setup Node.js environment',
        inputs: {
          version: { description: 'Node.js version', default: '20' },
        },
        runs: {
          steps: [
            { name: 'setup-node', uses: 'builtin:command', with: { command: 'echo "Node.js ${inputs.version} setup"' } },
          ],
        },
      },
      'node/install': {
        name: 'node/install',
        description: 'Install Node.js dependencies',
        inputs: {
          registry: { description: 'NPM registry URL' },
        },
        runs: {
          steps: [
            { name: 'install', uses: 'builtin:command', with: { command: 'npm install${inputs.registry ? ` --registry=${inputs.registry}` : ""}' } },
          ],
        },
      },
      'node/build': {
        name: 'node/build',
        description: 'Build Node.js project',
        inputs: {
          script: { description: 'Build script', default: 'build' },
        },
        runs: {
          steps: [
            { name: 'build', uses: 'builtin:command', with: { command: 'npm run ${inputs.script}' } },
          ],
        },
      },
      'node/test': {
        name: 'node/test',
        description: 'Run Node.js tests',
        inputs: {
          script: { description: 'Test script', default: 'test' },
          coverage: { description: 'Generate coverage', default: 'false' },
        },
        runs: {
          steps: [
            { name: 'test', uses: 'builtin:command', with: { command: 'npm run ${inputs.script}${inputs.coverage === "true" ? " -- --coverage" : ""}' } },
          ],
        },
      },

      // Python 构建
      'python/setup': {
        name: 'python/setup',
        description: 'Setup Python environment',
        inputs: {
          version: { description: 'Python version', default: '3.11' },
          virtualenv: { description: 'Use virtualenv', default: 'true' },
        },
        runs: {
          steps: [
            { name: 'setup-python', uses: 'builtin:command', with: { command: 'echo "Python ${inputs.version} setup"' } },
          ],
        },
      },
      'python/install': {
        name: 'python/install',
        description: 'Install Python dependencies',
        inputs: {
          requirements: { description: 'Requirements file', default: 'requirements.txt' },
        },
        runs: {
          steps: [
            { name: 'install', uses: 'builtin:command', with: { command: 'pip install -r ${inputs.requirements}' } },
          ],
        },
      },
      'python/test': {
        name: 'python/test',
        description: 'Run Python tests',
        inputs: {
          testdir: { description: 'Test directory', default: 'tests' },
          framework: { description: 'Test framework (pytest/unittest)', default: 'pytest' },
        },
        runs: {
          steps: [
            { name: 'test', uses: 'builtin:command', with: { command: '${inputs.framework} ${inputs.testdir}' } },
          ],
        },
      },

      // Go 构建
      'go/setup': {
        name: 'go/setup',
        description: 'Setup Go environment',
        inputs: {
          version: { description: 'Go version', default: '1.21' },
        },
        runs: {
          steps: [
            { name: 'setup-go', uses: 'builtin:command', with: { command: 'echo "Go ${inputs.version} setup"' } },
          ],
        },
      },
      'go/build': {
        name: 'go/build',
        description: 'Build Go project',
        inputs: {
          output: { description: 'Output binary name', default: 'app' },
          ldflags: { description: 'Linker flags' },
        },
        runs: {
          steps: [
            { name: 'build', uses: 'builtin:command', with: { command: 'go build -o ${inputs.output}${inputs.ldflags ? ` -ldflags="${inputs.ldflags}"` : ""}' } },
          ],
        },
      },
      'go/test': {
        name: 'go/test',
        description: 'Run Go tests',
        inputs: {
          args: { description: 'Test arguments', default: './...' },
          cover: { description: 'Enable coverage', default: 'false' },
        },
        runs: {
          steps: [
            { name: 'test', uses: 'builtin:command', with: { command: 'go test ${inputs.args}${inputs.cover === "true" ? " -cover" : ""}' } },
          ],
        },
      },

      // Docker 构建
      'docker/setup': {
        name: 'docker/setup',
        description: 'Setup Docker Buildx',
        inputs: {
          driver: { description: 'Buildx driver', default: 'docker-container' },
        },
        runs: {
          steps: [
            { name: 'setup-docker', uses: 'builtin:command', with: { command: 'echo "Docker setup"' } },
          ],
        },
      },
      'docker/build': {
        name: 'docker/build',
        description: 'Build Docker image',
        inputs: {
          context: { description: 'Build context', default: '.' },
          dockerfile: { description: 'Dockerfile path', default: 'Dockerfile' },
          image: { description: 'Image name', default: '${inputs.image}' },
          tags: { description: 'Image tags', default: 'latest' },
          buildArgs: { description: 'Build arguments (JSON)', default: '{}' },
          platforms: { description: 'Target platforms', default: 'linux/amd64' },
        },
        runs: {
          steps: [
            {
              name: 'build',
              uses: 'builtin:docker-build',
              with: {
                context: '${inputs.context}',
                dockerfile: '${inputs.dockerfile}',
                image: '${inputs.image}',
                tag: '${inputs.tags}',
                args: '${inputs.buildArgs}',
                platforms: '${inputs.platforms}',
              },
            },
          ],
        },
      },
      'docker/push': {
        name: 'docker/push',
        description: 'Push Docker image',
        inputs: {
          image: { description: 'Image name' },
          tag: { description: 'Image tag', default: 'latest' },
        },
        runs: {
          steps: [
            { name: 'push', uses: 'builtin:command', with: { command: 'docker push ${inputs.image}:${inputs.tag}' } },
          ],
        },
      },

      // 通用命令
      command: {
        name: 'command',
        description: 'Run a shell command',
        inputs: {
          command: { description: 'Command to run', default: 'echo "Hello"' },
          workingDirectory: { description: 'Working directory' },
        },
        runs: {
          steps: [
            { name: 'run', uses: 'builtin:exec', with: { command: '${inputs.command}', cwd: '${inputs.workingDirectory}' } },
          ],
        },
      },
      exec: {
        name: 'exec',
        description: 'Execute a command',
        inputs: {
          command: { description: 'Command to execute' },
          cwd: { description: 'Working directory' },
          env: { description: 'Environment variables (JSON)', default: '{}' },
        },
        runs: {
          steps: [
            { name: 'exec', uses: 'builtin:shell', with: { command: '${inputs.command}', cwd: '${inputs.cwd}', env: '${inputs.env}' } },
          ],
        },
      },
      shell: {
        name: 'shell',
        description: 'Run shell script',
        inputs: {
          command: { description: 'Shell command' },
          cwd: { description: 'Working directory' },
          env: { description: 'Environment variables' },
        },
        runs: {
          steps: [
            { name: 'shell', uses: 'builtin:raw', with: {} },
          ],
        },
      },
      raw: {
        name: 'raw',
        description: 'Raw step (placeholder)',
        runs: {
          steps: [],
        },
      },

      // 文件操作
      'artifact/upload': {
        name: 'artifact/upload',
        description: 'Upload build artifact',
        inputs: {
          name: { description: 'Artifact name' },
          path: { description: 'Path to artifact' },
          retentionDays: { description: 'Retention days', default: '30' },
        },
        runs: {
          steps: [
            { name: 'upload', uses: 'builtin:command', with: { command: 'echo "Upload artifact ${inputs.name} from ${inputs.path}"' } },
          ],
        },
      },
      'artifact/download': {
        name: 'artifact/download',
        description: 'Download build artifact',
        inputs: {
          name: { description: 'Artifact name' },
          path: { description: 'Download path', default: '.' },
        },
        runs: {
          steps: [
            { name: 'download', uses: 'builtin:command', with: { command: 'echo "Download artifact ${inputs.name} to ${inputs.path}"' } },
          ],
        },
      },

      // 通知
      notify: {
        name: 'notify',
        description: 'Send notification',
        inputs: {
          channel: { description: 'Notification channel (slack/dingtalk/email)' },
          message: { description: 'Notification message' },
          webhookUrl: { description: 'Webhook URL for the channel' },
        },
        runs: {
          steps: [
            { name: 'notify', uses: 'builtin:command', with: { command: 'echo "Notify ${inputs.channel}: ${inputs.message}"' } },
          ],
        },
      },
    };

    return builtins[name] || null;
  }
}
