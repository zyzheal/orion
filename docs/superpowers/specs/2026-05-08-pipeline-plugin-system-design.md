# Pipeline Plugin System Design

## Metadata

| Field | Value |
|-------|-------|
| Date | 2026-05-08 |
| Status | Draft |
| Authors | Claude (AI Assistant) |
| Reviewers | TBD |
| Implementation Priority | High |

---

## Executive Summary

设计一个全面的 Pipeline 插件系统，支持：
- **插件扩展**：内置插件、Marketplace 插件、远程插件、用户自定义脚本
- **分层隔离**：按信任等级执行（Tier 1-4）
- **安全机制**：三级 Inline Script 能力、审批流程、审计日志
- **可观测性**：OpenTelemetry 分布式追踪 + AI 智能诊断 + 可视化回放
- **防卡死设计**：多层超时 + 心跳检测 + 进程强制终止递进策略

---

## 1. Context & Problem Statement

### 1.1 Current State

**现有 TaskRunner 仅支持 4 种类型**：
- `git/*` - Git 操作
- `npm/*` / `yarn/*` - 包管理
- `k8s/*` / `kubernetes/*` - K8s 操作
- `shell/*` / `script/*` - Shell 命令

**缺失能力**：
- 无法集成外部工具（SonarQube, JFrog, Snyk）
- 无自定义业务逻辑支持
- 无 Marketplace 插件生态
- 无可视化插件选择界面
- 无用户自定义脚本安全机制

### 1.2 Goals

| Goal | Priority | Success Metric |
|------|----------|----------------|
| 支持 100+ Marketplace 插件 | High | 插件安装成功率 95% |
| 用户自定义脚本安全执行 | Critical | 零安全事故 |
| 防止 Pipeline 卡死 | Critical | 超时强制终止成功率 99.9% |
| AI 智能诊断错误根因 | Medium | 诊断准确率 > 70% |
| 可视化回放执行历史 | Medium | 用户满意度 > 80% |

---

## 2. Architecture Overview

### 2.1 System Architecture

``````dot
digraph plugin_system {
    rankdir=TB;
    
    subgraph frontend {
        PipelineEditor [label="Pipeline Editor"];
        PluginPicker [label="Plugin Picker"];
        InlineScriptEditor [label="Inline Script Editor"];
        ExecutionTimeline [label="Execution Timeline"];
    }
    
    subgraph backend {
        PluginRegistry [label="Plugin Registry"];
        PluginExecutor [label="Plugin Executor"];
        InlineScriptService [label="Inline Script Service"];
        ApprovalService [label="Approval Service"];
        ExecutionGuardian [label="Execution Guardian"];
    }
    
    subgraph execution_tiers {
        Tier1 [label="Tier 1\nIn-Process"];
        Tier2 [label="Tier 2\nProcess Pool"];
        Tier3 [label="Tier 3\nContainer"];
        Tier4 [label="Tier 4\nWASM Sandbox"];
    }
    
    subgraph observability {
        OpenTelemetry [label="OpenTelemetry"];
        Jaeger [label="Jaeger/Tempo"];
        AIDiagnosis [label="AI Diagnosis"];
        AuditLogger [label="Audit Logger"];
    }
    
    PipelineEditor -> PluginPicker;
    PipelineEditor -> InlineScriptEditor;
    PipelineEditor -> ExecutionTimeline;
    
    PluginPicker -> PluginRegistry;
    InlineScriptEditor -> InlineScriptService;
    
    PluginRegistry -> PluginExecutor;
    InlineScriptService -> PluginExecutor;
    
    PluginExecutor -> Tier1;
    PluginExecutor -> Tier2;
    PluginExecutor -> Tier3;
    PluginExecutor -> Tier4;
    
    PluginExecutor -> ExecutionGuardian;
    PluginExecutor -> OpenTelemetry;
    PluginExecutor -> AuditLogger;
    
    Tier3 -> ApprovalService [label="Level 3\n需要审批"];
    
    OpenTelemetry -> Jaeger;
    PluginExecutor -> AIDiagnosis [label="错误时"];
}
``````

### 2.2 Core Components

| Component | Responsibility | Integration Point |
|-----------|---------------|-------------------|
| **PluginRegistry** | 插件注册、发现、验证 | 扩展 `src/services/plugin-spi/PluginRegistry.ts` |
| **PluginExecutor** | 分层执行插件任务 | 扩展 `src/services/plugin-executor-service.ts` |
| **InlineScriptService** | 用户脚本安全执行 | 新增 `src/services/InlineScriptService.ts` |
| **ExecutionGuardian** | 超时、心跳、强制终止 | 新增 `src/services/ExecutionGuardian.ts` |
| **ApprovalService** | Level 3 审批流程 | 扩展 `src/services/approval/ApprovalService.ts` |
| **AIDiagnosisService** | 错误根因分析 | 新增 `src/services/ai/AIDiagnosisService.ts` |

> **术语说明**：
> - **Tier (隔离层)**：Tier 1-4 表示插件执行隔离等级（进程内/进程池/容器/WASM）
> - **Level (能力等级)**：Level 1-3 表示 Inline Script 安全能力（Safe/Standard/Advanced）

---

## 3. Plugin Sources & YAML Syntax

### 3.1 Plugin Source Types

| Source | Trust Level | Isolation Tier | Approval Required |
|--------|-------------|----------------|-------------------|
| **Built-in** | High | Tier 1 (In-Process) | No |
| **Marketplace (Verified)** | Medium | Tier 2 (Process Pool) | No |
| **Marketplace (Community)** | Low | Tier 3 (Container) | Tenant Config |
| **Remote Plugin** | Low | Tier 3 (Container) | Validation + Tenant Config |
| **Inline Script (Level 1)** | Safe | Tier 4 (WASM) | No |
| **Inline Script (Level 2)** | Standard | Tier 2 (Process Pool) | Tenant Whitelist |
| **Inline Script (Level 3)** | Advanced | Tier 3 (Container) | Yes (2 approvers) |

### 3.2 YAML Configuration Syntax

```yaml
# pipeline.yaml - 7 种插件使用方式示例

stages:
  - name: build
    steps:
      # 方式 1: Built-in 插件引用
      - name: git-clone
        uses: plugins/git/clone
        with:
          repo: https://github.com/org/repo
          branch: main
      
      # 方式 2: Marketplace 插件
      - name: sonar-scan
        uses: plugins/marketplace/sonar-scanner@v2.1
        with:
          projectKey: my-project
          qualityGate: 80
      
      # 方式 3: 远程插件
      - name: custom-tool
        uses: remote://github.com/org/custom-plugin@v1.0
        with:
          authToken: ${ secrets.GITHUB_TOKEN }
          config: { ... }
      
      # 方式 4: Inline Script (Level 1 - Safe)
      - name: parse-config
        inline-script:
          level: safe
          language: javascript
          code: |
            const config = await readJson('./config.json');
            return {
              version: config.version,
              features: config.features.filter(f => f.enabled)
            };
      
      # 方式 5: Inline Script (Level 2 - Standard)
      - name: fetch-metadata
        inline-script:
          level: standard
          language: javascript
          permissions:
            network: ['api.github.com']
            files:
              write: ['./metadata.json']
          code: |
            const response = await fetch('https://api.github.com/repos/org/repo');
            const data = await response.json();
            await writeJson('./metadata.json', { stars: data.stars });
            return data;
      
      # 方式 6: Inline Script (Level 3 - Advanced)
      - name: deploy-to-k8s
        inline-script:
          level: advanced
          language: javascript
          approval:
            approvalId: approval-abc123  # 预先获取的审批 ID
          code: |
            const k8s = require('@kubernetes/client-node');
            const kc = new k8s.KubeConfig();
            kc.loadFromDefault();
            const appsApi = kc.makeApiClient(k8s.AppsV1Api);
            await appsApi.createNamespacedDeployment('production', deployment);
      
      # 方式 7: Shell 命令 (等同于 Level 2)
      - name: run-tests
        run: |
          npm install
          npm test
          npm run coverage
```

---

## 4. Isolation Tiers Design

### 4.1 Tier Definitions

``````plaintext
┌─────────────────────────────────────────────────────────────────────┐
│                     Tier 1: In-Process Execution                      │
├─────────────────────────────────────────────────────────────────────┤
│ Trust Level: HIGH                                                    │
│ Isolation: None (same process)                                       │
│ Timeout: 60s                                                         │
│ Memory: 512MB                                                        │
│                                                                       │
│ Use Cases:                                                            │
│ • Built-in plugins (git, npm, docker)                                │
│ • Verified high-trust plugins                                        │
│ • Low-risk operations                                                │
│                                                                       │
│ Security:                                                             │
│ • No sandbox overhead                                                │
│ • Direct function call                                              │
│ • Fastest execution                                                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     Tier 2: Process Pool Execution                    │
├─────────────────────────────────────────────────────────────────────┤
│ Trust Level: MEDIUM                                                  │
│ Isolation: Worker threads                                            │
│ Timeout: 120s                                                        │
│ Memory: 1GB                                                          │
│                                                                       │
│ Use Cases:                                                            │
│ • Marketplace verified plugins                                       │
│ • Inline Script Level 2 (Standard)                                  │
│ • Node SDK plugins                                                   │
│                                                                       │
│ Security:                                                             │
│ • Process isolation                                                  │
│ • Permission interceptor                                             │
│ • Resource monitoring                                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     Tier 3: Container Execution                        │
├─────────────────────────────────────────────────────────────────────┤
│ Trust Level: LOW                                                     │
│ Isolation: Docker container                                          │
│ Timeout: 300s                                                        │
│ Memory: 2GB                                                          │
│                                                                       │
│ Use Cases:                                                            │
│ • External tools (SonarQube, Terraform)                              │
│ • Marketplace community plugins                                      │
│ • Remote plugins                                                     │
│ • Inline Script Level 3 (Advanced)                                  │
│                                                                       │
│ Security:                                                             │
│ • Full container isolation                                          │
│ • Read-only root filesystem                                         │
│ • Network restrictions                                              │
│ • Audit logging                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     Tier 4: WASM Sandbox Execution                     │
├─────────────────────────────────────────────────────────────────────┤
│ Trust Level: UNTRUSTED                                               │
│ Isolation: WASM runtime                                              │
│ Timeout: 60s                                                         │
│ Memory: 256MB                                                        │
│                                                                       │
│ Use Cases:                                                            │
│ • Inline Script Level 1 (Safe)                                      │
│ • Untrusted source plugins                                          │
│ • User-submitted code                                               │
│                                                                       │
│ Security:                                                             │
│ • Strictest isolation                                                │
│ • No filesystem access                                               │
│ • No network access                                                  │
│ • No subprocess                                                      │
└─────────────────────────────────────────────────────────────────────┘
``````

### 4.2 Tier Routing Logic

```typescript
// TaskRunner.ts 扩展
class TaskRunner {
  private async executeByType(task: Task, signal?: AbortSignal): Promise<Result> {
    const type = task.type.toLowerCase();
    
    // 新增: 插件类型分发
    if (type.startsWith('plugin/')) {
      return this.executePluginTask(task, signal);
    }
    
    if (type.startsWith('inline-script/')) {
      return this.executeInlineScriptTask(task, signal);
    }
    
    // 原有逻辑...
  }
  
  private async executePluginTask(task: Task, signal: AbortSignal): Promise<Result> {
    const pluginId = task.parameters.pluginId;
    const plugin = await this.pluginRegistry.getPlugin(pluginId);
    
    // 根据信任等级路由
    switch (plugin.trustLevel) {
      case 'HIGH':
        return this.tier1Executor.execute(task, plugin);
      case 'MEDIUM':
        return this.tier2Executor.execute(task, plugin);
      case 'LOW':
        return this.tier3Executor.execute(task, plugin);
      case 'UNTRUSTED':
        return this.tier4Executor.execute(task, plugin);
    }
  }
}
```

---

## 5. Inline Script Capability Levels

### 5.1 Level Definitions

| Level | Capabilities | Restrictions | Execution Environment |
|-------|--------------|--------------|------------------------|
| **Safe (Level 1)** | File read, data transform, calculation | No write, no network, no subprocess, no env vars | WASM Sandbox (256MB, 60s) |
| **Standard (Level 2)** | Whitelisted file write, network, commands, env vars | Must configure whitelist in Tenant | Process Pool (1GB, 120s) |
| **Advanced (Level 3)** | Full access (any network, any command, K8s, DB) | Requires approval (2 approvers) | Container (2GB, 300s) |

### 5.2 Permission Configuration

```typescript
interface InlineScriptPermissions {
  network?: string[];      // 允许的域名白名单
  files?: {
    read?: string[];       // 允许读取的路径
    write?: string[];      // 允许写入的路径
  };
  commands?: string[];     // 允许执行的命令
  envVars?: string[];      // 允许读取的环境变量
  kubernetes?: boolean;    // 是否允许 K8s API (Level 3 only)
  database?: string[];     // 允许连接的数据库 (Level 3 only)
}
```

### 5.3 Approval Process (Level 3)

``````mermaid
sequenceDiagram
    participant User
    participant InlineScriptService
    participant ApprovalService
    participant Approver1
    participant Approver2
    participant NotificationService
    
    User->>InlineScriptService: Request Level 3 approval
    InlineScriptService->>ApprovalService: Create approval request
    ApprovalService->>NotificationService: Send approval notifications
    NotificationService->>Approver1: Email/Slack notification
    NotificationService->>Approver2: Email/Slack notification
    
    Approver1->>ApprovalService: Approve with comment
    ApprovalService->>NotificationService: Notify progress
    Approver2->>ApprovalService: Approve with comment
    
    ApprovalService->>ApprovalService: Check approval count (2/2)
    ApprovalService->>NotificationService: Notify User of approval
    NotificationService->>User: Approval granted
    
    User->>InlineScriptService: Execute with approval ID
    InlineScriptService->>ApprovalService: Validate approval
    ApprovalService->>InlineScriptService: Approval valid
    InlineScriptService->>InlineScriptService: Execute in Container
    InlineScriptService->>AuditLogger: Log all operations
``````

---

## 6. Debug Mode & Logging System

### 6.1 System Architecture

整合 **B (OpenTelemetry) + C (AI Diagnosis) + D (Visual Replay)**：

``````plaintext
┌─────────────────────────────────────────────────────────────────────┐
│                    Execution Observability Stack                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Real-time Logs (SSE)                                                │
│  ├── PipelineLogSSEService (现有)                                     │
│  ├── Plugin execution logs                                            │
│  ├── Heartbeat status                                                 │
│  └── Error events                                                     │
│                                                                       │
│  Distributed Tracing (OpenTelemetry)                                  │
│  ├── Span per plugin execution                                        │
│  ├── Span per API call                                                │
│  ├── Trace correlation across services                               │
│  └ Export to Jaeger/Tempo                                             │
│                                                                       │
│  AI Diagnosis                                                          │
│  ├── Error analysis on failure                                        │
│  ├── Root cause detection                                             │
│  ├── Suggested fix generation                                         │
│  └ Similar incident matching                                          │
│                                                                       │
│  Visual Replay                                                         │
│  ├── Timeline navigation                                              │
│  ├── Step-by-step playback                                            │
│  ├── Jaeger trace viewer link                                         │
│  └ Historical execution replay                                        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
``````

### 6.2 OpenTelemetry Integration

```typescript
// 每个插件执行创建 Span
const span = tracer.startSpan(`plugin:${pluginId}`, {
  attributes: {
    'plugin.id': pluginId,
    'plugin.version': version,
    'plugin.tier': isolationTier,
    'pipeline.run_id': runId,
    'tenant.id': tenantId,
  },
});

// 外部 API 调用创建子 Span
const apiSpan = tracer.startSpan('external-api-call', { parent: span });
const response = await fetch(externalUrl);
apiSpan.setAttributes({
  'http.url': externalUrl,
  'http.status_code': response.status,
});
apiSpan.end();

// 错误时标记
span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
span.end();
```

### 6.3 AI Diagnosis Flow

```typescript
class AIDiagnosisService {
  async diagnose(context: ExecutionContext, error: Error): Promise<DiagnosisResult> {
    
    // 1. 收集上下文
    const recentLogs = await this.getRecentLogs(context.taskId, 50);
    const spanData = await this.getSpanData(context.taskId);
    const similarIncidents = await this.findSimilarIncidents(error);
    
    // 2. 构建 AI prompt
    const prompt = `
Error: ${error.message}
Stack Trace: ${error.stack}

Execution Context:
- Plugin: ${context.pluginId}
- Duration before error: ${spanData.duration}ms

Recent Logs:
${recentLogs.map(l => `[${l.level}] ${l.line}`).join('\n')}

Similar Past Incidents:
${similarIncidents.map(i => `- ${i.error}: ${i.resolution}`).join('\n')}

Analyze: root cause, suggested fix, confidence (0-100%)
`;
    
    // 3. 调用 AI
    const response = await this.aiService.analyze({ prompt });
    
    return {
      rootCause: response.rootCause,
      suggestedFix: response.suggestedFix,
      confidence: response.confidence,
      similarIncidents,
    };
  }
}
```

### 6.4 Visual Timeline Component

``````plaintext
┌─────────────────────────────────────────────────────────────────────┐
│ Execution Timeline                              ◀ ▶ ⏸  ⏩ 2x          │
├─────────────────────────────────────────────────────────────────────┤
│  00:00   00:10   00:20   00:30   00:40   00:50                       │
│    │      │      │      │      │      │                              │
│    ▼──────▼──────▼──────▼──────▼──────▼                              │
│                                                                       │
│  git-clone     ████████████████                                       │
│  npm-install   ████████████████████████████████████████████          │
│  plugin:sonar  ███████████████████████████████████████████           │
│                    ▲ Error at 00:32                                   │
│  plugin:deploy ██████████████████████████████████████████████        │
│                                                                       │
│  [点击时间点查看详细日志]                                              │
│                                                                       │
│  Selected: 00:32 - sonar quality gate                                │
│  ERROR: Quality gate failed                                          │
│  Coverage: 65% < threshold 80%                                        │
│  [View in Jaeger] [AI Diagnose]                                       │
│                                                                       │
│  AI Diagnosis:                                                        │
│  Root Cause: Code coverage threshold too strict                       │
│  Suggested Fix: Lower threshold to 70% or add more tests              │
│  Confidence: 85%                                                        │
└─────────────────────────────────────────────────────────────────────┘
``````

---

## 7. Anti-Stuck Mechanism (防卡死设计)

### 7.1 Multi-layer Timeout Architecture

| Layer | Scope | Default Timeout | Max Timeout |
|-------|-------|-----------------|-------------|
| **Layer 1** | Global Pipeline | 30 min | 2 hours |
| **Layer 2** | Stage | 10 min | 1 hour |
| **Layer 3** | Step/Plugin | 5 min | 30 min |
| **Layer 4** | Plugin execution (by tier) | Tier1: 60s, Tier2: 120s, Tier3: 300s, Tier4: 60s | Configurable |
| **Layer 5** | API call | 30s | 120s |
| **Layer 6** | Heartbeat | 15s no response → force kill | - |

### 7.2 Execution Guardian System

``````plaintext
┌─────────────────────────────────────────────────────────────────────┐
│                    Execution Guardian System                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  TimeoutController                                                   │
│  ├── Global timeout watchdog                                         │
│  ├── Step timeout watchdog                                           │
│  └ API call timeout (AbortController)                                │
│                                                                       │
│  HeartbeatWatchdog                                                    │
│  ├── Register heartbeat on execution start                           │
│  ├── Plugin sends heartbeat every 5s                                 │
│  ├── Check heartbeat every 5s                                        │
│  └ 15s no heartbeat → trigger force kill                             │
│                                                                       │
│  ResourceMonitor                                                      │
│  ├── Monitor CPU/Memory every 10s                                    │
│  ├── CPU > 95% + no progress → potential infinite loop               │
│  ├── Memory growth > 50MB/s → potential memory leak                  │
│  ├── 30s no IO activity → potential hang                             │
│                                                                       │
│  ProcessKiller                                                        │
│  ├── Phase 1: SIGTERM (5s wait)                                      │
│  ├── Phase 2: SIGKILL (2s wait)                                      │
│  ├── Phase 3: Container freeze/kill (for containers)                 │
│  ├── Zombie process cleanup                                          │
│                                                                       │
│  TimeoutRecovery                                                      │
│  ├── Action: retry | skip | fail                                     │
│  ├── Max retries: configurable                                        │
│  ├── Notification on timeout                                          │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
``````

### 7.3 Process Killer Implementation

```typescript
class ProcessKiller {
  async kill(taskId: string, reason: string): Promise<void> {
    const processInfo = this.getProcessInfo(taskId);
    
    // Phase 1: SIGTERM
    logger.info({ taskId, pid: processInfo.pid }, 'Sending SIGTERM');
    processInfo.process.kill('SIGTERM');
    await this.waitForExit(processInfo.pid, 5000);
    
    if (this.isAlive(processInfo.pid)) {
      // Phase 2: SIGKILL
      logger.warn({ taskId }, 'SIGTERM ignored, sending SIGKILL');
      processInfo.process.kill('SIGKILL');
      await this.waitForExit(processInfo.pid, 2000);
      
      if (this.isAlive(processInfo.pid)) {
        // Phase 3: Container freeze
        if (processInfo.containerId) {
          logger.error({ taskId }, 'SIGKILL failed, freezing container');
          await this.dockerClient.pause(processInfo.containerId);
          await this.dockerClient.kill(processInfo.containerId);
        }
        
        this.emit('kill:failed', { taskId, pid: processInfo.pid });
      }
    }
    
    this.cleanupZombie(processInfo.pid);
  }
  
  // Zombie process detector
  private detectZombies(): void {
    setInterval(() => {
      const zombies = this.processRegistry.filter(p => p.status === 'zombie');
      if (zombies.length > 0) {
        logger.error({ zombies }, 'Zombie processes detected');
        zombies.forEach(z => this.kill(z.taskId, 'zombie_cleanup'));
      }
    }, 30000);
  }
}
```

### 7.4 Timeout Recovery Policy

```yaml
# pipeline.yaml 超时配置
timeoutPolicy:
  globalTimeout: 30m
  stepTimeout: 5m
  
  onTimeout:
    action: retry | skip | fail    # 超时后的动作
    maxRetries: 2                   # 重试次数
    retryDelay: 10s                 # 重试延迟
    
    notify:                         # 告警配置
      channels: [slack, email]
      severity: high
```

---

## 8. Frontend Components

### 8.1 PluginPicker Component

``````plaintext
┌─────────────────────────────────────────────────────────────────────┐
│ Plugin Picker Modal                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ 🔍 Search plugins...                                                 │
│                                                                       │
│ [📦 Built-in] [🏪 Marketplace] [🔗 Remote] [✏️ Custom Script]         │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Category: SCM                                                    │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │ │
│ │ │ git/clone    │ │ git/push     │ │ git/checkout │               │ │
│ │ │ Tier 1       │ │ Tier 1       │ │ Tier 1       │               │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘               │ │
│ │ Category: Build                                                 │ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │ │
│ │ │ npm/install  │ │ docker/build │ │ terraform    │               │ │
│ │ │ Tier 1       │ │ Tier 2       │ │ Tier 3       │               │ │
│ │ └──────────────┘ └──────────────┘ └──────────────┘               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ Selected: sonar-scanner                                              │
│ Version: v2.1.0                                                      │
│ [Add to Pipeline]                                                     │
└─────────────────────────────────────────────────────────────────────┘
``````

### 8.2 Inline Script Editor

``````plaintext
┌─────────────────────────────────────────────────────────────────────┐
│ Inline Script Editor                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Level: [Safe ○] [Standard ○] [Advanced ○]                             │
│ Language: [JavaScript ▼]                                              │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Monaco Editor                                                    │ │
│ │ const config = await readJson('./config.json');                 │ │
│ │ return {                                                         │ │
│ │   version: config.version,                                       │ │
│ │   features: config.features.filter(f => f.enabled)              │ │
│ │ };                                                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ Security Scan: ✓ No violations detected                              │
│                                                                       │
│ Quick Templates:                                                      │
│ [Parse JSON] [Filter Data] [Transform] [Calculate]                    │
│                                                                       │
│ 🤖 AI Generate Script:                                                │
│ [Describe what you want...] [Generate]                                │
│                                                                       │
│ [🧪 Dry Run Test] [Add to Pipeline]                                   │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Level 3 Approval (if Advanced)                                  │ │
│ │ Reason: Deploy to production Kubernetes                          │ │
│ │ Expires: [Single use ▼]                                          │ │
│ │ [Submit for Approval]                                            │ │
│ │                                                                  │ │
│ │ Approval Status: Pending (waiting for 2 approvers)              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
``````

### 8.3 Step Configuration Panel

``````plaintext
┌─────────────────────────────────────────────────────────────────────┐
│ Step Configuration: sonar-scanner                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Plugin: sonar-scanner v2.1.0                                          │
│ Tier: Tier 3 (Container)                                              │
│ Trust: Medium                                                         │
│                                                                       │
│ Configuration:                                                         │
│ projectKey: _______________                                           │
│ qualityGate: ________                                                 │
│ sources: ./src                                                        │
│                                                                       │
│ 🤖 [AI Suggest Configuration]                                         │
│                                                                       │
│ Advanced Settings:                                                    │
│ Timeout: 300s                                                         │
│ Retry Policy: Exponential Backoff (max 2)                             │
│ Condition: Always Execute                                             │
│ Resources: Memory 2GB, CPU 2 cores                                    │
│                                                                       │
│ [🧪 Test Step] [Save] [Delete]                                        │
│                                                                       │
│ Help: [📖 Documentation] [Examples]                                    │
└─────────────────────────────────────────────────────────────────────┘
``````

---

## 9. API Endpoints

### 9.1 Plugin Discovery & Installation

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/plugins/builtin` | GET | List built-in plugins |
| `/api/v1/plugins/marketplace` | GET | Search marketplace plugins |
| `/api/v1/plugins/:pluginId` | GET | Get plugin details |
| `/api/v1/plugins/marketplace/:pluginId/install` | POST | Install marketplace plugin |
| `/api/v1/plugins/remote` | POST | Install remote plugin |
| `/api/v1/plugins/:pluginId` | DELETE | Uninstall plugin |

### 9.2 Inline Script

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/scripts/scan` | POST | Security scan code |
| `/api/v1/scripts/dry-run` | POST | Dry run test |
| `/api/v1/scripts/approval` | POST | Request Level 3 approval |
| `/api/v1/scripts/approval/:approvalId` | GET | Get approval status |
| `/api/v1/scripts/approval/:approvalId/decide` | POST | Approve/deny request |
| `/api/v1/scripts/ai-generate` | POST | AI generate script |

### 9.3 Execution & Debug

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/plugins/execute` | POST | Execute plugin task (internal) |
| `/api/v1/plugins/:taskId/cancel` | POST | Cancel execution |
| `/api/v1/pipelines/:runId/timeline` | GET | Get execution timeline |
| `/api/v1/pipelines/:runId/debug/pause` | POST | Pause for debug |
| `/api/v1/pipelines/:runId/debug/resume` | POST | Resume execution |
| `/api/v1/pipelines/:runId/debug/step` | POST | Single step execution |
| `/api/v1/plugins/ai-diagnose` | POST | AI error diagnosis |

### 9.4 Audit & Compliance

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/plugins/audit` | GET | Get audit logs |
| `/api/v1/plugins/audit/:taskId/trail` | GET | Get task audit trail |
| `/api/v1/plugins/marketplace/:pluginId/rate` | POST | Rate plugin |
| `/api/v1/plugins/marketplace/publish` | POST | Publish plugin |

---

## 10. Security & Compliance

### 10.1 Audit Logging

| Event Type | Logged Fields | Retention |
|------------|---------------|-----------|
| Plugin execution | taskId, pluginId, userId, tenantId, duration, result | 7 days |
| Inline Script Level 3 | taskId, codeHash, permissions, approvalId, all operations | 30 days |
| Approval decision | approvalId, approverId, decision, comment | 1 year |
| Marketplace install | pluginId, version, userId, trustLevel | 90 days |

### 10.2 Compliance Rules

| Standard | Requirement | Implementation |
|----------|-------------|----------------|
| **SOX** | Financial ops need approval | Level 3 for deployment to production |
| **GDPR** | Personal data processing logged | Audit log includes data access |
| **SOC2** | Privileged ops audited | All Level 3 operations fully logged |

### 10.3 Security Event Alerting

```typescript
// 自动告警规则
const alertRules = [
  {
    condition: 'level3_without_approval',
    severity: 'critical',
    channels: ['slack', 'pagerduty'],
  },
  {
    condition: 'permission_violation',
    severity: 'high',
    channels: ['slack', 'email'],
  },
  {
    condition: 'execution_timeout > 5min',
    severity: 'medium',
    channels: ['slack'],
  },
  {
    condition: 'unusual_execution_frequency',
    severity: 'medium',
    channels: ['email'],
  },
];
```

---

## 11. Implementation Plan

### 11.0 Phase 0: Database Migration (Week 0)

| Migration | Purpose | Tables |
|-----------|---------|--------|
| `050_plugin_audit_logs.sql` | 插件执行审计日志 | `plugin_audit_logs`, `plugin_audit_sessions` |
| `051_inline_script_approvals.sql` | Level 3 审批记录 | `inline_script_approvals`, `approval_decisions` |
| `052_plugin_installations.sql` | 插件安装记录 | `plugin_installations`, `plugin_versions` |
| `053_execution_timelines.sql` | 执行时间线快照 | `execution_timelines`, `execution_events` |

**审计日志表结构**：

```sql
CREATE TABLE plugin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id VARCHAR(255) NOT NULL,
  plugin_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,  -- 'execute', 'install', 'approve'
  outcome VARCHAR(20) NOT NULL, -- 'success', 'failed', 'timeout'
  duration_ms INTEGER,
  isolation_tier VARCHAR(20),
  approval_id VARCHAR(255),
  code_hash VARCHAR(64),
  permissions JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_task ON plugin_audit_logs(task_id);
CREATE INDEX idx_audit_plugin ON plugin_audit_logs(plugin_id);
CREATE INDEX idx_audit_tenant ON plugin_audit_logs(tenant_id);
CREATE INDEX idx_audit_created ON plugin_audit_logs(created_at);
```

### 11.1 Phase 1: Core Plugin System (Week 1-2)

| Task | Files | Dependencies |
|------|-------|--------------|
| PluginRegistry service | `src/services/plugin-spi/PluginRegistry.ts` | None |
| PluginExecutor service | `src/services/PluginExecutorService.ts` | PluginRegistry |
| TaskRunner integration | `src/engine/TaskRunner.ts` | PluginExecutor |
| Plugin API routes | `src/api/plugin-routes.ts` | All above |

### 11.2 Phase 2: Inline Script System (Week 3-4)

| Task | Files | Dependencies |
|------|-------|--------------|
| InlineScriptService | `src/services/InlineScriptService.ts` | PluginExecutor |
| WASM runtime integration | `src/services/WasmRuntime.ts` | InlineScriptService |
| ApprovalService extension | `src/services/approval/ApprovalService.ts` | InlineScriptService |
| Script API routes | `src/api/script-routes.ts` | All above |

### 11.3 Phase 3: Execution Guardian (Week 5)

| Task | Files | Dependencies |
|------|-------|--------------|
| ExecutionGuardian | `src/services/ExecutionGuardian.ts` | PluginExecutor |
| HeartbeatWatchdog | `src/services/HeartbeatWatchdog.ts` | ExecutionGuardian |
| ProcessKiller | `src/services/ProcessKiller.ts` | ExecutionGuardian |

### 11.4 Phase 4: Observability (Week 6)

| Task | Files | Dependencies |
|------|-------|--------------|
| OpenTelemetry setup | `src/otel-setup.ts` | None |
| AIDiagnosisService | `src/services/ai/AIDiagnosisService.ts` | AIService |
| ExecutionTimelineService | `src/services/ExecutionTimelineService.ts` | SSE service |

### 11.5 Phase 5: Frontend (Week 7-8)

| Task | Files | Dependencies |
|------|-------|--------------|
| PluginPicker component | `orion-frontend/src/components/PluginPicker.tsx` | API routes |
| InlineScriptEditor | `orion-frontend/src/components/InlineScriptEditor.tsx` | API routes |
| StepConfigurationPanel | `orion-frontend/src/components/StepConfigurationPanel.tsx` | API routes |
| ExecutionTimeline | `orion-frontend/src/components/ExecutionTimeline.tsx` | SSE, Timeline API |

---

## 12. Testing Strategy

### 12.1 Unit Tests

| Module | Test Coverage Target | Key Tests |
|--------|---------------------|-----------|
| PluginRegistry | 85% | Validation, discovery, compatibility |
| PluginExecutor | 90% | Tier routing, timeout, error handling |
| InlineScriptService | 90% | All 3 levels, permission checking, approval |
| ExecutionGuardian | 95% | Timeout, heartbeat, process kill |

### 12.2 Integration Tests

| Scenario | Test Focus |
|----------|------------|
| Marketplace plugin install → execute | Full lifecycle |
| Inline Script Level 3 approval → execute | Approval flow |
| Timeout → force kill → recovery | Anti-stuck mechanism |
| Error → AI diagnosis | Diagnosis accuracy |

### 12.3 E2E Tests

| Scenario | Steps |
|----------|-------|
| Create pipeline with marketplace plugin | Editor → select plugin → configure → run |
| Create pipeline with inline script | Editor → write script → scan → add → run |
| Debug execution | Run → pause → inspect → resume |
| Timeout recovery | Configure timeout → trigger → auto-retry |

---

## 13. Migration & Compatibility

### 13.1 Backward Compatibility

| Existing Feature | Migration Strategy |
|------------------|-------------------|
| `git/*` tasks | Map to `plugins/git/*` (Tier 1) |
| `npm/*` tasks | Map to `plugins/npm/*` (Tier 1) |
| `shell/*` tasks | Map to inline-script Level 2 equivalent |
| Existing pipelines | Auto-convert on load |

### 13.2 Rollout Plan

| Stage | Scope | Duration |
|-------|-------|----------|
| Alpha | Internal testing only | 2 weeks |
| Beta | 5 pilot tenants | 4 weeks |
| GA | All tenants | 2 weeks |

---

## 14. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Plugin install success rate | > 95% | Marketplace API logs |
| Zero security incidents | 0 | Audit log analysis |
| Timeout kill success rate | > 99.9% | Execution guardian logs |
| AI diagnosis accuracy | > 70% | User feedback survey |
| User satisfaction (visual replay) | > 80% | UX survey |
| Pipeline execution time impact | < 5% increase | Performance monitoring |

---

## 15. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WASM runtime performance overhead | Medium | Medium | Benchmark + optimize, fallback to process pool |
| AI diagnosis inaccurate | Medium | Low | Confidence threshold + human review option |
| Approval bottleneck (Level 3) | High | High | SLA-based approval flow, auto-escalation |
| Marketplace plugin security | High | Critical | Strict validation + container isolation + audit |
| Process zombie accumulation | Low | Medium | Zombie detector + auto cleanup |

---

## 16. Appendix

### 16.1 Plugin Manifest Schema

```json
{
  "id": "sonar-scanner",
  "name": "SonarQube Scanner",
  "version": "2.1.0",
  "description": "Code quality and security analysis",
  "category": "security",
  "icon": "🔍",
  "tags": ["security", "quality", "sonarqube"],
  "trustLevel": "MEDIUM",
  "isolationTier": "TIER_2",
  "entryPoint": "./index.js",
  "capabilities": ["CUSTOM_TASK", "SECURITY_SCANNER"],
  "configSchema": {
    "type": "object",
    "properties": {
      "projectKey": { "type": "string", "required": true },
      "qualityGate": { "type": "number", "default": 80 },
      "sources": { "type": "string", "default": "./src" }
    }
  },
  "dependencies": {
    "runtime": "node >= 16",
    "external": ["sonar-scanner-cli"]
  },
  "permissions": {
    "network": ["sonar.example.com"],
    "envVars": ["SONAR_TOKEN", "SONAR_URL"]
  }
}
```

### 16.2 Tenant Configuration for Inline Script

```yaml
# Tenant inline script configuration
inlineScriptConfig:
  allowStandardScripts: true
  allowAdvancedScripts: true
  
  # Level 2 whitelist
  allowedNetworks:
    - api.github.com
    - sonar.example.com
    - slack.example.com
  
  allowedCommands:
    - npm
    - git
    - docker
  
  allowedEnvVars:
    - NODE_ENV
    - API_KEY
  
  # Level 3 settings
  advancedApproval:
    requiredApprovals: 2
    approvers:
      - role: security-team
      - role: platform-admin
    expirationOptions:
      - single-use
      - 24h
      - 7d
```

### 16.3 OpenTelemetry Span Attributes

```yaml
# Standard span attributes for plugin execution
plugin.id: string
plugin.version: string
plugin.tier: enum[TIER_1, TIER_2, TIER_3, TIER_4]
plugin.trust_level: enum[HIGH, MEDIUM, LOW, UNTRUSTED]

pipeline.run_id: string
pipeline.stage_id: string
pipeline.step_id: string

tenant.id: string
user.id: string

execution.timeout_ms: number
execution.duration_ms: number
execution.success: boolean
execution.retry_count: number

error.type: string
error.message: string
error.stack_trace: string

# Resource metrics
container.memory_used: number
container.cpu_total: number
wasm.memory_used: number
```

---

## 17. References

- Existing design: `docs/architecture/plugin-framework-design.md`
- Plugin SPI types: `src/services/plugin-spi/types.ts`
- Pipeline SSE service: `src/services/pipeline/PipelineLogSSEService.ts`
- Plugin executor service: `src/services/plugin-executor-service.ts`
- Task runner: `src/engine/TaskRunner.ts`

---

**Document Status**: Draft - Pending User Review

**Next Steps**:
1. User reviews design document
2. Adjust based on feedback
3. Invoke writing-plans skill for detailed implementation plan
4. Begin implementation