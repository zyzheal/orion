# 全模块深度分析 — 最终覆盖率报告 (2026-08-02)

> **覆盖**: 282 模块 / 100% | **分析文档**: 95 份
> **来源**: `orion-platform-svc-go/internal/` — Go 版本

---

## 一、全平台模块总览

| 指标 | 值 |
|------|----|
| 总模块数 | 282 |
| 有代码模块 | 282 |
| 已 wiring (wiring.go) | 177 (63%) |
| 已注册路由 (router.go) | 206 (73%) |
| 零测试模块 | 56 (20%) |
| 分析覆盖率 | **100%** (95 份文档) |

---

## 二、Domain-Level 深度分析报告 (17 份)

| # | 报告 | 覆盖模块 | 行数 |
|---|------|:--------:|:----:|
| 1 | governance-project-management-workflow | 21 | ~5,500 |
| 2 | security-operations-cache-trigger | 13 | ~4,200 |
| 3 | infrastructure-ddd-autoexec | 15 | ~3,800 |
| 4 | test-knowledge-finops | 7 | ~2,900 |
| 5 | cicd-pipeline-build-deploy | 31 | ~42,000 |
| 6 | alert-notification-submodules | 15 | ~35,000 |
| 7 | monitoring-observability-submodules | 10 | ~18,800 |
| 8 | cmdb-submodules | 8 | ~22,200 |
| 9 | config-lowcode-submodules | 13 | ~29,000 |
| 10 | ai-remaining-modules | 21 | ~450 |

---

## 三、实际未 Wiring 模块 (105 个)

### 3.1 大规模未 Wiring (文件 > 10)

| 模块 | 文件 | H | S | R | 重要性 |
|------|:----:|:-:|:-:|:-:|--------|
| **governance** | 66 | 18 | 12 | 13 | ⭐⭐⭐ 治理核心 |
| **ticket** | 55 | 17 | 14 | 13 | ⭐⭐⭐ ITSM 工单 |
| **identity** | 69 | 19 | 9 | 11 | ⭐⭐⭐ 身份认证 |
| **security** | 59 | 18 | 11 | 11 | ⭐⭐⭐ 安全核心 |
| **application** | 26 | 1 | 1 | 1 | ⭐⭐ CQRS 聚合重建 |
| **alert-pipeline** | 16 | 0 | 0 | 0 | ⭐⭐ 告警管道 |
| **cmdb-collector** | 18 | 2 | 2 | 2 | ⭐⭐ CMDB 采集 |
| **cache-mgmt** | 17 | 1 | 2 | 1 | ⭐ CMDB 缓存管理 |
| **code** | 17 | 4 | 4 | 2 | ⭐ 代码管理 |
| **saga** | 11 | 2 | 6 | 2 | ⭐ Saga 事务 |
| **execution-mode-engine** | 13 | 1 | 1 | 1 | ⭐ 执行引擎 |
| **domain** | 19 | 0 | 0 | 0 | ⭐ CQRS/ES |

### 3.2 中型未 Wiring (文件 4-9, 含功能)

| 模块 | 文件 | H | S | R | 能力 |
|------|:----:|:-:|:-:|:-:|------|
| **pipeline-executor** | 8 | 2 | 4 | 1 | Pipeline 执行引擎 |
| **pipeline-error-detail** | 7 | 2 | 3 | 1 | 错误详情 |
| **config-mgmt-enhanced** | 8 | 2 | 3 | 2 | 配置管理增强 |
| **alert-adapter** | 11 | 1 | 8 | 1 | 告警 SPI 适配器 |
| **visos** | 17 | 4 | 5 | 1 | CMDB 可视化 |
| **pandawiki** | 16 | 4 | 3 | 2 | 知识库 |
| **sla-engine** | 12 | 2 | 3 | 3 | SLA 引擎 |
| **cmdb-validator** | 17 | 1 | 1 | 1 | CMDB 校验 |
| **digital-twin-simulation** | 8 | 2 | 3 | 2 | 数字孪生仿真 |
| **autonomous-pipeline** | 7 | 2 | 2 | 2 | 自主 Pipeline |
| **chaos-gateway** | 7 | 2 | 2 | 2 | 混沌网关 |
| **community-advanced** | 8 | 2 | 3 | 2 | 社区增强 |
| **crossover** | 7 | 0 | 1 | 0 | 跨域调用 |
| **import-export** | 14 | 1 | 1 | 1 | 导入导出 |
| **auto-exec** | 14 | 2 | 2 | 1 | 自动执行 |

### 3.3 小型未 Wiring (文件 3-6)

共 90 个模块，主要是 H=1-2/S=1-3/R=0-2 的标准 CRUD 模块。

---

## 四、关键发现

### 4.1 最大架构问题：105 模块未 Wiring

**与之前报告的差异**：
- 之前基于 TS 版本的 `grep wiring.go` 报告 83 个 wired (29%)
- Go 版本 `wiring.go` 实际导入 177 个模块 (63%)
- **差异原因**：Go 版本 wiring.go 采用 handler import 注入模式，每个 import = 一个 wired 模块

**未 wiring 的 4 大核心模块**：
1. **governance** (66 文件, 18H/12S) — 治理策略引擎
2. **ticket** (55 文件, 17H/14S) — ITSM 工单系统
3. **identity** (69 文件, 19H/9S) — 身份认证系统
4. **security** (59 文件, 18H/11S) — 安全审计系统

### 4.2 AI 域统一容器

`internal/ai/` 是 25 子组件的统一容器 (169 文件/44H/52S/31R/29T)，已 wiring + 已路由。

### 4.3 域级 P0 问题汇总

| # | 问题 | 模块 | 影响 |
|---|------|------|------|
| 1 | **4 大核心未 wiring** | governance/ticket/identity/security (249 文件) | 治理/工单/认证/安全完全不可用 |
| 2 | **7 告警子模块未 wiring** | alert-adapter/v2/correlation/dedup/silence/pipeline | 告警管道完全不可用 |
| 3 | **CMDB 子模块 4/5 未 wiring** | cmdb-collector/attr-handler/import/relationship (cmdb-validator wired) | CMDB 扩展功能不可用 |
| 4 | **CQRS/ES 基础设施未 wiring** | domain (19 文件, CQRS/EventStore/3 Aggregates) | 聚合根重建不可用 |
| 5 | **零测试模块** | alert-adapter/v2/correlation/dedup/pipeline/api-component/assignee 等 56 模块 | 核心功能不可信 |
| 6 | **alert-pipeline 架构异常** | 16 文件但 0H/0S/0R/0T | 无标准三层架构 |

---

## 五、覆盖率状态

| 域 | 模块数 | Wired | 深度分析 | 覆盖率 |
|----|:------:|:-----:|:--------:|:------:|
| CI/CD | 31 | 17/31 | ✅ | 100% |
| 通知告警 | 15 | 2/15 | ✅ | 100% |
| 监控可观测性 | 10 | 6/10 | ✅ | 100% |
| CMDB | 8 | 3/8 | ✅ | 100% |
| 配置低代码 | 13 | 4/13 | ✅ | 100% |
| AI | 1 (ai 容器) | 1/1 | ✅ | 100% |
| 治理 | 7 | 1/7 | ✅ | 100% |
| 安全运维 | 6 | 3/6 | ✅ | 100% |
| 基础设施 | 5 | 2/5 | ✅ | 100% |
| 测试/知识库 | 4 | 1/4 | ✅ | 100% |
| 其余独立模块 | 182 | 137/182 | ✅ (单模块报告) | 100% |

---

*分析完成: 2026-08-02 | 282 模块 / 95 份报告 / 100% 覆盖*
