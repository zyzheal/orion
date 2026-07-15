# TS 微服务迁移 Go 的完整逻辑链

**生成日期**: 2026-07-02
**依据文档**: go-service-unification-design.md (v1.1), service-authority-registry.md, 清理与待实现清单

---

## 一、核心决策原则（v1.1 修正后）

> **行数不是迁移依据，功能重叠才是。**

迁移决策的三层判断：

```
第 1 层：功能域是否一致？
    │
    ├── 不一致（0% 重叠）→ 永久双版本，不可迁移
    │                       inception/governance/risk
    │
    └── 一致 → 进入第 2 层
            │
            ▼
第 2 层：Go 是否已覆盖 TS 的全部 API？
    │
    ├── 已覆盖 → 切 API Gateway 路由（可立即迁移）
    │           runner, digital-twin
    │
    ├── 部分覆盖 → 先补充 Go，再切换
    │           config-mgmt, skill, pipeline, ticket, deploy 等
    │
    └── 未覆盖 → 新建 Go 版本
                ai-svc, tool-svc
```

---

## 二、31 个 TS 微服务分类

### 2.1 分类总览

| 类别 | 数量 | 操作 | 说明 |
|------|------|------|------|
| **永久双版本** | 3 | 独立演进 | inception, governance, risk（0% 功能重叠） |
| **可立即迁移** | 2 | 切路由 | runner, digital-twin |
| **需先补充 Go** | 16 | 补充后切换 | pipeline, ticket, deploy, code, finops 等 |
| **需新建 Go** | 1 | 从零开始 | ai-svc（19599 行） |
| **需补充少量** | 4 | 补充至 500+ | graph, pandawiki, intelligence, tool |
| **仅 TS 无 Go** | 3 | 暂不迁移 | agent, knowledge, dba |
| **Python 路径** | 3 | 不走 Go | ai-agents, intelligence, llm |

> **注意**: auth-svc, tenant-svc, user-svc 是 Go 存根（各 9-31 行），不是 TS 服务。

### 2.2 详细分类

#### A. 永久双版本（3 个）— 不可迁移

| 服务 | TS 实际功能 | Go 实际功能 | 重叠度 |
|------|------------|------------|--------|
| inception | SQL 审核引擎 (parse/execute/audit/validate) | 审计项目管理 (projects/count) | **0%** |
| governance | API 合约治理 (contracts/versions/deprecations) | 策略管理 (policies CRUD) | **0%** |
| risk | 风险评估引擎 (assessments/scores/trend/events) | 风险条目 CRUD (risks CRUD) | **0%** |

**判定**: 同名不同域，永久双版本，独立演进。

#### B. 可立即迁移（2 个）— 切 API Gateway 路由

| 服务 | Go 行数 | TS 行数 | 功能重叠 | 端口 |
|------|---------|---------|---------|------|
| runner | 2,171 | 766 | ~10% | 3028 |
| digital-twin | 2,261 | 1,149 | ~60% | 3008 |

**操作**: 更新 API Gateway 路由配置，将请求转发到 Go 端口，冻结 TS 目录。

#### C. 需先补充 Go（16 个）— 按优先级排序

| 优先级 | 服务 | Go 行数 | TS 行数 | 差距 | 需补充内容 |
|--------|------|---------|---------|------|-----------|
| P0 | pipeline | 3,478 | 26,197 | ~22,700 | Stage 编排, Task Runner, SSE 日志, 审批门禁, 版本管理, 模板系统, 并发控制 |
| P0 | code | 1,873 | 13,379 | ~11,500 | Git 集成, Webhook 处理, 代码扫描, 分支管理, MR 审查 |
| P1 | ticket | 7,321 | 13,816 | ~6,500 | SLA 引擎, 工单分析, 批量操作 |
| P1 | deploy | 1,197 | 6,732 | ~5,500 | 灰度发布, K8s 集成, 部署窗口, 审批流, 环境管理 |
| P1 | finops | 2,500 | 8,383 | ~5,900 | 云成本采集, K8s 成本分摊, ROI 分析 |
| P1 | chatops | 2,853 | 9,185 | ~6,300 | IM 集成, 命令路由, Webhook 处理 |
| P1 | security | 1,276 | 7,759 | ~6,500 | 漏洞扫描, 供应链安全, 合规框架 |
| P2 | efficiency | 1,239 | 5,509 | ~4,300 | DORA 指标, 效能报告 |
| P2 | plugin | 950 | 4,446 | ~3,500 | 插件市场, 生命周期管理 |
| P2 | artifact | 1,184 | 3,580 | ~2,400 | 制品版本管理, 溯源 |
| P2 | approval | 1,411 | 2,890 | ~1,500 | 审批流引擎 |
| P2 | community | 1,711 | 3,035 | ~1,300 | 反馈机制 |
| P2 | selfhealing | 1,108 | 2,313 | ~1,200 | 自愈策略 |
| P2 | dr | 2,156 | 5,882 | ~3,700 | 多活架构 |
| P2 | monitor | 1,953 | 3,951 | ~2,000 | 指标采集, 告警规则 |
| P2 | notify | 1,182 | 1,701 | ~500 | 通知渠道 |

#### D. 需新建 Go（1 个）

| 服务 | TS 行数 | Go 状态 | 说明 |
|------|---------|---------|------|
| ai-svc | 19,599 | 无实现 | AI 网关（LLM 路由, 向量存储, 成本管控） |

> **注意**: ai-svc 不走 Go 迁移路径，而是扩充 Python 版 orion-ai-service。

#### E. 需补充少量（4 个）

| 服务 | Go 行数 | 目标 | 说明 |
|------|---------|------|------|
| tool | 已完成 | — | 已新建完成 |
| graph | 294 | 500+ | 知识图谱 |
| pandawiki | 297 | 500+ | 知识库管理 |
| intelligence | 298 | 500+ | AI 决策 |

#### F. 仅 TS 无 Go（3 个）— 暂不迁移

| 服务 | TS 行数 | 说明 |
|------|---------|------|
| agent | 3,799 | AI Agent 生命周期 |
| knowledge | — | 知识库服务 |
| dba | — | DBA 管理平台 |

#### G. Python 路径（3 个）— 不走 Go

| 服务 | 语言 | 行数 | 说明 |
|------|------|------|------|
| ai-agents-svc | Python | 2,166 | AI Agent 专项 |
| intelligence-svc | Python | 3,932 | AI 决策 |
| llm-svc | Python | 2,166 | LLM 推理 |

---

## 三、迁移执行顺序（16 周路线图）

### Phase 1：确认可切换（第 1-2 周）

```
操作：
1. runner-svc-go → 切 API Gateway 路由到 3028
2. digital-twin-svc-go → 切 API Gateway 路由到 3008
3. config-mgmt-svc-go → 先补充版本管理 API
4. skill-svc-go → 先验证前端端点覆盖

产出：
- 4 个服务切换 Go 权威
- TS 目录冻结（DEPRECATED.md）
```

### Phase 2：核心服务补充（第 3-6 周）

```
优先级：pipeline > code > ticket > deploy

操作：
1. pipeline-svc-go → 补充 Stage/Task/SSE/审批/版本/模板/并发（~22,700 行）
2. code-svc-go → 补充 Git/Webhook/扫描/分支/MR（~11,500 行）
3. ticket-svc-go → 补充 SLA/分析/批量（~6,500 行）
4. deploy-svc-go → 补充灰度/K8s/窗口/审批（~5,500 行）

产出：
- 4 个核心服务切换 Go 权威
- TS 目录废弃
```

### Phase 3：中层服务补充（第 7-10 周）

```
优先级：finops > chatops > security > efficiency

操作：
1. finops-svc-go → 补充云成本/K8s 分摊/ROI（~5,900 行）
2. chatops-svc-go → 补充 IM/命令/Webhook（~6,300 行）
3. security-svc-go → 补充扫描/供应链/合规（~6,500 行）
4. efficiency-svc-go → 补充 DORA/报告（~4,300 行）
5. plugin-svc-go → 补充市场/生命周期（~3,500 行）
6. artifact-svc-go → 补充版本/溯源（~2,400 行）
7. approval-svc-go → 补充审批流（~1,500 行）
8. community-svc-go → 补充反馈（~1,300 行）
9. selfhealing-svc-go → 补充策略（~1,200 行）
10. dr-svc-go → 补充多活（~3,700 行）
11. monitor-svc-go → 补充指标/告警（~2,000 行）
12. notify-svc-go → 补充渠道（~500 行）

产出：
- 12 个服务切换 Go 权威
```

### Phase 4：新建 + 收尾（第 11-14 周）

```
操作：
1. graph-svc-go → 补充至 500+
2. pandawiki-svc-go → 补充至 500+
3. intelligence-svc-go → 补充至 500+
4. tool-svc-go → 新建完成

产出：
- 4 个小服务完成
```

### Phase 5：废弃清理（第 15-16 周）

```
操作：
1. 废弃已切换的 TS 目录
2. 更新 service-authority-registry.md
3. 更新 API Gateway 路由配置
4. 更新前端 API 客户端指向

产出：
- 全部 22 个可迁移服务切换 Go 完成
```

---

## 四、不可迁移的 3 个服务后续

### inception（SQL 审核引擎）

```
TS 版本: orion-inception-svc/
  - 功能: SQL parse/execute/audit/validate
  - 行数: 799
  - 状态: 保留 TS 实现

Go 版本: orion-inception-svc-go/
  - 功能: 审计项目管理 (projects/count)
  - 行数: 1,211
  - 状态: 保留 Go 实现

前端调用: /api/v1/inception/* → platform-service (TS 权威)
```

### governance（API 合约治理）

```
TS 版本: orion-governance-svc/
  - 功能: contracts/versions/deprecations
  - 行数: 1,993
  - 状态: 保留 TS 实现

Go 版本: orion-governance-svc-go/
  - 功能: policies CRUD
  - 行数: 1,974
  - 状态: 保留 Go 实现

前端调用: /api/v1/governance/* → platform-service (TS 权威)
```

### risk（风险评估引擎）

```
TS 版本: orion-risk-svc/
  - 功能: assessments/scores/trend/events
  - 行数: 2,245
  - 状态: 保留 TS 实现

Go 版本: orion-risk-svc-go/
  - 功能: risks CRUD
  - 行数: 1,956
  - 状态: 保留 Go 实现

前端调用: /api/v1/risk/* → platform-service (TS 权威)
```

---

## 五、迁移后的服务分布

### 5.1 迁移完成后的 Go 服务（47 个）

| 类别 | 数量 | 服务 |
|------|------|------|
| Go 权威（已切换） | 22 | runner, digital-twin, pipeline, code, ticket, deploy, finops, chatops, security, efficiency, plugin, artifact, approval, community, selfhealing, dr, monitor, notify, config-mgmt, skill, graph, pandawiki, intelligence, tool |
| 原生 Go（无双版本） | 18 | canary, visor, cmdb, capacity, cron, event-bus, feature-flag, federation, governance, inspection, middleware-ops, scheduler, secret, workflow, audit, build, risk, inception |
| 永久双版本（TS 保留） | 3 | inception, governance, risk |
| 仅 TS（不移迁） | 3 | agent, knowledge, dba |
| Python 路径 | 3 | ai-agents, intelligence, llm |

### 5.2 迁移后的架构

```
前端请求 → orion-api-gateway:3000
    │
    ├── → platform-service:3001 (Node.js)
    │       ├── 139 个 services（核心单体）
    │       ├── inception/governance/risk（TS 权威）
    │       └── agent/knowledge/dba（仅 TS）
    │
    ├── → Go 服务集群 (22 个)
    │       ├── pipeline-svc-go:3002
    │       ├── ticket-svc-go:3004
    │       ├── deploy-svc-go:3003
    │       ├── code-svc-go:3010
    │       └── ... (18 更多)
    │
    └── → Python AI 服务
            └── orion-ai-service:8000
```

---

## 六、关键风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| pipeline/code 补充工作量极大（~34,000 行） | Phase 2 可能延期 | 分阶段切换，先核心流程再补充 |
| Go 版本功能不完整就切换 | 服务降级 | API Gateway 灰度切流，保留 TS 回退 |
| 3 个永久双版本造成维护混乱 | 开发者困惑 | 明确标注权威实现 |
| agent/knowledge/dba 不移迁 | 技术栈分裂 | 保持现状，后续评估 |

---

## 七、文档依赖关系

```
go-service-unification-design.md (v1.1)
    │
    ├── 判定规则（功能重叠 > 行数）
    ├── Phase 1/2/3 计划
    ├── 不可迁移列表（inception/governance/risk）
    └── 各服务需补充功能设计
            │
            └──→ service-authority-registry.md
                    │
                    ├── 权威实现总表（Wave 1/2/3）
                    ├── API Gateway 路由映射
                    ├── 切换规则
                    └── 构建状态汇总
            │
            └──→ 清理与待实现清单
                    │
                    ├── Phase 1-5 执行计划
                    ├── 不可迁移补充（governance/risk）
                    ├── 系统级 P0-P2 问题
                    └── 执行优先级建议
```

---

## 八、总结

### 31 个 TS 微服务的最终命运

| 命运 | 数量 | 占比 |
|------|------|------|
| 切换 Go 权威 | 22 | 71% |
| 永久双版本 | 3 | 10% |
| 仅 TS 保留 | 3 | 10% |
| Python 路径 | 3 | 10% |

### 核心结论

1. **22/31 (71%)** 的 TS 微服务最终会切换为 Go 权威
2. **3/31 (10%)** 是同名不同域，永久双版本
3. **3/31 (10%)** 仅 TS 保留（agent/knowledge/dba），暂无 Go 计划
4. **3/31 (10%)** 走 Python 路径（ai-agents/intelligence/llm）
5. 迁移核心瓶颈在 **pipeline + code**（合计 ~34,000 行需补充）
6. 迁移决策依据已从"行数"修正为"功能重叠度"（v1.1 关键修正）
