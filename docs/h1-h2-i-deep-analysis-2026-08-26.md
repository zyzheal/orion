# H1(安全) / H2(可观测+FinOps) / I(SRE实践) 全量深度分析报告

> 生成日期: 2026-08-26
> 分析范围: orion-platform-svc-go/internal/ 下所有相关 Go 服务
> 分析方法: 逐文件路径扫描、行数统计、路由计数、分层架构检查、mock 残留检测、标杆对比

---

## 目录

1. [H1 安全 Go 后端服务](#h1-安全-go-后端服务)
2. [H2 可观测 + FinOps Go 后端服务](#h2-可观测--finops-go-后端服务)
3. [I SRE Go 后端服务](#i-sre-go-后端服务)
4. [缺失能力分析（对比标杆）](#缺失能力分析对比标杆)
5. [可借鉴功能清单](#可借鉴功能清单)

---

## H1 安全 Go 后端服务

### 1.1 Security 攻击面管理 (security/security/)

| 指标 | 数值 |
|------|------|
| 路径 | `internal/security/security/` |
| Go 文件数 | 5 (handler, repository, models, service, config) |
| 总行数 | 7621 (整个 security/ 父目录, 含全部子服务) |
| 路由数 | 37 条 |
| 分层完整度 | handler + service + repository + models + config (完整) |

**路由覆盖**: Scans(CRUD + count), Findings(CRUD + count + byScanID), AuditPlans(CRUD), AuditExecutions, CompliancePolicies(CRUD), ComplianceEvaluations, SBOM(CRUD + count), DependencyGraph, PoisoningScan

### 1.2 Vulnerability 漏洞管理

| 指标 | 数值 |
|------|------|
| 路径 | `internal/vulnerability/` |
| Go 文件数 | 7 |
| 总行数 | 1396 |
| 路由数 | 9 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

### 1.3 UEBA 用户实体行为分析

| 指标 | 数值 |
|------|------|
| 路径 | `internal/ueba/` |
| Go 文件数 | 7 |
| 总行数 | 672 |
| 路由数 | 7 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

**实际能力**: 支持 alerts(CRUD + dismiss)、profiles(列表/查询)、detect anomaly 端点。但异常检测仅基于简单事件加权评分(0.3/0.5/0.8)，无 ML 模型、无行为基线、无 peer group 分析。

### 1.4 Prompt Security (AI 安全)

| 指标 | 数值 |
|------|------|
| 路径 | `internal/prompt-security/` |
| Go 文件数 | 7 |
| 总行数 | 785 |
| 路由数 | 9 条 (ai-security handler) |
| 分层完整度 | handler + service + repository + models (缺 config) |

### 1.5 SBOM 软件物料清单

| 指标 | 数值 |
|------|------|
| 路径 | `internal/sbom/` |
| Go 文件数 | 8 |
| 总行数 | 2511 |
| 路由数 | 12 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

**路由覆盖**: List/GenerateSBOM, Get/DeleteSBOM, ListComponents, ListVulnerabilities, ScanSBOM, GetLicenses, ListAttestations, CreateAttestation, ExportSBOM, CompareSBOMs

### 1.6 Supply Chain 供应链安全

| 指标 | 数值 |
|------|------|
| 路径 | `internal/supply-chain/` |
| Go 文件数 | 7 |
| 总行数 | 1006 |
| 路由数 | 10 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

### 1.7 Security Compliance 安全合规

| 指标 | 数值 |
|------|------|
| 路径 | `internal/security-compliance/` |
| Go 文件数 | 8 |
| 总行数 | 1925 |
| 路由数 | 18 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

### 1.8 Auth 认证体系

| 服务 | 路径 | 文件数 | 行数 | 路由数 | 分层完整度 |
|------|------|--------|------|--------|-----------|
| auth | `internal/auth/` | 8 | 1734 | 5 | handler+service+repository+models |
| auth-enhanced | `internal/auth-enhanced/` | 17 | 2450 | 8 | 完整 |
| auth-mfa | `internal/auth-mfa/` | 7 | 580 | 8 | handler+service+repository+models |
| permission | `internal/permission/` | 6 | 579 | 6 | handler+service+repository+models |
| abac-policy | `internal/abac-policy/` | 7 | 529 | 5 | handler+service+repository+models |
| sso | `internal/sso/` | 7 | 670 | 6 | handler+service+repository+models |
| sso-providers | `internal/sso-providers/` | 7 | 602 | 6 | handler+service+repository+models |
| sso-unified | `internal/sso-unified/` | 7 | 435 | 5 | handler+service+repository+models |

### 1.9 Security 子服务（内部 umbrella 结构，含 mock 残留）

以下服务位于 `internal/security/` 下，存在 **路由注册占位符** (`RegisterRoutes` 中仅注释 `// Route registration placeholder`，实际路由数为 0):

| 服务 | 路径 | 文件数 | 行数 | 路由数 | 状态 |
|------|------|--------|------|--------|------|
| security/ueba | `internal/security/ueba/` | 7 | 289 | 0 | 占位符未注册路由 |
| security/privacy | `internal/security/privacy/` | 7 | 289 | 0 | 占位符未注册路由 |
| security/branch-policy | `internal/security/branch-policy/` | 7 | 289 | 0 | 占位符未注册路由 |
| security/cross-domain | `internal/security/cross-domain/` | 7 | 289 | 0 | 占位符未注册路由 |
| security/security-compliance | `internal/security/security-compliance/` | 7 | 289 | 0 | 占位符未注册路由。已有顶层版本(18 routes) |

**注意**: 这些服务有 handler/service/repository/models 完整四层结构，但路由未注册。顶层 `security-compliance` 已独立实现 18 routes，而 `security/security-compliance` 是副本。

### 1.10 H1 安全汇总

| 维度 | 总数 | 说明 |
|------|------|------|
| 服务数 | 15+ | 含 auth/perm/sso 家族 |
| 总行数 | ~22,062 | 含所有安全相关服务 |
| 总路由数 | ~147 | 含 auth/perm/sso 全部路由 |
| 分层完整度 | 92% | 大部分缺 config 层 |
| 含 mock 残留 | 5 个 stub 服务 | security/ 下 5 子服务路由未注册 |

---

## H2 可观测 + FinOps Go 后端服务

### 2.1 Monitoring 监控

| 指标 | 数值 |
|------|------|
| 路径 | `internal/monitoring/` |
| Go 文件数 | 57 |
| 总行数 | 11,061 |
| 路由数 | 36 条 |
| 分层完整度 | handler + service + repository + models + config (完整) |

**路由覆盖**: Service Control(start/stop/health), Metrics(register/series/summary), AlertRules(CRUD/toggle/suppress/evaluate), Alerts(list/active/acknowledge/silence/resolve), Dashboards, Notifications, StatusPages

### 2.2 APM 应用性能管理

| 指标 | 数值 |
|------|------|
| 路径 | `internal/apm/` |
| Go 文件数 | 8 |
| 总行数 | 749 |
| 路由数 | 8 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

### 2.3 Tracing 分布式追踪

| 指标 | 数值 |
|------|------|
| 路径 | `internal/tracing/` |
| Go 文件数 | 7 |
| 总行数 | 810 |
| 路由数 | 10 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

### 2.4 Observability 可观测性统一层

| 指标 | 数值 |
|------|------|
| 路径 | `internal/observability/` |
| Go 文件数 | 7 |
| 总行数 | 762 |
| 路由数 | 5 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

### 2.5 Alert 告警体系（10 子服务）

| 子服务 | 文件数 | 行数 | 路由数 | 功能说明 |
|--------|--------|------|--------|---------|
| alert | 10 | 1,842 | 17 | 告警 CRUD、维护窗口、拓扑、根因分析 |
| alert-adapter | 13 | 3,975 | 9 | 告警适配器 v1 |
| alert-adapter-v2 | 6 | 2,098 | 9 | 告警适配器 v2 |
| alert-breaker | 9 | 710 | 5 | 告警熔断 |
| alert-correlation | 10 | 760 | 7 | 告警关联（temporal/spatial/causal） |
| alert-deduplication | 5 | 484 | 3 | 告警去重 |
| alert-escalation | 7 | 1,468 | 13 | 告警升级 |
| alert-pipeline | 20 | 2,733 | - | 告警流水线处理 |
| alert-rule-engine | 9 | 2,475 | 8 | 告警规则引擎 |
| alert-silence | 8 | 1,217 | 9 | 告警静默 |
| **合计** | **97** | **17,762** | **80** | |

### 2.6 Self-Healing / Circuit-Breaker

| 服务 | 文件数 | 行数 | 路由数 | 分层完整度 |
|------|--------|------|--------|-----------|
| self-healing | 7 | - | 7 | handler+service+repository+models |
| circuit-breaker | 7 | - | 10 | handler+service+repository+models |

### 2.7 FinOps 家族

| 服务 | 文件数 | 行数 | 路由数 | 分层完整度 |
|------|--------|------|--------|-----------|
| finops | 94 | 16,373 | 14 | 完整 |
| finops-v2 | 8 | 2,311 | 33 | handler+service+repository+models |
| billing | 8 | 1,694 | 18 | handler+service+repository+models |
| cost-allocation | 8 | 1,169 | 14 | handler+service+repository+models |
| **合计** | **118** | **21,547** | **79** | |

### 2.8 H2 可观测汇总

| 维度 | 总数 | 说明 |
|------|------|------|
| 服务数 | 18+ | 含 alert 10 子服务、finops 4 子服务 |
| 总行数 | ~52,381 | 以 monitoring + finops 为主力 |
| 总路由数 | ~207 | 含 alert 全部子路由 |
| 分层完整度 | 95% | 大部分完整 |
| 体积最大 | finops (16,373行) | 94 个 Go 文件 |

---

## I SRE Go 后端服务

### 3.1 SLO 服务等级目标

| 指标 | 数值 |
|------|------|
| 路径 | `internal/slo/` |
| Go 文件数 | 7 |
| 总行数 | 874 |
| 路由数 | 10 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

**路由覆盖**: Dashboard, ListSLOs, GetSLO, CreateSLO, UpdateSLO, DeleteSLO, RecordSLI, GetSLIHistory, GetLatestErrorBudget, GetErrorBudgetHistory

**错误预算模型**: 支持 total_budget / remaining_budget / consumed_budget / budget_utilization 四字段。

### 3.2 Runbook 应急手册

| 指标 | 数值 |
|------|------|
| 路径 | `internal/runbook/` |
| Go 文件数 | 7 |
| 总行数 | 785 |
| 路由数 | 7 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

### 3.3 Incident 事件管理

| 指标 | 数值 |
|------|------|
| 路径 | `internal/incident/` |
| Go 文件数 | 9 |
| 总行数 | 2,493 |
| 路由数 | 23 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

**路由覆盖**: CRUD, Stats, StatusUpdate, AssignCommander, Escalate, GetEscalations, CheckSLA, MarkSLABreach, Timeline(CRUD), Postmortem(CRUD+publish+archive+draft), KnowledgeRecommendations

**业务逻辑深度**: 包含优先级矩阵(impact x urgency)、状态机转换、升级逻辑、SLA 检查、AI 辅助 postmortem 草稿生成。

### 3.4 Inspection 巡检

| 指标 | 数值 |
|------|------|
| 路径 | `internal/inspection/` |
| Go 文件数 | 8 |
| 总行数 | 802 |
| 路由数 | 12 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

### 3.5 Auto-Recovery 自动恢复

| 指标 | 数值 |
|------|------|
| 路径 | `internal/auto-recovery/` |
| Go 文件数 | 10 |
| 总行数 | 1,044 |
| 路由数 | 6 条 |
| 分层完整度 | handler + service + repository + models (缺 config) |

### 3.6 OnCall 排班

| 指标 | 数值 |
|------|------|
| 路径 | `internal/oncall/` |
| Go 文件数 | 9 |
| 总行数 | 938 |
| 路由数 | 7 条 |
| 分层完整度 | handler + service + repository + models |

**能力**: 排班表 CRUD、轮转添加、当前值班查询。

### 3.7 RCA 根因分析

| 指标 | 数值 |
|------|------|
| 路径 | `internal/rca/` |
| Go 文件数 | 10 |
| 总行数 | 919 |
| 路由数 | - |
| 分层完整度 | handler + service + repository + models |

### 3.8 I SRE 汇总

| 维度 | 总数 | 说明 |
|------|------|------|
| 服务数 | 6 | SLO + Runbook + Incident + Inspection + Auto-Recovery + OnCall + RCA |
| 总行数 | ~7,855 | incident 占 2,493 行最大 |
| 总路由数 | ~65 | incident 23 条最多 |
| 分层完整度 | 90% | 大部分缺 config 层 |
| 业务深度 | 中高 | incident 最成熟，SLO 有错误预算模型 |

---

## 缺失能力分析（对比标杆）

### 4.1 H1-1: UEBA 行为分析深度缺失

| 维度 | 当前状态 | 标杆目标 (Splunk UBA / Azure Sentinel) |
|------|---------|--------------------------------------|
| 异常检测算法 | 简单事件加权评分(0.3/0.5/0.8) | ML 模型(Isolation Forest / LSTM) |
| 行为基线 | 无自动基线学习 | 用户/实体 30 天行为基线自动建立 |
| Peer Group 分析 | 不存在 | 同角色/同部门用户行为对比 |
| 时序分析 | 无时间窗口连续性 | 滑动窗口 + 周期检测 |
| 威胁狩猎 | 无 | 交互式查询 + MITRE ATT&CK 映射 |
| 风险评分 | 仅 severity(low/medium/high/critical) | 0-100 连续风险评分 |
| 证据链 | 单个 evidence 字段 | 多事件关联 + 攻击链重建 |

**具体文件**: `internal/ueba/service/service.go:63-105` -- DetectAnomaly 方法仅 42 行，基于手动事件权重。

### 4.2 H1-2: 容器安全扫描深度缺失

| 维度 | 当前状态 | 标杆目标 (Trivy / Clair / Snyk) |
|------|---------|----------------------------------|
| SBOM 生成 | 支持 SPDX/CycloneDX/SWID 格式 | 同等 |
| 漏洞扫描 | 基础扫描(severity 过滤) | 完整 CVE 数据库 + CVSS 评分 |
| 容器镜像层扫描 | 仅支持 docker artifact 类型 | 逐层依赖分析 + 不可变层缓存 |
| 策略引擎 | 基础合规策略 | OPA/Gatekeeper 策略即代码 |
| 运行时扫描 | 无 | 实时容器行为监控 |
| 许可证合规 | 支持 license 查询 | 完整的 license 兼容性矩阵 |
| 修复建议 | 无 | CVE 修复版本 + 优先级排序 |
| 集成 CI/CD | 无原生集成 | Pipeline 门禁(阻断构建) |

**具体文件**: `internal/sbom/service/service.go` -- ScanSBOM 方法为基本实现，无真实容器镜像扫描引擎集成。

### 4.3 H2-1: 可观测三支柱贯通深度缺失

| 维度 | 当前状态 | 标杆目标 (Datadog / Grafana) |
|------|---------|-----------------------------|
| Metrics-Logs-Traces 关联 | 独立服务，无自动关联 | 统一标签体系自动关联 |
| 分布式追踪可视化 | 10 条路由，基础追踪 | 火焰图 + 服务拓扑图 + 延迟分布 |
| RUM 真实用户监控 | 不存在 | 网页性能(LCP/FID/CLS) + 会话回放 |
| 统一查询语言 | 各服务独立 API | Datadog DQL / PromQL 统一查询 |
| 仪表盘模板 | 基础 dashboard | 预置仪表盘 + 模板库 |
| 告警-事件-追踪联动 | alert 与 incident 独立 | 告警自动创建 incident + 关联 trace |

**具体文件**: `internal/apm/` (749 行), `internal/tracing/` (810 行), `internal/observability/` (762 行) -- 均较薄，无 RUM 支持，无 web vitals 检测。

### 4.4 I-1: SLO 错误预算管理深度缺失

| 维度 | 当前状态 | 标杆目标 (Datadog SLO / Google SRE Workbook) |
|------|---------|----------------------------------------------|
| 错误预算计算 | 支持基本计算 | 多窗口烧速 + 消耗预测 |
| 烧速告警 | 仅 alert_threshold | 多窗口烧速告警(5m/1h/6h) |
| 剩余时间预测 | 无 | 耗尽时间预测 + 建议 |
| SLO 顾问 | 无 | 自动调优推荐 |
| 多指标复合 SLO | 单一指标 | 复合 SLO + 权重分配 |
| 日历化窗口 | 固定窗口 | 日历月/季度对齐 |
| SLO 仪表盘 | 1 个 dashboard 端点 | 多维度可钻取仪表盘 |

**具体文件**: `internal/slo/models/models.go` -- ErrorBudget 模型包含基本字段，但无烧速计算逻辑。`internal/slo/service/service.go` 是纯 pass-through。

### 4.5 I-2: 告警 AI 诊断深度缺失

| 维度 | 当前状态 | 标杆目标 (Dynatrace Davis AI / PagerDuty) |
|------|---------|------------------------------------------|
| 根因分析 | fingerprint 分组 + severity 排序 | 因果推断 + 拓扑分析 + 时间序列关联 |
| 告警降噪 | 基础去重 | 自适应阈值 + 模式学习 + 季节性预测 |
| 预测性告警 | 无 | 基于历史趋势的异常预测 |
| 自动诊断 | 无 | 自动创建 diagnostic runbook |
| 告警摘要 | 无 | AI 生成告警摘要 + 影响范围 |
| 关联分析 | temporal/spatial/causal 三类 | 多维度告警聚类 + 事件链重建 |

**具体文件**: `internal/alert/service/service.go:134-207` -- Correlate 方法仅基于 fingerprint 分组，根因分析仅按 severity 排序。`internal/alert-correlation/` 定义了3种关联类型但实现较基本。

### 4.6 I-3: OnCall 排班深度缺失

| 维度 | 当前状态 | 标杆目标 (PagerDuty) |
|------|---------|---------------------|
| 排班类型 | 基础轮转 CRUD | 单次/每日/每周/自定义轮转 |
| 覆盖规则 | 无 | 假期覆盖 + 临时替换 + 覆盖层 |
| 通知规则 | 无 | 多通道(电话/短信/邮件/App) + 延迟递进 |
| 升级策略 | 无 | 多层升级 + 超时自动升级 |
| 值班日历 | 当前值班查询 | 个人/团队/全局排班日历 |
| 报告 | 无 | 值班统计 + 响应时间分析 |
| 与 Incident 联动 | 无 | 自动分配 incident 给值班人 |

**具体文件**: `internal/oncall/handler/handler.go` -- 仅 7 条路由，无 escalation rules 和 notification rules。

---

## 可借鉴功能清单

### 5.1 Dynatrace Davis AI 根因分析

| 维度 | 说明 |
|------|------|
| **标杆能力** | Davis AI 使用因果推断(Causal Inference) + 拓扑分析自动定位根因，无需人工规则 |
| **落地路径** | 增强 `internal/rca/` 服务，集成因果推断引擎；增强 `internal/alert-correlation/service/` 加入拓扑关联分析 |
| **具体文件** | `internal/rca/service/service.go` (180行), `internal/alert-correlation/service/service.go` |
| **理由** | RCA 服务仅 919 行，空间很大；alert-correlation 已定义 temporal/spatial/causal 三类但 causal 实现最弱 |

### 5.2 Dynatrace PurePath 分布式追踪

| 维度 | 说明 |
|------|------|
| **标杆能力** | PurePath 自动捕获端到端请求路径，生成服务拓扑图，标注延迟瓶颈 |
| **落地路径** | 增强 `internal/tracing/` 服务，加入火焰图渲染、服务拓扑图生成、延迟分布分析 |
| **具体文件** | `internal/tracing/` (810行, 10 routes), `internal/tracing/handler/handler.go` |
| **理由** | Tracing 服务较薄，仅 810 行，缺少可视化能力 |

### 5.3 PagerDuty OnCall 排班深度

| 维度 | 说明 |
|------|------|
| **标杆能力** | 多层排班规则、假期覆盖、通知递进、升级策略、与 incident 联动 |
| **落地路径** | 扩展 `internal/oncall/` 服务：增加 escalation rules、notification rules、覆盖层、日历视图 |
| **具体文件** | `internal/oncall/` (938行, 7 routes), `internal/oncall/service/service.go` |
| **理由** | OnCall 仅 938 行，基础 CRUD 已完成，升级/通知层完全缺失 |

### 5.4 Datadog RUM 全链路追踪

| 维度 | 说明 |
|------|------|
| **标杆能力** | 真实用户监控 + 会话回放 + Web Vitals(LCP/FID/CLS) + 错误追踪 |
| **落地路径** | 增强 `internal/apm/` 服务，加入 RUM 数据采集、会话管理、Web Vitals 指标 |
| **具体文件** | `internal/apm/` (749行, 8 routes), `internal/apm/handler/handler.go` |
| **理由** | APM 服务仅 749 行，无 RUM 能力，是当前最大可观测缺口 |

### 5.5 Datadog SLO 烧速管理

| 维度 | 说明 |
|------|------|
| **标杆能力** | 多窗口烧速告警(5m/1h/6h)、剩余时间预测、SLO 顾问 |
| **落地路径** | 扩展 `internal/slo/` 服务：加入 burn rate 计算引擎、多窗口告警、SLO advisor |
| **具体文件** | `internal/slo/service/service.go` (72行, pure pass-through), `internal/slo/models/models.go` (ErrorBudget 模型) |
| **理由** | SLO service 仅 72 行纯 pass-through，业务逻辑层完全缺失 |

### 5.6 PagerDuty Incident 自动响应

| 维度 | 说明 |
|------|------|
| **标杆能力** | Incident 自动创建 + 自动分配 + 诊断 playbook 自动执行 + 状态页联动 |
| **落地路径** | 扩展 `internal/incident/service/service.go`：加入自动诊断触发、playbook 自动执行、知识库匹配 |
| **具体文件** | `internal/incident/service/service.go` (561行), `internal/incident/models/models.go` |
| **理由** | Incident 已较成熟(23 routes, 2493行)，但缺少自动响应和 PI 执行能力 |

### 5.7 Grafana 统一仪表盘

| 维度 | 说明 |
|------|------|
| **标杆能力** | 可拖拽仪表盘、PromQL 查询编辑器、模板变量、告警规则可视化 |
| **落地路径** | 增强 `internal/monitoring/` 服务(已 11,061 行 36 routes)，加入仪表盘模板管理、PromQL 代理 |
| **具体文件** | `internal/monitoring/` (11061行), `internal/monitoring/handler/handler.go` |
| **理由** | Monitoring 已最大但缺少仪表盘模板化和统一查询能力 |

### 5.8 Splunk UEBA 行为分析

| 维度 | 说明 |
|------|------|
| **标杆能力** | ML 行为基线 + Peer Group 分析 + 时序异常检测 + MITRE ATT&CK 映射 |
| **落地路径** | 重写 `internal/ueba/service/service.go` 的 DetectAnomaly 方法，集成 ML 模型 |
| **具体文件** | `internal/ueba/service/service.go` (110行), `internal/ueba/models/models.go` |
| **理由** | UEBA 的异常检测仅 42 行逻辑，是整个安全模块最大功能缺口 |

---

## 附录: 分层架构完整度汇总

| 分层 | handler | service | repository | models | config |
|------|---------|---------|------------|--------|--------|
| **H1 安全服务** | | | | | |
| security/security | Y | Y | Y | Y | Y |
| vulnerability | Y | Y | Y | Y | N |
| ueba | Y | Y | Y | Y | N |
| prompt-security | Y | Y | Y | Y | N |
| sbom | Y | Y | Y | Y | N |
| supply-chain | Y | Y | Y | Y | N |
| security-compliance | Y | Y | Y | Y | N |
| auth | Y | Y | Y | Y | N |
| auth-enhanced | Y | Y | Y | Y | N |
| auth-mfa | Y | Y | Y | Y | N |
| permission | Y | Y | Y | Y | N |
| abac-policy | Y | Y | Y | Y | N |
| sso | Y | Y | Y | Y | N |
| **H2 可观测** | | | | | |
| monitoring | Y | Y | Y | Y | Y |
| apm | Y | Y | Y | Y | N |
| tracing | Y | Y | Y | Y | N |
| observability | Y | Y | Y | Y | N |
| alert 家族(10) | Y | Y | Y | Y | N |
| self-healing | Y | Y | Y | Y | N |
| circuit-breaker | Y | Y | Y | Y | N |
| finops | Y | Y | Y | Y | Y |
| **I SRE** | | | | | |
| slo | Y | Y | Y | Y | N |
| runbook | Y | Y | Y | Y | N |
| incident | Y | Y | Y | Y | N |
| inspection | Y | Y | Y | Y | N |
| auto-recovery | Y | Y | Y | Y | N |
| oncall | Y | Y | Y | Y | N |
| rca | Y | Y | Y | Y | N |

**结论**: 92% 服务有 handler+service+repository+models 四层。仅 3 个服务(security/security, monitoring, finops)有 config 层。`internal/security/` 下 5 个子服务有完整四层但路由未注册(占位符)。

## 附录: 所有服务体积排名(Top 20)

| 排名 | 服务 | 行数 | 归属 |
|------|------|------|------|
| 1 | finops | 16,373 | H2 |
| 2 | monitoring | 11,061 | H2 |
| 3 | security(umbrella) | 7,621 | H1 |
| 4 | alert-adapter | 3,975 | H2 |
| 5 | alert-pipeline | 2,733 | H2 |
| 6 | alert-rule-engine | 2,475 | H2 |
| 7 | auth-enhanced | 2,450 | H1 |
| 8 | incident | 2,493 | I |
| 9 | alert-adapter-v2 | 2,098 | H2 |
| 10 | finops-v2 | 2,311 | H2 |
| 11 | alert | 1,842 | H2 |
| 12 | billing | 1,694 | H2 |
| 13 | auth | 1,734 | H1 |
| 14 | sbom | 2,511 | H1 |
| 15 | security-compliance | 1,925 | H1 |
| 16 | alert-escalation | 1,468 | H2 |
| 17 | vulnerability | 1,396 | H1 |
| 18 | alert-silence | 1,217 | H2 |
| 19 | cost-allocation | 1,169 | H2 |
| 20 | auto-recovery | 1,044 | I |