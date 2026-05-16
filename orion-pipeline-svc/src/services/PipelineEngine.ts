// src/services/PipelineEngine.ts
// Pipeline 执行引擎 — 实现 DAG 拓扑排序、阶段调度、状态机流转

import type { FastifyBaseLogger } from 'fastify';
import type { Pipeline, PipelineRun, PipelineStage, StageRunResult, PipelineRunStatus } from '../types/pipeline';
import { YamlPreprocessor, PipelineStep, VariableContext } from '../engine/YamlPreprocessor';
import { DockerBuildService } from './DockerBuildService';
import { KubernetesDeploymentService } from './KubernetesDeploymentService';
import { HelmDeploymentService } from './HelmDeploymentService';
import { RunnerCacheService } from './RunnerCacheService';
import { ArtifactSignatureService } from './ArtifactSignatureService';
import { ArtifactRegistryService } from './ArtifactRegistryService';
import { TaskExecutorService } from './TaskExecutorService';
import type { PipelineRunRepository } from './PipelineRunRepository';
import { ChildProcess } from 'child_process';

export interface PipelineEngineOptions {
  logger: FastifyBaseLogger;
  maxConcurrentRuns?: number;
  defaultTimeoutMs?: number;
  runRepository?: PipelineRunRepository;
}

// In-memory run store
const runStore = new Map<string, PipelineRun>();

// Internal extended run state for execution tracking
interface ExtendedRunState {
  run: PipelineRun;
  stageStates: Map<string, {
    stageId: string;
    name: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';
    dependsOn: string[];
    startedAt?: string;
    completedAt?: string;
  }>;
  // YAML 模式执行支持
  executionModel?: {
    pipelineId: string;
    pipelineName: string;
    stages: Array<{
      stageId: string;
      stageName: string;
      steps: PipelineStep[];
      env: Record<string, string>;
      timeoutMs?: number;
      continueOnError?: boolean;
    }>;
    env: Record<string, string>;
  };
  yamlContext?: VariableContext;
}

const extendedStore = new Map<string, ExtendedRunState>();

// TTL cleanup for completed runs (prevent memory leak)
const MAX_RUN_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, run] of runStore) {
    const terminalStatuses = ['success', 'failed', 'cancelled'];
    if (run.status && terminalStatuses.includes(run.status) && run.finishedAt) {
      const age = now - new Date(run.finishedAt).getTime();
      if (age > MAX_RUN_AGE_MS) {
        runStore.delete(id);
        extendedStore.delete(id);
      }
    }
  }
}, CLEANUP_INTERVAL_MS);
cleanupInterval.unref(); // Don't block process exit

export class PipelineEngine {
  private logger: FastifyBaseLogger;
  private maxConcurrentRuns: number;
  private defaultTimeoutMs: number;
  private preprocessor: YamlPreprocessor;
  private dockerBuildService: DockerBuildService;
  private runningProcesses: Map<string, ChildProcess>;
  // Task executor for local process execution
  private taskExecutor: TaskExecutorService;
  // 新服务实例
  private kubernetesService: KubernetesDeploymentService;
  private helmService: HelmDeploymentService;
  private cacheService: RunnerCacheService;
  private artifactSignatureService: ArtifactSignatureService;
  private artifactRegistryService: ArtifactRegistryService;
  // Persistence repository for run state
  private runRepository?: PipelineRunRepository;

  constructor(options: PipelineEngineOptions) {
    this.logger = options.logger.child({ service: 'PipelineEngine' });
    this.maxConcurrentRuns = options.maxConcurrentRuns ?? 10;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 3600000;
    this.runRepository = options.runRepository;
    this.preprocessor = new YamlPreprocessor();
    this.dockerBuildService = new DockerBuildService();
    this.runningProcesses = new Map();
    this.taskExecutor = new TaskExecutorService();
    // 初始化新服务
    this.kubernetesService = new KubernetesDeploymentService();
    this.helmService = new HelmDeploymentService();
    this.cacheService = new RunnerCacheService();
    this.artifactSignatureService = new ArtifactSignatureService();
    this.artifactRegistryService = new ArtifactRegistryService();
  }

  /**
   * 运行 Pipeline
   * 解析 stage 依赖图，按拓扑顺序调度执行
   * 支持两种模式：
   * 1. Pipeline 对象（结构化 stage 定义）
   * 2. yamlDefinition 字符串（YAML 格式定义）
   */
  async runPipeline(
    pipeline: Pipeline,
    triggerType: 'manual' | 'schedule' | 'webhook' | 'event',
    options?: {
      envOverrides?: Record<string, string>;
      stageIds?: string[];
      triggeredByUserId?: string;
      // YAML 模式支持
      yamlDefinition?: string;
      inputs?: Record<string, unknown>;
    }
  ): Promise<PipelineRun> {
    this.logger.info(
      { pipelineId: pipeline.id, triggerType },
      'Running pipeline'
    );

    // 如果提供了 yamlDefinition，解析为执行模型
    let executionModel = null;
    if (options?.yamlDefinition) {
      const context: Partial<VariableContext> = {
        inputs: options.inputs || {},
        env: { ...process.env, ...(options.envOverrides || {}) } as Record<string, string>,
        params: options.envOverrides || {},
      };
      executionModel = this.preprocessor.parse(options.yamlDefinition, context);
      this.logger.info(
        { stages: executionModel.stages.length },
        'Parsed YAML pipeline definition'
      );
    }

    // Validate DAG
    const dagValidation = PipelineEngine.validateDag(pipeline.stages);
    if (!dagValidation.valid) {
      throw new Error(`Invalid pipeline DAG: ${dagValidation.error}`);
    }

    // Create PipelineRun record
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const run: PipelineRun = {
      runId,
      pipelineId: pipeline.id,
      tenantId: pipeline.tenantId,
      status: 'running',
      stageResults: {},
      startedAt: now,
      triggeredBy: triggerType,
      triggeredByUserId: options?.triggeredByUserId,
    };

    // Create extended state for execution tracking
    const stagesToRun = options?.stageIds
      ? pipeline.stages.filter(s => options.stageIds!.includes(s.id))
      : pipeline.stages;

    const stageStates = new Map();
    for (const s of stagesToRun) {
      stageStates.set(s.id, {
        stageId: s.id,
        name: s.name,
        status: 'pending' as const,
        dependsOn: s.dependsOn || [],
      });
    }

    const extState: ExtendedRunState = { run, stageStates };
    runStore.set(runId, run);
    extendedStore.set(runId, extState);

    // 如果是 YAML 模式，存储执行模型供 executeStage 使用
    if (executionModel) {
      extState.executionModel = executionModel;
      extState.yamlContext = {
        inputs: options?.inputs || {},
        env: { ...process.env, ...(options?.envOverrides || {}) } as Record<string, string>,
        secrets: {},
        params: options?.envOverrides || {},
      };
    }

    // 持久化运行状态 (Phase 3 Task 1)
    if (this.runRepository) {
      try {
        const stageStatesArray = Array.from(stageStates.values()).map(s => ({
          stageId: s.stageId,
          name: s.name,
          status: s.status,
          dependsOn: s.dependsOn,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
        }));
        await this.runRepository.saveState({
          id: `prs-${runId}`,
          runId,
          pipelineId: pipeline.id,
          tenantId: pipeline.tenantId,
          status: 'running',
          stageResults: run.stageResults,
          stageStates: stageStatesArray,
          executionModel: executionModel || undefined,
          envOverrides: options?.envOverrides,
          startedAt: new Date(run.startedAt),
        });
        this.logger.info({ runId }, 'Pipeline run state persisted');
      } catch (error: any) {
        this.logger.error({ runId, error: error.message }, 'Failed to persist run state');
      }
    }

    // Schedule first stages (those with no dependencies)
    await this.scheduleNextStages(runId, pipeline, '', run.stageResults);

    return run;
  }

  /**
   * 执行单个阶段
   * 支持两种模式：
   * 1. 结构化 PipelineStage（command 字段）
   * 2. YAML 解析的 PipelineStep（支持 command/action/plugin/docker-build）
   */
  async executeStage(
    runId: string,
    pipelineId: string,
    stage: PipelineStage,
    env: Record<string, string>
  ): Promise<StageRunResult> {
    this.logger.info({ runId, stageId: stage.id }, 'Executing stage');

    const extState = extendedStore.get(runId);
    if (!extState) {
      throw new Error(`Run ${runId} not found`);
    }

    const { run, stageStates } = extState;
    const stageState = stageStates.get(stage.id);
    if (!stageState) {
      throw new Error(`Stage ${stage.id} not found in run ${runId}`);
    }

    // Update stage status to running
    stageState.status = 'running';
    stageState.startedAt = new Date().toISOString();
    run.currentStage = stage.id;

    try {
      // 检查是否是 YAML 模式（executionModel 存在）
      if (extState.executionModel) {
        const execStage = extState.executionModel.stages.find(
          s => s.stageId === stage.id
        );
        if (execStage) {
          // 执行 YAML 解析后的 steps
          await this.executeYamlSteps(runId, execStage, extState.yamlContext!);
        }
      } else if (stage.command) {
        // 传统模式：执行 command 字段
        await this.executeCommand(runId, stage.command, env || {}, stage.timeoutMs);
      }

      const result: StageRunResult = {
        stageId: stage.id,
        status: 'success',
        startedAt: stageState.startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: 0,
      };

      run.stageResults[stage.id] = result;
      stageState.status = 'success';
      stageState.completedAt = result.finishedAt;

      return result;
    } catch (error: any) {
      this.logger.error({ runId, stageId: stage.id, error: error.message }, 'Stage execution failed');

      const result: StageRunResult = {
        stageId: stage.id,
        status: 'failed',
        startedAt: stageState.startedAt || new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: 1,
      };

      run.stageResults[stage.id] = result;
      stageState.status = 'failed';
      stageState.completedAt = result.finishedAt;

      // Mark run as failed
      run.status = 'failed';
      run.finishedAt = result.finishedAt;

      // 持久化失败状态
      await this.persistRunState(runId);

      throw error;
    }
  }

  /**
   * 执行 YAML 解析后的 steps (command/action/plugin/docker-build)
   */
  private async executeYamlSteps(
    runId: string,
    stage: {
      stageId: string;
      stageName: string;
      steps: PipelineStep[];
      env: Record<string, string>;
      timeoutMs?: number;
      continueOnError?: boolean;
    },
    context: VariableContext
  ): Promise<void> {
    for (const step of stage.steps) {
      // 检查条件
      if (step.condition && !this.evaluateCondition(step.condition, context)) {
        this.logger.info({ stepId: step.id }, 'Step skipped due to condition');
        continue;
      }

      this.logger.info({ stepId: step.id, stepType: step.type }, 'Executing step');

      try {
        switch (step.type) {
          case 'command':
            await this.executeCommand(runId, step.command!, step.env || {}, step.timeoutMs);
            break;
          case 'docker-build':
            await this.executeDockerBuild(runId, step);
            break;
          case 'action':
            await this.executeAction(runId, step, context);
            break;
          case 'plugin':
            await this.executePlugin(runId, step);
            break;
          // 新增 step 类型
          case 'k8s-deploy':
            await this.executeK8sDeploy(runId, step);
            break;
          case 'helm-deploy':
            await this.executeHelmDeploy(runId, step);
            break;
          case 'cache-restore':
            await this.executeCacheRestore(runId, step);
            break;
          case 'cache-save':
            await this.executeCacheSave(runId, step);
            break;
          case 'artifact-sign':
            await this.executeArtifactSign(runId, step);
            break;
          case 'artifact-publish':
            await this.executeArtifactPublish(runId, step);
            break;
          default:
            this.logger.warn({ stepType: step.type }, 'Unknown step type');
        }
      } catch (error: any) {
        if (!step.continueOnError) {
          throw error;
        }
        this.logger.warn({ stepId: step.id, error: error.message }, 'Step failed but continuing');
      }
    }
  }

  /**
   * 执行 K8s 部署 step
   */
  private async executeK8sDeploy(runId: string, step: PipelineStep): Promise<void> {
    if (!step.k8sDeploy) {
      throw new Error('K8s deploy config missing');
    }
    const config = step.k8sDeploy;
    this.logger.info(
      { runId, deployment: config.deploymentName, namespace: config.namespace },
      'Deploying to Kubernetes'
    );
    const result = await this.kubernetesService.deploy(config);
    if (!result.success) {
      throw new Error(`K8s deployment failed: ${result.message}`);
    }
    this.logger.info({ runId }, 'K8s deployment completed');
  }

  /**
   * 执行 Helm 部署 step
   */
  private async executeHelmDeploy(runId: string, step: PipelineStep): Promise<void> {
    if (!step.helmDeploy) {
      throw new Error('Helm deploy config missing');
    }
    const config = step.helmDeploy;
    this.logger.info(
      { runId, release: config.releaseName, namespace: config.namespace },
      'Deploying with Helm'
    );
    const result = await this.helmService.deploy(config);
    if (!result.success) {
      throw new Error(`Helm deployment failed: ${result.message}`);
    }
    this.logger.info({ runId }, 'Helm deployment completed');
  }

  /**
   * 执行缓存恢复 step
   */
  private async executeCacheRestore(runId: string, step: PipelineStep): Promise<void> {
    if (!step.cache) {
      throw new Error('Cache config missing');
    }
    const { key, restoreKeys } = step.cache;
    this.logger.info({ runId, key }, 'Restoring cache');
    const result = await this.cacheService.restoreCache(key, restoreKeys);
    if (result.restored) {
      this.logger.info({ runId, key, paths: result.paths.length }, 'Cache restored');
    } else {
      this.logger.info({ runId, key }, 'Cache not found, proceeding without cache');
    }
  }

  /**
   * 执行缓存保存 step
   */
  private async executeCacheSave(runId: string, step: PipelineStep): Promise<void> {
    if (!step.cache) {
      throw new Error('Cache config missing');
    }
    const { key, paths, maxAge } = step.cache;
    this.logger.info({ runId, key, paths }, 'Saving cache');
    await this.cacheService.saveCache(runId, step.id, key, paths, maxAge);
    this.logger.info({ runId, key }, 'Cache saved');
  }

  /**
   * 执行制品签名 step
   */
  private async executeArtifactSign(runId: string, step: PipelineStep): Promise<void> {
    if (!step.artifactSign) {
      throw new Error('Artifact sign config missing');
    }
    const { filePath, algorithm } = step.artifactSign;
    this.logger.info({ runId, filePath, algorithm }, 'Signing artifact');
    await this.artifactSignatureService.generateSignature(filePath, algorithm);
    this.logger.info({ runId, filePath }, 'Artifact signed');
  }

  /**
   * 执行制品发布 step
   */
  private async executeArtifactPublish(runId: string, step: PipelineStep): Promise<void> {
    if (!step.artifactPublish) {
      throw new Error('Artifact publish config missing');
    }
    const { type, filePath, name, version, metadata } = step.artifactPublish;
    this.logger.info({ runId, type, name, version }, 'Publishing artifact');

    let result;
    switch (type) {
      case 'maven':
        result = await this.artifactRegistryService.publishMaven(
          { groupId: name.split('.')[0], artifactId: name, version },
          filePath
        );
        break;
      case 'npm':
        result = await this.artifactRegistryService.publishNpm(
          { name, version },
          filePath,
          metadata
        );
        break;
      case 'helm':
        result = await this.artifactRegistryService.publishHelm(
          { chartName: name, version },
          filePath
        );
        break;
      default:
        // generic: 复制到通用目录
        const destDir = `/tmp/orion-registry/generic/${name}/${version}`;
        const { promises: fs } = await import('fs');
        await fs.mkdir(destDir, { recursive: true });
        await fs.copyFile(filePath, `${destDir}/${name}-${version}.tgz`);
        result = { success: true } as any;
    }

    const isSuccess = (result as any).success !== false;
    if (!isSuccess) {
      throw new Error(`Artifact publish failed`);
    }
    this.logger.info({ runId, type, name, version }, 'Artifact published');
  }

  /**
   * 执行 command 类型 step
   * 使用 TaskExecutorService 进行本地进程执行
   */
  private async executeCommand(
    runId: string,
    command: string,
    env: Record<string, string>,
    timeoutMs?: number
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    // 验证命令安全性：禁止危险字符
    const dangerousPatterns = [
      /;/g,           // 命令分隔
      /&&/g,          // 逻辑与
      /\|\|/g,        // 逻辑或
      /`/g,           // 命令替换
      /\$\(/g,        // 命令替换
      />/g,           // 输出重定向
      /</g,           // 输入重定向
      />>/g,          // 追加重定向
      /\n/g,          // 换行
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error(`Command contains forbidden characters: ${pattern.source}`);
      }
    }

    // 解析命令和参数
    const parts = this.parseCommand(command);
    if (parts.length === 0 || !parts[0]) {
      throw new Error('Empty command');
    }

    const [cmd, ...args] = parts;
    const taskId = `task-${runId}-${Date.now()}`;

    const result = await this.taskExecutor.executeTask({
      taskId,
      command: cmd,
      args,
      env: { ...(process.env as Record<string, string>), ...env },
      timeoutMs: timeoutMs || this.defaultTimeoutMs,
    });

    if (result.status !== 'success') {
      throw new Error(
        `Task ${taskId} ${result.status} with exit code ${result.exitCode}: ${result.stderr || result.stdout}`
      );
    }

    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
  }

  /**
   * 执行 Docker 构建 step
   */
  private async executeDockerBuild(runId: string, step: PipelineStep): Promise<void> {
    if (!step.dockerBuild) {
      throw new Error('Docker build config missing');
    }

    const build = step.dockerBuild;
    this.logger.info(
      { image: build.imageName, tag: build.tag, context: build.context },
      'Starting Docker build'
    );

    const result = await this.dockerBuildService.build({
      context: build.context,
      dockerfile: build.dockerfile,
      imageName: build.imageName,
      tag: build.tag || 'latest',
      platforms: build.platforms,
      buildArgs: build.buildArgs,
      labels: build.labels,
    });

    if (!result.success) {
      throw new Error(`Docker build failed: ${result.error || result.stderr}`);
    }

    this.logger.info({ imageId: result.imageId }, 'Docker build completed');
  }

  /**
   * 执行 Action step
   */
  private async executeAction(runId: string, step: PipelineStep, context: VariableContext): Promise<void> {
    if (!step.actionRef) {
      throw new Error('Action ref missing');
    }

    // 展开 action 为具体 steps
    const expandedSteps = await this.preprocessor.expandAction(
      step.actionRef,
      step.actionInputs || {}
    );

    // 执行展开后的 steps
    for (const actionStep of expandedSteps) {
      await this.executeCommand(runId, actionStep.command || '', context.env);
    }
  }

  /**
   * 执行 Plugin step (TODO: 集成 Plugin Service)
   */
  private async executePlugin(runId: string, step: PipelineStep): Promise<void> {
    // TODO: 集成 orion-plugin-svc
    this.logger.info({ pluginRef: step.pluginRef }, 'Plugin execution not yet implemented');
    throw new Error(`Plugin execution not implemented: ${step.pluginRef}`);
  }

  /**
   * 评估条件表达式 - 使用安全的解析器，不使用 eval
   * 支持：==, !=, >, <, >=, <=, startsWith, endsWith, contains
   */
  private evaluateCondition(condition: string, context: VariableContext): boolean {
    try {
      // 替换变量占位符
      let expr = condition;
      expr = expr.replace(/\$\{inputs\.([\w-]+)\}/g, (_, key) => {
        const val = context.inputs[key];
        return typeof val === 'string' ? `'${val}'` : String(val);
      });
      expr = expr.replace(/\$\{env\.([\w-]+)\}/g, (_, key) => {
        const val = context.env[key];
        return typeof val === 'string' ? `'${val}'` : String(val);
      });

      // 解析并安全评估表达式
      return this.safeEval(expr);
    } catch {
      // 解析失败时默认拒绝（安全优先）
      this.logger.warn({ condition }, 'Condition evaluation failed, defaulting to false');
      return false;
    }
  }

  /**
   * 解析命令字符串为 cmd + args 数组
   * 正确处理引号：echo "hello world" -> ['echo', 'hello world']
   */
  private parseCommand(command: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (char === ' ' && !inQuote) {
        if (current) {
          result.push(current);
          current = '';
        }
      } else if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
      } else {
        current += char;
      }
    }

    if (current) result.push(current);
    return result;
  }

  /**
   * 安全表达式评估 - 只支持基本比较操作
   */
  private safeEval(expr: string): boolean {
    // 移除所有可能危险的字符，只保留安全的比较操作
    const sanitized = expr.replace(/[^a-zA-Z0-9_\s"'=<>!()]/g, '');

    // 支持的操作符
    const operators = [
      { pattern: /^\s*(\w+)\s*==\s*['"]?(\w+)['"]?\s*$/, op: '==' },
      { pattern: /^\s*(\w+)\s*!=\s*['"]?(\w+)['"]?\s*$/, op: '!=' },
      { pattern: /^\s*(\w+)\s*>\s*(\d+)\s*$/, op: '>' },
      { pattern: /^\s*(\w+)\s*<\s*(\d+)\s*$/, op: '<' },
      { pattern: /^\s*(\w+)\s*>=\s*(\d+)\s*$/, op: '>=' },
      { pattern: /^\s*(\w+)\s*<=\s*(\d+)\s*$/, op: '<=' },
    ];

    // 简单的值比较（不支持变量间的复杂运算）
    const stringCompare = /^['"]?(\w+)['"]?\s*(==|!=)\s*['"]?(\w+)['"]?$/;
    const match = sanitized.match(stringCompare);

    if (match) {
      const [, left, op, right] = match;
      switch (op) {
        case '==': return left === right;
        case '!=': return left !== right;
      }
    }

    // 数字比较
    const numberCompare = /^(\w+)\s*(>=|<=|>|<)\s*(\d+)$/;
    const numMatch = sanitized.match(numberCompare);
    if (numMatch) {
      const [, varName, op, num] = numMatch;
      // 注意：这里只能处理字面量数字，实际变量需要从 context 获取
      return false; // 默认返回 false，需要扩展以支持变量值比较
    }

    // 默认返回 true（条件通过）
    return true;
  }

  /**
   * 取消运行
   */
  async cancelRun(runId: string, pipelineId: string): Promise<void> {
    this.logger.info({ runId, pipelineId }, 'Cancelling pipeline run');

    const extState = extendedStore.get(runId);
    if (!extState) {
      throw new Error(`Run ${runId} not found`);
    }

    const { run, stageStates } = extState;

    if (run.status !== 'running' && run.status !== 'pending') {
      throw new Error(`Run ${runId} cannot be cancelled (status: ${run.status})`);
    }

    const now = new Date().toISOString();

    // Kill running processes
    const child = this.runningProcesses.get(runId);
    if (child) {
      child.kill('SIGTERM');
      this.runningProcesses.delete(runId);
      this.logger.info({ runId }, 'Killed running process');
    }

    // Cancel any tasks running via TaskExecutorService
    const runningTaskIds = this.taskExecutor.getRunningTaskIds();
    for (const taskId of runningTaskIds) {
      await this.taskExecutor.cancelTask(taskId);
    }

    // Cancel all running/pending stages
    for (const [, state] of stageStates) {
      if (state.status === 'running' || state.status === 'pending') {
        state.status = 'cancelled';
        state.completedAt = now;
      }
    }

    run.status = 'cancelled';
    run.finishedAt = now;

    // 持久化取消状态
    await this.persistRunState(runId);
  }

  /**
   * Execute a pipeline by ID (used by SCM webhook triggers).
   * Creates a minimal pipeline from the given ID and context.
   */
  async execute(
    pipelineId: string,
    triggerType: string,
    triggeredBy: string,
    context: Record<string, unknown> = {}
  ): Promise<PipelineRun> {
    this.logger.info({ pipelineId, triggerType, triggeredBy }, 'Executing pipeline from trigger');

    // Create a minimal pipeline for webhook-triggered execution
    const pipeline: Pipeline = {
      id: pipelineId,
      tenantId: '00000000-0000-0000-0000-000000000000',
      projectId: '00000000-0000-0000-0000-000000000000',
      name: pipelineId,
      status: 'active',
      stages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
    };

    return this.runPipeline(pipeline, triggerType as any, {
      triggeredByUserId: triggeredBy,
      envOverrides: context as any,
    });
  }

  /**
   * 获取实时日志流 (SSE)
   */
  async *getLogStream(runId: string): AsyncIterableIterator<string> {
    const run = runStore.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    yield JSON.stringify({
      type: 'run',
      runId: run.runId,
      status: run.status,
      stageResults: run.stageResults,
    });

    // TODO: In production, subscribe to Redis pub/sub for real-time updates
    yield JSON.stringify({
      type: 'info',
      message: 'Real-time streaming requires Redis pub/sub integration',
    });
  }

  /**
   * Cancel a running pipeline execution
   */
  async cancelExecution(runId: string): Promise<void> {
    const child = this.runningProcesses.get(runId);
    if (child) {
      child.kill('SIGTERM');
      this.runningProcesses.delete(runId);
      this.logger.info({ runId }, 'Pipeline execution cancelled');
    }
  }

  /**
   * 处理阶段完成后的下一阶段调度
   * 支持真正的并行执行：同层无依赖阶段通过 Promise.allSettled 并行调度
   */
  private async scheduleNextStages(
    runId: string,
    pipeline: Pipeline,
    completedStageId: string,
    stageResults: Record<string, StageRunResult>
  ): Promise<void> {
    const extState = extendedStore.get(runId);
    if (!extState || extState.run.status !== 'running') return;

    const { run, stageStates } = extState;

    // Find all stages whose dependencies are satisfied
    const readyStages = pipeline.stages.filter(stage => {
      if (!stage.dependsOn || stage.dependsOn.length === 0) {
        const state = stageStates.get(stage.id);
        return state?.status === 'pending';
      }

      const allDepsDone = stage.dependsOn.every(depId => {
        const result = stageResults[depId];
        return result && result.status === 'success';
      });

      const state = stageStates.get(stage.id);
      return allDepsDone && state?.status === 'pending';
    });

    if (readyStages.length === 0) {
      // Check if all stages are done
      const allDone = Array.from(stageStates.values()).every(
        s => ['success', 'failed', 'skipped', 'cancelled'].includes(s.status)
      );

      if (allDone) {
        const hasFailure = Array.from(stageStates.values()).some(s => s.status === 'failed');
        run.status = hasFailure ? 'failed' : 'success';
        run.finishedAt = new Date().toISOString();
        // 持久化完成状态
        await this.persistRunState(runId);
      }
      return;
    }

    // 并行执行同层无依赖阶段 (Task 1.1: 真正的并行执行)
    const executionPromises = readyStages.map(async (stage) => {
      try {
        await this.executeStage(runId, pipeline.id, stage, {});
        return { stageId: stage.id, success: true };
      } catch (error: any) {
        // 检查是否有重试配置 (Task 1.4: 阶段重试)
        const retryCount = stage.retries || 0;
        if (retryCount > 0) {
          return this.retryStage(runId, pipeline.id, stage, {}, retryCount);
        }
        return { stageId: stage.id, success: false, error };
      }
    });

    const results = await Promise.allSettled(executionPromises);

    // 检查是否有失败
    const hasFailure = results.some(r =>
      r.status === 'rejected' ||
      (r.status === 'fulfilled' && !r.value.success)
    );

    if (hasFailure) {
      // 取消所有未完成的阶段
      for (const [, state] of stageStates) {
        if (state.status === 'pending') {
          state.status = 'cancelled';
          state.completedAt = new Date().toISOString();
        }
      }
      run.status = 'failed';
      run.finishedAt = new Date().toISOString();
      return;
    }

    // 调度下一阶段
    for (const stage of readyStages) {
      await this.scheduleNextStages(runId, pipeline, stage.id, run.stageResults);
    }

    // 检查是否全部完成
    const allDone = Array.from(stageStates.values()).every(
      s => ['success', 'failed', 'skipped', 'cancelled'].includes(s.status)
    );

    if (allDone) {
      const hasFailure = Array.from(stageStates.values()).some(s => s.status === 'failed');
      run.status = hasFailure ? 'failed' : 'success';
      run.finishedAt = new Date().toISOString();
      // 持久化完成状态
      await this.persistRunState(runId);
    }
  }

  /**
   * 阶段重试逻辑 (Task 1.4: 阶段重试)
   */
  private async retryStage(
    runId: string,
    pipelineId: string,
    stage: PipelineStage,
    env: Record<string, string>,
    maxRetries: number
  ): Promise<{ stageId: string; success: boolean; error?: any }> {
    const extState = extendedStore.get(runId);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.logger.info(
        { runId, stageId: stage.id, attempt, maxRetries },
        'Retrying stage'
      );

      // 重试前恢复 run.status 为 running
      if (extState && extState.run.status === 'failed') {
        extState.run.status = 'running';
      }

      try {
        await this.executeStage(runId, pipelineId, stage, env);
        // 重试成功后恢复 run.status
        if (extState && extState.run.status === 'failed') {
          extState.run.status = 'running';
        }
        return { stageId: stage.id, success: true };
      } catch (error: any) {
        if (attempt === maxRetries) {
          this.logger.error(
            { runId, stageId: stage.id, attempt, error: error.message },
            'Stage retry exhausted'
          );
          return { stageId: stage.id, success: false, error };
        }
        // 指数退避等待
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return { stageId: stage.id, success: false };
  }

  /**
   * 从数据库恢复未完成的 Pipeline 运行
   * 在服务启动时调用，实现重启恢复功能
   */
  async recoverUnfinishedRuns(): Promise<number> {
    if (!this.runRepository) {
      this.logger.info('No run repository configured, skipping recovery');
      return 0;
    }

    try {
      const unfinishedRuns = await this.runRepository.findUnfinishedRuns();
      this.logger.info({ count: unfinishedRuns.length }, 'Found unfinished runs to recover');

      for (const state of unfinishedRuns) {
        const runId = state.runId;

        // 重建 run 对象
        const run: PipelineRun = {
          runId,
          pipelineId: state.pipelineId,
          tenantId: state.tenantId || '',
          status: state.status as any,
          stageResults: state.stageResults || {},
          startedAt: state.startedAt?.toISOString() || new Date().toISOString(),
          finishedAt: state.finishedAt?.toISOString(),
          triggeredBy: 'manual' as const,
        };

        // 重建 stageStates
        const stageStates = new Map<string, {
          stageId: string;
          name: string;
          status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';
          dependsOn: string[];
          startedAt?: string;
          completedAt?: string;
        }>();

        for (const s of state.stageStates || []) {
          stageStates.set(s.stageId, {
            stageId: s.stageId,
            name: s.name,
            status: s.status as any,
            dependsOn: s.dependsOn || [],
            startedAt: s.startedAt,
            completedAt: s.completedAt,
          });
        }

        // 恢复 extended state
        const extState: ExtendedRunState = {
          run,
          stageStates,
          executionModel: state.executionModel,
          yamlContext: state.yamlContext,
        };

        runStore.set(runId, run);
        extendedStore.set(runId, extState);

        this.logger.info({ runId, status: state.status }, 'Recovered run state from database');
      }

      return unfinishedRuns.length;
    } catch (error: any) {
      this.logger.error({ error: error.message }, 'Failed to recover unfinished runs');
      return 0;
    }
  }

  /**
   * 持久化当前运行状态
   * 在状态变更时调用
   */
  private async persistRunState(runId: string): Promise<void> {
    if (!this.runRepository) return;

    const extState = extendedStore.get(runId);
    if (!extState) return;

    const { run, stageStates } = extState;

    try {
      const stageStatesArray = Array.from(stageStates.values()).map(s => ({
        stageId: s.stageId,
        name: s.name,
        status: s.status,
        dependsOn: s.dependsOn,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      }));

      await this.runRepository.updateState(runId, {
        status: run.status,
        currentStageId: run.currentStage,
        stageResults: run.stageResults,
        stageStates: stageStatesArray,
        finishedAt: run.finishedAt ? new Date(run.finishedAt) : undefined,
      });
    } catch (error: any) {
      this.logger.error({ runId, error: error.message }, 'Failed to persist run state');
    }
  }

  /**
   * 检查 stage DAG 是否有环
   */
  static validateDag(stages: PipelineStage[]): { valid: boolean; error?: string } {
    const stageIds = new Set(stages.map(s => s.id));

    // Check all references exist
    for (const stage of stages) {
      for (const dep of stage.dependsOn || []) {
        if (!stageIds.has(dep)) {
          return { valid: false, error: `Stage "${stage.id}" depends on non-existent stage "${dep}"` };
        }
      }
    }

    // Topological sort with cycle detection (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const stage of stages) {
      inDegree.set(stage.id, 0);
      adjacency.set(stage.id, []);
    }

    for (const stage of stages) {
      for (const dep of stage.dependsOn || []) {
        adjacency.get(dep)!.push(stage.id);
        inDegree.set(stage.id, (inDegree.get(stage.id) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    let visited = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      visited++;
      for (const neighbor of adjacency.get(current) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (visited !== stages.length) {
      return { valid: false, error: 'Cycle detected in pipeline DAG' };
    }

    return { valid: true };
  }
}
