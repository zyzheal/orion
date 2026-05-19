# AI Agent 增强 DevOps 六大模块设计方案

**日期**: 2026-05-19
**状态**: Draft
**作者**: Agent Expert

---

## 一、设计概述

### 1.1 背景

Orion 平台已具备 AI 基础能力：
- **AI Gateway**：多 Provider 管理、场景路由、熔断降级
- **AIGateway**：统一 LLM 调用出口（已有）
- **ToolAdapter**：AI → 业务服务适配层（需新增，替代 ToolRegistry）
- **AIGateway**：统一 LLM 调用出口
- **DiagnosticEngine**：决策树+知识库诊断
- **ErrorClassifier**：流水线错误分类

**核心问题**：AI 能力与 DevOps 六大模块（流水线、稳定性、性能优化、发布分发、效能工具、运维监控）**未深度集成**，AI 处于"有无魂"状态。

### 1.2 目标

将现有 AI Agent 能力注入六大模块，实现 **"让现有工具链变聪明"** 的平台主张。

### 1.3 设计原则

| 原则 | 说明 |
|------|------|
| **复用现有 AI 基建** | 全部通过 AI Gateway 调用 LLM，不新增独立 LLM 路径 |
| **Agent 驱动** | 每个增强点由特定 Agent 负责，Agent 间可协作 |
| **工具优先** | Agent 通过 ToolAdapter 调用现有服务，不重复实现业务逻辑 |
| **渐进式接入** | 按 P0→P1→P2 优先级逐步集成，不影响现有功能 |

---

## 二、架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AI Agent 增强架构                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    DevOps 六大模块（现有业务）                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────┐ │   │
│  │  │ 流水线   │ │ 稳定性   │ │ 性能优化 │ │ 发布分发 │ │ 效能   │ │运维│ │   │
│  │  │ Pipeline │ │ Stability│ │ Perf Opt │ │ Release  │ │ Efficiency│ │Ops│ │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ └─┬──┘ │   │
│  │       │            │            │            │            │        │      │   │
│  └───────┼────────────┼────────────┼────────────┼────────────┼────────┼──────┘   │
│          │            │            │            │            │        │          │
│          ▼            ▼            ▼            ▼            ▼        ▼          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    Agent 层（新增）                                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────┐ │   │
│  │  │Pipeline  │ │RootCause │ │PerfOpt   │ │Release   │ │Knowledge│ │Alert │ │   │
│  │  │YAML Agent│ │Agent     │ │Agent     │ │Agent     │ │Agent    │ │Agent │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ └────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    AI Gateway（已有）                                    │   │
│  │  Provider Registry → Scenario Router → PromptGuard → CircuitBreaker    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    Tool Registry（已有）                                 │   │
│  │  deploy │ monitoring │ pipeline │ vector_search │ log_query │ git       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    业务服务层（已有）                                      │   │
│  │  PipelineService │ BuildService │ AlertService │ DeployService │ ...      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Agent 目录结构

```
orion-platform-service/src/services/ai-agents/
├── index.ts                          # Agent 注册中心
├── base/
│   ├── BaseAgent.ts                  # Agent 基类
│   ├── AgentContext.ts               # Agent 上下文
│   └── ToolAdapter.ts                # 工具适配器
├── pipeline/
│   ├── PipelineYamlAgent.ts          # 自然语言→YAML Agent
│   └── prompts/pipeline-yaml.ts      # Prompt 模板
├── stability/
│   ├── RootCauseAgent.ts             # 根因分析 Agent
│   ├── AutoFixAgent.ts               # 自动修复 Agent
│   └── prompts/root-cause.ts         # Prompt 模板
├── performance/
│   ├── PerfOptAgent.ts               # 性能优化 Agent
│   └── prompts/perf-opt.ts           # Prompt 模板
├── release/
│   ├── ReleaseDiffAgent.ts           # 版本差异分析 Agent
│   ├── ReleaseNotesAgent.ts          # 发布说明 Agent
│   └── prompts/release.ts            # Prompt 模板
├── knowledge/
│   ├── RAGKnowledgeAgent.ts          # RAG 知识库 Agent
│   ├── WeComBotAdapter.ts            # 企微机器人适配器
│   └── prompts/knowledge.ts          # Prompt 模板
└── monitoring/
    ├── AlertClassifyAgent.ts         # 告警归类 Agent
    ├── AlertMergeAgent.ts            # 告警合并 Agent
    └── prompts/monitoring.ts         # Prompt 模板
```

---

## 三、六大模块 Agent 详细设计

### 3.1 模块1：流水线 — PipelineYamlAgent

**能力**：自然语言需求 → 蓝盾 YAML 配置

**工作流**：
```
用户输入: "创建一个 Android 构建流水线，包含代码检查、编译、单元测试、上传 APK"
    │
    ▼
PipelineYamlAgent.process(nlRequest)
    │
    ├── 1. 意图识别 (AI Gateway → haiku)
    │      → 识别: pipeline_create, platform=android
    │
    ├── 2. 参数提取 (AI Gateway → haiku)
    │      → stages: [code_check, build, test, upload_apk]
    │
    ├── 3. YAML 生成 (AI Gateway → sonnet)
    │      → 生成标准 YAML 配置
    │
    └── 4. 语法验证 (本地验证器)
           → 返回 YAML + 可视化预览
```

**代码实现**：
```typescript
// orion-platform-service/src/services/ai-agents/pipeline/PipelineYamlAgent.ts

import { BaseAgent } from '../base/BaseAgent';
import { AgentContext } from '../base/AgentContext';
import { AIGateway } from '../../ai/AIGateway';

export interface PipelineYamlRequest {
  naturalLanguage: string;    // 自然语言需求
  template?: string;          // 可选：基于的模板
  platform?: 'android' | 'ios' | 'pc' | 'web';
}

export interface PipelineYamlResponse {
  yaml: string;               // 生成的 YAML
  stages: PipelineStage[];    // 结构化阶段列表
  validationErrors: string[]; // 验证错误
  suggestions: string[];      // 优化建议
}

export class PipelineYamlAgent extends BaseAgent {
  constructor(
    private aiGateway: AIGateway,
    private pipelineService: PipelineService
  ) {
    super('pipeline-yaml', {
      scenario: 'pipeline_yaml_generation',  // 场景路由标识
      provider: 'sonnet',                     // 默认使用 sonnet（代码能力强）
    });
  }

  async process(req: PipelineYamlRequest): Promise<PipelineYamlResponse> {
    // 1. 构建 Prompt
    const prompt = this.buildPrompt(req);

    // 2. 调用 AI Gateway（通过场景路由自动选择模型）
    const result = await this.aiGateway.chat({
      scenario: 'pipeline_yaml_generation',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,  // 低温度，确保 YAML 格式稳定
    });

    // 3. 解析 YAML
    const yaml = this.extractYaml(result.content);

    // 4. 语法验证
    const validation = this.pipelineService.validateYaml(yaml);

    return {
      yaml,
      stages: this.parseStages(yaml),
      validationErrors: validation.errors,
      suggestions: validation.warnings,
    };
  }

  private buildPrompt(req: PipelineYamlRequest): string {
    const templates = this.pipelineService.getTemplates(req.platform);
    return `你是一个 DevOps 流水线专家。根据用户需求，生成蓝盾 YAML 配置。

可用模板：
${templates.map(t => `- ${t.name}: ${t.description}`).join('\n')}

用户需求：${req.naturalLanguage}

要求：
1. 输出标准 YAML 格式
2. 使用平台内置 Stage 和 Task
3. 包含必要的参数配置
4. 添加注释说明每个阶段的作用

只输出 YAML 内容，不要额外解释。`;
  }

  private extractYaml(content: string): string {
    // 提取 ```yaml 代码块或纯 YAML
    const match = content.match(/```yaml\n([\s\S]*?)\n```/);
    return match ? match[1] : content;
  }
}
```

**API 接口**：
```typescript
// POST /api/v1/pipelines/generate-from-nl
{
  "naturalLanguage": "创建 Android 构建流水线...",
  "platform": "android"
}

// Response
{
  "yaml": "version: '1.0'\nstages:\n  - name: code_check...",
  "stages": [...],
  "validationErrors": [],
  "suggestions": ["建议添加缓存配置以加速构建"]
}
```

---

### 3.2 模块2：稳定性 — RootCauseAgent + AutoFixAgent

#### 3.2.1 RootCauseAgent（根因分析 Agent）

**能力**：自动定位"哪次提交导致构建失败"

**工作流**：
```
流水线失败
    │
    ▼
RootCauseAgent.analyze(runId)
    │
    ├── 1. 收集上下文 (Tool: log_query + git)
    │      → 错误日志 + 最近 Git 提交 + 历史相似 Case
    │
    ├── 2. 根因分析 (AI Gateway → opus)
    │      → 分析: 哪次提交、什么改动、为什么导致失败
    │
    ├── 3. 输出诊断报告
    │      → 根因 + 置信度 + 证据链 + 修复建议
    │
    └── 4. 推送诊断结果 (Tool: notification)
           → 通知责任人
```

**代码实现**：
```typescript
// orion-platform-service/src/services/ai-agents/stability/RootCauseAgent.ts

import { BaseAgent } from '../base/BaseAgent';
import { AIGateway } from '../../ai/AIGateway';
import { PipelineRunService } from '../../pipeline/PipelineRunService';
import { GitService } from '../../code-repo/GitService';

export interface RootCauseAnalysisResult {
  rootCause: string;          // 根因描述
  confidence: number;         // 置信度 0-1
  culpritCommit?: {           // 导致问题的提交
    hash: string;
    author: string;
    message: string;
    changedFiles: string[];
  };
  evidence: string[];         // 证据链
  fixSuggestion: string;      // 修复建议
  similarCases: SimilarCase[]; // 历史相似 Case
}

export class RootCauseAgent extends BaseAgent {
  constructor(
    private aiGateway: AIGateway,
    private pipelineRunService: PipelineRunService,
    private gitService: GitService,
    private errorClassifier: ErrorClassifier
  ) {
    super('root-cause', {
      scenario: 'root_cause_analysis',
      provider: 'opus',  // 强推理能力
    });
  }

  async analyze(runId: string): Promise<RootCauseAnalysisResult> {
    // 1. 获取失败运行的日志
    const runLogs = await this.pipelineRunService.getRunLogs(runId);

    // 2. 获取错误分类结果
    const errorClassification = await this.errorClassifier.classify(runLogs);

    // 3. 获取最近的 Git 提交
    const run = await this.pipelineRunService.getRun(runId);
    const recentCommits = await this.gitService.getRecentCommits(
      run.repositoryId,
      run.branch,
      limit: 10
    );

    // 4. 获取历史相似 Case
    const similarCases = await this.pipelineRunService.findSimilarFailures(
      errorClassification.type,
      run.pipelineId,
      limit: 5
    );

    // 5. 构建分析 Prompt
    const prompt = this.buildAnalysisPrompt(
      runLogs,
      errorClassification,
      recentCommits,
      similarCases
    );

    // 6. 调用 AI 分析
    const result = await this.aiGateway.chat({
      scenario: 'root_cause_analysis',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,  // 极低温度，确保分析一致性
    });

    // 7. 解析分析结果
    return this.parseAnalysisResult(result.content, recentCommits);
  }

  private buildAnalysisPrompt(
    logs: string[],
    errorClass: ErrorClassification,
    commits: Commit[],
    similarCases: SimilarCase[]
  ): string {
    return `你是一个 DevOps 根因分析专家。请分析以下流水线失败的原因：

错误类型：${errorClass.type}
错误摘要：${errorClass.summary}

关键日志片段：
${logs.slice(-50).join('\n')}

最近的 Git 提交：
${commits.map(c => `- ${c.hash.substring(0, 8)} ${c.message} (${c.author})`).join('\n')}

历史相似 Case：
${similarCases.map(c => `- Case ${c.runId}: ${c.rootCause} → ${c.fix}`).join('\n')}

请输出：
1. 最可能导致此问题的提交（hash + 原因）
2. 具体的根因分析
3. 修复建议
4. 置信度评分（0-1）

以 JSON 格式输出。`;
  }
}
```

#### 3.2.2 AutoFixAgent（自动修复 Agent）

**能力**：AI 自动修复常见构建错误

**工作流**：
```
RootCauseAgent 完成诊断
    │
    ▼
AutoFixAgent.fix(rootCause, runId)
    │
    ├── 1. 匹配修复模板
    │      → 已知错误类型 → 预置修复方案
    │
    ├── 2. 生成修复代码 (AI Gateway → sonnet)
    │      → 代码修复 / 配置修改 / 依赖更新
    │
    ├── 3. 本地验证 (沙箱执行)
    │      → 验证修复是否有效
    │
    ├── 4. 提交修复 (Tool: git)
    │      → 创建修复分支 + 提交
    │
    └── 5. 触发验证流水线
           → 自动运行验证
```

**代码实现**：
```typescript
// orion-platform-service/src/services/ai-agents/stability/AutoFixAgent.ts

import { BaseAgent } from '../base/BaseAgent';
import { AIGateway } from '../../ai/AIGateway';
import { AgentSandbox } from '../../ai/AgentSandbox';

export interface AutoFixRequest {
  runId: string;
  rootCause: string;
  culpritCommit?: string;
}

export interface AutoFixResult {
  fixApplied: boolean;
  fixType: 'code' | 'config' | 'dependency' | 'environment';
  fixDescription: string;
  fixBranch?: string;
  fixCommit?: string;
  verificationResult?: 'passed' | 'failed' | 'skipped';
  confidence: number;
}

export class AutoFixAgent extends BaseAgent {
  constructor(
    private aiGateway: AIGateway,
    private sandbox: AgentSandbox,
    private gitService: GitService,
    private pipelineService: PipelineService
  ) {
    super('auto-fix', {
      scenario: 'auto_fix_generation',
      provider: 'sonnet',
    });
  }

  async fix(req: AutoFixRequest): Promise<AutoFixResult> {
    // 1. 获取错误详情
    const runLogs = await this.pipelineRunService.getRunLogs(req.runId);

    // 2. 尝试匹配已知修复模板（快速路径）
    const knownFix = this.matchKnownFix(req.rootCause, runLogs);
    if (knownFix) {
      return await this.applyFix(knownFix, req);
    }

    // 3. AI 生成修复方案
    const fixPrompt = this.buildFixPrompt(req.rootCause, runLogs);
    const fixResult = await this.aiGateway.chat({
      scenario: 'auto_fix_generation',
      messages: [{ role: 'user', content: fixPrompt }],
      temperature: 0.1,
    });

    // 4. 解析修复方案
    const fix = this.parseFixFixResult(fixResult.content);

    // 5. 沙箱验证
    if (fix.requiresVerification) {
      const verifyResult = await this.sandbox.execute(
        fix.verificationCommand,
        { timeout: 300_000 }
      );
      if (!verifyResult.success) {
        return {
          fixApplied: false,
          fixType: fix.type,
          fixDescription: '修复验证失败',
          confidence: 0.3,
        };
      }
    }

    // 6. 应用修复（创建修复分支 + 提交）
    return await this.applyFix(fix, req);
  }
}
```

---

### 3.3 模块3：性能优化 — PerfOptAgent

**能力**：自动识别瓶颈步骤、慢机器、未命中缓存，产出优化清单

**工作流**：
```
PipelineMetricsService 采集数据
    │
    ▼
PerfOptAgent.analyze(pipelineId, timeRange)
    │
    ├── 1. 采集性能数据 (Tool: monitoring + pipeline)
    │      → 各阶段耗时 + 缓存命中率 + 机器负载
    │
    ├── 2. 瓶颈识别 (AI Gateway → haiku)
    │      → 识别最慢步骤 + 异常耗时
    │
    ├── 3. 根因分析 (AI Gateway → sonnet)
    │      → 分析为什么慢
    │
    ├── 4. 生成优化清单
    │      → 具体优化项 + 预期收益
    │
    └── 5. 定期产出报告 (定时触发)
           → 推送给相关人
```

**代码实现**：
```typescript
// orion-platform-service/src/services/ai-agents/performance/PerfOptAgent.ts

import { BaseAgent } from '../base/BaseAgent';
import { AIGateway } from '../../ai/AIGateway';
import { PipelineMetricsService } from '../../pipeline/PipelineMetricsService';
import { CacheMonitorService } from '../../cache-monitor/CacheMonitorService';

export interface PerfOptAnalysisResult {
  summary: {
    avgDuration: number;         // 平均耗时（秒）
    trend: 'improving' | 'stable' | 'degrading';
    degradationPercent: number;  // 劣化百分比
  };
  bottlenecks: Array<{
    stage: string;
    avgDuration: number;
    maxDuration: number;
    percentOfTotal: number;
    issue: string;               // 问题描述
    severity: 'high' | 'medium' | 'low';
  }>;
  cacheIssues: Array<{
    cacheKey: string;
    hitRate: number;             // 缓存命中率
    missCount: number;
    suggestion: string;
  }>;
  recommendations: Array<{
    type: 'parallel' | 'cache' | 'resource' | 'dependency' | 'config';
    description: string;
    expectedSaving: string;      // 预期节省时间
    effort: 'low' | 'medium' | 'high';
    action: string;              // 具体操作
  }>;
}

export class PerfOptAgent extends BaseAgent {
  constructor(
    private aiGateway: AIGateway,
    private metricsService: PipelineMetricsService,
    private cacheMonitor: CacheMonitorService
  ) {
    super('perf-opt', {
      scenario: 'performance_optimization',
      provider: 'sonnet',
    });
  }

  async analyze(
    pipelineId: string,
    timeRange: { start: string; end: string }
  ): Promise<PerfOptAnalysisResult> {
    // 1. 采集数据
    const metrics = await this.metricsService.getPipelineMetrics(
      pipelineId,
      timeRange
    );
    const cacheStats = await this.cacheMonitor.getCacheStats(pipelineId);

    // 2. 分析耗时瓶颈
    const stageDurations = metrics.stageMetrics.map(s => ({
      stage: s.name,
      avgDuration: s.avgDuration,
      maxDuration: s.maxDuration,
      percentOfTotal: (s.avgDuration / metrics.totalAvgDuration) * 100,
    }));

    // 3. AI 分析
    const prompt = this.buildAnalysisPrompt(
      stageDurations,
      cacheStats,
      metrics.trends
    );

    const result = await this.aiGateway.chat({
      scenario: 'performance_optimization',
      messages: [{ role: 'user', content: prompt }],
    });

    return this.parseAnalysisResult(result.content);
  }
}
```

---

### 3.4 模块4：发布分发 — ReleaseDiffAgent + ReleaseNotesAgent

#### 3.4.1 ReleaseDiffAgent（版本差异分析 Agent）

**能力**：异常包自动比对前后版本差异

```typescript
// orion-platform-service/src/services/ai-agents/release/ReleaseDiffAgent.ts

import { BaseAgent } from '../base/BaseAgent';
import { AIGateway } from '../../ai/AIGateway';
import { ArtifactService } from '../../build/ArtifactService';
import { GitService } from '../../code-repo/GitService';

export interface ReleaseDiffResult {
  versionFrom: string;
  versionTo: string;
  codeChanges: Array<{
    file: string;
    changeType: 'added' | 'modified' | 'deleted';
    linesChanged: number;
    riskLevel: 'high' | 'medium' | 'low';
    description: string;
  }>;
  dependencyChanges: Array<{
    name: string;
    versionFrom: string;
    versionTo: string;
    breaking: boolean;
  }>;
  riskAssessment: {
    overallRisk: 'high' | 'medium' | 'low';
    riskyChanges: string[];
    summary: string;
  };
}

export class ReleaseDiffAgent extends BaseAgent {
  constructor(
    private aiGateway: AIGateway,
    private artifactService: ArtifactService,
    private gitService: GitService
  ) {
    super('release-diff', {
      scenario: 'release_diff_analysis',
      provider: 'sonnet',
    });
  }

  async diff(
    artifactId: string,
    versionFrom: string,
    versionTo: string
  ): Promise<ReleaseDiffResult> {
    // 1. 获取两个版本的 Git 差异
    const commits = await this.gitService.getCommitsBetween(
      artifactId,
      versionFrom,
      versionTo
    );

    // 2. 获取依赖变更
    const depDiff = await this.artifactService.getDependencyDiff(
      artifactId,
      versionFrom,
      versionTo
    );

    // 3. AI 风险评估
    const prompt = this.buildRiskPrompt(commits, depDiff);
    const result = await this.aiGateway.chat({
      scenario: 'release_diff_analysis',
      messages: [{ role: 'user', content: prompt }],
    });

    return this.parseDiffResult(result.content);
  }
}
```

#### 3.4.2 ReleaseNotesAgent（发布说明 Agent）

**能力**：自动生成发布说明

```typescript
// orion-platform-service/src/services/ai-agents/release/ReleaseNotesAgent.ts

export class ReleaseNotesAgent extends BaseAgent {
  async generate(artifactId: string, version: string): Promise<string> {
    // 1. 收集变更
    const commits = await this.gitService.getCommitsSinceTag(
      artifactId,
      version
    );

    // 2. AI 生成发布说明
    const prompt = this.buildReleaseNotesPrompt(commits);
    const result = await this.aiGateway.chat({
      scenario: 'release_notes_generation',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    return result.content;
  }
}
```

---

### 3.5 模块5：效能工具 — RAGKnowledgeAgent + WeComBotAdapter

**能力**：Wiki+TAPD+代码规范+故障复盘 → RAG 知识库 → 企微机器人问答

**工作流**：
```
用户提问（企微机器人）
    │
    ▼
RAGKnowledgeAgent.answer(question)
    │
    ├── 1. 意图识别 (AI Gateway → haiku)
    │      → 判断问题类型：规范/流程/故障/新人引导
    │
    ├── 2. 向量检索 (Tool: vector_search)
    │      → 检索知识库相关文档
    │
    ├── 3. RAG 生成答案 (AI Gateway → sonnet)
    │      → 结合检索结果生成答案
    │
    └── 4. 推送答案 (Tool: notification → WeCom)
           → 企微群内回复
```

**代码实现**：
```typescript
// orion-platform-service/src/services/ai-agents/knowledge/RAGKnowledgeAgent.ts

import { BaseAgent } from '../base/BaseAgent';
import { AIGateway } from '../../ai/AIGateway';
import { VectorStore } from '../../ai/VectorStore';

export interface KnowledgeAnswer {
  answer: string;
  sources: Array<{
    title: string;
    url?: string;
    relevance: number;
  }>;
  confidence: number;
}

export class RAGKnowledgeAgent extends BaseAgent {
  constructor(
    private aiGateway: AIGateway,
    private vectorStore: VectorStore,
    private knowledgeService: KnowledgeService
  ) {
    super('rag-knowledge', {
      scenario: 'knowledge_qa',
      provider: 'sonnet',
    });
  }

  async answer(question: string): Promise<KnowledgeAnswer> {
    // 1. 意图识别
    const intent = await this.aiGateway.chat({
      scenario: 'knowledge_intent_recognition',
      messages: [{
        role: 'user',
        content: `判断以下问题类型：${question}\n返回：[规范|流程|故障|新人引导|其他]`,
      }],
    });

    // 2. 向量检索
    const embeddings = await this.aiGateway.embed(question);
    const searchResults = await this.vectorStore.search(embeddings, {
      topK: 5,
      threshold: 0.7,
    });

    // 3. RAG 生成答案
    const context = searchResults.map(r =>
      `【${r.metadata.title}】\n${r.content}`
    ).join('\n\n');

    const prompt = `你是一个 DevOps 专家。基于以下知识库内容回答问题。

知识库内容：
${context}

问题：${question}

要求：
1. 基于知识库内容回答，不要编造
2. 如果知识库中没有相关信息，明确告知用户
3. 引用相关文档来源
4. 回答简洁明了`;

    const result = await this.aiGateway.chat({
      scenario: 'knowledge_qa',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    return {
      answer: result.content,
      sources: searchResults.map(r => ({
        title: r.metadata.title,
        url: r.metadata.url,
        relevance: r.score,
      })),
      confidence: Math.max(...searchResults.map(r => r.score), 0),
    };
  }
}
```

**企微机器人接入**：
```typescript
// orion-platform-service/src/services/ai-agents/knowledge/WeComBotAdapter.ts

import express from 'express';

export class WeComBotAdapter {
  private router: RAGKnowledgeAgent;

  constructor(
    private app: express.Application,
    private knowledgeAgent: RAGKnowledgeAgent,
    private wecomClient: WeComClient
  ) {
    this.router = router;
  }

  // 注册企微 Webhook
  registerWebhook(path: string = '/webhook/wecom-knowledge'): void {
    this.app.post(path, async (req, res) => {
      const { msgtype, text, fromuser } = req.body;

      if (msgtype === 'text' && text) {
        // 异步处理（先回复接收成功）
        res.json({ errcode: 0 });

        // 调用知识库
        const answer = await this.knowledgeAgent.answer(text.content);

        // 推送答案到企微
        await this.wecomClient.sendMessage(fromuser, {
          msgtype: 'text',
          text: { content: answer.answer },
        });
      } else {
        res.json({ errcode: 0 });
      }
    });
  }
}
```

---

### 3.6 模块6：运维监控 — AlertClassifyAgent + AlertMergeAgent

#### 3.6.1 AlertClassifyAgent（告警归类 Agent）

**能力**：告警自动归类 + 生成排查建议

```typescript
// orion-platform-service/src/services/ai-agents/monitoring/AlertClassifyAgent.ts

import { BaseAgent } from '../base/BaseAgent';
import { AIGateway } from '../../ai/AIGateway';
import { AlertDeduplication } from '../../alert/AlertDeduplication';

export interface AlertClassification {
  category: 'infrastructure' | 'application' | 'network' | 'security' | 'config';
  subcategory: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  troubleshooting: string[];    // 排查建议
  relatedAlerts?: string[];     // 关联告警
  confidence: number;
}

export class AlertClassifyAgent extends BaseAgent {
  constructor(
    private aiGateway: AIGateway,
    private alertService: AlertService
  ) {
    super('alert-classify', {
      scenario: 'alert_classification',
      provider: 'sonnet',
    });
  }

  async classify(alert: Alert): Promise<AlertClassification> {
    const prompt = `你是一个 SRE 专家。请对以下告警进行分类并提供排查建议：

告警名称：${alert.name}
告警内容：${alert.message}
告警标签：${JSON.stringify(alert.labels)}
当前指标值：${alert.currentValue}
阈值：${alert.threshold}

请输出：
1. 告警分类（infrastructure/application/network/security/config）
2. 子分类
3. 严重程度
4. 排查建议（3-5 条具体步骤）
5. 可能关联的其他告警`;

    const result = await this.aiGateway.chat({
      scenario: 'alert_classification',
      messages: [{ role: 'user', content: prompt }],
    });

    return this.parseClassification(result.content);
  }
}
```

#### 3.6.2 AlertMergeAgent（告警合并 Agent）

**能力**：相似 Case 合并

```typescript
// orion-platform-service/src/services/ai-agents/monitoring/AlertMergeAgent.ts

export class AlertMergeAgent extends BaseAgent {
  async merge(alerts: Alert[]): Promise<AlertGroup[]> {
    // 1. 基于 AlertDeduplication 的指纹预分组
    const preGroups = this.alertDeduplication.groupByFingerprint(alerts);

    // 2. AI 判断是否需要进一步合并
    const mergeResults: AlertGroup[] = [];

    for (const group of preGroups) {
      const shouldMerge = await this.shouldMergeGroup(group);
      if (shouldMerge) {
        const mergedAlert = this.mergeAlerts(group);
        mergeResults.push(mergedAlert);
      } else {
        mergeResults.push(...group);
      }
    }

    return mergeResults;
  }

  private async shouldMergeGroup(alerts: Alert[]): Promise<boolean> {
    if (alerts.length < 2) return false;

    const prompt = `以下告警是否应该合并为一个根因事件？

${alerts.map(a => `- [${a.severity}] ${a.name}: ${a.message}`).join('\n')}

判断标准：
- 是否由同一个根因引起
- 是否有因果关系（如 CPU 高 → 响应慢 → 超时）

只返回 true 或 false。`;

    const result = await this.aiGateway.chat({
      scenario: 'alert_merge',
      messages: [{ role: 'user', content: prompt }],
    });

    return result.content.trim().toLowerCase() === 'true';
  }
}
```

---

## 四、场景路由配置

### 4.1 AI Gateway 场景路由表

新增场景路由配置，确保不同 Agent 使用最优模型：

```typescript
// orion-ai-svc/src/services/ScenarioRouter.ts (扩展)

const SCENARIO_ROUTING_RULES = [
  // 流水线 YAML 生成：需要代码理解能力
  {
    scenario: 'pipeline_yaml_generation',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
    reason: '代码能力强，YAML 格式稳定',
  },

  // 根因分析：需要强推理能力
  {
    scenario: 'root_cause_analysis',
    primaryProvider: 'anthropic',
    primaryModel: 'opus-4-6',
    fallbackProvider: 'anthropic',
    fallbackModel: 'sonnet-4-6',
    reason: '复杂推理和诊断',
  },

  // 自动修复：需要代码生成能力
  {
    scenario: 'auto_fix_generation',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    reason: '代码生成准确',
  },

  // 性能优化：分析能力，sonnet 足够
  {
    scenario: 'performance_optimization',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    reason: '数据分析+建议',
  },

  // 发布差异：需要代码+依赖理解
  {
    scenario: 'release_diff_analysis',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    reason: '代码理解+风险评估',
  },

  // 发布说明：需要文本生成能力
  {
    scenario: 'release_notes_generation',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    reason: '文档生成质量',
  },

  // 知识库问答：快速响应
  {
    scenario: 'knowledge_qa',
    primaryProvider: 'anthropic',
    primaryModel: 'haiku-4-5',
    fallbackProvider: 'anthropic',
    fallbackModel: 'sonnet-4-6',
    reason: '快速+便宜，复杂问题升级',
  },

  // 告警归类：文本分类，haiku 足够
  {
    scenario: 'alert_classification',
    primaryProvider: 'anthropic',
    primaryModel: 'haiku-4-5',
    reason: '分类任务，低延迟',
  },

  // 告警合并：简单推理
  {
    scenario: 'alert_merge',
    primaryProvider: 'anthropic',
    primaryModel: 'haiku-4-5',
    reason: '布尔判断，最便宜',
  },
];
```

---

## 五、Tool Registry 扩展

### 5.1 新增工具

```typescript
// orion-ai-svc/src/services/agent/ToolRegistry.ts (扩展)

// 已有工具：deploy, monitoring, pipeline, vector_search, log_query

// 新增工具：
const newTools = [
  {
    name: 'git',
    description: 'Git 仓库操作',
    operations: [
      'getCommits',           // 获取提交列表
      'getCommitsBetween',    // 获取两个 tag 之间的提交
      'getCommitDiff',        // 获取提交的代码差异
      'getBranches',          // 获取分支列表
      'createBranch',         // 创建分支
      'commit',               // 提交代码
    ],
  },
  {
    name: 'build',
    description: '构建系统操作',
    operations: [
      'getBuildLogs',         // 获取构建日志
      'getCacheStats',        // 获取缓存统计
      'triggerBuild',         // 触发构建
      'getArtifactDiff',      // 获取产物差异
    ],
  },
  {
    name: 'notification',
    description: '通知发送',
    operations: [
      'sendWeCom',            // 企微通知
      'sendDingTalk',         // 钉钉通知
      'sendFeishu',           // 飞书通知
      'sendEmail',            // 邮件通知
    ],
  },
];
```

---

## 六、API 设计

### 6.1 Agent 触发 API

```typescript
// orion-platform-service/src/api/ai-agent-routes.ts

// POST /api/v1/agents/pipeline-yaml/generate
// 自然语言生成流水线 YAML
{
  "naturalLanguage": "创建 Android 构建流水线...",
  "platform": "android"
}

// POST /api/v1/agents/root-cause/analyze
// 根因分析
{
  "runId": "run-xxx-yyy"
}

// POST /api/v1/agents/auto-fix/fix
// 自动修复
{
  "runId": "run-xxx-yyy",
  "autoApply": true  // 是否自动应用修复
}

// POST /api/v1/agents/perf-opt/analyze
// 性能优化分析
{
  "pipelineId": "pipeline-xxx",
  "timeRange": {
    "start": "2026-05-12",
    "end": "2026-05-19"
  }
}

// POST /api/v1/agents/release/diff
// 版本差异分析
{
  "artifactId": "artifact-xxx",
  "versionFrom": "v1.0.0",
  "versionTo": "v1.1.0"
}

// POST /api/v1/agents/release-notes/generate
// 发布说明生成
{
  "artifactId": "artifact-xxx",
  "version": "v1.1.0"
}

// POST /api/v1/agents/knowledge/answer
// 知识库问答
{
  "question": "如何配置 Android 签名？"
}

// POST /api/v1/agents/alert/classify
// 告警归类
{
  "alertId": "alert-xxx"
}

// POST /api/v1/agents/alert/merge
// 告警合并
{
  "alertIds": ["alert-1", "alert-2", "alert-3"]
}
```

---

## 七、实施计划

### 7.1 优先级与阶段

| 阶段 | Agent | 复杂度 | 依赖 | 预计工时 |
|------|-------|--------|------|---------|
| **P0** | PipelineYamlAgent | 中 | AI Gateway + PipelineService | 3人日 |
| **P0** | RootCauseAgent | 高 | AI Gateway + ErrorClassifier + GitService | 4人日 |
| **P1** | AlertClassifyAgent | 低 | AI Gateway + AlertService | 2人日 |
| **P1** | PerfOptAgent | 中 | AI Gateway + PipelineMetricsService | 3人日 |
| **P1** | ReleaseDiffAgent | 中 | AI Gateway + ArtifactService + GitService | 3人日 |
| **P2** | AutoFixAgent | 高 | RootCauseAgent + AgentSandbox | 5人日 |
| **P2** | ReleaseNotesAgent | 低 | ReleaseDiffAgent + GitService | 2人日 |
| **P2** | AlertMergeAgent | 低 | AlertClassifyAgent + AlertDeduplication | 2人日 |
| **P2** | RAGKnowledgeAgent | 中 | VectorStore + AIGateway | 3人日 |
| **P2** | WeComBotAdapter | 低 | RAGKnowledgeAgent | 2人日 |

### 7.2 实施路线图

```
Phase 1 (P0) ────────────────────────────────────────→ Week 1-2
├── PipelineYamlAgent（流水线 YAML 生成）
└── RootCauseAgent（根因分析）

Phase 2 (P1) ────────────────────────────────────────→ Week 3-4
├── AlertClassifyAgent（告警归类）
├── PerfOptAgent（性能优化）
└── ReleaseDiffAgent（版本差异）

Phase 3 (P2) ────────────────────────────────────────→ Week 5-6
├── AutoFixAgent（自动修复）
├── ReleaseNotesAgent（发布说明）
├── AlertMergeAgent（告警合并）
├── RAGKnowledgeAgent（RAG 知识库）
└── WeComBotAdapter（企微机器人）
```

---

## 八、风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| LLM 响应延迟 | Agent 执行超时 | 中 | AI Gateway 熔断 + 降级到规则引擎 |
| YAML 生成错误 | 流水线配置损坏 | 低 | 本地语法验证 + 沙箱测试 |
| 自动修复误操作 | 引入新问题 | 中 | 修复前人工审批 + 沙箱验证 |
| 知识库数据过时 | 答案不准确 | 低 | 定期向量化更新 + 答案置信度提示 |
| Token 成本过高 | 预算超支 | 中 | 场景路由优先使用 haiku + Token 配额 |

---

## 九、成功指标

| 指标 | 基线 | 目标 | 测量方式 |
|------|------|------|---------|
| 流水线配置时间 | 30分钟 | 5分钟 | 用户操作时长 |
| 构建失败归因时间 | 45分钟 | 5分钟 | 从失败到定位的时间 |
| 自动修复成功率 | N/A | >70% | 修复后验证通过比例 |
| 告警归类准确率 | N/A | >90% | 人工抽检 |
| 知识库问答满意度 | N/A | >85% | 用户反馈 |
| LLM 调用成本/天 | N/A | <¥50 | Token 统计 |

---

## 十、与现有系统的集成点

| Agent | 集成服务 | 集成方式 |
|-------|---------|---------|
| PipelineYamlAgent | PipelineService | 调用 validateYaml() + getTemplates() |
| RootCauseAgent | PipelineRunService + GitService + ErrorClassifier | 获取日志 + 提交 + 错误分类 |
| AutoFixAgent | AgentSandbox + GitService + PipelineService | 沙箱验证 + 提交修复 + 触发验证 |
| PerfOptAgent | PipelineMetricsService + CacheMonitorService | 获取指标 + 缓存统计 |
| ReleaseDiffAgent | ArtifactService + GitService | 获取产物差异 + Git 提交 |
| ReleaseNotesAgent | GitService | 获取提交列表 |
| RAGKnowledgeAgent | VectorStore + KnowledgeService | 向量检索 + 文档管理 |
| WeComBotAdapter | WeComClient + RAGKnowledgeAgent | Webhook 接收 + 推送答案 |
| AlertClassifyAgent | AlertService + AlertDeduplication | 获取告警 + 调用去重 |
| AlertMergeAgent | AlertDeduplication + AlertService | 分组 + 合并 |

---

*本文档是 Orion AI Agent 增强六大模块的完整设计方案*
