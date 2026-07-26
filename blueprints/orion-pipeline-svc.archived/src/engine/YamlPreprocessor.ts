/**
 * YamlPreprocessor - YAML pipeline 预处理器
 *
 * 职责：
 * - 解析 YAML pipeline 定义为内部执行模型
 * - 展开 uses action 引用为具体步骤
 * - 变量替换 ${inputs.xxx}, ${env.XXX}, ${secrets.XXX}
 * - 支持 matrix 并行展开
 * - 生成可执行的 PipelineStep 列表
 */

import * as yaml from 'js-yaml';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import pino from 'pino';
import { SharedActionService, ActionDefinition } from '../services/SharedActionService';

const logger = pino({ name: 'yaml-preprocessor' });

/**
 * Pipeline 执行步骤
 */
export interface PipelineStep {
  /** 步骤唯一 ID */
  id: string;
  /** 步骤名称 */
  name: string;
  /** 执行类型: command, action, plugin, docker-build, k8s-deploy, helm-deploy, cache-restore, cache-save */
  type: 'command' | 'action' | 'plugin' | 'docker-build' | 'k8s-deploy' | 'helm-deploy' | 'cache-restore' | 'cache-save' | 'artifact-sign' | 'artifact-publish';
  /** 执行命令 (command 类型) */
  command?: string;
  /** 工作目录 */
  workingDir?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** Action 引用 (action 类型) */
  actionRef?: string;
  /** Action 输入参数 */
  actionInputs?: Record<string, unknown>;
  /** Plugin 引用 (plugin 类型) */
  pluginRef?: string;
  /** Plugin 配置 */
  pluginConfig?: Record<string, unknown>;
  /** Docker 构建配置 (docker-build 类型) */
  dockerBuild?: {
    context?: string;
    dockerfile?: string;
    imageName: string;
    tag?: string;
    buildArgs?: Record<string, string>;
    labels?: Record<string, string>;
    platforms?: string[];
  };
  /** K8s 部署配置 (k8s-deploy 类型) */
  k8sDeploy?: {
    namespace: string;
    deploymentName: string;
    imageName: string;
    tag: string;
    replicas?: number;
    resourceLimits?: { cpu?: string; memory?: string };
    envVars?: Record<string, string>;
  };
  /** Helm 部署配置 (helm-deploy 类型) */
  helmDeploy?: {
    releaseName: string;
    namespace: string;
    chartPath: string;
    values?: Record<string, unknown>;
    version?: string;
    wait?: boolean;
    timeout?: string;
  };
  /** 缓存配置 (cache-restore/cache-save 类型) */
  cache?: {
    key: string;
    paths: string[];
    restoreKeys?: string[];
    maxAge?: number;
  };
  /** 制品签名配置 (artifact-sign 类型) */
  artifactSign?: {
    filePath: string;
    algorithm?: 'sha256' | 'sha512' | 'md5';
  };
  /** 制品发布配置 (artifact-publish 类型) */
  artifactPublish?: {
    type: 'maven' | 'npm' | 'helm' | 'generic';
    filePath: string;
    name: string;
    version: string;
    metadata?: Record<string, unknown>;
  };
  /** 超时时间 (ms) */
  timeoutMs?: number;
  /** 失败时继续 */
  continueOnError?: boolean;
  /** 条件表达式 */
  condition?: string;
}

/**
 * Pipeline 阶段执行配置
 */
export interface StageExecutionConfig {
  stageId: string;
  stageName: string;
  steps: PipelineStep[];
  env: Record<string, string>;
  timeoutMs?: number;
  continueOnError?: boolean;
}

/**
 * 解析后的 Pipeline 执行模型
 */
export interface PipelineExecutionModel {
  pipelineId: string;
  pipelineName: string;
  stages: StageExecutionConfig[];
  env: Record<string, string>;
}

/**
 * 变量上下文
 */
export interface VariableContext {
  inputs: Record<string, unknown>;
  env: Record<string, string>;
  secrets: Record<string, string>;
  params: Record<string, unknown>;
}

/**
 * YAML 解析类型定义
 */
interface PipelineYamlSchema {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string };
  name?: string;
  spec?: {
    stages?: PipelineYamlStage[];
  };
  stages?: PipelineYamlStage[];
  env?: Record<string, string>;
}

interface PipelineYamlStage {
  name: string;
  runsOn?: string;
  steps?: PipelineYamlStep[];
  dependsOn?: string[];
  if?: string;
  timeout?: number;
  retries?: number;
  parallel?: boolean;
  type?: string;
  config?: Record<string, unknown>;
  env?: Record<string, string>;
  matrix?: Record<string, string[]> & { exclude?: Array<Record<string, string>> };
}

interface PipelineYamlStep {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
  if?: string;
  timeout?: number;
  continueOnError?: boolean;
  docker?: Record<string, unknown>;
  plugin?: Record<string, unknown>;
  workingDir?: string;
  'working-directory'?: string;
}

export class YamlPreprocessor {
  private sharedActionService: SharedActionService;
  private workspaceRoot: string;

  constructor(options?: { workspaceRoot?: string; registryWhitelist?: string[] }) {
    this.sharedActionService = new SharedActionService({
      workspaceRoot: options?.workspaceRoot || process.cwd(),
      registryWhitelist: options?.registryWhitelist || [],
    });
    this.workspaceRoot = options?.workspaceRoot || process.cwd();
  }

  /**
   * 解析 YAML 字符串为可执行的 Pipeline 模型
   */
  parse(yamlString: string, context?: Partial<VariableContext>): PipelineExecutionModel {
    const parsed = yaml.load(yamlString, { schema: yaml.JSON_SCHEMA }) as PipelineYamlSchema;
    const fullContext = this.buildContext(context || {});

    // 支持两种格式：wrapped (apiVersion/kind) 和 flat (stages at root)
    const metadata = parsed.metadata || {};
    const pipelineName = metadata.name || parsed.name || 'untitled';
    const stages = parsed.spec?.stages || parsed.stages || [];

    const executionStages: StageExecutionConfig[] = [];

    for (const stage of stages) {
      // Task 1.2: Matrix 并行展开
      if (stage.matrix) {
        const expandedStages = this.expandMatrixStage(stage, fullContext, pipelineName);
        executionStages.push(...expandedStages);
      } else {
        const executionStage = this.parseStage(stage, fullContext, pipelineName);
        executionStages.push(executionStage);
      }
    }

    return {
      pipelineId: this.normalizeId(pipelineName),
      pipelineName,
      stages: executionStages,
      env: this.resolveVariables(parsed.env || {}, fullContext) as Record<string, string>,
    };
  }

  /**
   * Matrix 并行展开 (Task 1.2)
   * 将 matrix 配置展开为多个独立的 stage，支持笛卡尔积组合和 exclude 过滤
   */
  private expandMatrixStage(
    stage: any,
    context: VariableContext,
    pipelineName: string
  ): StageExecutionConfig[] {
    const matrix = stage.matrix;
    const exclude = matrix.exclude || [];

    // 生成笛卡尔积组合
    const combinations = this.generateMatrixCombinations(matrix);
    const filtered = combinations.filter(combo => !this.isExcluded(combo, exclude));

    return filtered.map((combo, idx) => {
      const matrixSuffix = `matrix-${idx + 1}`;
      const matrixStageId = this.normalizeId(`${stage.name || 'stage'}-${matrixSuffix}`);

      // 替换 steps 中的 matrix 变量
      const resolvedSteps = stage.steps
        ? stage.steps.map((step: any) => this.replaceMatrixVariables(step, combo, context))
        : [];

      // 合并 matrix 变量到 env
      const matrixEnv = this.matrixToEnv(combo);
      const stageEnv = this.resolveVariables(stage.env || {}, context) as Record<string, string>;
      const mergedEnv = { ...context.env, ...stageEnv, ...matrixEnv };

      return {
        stageId: matrixStageId,
        stageName: `${stage.name || matrixStageId} [${this.formatMatrixLabel(combo)}]`,
        steps: resolvedSteps,
        env: mergedEnv,
        timeoutMs: stage.timeout,
        continueOnError: stage.continueOnError,
      };
    });
  }

  /**
   * 生成 Matrix 笛卡尔积组合
   */
  private generateMatrixCombinations(matrix: Record<string, string[]>): Record<string, string>[] {
    const keys = Object.keys(matrix).filter(k => k !== 'exclude');
    if (keys.length === 0) return [{}];

    const values = keys.map(k => matrix[k].map(v => ({ [k]: v })));
    return this.cartesianProduct(...values);
  }

  /**
   * 笛卡尔积算法
   */
  private cartesianProduct(...arrays: Record<string, string>[][]): Record<string, string>[] {
    if (arrays.length === 0) return [{}];

    return arrays.reduce(
      (acc, arr) => {
        const result: Record<string, string>[] = [];
        for (const a of acc) {
          for (const b of arr) {
            result.push({ ...a, ...b });
          }
        }
        return result;
      },
      [{}] as Record<string, string>[]
    );
  }

  /**
   * 检查组合是否被 exclude
   */
  private isExcluded(
    combo: Record<string, string>,
    excludeRules: Array<Record<string, string>>
  ): boolean {
    return excludeRules.some(rule => {
      return Object.entries(rule).every(
        ([key, value]) => combo[key] === value
      );
    });
  }

  /**
   * 替换 step 中的 matrix 变量
   */
  private replaceMatrixVariables(
    step: any,
    combo: Record<string, string>,
    context: VariableContext
  ): PipelineStep | null {
    // 深拷贝 step 避免修改原对象
    const clonedStep = JSON.parse(JSON.stringify(step));

    // 替换所有字符串值中的 matrix 变量 ${matrix.xxx}
    const replaceInObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/\$\{matrix\.([\w-]+)\}/g, (_, key) => {
          return combo[key] !== undefined ? combo[key] : `\${matrix.${key}}`;
        });
      }
      if (Array.isArray(obj)) {
        return obj.map(replaceInObject);
      }
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [k, v] of Object.entries(obj)) {
          result[k] = replaceInObject(v);
        }
        return result;
      }
      return obj;
    };

    const resolvedStep = replaceInObject(clonedStep);
    const stepId = resolvedStep.name || 'matrix-step';

    // 解析为 PipelineStep
    return this.parseStep(resolvedStep, context, 'matrix-stage', stepId) as PipelineStep | null;
  }

  /**
   * Matrix 变量转环境变量
   */
  private matrixToEnv(combo: Record<string, string>): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(combo)) {
      env[`MATRIX_${key.toUpperCase()}`] = value;
    }
    env['MATRIX_LABEL'] = this.formatMatrixLabel(combo);
    return env;
  }

  /**
   * 格式化 Matrix 标签
   */
  private formatMatrixLabel(combo: Record<string, string>): string {
    return Object.entries(combo)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
  }

  /**
   * 解析单个 stage
   */
  private stageCounter = 0;

  private parseStage(
    stage: any,
    context: VariableContext,
    pipelineId: string
  ): StageExecutionConfig {
    const stageId = this.normalizeId(stage.name || `stage-${this.stageCounter++}`);
    const stageEnv = this.resolveVariables(stage.env || {}, context) as Record<string, string>;
    const mergedEnv = { ...context.env, ...stageEnv };

    const steps: PipelineStep[] = [];
    const stageSteps = stage.steps || [];

    for (const step of stageSteps) {
      const parsedStep = this.parseStep(step, { ...context, env: mergedEnv }, pipelineId, stageId);
      if (parsedStep) {
        steps.push(parsedStep);
      }
    }

    return {
      stageId,
      stageName: stage.name || stageId,
      steps,
      env: mergedEnv,
      timeoutMs: stage.timeout,
      continueOnError: stage.continueOnError,
    };
  }

  /**
   * 解析单个 step
   */
  private parseStep(
    step: any,
    context: VariableContext,
    pipelineId: string,
    stageId: string
  ): PipelineStep | null {
    const stepId = `${stageId}::${step.name || 'step-' + Date.now()}`;

    // 1. 如果有 uses，解析为 action 或 plugin
    if (step.uses) {
      return this.parseUsesStep(step, stepId, context, pipelineId);
    }

    // 2. 如果有 run，解析为 command
    if (step.run) {
      return this.parseCommandStep(step, stepId, context);
    }

    // 3. 如果有 docker，构建 Docker 镜像
    if (step.docker) {
      return this.parseDockerStep(step, stepId, context);
    }

    // 4. 如果有 plugin
    if (step.plugin) {
      return this.parsePluginStep(step, stepId, context);
    }

    // 5. K8s 部署步骤
    if (step.k8s) {
      return this.parseK8sStep(step, stepId, context);
    }

    // 6. Helm 部署步骤
    if (step.helm) {
      return this.parseHelmStep(step, stepId, context);
    }

    // 7. 缓存恢复步骤
    if (step.cacheRestore || step['cache-restore']) {
      return this.parseCacheRestoreStep(step, stepId, context);
    }

    // 8. 缓存保存步骤
    if (step.cacheSave || step['cache-save']) {
      return this.parseCacheSaveStep(step, stepId, context);
    }

    // 9. 制品签名步骤
    if (step.artifactSign || step['artifact-sign']) {
      return this.parseArtifactSignStep(step, stepId, context);
    }

    // 10. 制品发布步骤
    if (step.artifactPublish || step['artifact-publish']) {
      return this.parseArtifactPublishStep(step, stepId, context);
    }

    logger.warn({ step }, 'Unknown step type, skipping');
    return null;
  }

  /**
   * 解析 K8s 部署步骤
   */
  private parseK8sStep(step: any, stepId: string, context: VariableContext): PipelineStep {
    const resolved = this.resolveVariables(step.k8s || step['k8s-deploy'], context);
    return {
      id: stepId,
      name: step.name || 'k8s-deploy',
      type: 'k8s-deploy',
      k8sDeploy: {
        namespace: resolved.namespace || 'default',
        deploymentName: resolved.deploymentName || resolved.name,
        imageName: resolved.imageName || resolved.image,
        tag: resolved.tag || 'latest',
        replicas: resolved.replicas,
        resourceLimits: resolved.resourceLimits || resolved.resources,
        envVars: resolved.envVars || resolved.env,
      },
      env: context.env,
      timeoutMs: step.timeout,
      continueOnError: step.continueOnError,
      condition: step.if,
    };
  }

  /**
   * 解析 Helm 部署步骤
   */
  private parseHelmStep(step: any, stepId: string, context: VariableContext): PipelineStep {
    const resolved = this.resolveVariables(step.helm, context);
    return {
      id: stepId,
      name: step.name || 'helm-deploy',
      type: 'helm-deploy',
      helmDeploy: {
        releaseName: resolved.releaseName || resolved.name,
        namespace: resolved.namespace || 'default',
        chartPath: resolved.chartPath || resolved.chart,
        values: resolved.values,
        version: resolved.version,
        wait: resolved.wait,
        timeout: resolved.timeout,
      },
      env: context.env,
      timeoutMs: step.timeout,
      continueOnError: step.continueOnError,
      condition: step.if,
    };
  }

  /**
   * 解析缓存恢复步骤
   */
  private parseCacheRestoreStep(step: any, stepId: string, context: VariableContext): PipelineStep {
    const cacheConfig = step.cacheRestore || step['cache-restore'];
    const resolved = this.resolveVariables(cacheConfig, context);
    return {
      id: stepId,
      name: step.name || 'cache-restore',
      type: 'cache-restore',
      cache: {
        key: resolved.key,
        paths: Array.isArray(resolved.paths) ? resolved.paths : [resolved.paths],
        restoreKeys: resolved.restoreKeys || resolved.keys,
        maxAge: resolved.maxAge || resolved.ttl,
      },
      env: context.env,
      timeoutMs: step.timeout,
      continueOnError: step.continueOnError,
      condition: step.if,
    };
  }

  /**
   * 解析缓存保存步骤
   */
  private parseCacheSaveStep(step: any, stepId: string, context: VariableContext): PipelineStep {
    const cacheConfig = step.cacheSave || step['cache-save'];
    const resolved = this.resolveVariables(cacheConfig, context);
    return {
      id: stepId,
      name: step.name || 'cache-save',
      type: 'cache-save',
      cache: {
        key: resolved.key,
        paths: Array.isArray(resolved.paths) ? resolved.paths : [resolved.paths],
        maxAge: resolved.maxAge || resolved.ttl,
      },
      env: context.env,
      timeoutMs: step.timeout,
      continueOnError: step.continueOnError,
      condition: step.if,
    };
  }

  /**
   * 解析制品签名步骤
   */
  private parseArtifactSignStep(step: any, stepId: string, context: VariableContext): PipelineStep {
    const signConfig = step.artifactSign || step['artifact-sign'];
    const resolved = this.resolveVariables(signConfig, context);
    return {
      id: stepId,
      name: step.name || 'artifact-sign',
      type: 'artifact-sign',
      artifactSign: {
        filePath: resolved.filePath || resolved.file,
        algorithm: resolved.algorithm || 'sha256',
      },
      env: context.env,
      timeoutMs: step.timeout,
      continueOnError: step.continueOnError,
      condition: step.if,
    };
  }

  /**
   * 解析制品发布步骤
   */
  private parseArtifactPublishStep(step: any, stepId: string, context: VariableContext): PipelineStep {
    const publishConfig = step.artifactPublish || step['artifact-publish'];
    const resolved = this.resolveVariables(publishConfig, context);
    return {
      id: stepId,
      name: step.name || 'artifact-publish',
      type: 'artifact-publish',
      artifactPublish: {
        type: resolved.type || 'generic',
        filePath: resolved.filePath || resolved.file,
        name: resolved.name,
        version: resolved.version,
        metadata: resolved.metadata,
      },
      env: context.env,
      timeoutMs: step.timeout,
      continueOnError: step.continueOnError,
      condition: step.if,
    };
  }

  /**
   * 解析 uses 引用 (action 或 plugin)
   */
  private parseUsesStep(
    step: any,
    stepId: string,
    context: VariableContext,
    pipelineId: string
  ): PipelineStep {
    const uses = step.uses;
    const withParams = step.with || {};

    // 解析 with 参数中的变量
    const resolvedInputs = this.resolveVariables(withParams, context);

    // 判断是 action 还是 plugin
    if (uses.startsWith('plugin:')) {
      const pluginRef = uses.replace('plugin:', '');
      return {
        id: stepId,
        name: step.name || 'plugin-step',
        type: 'plugin',
        pluginRef,
        pluginConfig: resolvedInputs,
        env: context.env,
        timeoutMs: step.timeout,
        continueOnError: step.continueOnError,
        condition: step.if,
      };
    }

    // 否则视为 action
    return {
      id: stepId,
      name: step.name || 'action-step',
      type: 'action',
      actionRef: uses,
      actionInputs: resolvedInputs,
      env: context.env,
      timeoutMs: step.timeout,
      continueOnError: step.continueOnError,
      condition: step.if,
    };
  }

  /**
   * 解析 command step (run 字段)
   */
  private parseCommandStep(step: any, stepId: string, context: VariableContext): PipelineStep {
    const run = step.run;
    const resolvedCommand = typeof run === 'string'
      ? this.replaceVariables(run, context)
      : run;

    // 验证工作目录路径，防止路径遍历
    const rawWorkingDir = step.workingDir || step['working-directory'];
    const workingDir = rawWorkingDir ? this.validateWorkingDirectory(rawWorkingDir) : undefined;

    return {
      id: stepId,
      name: step.name || 'command-step',
      type: 'command',
      command: resolvedCommand,
      workingDir,
      env: context.env,
      timeoutMs: step.timeout,
      continueOnError: step.continueOnError,
      condition: step.if,
    };
  }

  /**
   * 验证工作目录路径，防止路径遍历攻击
   */
  private validateWorkingDirectory(workingDir: string): string | undefined {
    // 禁止绝对路径（安全考虑）
    if (path.isAbsolute(workingDir)) {
      return undefined;
    }

    // 禁止路径遍历
    const normalized = path.normalize(workingDir);
    if (normalized.includes('..')) {
      return undefined;
    }

    return workingDir;
  }

  /**
   * 解析 Docker 构建 step
   */
  private parseDockerStep(step: any, stepId: string, context: VariableContext): PipelineStep {
    const docker = step.docker;
    const resolved = this.resolveVariables(docker, context);

    return {
      id: stepId,
      name: step.name || 'docker-build-step',
      type: 'docker-build',
      dockerBuild: {
        context: resolved.context,
        dockerfile: resolved.dockerfile,
        imageName: resolved.image || resolved.imageName,
        tag: resolved.tag || 'latest',
        buildArgs: resolved.buildArgs || resolved.args,
        labels: resolved.labels,
        platforms: resolved.platforms,
      },
      env: context.env,
      timeoutMs: step.timeout,
      continueOnError: step.continueOnError,
      condition: step.if,
    };
  }

  /**
   * 解析 Plugin step
   */
  private parsePluginStep(step: any, stepId: string, context: VariableContext): PipelineStep {
    const resolved = this.resolveVariables(step.plugin, context);

    return {
      id: stepId,
      name: step.name || 'plugin-step',
      type: 'plugin',
      pluginRef: resolved.ref || resolved.name,
      pluginConfig: resolved.config || {},
      env: context.env,
      timeoutMs: step.timeout,
      continueOnError: step.continueOnError,
      condition: step.if,
    };
  }

  /**
   * 展开 action 引用为具体 steps (供 PipelineEngine 调用)
   */
  async expandAction(
    actionRef: string,
    inputs: Record<string, unknown>
  ): Promise<PipelineStep[]> {
    try {
      const expandedSteps = await this.sharedActionService.resolveActionRef(actionRef, inputs);
      return expandedSteps.map((s: PipelineStep, i: number) => ({
        id: s.id || `action-${Date.now()}-${i}`,
        name: s.name || actionRef,
        type: s.type || 'command',
        command: s.command,
        actionRef: s.actionRef,
        actionInputs: s.actionInputs,
      }));
    } catch (error) {
      logger.error({ error, actionRef }, 'Failed to expand action');
      throw error;
    }
  }

  /**
   * 敏感环境变量前缀白名单 - 只允许这些前缀的环境变量传入执行上下文
   */
  private static readonly SAFE_ENV_PREFIXES = [
    'PATH', 'HOME', 'USER', 'LANG', 'LC_', 'TERM',
    'NODE_', 'CI_', 'ORION_', 'RUNNER_',
    'GIT_', 'GITHUB_', 'GITLAB_',
    'DOCKER_', 'KUBE_', 'HELM_',
  ];

  /**
   * 过滤环境变量，防止敏感信息泄露到 Pipeline 执行环境
   */
  private filterEnv(env: NodeJS.ProcessEnv): Record<string, string> {
    const sensitivePatterns = ['SECRET', 'KEY', 'PASSWORD', 'TOKEN', 'CREDENTIAL', 'PRIVATE'];
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) continue;
      // 拒绝包含敏感关键字的变量
      const isSensitive = sensitivePatterns.some(pattern =>
        key.toUpperCase().includes(pattern)
      );
      if (isSensitive) continue;

      // 只允许白名单前缀的变量
      const isAllowed = YamlPreprocessor.SAFE_ENV_PREFIXES.some(prefix =>
        key.startsWith(prefix)
      );
      if (isAllowed || !key.startsWith('_')) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 构建变量上下文
   */
  private buildContext(context: Partial<VariableContext>): VariableContext {
    const filteredEnv = this.filterEnv(process.env);
    return {
      inputs: context.inputs || {},
      env: { ...filteredEnv, ...(context.env || {}) } as Record<string, string>,
      secrets: context.secrets || {},
      params: context.params || {},
    };
  }

  /**
   * 解析变量占位符
   */
  private resolveVariables(obj: any, context: VariableContext): any {
    if (typeof obj === 'string') {
      return this.replaceVariables(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveVariables(item, context));
    }

    if (obj && typeof obj === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveVariables(value, context);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * 替换变量占位符
   * 支持: ${inputs.xxx}, ${env.XXX}, ${secrets.XXX}, ${params.xxx}
   */
  private replaceVariables(str: string, context: VariableContext): string {
    return str.replace(/\$\{([^}]+)\}/g, (match, expr) => {
      const [prefix, ...rest] = expr.split('.');
      const key = rest.join('.');

      switch (prefix) {
        case 'inputs':
          return context.inputs[key] !== undefined ? String(context.inputs[key]) : match;
        case 'env':
          return context.env[key] !== undefined ? context.env[key] : match;
        case 'secrets':
          return context.secrets[key] !== undefined ? context.secrets[key] : match;
        case 'params':
          return context.params[key] !== undefined ? String(context.params[key]) : match;
        default:
          return match;
      }
    });
  }

  /**
   * ID 规范化
   */
  private normalizeId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown';
  }
}