# 七大核心域专家深度分析 — 身份认证 / 通知告警 / 监控可观测 / AI ChatOps / FinOps 数据 / 配置低代码 / 跨域工具

> 分析日期: 2026-08-01 | 数据源: 77 模块逐模块源码扫描 + 4 Agent 并行采集
> 方法: 同三域深度分析标准 (功能覆盖矩阵 + 子域评分 + 架构亮点 + 交互链 + 差距分析)
> 关联文档: `docs/three-domain-depth-analysis-2026-08-01.md` (ITSM/CI-CD/CMDB 三域)

---

## 零、七域综合评分

| 域 | 完整度 | 后端深度 | 综合 | 最大亮点 | 最大缺口 |
|----|--------|---------|------|---------|---------|
| **身份认证** | 90% | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | identity/auth 完整 OIDC SSO + MFA + 密钥轮换 | 前端权限守卫 2.8% |
| **通知告警** | 92% | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | alert-pipeline 7 Stage 引擎 + 全生命周期 | alert-dedup 缺 Repo |
| **监控可观测** | 82% | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | monitoring 44方法 + eventbus 33方法 | Log 支柱缺失 |
| **AI/ChatOps** | 78% | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | chatops 87方法 + knowledge RAG | AI 子模块偏薄 |
| **FinOps/数据** | 88% | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | capacity 61方法 + config 65方法/91路由 | 4 模块缺前端 API |
| **配置/低代码** | 85% | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | config 5子Handler/65方法/69Repo | workflow 0 路由注册 |
| **跨域/工具** | 70% | ⭐⭐⭐ | ⭐⭐⭐ | test-selector 30方法, audit 12方法 | crossover 缺 Repo+Handler |

---

## 一、身份认证域 (11 模块)

### 1.1 功能覆盖矩阵

| 功能 | 状态 | 后端规模 | 关键能力 | 证据 |
|------|------|---------|---------|------|
| **登录/注册** | ✅ 完整 | auth 19 Service | JWT 签发, bcrypt 密码, 租户路由 | `auth/service/service.go` |
| **Token 管理** | ✅ 完整 | auth-enhanced 9 Service | API 密钥 CRUD, Token 黑名单, 租户隔离 | `auth-enhanced/service/` |
| **MFA 多因素** | ✅ 完整 | auth-mfa 10 Service | TOTP 验证, 备份码, 设备激活/禁用 | `auth-mfa/service/` |
| **用户管理** | ✅ 完整 | user 8 Service | 用户 CRUD, 认证, 密码修改 | `user/service/` |
| **租户管理** | ✅ 完整 | tenant 55 Service | 租户 CRUD/拆分/配额/命名空间/邀请/告警 | `tenant/service/` |
| **角色 RBAC** | ✅ 完整 | role 8 Service | 角色 CRUD, 权限分配/查询 | `role/service/` |
| **权限 ABAC** | ✅ 完整 | abac-policy 5 Service | 属性级策略过滤 | `abac-policy/service/` |
| **能力权限** | ✅ 完整 | capability 64 Service | 能力树, 授权, 临时授权, 审批, 审计 | `capability/service/` |
| **会话管理** | ✅ 完整 | session 7 Service | 会话 CRUD, 登出, 过期清理 | `session/service/` |
| **OIDC SSO** | ✅ 完整 | identity/auth 12 Service | 发现/授权/令牌/用户信息, 14 端点 | `identity/auth/handler/` |
| **密钥轮换** | ✅ 完整 | identity/auth 5 端点 | JWT 常规/紧急轮换, 密钥统计 | `identity/auth/handler/key_rotation.go` |
| **登录尝试** | ✅ 完整 | identity/auth 3 端点 | 登录尝试记录, 锁定/解锁 | `identity/auth/handler/` |

### 1.2 架构亮点

**双重身份系统**: `internal/auth` (轻量) + `internal/identity/auth` (完整版)
- auth: 515 行 handler, 5 路由, 基础 CRUD
- identity/auth: 1705 行 handler, 7 文件, 含 OIDC/MFA/密钥轮换/登录尝试/权限映射

**capability 能力权限系统** (1148 行 handler, 64 Service):
- 能力树: 能力 → 角色 → 用户 三层映射
- 临时授权: 带过期时间的权限授予
- 权限申请审批: 申请 → 审批 → 授权 完整链路
- 审计日志: 所有权限变更可追溯

**tenant 多租户架构** (55 Service):
- 租户隔离: 4 层隔离验证 (RLS 状态)
- 命名空间池: 预分配命名空间
- 配额管理: 资源配额控制
- 企业级功能: 邀请/告警/统计

### 1.3 前端交互

| 前端页面 | 行数 | API 调用 | 后端模块 |
|---------|------|---------|---------|
| Login | — | auth.ts | auth |
| UserManagement | — | user.ts | user |
| TenantList | — | tenant.ts | tenant |
| TenantManagement | — | tenant.ts | tenant |
| RoleManagement | — | roles.ts | role |
| Capability | — | capability.ts | capability |
| CapabilityAdmin | — | capability.ts | capability |
| Sessions | — | session.ts | session |
| ApiKeyManagement | — | — | auth-enhanced |

**前端 API 缺失**: auth-enhanced, auth-mfa 无对应前端 API 文件

### 1.4 子域评分

| 子域 | 评分 | 说明 |
|------|------|------|
| 认证 (Auth) | ⭐⭐⭐⭐⭐ | JWT + MFA + OIDC SSO + 密钥轮换 |
| 用户管理 | ⭐⭐⭐⭐ | 8 Service, 基础 CRUD |
| 租户管理 | ⭐⭐⭐⭐⭐ | 55 Service, 企业级多租户 |
| 角色权限 | ⭐⭐⭐⭐⭐ | RBAC + ABAC + 能力树 + 64 Service |
| 会话管理 | ⭐⭐⭐⭐ | 7 Service, 过期清理 |
| **综合** | **⭐⭐⭐⭐⭐** | **90% 覆盖, OIDC/MFA 完整** |

### 1.5 差距分析

| 差距 | 严重度 | 填补方案 | 工作量 |
|------|--------|---------|--------|
| 前端权限守卫 2.8% | 🔴 P0 | 敏感页面增加 usePermission | 1-2 天 |
| 角色预设模板 | 🟡 P1 | Admin/Dev/Viewer 预设模板 | 1 天 |
| 密码策略可配置 | 🟡 P1 | bcrypt 轮次/复杂度配置 | 0.5 天 |
| 登录异常检测 | 🟡 P1 | 异地/设备指纹检测 | 2-3 天 |
| auth/identity 合并 | 🟡 P2 | 统一为 identity 子系统 | 3-5 天 |

---

## 二、通知/告警域 (15 模块)

### 2.1 功能覆盖矩阵

| 功能 | 状态 | 后端规模 | 关键能力 | 证据 |
|------|------|---------|---------|------|
| **告警接收** | ✅ 完整 | alert 18 Service | 告警 CRUD, 接收, 关联 | `alert/service/` |
| **告警适配** | ✅ 完整 | alert-adapter 92 Service | Grafana/Prometheus/Webhook SPI | `alert-adapter/service/` |
| **告警去重** | ⚠️ 缺 Repo | alert-dedup 5 Service | 告警去重 (纯内存) | `alert-deduplication/service/` |
| **告警关联** | ✅ 完整 | alert-correlation 7 Service | 关联规则, 关联分析 | `alert-correlation/service/` |
| **告警熔断** | ✅ 完整 | alert-breaker 5 Service | 断路器模式, 告警抑制 | `alert-breaker/service/` |
| **告警静默** | ✅ 完整 | alert-silence 6 Service | 静默规则 | `alert-silence/service/` |
| **告警管道** | ✅ 完整 | alert-pipeline 2054行 | 7 Stage 引擎 (receive/validate/enrich/route/dedup/notify/track) | `alert-pipeline/` |
| **通知策略** | ✅ 完整 | notification-policy 12 Service | 策略 CRUD, 路由 | `notification-policy/service/` |
| **通知模板** | ✅ 完整 | notification-template 9 Service | 模板 CRUD | `notification-template/service/` |
| **通知渠道** | ✅ 完整 | channel 6 Service | 渠道管理 | `channel/service/` |
| **免打扰** | ✅ 完整 | do-not-disturb 4 Service | 免打扰设置 | `do-not-disturb/service/` |
| **定时通知** | ✅ 完整 | scheduled-notification 10 Service | 定时任务 | `scheduled-notification/service/` |
| **通知管理** | ✅ 完整 | notification-management 5 Service | 通知列表/查询 | `notification-management/service/` |

### 2.2 架构亮点

**alert-pipeline 内部引擎** (2054 行, 110 个函数):
```
receive → validate → enrich → route → dedup → notify → track
  │          │          │        │       │        │       │
  │          │          │        │       │        │       └── 追踪
  │          │          │        │       │        └────── 通知发送
  │          │          │        │       └─────────── 去重
  │          │          │        └────────────── 路由
  │          │          └─────────────────── 富化
  │          └────────────────────── 验证
  └───────────────────────── 接收
```
- 纯内部引擎, 无 HTTP 路由暴露
- 2 个 Plugin: DLQ (死信队列) + Notify (通知)
- Event Bus 集成

**告警全生命周期**:
```
Alert → AlertAdapter → AlertDeduplication → AlertCorrelation → AlertSilence
  → AlertBreaker → AlertPipeline → NotificationPolicy → NotificationTemplate → Channel
```

**notification 模块** (1250 行 handler / 79 Service / 56 Repo):
- 6 子 handler: admin/audit/command/config/message/session/webhook
- 35 个路由, 覆盖通知/chatops 门户

### 2.3 前端交互

| 前端页面 | 行数 | API 调用 | 后端模块 |
|---------|------|---------|---------|
| AlertList | 656 | alerts.ts | alert |
| NotificationCenter | 1051 | notifications.ts | notification-management |
| — | — | notification-enhanced.ts | notification-policy |
| — | — | notificationRules.ts | notification-policy |

**前端 API 缺失**: alert-adapter, alert-correlation, alert-deduplication, alert-pipeline, alert-silence, notification-template, do-not-disturb, channel, scheduled-notification 无对应前端 API

### 2.4 子域评分

| 子域 | 评分 | 说明 |
|------|------|------|
| 告警接收 | ⭐⭐⭐⭐⭐ | 18 Service, 完整 CRUD |
| 告警适配 | ⭐⭐⭐⭐⭐ | 92 Service, 多数据源 |
| 告警管道 | ⭐⭐⭐⭐⭐ | 7 Stage 引擎, 2054 行 |
| 通知策略 | ⭐⭐⭐⭐ | 12 Service, 策略路由 |
| 通知渠道 | ⭐⭐⭐⭐ | 6 Service, 多渠道 |
| **综合** | **⭐⭐⭐⭐⭐** | **92% 覆盖, alert-dedup Repo 是唯一缺口** |

### 2.5 差距分析

| 差距 | 严重度 | 填补方案 | 工作量 |
|------|--------|---------|--------|
| alert-dedup 补 Repo | 🔴 P0 | PostgreSQL 持久化去重状态 | 0.5 天 |
| 前端 API 补全 | 🟡 P1 | 7 个模块补前端 API 文件 | 2-3 天 |
| 告警链路简化 | 🟡 P2 | 6 中间件过长, 评估简化 | 1-2 天 |
| 告警拓扑可视化 | 🟡 P2 | 前端告警链路图 | 3-5 天 |

---

## 三、监控/可观测性域 (10 模块)

### 3.1 功能覆盖矩阵

| 功能 | 状态 | 后端规模 | 关键能力 | 证据 |
|------|------|---------|---------|------|
| **指标监控** | ✅ 完整 | monitoring 44 Service | 指标注册/查询/采集, 告警规则 | `monitoring/service/` |
| **APM** | ✅ 完整 | apm 9 Service | 应用 CRUD, 慢追踪, 服务拓扑 | `apm/service/` |
| **链路追踪** | ✅ 完整 | tracing 11 Service | 链路列表/查询, Span 详情, 采样, OTel 配置 | `tracing/service/` |
| **LLM 追踪** | ✅ 完整 | llm-trace 15 Service | Trace 创建/查询, 精度, 定价, 成本估算 | `llm-trace/service/` |
| **性能分析** | ✅ 完整 | performance 14 Service | 基线 CRUD, 瓶颈检测, 回归检测 | `performance/service/` |
| **健康检查** | ✅ 完整 | health-check 14 Service | 健康检查 CRUD, 执行 | `health-check/service/` |
| **SLO** | ✅ 完整 | slo 11 Service | SLO CRUD, SLI 记录, 错误预算 | `slo/service/` |
| **指标管理** | ✅ 完整 | metrics 6 Service | 指标 CRUD | `metrics/service/` |
| **可观测性** | ✅ 完整 | observability 6 Service | 指标记录/查询, 告警 | `observability/service/` |
| **事件总线** | ✅ 完整 | eventbus 33 Service | 事件发布/查询, 死信队列, 订阅, 统计 | `eventbus/service/` |

### 3.2 三大支柱覆盖

| 支柱 | 状态 | 模块 | 深度 |
|------|------|------|------|
| **Metrics** | ✅ 完整 | monitoring(44) + metrics(6) + observability(6) | 完整 |
| **Traces** | ✅ 完整 | tracing(11) + apm(9) + llm-trace(15) | 完整 |
| **Logs** | ❌ 缺失 | 无独立日志管理模块 | **P0 缺口** |

### 3.3 架构亮点

**EventBus NATS 架构** (33 Service):
```
EventBus (NATS JetStream)
  ├── 事件发布/查询/计数
  ├── 连接管理/状态查询
  ├── 订阅列表/死信队列
  └── 统计/监控
```

**monitoring 模块** (44 Service, 36 路由端点):
- 指标注册/查询/采集
- 告警规则 CRUD + 评估 + 抑制
- 启动/停止/健康检查

### 3.4 前端交互

| 前端页面 | 行数 | API 调用 | 后端模块 |
|---------|------|---------|---------|
| Monitoring | — | monitoring.ts | monitoring |
| MetricsDashboard | 502 | — | metrics |
| HealthDashboard | — | health.ts | health-check |
| Tracing | — | — | tracing |
| EventBus | — | eventbus.ts | eventbus |
| Observability | — | observability.ts | observability |
| LLMTraceDashboard | — | llm-trace.ts | llm-trace |

**前端 API 缺失**: tracing, slo, metrics 无对应前端 API 文件

### 3.5 子域评分

| 子域 | 评分 | 说明 |
|------|------|------|
| Metrics | ⭐⭐⭐⭐⭐ | 44 Service, 完整指标体系 |
| Traces | ⭐⭐⭐⭐ | APM + Tracing + LLM-Trace |
| Logs | ⭐ | **缺失** — P0 待实现 |
| EventBus | ⭐⭐⭐⭐⭐ | 33 Service, NATS JetStream |
| SLO | ⭐⭐⭐⭐ | 11 Service, 错误预算 |
| **综合** | **⭐⭐⭐⭐** | **82% 覆盖, Log 支柱缺失** |

### 3.6 差距分析

| 差距 | 严重度 | 填补方案 | 工作量 |
|------|--------|---------|--------|
| Log 支柱缺失 | 🔴 P0 | 新建 logging 模块, 日志聚合/搜索/告警 | 2-3 天 |
| 前端 API 补全 | 🟡 P1 | tracing/slo/metrics 补 API 文件 | 1 天 |
| 自定义仪表板 | 🟡 P2 | 面板编辑器 | 3-5 天 |
| 性能火焰图 | 🟡 P2 | 前端火焰图组件 | 2-3 天 |

---

## 四、AI/ChatOps 域 (10 模块)

### 4.1 功能覆盖矩阵

| 功能 | 状态 | 后端规模 | 关键能力 | 证据 |
|------|------|---------|---------|------|
| **ChatOps** | ✅ 完整 | chatops 87 Service | 命令处理, 能力映射, 审批, 速率限制, Webhook, 角色权限 | `chatops/service/` |
| **AI 模型** | ✅ 完整 | ai 5 Service | AI 模型 CRUD, LLM Provider | `ai/service/` |
| **Agent 运行** | ✅ 完整 | ai-agent-run 17 Service | Agent 触发/列表/详情, 步骤执行, 取消/重试 | `ai-agent-run/service/` |
| **知识库** | ✅ 完整 | knowledge 19 Service | 知识库空间, 文档, RAG 检索, 知识图谱 | `knowledge/service/` |
| **LLM 推理** | ✅ 完整 | llm 24 Service | LLM Trace, 定价, 模型列表, 成本估算 | `llm/service/` |
| **Prompt 安全** | ⚠️ 缺 Repo | prompt-security 5 Service | Prompt 注入扫描, 安全配置 | `prompt-security/service/` |
| **自愈** | ✅ 完整 | self-healing 9 Service | 自愈动作 CRUD/执行, 历史 | `self-healing/service/` |
| **诊断** | ✅ 完整 | diagnostic 18 Service | 诊断触发, 会话, 症状, 报告, 模式 | `diagnostic/service/` |
| **运行手册** | ✅ 完整 | runbook 9 Service | 手册 CRUD/执行, 历史 | `runbook/service/` |

### 4.2 架构亮点

**chatops 模块** (1751 行 handler, 87 Service, 73 路由 — 平台最大 AI 模块):
- 命令处理(520 行): 命令解析/分发/执行
- 能力映射: 能力 → 角色 → 命令 三层映射
- 审批配置: 审批流程 CRUD
- 速率限制: 请求频率控制
- Webhook: CRUD + 测试 + 日志
- 角色权限: 73 端点覆盖 ChatOps 全生命周期

**knowledge RAG 架构** (555 行 handler, 19 Service):
```
文档 → 向量化 → 向量存储 → RAG 检索 → 问答生成
  │        │           │          │           │
  │        │           │          │           └── LLM 回答
  │        │           │          └────────── 语义检索
  │        │           └───────────────── vector-store
  │        └──────────────────────── code-embedding
  └───────────────────────────── 文档索引
```

**自愈链路**:
```
诊断触发 → 模式匹配 → 自愈动作执行 → 结果验证 → 通知
  │          │            │            │          │
  │          │            │            │          └── notification
  │          │            │            └──────── 健康检查
  │          │            └─────────────────── self-healing
  │          └──────────────────────── diagnostic
  └─────────────────────────── 告警/事件
```

### 4.3 前端交互

| 前端页面 | 行数 | API 调用 | 后端模块 |
|---------|------|---------|---------|
| AIDashboard | 164 | ai-gateway.ts | ai |
| AIAgents | — | ai-agents.ts | ai-agent-run |
| AICostDashboard | 74 | ai-cost.ts | ai |
| AIReview | — | ai-review.ts | ai |
| AIGateway | — | ai-gateway.ts | ai |
| AISecurity | — | ai-security.ts | ai |
| AIDocManagement | — | ai-docs.ts | ai |
| LLMTraceDashboard | — | llm-trace.ts | llm-trace |
| AgentRunDetail | — | agents.ts | ai-agent-run |
| Knowledge | — | knowledge.ts | knowledge |

**前端 API 缺失**: prompt-security 无对应前端 API 文件

### 4.4 子域评分

| 子域 | 评分 | 说明 |
|------|------|------|
| ChatOps | ⭐⭐⭐⭐⭐ | 87 Service, 73 路由, 平台最大 |
| AI 模型 | ⭐⭐⭐⭐ | 5 Service, 基础 CRUD |
| Agent | ⭐⭐⭐⭐ | 17 Service, 运行管理 |
| Knowledge | ⭐⭐⭐⭐⭐ | 19 Service, RAG + 知识图谱 |
| LLM | ⭐⭐⭐⭐ | 24 Service, Trace + 定价 |
| Prompt 安全 | ⭐⭐ | 5 Service, 缺 Repo |
| 自愈/诊断 | ⭐⭐⭐⭐ | 18+9 Service, 完整链路 |
| **综合** | **⭐⭐⭐⭐** | **78% 覆盖, AI 子模块偏薄** |

### 4.5 差距分析

| 差距 | 严重度 | 填补方案 | 工作量 |
|------|--------|---------|--------|
| prompt-security 补 Repo | 🔴 P0 | PostgreSQL 持久化策略 | 0.5 天 |
| AI 子模块增强 | 🟡 P1 | ai-agents/ai-cost/ai-gateway 等补 Service | 3-5 天 |
| Agent 多智能体编排 | 🟡 P2 | Agent 协作/编排引擎 | 5-8 天 |
| LLM Provider 注册 | 🟡 P2 | Provider 插件化 | 2-3 天 |

---

## 五、FinOps/数据域 (15 模块)

### 5.1 功能覆盖矩阵

| 功能 | 状态 | 后端规模 | 关键能力 | 证据 |
|------|------|---------|---------|------|
| **成本管理** | ✅ 完整 | finops 14 Service | 成本管理, 预算控制, FinOps 运营 | `finops/service/` |
| **成本增强** | ✅ 完整 | finops-v2 33 Service | 增强成本分析, v2 版 | `finops-v2/service/` |
| **成本分摊** | ✅ 完整 | cost-allocation 14 Service | 分摊规则, 标签映射 | `cost-allocation/service/` |
| **账单管理** | ✅ 完整 | billing 18 Service | 账单管理, 费用结算 | `billing/service/` |
| **效率分析** | ✅ 完整 | efficiency 48 Service | DORA 指标, 效率评分, 标准化 | `efficiency/service/` |
| **容量规划** | ✅ 完整 | capacity 61 Service | 容量规划, 资源预测, 71 路由 | `capacity/service/` |
| **弹性评分** | ✅ 完整 | resilience-score 22 Service | 弹性评分, 韧性评估 | `resilience-score/service/` |
| **数据目录** | ✅ 完整 | data-catalog 9 Service | 数据目录, 元数据管理 | `data-catalog/service/` |
| **数据质量** | ✅ 完整 | data-quality 13 Service | 质量监控, 规则 | `data-quality/service/` |
| **数据管道** | ✅ 完整 | data-pipeline 12 Service | 数据管道编排 | `data-pipeline/service/` |
| **数据血缘** | ✅ 完整 | data-lineage 10 Service | 血缘追踪 | `data-lineage/service/` |
| **向量存储** | ✅ 完整 | vector-store 5 Service | 向量存储, 嵌入管理 | `vector-store/service/` |
| **供应链** | ✅ 完整 | supply-chain 10 Service | 供应链管理 | `supply-chain/service/` |
| **SBOM** | ✅ 完整 | sbom 14 Service | 物料清单, 依赖分析 | `sbom/service/` |
| **漏洞管理** | ✅ 完整 | vulnerability 9 Service | 漏洞扫描, 管理 | `vulnerability/service/` |

### 5.2 架构亮点

**成本管理链路**:
```
成本采集 → 分摊 → 预算 → 异常检测 → Chargeback → 报告
  │          │       │        │           │          │
  │          │       │        │           │          └── efficiency
  │          │       │        │           └──────── billing
  │          │       │        └────────── finops
  │          │       └─────────────── cost-allocation
  │          └──────────────── finops-v2
  └─────────────────────────── 多云成本
```

**capacity 模块** (61 Service, 71 路由 — FinOps 最深):
- 容量规划: 资源预测
- 需求分析: 趋势分析
- 路由数 71 条, 是平台路由最密集的模块之一

**finops v1/v2 双版本并存**:
- finops: 14 Service, 18 路由, 42 Repo
- finops-v2: 33 Service, 38 路由, 34 Repo
- **建议**: v2 废弃 v1

### 5.3 前端交互

| 前端页面 | 行数 | API 调用 | 后端模块 |
|---------|------|---------|---------|
| FinOps | 1017 | finops.ts | finops |
| CostAllocation | — | cost-allocation.ts | cost-allocation |
| Billing | — | billing.ts | billing |
| Efficiency | — | efficiency.ts | efficiency |
| Capacity | — | capacity.ts | capacity |
| DataQuality | — | data-quality.ts | data-quality |
| DataPipeline | — | data-pipeline.ts | data-pipeline |
| DataLineage | — | data-lineage.ts | data-lineage |
| VectorStore | — | vector-store.ts | vector-store |
| SBOM | — | sbom.ts | sbom |

**前端 API 缺失**: resilience-score, data-catalog, supply-chain, vulnerability 无对应前端 API 文件

### 5.4 子域评分

| 子域 | 评分 | 说明 |
|------|------|------|
| FinOps 成本 | ⭐⭐⭐⭐⭐ | 14+33+14+18 Service, 完整覆盖 |
| 效率/容量 | ⭐⭐⭐⭐⭐ | 48+61 Service, 最深 |
| 弹性 | ⭐⭐⭐⭐ | 22 Service |
| 数据治理 | ⭐⭐⭐⭐ | 目录/质量/管道/血缘 |
| 供应链安全 | ⭐⭐⭐⭐ | SBOM + 漏洞 + 供应链 |
| **综合** | **⭐⭐⭐⭐⭐** | **88% 覆盖, 4 模块缺前端 API** |

### 5.5 差距分析

| 差距 | 严重度 | 填补方案 | 工作量 |
|------|--------|---------|--------|
| 前端 API 补全 | 🟡 P1 | resilience-score/data-catalog/vulnerability 补 API | 1-2 天 |
| finops v1/v2 合并 | 🟡 P1 | 废弃 v1, 统一到 v2 | 3-5 天 |
| DORA 指标补全 | 🟡 P2 | 变更前置/失败率/恢复时间 | 2-3 天 |

---

## 六、配置/低代码/插件域 (16 模块)

### 6.1 功能覆盖矩阵

| 功能 | 状态 | 后端规模 | 关键能力 | 证据 |
|------|------|---------|---------|------|
| **配置管理** | ✅ 完整 | config 65 Service | 5 子 Handler, 91 路由, 配置/审批/漂移/FeatureFlag/GitSync | `config/service/` |
| **配置增强** | ✅ 完整 | config-mgmt-enhanced 11 Service | 增强配置管理, 变更管理 | `config-mgmt-enhanced/service/` |
| **功能开关** | ✅ 完整 | feature-flag 13 Service | 功能开关, 灰度发布 | `feature-flag/service/` |
| **统一配置** | ✅ 完整 | unified-config 5 Service | 统一配置中心 | `unified-config/service/` |
| **全局参数** | ✅ 完整 | global-param 5 Service | 全局参数管理 | `global-param/service/` |
| **低代码** | ✅ 完整 | lowcode 14 Service | 低代码平台, 表单设计 | `lowcode/service/` |
| **插件系统** | ✅ 完整 | plugin 34 Service | 插件 CRUD, 执行引擎 | `plugin/service/` |
| **热加载** | ✅ 完整 | plugin-hotreload 5 Service | 插件热加载 | `plugin-hotreload/service/` |
| **插件市场** | ✅ 完整 | plugin-marketplace 10 Service | 插件市场, 分发 | `plugin-marketplace/service/` |
| **动态表单** | ✅ 完整 | form 16 Service | 动态表单引擎 | `form/service/` |
| **IaC** | ✅ 完整 | iac 21 Service | 基础设施即代码 | `iac/service/` |
| **导入导出** | ✅ 完整 | import-export 6 Service | 数据导入导出 | `import-export/service/` |
| **环境生命周期** | ✅ 完整 | env-lifecycle 5 Service | 环境生命周期管理 | `env-lifecycle/service/` |
| **环境配置** | ✅ 完整 | env-profile 5 Service | 环境配置文件 | `env-profile/service/` |
| **规则引擎** | ⚠️ 缺 Repo | rule-engine 8 Service | 规则引擎, 条件评估 | `rule-engine/service/` |
| **条件引擎** | ✅ 完整 | condition 48 Service | 条件引擎, 表达式解析 | `condition/service/` |
| **工作流引擎** | ⚠️ 0 路由 | workflow 32 Service | 工作流引擎 (0 路由注册) | `workflow/workflow/service/` |

### 6.2 架构亮点

**config 模块** — 平台最复杂模块 (5 子 Handler, 65 Service, 69 Repo, 91 路由):
| 子 Handler | 功能 | 行数 |
|-----------|------|------|
| handler.go | 配置 CRUD | 805 |
| approval_handler.go | 配置审批 | 84 |
| drift_handler.go | 漂移检测 | 64 |
| feature_flag_handler.go | 功能开关 | 103 |
| git_sync_handler.go | GitSync | 79 |

**配置管理全链路**:
```
配置创建 → 审批 → 发布 → 版本管理 → 回滚 → 漂移检测 → GitSync
  │         │       │        │          │        │           │
  │         │       │        │          │        │           └── git_sync_handler
  │         │       │        │          │        └────── drift_handler
  │         │       │        │          └─────────── 版本回滚
  │         │       │        └────────────── 版本管理
  │         │       └─────────────────── 发布
  │         └────────────── approval_handler
  └───────────────────── handler.go
```

**workflow 模块** (32 Service, 30 Repo, 但 0 路由注册):
- 完整 Service/Repo 层, 但 Handler 未注册路由到 wiring.go
- 需确认路由注册方式或补全

### 6.3 前端交互

| 前端页面 | 行数 | API 调用 | 后端模块 |
|---------|------|---------|---------|
| ConfigManagement | 1172 | config.ts | config |
| FeatureFlags | — | feature-flags.ts | feature-flag |
| GlobalParams | — | global-params.ts | global-param |
| LowCode | — | lowcode.ts | lowcode |
| PluginManagement | — | plugin.ts | plugin |
| FormDesigner | — | — | form |
| IaC | — | iac.ts | iac |
| WorkflowDesigner | 1716 | workflow.ts | workflow |

**前端 API 缺失**: config-mgmt-enhanced, unified-config, plugin-hotreload, plugin-marketplace, form, import-export, env-lifecycle, rule-engine, condition 无对应前端 API 文件

### 6.4 子域评分

| 子域 | 评分 | 说明 |
|------|------|------|
| 配置管理 | ⭐⭐⭐⭐⭐ | 65 Service, 91 路由, 平台最复杂 |
| 功能开关 | ⭐⭐⭐⭐ | 13 Service |
| 低代码 | ⭐⭐⭐⭐ | 14 Service |
| 插件系统 | ⭐⭐⭐⭐ | 34+5+10 Service |
| 表单 | ⭐⭐⭐⭐ | 16 Service |
| IaC | ⭐⭐⭐⭐ | 21 Service |
| 规则引擎 | ⭐⭐ | 8 Service, 缺 Repo |
| 工作流 | ⭐⭐ | 32 Service, 0 路由 |
| **综合** | **⭐⭐⭐⭐⭐** | **85% 覆盖, 规则引擎/工作流路由待增强** |

### 6.5 差距分析

| 差距 | 严重度 | 填补方案 | 工作量 |
|------|--------|---------|--------|
| workflow 路由注册 | 🟡 P1 | 补全 RegisterRoutes | 1 天 |
| rule-engine 补 Repo | 🟡 P1 | PostgreSQL 持久化规则 | 0.5 天 |
| 前端 API 补全 | 🟡 P2 | 9 个模块补前端 API 文件 | 3-5 天 |
| lowcode 可视化编辑器 | 🟡 P2 | 流程图编辑器 | 5-10 天 |

---

## 七、跨域/工具层 (13 模块)

### 7.1 功能覆盖矩阵

| 功能 | 状态 | 后端规模 | 关键能力 | 证据 |
|------|------|---------|---------|------|
| **跨域调用** | ⚠️ 缺 Repo | crossover 23 Service | 跨域调用, 23 方法, 缺 Repo+Handler | `crossover/service/` |
| **全局搜索** | ✅ 完整 | global-search 6 路由 | ES 搜索聚合, IndexerRegistry | `global-search/handler/` |
| **审计日志** | ✅ 完整 | audit 12 Service | 审计日志 CRUD | `audit/service/` |
| **合规** | ✅ 完整 | compliance 10 Service | 合规管理 | `compliance/service/` |
| **安全合规** | ✅ 完整 | security-compliance 19 Service | 安全合规管理 | `security-compliance/service/` |
| **Saga 编排** | ✅ 完整 | saga 59 Service | Saga 编排, 分布式事务 | `saga/service/` |
| **API 治理** | ✅ 完整 | api-governance 15 Service | API 治理, 规范 | `api-governance/service/` |
| **测试选择** | ✅ 完整 | test-selector 30 Service | 测试选择, 执行历史 | `test-selector/service/` |
| **队列** | ✅ 完整 | queue 8 Service | 队列管理 | `queue/service/` |
| **分布式锁** | ✅ 完整 | lock — | 分布式锁 | `lock/` |
| **启动编排** | ✅ 完整 | startup 12 Service | 启动编排 | `startup/` |
| **Webhook** | ✅ 完整 | webhook — | Webhook 管理 | `webhook/` |
| **统计** | — | statistics 0 | 孤立工具库, 0 引用 | `statistics/` |

### 7.2 架构亮点

**Saga 编排** (59 Service — 跨域最深):
- Saga 分布式事务协调
- 支持回滚/补偿
- 7 个路由端点

**global-search ES 聚合**:
- IndexerRegistry 编排多索引搜索
- 结果聚合 + 权限过滤
- 6 个路由端点

### 7.3 子域评分

| 子域 | 评分 | 说明 |
|------|------|------|
| Saga | ⭐⭐⭐⭐⭐ | 59 Service, 完整编排 |
| 审计/合规 | ⭐⭐⭐⭐ | 12+10+19 Service |
| 测试选择 | ⭐⭐⭐⭐ | 30 Service |
| crossover | ⭐⭐ | 23 Service, 缺 Repo+Handler |
| 全局搜索 | ⭐⭐⭐ | IndexerRegistry 非标准 |
| **综合** | **⭐⭐⭐** | **70% 覆盖, crossover 是主要缺口** |

### 7.4 差距分析

| 差距 | 严重度 | 填补方案 | 工作量 |
|------|--------|---------|--------|
| crossover 补 Repo+Handler | 🟡 P1 | PostgreSQL Repo + 6 路由 | 1-2 天 |
| statistics 废弃或启用 | 🟡 P2 | 删除或搭建 REST 层 | 0.5 天 |

---

## 八、七域服务方法排行榜

| 排名 | 模块 | 方法数 | 域 | 说明 |
|------|------|--------|------|------|
| 1 | chatops | 87 | AI/ChatOps | 平台最大 AI 模块 |
| 2 | alert-adapter | 92 | 通知/告警 | 多数据源适配器 |
| 3 | tenant | 55 | 身份认证 | 企业级多租户 |
| 4 | condition | 48 | 配置/低代码 | 条件引擎 |
| 5 | capacity | 61 | FinOps/数据 | 容量规划 |
| 6 | efficiency | 48 | FinOps/数据 | 效率分析 |
| 7 | monitoring | 44 | 监控/可观测 | 指标监控 |
| 8 | config | 65 | 配置/低代码 | 平台最复杂 |
| 9 | capability | 64 | 身份认证 | 能力权限 |
| 10 | saga | 59 | 跨域/工具 | Saga 编排 |
| 11 | finops-v2 | 33 | FinOps/数据 | 成本增强 |
| 12 | eventbus | 33 | 监控/可观测 | 事件总线 |
| 13 | workflow | 32 | 配置/低代码 | 工作流引擎 |
| 14 | test-selector | 30 | 跨域/工具 | 测试选择 |

## 九、域间互补闭环

```
身份认证 ──→ 所有域 (认证/授权/租户隔离)
    │
    ├──→ 监控可观测 (Metrics + Traces + Logs)
    │       │
    │       └──→ 通知告警 (Alert → Dedup → Pipeline → Notify)
    │               │
    │               └──→ AI/ChatOps (自愈/诊断)
    │                       │
    │                       └──→ FinOps (成本异常)
    │
    ├──→ 配置/低代码 (配置管理 → 审批 → 发布)
    │       │
    │       └──→ 插件市场 (Plugin → Marketplace)
    │
    └──→ 跨域工具 (Saga/审计/合规/全局搜索)
            │
            └──→ crossover (跨域调用)
```

---

> 关联文档: `docs/three-domain-depth-analysis-2026-08-01.md` (三域深度分析) | `docs/architecture-review-2026-08-01.md` (评审报告) | `docs/ALL_TODOS.md` (待办清单) | `docs/ARCH_FRONTEND.md` (前端架构) | `docs/ARCH_BACKEND.md` (后端架构)