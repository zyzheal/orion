# Event Schema Registry Design (事件 Schema 注册表设计)

> 版本：v1.0 | 创建日期：2026-04-10 | 状态：待评审  
> 所属模块：M24-事件总线 | 优先级：P1  
> 作者：Orion Architecture Team | 评审人：架构委员会

---

## 执行摘要 (Executive Summary)

本设计文档详细描述 Orion 平台事件 Schema 注册表（Event Schema Registry）的架构设计与实现方案。作为 NATS 事件总线的核心支撑组件，Schema 注册表负责管理所有事件的结构定义、版本演进和兼容性保障。

### 设计背景

随着 Orion 平台事件驱动架构的深入应用，事件类型已达 40+ 种，涉及 26 个核心模块。缺乏统一的 Schema 管理导致以下问题：

| 问题 | 现状 | 影响 |
|------|------|------|
| **格式不统一** | 各模块自行定义事件结构 | 消费者解析成本高 |
| **版本混乱** | 无版本标识或版本标识不一致 | 兼容性无法保障 |
| **演进随意** | 字段增删无审核流程 | 消费者频繁失败 |
| **发现困难** | 无集中注册中心 | 新集成方难以查找事件定义 |

### 设计目标

| 目标 | 说明 | 衡量指标 |
|------|------|---------|
| **统一事件格式** | 基于 CloudEvents v1.0 规范，定义 Orion 扩展字段 | 100% 事件遵循规范 |
| **版本可控演进** | 支持 BACKWARD/FORWARD/FULL 三种兼容性规则 | 兼容性破坏零发生 |
| **流程化管理** | 注册→审核→发布→废弃全流程管理 | 变更可追溯 |
| **消费者保障** | 多版本并行、迁移窗口、自动通知 | 消费者无感知升级 |

### 核心设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **架构模式** | 中心化注册表 | 统一管理、强制校验、全局可视 |
| **Schema 格式** | JSON Schema + Protobuf 双格式 | 兼容 REST 和 gRPC 场景 |
| **版本策略** | 语义化版本 + 兼容性规则 | 清晰表达变更影响 |
| **存储方案** | PostgreSQL + 本地缓存 | 强一致性 + 高性能读取 |

---

## 一、架构设计 (Architecture Design)

### 1.1 架构模式选择

#### 1.1.1 中心化 vs 去中心化对比

| 维度 | 中心化 (Centralized) | 去中心化 (Decentralized) | 选择 |
|------|---------------------|-------------------------|------|
| **一致性** | 全局一致，单点真实源 | 最终一致，可能存在差异 | ✅ 中心化 |
| **可用性** | 单点故障风险 | 天然高可用 | ⚠️ 需冗余部署 |
| **扩展性** | 写瓶颈，读可缓存 | 写分散，读需同步 | ✅ 读多写少场景适合 |
| **治理成本** | 集中审核，质量可控 | 分散管理，质量参差不齐 | ✅ 中心化 |
| **发现性** | 集中检索，易于发现 | 分散存储，发现困难 | ✅ 中心化 |
| **部署复杂度** | 需独立服务 | 嵌入各服务 | ⚠️ 需额外服务 |

#### 1.1.2 选择理由

Orion 平台选择 **中心化注册表** 架构，理由如下：

1. **治理优先**：事件作为平台级契约，需要集中审核保障质量
2. **读多写少**：Schema 注册频率低（周级），查询频率高（秒级）
3. **强一致性需求**：消费者需获取准确的 Schema 版本
4. **发现性要求**：新集成方需要一站式查找所有事件定义

### 1.2 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Orion Schema Registry Architecture                     │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │  管理控制台     │
                                    │  (Web Console)  │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   API Gateway   │
                                    │  (Kong/Traefik) │
                                    └────────┬────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         │                                   │                                   │
         ▼                                   ▼                                   ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│  Schema         │             │   Compatibility │             │   Version       │
│  Registry API   │             │   Checker       │             │   Manager       │
│                 │             │                 │             │                 │
│ • Register      │             │ • Backward      │             │ • Versioning    │
│ • Update        │             │ • Forward       │             │ • Deprecation   │
│ • Get           │             │ • Full          │             │ • Migration     │
│ • List          │             │ • Custom Rules  │             │ • Rollback      │
│ • Search        │             │                 │             │                 │
└────────┬────────┘             └────────┬────────┘             └────────┬────────┘
         │                               │                               │
         └───────────────────────────────┼───────────────────────────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │   Event Bus     │
                                │   (NATS)        │
                                │                 │
                                │ • schema.registered    │
                                │ • schema.updated       │
                                │ • schema.deprecated    │
                                └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │  Change Notifier│
                                │                 │
                                │ • Webhook 推送   │
                                │ • 邮件通知       │
                                └────────┬────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         │                               │                               │
         ▼                               ▼                               ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│   生产者服务    │             │   消费者服务    │             │   可观测性      │
│   (Producers)   │             │   (Consumers)   │             │   (Observability)│
│                 │             │                 │             │                 │
│ • 注册 Schema   │             │ • 订阅变更通知  │             │ • 审计日志      │
│ • 发布事件      │             │ • 获取新版本    │             │ • 指标监控      │
│ • 版本升级      │             │ • 兼容性检查    │             │ • 告警通知      │
└─────────────────┘             └─────────────────┘             └─────────────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │   PostgreSQL    │
                                │   (Primary DB)  │
                                │                 │
                                │ • schemas 表     │
                                │ • versions 表    │
                                │ • compatibility  │
                                └─────────────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │     Redis       │
                                │   (L1 Cache)    │
                                │                 │
                                │ • Schema 缓存   │
                                │ • 版本索引缓存  │
                                └─────────────────┘
```

### 1.3 组件职责

| 组件 | 职责 | 关键功能 |
|------|------|---------|
| **Schema Registry API** | Schema CRUD 操作 | 注册、更新、查询、搜索、版本管理 |
| **Compatibility Checker** | 兼容性校验 | 执行兼容性规则、阻止破坏性变更 |
| **Version Manager** | 版本生命周期管理 | 版本演进、废弃、迁移、回滚 |
| **Change Notifier** | 变更通知 | Webhook 推送、邮件通知、事件发布 |
| **管理控制台** | 可视化操作界面 | Schema 浏览、审核工作流、统计分析 |

### 1.4 部署架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Schema Registry Kubernetes Deployment                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   Ingress       │
                                    │   (TLS Termination)│
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   Service       │
                                    │   schema-registry│
                                    │   Port: 443     │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
         ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
         │   Pod:          │     │   Pod:          │     │   Pod:          │
         │   schema-reg-0  │     │   schema-reg-1  │     │   schema-reg-2  │
         │                 │     │                 │     │                 │
         │ ┌─────────────┐ │     │ ┌─────────────┐ │     │ ┌─────────────┐ │
         │ │ Application │ │     │ │ Application │ │     │ │ Application │ │
         │ │ (Java/Go)   │ │     │ │ (Java/Go)   │ │     │ │ (Java/Go)   │ │
         │ └─────────────┘ │     │ └─────────────┘ │     │ └─────────────┘ │
         │ ┌─────────────┐ │     │ ┌─────────────┐ │     │ ┌─────────────┐ │
         │ │ L1 Cache    │ │     │ │ L1 Cache    │ │     │ │ L1 Cache    │ │
         │ │ (Caffeine)  │ │     │ │ (Caffeine)  │ │     │ │ (Caffeine)  │ │
         │ └─────────────┘ │     │ └─────────────┘ │     │ └─────────────┘ │
         │                 │     │                 │     │                 │
         │ Resources:      │     │ Resources:      │     │ Resources:      │
         │ CPU: 1C         │     │ CPU: 1C         │     │ CPU: 1C         │
         │ Mem: 2Gi        │     │ Mem: 2Gi        │     │ Mem: 2Gi        │
         └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
                  │                       │                       │
                  └───────────────────────┼───────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
         ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
         │  PostgreSQL     │   │     Redis       │   │     NATS        │
         │  (3 Replicas)   │   │  (Sentinel)     │   │  (JetStream)    │
         │  Primary: az-1  │   │  3 Nodes        │   │  3 Nodes        │
         │  Replica: az-2  │   │  Cluster Mode   │   │  Cluster Mode   │
         │  Replica: az-3  │   │                 │   │                 │
         └─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 二、CloudEvents 规范与 Orion 扩展 (CloudEvents Standard & Orion Extensions)

### 2.1 CloudEvents 标准采用

Orion 平台采用 **CloudEvents v1.0** 作为事件标准规范，所有事件必须遵循该规范。

#### 2.1.1 标准属性映射

| CloudEvents 属性 | 类型 | 必填 | 说明 | Orion 映射规则 |
|-----------------|------|------|------|---------------|
| `specversion` | string | 是 | CloudEvents 版本 | 固定值 `1.0` |
| `id` | string | 是 | 事件唯一标识 | UUID v4，全局唯一 |
| `source` | URI | 是 | 事件来源 | 格式：`orion/<service>/<version>` |
| `type` | string | 是 | 事件类型 | 格式：`io.orion.<domain>.<entity>.<action>.v<version>` |
| `subject` | string | 否 | 事件主题 | 业务实体标识，如 `pipeline-run-12345` |
| `time` | timestamp | 是 | 事件时间 | ISO8601 格式，UTC 时区 |
| `datacontenttype` | string | 是 | 数据类型 | 固定值 `application/json` |
| `dataschema` | URI | 否 | 数据 Schema URL | 指向 Schema Registry 中的 Schema |

#### 2.1.2 标准属性示例

```json
{
  "specversion": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "source": "orion/pipeline-engine/v1",
  "type": "io.orion.pipeline.run.started.v1",
  "subject": "pipeline-run-12345",
  "time": "2026-04-10T10:00:00Z",
  "datacontenttype": "application/json",
  "dataschema": "https://schema.orion.internal/schemas/io.orion.pipeline.run.started.v1.json"
}
```

### 2.2 Orion 扩展属性定义

为支撑 Orion 平台特性，在 CloudEvents 标准基础上扩展以下属性。

#### 2.2.1 必需扩展属性

| 属性名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| `traceid` | string | 是 | 全链路追踪 ID | `abc123-def456-ghi789` |
| `spanid` | string | 是 | 当前 Span 标识 | `span-001` |
| `tenantid` | string | 是 | 租户标识 | `tenant-alpha` |
| `priority` | string | 是 | 事件优先级 | `P0`, `P1`, `P2`, `P3` |
| `retriable` | boolean | 是 | 是否可重试 | `true`, `false` |
| `schema_version` | string | 是 | Schema 版本号 | `1.0.0`, `2.1.0` |

#### 2.2.2 可选扩展属性

| 属性名 | 类型 | 说明 | 使用场景 |
|--------|------|------|---------|
| `correlationid` | string | 关联事件 ID | 关联因果事件链 |
| `idempotency_key` | string | 幂等键 | 防止重复处理 |
| `expiration` | timestamp | 过期时间 | 定时事件、延迟事件 |
| `tags` | map | 标签键值对 | 分类、过滤、路由 |
| `producer_version` | string | 生产者版本 | 溯源、兼容性判断 |

#### 2.2.3 扩展属性示例

```json
{
  "specversion": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "source": "orion/pipeline-engine/v1",
  "type": "io.orion.pipeline.run.started.v1",
  "subject": "pipeline-run-12345",
  "time": "2026-04-10T10:00:00Z",
  "datacontenttype": "application/json",
  "dataschema": "https://schema.orion.internal/schemas/io.orion.pipeline.run.started.v1.json",
  "traceid": "abc123-def456-ghi789",
  "spanid": "span-001",
  "tenantid": "tenant-alpha",
  "priority": "P1",
  "retriable": true,
  "schema_version": "1.0.0",
  "correlationid": "correlation-xyz-789",
  "idempotency_key": "idemp-key-abc-123",
  "tags": {
    "environment": "production",
    "team": "platform",
    "criticality": "high"
  }
}
```

### 2.3 事件 Data 结构设计

事件 `data` 字段承载业务负载，遵循以下设计原则。

#### 2.3.1 通用结构

```json
{
  "data": {
    "metadata": {
      "created_by": "user@company.com",
      "created_at": "2026-04-10T10:00:00Z",
      "labels": {
        "app": "pipeline-engine",
        "version": "1.2.0"
      }
    },
    "payload": {
      ...
    },
    "context": {
      ...
    }
  }
}
```

#### 2.3.2 字段命名规范

| 规范 | 说明 | 示例 |
|------|------|------|
| **小驼峰命名** | 字段名使用小驼峰 (camelCase) | `pipelineRun`, `userId` |
| **语义化命名** | 字段名表达业务含义 | `pipelineRunId` 而非 `id` |
| **类型后缀** | 复杂对象添加类型后缀 | `pipelineRun`, `approvalRequest` |
| **时间字段** | 统一使用 `timestamp` 后缀 | `startTime`, `completedTime` |
| **状态字段** | 使用 `status` 或 `state` | `runStatus`, `approvalState` |

#### 2.3.3 数据类型规范

| 类型 | JSON 类型 | 说明 | 示例 |
|------|----------|------|------|
| 字符串 | string | UTF-8 编码 | `"user@company.com"` |
| 整数 | integer | 64 位有符号整数 | `12345` |
| 数字 | number | 双精度浮点数 | `99.99` |
| 布尔值 | boolean | true/false | `true` |
| 时间戳 | string | ISO8601 格式 | `"2026-04-10T10:00:00Z"` |
| 枚举 | string | 预定义值列表 | `"APPROVED"`, `"REJECTED"` |
| 数组 | array | 同类型元素列表 | `[1, 2, 3]` |
| 对象 | object | 嵌套结构 | `{"key": "value"}` |

### 2.4 事件类型命名规范

事件类型遵循统一命名规范，便于识别和管理。

```
io.orion.<domain>.<entity>.<action>.v<version>
```

| 组成部分 | 说明 | 命名规则 | 示例 |
|---------|------|---------|------|
| `io.orion` | 固定前缀 | 常量 | `io.orion` |
| `<domain>` | 业务域 | 小写，连字符分隔 | `pipeline`, `approval`, `deployment` |
| `<entity>` | 业务实体 | 小写，连字符分隔 | `run`, `request`, `canary` |
| `<action>` | 动作类型 | 小写，过去式 | `started`, `completed`, `failed` |
| `<version>` | 版本号 | `v` + 主版本 | `v1`, `v2`, `v3` |

#### 完整事件类型示例

| 事件类型 | 说明 |
|---------|------|
| `io.orion.pipeline.run.started.v1` | Pipeline 运行开始 |
| `io.orion.pipeline.run.completed.v1` | Pipeline 运行完成 |
| `io.orion.approval.request.created.v1` | 审批请求创建 |
| `io.orion.approval.request.approved.v1` | 审批通过 |
| `io.orion.deployment.canary.started.v1` | 灰度部署开始 |
| `io.orion.security.scan.completed.v1` | 安全扫描完成 |
| `io.orion.system.alert.triggered.v1` | 系统告警触发 |

---

## 三、Schema 版本管理策略 (Schema Versioning Strategy)

### 3.1 版本命名规范

采用 **语义化版本 (Semantic Versioning)** 规范：`MAJOR.MINOR.PATCH`

| 版本部分 | 说明 | 触发条件 | 示例 |
|---------|------|---------|------|
| **MAJOR** | 主版本号 | 不兼容的变更（破坏性变更） | `1.0.0` → `2.0.0` |
| **MINOR** | 次版本号 | 向后兼容的功能新增 | `1.0.0` → `1.1.0` |
| **PATCH** | 修订号 | 向后兼容的问题修复 | `1.0.0` → `1.0.1` |

#### 版本号变更规则

| 变更类型 | 版本变更 | 说明 |
|---------|---------|------|
| 新增可选字段 | MINOR +1 | 不影响现有消费者 |
| 新增必填字段 | MAJOR +1 | 破坏现有消费者 |
| 删除字段 | MAJOR +1 | 破坏现有消费者 |
| 修改字段类型 | MAJOR +1 | 破坏现有消费者 |
| 修改字段语义 | MAJOR +1 | 破坏现有消费者 |
| 字段重命名 | MAJOR +1 | 破坏现有消费者 |
| 新增枚举值 | MINOR +1 | 向后兼容 |
| 删除枚举值 | MAJOR +1 | 可能破坏消费者 |
| 修改字段约束 | MAJOR +1 | 可能破坏消费者 |

### 3.2 兼容性规则定义

Schema Registry 支持三种兼容性检查模式，满足不同场景需求。

#### 3.2.1 BACKWARD 兼容性

**定义**: 新版本 Schema 可以读取旧版本数据。

**检查规则**:
- 新增字段必须是可选的（有默认值）
- 不能删除已有字段（可标记为废弃）
- 不能修改已有字段的类型
- 不能收紧已有字段的约束

**适用场景**: 消费者先升级，生产者后升级（推荐模式）

**示例**:
```
旧版本 (v1.0.0):          新版本 (v1.1.0):
{                         {
  "name": string,           "name": string,
  "age": integer            "age": integer,
  "email": string          // 新增可选字段
}                         }
```

**验证结果**: ✅ 通过（BACKWARD 兼容）

#### 3.2.2 FORWARD 兼容性

**定义**: 旧版本 Schema 可以读取新版本数据。

**检查规则**:
- 不能新增必填字段
- 删除字段不影响旧版本读取
- 不能修改已有字段的类型
- 不能放宽已有字段的约束

**适用场景**: 生产者先升级，消费者后升级

**示例**:
```
旧版本 (v1.0.0):          新版本 (v1.1.0):
{                         {
  "name": string,           "name": string,
  "age": integer            // 删除 age 字段
  "email": string
}                         }
```

**验证结果**: ✅ 通过（FORWARD 兼容）

#### 3.2.3 FULL 兼容性

**定义**: 同时满足 BACKWARD 和 FORWARD 兼容性。

**检查规则**:
- 新增字段必须是可选的
- 不能删除已有字段
- 不能修改已有字段的类型
- 不能修改已有字段的约束

**适用场景**: 高可靠性要求的核心事件

**示例**:
```
旧版本 (v1.0.0):          新版本 (v1.1.0):
{                         {
  "name": string,           "name": string,
  "age": integer,           "age": integer,
  "email": string,          "email": string,
}                         "phone": string     // 新增可选字段
}                         }
```

**验证结果**: ✅ 通过（FULL 兼容）

#### 3.2.4 兼容性规则对比

| 规则 | 新增字段 | 删除字段 | 修改类型 | 适用场景 | 推荐度 |
|------|---------|---------|---------|---------|--------|
| **BACKWARD** | 可选 ✅ | ❌ | ❌ | 消费者优先升级 | ⭐⭐⭐⭐ |
| **FORWARD** | ❌ | ✅ | ❌ | 生产者优先升级 | ⭐⭐⭐ |
| **FULL** | 可选 ✅ | ❌ | ❌ | 核心事件、高可靠 | ⭐⭐⭐⭐⭐ |
| **NONE** | 任意 | 任意 | 任意 | 实验性事件 | ⭐⭐ |

### 3.3 兼容性检查算法

#### 3.3.1 字段级检查

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Compatibility Check Algorithm                  │
└─────────────────────────────────────────────────────────────────────────────────┘

输入：oldSchema, newSchema, compatibilityType (BACKWARD/FORWARD/FULL)
输出：Compatible (true/false) + Violations (list)

步骤 1: 提取字段定义
  oldFields = extractFields(oldSchema)
  newFields = extractFields(newSchema)

步骤 2: 根据兼容性类型执行检查
  IF compatibilityType == BACKWARD:
    violations = checkBackwardCompatibility(oldFields, newFields)
  ELSE IF compatibilityType == FORWARD:
    violations = checkForwardCompatibility(oldFields, newFields)
  ELSE IF compatibilityType == FULL:
    violations = checkBackwardCompatibility(oldFields, newFields)
                 + checkForwardCompatibility(oldFields, newFields)

步骤 3: 返回结果
  IF violations.isEmpty():
    RETURN Compatible = true
  ELSE:
    RETURN Compatible = false, Violations = violations
```

#### 3.3.2 BACKWARD 兼容性检查伪代码

```
function checkBackwardCompatibility(oldFields, newFields):
  violations = []
  
  FOR each field IN oldFields:
    IF field NOT IN newFields:
      violations.add("删除了已有字段：" + field.name)
    ELSE IF field.type != newFields[field.name].type:
      violations.add("修改了字段类型：" + field.name)
    ELSE IF field.required AND !newFields[field.name].required:
      violations.add("将必填字段改为可选：" + field.name)
  
  FOR each field IN newFields:
    IF field NOT IN oldFields AND field.required:
      violations.add("新增了必填字段：" + field.name)
  
  RETURN violations
```

### 3.4 兼容性配置

Schema 注册时可选择兼容性规则。

```json
{
  "schema_id": "io.orion.pipeline.run.started",
  "compatibility_type": "FULL",
  "version_policy": {
    "auto_increment": true,
    "require_review": true,
    "notify_consumers": true
  },
  "deprecation_policy": {
    "grace_period_days": 90,
    "notify_on_deprecate": true,
    "block_usage_after_expiry": false
  }
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `compatibility_type` | enum | FULL | 兼容性检查类型 |
| `auto_increment` | boolean | true | 自动递增版本号 |
| `require_review` | boolean | true | 需要人工审核 |
| `notify_consumers` | boolean | true | 变更时通知消费者 |
| `grace_period_days` | integer | 90 | 废弃后宽限期 |
| `notify_on_deprecate` | boolean | true | 废弃时通知 |
| `block_usage_after_expiry` | boolean | false | 过期后阻止使用 |

---

## 四、Schema 演进流程 (Schema Evolution Workflow)

### 4.1 演进状态机

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Evolution State Machine                        │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐
  │   DRAFT     │ ◀── 初始状态
  │   (草稿)    │
  └──────┬──────┘
         │
         │ 1. 提交审核
         ▼
  ┌─────────────┐
  │  PENDING    │
  │  REVIEW     │ ◀── 等待审核
  └──────┬──────┘
         │
         ├─── 审核通过 ───▶ ┌─────────────┐
         │                  │   ACTIVE    │
         │                  │  (已发布)   │
         │                  └──────┬──────┘
         │                         │
         │ 审核拒绝                │ 2. 标记废弃
         ▼                         ▼
  ┌─────────────┐           ┌─────────────┐
  │  REJECTED   │           │ DEPRECATED  │
  │  (已拒绝)   │           │  (已废弃)   │
  └─────────────┘           └──────┬──────┘
                                   │
                                   │ 3. 宽限期结束
                                   ▼
                            ┌─────────────┐
                            │  RETIRED    │
                            │  (已下线)   │
                            └─────────────┘
```

### 4.2 状态转移说明

| 状态 | 说明 | 允许操作 | 禁止操作 |
|------|------|---------|---------|
| **DRAFT** | 草稿状态，Schema 创建后初始状态 | 编辑、提交审核、删除 | 发布、使用 |
| **PENDING_REVIEW** | 等待审核，提交后进入此状态 | 撤回、补充说明 | 编辑、发布 |
| **ACTIVE** | 已发布，可供生产使用 | 发布新版本、标记废弃、查看 | 编辑（需新版本） |
| **DEPRECATED** | 已废弃，不再推荐使用 | 查看、迁移指导 | 新事件使用 |
| **REJECTED** | 审核未通过 | 编辑后重新提交、删除 | 发布、使用 |
| **RETIRED** | 已下线，完全移除 | 查看历史记录 | 任何使用 |

### 4.3 演进流程详解

#### 4.3.1 注册流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Registration Workflow                          │
└─────────────────────────────────────────────────────────────────────────────────┘

  角色：Schema 作者 (Schema Author)

  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
  │   本地开发      │     │   Schema        │     │   提交审核      │
  │   (Local Dev)   │     │   Registry UI   │     │   (Submit)      │
  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
           │                       │                       │
           │ 1. 编写 Schema        │                       │
           │ (JSON Schema/Protobuf)│                       │
           │──────────────────────▶│                       │
           │                       │                       │
           │                       │ 2. 格式校验           │
           │                       │ • JSON 语法           │
           │                       │ • 必填字段            │
           │                       │ • 命名规范            │
           │                       │──────────────────────▶│
           │                       │                       │
           │                       │                       │ 3. 选择兼容性规则
           │                       │                       │ • BACKWARD
           │                       │                       │ • FORWARD
           │                       │                       │ • FULL
           │                       │                       │
           │                       │                       │ 4. 设置版本策略
           │                       │                       │ • 自动递增
           │                       │                       │ • 审核要求
           │                       │                       │
           │                       │                       │ 5. 提交审核
           │                       │                       │──────────────────────▶
           │                       │                       │
           │                       │                       │ 进入 PENDING_REVIEW 状态
```

#### 4.3.2 审核流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Review Workflow                                │
└─────────────────────────────────────────────────────────────────────────────────┘

  角色：审核员 (Schema Reviewer)

  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
  │   审核通知      │     │   Schema        │     │   审核决策      │
  │   (Notification)│     │   Registry UI   │     │   (Decision)    │
  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
           │                       │                       │
           │ 1. 接收审核通知       │                       │
           │ (邮件/钉钉/企业微信)  │                       │
           │──────────────────────▶│                       │
           │                       │                       │
           │                       │ 2. 查看 Schema 详情    │
           │                       │ • 变更内容对比        │
           │                       │ • 兼容性检查结果      │
           │                       │ • 影响范围分析        │
           │                       │──────────────────────▶│
           │                       │                       │
           │                       │                       │ 3. 审核决策
           │                       │                       │
           │                       │                       │ ├── 通过 → ACTIVE
           │                       │                       │ └── 拒绝 → REJECTED
           │                       │                       │
           │◀──────────────────────────────────────────────│
           │ 4. 审核结果通知       │                       │
```

#### 4.3.3 发布流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Publication Workflow                           │
└─────────────────────────────────────────────────────────────────────────────────┘

  角色：Schema Registry 系统

  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
  │   Schema        │     │   Event Bus     │     │   消费者服务    │
  │   Registry      │     │   (NATS)        │     │   (Consumers)   │
  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
           │                       │                       │
           │ 1. Schema 审核通过     │                       │
           │ (状态：ACTIVE)        │                       │
           │                       │                       │
           │ 2. 发布 Schema 事件     │                       │
           │──────────────────────▶│                       │
           │                       │                       │
           │                       │ 3. 广播通知           │
           │                       │ Topic: schema.registered│
           │                       │──────────────────────▶│
           │                       │                       │
           │                       │                       │ 4. 消费者获取新 Schema
           │                       │                       │ (可选：主动拉取)
           │                       │                       │
           │                       │◀──────────────────────│
           │                       │ 5. 确认收到 (ACK)     │
           │◀──────────────────────│                       │
```

#### 4.3.4 废弃流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Deprecation Workflow                           │
└─────────────────────────────────────────────────────────────────────────────────┘

  角色：Schema 作者 (Schema Author)

  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
  │   废弃申请      │     │   审核员        │     │   消费者        │
  │   (Request)     │     │   (Reviewer)    │     │   (Consumers)   │
  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
           │                       │                       │
           │ 1. 提交废弃申请       │                       │
           │ (说明废弃原因)        │                       │
           │──────────────────────▶│                       │
           │                       │                       │
           │                       │ 2. 审核废弃申请       │
           │                       │ • 确认有替代版本      │
           │                       │ • 评估影响范围        │
           │                       │ • 设置宽限期          │
           │                       │──────────────────────▶│
           │                       │                       │
           │                       │ 3. 进入 DEPRECATED    │
           │                       │ 状态                  │
           │                       │                       │
           │                       │ 4. 发送废弃通知       │
           │                       │──────────────────────▶│
           │                       │                       │ 5. 消费者开始迁移
           │                       │                       │ (宽限期 90 天)
           │                       │                       │
           │                       │ 6. 宽限期结束         │
           │                       │──────────────────────▶│
           │                       │                       │
           │                       │ 7. 进入 RETIRED 状态  │
```

### 4.4 审核工作流配置

#### 4.4.1 审核规则

| 变更类型 | 审核要求 | 审核人 | 审核 SLA |
|---------|---------|--------|---------|
| 新增事件 | 必须审核 | 架构委员会 | 3 工作日 |
| MAJOR 版本变更 | 必须审核 | 架构委员会 | 3 工作日 |
| MINOR 版本变更 | 可选审核 | 团队负责人 | 1 工作日 |
| PATCH 版本变更 | 自动通过 | 系统自动 | 即时 |
| 废弃事件 | 必须审核 | 架构委员会 | 5 工作日 |
| 兼容性规则变更 | 必须审核 | 架构委员会 | 5 工作日 |

#### 4.4.2 审核清单

审核员需检查以下项目：

| 检查项 | 说明 | 验证方法 |
|--------|------|---------|
| **格式正确性** | JSON Schema 语法正确 | 自动校验 |
| **命名规范** | 符合 Orion 命名规范 | 自动校验 |
| **兼容性检查** | 通过配置的兼容性规则 | 自动校验 |
| **文档完整性** | 描述、示例、变更说明完整 | 人工检查 |
| **影响范围** | 识别受影响的消费者 | 自动分析 |
| **向后兼容** | 不破坏现有消费者 | 人工 + 自动 |
| **安全合规** | 无敏感信息泄露 | 人工检查 |

---

## 五、消费者兼容性保障 (Consumer Compatibility Assurance)

### 5.1 多版本并行策略

Schema Registry 支持同一事件的多个版本并行存在，保障消费者平滑迁移。

#### 5.1.1 版本并行架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Multi-Version Parallel Architecture                   │
└─────────────────────────────────────────────────────────────────────────────────┘

  事件类型：io.orion.pipeline.run.started

  Schema Registry:
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │  ┌─────────────────────────────────────────────────────────────────────┐   │
  │  │  Version 1.0.0 (ACTIVE)                                              │   │
  │  │  • Created: 2025-01-15                                               │   │
  │  │  • Consumers: [M1-效能看板，M5-Pipeline 引擎，M8-通知]                 │   │
  │  │  • Status: 稳定运行                                                  │   │
  │  └─────────────────────────────────────────────────────────────────────┘   │
  │                                                                             │
  │  ┌─────────────────────────────────────────────────────────────────────┐   │
  │  │  Version 2.0.0 (ACTIVE)                                              │   │
  │  │  • Created: 2026-04-01                                               │   │
  │  │  • Consumers: [M1-效能看板 (迁移中)]                                   │   │
  │  │  • Status: 迁移窗口期 (剩余 60 天)                                     │   │
  │  └─────────────────────────────────────────────────────────────────────┘   │
  │                                                                             │
  └─────────────────────────────────────────────────────────────────────────────┘

  生产者：可同时发布 v1.0.0 和 v2.0.0 格式的事件
  消费者：可订阅指定版本或订阅所有版本
```

#### 5.1.2 消费者版本绑定

消费者可通过以下方式绑定到特定版本：

| 绑定方式 | 配置示例 | 说明 |
|---------|---------|------|
| **显式订阅** | `subscribe("io.orion.pipeline.run.started.v1")` | 订阅特定版本 |
| **版本范围** | `subscribe("io.orion.pipeline.run.started.v1.x")` | 订阅主版本下的所有次版本 |
| **最新兼容** | `subscribe("io.orion.pipeline.run.started", compatible_with="1.0.0")` | 订阅与 v1.0.0 兼容的最新版本 |
| **所有版本** | `subscribe("io.orion.pipeline.run.started.>")` | 订阅所有版本（需自行处理兼容） |

### 5.2 迁移窗口管理

Schema Registry 提供迁移窗口管理功能，确保消费者有充足时间升级。

#### 5.2.1 迁移时间线

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Migration Timeline                             │
└─────────────────────────────────────────────────────────────────────────────────┘

  时间轴:
  T0          T1          T2          T3          T4          T5
  │           │           │           │           │           │
  │           │           │           │           │           │
  │  v2.0.0   │  v2.0.0   │           │  v1.0.0   │           │
  │  发布     │  迁移开始 │           │  废弃     │  v1.0.0   │
  │           │           │           │           │  下线     │
  │           │           │           │           │           │
  │◀─────────▶│           │           │◀─────────▶│           │
  │  准备期   │◀─────────────────────▶│  宽限期   │           │
  │  (7 天)    │  迁移窗口期 (90 天)     │  (30 天)   │           │
  │           │           │           │           │           │
  
  关键节点:
  • T0: v2.0.0 发布，v1.0.0 进入"即将废弃"状态
  • T1: 迁移窗口开始，消费者应开始升级
  • T2: 迁移窗口结束，v1.0.0 正式标记为 DEPRECATED
  • T3: 宽限期结束，v1.0.0 进入 RETIRED 状态
  • T4: v1.0.0 从 Registry 移除（历史可查）
```

#### 5.2.2 迁移窗口配置

| 配置项 | 默认值 | 说明 | 可配置范围 |
|--------|--------|------|-----------|
| `preparation_period_days` | 7 | 准备期天数 | 1-30 天 |
| `migration_window_days` | 90 | 迁移窗口期天数 | 30-180 天 |
| `grace_period_days` | 30 | 宽限期天数 | 7-90 天 |
| `auto_retire` | false | 是否自动下线 | true/false |

#### 5.2.3 迁移通知机制

| 时间点 | 通知对象 | 通知方式 | 通知内容 |
|--------|---------|---------|---------|
| T0 (发布时) | 所有消费者 | 邮件 + 事件 | 新版本发布、迁移指南 |
| T1 (迁移开始) | 所有消费者 | 邮件 + 事件 | 迁移窗口开启、最后期限 |
| T2 (迁移窗口结束) | 未迁移消费者 | 邮件 + 告警 | 立即迁移、影响说明 |
| T3 (宽限期结束前 7 天) | 未迁移消费者 | 邮件 + 告警 + IM | 最后警告、下线时间 |
| T4 (下线时) | 所有消费者 | 事件 | 旧版本下线确认 |

### 5.3 兼容性矩阵

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Consumer Compatibility Matrix                         │
└─────────────────────────────────────────────────────────────────────────────────┘

  场景：事件 Schema 从 v1.0.0 升级到 v2.0.0

  变更内容:
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  v1.0.0                              v2.0.0                                │
  │  {                                   {                                     │
  │    "pipelineRunId": string,            "pipelineRunId": string,             │
  │    "pipeline": string,                 "pipeline": string,                  │
  │    "branch": string,                   "branch": string,                    │
  │    "commit": string,                   "commit": string,                    │
  │    "trigger": {                        "trigger": {                         │
  │      "type": string,                     "type": string,                    │
  │      "user": string                      "user": string,                    │
  │    }                                   "userId": string,       // 新增      │
  │  }                                     "organizationId": string // 新增      │
  │                                      }                                     │
  │                                      }                                     │
  └─────────────────────────────────────────────────────────────────────────────┘

  消费者兼容性分析:
  ┌───────────────────────────┬──────────────┬──────────────┬─────────────────┐
  │  消费者                   │  当前版本    │  兼容性      │  升级建议        │
  ├───────────────────────────┼──────────────┼──────────────┼─────────────────┤
  │  M1-效能看板              │  v1.2.0      │  ✅ 兼容     │  可选升级        │
  │  M2-流水线可视化          │  v1.1.0      │  ✅ 兼容     │  可选升级        │
  │  M5-Pipeline 引擎          │  v1.0.0      │  ✅ 兼容     │  可选升级        │
  │  M8-通知协作              │  v1.0.0      │  ✅ 兼容     │  可选升级        │
  │  M11-AI 增强层            │  v0.9.0      │  ⚠️ 需测试   │  建议升级        │
  │  M17-自愈引擎            │  v0.8.0      │  ⚠️ 需测试   │  建议升级        │
  └───────────────────────────┴──────────────┴──────────────┴─────────────────┘

  兼容性说明:
  • 新增字段均为可选，BACKWARD 兼容
  • 现有消费者无需升级即可正常消费 v2.0.0 事件
  • 如需使用新增字段，消费者需升级
```

### 5.4 消费者 SDK

Schema Registry 提供客户端 SDK，简化消费者集成。

#### 5.4.1 SDK 功能

| 功能 | 说明 | API 示例 |
|------|------|---------|
| **Schema 获取** | 根据事件类型和版本获取 Schema | `client.getSchema("io.orion.pipeline.run.started", "v1")` |
| **兼容性检查** | 检查本地 Schema 与 Registry 的兼容性 | `client.checkCompatibility(localSchema)` |
| **自动更新** | 监听 Schema 变更并自动更新 | `client.subscribe("io.orion.*", onSchemaUpdate)` |
| **验证器** | 验证事件是否符合 Schema | `validator.validate(event)` |

#### 5.4.2 SDK 集成示例

```java
// 初始化 Schema Registry Client
SchemaRegistryClient client = SchemaRegistryClient.builder()
    .endpoint("https://schema-registry.orion.internal")
    .apiKey("your-api-key")
    .build();

// 获取事件 Schema
Schema schema = client.getSchema("io.orion.pipeline.run.started", "v1.0.0");

// 创建验证器
EventValidator validator = client.createValidator(schema);

// 验证事件
ValidationResult result = validator.validate(event);
if (!result.isValid()) {
    throw new InvalidEventException(result.getErrors());
}

// 订阅 Schema 变更
client.subscribe("io.orion.pipeline.*", (eventType, newSchema) -> {
    log.info("Schema updated: {} -> {}", eventType, newSchema.getVersion());
    // 更新本地验证器
});
```

---

## 六、死信队列与异常事件处理 (Dead Letter Queue & Exception Handling)

### 6.1 Schema 验证失败处理

当发布的事件不符合 Schema 时，按以下流程处理。

#### 6.1.1 验证失败流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Validation Failure Flow                        │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   生产者     │     │  Event       │     │  Schema      │     │  DLQ         │
  │   (Producer) │     │  Gateway     │     │  Validator   │     │  (Dead Letter)│
  └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
         │                    │                    │                    │
         │ 1. 发布事件        │                    │                    │
         │───────────────────▶│                    │                    │
         │                    │                    │                    │
         │                    │ 2. 提取 Schema     │                    │
         │                    │ 引用 (dataschema)  │                    │
         │                    │───────────────────▶│                    │
         │                    │                    │                    │
         │                    │                    │ 3. Schema 验证     │
         │                    │                    │ • 格式检查         │
         │                    │                    │ • 必填字段         │
         │                    │                    │ • 类型检查         │
         │                    │                    │ • 约束检查         │
         │                    │                    │                    │
         │                    │                    │ 4. 验证结果        │
         │                    │◀───────────────────│                    │
         │                    │                    │                    │
         ├─── 验证通过 ───────│                    │                    │
         │                    │                    │                    │
         │                    │ 5. 转发到 NATS     │                    │
         │                    │────────────────────────────────────────▶│
         │                    │                    │                    │
         └─── 验证失败 ──────▶│                    │                    │
                              │                    │                    │
                              │ 6. 转入 DLQ        │                    │
                              │────────────────────────────────────────▶│
                              │                    │                    │
                              │ 7. 返回错误        │                    │
                              │◀─────────────────────────────────────────│
```

#### 6.1.2 验证错误分类

| 错误类型 | 说明 | 处理建议 |
|---------|------|---------|
| `SCHEMA_NOT_FOUND` | Schema 不存在 | 检查 dataschema 引用 |
| `MISSING_REQUIRED_FIELD` | 缺少必填字段 | 补充缺失字段 |
| `INVALID_FIELD_TYPE` | 字段类型错误 | 修正字段类型 |
| `CONSTRAINT_VIOLATION` | 违反约束条件 | 检查约束（如最小值、最大长度） |
| `ENUM_VALUE_INVALID` | 枚举值无效 | 使用有效枚举值 |
| `FORMAT_INVALID` | 格式错误（如时间格式） | 修正格式 |

### 6.2 Schema 验证 DLQ

验证失败的事件转入专用 DLQ，供后续分析和处理。

#### 6.2.1 DLQ 主题设计

```
orion.dlq.schema.validation
```

#### 6.2.2 DLQ 消息结构

```json
{
  "original_event": {
    "specversion": "1.0",
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "source": "orion/pipeline-engine/v1",
    "type": "io.orion.pipeline.run.started.v1",
    ...
  },
  "validation_error": {
    "error_code": "MISSING_REQUIRED_FIELD",
    "error_message": "缺少必填字段 'pipelineRunId'",
    "field_path": "data.pipelineRunId",
    "expected_type": "string",
    "actual_value": null
  },
  "metadata": {
    "rejected_at": "2026-04-10T10:00:00Z",
    "validator_id": "validator-001",
    "schema_version": "1.0.0",
    "producer_id": "pipeline-engine-v1"
  }
}
```

#### 6.2.3 DLQ 处理策略

| 策略 | 说明 | 实现方式 |
|------|------|---------|
| **存储** | DLQ 消息持久化 30 天 | NATS JetStream + PostgreSQL |
| **告警** | 验证失败率>1% 触发告警 | Prometheus + AlertManager |
| **分析** | 定期分析失败原因 | 每日批处理任务 |
| **重试** | 支持手动重试（修复后） | 管理控制台 |
| **清理** | 30 天后自动清理 | TTL 策略 |

### 6.3 消费者处理失败

消费者处理事件失败时，按以下流程处理。

#### 6.3.1 消费者失败流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Consumer Processing Failure Flow                      │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   NATS       │     │   消费者     │     │   重试       │     │   DLQ        │
  │   JetStream  │     │   (Consumer) │     │   管理器     │     │              │
  └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
         │                    │                    │                    │
         │ 1. 投递事件        │                    │                    │
         │───────────────────▶│                    │                    │
         │                    │                    │                    │
         │                    │ 2. 业务处理        │                    │
         │                    │                    │                    │
         │                    ├─── 成功 ───────────│                    │
         │                    │ 发送 ACK           │                    │
         │                    │───────────────────▶│                    │
         │                    │                    │                    │
         │                    └─── 失败 ───────────│                    │
         │                       发送 NACK         │                    │
         │                    │───────────────────▶│                    │
         │                    │                    │                    │
         │                    │                    │ 3. 重试决策        │
         │                    │                    │ • retriable?       │
         │                    │                    │ • retry_count?     │
         │                    │                    │                    │
         │                    │                    ├─── 可重试 ─────────│
         │                    │                    │ 指数退避          │
         │                    │◀───────────────────│                    │
         │                    │                    │                    │
         │                    │                    └─── 不可重试 ───────│
         │                    │                       转入 DLQ          │
         │                    │────────────────────────────────────────▶│
```

### 6.4 异常事件监控

#### 6.4.1 监控指标

| 指标名称 | 类型 | 说明 | 告警阈值 |
|---------|------|------|---------|
| `schema_validation_total` | Counter | Schema 验证总数 | - |
| `schema_validation_failed` | Counter | 验证失败数 | 失败率>1% |
| `schema_dlq_size` | Gauge | DLQ 积压消息数 | > 100 |
| `consumer_processing_failed` | Counter | 消费者处理失败数 | 失败率>5% |
| `consumer_retry_total` | Counter | 重试总数 | 重试率>10% |

#### 6.4.2 告警规则

| 告警名称 | 触发条件 | 告警级别 | 通知方式 |
|---------|---------|---------|---------|
| `SchemaValidationHighFailureRate` | 验证失败率 > 1% (5 分钟) | P1 | 邮件 + IM |
| `SchemaDLQBacklog` | DLQ 积压 > 100 | P2 | 邮件 |
| `ConsumerHighFailureRate` | 消费失败率 > 5% (5 分钟) | P1 | 邮件 + IM |
| `ConsumerRetryStorm` | 重试率 > 10% (5 分钟) | P2 | 邮件 + IM |

---

## 七、Schema 元数据与可发现性 (Schema Metadata & Discoverability)

### 7.1 Schema 元数据模型

Schema Registry 维护丰富的元数据，支撑事件发现和治理。

#### 7.1.1 元数据结构

```json
{
  "schema_id": "io.orion.pipeline.run.started",
  "name": "Pipeline Run Started Event",
  "description": "当 Pipeline 运行时触发此事件，包含 Pipeline 的基本信息和触发源",
  "domain": "pipeline",
  "entity": "run",
  "action": "started",
  "owner": {
    "team": "platform-pipeline-team",
    "contact": "pipeline-team@company.com",
    "slack_channel": "#orion-pipeline"
  },
  "versions": [
    {
      "version": "1.0.0",
      "status": "ACTIVE",
      "created_at": "2025-01-15T10:00:00Z",
      "created_by": "zhangsan@company.com",
      "schema_url": "https://schema.orion.internal/schemas/io.orion.pipeline.run.started.v1.0.0.json",
      "compatibility_type": "BACKWARD",
      "change_description": "初始版本"
    },
    {
      "version": "1.1.0",
      "status": "ACTIVE",
      "created_at": "2026-03-01T10:00:00Z",
      "created_by": "lisi@company.com",
      "schema_url": "https://schema.orion.internal/schemas/io.orion.pipeline.run.started.v1.1.0.json",
      "compatibility_type": "BACKWARD",
      "change_description": "新增 userId 和 organizationId 字段"
    }
  ],
  "consumers": [
    {
      "service": "orion-dashboard",
      "version": "v1.2.0",
      "subscribed_version": "v1.x",
      "contact": "dashboard-team@company.com"
    },
    {
      "service": "orion-notification",
      "version": "v1.0.0",
      "subscribed_version": "v1.0.0",
      "contact": "notification-team@company.com"
    }
  ],
  "tags": ["pipeline", "lifecycle", "core"],
  "related_schemas": [
    "io.orion.pipeline.run.completed",
    "io.orion.pipeline.run.failed"
  ],
  "sla": {
    "availability": "99.9%",
    "latency_p99": "100ms"
  }
}
```

#### 7.1.2 元数据字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `schema_id` | string | 是 | Schema 唯一标识 |
| `name` | string | 是 | Schema 名称 |
| `description` | string | 是 | 详细描述 |
| `domain` | string | 是 | 业务域 |
| `owner` | object | 是 | 负责人信息 |
| `versions` | array | 是 | 版本列表 |
| `consumers` | array | 是 | 消费者清单 |
| `tags` | array | 否 | 标签 |
| `related_schemas` | array | 否 | 相关 Schema |
| `sla` | object | 否 | SLA 信息 |

### 7.2 Schema 发现机制

#### 7.2.1 搜索功能

Schema Registry 提供多维度搜索能力。

| 搜索维度 | 搜索语法 | 示例 |
|---------|---------|------|
| **事件类型** | `type:<pattern>` | `type:pipeline.*` |
| **业务域** | `domain:<domain>` | `domain:security` |
| **负责人** | `owner:<team>` | `owner:platform-team` |
| **标签** | `tag:<tag>` | `tag:lifecycle` |
| **状态** | `status:<status>` | `status:ACTIVE` |
| **创建时间** | `created:>2026-01-01` | `created:>2026-01-01` |
| **全文搜索** | `<keyword>` | `approval` |

#### 7.2.2 搜索结果

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Registry Search Results                        │
└─────────────────────────────────────────────────────────────────────────────────┘

  搜索：pipeline
  找到 5 个 Schema

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  1. io.orion.pipeline.run.started                                           │
  │     Pipeline 运行开始事件                                                     │
  │     域：pipeline | 版本：v1.0.0, v1.1.0 | 状态：ACTIVE                      │
  │     负责人：platform-pipeline-team | 消费者：3                              │
  │     标签：pipeline, lifecycle, core                                         │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  2. io.orion.pipeline.run.completed                                         │
  │     Pipeline 运行完成事件                                                     │
  │     域：pipeline | 版本：v1.0.0 | 状态：ACTIVE                              │
  │     负责人：platform-pipeline-team | 消费者：5                              │
  │     标签：pipeline, lifecycle                                               │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  3. io.orion.pipeline.run.failed                                            │
  │     Pipeline 运行失败事件                                                     │
  │     域：pipeline | 版本：v1.0.0, v2.0.0 | 状态：ACTIVE                      │
  │     负责人：platform-pipeline-team | 消费者：4                              │
  │     标签：pipeline, lifecycle, error                                        │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  4. io.orion.pipeline.stage.entered                                         │
  │     Pipeline 阶段进入事件                                                     │
  │     域：pipeline | 版本：v1.0.0 | 状态：ACTIVE                              │
  │     负责人：platform-pipeline-team | 消费者：2                              │
  │     标签：pipeline, stage                                                   │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  5. io.orion.pipeline.artifact.produced                                     │
  │     Pipeline 产物生成事件                                                     │
  │     域：pipeline | 版本：v1.0.0 | 状态：DEPRECATED                          │
  │     负责人：platform-pipeline-team | 消费者：1                              │
  │     标签：pipeline, artifact                                                │
  └─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Schema 注册表控制台

#### 7.3.1 控制台功能

| 功能模块 | 功能描述 |
|---------|---------|
| **Schema 浏览** | 查看所有已注册 Schema，支持分类、筛选、搜索 |
| **Schema 详情** | 查看 Schema 详细信息，包括版本历史、消费者清单、变更记录 |
| **Schema 注册** | 在线创建和编辑 Schema，实时校验 |
| **审核工作台** | 审核员审核 Schema 变更，查看兼容性检查结果 |
| **统计分析** | Schema 数量、变更趋势、消费者分布等统计 |
| **告警中心** | 查看和处理 Schema 相关告警 |

#### 7.3.2 控制台界面布局

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Orion Schema Registry Console                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  导航栏：首页 | Schema 浏览 | 审核工作台 | 统计分析 | 告警中心 | 设置              │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  侧边栏                     │  主内容区                                          │
│  ┌─────────────────────┐   │  ┌─────────────────────────────────────────────┐  │
│  │ 按域分类            │   │  │  Schema 详情：io.orion.pipeline.run.started  │  │
│  │ ├── pipeline (5)    │   │  │                                             │  │
│  │ ├── approval (3)    │   │  │  描述：Pipeline 运行开始事件                    │  │
│  │ ├── deployment (4)  │   │  │  负责人：platform-pipeline-team             │  │
│  │ ├── ai (6)          │   │  │  状态：ACTIVE                               │  │
│  │ ├── security (4)    │   │  │                                             │  │
│  │ └── system (5)      │   │  │  版本历史:                                  │  │
│  └─────────────────────┘   │  │  ┌──────┬───────────┬──────────┬─────────┐  │  │
│                            │  │  │版本  │ 状态      │ 创建日期 │ 兼容性 │  │  │
│  ┌─────────────────────┐   │  │  ├──────┼───────────┼──────────┼─────────┤  │  │
│  │ 快速操作            │   │  │  │v1.0.0│ ACTIVE    │2025-01-15│ BACKWARD│  │  │
│  │ + 注册新 Schema     │   │  │  │v1.1.0│ ACTIVE    │2026-03-01│ BACKWARD│  │  │
│  │ 📋 待审核 (3)       │   │  │  └──────┴───────────┴──────────┴─────────┘  │  │
│  │ ⚠️  告警 (2)        │   │  │                                             │  │
│  └─────────────────────┘   │  │  消费者清单:                                │  │
│                            │  │  • orion-dashboard (v1.2.0)                 │  │
│                            │  │  • orion-notification (v1.0.0)              │  │
│                            │  │  • orion-ai-service (v1.1.0)                │  │
│                            │  └─────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Schema 可发现性增强

#### 7.4.1 Schema 目录

Schema Registry 自动生成 Schema 目录，支持分类浏览。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Catalog                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

  Orion Schema Catalog
  └── pipeline/
      ├── run/
      │   ├── started (v1.0.0, v1.1.0)
      │   ├── completed (v1.0.0)
      │   └── failed (v1.0.0, v2.0.0)
      ├── stage/
      │   ├── entered (v1.0.0)
      │   └── completed (v1.0.0)
      └── artifact/
          └── produced (v1.0.0)
  
  └── approval/
      ├── request/
      │   ├── created (v1.0.0)
      │   └── assigned (v1.0.0)
      ├── approved (v1.0.0)
      ├── rejected (v1.0.0)
      └── timeout (v1.0.0)
  
  └── deployment/
      ├── initiated (v1.0.0)
      ├── canary/
      │   ├── started (v1.0.0)
      │   ├── progressed (v1.0.0)
      │   └── completed (v1.0.0)
      └── rolledback (v1.0.0)
  
  └── ai/
      ├── code/reviewed (v1.0.0)
      ├── risk/assessed (v1.0.0)
      ├── anomaly/detected (v1.0.0)
      ├── rootcause/analyzed (v1.0.0)
      └── model/predicted (v1.0.0)
  
  └── security/
      ├── scan/started (v1.0.0)
      ├── scan/completed (v1.0.0)
      ├── vulnerability/found (v1.0.0)
      └── audit/logged (v1.0.0)
  
  └── system/
      ├── health/changed (v1.0.0)
      ├── config/changed (v1.0.0)
      ├── alert/triggered (v1.0.0)
      └── metric/collected (v1.0.0)
```

#### 7.4.2 Schema 文档生成

Schema Registry 自动生成 Schema 文档，支持导出为 Markdown/PDF。

```markdown
# Schema 文档：io.orion.pipeline.run.started

## 基本信息
- **Schema ID**: io.orion.pipeline.run.started
- **名称**: Pipeline Run Started Event
- **描述**: 当 Pipeline 运行时触发此事件，包含 Pipeline 的基本信息和触发源
- **负责人**: platform-pipeline-team
- **联系邮箱**: pipeline-team@company.com

## 版本历史

### v1.1.0 (2026-03-01)
- **状态**: ACTIVE
- **兼容性**: BACKWARD
- **变更说明**: 新增 userId 和 organizationId 字段

### v1.0.0 (2025-01-15)
- **状态**: ACTIVE
- **兼容性**: BACKWARD
- **变更说明**: 初始版本

## Schema 定义 (v1.1.0)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "specversion": {"const": "1.0"},
    "id": {"type": "string", "format": "uuid"},
    "source": {"type": "string", "pattern": "^orion/.*"},
    "type": {"const": "io.orion.pipeline.run.started.v1"},
    "subject": {"type": "string"},
    "time": {"type": "string", "format": "date-time"},
    "datacontenttype": {"const": "application/json"},
    "data": {
      "type": "object",
      "properties": {
        "pipelineRunId": {"type": "string"},
        "pipeline": {"type": "string"},
        "branch": {"type": "string"},
        "commit": {"type": "string"},
        "trigger": {
          "type": "object",
          "properties": {
            "type": {"type": "string"},
            "user": {"type": "string"},
            "userId": {"type": "string"},
            "organizationId": {"type": "string"}
          }
        }
      },
      "required": ["pipelineRunId", "pipeline", "branch", "commit", "trigger"]
    }
  }
}
```

## 消费者清单
| 消费者 | 版本 | 订阅版本 | 联系方式 |
|--------|------|---------|---------|
| orion-dashboard | v1.2.0 | v1.x | dashboard-team@company.com |
| orion-notification | v1.0.0 | v1.0.0 | notification-team@company.com |
| orion-ai-service | v1.1.0 | v1.x | ai-team@company.com |
```

---

## 八、数据库设计 (Database Design)

### 8.1 数据模型

#### 8.1.1 schemas 表

```sql
CREATE TABLE schemas (
    id              VARCHAR(128) PRIMARY KEY,     -- Schema ID: io.orion.pipeline.run.started
    name            VARCHAR(256) NOT NULL,        -- Schema 名称
    description     TEXT NOT NULL,                -- Schema 描述
    domain          VARCHAR(64) NOT NULL,         -- 业务域
    entity          VARCHAR(64),                  -- 业务实体
    action          VARCHAR(64),                  -- 动作
    owner_team      VARCHAR(128) NOT NULL,        -- 负责团队
    owner_contact   VARCHAR(256) NOT NULL,        -- 负责人联系方式
    compatibility_type VARCHAR(32) DEFAULT 'BACKWARD', -- 兼容性类型
    status          VARCHAR(32) DEFAULT 'DRAFT',  -- 状态
    tags            JSONB,                        -- 标签
    related_schemas JSONB,                        -- 相关 Schema
    created_at      TIMESTAMPTZ DEFAULT NOW(),    -- 创建时间
    updated_at      TIMESTAMPTZ DEFAULT NOW(),    -- 更新时间
    created_by      VARCHAR(128),                 -- 创建人
    updated_by      VARCHAR(128),                 -- 更新人
    
    -- 索引
    INDEX idx_domain (domain),
    INDEX idx_status (status),
    INDEX idx_tags (tags),
    INDEX idx_created_at (created_at DESC)
);
```

#### 8.1.2 schema_versions 表

```sql
CREATE TABLE schema_versions (
    id              BIGSERIAL PRIMARY KEY,        -- 自增 ID
    schema_id       VARCHAR(128) NOT NULL,        -- Schema ID (外键)
    version         VARCHAR(32) NOT NULL,         -- 版本号：1.0.0
    version_major   INTEGER NOT NULL,             -- 主版本
    version_minor   INTEGER NOT NULL,             -- 次版本
    version_patch   INTEGER NOT NULL,             -- 修订号
    status          VARCHAR(32) NOT NULL,         -- 状态
    schema_content  JSONB NOT NULL,               -- Schema 内容
    dataschema_url  VARCHAR(512),                 -- DataSchema URL
    compatibility_type VARCHAR(32),               -- 兼容性类型
    change_description TEXT,                      -- 变更说明
    created_at      TIMESTAMPTZ DEFAULT NOW(),    -- 创建时间
    created_by      VARCHAR(128),                 -- 创建人
    reviewed_at     TIMESTAMPTZ,                  -- 审核时间
    reviewed_by     VARCHAR(128),                 -- 审核人
    
    -- 唯一约束
    UNIQUE (schema_id, version),
    
    -- 外键
    FOREIGN KEY (schema_id) REFERENCES schemas(id) ON DELETE CASCADE,
    
    -- 索引
    INDEX idx_schema_version (schema_id, version),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at DESC)
);
```

#### 8.1.3 schema_consumers 表

```sql
CREATE TABLE schema_consumers (
    id              BIGSERIAL PRIMARY KEY,
    schema_id       VARCHAR(128) NOT NULL,
    service_name    VARCHAR(128) NOT NULL,        -- 消费者服务名称
    service_version VARCHAR(32) NOT NULL,         -- 消费者版本
    subscribed_version VARCHAR(32),               -- 订阅的 Schema 版本
    contact         VARCHAR(256),                 -- 联系方式
    status          VARCHAR(32) DEFAULT 'ACTIVE', -- 状态
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- 唯一约束
    UNIQUE (schema_id, service_name),
    
    -- 外键
    FOREIGN KEY (schema_id) REFERENCES schemas(id) ON DELETE CASCADE,
    
    -- 索引
    INDEX idx_schema (schema_id),
    INDEX idx_service (service_name)
);
```

#### 8.1.4 schema_audit_logs 表

```sql
CREATE TABLE schema_audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    schema_id       VARCHAR(128) NOT NULL,
    version         VARCHAR(32),                  -- 可选：关联版本
    action          VARCHAR(64) NOT NULL,         -- 操作类型
    actor           VARCHAR(128) NOT NULL,        -- 操作人
    details         JSONB,                        -- 操作详情
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- 外键
    FOREIGN KEY (schema_id) REFERENCES schemas(id) ON DELETE CASCADE,
    
    -- 索引
    INDEX idx_schema (schema_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at DESC)
);
```

### 8.2 缓存策略

Schema Registry 采用多级缓存策略，提升读取性能。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Schema Registry Cache Architecture                    │
└─────────────────────────────────────────────────────────────────────────────────┘

  读取请求流程:
  
  Client Request
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  L1 Cache: Caffeine (本地缓存)                                              │
  │  • Schema 内容 (按版本)                                                      │
  │  • Schema 元数据                                                             │
  │  • TTL: 5 分钟                                                                │
  │  • 命中率：~90%                                                              │
  └─────────────────────────────────────────────────────────────────────────────┘
       │ (未命中)
       ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  L2 Cache: Redis (分布式缓存)                                               │
  │  • Schema 内容 (按版本)                                                      │
  │  • Schema 元数据                                                             │
  │  • Schema 搜索索引                                                           │
  │  • TTL: 30 分钟                                                               │
  │  • 命中率：~95%                                                              │
  └─────────────────────────────────────────────────────────────────────────────┘
       │ (未命中)
       ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  PostgreSQL (持久化存储)                                                    │
  │  • schemas 表                                                                │
  │  • schema_versions 表                                                        │
  │  • schema_consumers 表                                                       │
  │  • schema_audit_logs 表                                                      │
  └─────────────────────────────────────────────────────────────────────────────┘
  
  缓存更新策略:
  • Schema 变更时，主动失效相关缓存
  • 后台定时任务刷新热点 Schema
  • 缓存穿透保护：空值也缓存 (短 TTL)
```

---

## 九、API 设计 (API Design)

### 9.1 Schema 管理 API

#### 9.1.1 注册 Schema

```http
POST /api/v1/schemas
Content-Type: application/json

{
  "schema_id": "io.orion.pipeline.run.started",
  "name": "Pipeline Run Started Event",
  "description": "当 Pipeline 运行时触发此事件",
  "domain": "pipeline",
  "compatibility_type": "BACKWARD",
  "schema": {...}
}
```

#### 9.1.2 获取 Schema

```http
GET /api/v1/schemas/{schema_id}/versions/{version}
```

#### 9.1.3 列出所有 Schema

```http
GET /api/v1/schemas?domain=pipeline&status=ACTIVE
```

#### 9.1.4 更新 Schema

```http
PUT /api/v1/schemas/{schema_id}/versions
Content-Type: application/json

{
  "version": "1.1.0",
  "schema": {...},
  "change_description": "新增 userId 字段",
  "compatibility_check": true
}
```

#### 9.1.5 废弃 Schema

```http
POST /api/v1/schemas/{schema_id}/deprecate
Content-Type: application/json

{
  "reason": "被 v2.0.0 替代",
  "replacement_version": "2.0.0",
  "grace_period_days": 90
}
```

### 9.2 兼容性检查 API

```http
POST /api/v1/schemas/{schema_id}/check-compatibility
Content-Type: application/json

{
  "target_version": "1.1.0",
  "schema": {...}
}
```

### 9.3 消费者管理 API

#### 9.3.1 注册消费者

```http
POST /api/v1/schemas/{schema_id}/consumers
Content-Type: application/json

{
  "service_name": "orion-dashboard",
  "service_version": "v1.2.0",
  "subscribed_version": "v1.x",
  "contact": "dashboard-team@company.com"
}
```

---

## 十、运维与监控 (Operations & Monitoring)

### 10.1 监控指标

#### 10.1.1 系统指标

| 指标名称 | 类型 | 说明 | 告警阈值 |
|---------|------|------|---------|
| `schema_registry_requests_total` | Counter | 请求总数 | - |
| `schema_registry_requests_latency` | Histogram | 请求延迟 | P99 > 100ms |
| `schema_registry_cache_hit_rate` | Gauge | 缓存命中率 | < 80% |
| `schema_registry_db_connections` | Gauge | 数据库连接数 | > 80% |

#### 10.1.2 业务指标

| 指标名称 | 类型 | 说明 | 告警阈值 |
|---------|------|------|---------|
| `schema_total` | Gauge | Schema 总数 | - |
| `schema_versions_total` | Gauge | 版本总数 | - |
| `schema_validation_total` | Counter | 验证总数 | - |
| `schema_validation_failed` | Counter | 验证失败数 | 失败率>1% |
| `schema_dlq_size` | Gauge | DLQ 大小 | > 100 |

### 10.2 日志记录

#### 10.2.1 审计日志

| 事件 | 日志级别 | 记录内容 |
|------|---------|---------|
| Schema 创建 | INFO | Schema ID、创建人、时间 |
| Schema 更新 | INFO | Schema ID、版本、变更内容、更新人 |
| Schema 审核 | INFO | Schema ID、审核结果、审核人 |
| Schema 废弃 | WARN | Schema ID、废弃原因、宽限期 |
| 验证失败 | WARN | Schema ID、事件 ID、失败原因 |

### 10.3 备份与恢复

#### 10.3.1 备份策略

| 数据类型 | 备份方式 | 频率 | 保留期 |
|---------|---------|------|--------|
| PostgreSQL | 全量 + 增量 | 每日 | 30 天 |
| Redis | RDB + AOF | 实时 | 7 天 |
| 配置文件 | Git | 变更时 | 永久 |

---

## 十一、附录 (Appendix)

### 11.1 术语表

| 术语 | 定义 |
|------|------|
| **Schema** | 事件结构定义，使用 JSON Schema 描述 |
| **Schema Registry** | Schema 注册表，管理所有事件 Schema 的中心化服务 |
| **Compatibility** | 兼容性，新旧 Schema 之间的数据可读性 |
| **BACKWARD** | 向后兼容，新 Schema 可读旧数据 |
| **FORWARD** | 向前兼容，旧 Schema 可读新数据 |
| **FULL** | 完全兼容，同时满足 BACKWARD 和 FORWARD |
| **DLQ** | Dead Letter Queue，死信队列 |

### 11.2 参考文档

- [CloudEvents Specification v1.0](https://github.com/cloudevents/spec/blob/v1.0/spec.md)
- [JSON Schema Specification](https://json-schema.org/specification.html)
- [Schema Registry Design Patterns](https://docs.confluent.io/platform/current/schema-registry/index.html)
- [NATS 事件总线功能设计](./NATS 事件总线功能设计.md)

### 11.3 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

### 11.4 评审记录

| 评审日期 | 评审人 | 意见 | 状态 |
|---------|--------|------|------|
| 待安排 | 架构委员会 | 待评审 | 待评审 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：待评审 | 维护团队：Orion Platform Team_
