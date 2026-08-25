# Plan 42 — AI 巨型模块拆分

- **优先级**: P2
- **来源**: 全量代码扫描发现 — internal/ai/ 是系统中最大模块

## 本地证据

| 指标 | 数值 | 证据 |
|------|------|------|
| 子目录数 | 30 | `ls orion-platform-svc-go/internal/ai/` |
| Go 文件数 | 159 | `find internal/ai/ -name "*.go" -not -name "*_test*" \| wc -l` |
| 测试文件数 | 32 | `find internal/ai/ -name "*_test.go" \| wc -l` |
| 测试覆盖率 | 20% | 32/159 ≈ 20% |

### 当前子目录

```
internal/ai/
├── agents/           # AI Agent 执行
├── aiagent/          # AI Agent (重复?)
├── aicost/           # AI 成本追踪
├── aigateway/        # AI 网关
├── aireview/         # AI 代码评审
├── aisecurity/       # AI 安全
├── auto-recovery/    # 自动恢复
├── code-embedding/   # 代码嵌入
├── cost/             # 成本 (与 aicost 重复?)
├── decisions/        # AI 决策
├── degradation/      # 降级
├── gateway/          # 网关 (与 aigateway 重复?)
├── handler/          # HTTP Handler
├── inference/        # 推理
├── intelligence/     # 智能分析
├── knowledge/        # 知识库
├── llm/              # LLM 管理
├── llm-provider/     # LLM Provider
├── llm-trace/        # LLM 追踪
├── models/           # 数据模型
├── orchestration/    # 编排
├── prompt-security/  # Prompt 安全
├── repository/       # 数据访问
├── review/           # 评审 (与 aireview 重复?)
├── rule-engine/      # 规则引擎
├── security/         # 安全 (与 aisecurity 重复?)
├── semantic-search/  # 语义搜索
├── service/          # 服务层
├── skill/            # AI 技能
├── task-executor/    # 任务执行
└── vector/           # 向量数据库
```

## 问题分析

1. **命名冲突**: agents vs aiagent, aicost vs cost, aigateway vs gateway, aireview vs review, aisecurity vs security — 5 组重复命名
2. **职责混乱**: LLM 管理、Agent 执行、知识库、安全审计混杂在同一模块
3. **测试覆盖低**: 20% 覆盖率远低于系统平均
4. **编译耦合**: 任何 AI 子模块变更可能触发全部 159 文件重编译

## 拆分方案

### 目标结构: 6 个独立模块

```
internal/
├── ai-gateway/          # LLM 路由、Provider 管理、Token 限流
│   ├── handler/
│   ├── service/
│   ├── repository/
│   ├── models/
│   └── llm-provider/    # ← 来自 ai/llm-provider
│
├── ai-trace/            # LLM 调用追踪、成本分析
│   ├── handler/
│   ├── service/
│   ├── repository/
│   └── models/
│   # ← 来自 ai/llm-trace, ai/aicost, ai/cost (合并)
│
├── ai-security/         # Prompt 安全、红队评估
│   ├── handler/
│   ├── service/
│   ├── repository/
│   └── models/
│   # ← 来自 ai/prompt-security, ai/aisecurity, ai/security (合并)
│
├── ai-knowledge/        # 语义搜索、代码嵌入、向量库
│   ├── handler/
│   ├── service/
│   ├── repository/
│   └── models/
│   # ← 来自 ai/knowledge, ai/semantic-search, ai/code-embedding, ai/vector (合并)
│
├── ai-agents/           # Agent 执行、编排、任务执行
│   ├── handler/
│   ├── service/
│   ├── repository/
│   └── models/
│   # ← 来自 ai/agents, ai/aiagent, ai/orchestration, ai/task-executor,
│   #    ai/skill, ai/inference, ai/intelligence, ai/decisions (合并)
│
└── ai-shared/           # 共享模型、接口、配置
    ├── models/
    ├── interfaces/
    └── config/
    # ← 来自 ai/models, ai/repository (共享部分)
```

### 迁移步骤

#### Phase 1: 创建新模块骨架
1. 创建 6 个新模块目录结构
2. 为每个新模块创建 `service.go`, `handler.go`, `models.go`, `repository.go`
3. 更新 `router.go` 路由注册

#### Phase 2: 迁移代码 (按依赖顺序)
1. `ai-shared` (无依赖) → 迁移共享 models 和 interfaces
2. `ai-gateway` (依赖 ai-shared) → 迁移 LLM provider 和 gateway
3. `ai-trace` (依赖 ai-shared) → 迁移 trace 和 cost
4. `ai-security` (依赖 ai-shared) → 迁移 prompt-security
5. `ai-knowledge` (依赖 ai-shared) → 迁移 semantic-search 和 vector
6. `ai-agents` (依赖 ai-gateway, ai-shared) → 迁移 agents 和 orchestration

#### Phase 3: 清理旧模块
1. 删除 `internal/ai/` 中的重复子目录 (agents vs aiagent 等)
2. 更新所有 import 路径
3. 运行全量测试验证
4. 删除空的 `internal/ai/` 目录

### 路由变更

```go
// router.go 变更
// Before: 
api.Group("/ai", aiHandler.RegisterRoutes)

// After:
api.Group("/ai/gateway", aigatewayHandler.RegisterRoutes)
api.Group("/ai/trace", aitraceHandler.RegisterRoutes)
api.Group("/ai/security", aisecurityHandler.RegisterRoutes)
api.Group("/ai/knowledge", aiknowledgeHandler.RegisterRoutes)
api.Group("/ai/agents", aiagentsHandler.RegisterRoutes)
```

### 预期收益

| 指标 | 拆分前 | 拆分后 |
|------|--------|--------|
| 最大模块文件数 | 159 | ~30-40 |
| 编译时间 | 全量编译 AI | 按需编译子模块 |
| 测试覆盖 | 20% | 可独立提升到 50%+ |
| 命名冲突 | 5 组 | 0 |
| 职责清晰度 | 混乱 | 清晰分离 |
