# IaC Management Design (IaC 管理设计)

**文档版本**: v1.0  
**创建日期**: 2026-04-10  
**状态**: 设计完成  
**作者**: Orion Architecture Team  
**优先级**: P2  
**评审人**: 架构委员会 + SRE 团队

---

## 执行摘要 (Executive Summary)

本设计文档详细描述 Orion 平台的 Infrastructure as Code (IaC) 管理系统的完整架构设计方案。IaC 管理系统是 Orion 平台的核心基础设施，提供 Terraform 全生命周期管理能力，包括 Plan/Apply 流程、状态管理、AI 智能审查、模块仓库、策略检查、成本估算等关键功能。

### 设计目标总览

| 目标 | 描述 | 衡量指标 |
|------|------|---------|
| **自动化** | Terraform 操作全流程自动化 | 手动干预<5% |
| **安全性** | 内置安全策略与合规检查 | 高风险拦截率 100% |
| **可观测性** | Plan/Apply 全程可追溯 | 审计日志 100% 覆盖 |
| **成本可控** | 变更前后成本预估与告警 | 成本预估误差<10% |
| **AI 增强** | 智能风险识别与优化建议 | AI 审查准确率>90% |

---

## 一、IaC 整体架构 (IaC Overall Architecture)

### 1.1 架构定位与职责边界

IaC 管理系统在 Orion 平台中的定位是基础设施变更的统一入口与管控中心，向上承接应用部署需求，向下对接云厂商 API。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Orion Platform Architecture                               │
│                              IaC Management Layer                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   User Layer    │
                                    │  (UI/CLI/API)   │
                                    └────────┬────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              IaC Management Service                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           API Gateway Layer                              │   │
│  │                    (REST/gRPC/WebSocket Interface)                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│         ┌──────────────────────────┼──────────────────────────┐                │
│         │                          │                          │                │
│         ▼                          ▼                          ▼                │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐          │
│  │   Plan      │           │   Apply     │           │   State     │          │
│  │   Service   │           │   Service   │           │   Service   │          │
│  └──────┬──────┘           └──────┬──────┘           └──────┬──────┘          │
│         │                          │                          │                │
│         ▼                          ▼                          ▼                │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Core Engine Layer                                 │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │   │
│  │  │Terraform  │ │    AI     │ │  Policy   │ │   Cost    │ │  Module   │ │   │
│  │  │ Executor  │ │  Review   │ │  Engine   │ │ Estimator │ │ Registry  │ │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Storage Layer                                     │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │   │
│  │  │  PostgreSQL  │ │     S3       │ │    Redis     │ │    NATS      │   │   │
│  │  │  (Metadata)  │ │  (State/     │ │   (Cache/    │ │   (Event)    │   │   │
│  │  │              │ │   Plan)      │ │    Lock)     │ │              │   │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Cloud Provider Layer                                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ │
│  │  AWS Provider   │ │  Azure Provider │ │  GCP Provider   │ │  K8s Provider  │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件职责

| 组件 | 职责 | 关键技术 |
|------|------|---------|
| **API Gateway** | 统一 API 入口、认证、限流、路由 | Kong/Traefik |
| **Plan Service** | Plan 生成、预检、依赖分析、成本预估 | Terraform CLI |
| **Apply Service** | 审批门禁、执行监控、结果验证 | Workflow Engine |
| **State Service** | State 存储、版本管理、锁机制 | S3 + DynamoDB |
| **Terraform Executor** | Terraform 命令执行、输出解析 | Go + Terraform SDK |
| **AI Review** | Plan 智能分析、风险识别、优化建议 | LLM + Rule Engine |
| **Policy Engine** | OPA/Conftest 策略检查、合规验证 | OPA + Rego |
| **Cost Estimator** | 资源定价、成本预测、预算告警 | Pricing API |
| **Module Registry** | 模块注册、版本管理、依赖解析 | Git + SemVer |

### 1.3 数据流总览

```
User Request → API Gateway → Workflow Orchestrator
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
      ┌──────────┐        ┌──────────┐        ┌──────────┐
      │  Init    │        │  Plan    │        │  Apply   │
      │  Stage   │        │  Stage   │        │  Stage   │
      └────┬─────┘        └────┬─────┘        └────┬─────┘
           │                   │                    │
           ▼                   ▼                    ▼
      ┌──────────┐        ┌──────────┐        ┌──────────┐
      │Terraform │        │   AI     │        │ Approval │
      │  Init    │        │  Review  │        │  Gate    │
      └────┬─────┘        └────┬─────┘        └────┬─────┘
           │                   │                    │
           ▼                   ▼                    ▼
      ┌──────────┐        ┌──────────┐        ┌──────────┐
      │  Module  │        │  Policy  │        │Terraform │
      │ Download │        │  Check   │        │  Apply   │
      └────┬─────┘        └────┬─────┘        └────┬─────┘
           │                   │                    │
           ▼                   ▼                    ▼
      ┌──────────┐        ┌──────────┐        ┌──────────┐
      │   State  │        │   Cost   │        │  State   │
      │  Unlock  │        │Estimation│        │  Commit  │
      └──────────┘        └──────────┘        └──────────┘
```

---

## 二、Terraform 集成设计 (Terraform Integration Design)

### 2.1 集成架构总览

Terraform 集成采用"CLI 封装 + API 适配"的双层架构，既保留 Terraform 原生能力，又提供标准化的 API 接口。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Terraform Integration Architecture                        │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   IaC API       │
                                    │   (REST/gRPC)   │
                                    └────────┬────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           API Adapter Layer                                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                   │
│  │   Init API      │ │   Plan API      │ │   Apply API     │                   │
│  │   /init         │ │   /plan         │ │   /apply        │                   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                   │
│  │   State API     │ │  Workspace API  │ │  Module API     │                   │
│  │   /state        │ │   /workspace    │ │   /modules      │                   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CLI Wrapper Layer                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        Terraform CLI Wrapper                            │    │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                 │    │
│  │  │ Command       │ │ Output        │ │ Error         │                 │    │
│  │  │ Builder       │ │ Parser        │ │ Handler       │                 │    │
│  │  └───────────────┘ └───────────────┘ └───────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                      Process Manager                                    │    │
│  │  • Spawn Terraform process  • Stream stdout/stderr  • Handle timeout   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Terraform CLI (v1.6+)                                    │
│  Commands: init, plan, apply, state, workspace, modules, version, validate       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 CLI 封装设计

#### 2.2.1 命令构建器

| 命令 | 输入参数 | 输出格式 | 超时设置 |
|------|---------|---------|---------|
| `terraform init` | `-backend-config`, `-reconfigure` | JSON | 5 分钟 |
| `terraform plan` | `-out`, `-json`, `-var-file` | JSON | 10 分钟 |
| `terraform apply` | `-auto-approve`, `-json`, `-parallelism` | JSON | 30 分钟 |
| `terraform state list` | `-state` | JSON | 1 分钟 |
| `terraform state pull` | `-state` | JSON | 1 分钟 |
| `terraform state push` | `-state`, `-lock` | JSON | 2 分钟 |

#### 2.2.2 输出解析器

```
Terraform JSON Output Structure:
├── format_version (string): JSON 格式版本
├── terraform_version (string): Terraform 版本
├── variables (object): 输入变量
├── resource_changes (array): 资源变更列表
│   └── resource_change
│       ├── type (string): 资源类型
│       ├── name (string): 资源名称
│       ├── provider (string): Provider 名称
│       ├── change (object): 变更详情
│       │   ├── actions (array): 操作类型 [create/update/delete/no-op]
│       │   ├── before (object): 变更前状态
│       │   └── after (object): 变更后状态
├── configuration (object): 配置信息
└── relevant_code (object): 相关代码片段
```

#### 2.2.3 错误处理器

| 错误类型 | 错误码 | 处理策略 | 用户提示 |
|---------|--------|---------|---------|
| `BackendInitFailed` | TF-001 | 检查后端配置、网络 | "后端初始化失败，请检查配置" |
| `ProviderNotFound` | TF-002 | 自动下载 Provider | "正在下载 Provider..." |
| `StateLockFailed` | TF-003 | 重试 + 告警 | "State 文件被锁定，等待解锁" |
| `PlanValidationFailed` | TF-004 | 返回验证错误 | "Plan 验证失败：[错误详情]" |
| `ApplyFailed` | TF-005 | 回滚 + 告警 | "Apply 失败，已触发回滚" |
| `TimeoutExceeded` | TF-006 | 取消 + 清理 | "操作超时，已取消执行" |

### 2.3 API 适配设计

#### 2.3.1 REST API 定义

| API | 方法 | 路径 | 描述 |
|-----|------|------|------|
| 初始化 | POST | `/api/v1/iac/{workspace}/init` | 初始化工作空间 |
| 计划 | POST | `/api/v1/iac/{workspace}/plan` | 生成执行计划 |
| 应用 | POST | `/api/v1/iac/{workspace}/apply` | 执行变更 |
| 状态 | GET | `/api/v1/iac/{workspace}/state` | 获取当前状态 |
| 工作空间 | GET | `/api/v1/iac/workspaces` | 列出所有工作空间 |

#### 2.3.2 请求/响应示例

**Plan 请求**:
```json
{
  "workspace": "prod-web",
  "commit_sha": "abc123def456",
  "variables": { "instance_type": "m5.xlarge", "instance_count": 3 },
  "options": { "parallelism": 10, "refresh": true }
}
```

**Plan 响应**:
```json
{
  "plan_id": "plan-20260410-001",
  "status": "completed",
  "summary": { "add": 2, "change": 5, "destroy": 1 },
  "cost_estimate": { "monthly_change": 500.00, "currency": "CNY" },
  "ai_review": { "risk_score": 35, "risk_level": "MEDIUM", "issues_count": 3 },
  "policy_check": { "passed": true, "violations": [] }
}
```

### 2.4 State 存储设计

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            State Storage Architecture                            │
└─────────────────────────────────────────────────────────────────────────────────┘

  S3 Bucket: orion-terraform-states
  Path: {org}/{project}/{workspace}/state-{timestamp}-{commit}.json
  Features: SSE encryption, Versioning, Lifecycle (90d→Glacier)
  
  DynamoDB Table: orion-terraform-locks
  Schema: LockID(PK), Version(LSI), ExpiresAt, Owner, Operation
  Operations: Acquire (PutItem), Release (DeleteItem), Refresh (UpdateItem)
```

---

## 三、IaC 工作空间管理 (Workspace Management)

### 3.1 工作空间隔离模型

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Workspace Isolation Model                                │
└─────────────────────────────────────────────────────────────────────────────────┘

  Organization: Orion
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Project: Platform                                                      │
  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                    │
  │  │ Workspace    │ │ Workspace    │ │ Workspace    │                    │
  │  │ dev          │ │ staging      │ │ prod         │                    │
  │  │ - State: dev │ │ - State: stg │ │ - State: prd │                    │
  │  │ - Vars: dev  │ │ - Vars: stg  │ │ - Vars: prd  │                    │
  │  │ - Lock: ✗    │ │ - Lock: ✗    │ │ - Lock: ✓    │                    │
  │  └──────────────┘ └──────────────┘ └──────────────┘                    │
  │  Project: Payment                                                       │
  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                    │
  │  │ dev          │ │ staging      │ │ prod         │                    │
  │  └──────────────┘ └──────────────┘ └──────────────┘                    │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 环境映射关系

| 工作空间 | 环境类型 | 云账号 | VPC | 安全策略 | 审批要求 |
|---------|---------|--------|-----|---------|---------|
| `dev` | 开发 | Dev Account | Dev VPC | 宽松 | 自动通过 |
| `staging` | 测试 | Dev Account | Staging VPC | 中等 | Tech Lead |
| `prod` | 生产 | Prod Account | Prod VPC | 严格 | Tech Lead + SRE |
| `dr` | 灾备 | DR Account | DR VPC | 严格 | Tech Lead + SRE |

### 3.3 工作空间生命周期

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Request │ →   │ Create  │ →   │ Active  │ →   │ Destroy │ →   │ Deleted │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
                   │               │  │  │                       │
                   │               │  │  └─→ Update Vars         │
                   │               │  └─→ Lock State             │
                   │               └─→ Backup State              │
                   │                                             │
                   └─────────────────────────────────────────────┘
                            30 天后物理删除
```

---

## 四、Terraform Plan 流程 (Plan Workflow)

### 4.1 Plan 流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Terraform Plan Workflow                               │
└─────────────────────────────────────────────────────────────────────────────────┘

  User Request
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 1: Pre-flight Checks                                             │
  │  • Workspace exists?  • State not locked?  • User has permission?      │
  └─────────────────────────────────────────────────────────────────────────┘
       │ PASS
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 2: Dependency Check                                              │
  │  • Module dependencies resolved?  • Provider versions compatible?      │
  └─────────────────────────────────────────────────────────────────────────┘
       │ PASS
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 3: Terraform Plan Execution                                      │
  │  • terraform init -backend-config=...                                   │
  │  • terraform plan -out=tfplan -json -var-file=...                       │
  │  • terraform show -json tfplan                                          │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 4: Cost Estimation                                               │
  │  • Parse resource changes  • Query pricing API  • Calculate monthly    │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 5: AI Review                                                     │
  │  • Security  • Cost optimization  • Best practice  • Compliance        │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 6: Policy Check (OPA/Conftest)                                   │
  │  • Load policies  • Run conftest test  • Collect violations            │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  Output: Plan Result (summary, cost estimate, AI review, risk score)
```

### 4.2 预检清单

| 检查项 | 检查内容 | 失败处理 |
|--------|---------|---------|
| Workspace 存在性 | 工作空间是否已创建 | 返回 404 |
| State 锁状态 | State 是否被锁定 | 返回 409 + 锁持有者信息 |
| 用户权限 | 用户是否有 Plan 权限 | 返回 403 |
| 变量校验 | 变量类型/必填/约束 | 返回 400 + 错误详情 |
| 配置语法 | terraform validate | 返回 400 + 验证错误 |

### 4.3 依赖检查

```
Configuration Analysis
         │
         ▼
  Module Dependency Graph
  ┌─────────┐
  │  Root   │
  └────┬────┘
       │
  ┌────┴────┐
  ▼         ▼
┌──────┐  ┌──────┐
│ VPC  │  │ K8s  │
│Module│  │Module│
└──┬───┘  └──┬───┘
   │         │
   └────┬────┘
        │
        ▼
  ┌─────────┐
  │  App    │
  │ Module  │
  └─────────┘

Check Results: Circular dependency: None, Modules: All resolved, Providers: Compatible
```

---

## 五、Terraform Apply 流程 (Apply Workflow)

### 5.1 Apply 流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Terraform Apply Workflow                               │
└─────────────────────────────────────────────────────────────────────────────────┘

  User Apply Request (with plan_id)
           │
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 1: Plan Validation                                               │
  │  • Plan exists and not expired (<24h)  • Plan checksum verified        │
  └─────────────────────────────────────────────────────────────────────────┘
           │ PASS
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 2: Approval Gate                                                 │
  │  Risk Score    Approval Required                                        │
  │  ──────────────────────────────────────                                  │
  │  0-30 (LOW)    → Auto-approve                                            │
  │  31-60 (MED)   → Tech Lead                                               │
  │  61-80 (HIGH)  → Tech Lead + SRE                                         │
  │  81-100 (CRIT) → Reject, requires modification                           │
  │  Special: Prod/DB/Network change or Cost>1000 CNY → Always approve      │
  └─────────────────────────────────────────────────────────────────────────┘
           │ APPROVED
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 3: State Lock Acquisition                                        │
  │  • Acquire lock via DynamoDB  • Lock timeout: 300s                     │
  └─────────────────────────────────────────────────────────────────────────┘
           │ SUCCESS
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 4: Terraform Apply Execution                                     │
  │  • terraform apply -auto-approve -json -parallelism=10 tfplan          │
  │  • Stream logs  • Monitor progress  • Handle errors & rollback         │
  └─────────────────────────────────────────────────────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
 SUCCESS       FAILURE
  │             │
  ▼             ▼
State       Rollback
committed   Alert sent
Lock        Lock released
released    Audit logged
Notification
Audit logged
```

### 5.2 执行监控

| 监控指标 | 采集方式 | 告警阈值 | 告警级别 |
|---------|---------|---------|---------|
| 执行时长 | 计时器 | >30 分钟 | Warning |
| 资源变更数 | Plan 解析 | >100 个 | Warning |
| 错误率 | 日志分析 | >5% | Critical |
| State 大小 | S3 对象大小 | >100MB | Warning |
| 并发执行数 | 计数器 | >5 个/工作空间 | Warning |

---

## 六、State 文件管理 (State Management)

### 6.1 State 文件管理图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          State File Management Architecture                      │
└─────────────────────────────────────────────────────────────────────────────────┘

  Storage Layer
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  S3 Bucket: orion-terraform-states                                      │
  │  Path: {org}/{project}/{workspace}/state-{timestamp}-{commit}.json     │
  │  Features: SSE encryption, Versioning, Lifecycle (90d→Glacier)         │
  └─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
  Lock Management Layer
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  DynamoDB Table: orion-terraform-locks                                  │
  │  Schema: LockID(PK), Version(LSI), ExpiresAt, Owner, Operation         │
  │  Operations: Acquire (PutItem), Release (DeleteItem), Refresh (Update) │
  └─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
  Version Control Layer
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  State Version History:                                                 │
  │  ┌─────────────────────────────────────────────────────────────────┐   │
  │  │ Version │ Timestamp     │ Commit  │ Author │ Size      │        │   │
  │  ├─────────┼───────────────┼─────────┼────────┼───────────┤        │   │
  │  │ 100     │ 2026-04-10    │ abc123  │ zhang3 │ 2.5 MB    │        │   │
  │  │ 99      │ 2026-04-09    │ def456  │ li4    │ 2.4 MB    │        │   │
  │  │ 98      │ 2026-04-08    │ ghi789  │ wang5  │ 2.3 MB    │        │   │
  │  └─────────────────────────────────────────────────────────────────┘   │
  │  Operations: List/Get/Restore Versions, Export State                   │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 锁机制设计

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              State Lock Mechanism                                │
└─────────────────────────────────────────────────────────────────────────────────┘

  Request Lock → Check DynamoDB → Acquire or Return Lock Info
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
    SUCCESS                   FAILURE (Locked)
    Lock Acquired             Return Owner/ExpiresAt
         │
         │ (During operation: Refresh every 60s)
         │
         ▼
    Lock Release (DeleteItem)
```

### 6.3 State 操作 API

| API | 方法 | 路径 | 描述 |
|-----|------|------|------|
| 获取 State | GET | `/api/v1/state/{workspace}` | 获取当前 State |
| 列出资源 | GET | `/api/v1/state/{workspace}/resources` | 列出所有资源 |
| 移动资源 | POST | `/api/v1/state/{workspace}/move` | 移动资源地址 |
| 删除资源 | DELETE | `/api/v1/state/{workspace}/resources/{address}` | 从 State 删除 |
| 导入资源 | POST | `/api/v1/state/{workspace}/import` | 导入现有资源 |

---

## 七、AI 审查集成 (AI Review Integration)

### 7.1 AI 审查数据流图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AI Review Data Flow                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

  Input: Terraform Plan JSON
           │
           ▼
  Stage 1: Plan Parsing & Enrichment
  • Extract resource changes  • Enrich with project/env/policy context
           │
           ▼
  Stage 2: Rule Engine Pre-screening (Checkov/Terrascan)
  • Run static rule checks  • Identify obvious violations
           │
           ▼
  Stage 3: AI Deep Analysis (LLM)
  ┌─────────────────────────────────────────────────────────────────┐
  │ Security: sensitive info, network exposure, encryption, IAM    │
  │ Cost: before/after comparison, sizing recommendations          │
  │ Best Practice: naming, tags, version pinning                   │
  │ Compliance: 等保三级，GDPR, internal policies                  │
  └─────────────────────────────────────────────────────────────────┘
           │
           ▼
  Stage 4: Risk Scoring
  Risk Score = Σ(Issue Weight × Severity Multiplier)
  Severity: CRITICAL×10, HIGH×5, MEDIUM×2, LOW×1
  Levels: 0-30=LOW, 31-60=MED, 61-80=HIGH, 81-100=CRITICAL
           │
           ▼
  Stage 5: Generate Review Report
  { plan_id, risk_score, risk_level, issues[], cost_impact, approval_required }
```

### 7.2 审查规则库

#### 7.2.1 安全性审查规则

| 规则 ID | 规则名称 | 严重度 | 检查内容 | 修复建议 |
|--------|---------|--------|---------|---------|
| SEC-001 | 敏感信息检测 | CRITICAL | 检测明文密码/密钥/Token | 使用变量引用或 Secret 管理 |
| SEC-002 | 安全组开放 | HIGH | 检测 0.0.0.0/0 入站规则 | 限制到特定 IP 范围 |
| SEC-003 | 数据库公网访问 | HIGH | 检测 RDS 公网可达 | 禁用公网访问，使用内网 |
| SEC-004 | 存储加密 | MEDIUM | 检测 S3/EBS 未加密 | 启用服务端加密 |
| SEC-005 | IAM 权限过大 | MEDIUM | 检测 * 通配符权限 | 使用最小权限原则 |
| SEC-006 | 日志审计缺失 | LOW | 检测关键服务未开启日志 | 开启 CloudTrail/操作审计 |

#### 7.2.2 成本优化审查规则

| 规则 ID | 规则名称 | 严重度 | 检查内容 | 修复建议 |
|--------|---------|--------|---------|---------|
| COST-001 | 实例规格过大 | MEDIUM | 检测 CPU/Memory 利用率<30% | 降配到合适规格 |
| COST-002 | 闲置资源检测 | HIGH | 检测 7 天无流量资源 | 删除或缩容 |
| COST-003 | Spot 实例建议 | LOW | 检测可替换为 Spot 的场景 | 使用 Spot 实例节省成本 |
| COST-004 | 存储生命周期 | MEDIUM | 检测 S3 无生命周期配置 | 配置自动转冷存储 |
| COST-005 | 预留实例建议 | LOW | 检测长期运行实例 | 购买预留实例 |

#### 7.2.3 最佳实践审查规则

| 规则 ID | 规则名称 | 严重度 | 检查内容 | 修复建议 |
|--------|---------|--------|---------|---------|
| BP-001 | 资源命名规范 | LOW | 检测命名不符合规范 | 使用 team-env-resource 格式 |
| BP-002 | 标签完整性 | MEDIUM | 检测缺少必要标签 | 添加 team/project/env 标签 |
| BP-003 | Provider 版本锁定 | MEDIUM | 检测未锁定 Provider 版本 | 使用 version 约束 |
| BP-004 | 状态文件配置 | HIGH | 检测使用本地状态 | 配置远程后端 (S3+DynamoDB) |
| BP-005 | 模块复用 | LOW | 检测重复资源定义 | 抽取为 Terraform Module |

---

## 八、模块仓库管理 (Module Registry)

### 8.1 模块仓库架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Module Registry Architecture                            │
└─────────────────────────────────────────────────────────────────────────────────┘

  Source Control
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Git Repository: git.orion.internal/terraform-modules                   │
  │  ┌─────────────────────────────────────────────────────────────────┐   │
  │  │  Module Structure:                                               │   │
  │  │  ├── vpc/        ├── k8s-cluster/  ├── rds-instance/             │   │
  │  │  ├── s3-bucket/  └── application/                                │   │
  │  │  Versioning: Git Tags (SemVer) - v1.0.0, v1.1.0, v2.0.0         │   │
  │  └─────────────────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
  Registry Service
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Module Metadata (PostgreSQL):                                          │
  │  ┌─────────────────────────────────────────────────────────────────┐   │
  │  │ id  │ name         │ version │ source     │ created_at │        │   │
  │  ├─────┼──────────────┼─────────┼────────────┼────────────┤        │   │
  │  │ 1   │ vpc          │ 1.2.0   │ git/...    │ 2026-04-01 │        │   │
  │  │ 2   │ k8s-cluster  │ 2.0.0   │ git/...    │ 2026-03-15 │        │   │
  │  └─────────────────────────────────────────────────────────────────┘   │
  │  APIs: List/Get modules, List versions, Register, Resolve deps         │
  └─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
  Cache Layer
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  S3 Bucket: orion-terraform-modules                                     │
  │  Path: {org}/{module_name}/{version}.zip                               │
  │  Features: CDN distribution, Checksum verification (SHA256)            │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 依赖解析算法

```
Input: Module dependency graph with version constraints
         │
         ▼
  Step 1: Build Dependency Graph
  Root Module requires: vpc (>=1.0.0, <2.0.0), k8s (>=2.0.0), rds (~>1.0.0)
         │
         ▼
  Step 2: Version Resolution (SemVer)
  Available: vpc(1.0.0-2.0.0), k8s(1.5.0-2.1.0), rds(0.9.0-1.2.0)
  Resolved: vpc=1.5.0, k8s=2.0.0, rds=1.2.0
         │
         ▼
  Step 3: Conflict Detection
  If conflict → Report to user, Suggest version changes
         │
         ▼
  Output: Resolved Module Versions { vpc:1.5.0, k8s:2.0.0, rds:1.2.0 }
```

---

## 九、策略即代码 (Policy as Code)

### 9.1 策略检查流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Policy Check Flow                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

  Input: Terraform Plan JSON
           │
           ▼
  Stage 1: Load Policy Library
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Policy Sources:                                                        │
  │  • Organization Policies (global, mandatory)                           │
  │  • Team Policies (team-specific)                                       │
  │  • Project Policies (project-specific)                                 │
  │  • Environment Policies (prod/staging/dev)                             │
  │  Format: Rego (OPA)                                                     │
  └─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
  Stage 2: Run Conftest Test
  Command: conftest test tfplan.json --all-policies
  Execution: Parse Plan → Load Policies → Evaluate → Collect Violations
           │
           ▼
  Stage 3: Collect Violations
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Violation Structure:                                                   │
  │  { policy, rule, severity, message, resource, remediation }            │
  └─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
  Stage 4: Generate Report
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Policy Check Result:                                                   │
  │  Status: PASS/FAIL  Total: 25  Passed: 23  Failed: 2                   │
  │  Violations: [HIGH] security: 0.0.0.0/0, [MED] cost: missing tag       │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 策略库分类

| 策略类别 | 策略数量 | 强制执行 | 示例 |
|---------|---------|---------|------|
| 安全策略 | 15 | 是 | 禁止开放端口、强制加密 |
| 成本策略 | 8 | 否 | 标签要求、实例规格限制 |
| 合规策略 | 12 | 是 | 等保三级、GDPR |
| 最佳实践 | 10 | 否 | 命名规范、版本锁定 |

### 9.3 策略优先级

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Policy Priority Levels                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

  Priority 1: Mandatory (Blocker)
  • Security policies (data protection, network security)
  • Compliance policies (legal/regulatory requirements)
  • Effect: Plan rejected if any violation

  Priority 2: Recommended (Warning)
  • Cost optimization policies
  • Best practice policies
  • Effect: Plan proceeds with warnings

  Priority 3: Informational (Notice)
  • Style guidelines, Documentation requirements
  • Effect: Logged for visibility, no action required
```

---

## 十、成本估算 (Cost Estimation)

### 10.1 成本估算模型图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Cost Estimation Model                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

  Input: Terraform Plan (Resource Changes)
           │
           ▼
  Stage 1: Identify Resource Types
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  aws_instance → EC2      aws_rds_cluster → RDS    aws_s3_bucket → S3   │
  │  aws_lambda → Lambda     aws_eks_cluster → EKS    aws_nat_gateway → NG │
  └─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
  Stage 2: Query Unit Pricing
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Sources: Cloud Provider Price API (real-time), Local Cache (daily)    │
  │  Discounts: Reserved Instance (30-60%), Spot (70-90%), Enterprise      │
  └─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
  Stage 3: Calculate Cost
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  EC2 = Hourly Rate × Quantity × 730h/month                             │
  │  RDS = Instance Rate + Storage Rate × Capacity                         │
  │  S3 = Storage Rate × Capacity + Request Rate × Count + Transfer        │
  │  Lambda = Request Rate × Count + GB-Second Rate × Memory × Duration    │
  └─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
  Stage 4: Compare Before/After
  Current: 10,000 CNY/month  →  After: 10,500 CNY/month  →  Change: +500 (5%)
           │
           ▼
  Output: Cost Estimate Report
  { current_monthly, after_monthly, difference, change_rate, breakdown[] }
```

### 10.2 资源定价模型

| 资源类型 | 计费维度 | 单价来源 | 更新频率 |
|---------|---------|---------|---------|
| EC2 | 实例类型 + 区域 + OS | AWS Price API | 实时 |
| RDS | 实例类型 + 存储 + 区域 | AWS Price API | 实时 |
| S3 | 存储量 + 请求数 + 流量 | AWS Price API | 每日 |
| Lambda | 请求数 + GB-秒 | AWS Price API | 每日 |
| NAT Gateway | 时长 + 处理量 | AWS Price API | 每日 |

### 10.3 月度成本预测

```
Current State (本月当前):
┌─────────────────────────────────────────────────────────────────────────┐
│  Service     │  Current Cost  │  Projected    │  Variance              │
│  ──────────────────────────────────────────────────────────────────     │
│  EC2         │  5,000 CNY     │  5,200 CNY    │  +200 (4%)             │
│  RDS         │  2,000 CNY     │  2,000 CNY    │  0 (0%)                │
│  S3          │  500 CNY       │  550 CNY      │  +50 (10%)             │
│  Lambda      │  300 CNY       │  350 CNY      │  +50 (17%)             │
│  TOTAL       │  8,000 CNY     │  8,300 CNY    │  +300 (3.75%)          │
└─────────────────────────────────────────────────────────────────────────┘

After Change (变更后预测):
┌─────────────────────────────────────────────────────────────────────────┐
│  Service     │  After Cost    │  Change       │  Change Rate           │
│  ──────────────────────────────────────────────────────────────────     │
│  EC2         │  6,000 CNY     │  +800 CNY     │  +16%                  │
│  RDS         │  2,400 CNY     │  +400 CNY     │  +20%                  │
│  S3          │  570 CNY       │  +20 CNY      │  +4%                   │
│  TOTAL       │  9,520 CNY     │  +1,220 CNY   │  +14.7%                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.4 预算告警

| 告警级别 | 触发条件 | 通知方式 | 处理要求 |
|---------|---------|---------|---------|
| Warning | 成本增加>500 元/月 或>10% | 邮件 + IM | 24 小时内确认 |
| Critical | 成本增加>1000 元/月 或>20% | 邮件 + IM + 电话 | 立即处理，需审批 |
| Blocker | 成本增加>5000 元/月 或>50% | 全部渠道 | 自动阻断，需手动审批 |

---

## 十一、与流水线集成 (Pipeline Integration)

### 11.1 集成流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      IaC Management Pipeline Integration                         │
└─────────────────────────────────────────────────────────────────────────────────┘

  Git Repository (IaC Code)
           │ git push
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 1: Terraform Init & Validate                                     │
  │  • terraform init  • terraform validate                                 │
  └─────────────────────────────────────────────────────────────────────────┘
           │ Pass
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 2: Terraform Plan                                                │
  │  • terraform plan -out=tfplan  • terraform show -json > plan.json      │
  └─────────────────────────────────────────────────────────────────────────┘
           │ Plan Complete
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 3: AI Review (Custom Task)                                       │
  │  • Call AI Review Service  • Upload plan.json  • Get review report     │
  │  • Review FAIL → Stop pipeline                                         │
  └─────────────────────────────────────────────────────────────────────────┘
           │ Review Pass
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 4: Policy Check (Conftest)                                       │
  │  • Run conftest test  • Collect violations  • Policy FAIL → Stop       │
  └─────────────────────────────────────────────────────────────────────────┘
           │ Policy Pass
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 5: Approval Gate                                                 │
  │  • Check approval status  • Require approval → Wait                    │
  │  • Approval reject → Fail pipeline                                     │
  └─────────────────────────────────────────────────────────────────────────┘
           │ Approved
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 6: Terraform Apply                                               │
  │  • terraform apply -auto-approve tfplan  • Record to audit log         │
  └─────────────────────────────────────────────────────────────────────────┘
           │ Complete
           ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Stage 7: Post-Apply Validation                                         │
  │  • Verify resource state  • Run health checks  • Update CMDB           │
  └─────────────────────────────────────────────────────────────────────────┘
```

---

## 十二、总结 (Summary)

### 12.1 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| Terraform 集成 | 设计完成 | CLI 封装 + API 适配 |
| 工作空间管理 | 设计完成 | Workspace 隔离 + 环境映射 |
| Plan 流程 | 设计完成 | 预检 + 依赖检查 + 成本预估 |
| Apply 流程 | 设计完成 | 审批门禁 + 执行监控 + 结果验证 |
| State 管理 | 设计完成 | 远程存储 + 版本控制 + 锁机制 |
| AI 审查 | 设计完成 | Plan 智能分析 + 风险识别 + 优化建议 |
| 模块仓库 | 设计完成 | 模块注册 + 版本管理 + 依赖解析 |
| 策略检查 | 设计完成 | OPA/Conftest 集成 + 策略库 + 合规检查 |
| 成本估算 | 设计完成 | 资源定价 + 月度预测 + 预算告警 |
| 流水线集成 | 设计完成 | Pipeline Stage + 审批门禁 |

### 12.2 技术栈总览

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| API 层 | Go + Gin/gRPC | 高性能 API 服务 |
| 执行层 | Terraform CLI + Go SDK | Terraform 命令执行 |
| 存储层 | S3 + DynamoDB + PostgreSQL | State/锁/元数据 |
| 缓存层 | Redis | 锁 + 价格缓存 |
| 事件层 | NATS JetStream | 异步事件 |
| AI 层 | LLM API + Rule Engine | 智能审查 |
| 策略层 | OPA + Conftest | 策略检查 |

### 12.3 后续工作

| 工作项 | 优先级 | 预计工期 | 负责团队 |
|--------|--------|---------|---------|
| Terraform 集成开发 | P0 | 4 周 | 后端团队 |
| State 管理开发 | P0 | 3 周 | 后端团队 |
| AI 审查集成 | P1 | 4 周 | AI 团队 |
| 策略库建设 | P1 | 6 周 | SRE 团队 |
| 成本估算对接 | P2 | 3 周 | 后端团队 |
| 模块仓库建设 | P2 | 4 周 | 平台团队 |

### 12.4 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Terraform 版本兼容性 | 高 | 中 | 锁定 Terraform 版本，使用 TF  SDK |
| State 文件损坏 | 高 | 低 | S3 版本控制 + 定期备份 |
| AI 审查误报 | 中 | 中 | 人工复核 + 规则引擎辅助 |
| 成本估算偏差 | 中 | 中 | 定期校准价格数据 |
| 审批流程延迟 | 中 | 高 | 自动审批 + 超时升级 |

### 12.5 成功指标

| 指标 | 基线 | 目标 | 测量方式 |
|------|------|------|---------|
| Plan 生成时间 | - | <5 分钟 | 监控指标 |
| Apply 成功率 | - | >95% | 执行统计 |
| AI 审查准确率 | - | >90% | 人工抽样 |
| 高风险拦截率 | - | 100% | 审计日志 |
| 成本预估误差 | - | <10% | 实际对比 |
| 用户满意度 | - | >4.0/5.0 | 季度调研 |

---

## 附录 A：术语表

| 术语 | 定义 |
|------|------|
| **IaC** | Infrastructure as Code，基础设施即代码 |
| **Plan** | Terraform 执行计划，描述将要发生的变更 |
| **Apply** | Terraform 执行变更，将计划应用到实际基础设施 |
| **State** | Terraform 状态文件，记录当前基础设施状态 |
| **Workspace** | Terraform 工作空间，用于隔离不同环境 |
| **Provider** | Terraform 提供者，与云厂商 API 交互的插件 |
| **Module** | Terraform 模块，可复用的配置模板 |
| **OPA** | Open Policy Agent，开源策略引擎 |
| **SemVer** | Semantic Versioning，语义化版本规范 |
| **RBAC** | Role-Based Access Control，基于角色的访问控制 |
| **CIDR** | Classless Inter-Domain Routing，无类别域间路由 |
| **SSE** | Server-Side Encryption，服务端加密 |
| **LSI** | Local Secondary Index，局部二级索引 |
| **CDN** | Content Delivery Network，内容分发网络 |

## 附录 B：参考文档

| 文档 | 链接 |
|------|------|
| Terraform 官方文档 | https://developer.hashicorp.com/terraform/docs |
| OPA 官方文档 | https://www.openpolicyagent.org/docs/latest/ |
| Conftest 官方文档 | https://www.conftest.dev/ |
| AWS Pricing API | https://aws.amazon.com/pricing/ |
| IaC AI 审查流程设计 | docs/iac/IaC-AI-审查流程设计.md |
| 平台服务拆分实施设计 | docs/architecture/platform-service-split-implementation.md |

## 附录 C：变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-04-10 | Orion Architecture Team | 初始版本 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：设计完成 | 维护团队：Orion Platform Team_
