/**
 * Pipeline YAML Agent - 从自然语言描述生成 Pipeline YAML
 *
 * 功能：
 * 1. 将自然语言描述转换为 Pipeline YAML 定义
 * 2. 使用 ToolAdapter 获取上下文（现有 Pipeline、工具列表等）
 * 3. 通过 AIGateway 调用 LLM 生成 YAML
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { BaseAgent } from '../base/BaseAgent';
import {
  AgentConfig,
  AgentExecutionContext,
} from '../base/types';
import { AIGateway } from '../../ai/AIGateway';
import { ToolAdapter } from '../base/ToolAdapter';
import { PipelineService } from '../../pipeline/PipelineService';
import { parsePipelineYaml } from '../../../models/Pipeline';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Pipeline YAML 生成选项
 */
export interface PipelineYamlGenerateOptions {
  /** Pipeline 名称 */
  name?: string;
  /** 描述 */
  description?: string;
  /** 触发类型 */
  triggerType?: 'git' | 'api' | 'event' | 'schedule';
  /** 是否包含测试阶段 */
  includeTests?: boolean;
  /** 是否包含部署阶段 */
  includeDeploy?: boolean;
  /** 运行环境 */
  environments?: string[];
  /** 自定义工具/动作 */
  customTools?: string[];
}

/**
 * Pipeline YAML 生成结果
 */
export interface PipelineYamlResult {
  /** 生成的 YAML */
  yaml: string;
  /** Pipeline 名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 包含的阶段 */
  stages: string[];
  /** 验证结果 */
  validation: {
    valid: boolean;
    errors: string[];
  };
  /** 建议的工具列表 */
  suggestedTools: string[];
}

/**
 * Pipeline YAML Agent
 *
 * 从自然语言描述生成 Pipeline YAML 配置
 */
export class PipelineYamlAgent extends BaseAgent {
  private pipelineService: PipelineService;

  /**
   * @param config Agent 配置
   * @param aiGateway AI Gateway 实例
   * @param toolAdapter 工具适配器
   * @param pipelineService Pipeline 服务（用于获取现有 Pipeline 上下文）
   */
  constructor(
    config: AgentConfig,
    aiGateway: AIGateway,
    toolAdapter: ToolAdapter,
    pipelineService: PipelineService
  ) {
    super(config, aiGateway, toolAdapter);
    this.pipelineService = pipelineService;
  }

  /**
   * 从自然语言描述生成 Pipeline YAML
   *
   * @param description 自然语言描述
   * @param context 执行上下文
   * @returns 生成的 Pipeline YAML
   */
  async generateFromDescription(
    description: string,
    context: AgentExecutionContext
  ): Promise<PipelineYamlResult> {
    return this.execute({ description }, context) as Promise<PipelineYamlResult>;
  }

  /**
   * 从选项生成 Pipeline YAML
   *
   * @param options 生成选项
   * @param context 执行上下文
   * @returns 生成的 Pipeline YAML
   */
  async generateFromOptions(
    options: PipelineYamlGenerateOptions,
    context: AgentExecutionContext
  ): Promise<PipelineYamlResult> {
    // 构建自然语言描述
    const description = this.buildDescriptionFromOptions(options);
    return this.generateFromDescription(description, context);
  }

  /**
   * 实现具体执行逻辑
   */
  protected async doExecute(
    input: { description: string },
    context: AgentExecutionContext
  ): Promise<PipelineYamlResult> {
    this.validateContext(context);

    const { description } = input;

    logger.info({
      msg: 'Generating Pipeline YAML from description',
      description: description.substring(0, 100),
      traceId: context.traceId,
    });

    // 1. 获取上下文信息（现有 Pipeline、可用工具等）
    const contextInfo = await this.gatherContext(context);

    // 2. 构建 Prompt
    const prompt = this.buildPrompt(description, contextInfo);

    // 3. 调用 AI 生成 YAML
    const generatedYaml = await this.callAI(prompt);

    // 4. 验证生成的 YAML
    const validation = this.validateYaml(generatedYaml);

    // 5. 提取阶段信息
    const stages = this.extractStages(generatedYaml);

    // 6. 建议工具
    const suggestedTools = this.suggestTools(stages);

    // 7. 提取 Pipeline 名称和描述
    const { name, description: desc } = this.extractMetadata(generatedYaml);

    return {
      yaml: generatedYaml,
      name,
      description: desc,
      stages,
      validation,
      suggestedTools,
    };
  }

  /**
   * 收集上下文信息
   */
  private async gatherContext(context: AgentExecutionContext): Promise<{
    existingPipelines: Array<{ id: string; name: string; description?: string }>;
    availableTools: string[];
  }> {
    // 获取现有 Pipeline 列表作为参考
    let existingPipelines: Array<{ id: string; name: string; description?: string }> = [];
    try {
      const pipelines = await this.pipelineService.list(context.tenantId);
      existingPipelines = pipelines.slice(0, 10).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || undefined,
      }));
    } catch (error) {
      logger.warn({
        msg: 'Failed to fetch existing pipelines',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 获取可用工具列表
    const availableTools = this.toolAdapter.getToolNames();

    return {
      existingPipelines,
      availableTools,
    };
  }

  /**
   * 构建 Prompt
   */
  private buildPrompt(
    description: string,
    contextInfo: {
      existingPipelines: Array<{ id: string; name: string; description?: string }>;
      availableTools: string[];
    }
  ): string {
    const { existingPipelines, availableTools } = contextInfo;

    // 构建参考 Pipeline 信息
    const pipelineExamples = existingPipelines.length > 0
      ? existingPipelines.map(p => `- ${p.name}: ${p.description || 'N/A'}`).join('\n')
      : '无';

    // 构建工具信息
    const toolsInfo = availableTools.join(', ');

    return `
# 任务：生成 Pipeline YAML 配置

## 用户需求描述
${description}

## 现有 Pipeline 参考
${pipelineExamples}

## 可用工具
${toolsInfo}

## 输出要求

请生成符合以下规范的 Pipeline YAML：

### YAML 结构
\`\`\`yaml
apiVersion: orion/v1
kind: Pipeline
metadata:
  name: <pipeline名称>
  description: <描述>
spec:
  triggers:
    - type: git  # 或 api, event, schedule
  stages:
    - name: <阶段名称>
      runsOn: <运行节点>
      steps:
        - name: <步骤名称>
          uses: <使用的动作>
          with:
            <参数>
\`\`\`

### 阶段类型建议
- **build**: 代码编译
- **test**: 单元测试/集成测试
- **security**: 安全扫描
- **build-image**: 构建镜像
- **deploy**: 部署到环境

### 常用动作 (uses)
- 构建: docker/build-push-action, gradle/gradle-build-action, maven/maven
- 测试: actions/checkout + npm test, gradle test
- 部署: kubectl, helm, argocd
- 安全: snyk, trivy, sonarqube-scan

### 注意事项
1. 使用正确的 YAML 语法
2. 确保阶段依赖关系正确（dependsOn）
3. 包含合理的超时设置
4. 添加必要的环境变量
5. 包含缓存配置以提高构建速度

请直接输出 YAML 内容，不要包含解释文字。
`.trim();
  }

  /**
   * 验证生成的 YAML
   */
  private validateYaml(yaml: string): { valid: boolean; errors: string[] } {
    try {
      const parsed = parsePipelineYaml(yaml);

      // 基本验证
      const errors: string[] = [];

      if (!parsed.spec?.stages || parsed.spec.stages.length === 0) {
        errors.push('Pipeline must have at least one stage');
      }

      for (const stage of parsed.spec?.stages || []) {
        if (!stage.name) {
          errors.push('Stage must have a name');
        }
        if (!stage.steps || stage.steps.length === 0) {
          errors.push(`Stage '${stage.name}' must have at least one step`);
        }
        for (const step of stage.steps || []) {
          if (!step.name) {
            errors.push(`Step in stage '${stage.name}' must have a name`);
          }
          if (!step.uses) {
            errors.push(`Step '${step.name}' must specify 'uses'`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Invalid YAML syntax'],
      };
    }
  }

  /**
   * 从 YAML 提取阶段信息
   */
  private extractStages(yaml: string): string[] {
    try {
      const parsed = parsePipelineYaml(yaml);
      return (parsed.spec?.stages || []).map(s => s.name);
    } catch {
      return [];
    }
  }

  /**
   * 建议工具
   */
  private suggestTools(stages: string[]): string[] {
    const tools = new Set<string>();

    for (const stage of stages) {
      const stageLower = stage.toLowerCase();
      if (stageLower.includes('build')) {
        tools.add('docker');
        tools.add('maven');
        tools.add('npm');
      }
      if (stageLower.includes('test')) {
        tools.add('testing');
        tools.add('coverage');
      }
      if (stageLower.includes('deploy')) {
        tools.add('deploy');
        tools.add('kubectl');
      }
      if (stageLower.includes('security') || stageLower.includes('scan')) {
        tools.add('security');
      }
    }

    return Array.from(tools);
  }

  /**
   * 提取元数据（名称和描述）
   */
  private extractMetadata(yaml: string): { name: string; description?: string } {
    try {
      const parsed = parsePipelineYaml(yaml);
      return {
        name: parsed.metadata?.name || 'unnamed-pipeline',
        description: parsed.metadata?.description,
      };
    } catch {
      return { name: 'unnamed-pipeline' };
    }
  }

  /**
   * 从选项构建描述
   */
  private buildDescriptionFromOptions(options: PipelineYamlGenerateOptions): string {
    const parts: string[] = [];

    if (options.name) {
      parts.push(`创建名为 "${options.name}" 的 Pipeline`);
    }

    if (options.description) {
      parts.push(options.description);
    }

    if (options.includeTests) {
      parts.push('包含测试阶段');
    }

    if (options.includeDeploy) {
      parts.push('包含部署阶段');
      if (options.environments && options.environments.length > 0) {
        parts.push(`部署环境包括: ${options.environments.join(', ')}`);
      }
    }

    if (options.customTools && options.customTools.length > 0) {
      parts.push(`使用工具: ${options.customTools.join(', ')}`);
    }

    return parts.join('。');
  }
}

/**
 * 创建默认的 Pipeline YAML Agent 配置
 */
export function createDefaultPipelineYamlAgentConfig(): AgentConfig {
  return {
    id: 'pipeline-yaml-agent',
    name: 'Pipeline YAML 生成 Agent',
    enabled: true,
    scenario: 'pipeline-yaml-generation',
    provider: 'sonnet',
    maxConcurrency: 5,
    timeoutMs: 30000,
    retry: {
      maxRetries: 2,
      backoffMs: 1000,
    },
    requiredTools: ['pipeline', 'git', 'log_query'],
    requiredPermissions: ['pipeline:read', 'pipeline:write'],
  };
}

export default PipelineYamlAgent;