# 文档-微服务映射评审报告

> 评审日期: 2026-05-12
> 微服务总数: 34 个
> 文档总数: 240 个

---

## 一、总体结论

**当前文档组织方式**: 按功能域分类（ai、architecture、sre 等）
**是否按微服务整理**: 否
**文档覆盖率**: 34 个微服务中仅 16 个有对应文档（47%），18 个完全缺失（53%）

---

## 二、微服务-文档映射表

### 有文档的微服务（16 个）

| 微服务 | 文档位置 | 文件数 | 匹配度 |
|--------|---------|--------|--------|
| **orion-pipeline-svc** | `docs/cicd/` | 3 | 匹配 |
| **orion-code-svc** | `docs/architecture/code-management-build-design.md` + `docs/frontend/code-mgmt-*.md` | 3 | 分散 |
| **orion-artifact-svc** | `docs/artifact/` | 3 | 匹配 |
| **orion-deploy-svc** | `docs/architecture/hotfix-channel-design.md` + `ephemeral-dev-environments-design.md` | 2 | 分散 |
| **orion-security-svc** | `docs/security/` | 8 | 匹配 |
| **orion-plugin-svc** | `docs/architecture/plugin-framework-design.md` + `plugin-spi-examples.md` | 2 | 分散 |
| **orion-knowledge-svc** | `docs/knowledge/` | 4 | 匹配 |
| **orion-ai-svc** | `docs/ai/` | 19 | 匹配 |
| **orion-chatops-svc** | `docs/collaboration/` | 3 | 部分匹配 |
| **orion-cmdb-svc** | `docs/cmdb/` + `docs/db/CMDB-数据库 Schema 设计.md` | 4 | 分散 |
| **orion-dba-svc** | `docs/db/` | 6 | 匹配 |
| **orion-efficiency-svc** | `docs/efficiency/` | 2 | 匹配 |
| **orion-finops-svc** | `docs/efficiency/FinOps-成本数据采集设计.md` | 1 | 分散 |
| **orion-monitor-svc** | `docs/sre/` 中 ~5 个文件 | 5 | 分散 |
| **orion-selfhealing-svc** | `docs/sre/自愈引擎-Agent 协作设计.md` + `docs/frontend/self-healing-frontend-design.md` | 2 | 分散 |
| **orion-dr-svc** | `docs/sre/灾备与备份恢复设计.md` | 1 | 匹配 |

### 仅有远期 spec 的微服务（3 个）

| 微服务 | 文档位置 | 说明 |
|--------|---------|------|
| **orion-federation-svc** | `docs/superpowers/specs/phase3/03-federation-scheduling-spec.md` | Phase 3 远期规划 |
| **orion-digital-twin-svc** | `docs/superpowers/specs/phase4/01-digital-twin-spec.md` | Phase 4 远期规划 |
| **orion-community-svc** | `docs/superpowers/specs/phase3/11-community-ecosystem-spec.md` | Phase 3 远期规划 |

### 完全无文档的微服务（15 个）

| 微服务 | 推测归属功能域 | 优先级 |
|--------|--------------|--------|
| **orion-approval-svc** | 在 `docs/frontend/审批组件库.md` 有部分前端文档，缺少后端设计 | P1 |
| **orion-audit-svc** | 在 `docs/db/sql-audit-design.md` 有部分设计，缺少服务层文档 | P1 |
| **orion-notify-svc** | 无 | P1 |
| **orion-ticket-svc** | 在 `docs/review/` 有 2 个评审报告，但无设计文档 | P1 |
| **orion-skill-svc** | 在 `docs/ai/skill-marketplace-design.md` 有部分设计 | P2 |
| **orion-graph-svc** | 在 `docs/ai/PageRank 图数据更新设计.md` + `gnn-and-rl-design.md` | P2 |
| **orion-intelligence-svc** | 在 `docs/architecture/ai-change-intelligence-design.md` | P2 |
| **orion-agent-svc** | 在 `docs/architecture/ai-agent-orchestration-design.md` | P2 |
| **orion-config-mgmt-svc** | 在 `docs/iac/` (2 个文件) | P2 |
| **orion-runner-svc** | 在 `docs/cicd/` 中无独立文件 | P2 |
| **orion-visor-svc** | 无（外部项目，前端子应用已接入） | P3 |
| **orion-governance-svc** | 无 | P3 |
| **orion-inception-svc** | 无 | P3 |
| **orion-risk-svc** | 无 | P3 |
| **orion-pandawiki-svc** | 与 knowledge-svc 共用文档 | P3 |

---

## 三、文档散落问题

### 3.1 跨目录散落的文档（同一服务文档分布在 2+ 个目录）

| 服务 | 散落位置 |
|------|---------|
| orion-code-svc | `architecture/` + `frontend/` (2 个目录) |
| orion-deploy-svc | `architecture/` 中混杂在 70+ 个文件中 |
| orion-cmdb-svc | `cmdb/` + `db/` |
| orion-finops-svc | `efficiency/` 中与 DORA 指标混在一起 |
| orion-monitor-svc | `sre/` 中 11 个文件难以区分哪些属于 monitor |
| orion-selfhealing-svc | `sre/` + `frontend/` |
| orion-plugin-svc | `architecture/` 中混杂 |
| orion-agent-svc | `architecture/` 中混杂 |
| orion-chatops-svc | `collaboration/` 中与工单混在一起 |

### 3.2 architecture/ 目录过度拥挤（72 个文件）

这是最大的问题。`architecture/` 包含了：
- 全局架构设计（6 个）— 应保留
- 单个服务的设计文档（~25 个）— 应归到服务目录
- 跨服务设计（~10 个）— 应归到 cross-cutting
- 分析报告（~5 个）— 应归到 review/
- archive/（5 个）— 可考虑清理

---

## 四、推荐方案

### 方案 A：按微服务重组（推荐，改造幅度大）

```
docs/
├── README.md                    # 文档索引
├── 文档管理规范.md
├── cross-cutting/               # 跨服务通用文档
│   ├── api/                     # API 规范 (3)
│   ├── event-bus/               # NATS/EventBus (4)
│   ├── security/                # 安全通用设计 (8)
│   ├── architecture/            # 全局架构 (6)
│   ├── frontend/                # 前端通用规范 (10)
│   ├── integration/             # 外部集成 (5)
│   └── ui/                      # Design Tokens 等 (3)
├── services/                    # 按微服务组织
│   ├── pipeline/                # orion-pipeline-svc (3)
│   ├── code/                    # orion-code-svc (3)
│   ├── artifact/                # orion-artifact-svc (3)
│   ├── agent/                   # orion-agent-svc (1)
│   ├── deploy/                  # orion-deploy-svc (2)
│   ├── runner/                  # orion-runner-svc (0, 待补充)
│   ├── security/                # orion-security-svc (+cross-cutting/security/)
│   ├── plugin/                  # orion-plugin-svc (2)
│   ├── knowledge/               # orion-knowledge-svc (4)
│   ├── ai/                      # orion-ai-svc (19)
│   ├── chatops/                 # orion-chatops-svc (3)
│   ├── cmdb/                    # orion-cmdb-svc (4)
│   ├── dba/                     # orion-dba-svc (6)
│   ├── efficiency/              # orion-efficiency-svc (2)
│   ├── finops/                  # orion-finops-svc (1)
│   ├── monitor/                 # orion-monitor-svc (5)
│   ├── selfhealing/             # orion-selfhealing-svc (2)
│   ├── dr/                      # orion-dr-svc (1)
│   ├── audit/                   # orion-audit-svc (1, 待补充)
│   ├── approval/                # orion-approval-svc (0, 待补充)
│   ├── notify/                  # orion-notify-svc (0, 待补充)
│   ├── ticket/                  # orion-ticket-svc (0, 待补充)
│   ├── config-mgmt/             # orion-config-mgmt-svc (2)
│   ├── skill/                   # orion-skill-svc (1)
│   ├── graph/                   # orion-graph-svc (2)
│   ├── intelligence/            # orion-intelligence-svc (1)
│   ├── federation/              # orion-federation-svc (1 spec)
│   ├── digital-twin/            # orion-digital-twin-svc (1 spec)
│   └── visor/                   # orion-visor-svc (0)
├── review/                      # 评审报告 (11)
├── adr/                         # 架构决策记录 (8)
├── requirements/                # 产品需求 (3)
└── migration/                   # 数据迁移 (1)
```

**优点**：
- 每个服务文档一目了然
- 新增服务直接创建对应目录
- 服务间依赖关系清晰
- 新成员快速定位某个服务的文档

**缺点**：
- 需要移动 ~150 个文件
- architecture/ 需拆分为多个部分
- 跨服务文档的归属需要判断

### 方案 B：渐进重组（折中，改动小）

仅处理 `architecture/` 的 72 个文件，将其中的服务级设计文档移到 `docs/services/` 对应目录，其余保持现状。

**改动量**：~25 个文件

### 方案 C：保持现状

不重组，仅在 `docs/README.md` 中增加微服务索引表，指向散落在各功能域目录中的文档。

**改动量**：1 个文件（README.md）

---

## 五、评审建议

1. **推荐方案 A**，分两阶段执行：
   - 阶段 1：拆分 `architecture/`（72→30 个文件），创建 `docs/services/` 骨架
   - 阶段 2：按服务逐个移动文件

2. **15 个无文档的微服务**应在新服务创建流程中作为 checklist 项

3. **cross-cutting/ 目录**存放跨服务通用设计（安全、API规范、EventBus等），避免单个服务目录膨胀
