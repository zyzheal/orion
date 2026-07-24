# AI Agent Workflow Orchestration (Agentic CI) - 设计文档

## 1. 概述

### 1.1 愿景
超越单点 AI 工具，构建多 Agent 协作框架，让 AI Agent 能够自主规划、执行、协作完成复杂开发任务——如"修复这个 bug"自动触发：复现 → 定位 → 编码 → 测试 → 提交 PR 的完整流程。

### 1.2 核心价值
- **多 Agent 协作** — 不同角色的 Agent 分工合作，每个 Agent 有专属工具集和能力边界
- **事件驱动触发** — 新 Issue、失败构建、安全告警自动触发对应 Agent 工作流
- **Human-in-the-Loop** — 敏感操作（部署、合并、生产访问）需要人工审批
- **完整审计** — Agent 每个决策都有日志记录，支持回放和复盘

### 1.3 用户角色
- **研发工程师** — 定义 Agent 任务、查看执行结果
- **Tech Lead** — 审批 Agent 的敏感操作、审查 Agent 产出
- **平台工程师** — 管理 Agent Profile、配置工具权限、监控 Agent 资源消耗

## 2. 架构设计

### 2.1 组件分解

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent Orchestration                     │
│                                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ Event       │───▶│ Agent       │───▶│ Agent           │  │
│  │ Trigger     │    │ Scheduler   │    │ Executor        │  │
│  │ (NATS)      │    │ (Planning)  │    │ (Execution)     │  │
│  └─────────────┘    └─────────────┘    └────────┬────────┘  │
│                                                  │           │
│  ┌───────────────────────────────────────────────┘           │
│  │                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Bug      │  │ Code     │  │ Test     │  │ PR           │ │
│  │ Fixer    │  │ Fixer    │  │ Writer   │  │ Submitter    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│         │             │             │             │          │
│  ┌──────▼─────────────▼─────────────▼─────────────▼──────┐  │
│  │              Plugin SPI (Tool Calling)                 │  │
│  │  Git | Build | Test | Deploy | Code Review | Query DB  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Human-in-the-Loop Approval Gateway                    │  │
│  │  (Sensitive ops require manual approval)               │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 集成点
- **事件总线 (M19)** — NATS 事件触发 Agent 工作流
- **Plugin SPI (M15)** — Agent 的工具调用接口
- **LangChain (M37)** — 编排基础
- **Neo4j (M32)** — 依赖感知的任务规划
- **审批工作台 (M3)** — Agent 操作的审批网关

## 3. 数据模型

```sql
-- Agent 定义
CREATE TABLE agent_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  role            VARCHAR(50) NOT NULL,               -- bug_fixer | code_fixer | test_writer | pr_submitter | security_patcher | doc_writer
  description     TEXT,
  tools           JSONB NOT NULL,                     -- [tool_names from Plugin SPI]
  capabilities    JSONB,                              -- {max_steps, timeout_sec, retry_count}
  constraints     JSONB,                              -- {max_tokens, allowed_branches, forbidden_operations}
  llm_config      JSONB,                              -- {model, temperature, max_tokens}
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent 工作流定义
CREATE TABLE agent_workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  description     TEXT,
  trigger_event   VARCHAR(50) NOT NULL,               -- issue_created | build_failed | security_alert | pr_requested
  trigger_filter  JSONB,                              -- Event filtering conditions
  agents          JSONB NOT NULL,                     -- Ordered list of agent_ids
  approval_gates  JSONB,                              -- Steps requiring human approval
  timeout_sec     INT DEFAULT 3600,
  max_iterations  INT DEFAULT 10,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent 运行记录
CREATE TABLE agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID REFERENCES agent_workflows(id),
  trigger_event   VARCHAR(50) NOT NULL,
  trigger_payload JSONB NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'running', -- running | completed | failed | cancelled | waiting_approval
  current_agent   UUID REFERENCES agent_profiles(id),
  current_step    INT DEFAULT 0,
  total_steps     INT NOT NULL,
  result          JSONB,                              -- Final result (PR URL, fix summary, etc.)
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  timeout_at      TIMESTAMPTZ NOT NULL,
  tenant_id       UUID
);
CREATE INDEX idx_agent_runs_workflow ON agent_runs(workflow_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);

-- Agent 决策日志
CREATE TABLE agent_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agent_profiles(id),
  step_number     INT NOT NULL,
  action          VARCHAR(50) NOT NULL,                -- read_file | write_code | run_test | create_pr | request_approval
  action_input    JSONB NOT NULL,
  action_output   JSONB,
  reasoning       TEXT,                               -- Agent's reasoning/chain of thought
  tool_result     JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_decisions_run ON agent_decisions(run_id);

-- Agent 审批记录
CREATE TABLE agent_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES agent_runs(id),
  agent_id        UUID REFERENCES agent_profiles(id),
  action          VARCHAR(50) NOT NULL,
  action_input    JSONB NOT NULL,
  reason          TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 4. API 设计

```
# Agent Profile
GET    /api/v1/agents                              # Agent 列表
POST   /api/v1/agents                              # 创建 Agent
GET/PUT/DELETE /api/v1/agents/:id                  # Agent CRUD
PATCH  /api/v1/agents/:id/toggle                   # 启用/禁用

# Workflow
GET    /api/v1/agent-workflows                     # 工作流列表
POST   /api/v1/agent-workflows                     # 创建工作流
GET/PUT/DELETE /api/v1/agent-workflows/:id         # 工作流 CRUD

# Execution
POST   /api/v1/agent-runs                            # 手动触发 (body: workflowId, triggerPayload)
GET    /api/v1/agent-runs?workflowId=&status=        # 运行历史
GET    /api/v1/agent-runs/:id                        # 运行详情
POST   /api/v1/agent-runs/:id/cancel                 # 取消运行
POST   /api/v1/agent-runs/:id/retry                  # 重试

# Decisions & Logs
GET    /api/v1/agent-runs/:id/decisions              # 决策日志
GET    /api/v1/agent-runs/:id/replay                 # 回放（重放决策序列）

# Approvals
GET    /api/v1/agent-approvals?status=               # 审批队列
GET    /api/v1/agent-approvals/:id                   # 审批详情
POST   /api/v1/agent-approvals/:id/respond           # 审批响应 (body: approved, reason)

# Marketplace
GET    /api/v1/agent-templates                       # 预置 Agent 模板
POST   /api/v1/agent-templates/:id/install           # 安装模板
```

## 5. 预置 Agent 模板

| 模板 | 角色 | 触发事件 | 工具集 | 输出 |
|------|------|----------|--------|------|
| **BugFixer** | 自动修复 Bug | Issue 创建、构建失败 | Git Read/Write、Build、Test | Fix PR |
| **SecurityPatcher** | 漏洞修补 | 安全扫描告警 | Git Read/Write、Dependency Update、Test | Security Fix PR |
| **TestGenerator** | 生成测试 | 新文件提交 | Code Analysis、Test Framework、Git | Test PR |
| **DocWriter** | 生成文档 | API 变更 | Code Analysis、Markdown Generator、Git | Doc PR |
| **PerformanceOptimizer** | 性能优化 | 性能回归告警 | Profiler、Code Analysis、Test | Optimization PR |

## 6. UI/UX 设计

### 6.1 Agent 仪表盘 (`/agents/dashboard`)
- 统计卡片：活跃 Agent 数、今日运行数、成功率、平均耗时
- 运行状态列表：工作流名称、状态、当前步骤、进度条、操作
- 审批队列：待审批操作列表（操作描述、Agent 信息、审批按钮）

### 6.2 Agent 详情 (`/agents/:id`)
- 基本信息：名称、角色、描述、启用状态
- 工具集列表：工具名称、权限级别、描述
- 能力配置：最大步数、超时、重试次数
- LLM 配置：模型选择、温度参数
- 运行历史表格

### 6.3 工作流编辑器 (`/agent-workflows/:id`)
- 可视化 DAG 编辑器：Agent 节点拖拽排列
- 节点配置面板：每个 Agent 节点的输入/输出/超时配置
- 审批门配置：标记哪些步骤需要人工审批
- 触发器配置：事件类型 + 过滤条件

### 6.4 运行详情 (`/agent-runs/:id`)
- 状态横幅：运行状态 + 进度
- 决策时间线：按步骤展示 Agent 决策（动作、输入、输出、推理过程）
- 审批记录：每个审批点的状态和审批人
- 最终结果：PR URL、修复摘要、失败原因（如有）
- 操作：取消、重试、回放决策序列

## 7. 安全与权限

| 权限 | 角色 |
|------|------|
| `agent:read` | developer, tech_lead, sre, admin |
| `agent:manage` | sre, admin |
| `agent:run` | developer, sre, admin |
| `agent:run:cancel` | sre, tech_lead, admin |
| `agent:approve` | tech_lead, sre, admin |
| `agent:template:install` | sre, admin |
| `agent:replay` | tech_lead, sre, admin |

## 8. 扩展性与性能

- **并发限制** — 每个租户同时运行的 Agent 数上限（默认 5）
- **资源隔离** — 每个 Agent 运行在独立 K8s Pod，资源配额可配置
- **超时控制** — 默认 3600s 超时，超时自动取消
- **幂等保证** — Agent 操作支持幂等重试
- **成本追踪** — 每个 Agent 运行的 Token 消耗计入 FinOps

## 9. 测试策略

- **L1 单元** — Agent 调度逻辑、决策解析、审批网关
- **L2 集成** — NATS 事件触发、Plugin SPI 工具调用、Git 操作
- **L3 E2E** — Bug 创建 → BugFixer 触发 → 复现 → 修复 → 测试 → PR 提交
- **L4 安全** — 越权操作拦截、审批门绕过防护、敏感操作审计
- **L5 性能** — 单 Agent 步骤 < 60s，5 Agent 串行 < 300s
