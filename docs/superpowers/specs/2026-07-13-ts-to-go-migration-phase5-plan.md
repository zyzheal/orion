# TS→Go 迁移 Phase 5 执行方案（第二轮评审优化版）

**日期**: 2026-07-13
**状态**: 两轮 5 专家评审完成，P0 阻塞问题已识别待解决
**评审专家**: DDD 架构师、软件架构师、算法专家、DevOps 专家、AI 专家
**当前分支**: fix/p0-route-auth-and-error-envelope

---

## 1. 当前状态

### 1.1 最新完成（本次分支）

| 模块 | 操作 | 路由数 |
|------|------|--------|
| api-governance | main.go DI + routes 注册 | ~12 |
| change-request | main.go DI + routes 注册 | ~15 |
| report-designer | main.go DI + routes 注册 | ~16 |
| oncall | main.go DI + routes 注册 + TS 归档 | ~16 |
| diagnostic | main.go DI + routes 注册 + TS 归档 | ~10 |
| backup | main.go DI + routes 注册 + TS 归档 | ~15 |
| finops | main.go DI + routes 注册 | ~8 |
| deploy-enhanced | main.go DI + routes 注册 + TS 归档 | ~15 |
| **小计** | **8 个模块** | **~107** |

### 1.2 当前全景

| 指标 | 数值 |
|------|------|
| Go platform 模块总数 | 61 |
| 已归档 TS 路由模块 (routes.ts) | 49 |
| 文件头标记 [ARCHIVED] | 54 |
| 未迁移 TS 模块 | 144 |
| 活跃 TS 路由文件 | 144 |
| go build | ✅ |
| go test | ✅ |

### 1.3 Go 模块完整性

| 状态 | 模块数 | 说明 |
|------|--------|------|
| 完整三层+注册 | 61 | handler/service/repository + main.go |
| 仅 models 空壳 | 2 | `user`（空目录）、`problem`（仅 repo+models） |
| 有代码未注册 | 2 | `api-market`、`ci-type`（handler/service/repo 完整） |

---

## 2. 两轮专家评审结果

### 2.1 评分对比

| 专家 | 首轮评分 | 第二轮评分 | 变化 | 核心问题 |
|------|---------|-----------|------|---------|
| DDD 架构师 | C+ | **B-** | ↑ 提升 | 领域边界仍有残留问题，Wave 7 大爆炸风险 |
| 软件架构师 | B | **B+/A-** | ↑ 提升 | 174 模块单体缺少规模治理策略 |
| 算法专家 | D | **D+** | ↑ 微升 | 影子模式写入不可行、双写冲突、回滚不支持 |
| DevOps 专家 | C+ | **C** | → 持平 | NOTIFICATION_TARGET 代码不存在、CI 管线缺失 |
| AI 专家 | D | **D+** | → 持平 | AI 不迁移=TS 永远无法下线、能力路线图缺失 |

### 2.2 改进确认（做得好的）

| 改进项 | 说明 |
|--------|------|
| DDD 拓扑排序 | 通用域→支撑域→核心域顺序正确 |
| 四阶段切换流程 | 概念正确，只读→影子→主备→清理 |
| AI 模块暂停迁移 | 不做错误的事，避免方向性错误 |
| 技术债务修复要求 | 内联 SQL→Repository、503 占位→完整实现 |
| 共享包设计 | SSE/cron/dag/idempotency 四个包方向合理 |

### 2.3 第二轮新增 P0 阻塞问题

**以下 9 个问题必须在 Wave 0 开始前解决，否则方案不可执行：**

| 编号 | 专家 | 问题 | 影响 |
|------|------|------|------|
| **P0-1** | 算法 | **影子模式对写入操作不成立** — TS 和 Go 同时写同一张表必然冲突，无法做"对比"。影子模式应限定为只读 GET 请求对比 | 核心切换流程存在逻辑矛盾 |
| **P0-2** | 算法 | **双写冲突零防范** — 灰度期间 TS 和 Go 并发写入同一张表，无任何互斥机制（唯一键冲突、数据覆盖、乐观锁竞争） | 数据一致性问题 |
| **P0-3** | 算法 | **Go migration 引擎不支持回滚** — `RunMigrations` 为纯正向只增模式，无 `Down()` 方法，L3 回滚方案基于不存在的能力 | 数据库回滚不可行 |
| **P0-4** | DevOps | **`NOTIFICATION_TARGET` 灰度机制代码中不存在** — API Gateway 代码中无此环境变量读取，无热重载能力。灰度方案需要重写 Gateway 代理组件 | 灰度切换不可执行 |
| **P0-5** | DevOps | **`orion-platform-svc-go` 不在任何 CI/CD 管线矩阵中** — 当前 CI 矩阵只针对 58 个独立微服务，有代码但无法自动构建和部署 | 无法自动化部署 |
| **P0-6** | DevOps | **Helm chart 不支持 liveness/readiness 分离** — `health.path` 单字段模板无法支持 `/healthz` 和 `/health` 两个路径 | 健康检查不完整 |
| **P0-7** | 架构 | **174 模块单体缺少规模治理策略** — 无模块注册表机制或微服务拆分蓝图，需要明确"最终形态还是中间态" | 长期架构不可持续 |
| **P0-8** | AI | **AI 模块全部不迁移 = TS 永远无法下线** — 至少需要确定一个下线路线图。建议将 llm-trace 迁入 platform-svc-go 作为 AI 模块切流的第一步 | TS 单体永远无法下线 |
| **P0-9** | AI | **AI 能力路线图完全缺失** — 无真实 LLM 推理（当前全部为规则模拟）、无 RAG、无向量检索。三套实现数据模型不一致 | AI 平台核心能力缺失 |

### 2.4 第二轮新增 P1 遗留问题（16 项）

| 编号 | 问题 | 归属 | 严重性 |
|------|------|------|--------|
| P1-1 | webhook 三种含义未拆分（通知/webhook、workflow-webhook、trigger-webhook） | DDD | 边界 |
| P1-2 | Wave 7 粒度过粗，70 模块/3 批=每批 23 个，回滚策略失效 | 架构+DDD | 可执行性 |
| P1-3 | HookChain 在 Wave 4 而非 Wave 1（事件响应上下文） | DDD | 归属 |
| P1-4 | ProcessStep 重复计数（Wave 4 和 Wave 7 各出现 1 次） | DDD | 数据准确 |
| P1-5 | permission-audit 和 abac-policy 在 Wave 2 和 Wave 7 重复 | DDD | 数据准确 |
| P1-6 | 遗漏模块：change-intelligence、chaos-enhanced、maintenance-window | DDD | 完整性 |
| P1-7 | Gateway 灰度需重启说明，不支持热加载 | 架构+DevOps | 可执行性 |
| P1-8 | dag 共享包应改用第三方库（如 dominikbraun/graph），不自研 | 架构 | 过度设计风险 |
| P1-9 | cron 共享包与 internal/cron/ 职责边界需明确 | 架构 | 设计 |
| P1-10 | 灰度缺少用户/租户维度哈希一致性 | 算法 | 体验 |
| P1-11 | 幂等性包未区分场景 TTL（Saga 24h vs Webhook 5min） | 算法 | 设计 |
| P1-12 | 数据审计无自动化工具和通过标准 | 算法 | 效率 |
| P1-13 | 缺少 Rolling Update 配置（maxSurge/maxUnavailable） | DevOps | 部署 |
| P1-14 | 61 模块数据库连接池总量未估算（预计 300-600 连接） | DevOps | 容量 |
| P1-15 | AI 三套实现（Python/TS/Go）数据模型不一致，无单一事实来源 | AI | 架构 |
| P1-16 | MCP 归属未定，当前完全耦合在 TS 平台服务中 | AI | 架构 |

---

## 3. P0 阻塞问题解决方案

### 3.1 P0-1：影子模式只读化

**问题**：影子模式对 POST/PUT/DELETE 不成立，TS 和 Go 同时写同一张表必然冲突。

**方案**：
- 影子模式**限定为 GET/HEAD 请求**的响应对比
- 对比引擎在 Gateway 层实现：同时转发 GET 请求到 TS 和 Go，比较响应体 JSON 哈希
- 对 POST/PUT/DELETE，改为"只读验证 + 日志审计"两级：
  - Go 端不实际写入，但验证请求参数合法性并记录到对比日志
  - 离线工具批处理对比 TS 执行结果与 Go 计划执行结果
- 如需写入对比，引入影子表（shadow table）机制：Go 写入 `table_shadow` 后缀表

### 3.2 P0-2：双写冲突防范

**问题**：灰度期间 TS 和 Go 并发写入同一张表，无互斥机制。

**方案**：
- 主备切换的前两个阶段（只读+影子），Go 端 handler 注册 `readonlyMiddleware`，拒绝非 GET 请求
- 进入主备切换阶段后，采用**全量切流**而非逐比例切流：按模块整体切换，一次只允许一个后端（TS 或 Go）写入
- 灰度只在读操作上做，写操作一次性切换
- 如需双写（如灰度期必须验证写入），引入 `_source` 列标记写入方 + last-write-wins 冲突解决策略

### 3.3 P0-3：Go migration 引擎增加回滚支持

**问题**：`RunMigrations` 为纯正向只增模式，无 `Down()` 方法。

**方案**：
- 在 `orion-go-common/pkg/database/migrate.go` 中增加 `RunMigrationsDown()` 方法
- migration 文件命名规范：`001_create_xxx_tables.sql`（正向）+ `001_create_xxx_tables_down.sql`（回滚）
- 逆向迁移支持版本号参数：`RunMigrationsDown(db, "migrations", 1)` 回滚最近 1 个版本
- 数据库迁移前向兼容规范：正向迁移只加不减（ADD COLUMN / CREATE TABLE ONLY，不 DROP / ALTER COLUMN）
- 在 Wave 0 中实现此能力

### 3.4 P0-4：Gateway 灰度机制实现

**问题**：`NOTIFICATION_TARGET` 代码中不存在，Gateway 无热重载。

**方案**：
- 短期：`orion-api-gateway/src/routes/api.ts` 增加环境变量条件判断，实现模块级目标切换
- 修改 `proxy.ts` 中的 `ProxyMiddleware` 支持动态目标选择
- 当前不支持热加载，环境变量变更后需重启 Gateway（通过 `kubectl rollout restart` 或 `helm upgrade`）
- 中期：利用 `gateway-dynamic` 模块（已在 Go 侧实现）实现运行时动态路由切换
- 灰度方案改为：`kubectl set env deployment/orion-api-gateway NOTIFICATION_TARGET=go` 触发滚动重启

### 3.5 P0-5：CI/CD 管线集成

**问题**：`orion-platform-svc-go` 不在任何 CI/CD 管线矩阵中。

**方案**：
- 在 `.github/workflows/ci.yml` 中增加 `orion-platform-svc-go` 构建目标
- 触发条件：`orion-platform-svc-go/**` 或 `orion-go-common/**` 或 `go.work` 变更
- 构建步骤：`go build -trimpath ./cmd/server` + `go test -race ./...` + `go vet ./...`
- Docker 构建：使用 `orion-platform-svc-go/Dockerfile` 构建并推送镜像
- 部署：增加 `orion-platform-svc-go` 的 Helm values.yaml 并集成到 `ci-cd.yml` 的部署矩阵

### 3.6 P0-6：Helm chart 健康检查分离

**问题**：`health.path` 单字段模板不支持 liveness/readiness 分离。

**方案**：
- 修改 `infrastructure/helm/orion-service/templates/deployment.yaml`：
  ```yaml
  livenessProbe:
    httpGet:
      path: {{ .Values.liveness.path | default "/healthz" }}
  readinessProbe:
    httpGet:
      path: {{ .Values.readiness.path | default "/health" }}
  ```
- 在 `orion-platform-svc-go` 的 values.yaml 中配置：
  ```yaml
  liveness:
    path: /healthz
    initialDelaySeconds: 15
    periodSeconds: 20
  readiness:
    path: /health
    initialDelaySeconds: 5
    periodSeconds: 10
  ```

### 3.7 P0-7：单体规模治理策略

**问题**：174 模块单体缺少规模治理策略，需明确"最终形态还是中间态"。

**方案**：
- **短期（Phase 5 期间）**：单体到底，但增加模块注册表机制——`main.go` 中的模块分组按未来拆分边界组织
- **中期（Phase 5 完成后）**：按业务域拆分为 5-8 个独立服务，候选拆分边界：
  | 拆分候选 | 包含模块 | 理由 |
  |---------|---------|------|
  | orion-platform-core | 认证/用户/权限/通知 | 安全性要求高，独立扩缩 |
  | orion-pipeline-svc | Pipeline/部署/CI/CD | 高并发执行引擎 |
  | orion-workflow-svc | 工作流/低代码/审批 | 状态机密集型 |
  | orion-observability-svc | 追踪/SLO/性能/告警 | 大量长连接(SSE) |
  | orion-ai-svc | AI 模块（含 Python） | AI 独立栈 |
- **触发条件**：二进制编译时间 > 120s 或 单体启动时间 > 10s 或 团队 > 3 个同时开发
- 在 `docs/architecture/service-split-blueprint.md` 中定义拆分蓝图

### 3.8 P0-8：AI 模块 TS 下线路线图

**问题**：AI 模块全部不迁移 = TS 永远无法下线。

**决策（2026-07-13）**：AI 三套实现（Python/TS/Go）统一汇总到 Python 权威服务 `orion-ai-service`。Go 蓝图（`orion-ai-svc-go`）作为参考实现，不独立部署。TS 路由逐步废弃。

**方案**：
- 第一步：以 Go 蓝图 `orion-ai-svc-go` 的 23 字段数据模型为基准，同步到 Python `orion-ai-service`
- 第二步：llm-trace：将 Go 版 PostgreSQL 实现移植到 Python，废弃 TS 版和 Go 蓝图版
- 第三步：ai-agent：将 Go 蓝图 `aiagent` 模块的业务逻辑移植到 Python，废弃 TS 版
- 第四步：ai-decision：Python 端 `ai_decision_routes.py` 已有 8 个端点，确认是否覆盖 TS 5 路由，如已覆盖则删除 TS 版本
- 第五步：mcp 暂留 TS，后续由 Python AI Gateway 接管协议层
- **关键原则**：Python 是 AI 的单一权威实现，Go 蓝图和 TS 路由都是过渡形态

### 3.9 P0-9：AI 能力路线图

**问题**：当前无真实 LLM 推理、无 RAG、无向量检索。

**方案**：
- Phase A：在 Python AI 服务中接入真实 LLM 推理（OpenAI/Claude API），废弃当前所有规则模拟
- Phase B：集成 pgvector 实现真实向量检索，废弃 TF-IDF 模拟
- Phase C：统一数据模型——以 Go 版为基准，同步到 Python
- Phase D：建立提示词管理系统
- 时间线：A 和 B 在 Phase 5 期间并行推进，C 和 D 在 Phase 5 之后

### 3.9 P0-9：AI 能力路线图

**问题**：当前无真实 LLM 推理、无 RAG、无向量检索。

**方案**：
- Phase A：在 Python AI 服务中接入真实 LLM 推理（OpenAI/Claude API），废弃当前所有规则模拟
- Phase B：集成 pgvector 实现真实向量检索，废弃 TF-IDF 模拟
- Phase C：统一数据模型——以 Go 版为基准，同步更新 Python 和 TS
- Phase D：建立提示词管理系统
- 时间线：A 和 B 在 Phase 5 期间并行推进，C 和 D 在 Phase 5 之后

---

## 4. P1 问题修复方案

### 4.1 DDD 维度修复

**P1-1 webhook 三义性拆分**：
- `webhook-routes.ts` → 通知上下文（Wave 3）
- `workflow-webhook-routes.ts` → 工作流上下文（Wave 4）
- `multi-modal-trigger-routes.ts` 中的 webhook 类型 → 事件触发上下文（Wave 1）

**P1-2 Wave 7 分批细化**：
- 从 3 批扩展为 5-6 批，每批上限 15 模块
- 按限界上下文分组：安全(6)、成本(3)、金丝雀(7)、数据(5)、工单(4)、社区(2)、杂项(40+)
- 杂项类进一步按功能域拆分（缓存/熔断、脚本、配置、可观测补充）

**P1-3 HookChain 移至 Wave 1**：
- HookChain 属于事件响应上下文，与 eventbus/event-trigger 同一批次

**P1-4/P1-5 重复计数清理**：
- process-step 固定在 Wave 7（工单上下文），从 Wave 4 移除
- permission-audit 和 abac-policy 固定在 Wave 2，从 Wave 7 移除

**P1-6 遗漏模块补充**：
- change-intelligence → Wave 5（Pipeline 辅助体系）
- chaos-enhanced → Wave 7a（安全子批次）
- maintenance-window → Wave 7g（可观测子批次）

### 4.2 架构维度修复

**P1-7 Gateway 灰度重启说明**：
- 明确标注：当前环境变量切换需重启 Gateway
- 短期操作：`kubectl rollout restart deployment/orion-api-gateway`
- 中期方案：`gateway-dynamic` 模块运行时动态路由

**P1-8 dag 共享包改用第三方库**：
- 使用 `github.com/dominikbraun/graph` 替代自研 DAG 实现
- 提供拓扑排序、环检测、关键路径计算能力

**P1-9 cron 共享包职责边界**：
- `go-common/pkg/cron/`：提供 `Scheduler` 接口和 `Job` 注册能力（框架层）
- `internal/cron/`：消费 `Scheduler` 来管理业务 cron 条目（业务域）
- 二者是"框架 vs 业务"的关系

### 4.3 算法维度修复

**P1-10 灰度用户/租户哈希一致性**：
- 切换到用户 ID 哈希 + 桶模型：`hash(user_id) % 100 <= CANARY_PERCENT`
- 同一用户的所有请求始终落在同一目标端
- 多租户场景先按租户分桶，再按用户分桶

**P1-11 幂等性 TTL 策略**：
- Saga 事务：24h（当前 TS 实现）
- Webhook 投递：5min
- 通知发送：1min
- 共享包支持不同 TTL 配置参数

**P1-12 数据审计自动化**：
- 开发 CLI 工具：`go run cmd/audit/main.go --ts-dsn=... --go-dsn=... --module=xxx`
- 审计通过标准：表结构零差异、关键字段（id/tenant_id/created_at/updated_at）存在且类型一致
- 历史数据 COUNT 匹配，允许增量偏差 < 0.1%

### 4.4 DevOps 维度修复

**P1-13 Rolling Update 配置**：
```yaml
rollingUpdate:
  maxSurge: 1
  maxUnavailable: 0
```

**P1-14 连接池评估**：
- 61 模块 × 5-10 连接/模块 = 300-600 连接
- 需调整 PostgreSQL `max_connections` 配置
- 建议使用连接池代理（如 PgBouncer）或限制每个模块的连接数

### 4.5 AI 维度修复

**P1-15 数据模型统一**：
- **决策：AI 统一汇总到 Python 权威服务 `orion-ai-service`**
- 以 Go 版 23 字段为数据模型基准，移植到 Python 端
- 废弃 Python 版 8 字段内存存储的 llm_trace
- TS 版 22 字段与 Go 版对齐（增加 ModelPricing 自定义定价表）
- Go 蓝图 `orion-ai-svc-go` 作为参考实现（不独立部署）
- 迁移路径：Go 数据模型 → Python 实现 → TS 路由废弃

**P1-16 MCP 归属**：
- MCP 暂留 TS，不迁移
- 后续由 AI Gateway 接管协议层
- MCP 作为协议透传层而非业务逻辑层，迁移价值低

---

## 5. 优化后的 Wave 执行计划（含 P0/P1 修复）

### Wave 0 — 基础设施先行（3d）

**必须先解决所有 P0 问题才能开始 Wave 1。**

| 任务 | 描述 | 对应 P0/P1 | 预估 |
|------|------|-----------|------|
| 0.1 | `go-common/pkg/idempotency/` 幂等性检查器 | P1-11 | 1d |
| 0.2 | `go-common/pkg/sse/` SSE 连接管理器（先覆盖 pipeline 场景） | — | 0.5d |
| 0.3 | `go-common/pkg/cron/` 全局 cron 调度器（职责边界文档化） | P1-9 | 0.5d |
| 0.4 | DAG 共享包改用 `github.com/dominikbraun/graph` | P1-8 | 0.5d |
| 0.5 | Gateway 增加模块级环境变量路由切换 | **P0-4** | 1d |
| 0.6 | CI 增加 `orion-platform-svc-go` 构建任务 | **P0-5** | 0.5d |
| 0.7 | 补充 Helm chart + liveness/readiness 分离 | **P0-6** | 0.5d |
| 0.8 | Go migration 引擎增加 `Down()` 回滚支持 | **P0-3** | 1d |
| 0.9 | 增加 `readonlyMiddleware` 只读中间件 | **P0-2** | 0.5d |
| 0.10 | 资源配额 512Mi request / 2Gi limit | — | 0.5d |
| 0.11 | 增加 `go test -race ./...` 到 CI | — | 0.5d |
| 0.12 | 数据库迁移前向兼容规范文档化 | **P0-3** | 0.5d |

### Wave 1 — 通用域 + 基础设施模块（3d）

**重命名/重构：** HookChain 从 Wave 4 移至此处。

| 模块 | TS 路由 | 说明 |
|------|---------|------|
| user 体系（user/profile/activity/token/status） | 24 | Go 中仅空目录，需新建 |
| role | 6 | 角色管理 |
| session | 6 | 会话管理 |
| api-key | 3 | API 密钥管理 |
| ci-type | 11 | 已有 Go 代码，仅注册 |
| api-market | 14 | 已有 Go 代码，仅注册 |
| eventbus | 7 | 事件总线基础设施 |
| event-trigger | 7 | 事件触发规则引擎 |
| **hook-chain** | 10 | **从 Wave 4 移入**，事件响应上下文 |
| **小计** | **88** | |

### Wave 2 — 认证 + 权限上下文（5d）

**清理重复计数：** permission-audit 和 abac-policy 仅在此处，Wave 7 中移除。

| 模块 | TS 路由 | 说明 |
|------|---------|------|
| auth-enhanced | 9 | JWT 密钥轮换 + Token 黑名单 |
| auth-mfa | 10 | TOTP 设置/验证/备份码 |
| sso-unified | 4 | OIDC/LDAP/企微 SSO |
| sso-providers | 6 | 提供商 CRUD + 连接测试 |
| abac-policy | 5 | 权限策略 |
| permission-audit | 5 | 权限审计 |
| **小计** | **39** | |

### Wave 3 — 通知上下文（5d）

**注意：** webhook 仅包含 `webhook-routes.ts`（通知上下文），`workflow-webhook-routes.ts` 在 Wave 4。

| 模块 | TS 路由 | 说明 |
|------|---------|------|
| notification | 10 | 多租户通知列表/已读/广播 |
| notification-policy | 11 | 策略评估引擎 |
| notification-template | 5 | 标准 CRUD |
| scheduled-notification | 6 | 定时通知（依赖 cron 共享包） |
| do-not-disturb | 5 | 免打扰设置 |
| **webhook**（通知版） | 10 | Webhook CRUD + 投递日志 + 密钥轮换 |
| **channel** | 7 | **TS 当前全部 503 占位，Go 必须完整实现** |
| **小计** | **54** | |

### Wave 4 — 工作流 + 低代码上下文（5d）

**重构：** HookChain 已移至 Wave 1，ProcessStep 已移至 Wave 7。

| 模块 | TS 路由 | 说明 |
|------|---------|------|
| workflow | 10 | 内联 SQL → 迁移时修复为 Repository 模式 |
| workflow-trigger | 9 | cron 调度器（通过 go-common/pkg/cron/） |
| workflow-task | 4 | 人工任务认领/完成 + NATS 事件解耦 |
| workflow-dependency | 3 | DAG 检测（通过 dominikbraun/graph） |
| lowcode | 14 | 全功能低代码 |
| **workflow-webhook** | 5 | **工作流触发 webhook**（独立于通知 webhook）|
| **小计** | **45** | |

### Wave 5 — Pipeline 辅助体系（8d）

**补充：** change-intelligence 加入此处。

| 模块 | TS 路由 | 说明 |
|------|---------|------|
| pipeline-batch | 13 | 阶段组 CRUD + 批次执行生命周期 |
| pipeline-sse | 5 | SSE 实时日志（通过 go-common/pkg/sse/） |
| pipeline-execution-control | 7 | **内联 PG 查询 → 修复为 Repository 模式** |
| pipeline-audit-log | 5 | 审计日志 CRUD |
| pipeline-graph | 4 | YAML/JSON DAG 转换（通过 dominikbraun/graph） |
| pipeline-template | 6 | CRUD + instantiate |
| pipeline-version | 6 | 版本管理 diff/rollback/tag |
| pipeline-run-history | 1 | 聚合查询 |
| pipeline-batch-operations | 3 | 批量 start/stop/delete |
| pipeline-trend | 2 | 趋势数据 |
| **change-intelligence** | 4 | **补充：** AI 变更影响分析 |
| **小计** | **56** | |

### Wave 6 — 可观测性上下文（6d）

| 模块 | TS 路由 | 说明 |
|------|---------|------|
| tracing | 11 | 分布式追踪 + OTel Collector 配置 |
| slo | 11 | SLO 定义 + SLI 记录 + 错误预算 |
| performance | 11 | 性能基线 + 瓶颈/回归检测 |
| health-check | 7 | 健康检查 CRUD + 执行 |
| **小计** | **40** | |

### Wave 7 — P2 小模块批量（15d）

**重构：** 从 3 批扩展为 6 个子批次，每批上限 15 模块。移除重复计数（permission-audit、abac-policy、process-step 已固定到其他 Wave）。

| 子批次 | 上下文 | 模块 | 数量 |
|--------|--------|------|------|
| 7a 安全 | 安全上下文 | compliance, supply-chain, ueba, secret, **chaos-enhanced** | ~5 |
| 7b 成本 | FinOps 上下文 | cost-allocation, efficiency, billing | ~3 |
| 7c 交付 | 金丝雀上下文 | canary-analysis, canary-traffic, progressive, oci-registry, version-archive | ~5 |
| 7d 数据 | 数据上下文 | data-pipeline, data-quality, data-lineage, vectorize-rules, vector-store, vector | ~6 |
| 7e 工单 | 工单上下文 | runbook, ticket-knowledge, queue, **process-step** | ~4 |
| 7f 社区 | 社区上下文 | community, community-advanced, module, bi-dashboard | ~4 |
| 7g 杂项 | 多上下文混合 | cache, cache-cleanup, circuit-breaker, message-queue, degradation, metrics, alert-breaker, **maintenance-window**, script, script-library, script-version, env-profile, global-param, config-mgmt-enhanced, unified-config, self-service, supply-chain（已算）, autonomous-pipeline, decision-explanation, dual-engine, integration, service-catalog, service-topology, cross-domain, multi-modal-trigger, apm, dependency-coordination, telemetry, service-health, asset, risk, module-lifecycle, approval-enhance, provision, notification-management, plugin-hotreload, env-lifecycle, api-consumption, contract, topology | ~40 |
| **小计** | | | **~70** |

---

## 6. 四阶段切换标准流程（P0-1/P0-2 修复版）

### 阶段 1：只读模式（1-2 天）
- Go 版本部署，Handler 通过 `readonlyMiddleware` 拒绝非 GET 请求
- 验证 Go 读结果与 TS 读结果一致
- 自动化：`scripts/check-endpoint-compatibility.sh`

### 阶段 2：影子模式（1-2 天）
- **仅对 GET 请求生效**（写入操作无法做影子对比）
- Gateway 同时转发 GET 到 TS 和 Go，比较响应体 JSON 哈希
- 差异 > 0.1% 告警
- 对 POST/PUT/DELETE：Go 端验证请求参数合法性并记录日志，不实际写入

### 阶段 3：主备切换（3-5 天）
- **写入操作一次性全量切流**（不做逐比例灰度，避免双写冲突）
- 读取操作按用户 ID 哈希灰度：1% → 5% → 25% → 50% → 100%
- 每步灰度持续 24h 观察
- 用户 ID 哈希保证同一用户始终落在同一目标端

### 阶段 4：清理（1 天）
- 确认稳定运行 3 天以上
- 标记 `[ARCHIVED]`，移除 TS 路由注册
- 移除 Gateway 中的 TS 回退路由

---

## 7. 数据迁移与回退方案

### 7.1 数据迁移

每个模块迁移前的自动化审计：

```bash
go run cmd/audit/main.go --ts-dsn="..." --go-dsn="..." --module=artifact
```

审计通过标准：
- 表结构零差异（列名、类型、索引、约束）
- 关键字段（id、tenant_id、created_at、updated_at）存在且类型一致
- 历史数据 COUNT 匹配，允许增量偏差 < 0.1%

### 7.2 数据库迁移前向兼容规范

| 允许 | 禁止 |
|------|------|
| `CREATE TABLE IF NOT EXISTS` | `DROP TABLE` |
| `ALTER TABLE ADD COLUMN` | `ALTER TABLE DROP COLUMN` |
| `CREATE INDEX` | `DROP INDEX` |

### 7.3 回退方案

| 回滚级别 | 触发条件 | 操作 | 影响范围 | 耗时 |
|----------|---------|------|---------|------|
| L1 单模块切换 | 某模块错误率 > 1% | Gateway 环境变量切回 TS + 重启 | 仅该模块 | 1-2 分钟 |
| L2 服务回滚 | 整体错误率 > 5% | `helm rollback platform-svc-go` | 全部 Go 模块 | 1-3 分钟 |
| L3 数据库回滚 | 数据不一致 | `RunMigrationsDown()` + 旧版本部署 | 全部服务 | 5-15 分钟 |

**注意**：Wave 7 的 L1 回滚不可行（23 个模块同时切换），需切换到 Wave 7 专用的"全量回滚"策略。

---

## 8. 技术债务修复清单

| 模块 | 问题 | 修复方式 |
|------|------|---------|
| pipeline-execution-control | 内联 PG 查询 | 抽取到 Repository |
| channel-routes | TS 全部 503 占位 | Go 必须完整实现 |
| workflow-routes | 内联 SQL 直查 | 抽取到 Repository |
| lowcode-routes | 版本和模板存在内存 Map | Go 使用 PostgreSQL 持久化 |
| multi-modal-trigger | webhook 类型与通知 webhook 混淆 | 迁移时拆分命名 |

---

## 9. 技术依赖

| 能力 | 库 | 用途 |
|------|-----|------|
| YAML | `gopkg.in/yaml.v3` | pipeline-graph |
| TOTP/MFA | `github.com/pquerna/otp` | auth-mfa |
| OIDC | `github.com/coreos/go-oidc/v3` | sso-unified |
| LDAP | `github.com/go-ldap/ldap/v3` | sso-unified |
| Cron | `github.com/robfig/cron/v3` | go-common/pkg/cron/ |
| DAG | `github.com/dominikbraun/graph` | 替代自研 |
| SSE | goroutine + channel | go-common/pkg/sse/ |
| 幂等性 | 自研（PostgreSQL） | go-common/pkg/idempotency/ |

---

## 10. P0 问题详细设计方案

### 10.1 Gateway 动态路由灰度切换（方案 B：Redis 推荐）

**问题 P0-4**：`NOTIFICATION_TARGET` 代码中不存在，Gateway 无热重载。

**方案**：Redis Pub/Sub + 可变 `RouteTargetRef` 机制。

#### 核心机制：RouteTargetRef

```typescript
// orion-api-gateway/src/services/gateway-dynamic-routes.ts
interface RouteTargetRef {
  goUrl: string;      // Go 服务地址
  tsUrl: string;      // TS 服务地址
  goWeight: number;   // 0-100，发送到 Go 的百分比
  enabled: boolean;
}
```

路由 handler 每次请求时从可变引用中读取目标地址，不在闭包中捕获。

#### 设计细节

| 维度 | 实现方式 |
|------|---------|
| 配置源 | 环境变量 `MODULE_ROUTING`（JSON）+ Redis `gateway:routing:config` |
| 热加载 | Redis Pub/Sub 通道 `gateway:routing`，配置变更毫秒级生效 |
| 灰度比例 | 基于 `tenantId` 一致哈希：`hash(tenantId) % 100 < goWeight` |
| 实现时间 | 3 天（含 RedisConfigWatcher + RouteTargetRef + 管理 API） |
| 重启要求 | 否（运行时通过 Redis Pub/Sub 热更新） |

#### 修改清单

| 文件 | 修改 | 预估行数 |
|------|------|---------|
| `orion-api-gateway/src/services/gateway-dynamic-routes.ts` | 新增 `ModuleRoutingManager` + `RouteTargetRef` 机制 | +100 |
| `orion-api-gateway/src/services/redis-config-watcher.ts` | **新增**：Redis Subscriber | +120 |
| `orion-api-gateway/src/config/index.ts` | 增加 `ModuleRoutingConfig` 接口 | +30 |
| `orion-api-gateway/src/app.ts` | 启动时初始化 RedisConfigWatcher | +10 |
| `orion-api-gateway/src/routes/admin.routes.ts` | **新增**：管理 API（查看/更新路由配置） | +80 |
| `orion-platform-svc-go/internal/gateway-dynamic/service/service.go` | CRUD 后 publish Redis 通知 | +30 |

#### 灰度逻辑

```typescript
resolveTarget(prefix: string, request: FastifyRequest): string | null {
  const ref = this.targetRefs.get(prefix);
  if (!ref || !ref.enabled || ref.goWeight === 0) return null;
  if (ref.goWeight === 100) return ref.goUrl;

  // 基于 tenantId 的一致哈希
  const hashKey = request.tenantId || request.headers['x-user-id'] || request.ip;
  const hash = Math.abs(hashCode(hashKey));
  return (hash % 100 < ref.goWeight) ? ref.goUrl : null;
}
```

#### 回滚操作

```bash
# 方式1：Redis 删除配置，全部恢复 TS
redis-cli DEL gateway:routing:config
redis-cli PUBLISH gateway:routing 'config_updated'

# 方式2：管理 API
curl -X PUT http://localhost:3000/api/v1/admin/routing \
  -H 'Content-Type: application/json' \
  -d '{"moduleRouting":{}}'
```

### 10.2 双写冲突解决方案

**问题 P0-1/P0-2**：影子模式写入不成立、双写冲突零防范。

#### 核心策略：Gateway 写入路由闸

**不依赖分布式锁**，通过 Gateway 层做"写入请求的流量开关"。

#### 由谁写入

| 阶段 | WRITE_AUTHORITY | TS 行为 | Go 行为 |
|------|----------------|---------|---------|
| 只读模式 | ts | 正常读写 | 拒绝非 GET（通过 `readonlyMiddleware`） |
| 影子模式 | dry-run-both | 正常读写 | 验证请求但不写入，日志审计 |
| 主备切换 | go | 拒绝非 GET | 正常读写 |
| 清理 | go | 模块已卸载 | 正常读写 |

#### 修改清单

| 文件 | 修改 | 说明 |
|------|------|------|
| `orion-api-gateway/src/middleware/write-route-guard.ts` | **新增** | 写入路由中间件 |
| `orion-api-gateway/src/routes/api.ts` | 修改 | 根据 `WRITE_AUTHORITY` 动态选择目标 |
| `orion-go-common/pkg/middleware/readonly.go` | **新增** | `WriteAuthorityGuard` 拒绝非 GET |
| `orion-platform-svc-go/cmd/server/main.go` | 修改 | 注册 `WriteAuthorityGuard` |
| `orion-platform-service/src/middleware/write-route-guard.ts` | **新增** | TS 端写入保护 |

#### 双写验证：`_source` 列

```sql
-- 迁移：002_add_source_column.sql
ALTER TABLE federated_clusters ADD COLUMN IF NOT EXISTS _source VARCHAR(16) NOT NULL DEFAULT 'ts';
ALTER TABLE federation_configs ADD COLUMN IF NOT EXISTS _source VARCHAR(16) NOT NULL DEFAULT 'ts';
```

Go 端 INSERT 时携带 `_source='go'`，验证脚本 SELECT `_source, COUNT(*)` 检查分布。

#### 乐观锁冲突：version 列

```sql
-- 迁移：003_add_version_column.sql
ALTER TABLE federated_clusters ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
```

Go `BaseRepository` 新增 `UpdateWithVersion()` 方法，使用 `SELECT ... FOR UPDATE` + `version = version + 1` 原子递增。冲突时重试 3 次。

### 10.3 迁移回滚方案

**问题 P0-3**：Go migration 引擎不支持回滚。

#### `RunMigrationsDown()` 实现

```go
// 签名
func RunMigrationsDown(db *DB, dir string, steps int) error
```

- 按版本倒序查找 `_down.sql` 文件
- 执行回滚 SQL + 从 `schema_migrations` 删除记录
- 支持 `steps` 参数（回滚最近 N 个版本）
- 支持 `force` 参数（跳过生产环境确认）

#### 回滚文件命名规范

```
migrations/
  001_create_federation_tables.sql
  001_create_federation_tables_down.sql    -- DROP TABLE ... CASCADE
  002_add_source_column.sql
  002_add_source_column_down.sql           -- ALTER TABLE ... DROP COLUMN
```

#### 已存在 11 个 migration 文件的处理

- 运行 `scripts/generate-down-migrations.go` 自动生成反向迁移
- 工具自动提取 `CREATE TABLE` → 生成 `DROP TABLE IF EXISTS ... CASCADE`
- 自动提取 `ALTER TABLE ADD COLUMN` → 生成 `DROP COLUMN IF EXISTS`

#### 三层数据保护

| 层级 | 措施 |
|------|------|
| 1 | 回滚前自动备份到 `rollback_backup_{version}` schema |
| 2 | 生产环境强制交互式确认（`yes` 输入） |
| 3 | 回滚后恢复入口 `RestoreFromRollbackBackup(db, version)` |

### 10.4 AI 统一到 Python 执行方案

**决策**：AI 三套实现统一汇总到 Python 权威服务 `orion-ai-service`。Go 蓝图作为参考实现不独立部署。TS 路由逐步废弃。

#### 第一阶段：数据模型统一（P0，6.3 人天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 重写 Trace 模型 | `src/models/trace.py` | 8 字段→23 字段，对齐 Go |
| 新增定价模型 | `src/models/pricing.py` | 默认定价表 + 自定义定价 |
| 新增迁移文件 | `migrations/001_create_llm_traces.sql` | 对齐 Go 表结构 |
| 重写 Repository | `src/repositories/llm_trace_repository.py` | 内存→PostgreSQL |
| 重写 Service | `src/services/llm_trace.py` | 单阶段→双阶段生命周期 + 成本计算 + SHA-256 |
| 修改路由 | `src/api/ai_routes.py` | 适配新字段 |

#### 第二阶段：AI 能力补齐（P1，8.8 人天）

| 任务 | 文件 | 说明 |
|------|------|------|
| LLM 客户端 | `src/services/llm_client.py` | **新增**：OpenAIClient + ClaudeClient + ProviderRouter |
| AI 服务改造 | `src/services/ai_service.py` | 替换 `_call_model_generate()` 从 `NotImplementedError` 为真实 LLM |
| pgvector 迁移 | `migrations/002_create_vector_store.sql` | **新增**：HNSW 索引 |
| 向量 Repository | `src/repositories/vector_repository.py` | **新增**：pgvector CRUD |
| 重写向量服务 | `src/services/vector_store.py` | TF-IDF→OpenAI Embedding API |
| Agent 注册表 | `src/services/agent_registry.py` | **新增**：从 Go 蓝图移植 |
| Agent 路由 | `src/api/ai_agent_routes.py` | **新增**：4 个端点 |

#### 第三阶段：TS 路由废弃（P2，1.7 人天）

废弃顺序：llm-trace → ai-agent → ai-gateway → ai-decision → ai-cost → ai-review → ai-security

每个 TS 路由文件首行加 deprecated 标记，返回 301 重定向到 Python 服务。

**前端零修改**：API Gateway 自动转发 `/api/v1/ai/*` 和 `/api/v1/llm/*` 到 Python 服务。

### 10.5 Wave 7 分批细化

**问题 P1-2**：70 模块/3 批=每批 23 个，粒度太粗。

#### 10 子批次方案

| 子批次 | 上下文 | 模块 | 数 | 待新建 |
|--------|--------|------|----|--------|
| 7a | 系统弹性基础设施 | cache, cache-cleanup, circuit-breaker, message-queue, degradation, metrics, alert-breaker | **7** | 0 |
| 7b | 脚本与配置管理 | script, script-library, script-version, env-profile, global-param, config-mgmt-enhanced, unified-config, maintenance-window | **8** | 1 |
| 7c | 安全全域 | compliance, supply-chain, ueba, secret, chaos-enhanced, sbom, inspection, capacity, middleware-ops, dr | **10** | 0 |
| 7d | FinOps 成本 | cost-allocation, efficiency, billing | **3** | 0 |
| 7e | 交付/金丝雀 | canary-analysis, canary-traffic, progressive, oci-registry, version-archive | **5** | 0 |
| 7f | 数据平台 | data-pipeline, data-quality, data-lineage, vectorize-rules, vector-store, vector | **6** | 0 |
| 7g | 工单+社区 | runbook, ticket-knowledge, queue, process-step, community, community-advanced, module, bi-dashboard | **8** | 0 |
| 7h | AI+集成+编排 | self-service, autonomous-pipeline, decision-explanation, dual-engine, integration, service-catalog, service-topology, cross-domain, multi-modal-trigger, apm, dependency-coordination | **11** | 0 |
| 7i | 可观测性补充 | telemetry, service-health, asset, risk, module-lifecycle | **5** | 3 |
| 7j | 审批+API 生态 | approval-enhance, provision, notification-management, plugin-hotreload, env-lifecycle, api-consumption, contract, topology | **8** | 7 |

**总计：10 子批次，71 个模块，每批 3-11 个，每个子批次独立 L1 回滚。**

### 10.6 Webhook 三义性拆分

| TS 文件 | 路由数 | 归属 | Go 模块名 | 归属 Wave |
|---------|--------|------|----------|-----------|
| `webhook-routes.ts` | 10 | 通知上下文 | `internal/webhook/` | Wave 3 |
| `workflow-webhook-routes.ts` | 1 | 工作流上下文 | `internal/workflow/internal/webhook/` | Wave 4 |
| `multi-modal-trigger-routes.ts` | 3 (webhook 子路径) | 事件触发上下文 | `internal/trigger/` | Wave 7h |

### 10.7 单体规模治理方案（P0-7）

**问题**：174 模块单体缺少规模治理策略。

#### ModuleRegistry 模块注册表（短期，3 人天）

改造后 main.go 从 ~340 行缩减至 ~70 行：

```go
// 每个模块实现 Module 接口
type Module interface {
    Name() string
    Init(deps *Dependencies) (Handler, error)
}

// 注册表声明式注册
reg := registry.NewModuleRegistry().
    Register(&featureflag.Module{}).
    // ... 61 个模块
    Register(&backup.Module{}).
    MustInit(deps)

rg := r.Group("/api/v1")
reg.RegisterAllRoutes(rg)
```

#### 微服务拆分蓝图（中期，17 人天）

| 候选服务 | 模块数 | 端点数 | 优先级 |
|---------|--------|--------|--------|
| pipeline-svc | 14 | ~180 | P1 |
| workflow-svc | 8 | ~170 | P1 |
| observability-svc | 7 | ~110 | P2 |
| ai-svc | 4 | ~55 | P2 |
| core-svc | 13 | ~130 | P3 |

**拆分触发条件**：二进制体积 > 100MB / 编译时间 > 60s / 单域团队 > 3 人。

#### 编译优化

```bash
go build -v -buildvcs=false -trimpath -ldflags="-s -w" -race=false
```

效果：体积减小 ~30%（60MB→42MB），CI 缓存命中后增量编译 3-15s。

### 10.8 幂等性共享包设计（P1-11）

**包结构**（~780 行，3.5 小时实现）：
```
orion-go-common/pkg/idempotency/
├── checker.go          — Checker 接口
├── store.go            — Store 接口
├── redis_store.go      — Redis 实现（SET NX EX）
├── pg_store.go         — PostgreSQL 实现
├── middleware.go        — Gin 中间件
└── errors.go           — 错误定义
```

**TTL 策略**：Saga 24h / Webhook 5min / Notify 1min，通过 `TTLResolver(path, method)` 路由。

**关键设计**：只拦截 POST/PUT/PATCH；Fail-open（存储不可达时跳过）；支持按路由组选择性启用。

### 10.9 数据审计自动化 CLI（P1-12）

**子命令**：
```bash
go run cmd/audit/main.go audit --module=artifact --go-dsn="..." --ts-dsn="..."
go run cmd/audit/main.go compare --go-dsn="..." --ts-dsn="..."
go run cmd/audit/main.go suggest-mapping --go-dsn="..." --ts-dsn="..."
```

**审计维度**：表结构（列名/类型/nullable 零差异）、关键字段（id/tenant_id/created_at/updated_at）、索引、数据量 COUNT（偏差 < 0.1% PASS / < 1% WARN）。

**表名映射**：JSON 映射文件 + CLI 自动建议。CI 集成：每个 PR 自动审计受影响模块，FAIL 阻断合并。

### 10.10 AI 能力路线图详细执行方案（P0-9）

**Phase A：真实 LLM 推理接入（7 天）**
- ProviderRouter：策略选择 + 重试 + 降级
- Provider：OpenAI → Claude → DeepSeek → RuleEngine（降级）
- 渐进切换：Shadow 模式(2d) → 按场景灰度(2d) → 全面切换(3d)

**Phase B：pgvector 向量检索（5 天）**
- Python 端连接到现有 TS pgvector 表
- TF-IDF→OpenAI 1536 维真实嵌入（批量脚本重新生成）
- 索引策略：初期 IVFFlat，数据量增长后 HNSW

**Phase C：数据模型统一（4 天）**
- 以 Go 23 字段为基准，Python 端增加 13 个字段
- tenant_id 统一为 VARCHAR

**Phase D：提示词管理系统（5 天）**
- 4 张表：prompt_templates, prompt_versions, prompt_ab_experiments, prompt_feedback
- 支持版本控制 + A/B 测试

**汇总**：21 天（A+B 并行 12 天），41 个文件变更（23 新建 + 18 修改）

---

## 11. 验证门控

### 每个 Wave 完成后

```bash
# 构建 + 测试 + 竞态检测
go build ./...
go test -race ./...
go vet ./...

# 架构验证
scripts/check-cross-module-imports.sh

# 端点一致性验证
scripts/check-endpoint-coverage.sh

# 路由注册完整性
grep -c "RegisterRoutes" cmd/server/main.go

# 迁移文件完整性
for dir in internal/*/; do
  module=$(basename $dir)
  [ -f "migrations/001_create_${module}_tables.sql" ] || echo "WARN: $module missing migration"
done
```

### 每个模块切换通过标准

- [ ] Go 版本 P99 延迟 ≤ TS 版本 × 1.2
- [ ] Go 版本错误率 ≤ TS 版本
- [ ] 响应 JSON Schema 一致
- [ ] 只读模式运行 24h 无差异
- [ ] 灰度 1% 运行 24h 无异常

---

## 11. 汇总时间线

| Wave | 内容 | 模块数 | 预估 |
|------|------|--------|------|
| Wave 0 | 基础设施（P0 问题修复 + 共享包 + CI/Helm/Gateway灰度） | — | 3d |
| Wave 1 | 通用域（user/role/session/eventbus/hook-chain） | ~9 | 3d |
| Wave 2 | 认证+权限（auth+MFA+SSO+abac+permission-audit） | ~6 | 5d |
| Wave 3 | 通知（notification/policy/template/webhook/channel） | ~7 | 5d |
| Wave 4 | 工作流+低代码（含 workflow-webhook） | ~6 | 5d |
| Wave 5 | Pipeline 辅助（含 change-intelligence） | ~11 | 8d |
| Wave 6 | 可观测性（tracing/slo/performance/health-check） | ~4 | 6d |
| Wave 7a | 系统弹性基础设施 | 7 | 2d |
| Wave 7b | 脚本与配置管理 | 8 | 2d |
| Wave 7c | 安全全域 | 10 | 2d |
| Wave 7d | FinOps 成本 | 3 | 1d |
| Wave 7e | 交付/金丝雀 | 5 | 1d |
| Wave 7f | 数据平台 | 6 | 1d |
| Wave 7g | 工单+社区 | 8 | 2d |
| Wave 7h | AI+集成+编排 | 11 | 2d |
| Wave 7i | 可观测性补充 | 5 | 1d |
| Wave 7j | 审批+API 生态 | 8 | 2d |
| **Wave 7 小计** | **10 子批次** | **71** | **16d** |
| **总计** | | **~113** | **~50d** |

### 与首轮方案对比

| 对比项 | 首轮方案 | 本轮优化后 |
|--------|---------|-----------|
| Wave 0 天数 | 2d | 3d（增加 P0 问题修复） |
| Wave 4 内容 | 含 HookChain + ProcessStep | HookChain→Wave 1, ProcessStep→Wave 7 |
| webhook 处理 | 单一模块 | 拆分为通知 webhook(Wave 3) + 工作流 webhook(Wave 4) |
| Wave 7 分批 | 3 批 × 23 模块 | 6 子批次 × 5-15 模块 |
| 切换流程 | 影子模式对所有请求 | 只读模式限定 GET，写入全量切流 |
| Gateway 灰度 | 环境变量方案 | 明确需要重启，不支持热加载 |
| 迁移回滚 | Go migration 不支持 | Wave 0 增加 `Down()` 支持 |
| CI/CD 管线 | 未集成 | 增加构建任务 + Helm chart |
| AI 模块 | 4 个模块迁移暂停 | 明确 llm-trace 迁入 platform-svc-go 作为第一步 |
| 单体治理 | 无 | 短期单体+模块注册表，中期拆分蓝图 |
| 遗漏模块 | 3 个 | 补充 change-intelligence/chaos-enhanced/maintenance-window |
| 重复计数 | 3 处 | 清理 permission-audit/abac-policy/process-step |