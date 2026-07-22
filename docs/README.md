# Orion 文档索引

> 最后更新: 2026-05-12
> 文档总数: ~239 份
> 组织结构: 按微服务 + 跨领域通用设计

---

## 目录结构

```
docs/
├── README.md                    # 本文档 - 微服务索引表
├── 文档管理规范.md
├── cross-cutting/               # 跨服务通用设计
│   ├── api/                     # API 规范 (4)
│   ├── architecture/            # 全局架构 (37)
│   ├── archive/                 # 历史归档 (2)
│   ├── cache/                   # 缓存设计 (2)
│   ├── event-bus/               # 事件总线 (4)
│   ├── frontend/                # 前端通用 (11)
│   ├── integration/             # 外部集成 (7)
│   └── ui/                      # UI 设计 (3)
├── services/                    # 按微服务组织的文档
├── adr/                         # 架构决策记录 (5)
├── review/                      # 评审报告 (30)
├── requirements/                # 产品需求 (4)
├── migration/                   # 数据迁移 (1)
└── superpowers/                 # 工作会话记录 (6)
```

---

## 微服务文档索引

### 研发效能层

| 微服务 | 文档目录 | 文件数 | 核心文档 |
|--------|---------|--------|---------|
| orion-pipeline-svc | `services/pipeline/` | 8 | 流水线编排、插件系统 |
| orion-code-svc | `services/code/` | 4 | 代码管理、构建环境 |
| orion-artifact-svc | `services/artifact/` | 5 | 制品管理、版本追溯 |
| orion-deploy-svc | `services/deploy/` | 5 | 灰度发布、临时环境 |
| orion-plugin-svc | `services/plugin/` | 6 | 插件框架、工具市场 |
| orion-approval-svc | `services/approval/` | 2 | 审批组件、工作流 |

### AI 智能层

| 微服务 | 文档目录 | 文件数 | 核心文档 |
|--------|---------|--------|---------|
| orion-ai-svc | `services/ai/` | 21 | AI 网关、向量存储、Skill |
| orion-agent-svc | `services/agent/` | 1 | Agent 编排 |
| orion-intelligence-svc | `services/intelligence/` | 2 | AI 决策引擎 |
| orion-knowledge-svc | `services/knowledge/` | 4 | 知识库、RAG |
| orion-skill-svc | (待补充) | 0 | - |

### 可观测性与运维层

| 微服务 | 文档目录 | 文件数 | 核心文档 |
|--------|---------|--------|---------|
| orion-monitor-svc | `services/monitor/` | 9 | 监控告警、可观测性 |
| orion-selfhealing-svc | `services/selfhealing/` | 4 | 自愈引擎、混沌工程 |
| orion-config-mgmt-svc | `services/config-mgmt/` | 3 | GitOps 配置管理 |
| orion-dba-svc | `services/dba/` | 6 | SQL 审核、数据库管理 |

### 安全与合规层

| 微服务 | 文档目录 | 文件数 | 核心文档 |
|--------|---------|--------|---------|
| orion-security-svc | `services/security/` | 12 | 安全扫描、供应链安全 |
| orion-audit-svc | (待补充) | 0 | - |
| orion-risk-svc | (待补充) | 0 | - |

### 运营与协作层

| 微服务 | 文档目录 | 文件数 | 核心文档 |
|--------|---------|--------|---------|
| orion-ticket-svc | `services/ticket/` | 2 | 工单管理 |
| orion-chatops-svc | `services/chatops/` | 3 | ChatOps 命令 |
| orion-efficiency-svc | `services/efficiency/` | 3 | DORA 指标 |
| orion-finops-svc | `services/finops/` | 3 | FinOps 成本 |
| orion-notify-svc | (待补充) | 0 | - |
| orion-community-svc | `services/community/` | 2 | 社区协作 |

### 高级功能层

| 微服务 | 文档目录 | 文件数 | 核心文档 |
|--------|---------|--------|---------|
| orion-dr-svc | `services/dr/` | 3 | 灾备管理 |
| orion-federation-svc | `services/federation/` | 5 | 多云联邦 |
| orion-governance-svc | `services/governance/` | 2 | API 治理 |
| orion-digital-twin-svc | `services/digital-twin/` | 1 | 数字孪生 |
| orion-quality-gate | `services/quality-gate/` | 1 | 质量门禁 |

### 外部服务包装层

| 微服务 | 文档目录 | 文件数 | 状态 |
|--------|---------|--------|------|
| orion-inception-svc | (待补充) | 0 | 外部项目 |
| orion-pandawiki-svc | (待补充) | 0 | 外部项目 |

---

## 跨领域通用设计 (`cross-cutting/`)

| 领域 | 目录 | 文件数 | 说明 |
|------|------|--------|------|
| 全局架构 | `cross-cutting/architecture/` | 37 | 系统架构、拆分分析、服务依赖、Phase 规范 |
| 前端通用 | `cross-cutting/frontend/` | 11 | 前端架构、组件库、微前端 |
| 外部集成 | `cross-cutting/integration/` | 7 | GitLab/Gerrit/Harbor/Nexus 适配、gRPC |
| 事件总线 | `cross-cutting/event-bus/` | 4 | NATS、Event Schema |
| API 规范 | `cross-cutting/api/` | 4 | API 设计、版本管理、分页规范 |
| UI 设计 | `cross-cutting/ui/` | 3 | Design Tokens、线框图、子应用启动器 |
| 缓存层 | `cross-cutting/cache/` | 2 | 缓存设计、历史归档 |
| 综合分析 | 根目录 | 1 | `orion-system-deep-analysis-2026-07-01.md` — 全系统 150 万行综合分析 |
| 档案 | `cross-cutting/archive/` | 2 | OnCall 排班、集成测试脚本 |

### 工作会话记录 (`superpowers/`)

| 类型 | 目录 | 文件数 | 说明 |
|------|------|--------|------|
| Phase 规范索引 | `superpowers/specs/phase1-4/` | 4 | 各阶段规范 README 索引 |
| 历史计划 | `superpowers/plans/archive/` | 2 | 已归档的实施方案 |

---

## 文档覆盖率

| 指标 | 数值 |
|------|------|
| 有文档的微服务 | 26 / 34 (76%) |
| 完全无文档的微服务 | 8 (audit, risk, skill, notify, visor, inception, pandawiki, runner) |
| 待补充文档 | 上述 8 个服务尚未创建文档 |
