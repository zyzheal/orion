# ADR-002: Plugin SPI 接口设计

> **状态**: 已批准  
> **提出日期**: 2026-04-10  
> **提出人**: 架构团队  
> **决策人**: 架构委员会  
> **关联模块**: ⑮ 插件与扩展

---

## 1. 背景与问题

### 1.1 问题陈述

Orion 平台需要建立插件生态以支持可扩展的功能定制，但当前缺乏统一的插件 SPI 接口定义，导致：

- 第三方开发者无法开发兼容插件
- API Gateway 无法对插件进行统一的路由/限流/认证管理
- 插件质量参差不齐，缺乏审核和版本管理机制
- 插件错误可能影响核心系统稳定性

### 1.2 设计目标

- 支持多种插件类型（Custom Task/Webhook Handler/AI Skill/Notification Channel）
- 与 Tekton Custom Task 兼容
- 支持插件沙箱隔离
- 支持插件版本管理和审核机制
- 与工具管理中心（模块⑳）协同

### 1.3 约束条件

- 必须支持多种插件类型（二进制/容器/API/库）
- 必须与 Tekton Custom Task 兼容
- 必须支持插件沙箱隔离
- 必须支持插件版本管理
- 必须与工具管理中心协同

---

## 2. 备选方案

### 方案 A: gRPC 接口 + WASM 沙箱

**描述**: 定义标准 gRPC 接口，插件实现 gRPC 服务，运行在 WASM 沙箱中。

**优点**:
- 语言无关，支持多种开发语言
- WASM 沙箱提供强隔离
- gRPC 性能好，支持流式传输
- 类型安全，接口契约明确

**缺点**:
- WASM 运行时增加复杂度
- 开发者需要学习 WASM
- 调试相对困难

**成本估算**: 开发 15 人日，测试 8 人日

---

### 方案 B: HTTP/REST API + 容器隔离

**描述**: 插件作为独立 HTTP 服务运行，通过 REST API 与 Orion 通信，容器提供隔离。

**优点**:
- 技术栈成熟，开发者熟悉
- 容器隔离方案成熟
- 调试方便，可独立运行
- 支持任何语言和框架

**缺点**:
- 性能略低于 gRPC
- 需要管理容器生命周期
- 网络开销较大

**成本估算**: 开发 10 人日，测试 5 人日

---

### 方案 C: Python/TypeScript SDK + 进程隔离

**描述**: 提供官方 SDK，插件作为库被调用，通过进程隔离。

**优点**:
- 开发体验好，集成简单
- SDK 封装复杂逻辑
- 性能最优（无网络开销）

**缺点**:
- 语言绑定，仅限 Python/TS
- 进程隔离不如容器/WASM 安全
- 插件故障可能影响主进程

**成本估算**: 开发 8 人日，测试 4 人日

---

## 3. 决策结果

**选定方案**: **混合方案 — gRPC 接口为主，支持多种运行模式**

**决策理由**:
1. 核心插件使用 gRPC+WASM，保证安全性和性能
2. 简单插件支持 HTTP API，降低集成门槛
3. 提供 Python/TS SDK，改善开发体验
4. 分层设计，不同安全级别使用不同隔离方式

**插件安全级别与运行模式对应**:
| 安全级别 | 隔离方式 | 适用场景 |
|---------|---------|---------|
| Level 1 (高) | WASM 沙箱 | 未信任的第三方插件 |
| Level 2 (中) | 容器隔离 | 内部开发的插件 |
| Level 3 (低) | 进程隔离 | 官方插件/SDK 插件 |

---

## 4. Plugin SPI 架构总览

### 4.1 插件扩展点

```
┌─────────────────────────────────────────────────────────────────┐
│              Orion Plugin SPI 架构                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户代码                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Custom Task│  │  Webhook    │  │  AI Skill   │            │
│  │  (自定义任务)│  │  (回调处理)  │  │  (AI 能力)   │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Plugin SPI Layer (接口层)                    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ Task SPI     │  │ Webhook SPI  │  │ Skill SPI    │  │   │
│  │  │ 任务接口     │  │ Webhook 接口  │  │ AI 能力接口   │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Plugin Runtime (运行时)                      │   │
│  │  • 插件加载/卸载                                         │   │
│  │  • 沙箱隔离                                              │   │
│  │  • 生命周期管理                                          │   │
│  │  • 配置管理                                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 插件类型

| 插件类型 | 用途 | 示例 |
|---------|------|------|
| **Custom Task** | 扩展流水线 Stage | 自定义扫描、通知、部署 |
| **Webhook Handler** | 处理外部事件 | GitHub Webhook、Jira 回调 |
| **AI Skill** | 扩展 AI 能力 | 代码审查、测试生成、日志分析 |
| **Approval Provider** | 自定义审批源 | 外部审批系统对接 |
| **Notification Channel** | 扩展通知渠道 | 自定义 IM、短信服务 |
| **Deployment Strategy** | 自定义部署策略 | 灰度发布、蓝绿部署 |

---

## 5. 插件生命周期

```
┌─────────────────────────────────────────────────────────────────┐
│                      插件生命周期状态机                           │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │  Available │ ◄─────────────────────────────────┐
    └─────┬────┘                                    │
          │ discover()                              │
          ▼                                         │
    ┌──────────┐      install()      ┌──────────┐   │
    │ Downloaded│──────────────────► │ Installed│   │
    └──────────┘                     └────┬─────┘   │
                                          │         │
                                    activate()      │
                                          │         │
                                          ▼         │
                                     ┌──────────┐   │
                                     │ Active   │◄──┘
                                     └────┬─────┘   deactivate()
                                          │         (重新激活)
                                    configure()
                                          │
                                          ▼
                                     ┌──────────┐
                                     │Configured│
                                     └────┬─────┘
                                          │
                                    deactivate()
                                          │
                                          ▼
                                     ┌──────────┐      uninstall()    ┌──────────┐
                                     │Inactive  │────────────────────►│ Uninstalled│
                                     └──────────┘                     └──────────┘

状态说明:
┌─────────────┬────────────────────────────────────────────────────────────┐
│ 状态        │ 说明                                                       │
├─────────────┼────────────────────────────────────────────────────────────┤
│ Available   │ 插件已在市场可用，等待下载                                 │
│ Downloaded  │ 插件包已下载，等待安装                                     │
│ Installed   │ 插件已安装但未激活                                         │
│ Active      │ 插件已激活，正在运行                                       │
│ Configured  │ 插件已配置，可重新激活应用配置                             │
│ Inactive    │ 插件已禁用，保留数据和配置                                 │
│ Uninstalled │ 插件已卸载，清理所有数据                                   │
└─────────────┴────────────────────────────────────────────────────────────┘
```

### 生命周期事件

| 事件 | 触发时机 | 回调方法 | 可取消 |
|------|----------|----------|--------|
| onInstall | 安装时 | `onInstall(ctx)` | 是 |
| onActivate | 激活时 | `onActivate(ctx)` | 是 |
| onConfigure | 配置变更 | `onConfigure(config)` | 否 |
| onDeactivate | 禁用时 | `onDeactivate(ctx)` | 否 |
| onUninstall | 卸载时 | `onUninstall(ctx)` | 是 |

---

## 6. 插件注册表

### 6.1 插件注册表 Schema

```yaml
# 插件注册表存储结构
apiVersion: v1
kind: ConfigMap
metadata:
  name: orion-plugin-registry
  namespace: orion-system
data:
  registry.yaml: |
    # 已安装插件
    installed_plugins:
      - name: custom-security-scan
        version: 1.0.0
        type: custom_task
        status: active
        installed_at: 2026-04-10T10:00:00Z
        config:
          scan_level: full
          timeout_minutes: 60
      
      - name: github-webhook-handler
        version: 1.0.0
        type: webhook_handler
        status: active
        installed_at: 2026-04-10T10:00:00Z
        config:
          webhook_secret: ${GITHUB_WEBHOOK_SECRET}
      
      - name: code-review-skill
        version: 2.0.0
        type: ai_skill
        status: active
        installed_at: 2026-04-10T10:00:00Z
        config:
          model: qwen-3
          max_tokens: 4096
    
    # 可用插件市场
    marketplace:
      - name: jira-integration
        version: 1.0.0
        type: webhook_handler
        description: Jira 集成插件
        author: community
        download_url: https://plugins.orion.internal/jira-integration-1.0.0.tar.gz
      
      - name: slack-notification
        version: 1.0.0
        type: notification_channel
        description: Slack 通知渠道
        author: community
        download_url: https://plugins.orion.internal/slack-notification-1.0.0.tar.gz
```

---

## 7. 插件沙箱机制

### 7.1 沙箱架构

```typescript
interface SandboxConfig {
  // 资源限制
  resourceLimits: {
    maxMemoryMB: number;        // 最大内存 (默认 256MB)
    maxCpuPercent: number;      // 最大 CPU 使用率 (默认 10%)
    maxDiskMB: number;          // 最大磁盘使用 (默认 100MB)
    maxNetworkBandwidthMbps: number; // 最大网络带宽
  };
  
  // 超时控制
  timeouts: {
    startupTimeoutMs: number;   // 启动超时 (默认 30s)
    executionTimeoutMs: number; // 执行超时 (默认 60s)
    idleTimeoutMs: number;      // 空闲超时 (默认 5m)
  };
  
  // 权限隔离
  isolation: {
    networkPolicy: NetworkPolicy;
    fileAccess: FileAccessPolicy;
    apiAccess: ApiAccessPolicy;
  };
}

interface NetworkPolicy {
  allowOutbound: boolean;
  allowedHosts: string[];
  blockedHosts: string[];
  allowedPorts: number[];
}

interface FileAccessPolicy {
  allowedPaths: string[];
  readOnlyPaths: string[];
  blockedPaths: string[];
}

interface ApiAccessPolicy {
  allowedApis: string[];
  rateLimit: {
    requestsPerSecond: number;
    burstSize: number;
  };
}
```

### 7.2 错误隔离

```typescript
interface ErrorHandler {
  // 插件错误分类
  classifyError(error: Error): PluginErrorType;
  
  // 错误恢复
  recover(error: PluginError, context: PluginContext): Promise<RecoveryAction>;
  
  // 错误报告
  report(error: PluginError, context: PluginContext): Promise<void>;
}

type PluginErrorType = 
  | 'timeout'
  | 'resource_exhausted'
  | 'permission_denied'
  | 'invalid_input'
  | 'internal_error'
  | 'external_service_error'
  | 'cancelled';

interface RecoveryAction {
  type: 'retry' | 'fallback' | 'circuit_break' | 'isolate';
  retryCount?: number;
  retryDelayMs?: number;
  fallbackValue?: any;
}

// 熔断器
interface CircuitBreaker {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureTime?: Date;
  
  canExecute(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
  reset(): void;
}
```

---

## 8. 验收标准

- [ ] Protobuf 接口定义通过评审
- [ ] Plugin Gateway 支持 gRPC 路由
- [ ] WASM Runtime 能运行示例插件
- [ ] Container Runtime 能部署容器插件
- [ ] Python SDK 能开发并运行插件
- [ ] TypeScript SDK 能开发并运行插件
- [ ] 示例插件（Semgrep/k6）能正常执行
- [ ] 插件市场能展示和安装插件

---

## 9. Revisit 条件

- WASM 性能不满足要求，需重新评估纯容器方案
- 插件开发者反馈 SDK 难用，需改进开发体验
- 安全团队要求更高隔离级别，需考虑 VM 方案

---

_文档版本：v3.0 (合并 ADR-002/ADR-008/ADR-011)_
_创建日期：2026-04-10_
_状态：已批准，可进入开发_
