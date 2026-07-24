# 金丝雀发布（Canary）模块深度分析

**生成日期**: 2026-07-03  
**分析范围**: `orion-platform-service` 中 canary-analysis 和 canary-traffic 两个服务目录  
**涵盖**: ML 金丝雀分析 / 流量管理 / 自动推进引擎 / Istio/NGINX 流量切换  
**服务路径**: `src/services/canary-analysis/`, `src/services/canary-traffic/`  
**路由文件**: `canary-analysis-routes.ts`, `canary-traffic-routes.ts`

---

## 一、现状概述

### 模块定位

金丝雀发布模块是 Orion 部署流程中的核心发布策略引擎，分为两大子域：

1. **Canary Analysis**（ML 分析）：基于统计检验 + ML 模型的金丝雀运行分析，自动评估新版本健康度并给出 promote/rollback/inconclusive 决策。提供模拟运行模式用于演示。
2. **Canary Traffic**（流量管理）：管理金丝雀部署的流量分配，支持 Istio VirtualService 和 NGINX 两种流量策略的配置下发，提供自动推进引擎（基于 Mann-Whitney U 检验的指标对比）。

**当前状态**: 功能丰富但代码冗余度高，存在多个服务之间功能重叠。CanaryAnalysisService 有模拟数据功能，CanaryTraffic 存在 CanaryTrafficService 和 CanaryTrafficManagerService 两个相似服务。

### 文件结构

```
src/services/canary-analysis/
├── __tests__/
│   ├── CanaryAnalysisService.test.ts    (13,500 字节)
│   └── PrometheusClient.test.ts         (3,431 字节)
├── CanaryAnalysisService.ts             (27,812 字节)  — 主力服务
├── PrometheusClient.ts                  (3,128 字节)  — HTTP API 客户端
└── index.ts                             (124 字节)    — 导出所有

src/services/canary-traffic/
├── __tests__/
│   ├── AutoProgressionEngine.test.ts    (18,879 字节)
│   ├── CanaryTrafficManagerService.test.ts (12,037 字节)
│   ├── CanaryTrafficService.test.ts     (20,932 字节)
│   ├── TrafficManager.test.ts           (26,301 字节)
│   ├── TrafficSplitter.test.ts          (11,664 字节)
│   └── index.test.ts                    (569 字节)
├── AutoProgressionEngine.ts             (17,108 字节)  — 自动推进引擎
├── CanaryTrafficManagerService.ts       (5,797 字节)   — Phase 3 流量管理
├── CanaryTrafficService.ts              (11,188 字节)  — 基础流量管理
├── TrafficManager.ts                    (18,906 字节)  — Istio/NGINX 切换
├── TrafficSplitter.ts                   (6,364 字节)   — 路由决策
└── index.ts                             (209 字节)     — 仅导 CanaryTrafficManagerService
```

### 核心数据模型

| 领域 | 实体/模型 | Repository | 说明 |
|------|-----------|-----------|------|
| Analysis | CanaryAnalysisRun | CanaryAnalysisRepository | 分析运行记录 |
| Analysis | CanaryMetricResult | CanaryMetricResultRepository | 指标对比结果 |
| Analysis | CanaryMLResult | CanaryMLResultRepository | ML 模型预测结果 |
| Analysis | CanaryAnalysisConfig | CanaryAnalysisConfigRepository | 分析配置 |
| Analysis | CanaryDecision | CanaryDecisionRepository | 决策记录 |
| Analysis | CanaryRetrainJob | CanaryRetrainJobRepository | 模型重训练任务 |
| Traffic | TrafficConfig | TrafficConfigRepository | 流量配置 |
| Traffic | TrafficHistory | TrafficHistoryRepository | 流量变更历史 |
| Traffic | CanaryConfig | CanaryTrafficRepository | Phase 3 配置 |
| Traffic | CanaryAnalysis (Traffic) | CanaryTrafficRepository | 流量分析记录 |

---

## 二、功能矩阵

### Canary Analysis

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 分析运行 CRUD | ✅ 完整 | 创建/列表/详情，支持按 deploymentId 和 status 过滤 |
| 指标管理 | ✅ 完整 | 记录和查询金丝雀指标对比结果（Mann-Whitney U、KS、Cliff Delta） |
| ML 模型结果 | ✅ 完整 | 记录多名模型预测（xgboost/random_forest/logistic_regression） |
| 分析配置管理 | ✅ 完整 | CRUD 金丝雀分析配置（阈值、步长、排他指标等） |
| 强制 Promote/Rollback | ✅ 完整 | 人工干预，记录 override 决策 |
| 模拟运行 | ⚠️ 部分实现 | 生成随机指标和 ML 结果用于演示，非真实数据驱动 |
| 指标发现 | ✅ 完整 | 返回静态预定义指标列表（latency/error_rate/throughput/saturation） |
| 模型重训练 | ✅ 完整 | 创建重训练任务（仅记录不执行实际训练） |
| 指标汇总 | ✅ 完整 | 统计 promote/rollback/inconclusive 数量和通过率 |
| 真实 Prometheus 数据 | ⚠️ 部分实现 | PrometheusClient 存在但 CanaryAnalysisService 未使用，仍用模拟数据 |

### Canary Traffic

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 金丝雀部署 CRUD | ✅ 完整 | 创建/列表/详情 |
| 流量规则配置 | ✅ 完整 | 支持权重百分比配置 |
| Promote/Rollback | ✅ 完整 | 流量设置为 100% / 0% |
| Istio 流量切换 | ⚠️ 部分实现 | 有 YAML 生成和 kubectl apply 逻辑，但 kubectl 不可用时降级为模拟 |
| NGINX 权重配置 | ⚠️ 部分实现 | 同上，生产环境需要实际 NGINX 文件系统权限 |
| 自动推进引擎 | ✅ 完整 | 基于 Mann-Whitney U 检验自动判断 advance/hold/rollback/complete |
| 指标对比 | ✅ 完整 | 6 个维度指标对比（error_rate/latency_p95/latency_p99/cpu/memory/request_rate） |
| 流量拆分决策 | ✅ 完整 | 支持 header/cookie/IP hash 路由决策 |
| 健康检查 | ✅ 完整 | 配置/权重/端点/阶段验证 |
| 流量历史 | ✅ 完整 | 记录所有流量变更操作 |

---

## 三、API 端点

### 金丝雀分析 (`/api/v1/canary-analysis`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/runs` | 列出分析运行记录 |
| POST | `/runs` | 创建分析运行（模拟） |
| GET | `/runs/:id` | 获取运行详情 |
| GET | `/runs/:id/metrics` | 获取运行指标 |
| GET | `/runs/:id/ml-results` | 获取 ML 结果 |
| GET | `/configs` | 列出分析配置 |
| POST | `/configs` | 创建分析配置 |
| GET | `/configs/:service/:env` | 按服务和环境获取配置 |
| PUT | `/configs/:id` | 更新配置 |
| DELETE | `/configs/:id` | 删除配置 |
| POST | `/force-promote` | 强制提升 |
| POST | `/force-rollback` | 强制回滚 |
| GET | `/metrics/discover` | 发现可监控指标 |
| POST | `/models/retrain` | 触发模型重训练 |

### 金丝雀流量 (`/api/v1/canary/deployments`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建金丝雀部署 |
| GET | `/` | 列出金丝雀部署 |
| GET | `/:id` | 获取部署详情 |
| PUT | `/:id/traffic` | 配置流量拆分 |
| POST | `/:id/promote` | 提升到生产 |
| POST | `/:id/rollback` | 回滚 |

### 路由注册

- `canary-analysis-routes.ts` → 注册于 `/api/v1/canary-analysis`（routes.ts:896）
- `canary-traffic-routes.ts` → 注册于 `/api/v1/canary/deployments`（routes.ts: 嵌入在 Smart Deploy 段）

---

## 四、依赖关系

### 内部依赖

| 服务 | 依赖项 | 用途 |
|------|--------|------|
| CanaryAnalysisService | 6 个 Repository | 运行/指标/ML/配置/决策/重训练持久化 |
| CanaryTrafficService | TrafficConfigRepository, TrafficHistoryRepository, in-memory Map | 流量配置持久化 + 内存回退 |
| CanaryTrafficManagerService | CanaryTrafficRepository | Phase 3 配置 |
| AutoProgressionEngine | DatabasePool（直接 SQL） | 直接从 DB 读取/写入 canary 数据 |
| TrafficManager | TrafficConfigRepository, TrafficHistoryRepository | 配置管理 + 历史记录 |
| TrafficSplitter | CanaryTrafficService, in-memory Map | 路由决策 |

### 外部依赖

| 依赖 | 用途 | 备注 |
|------|------|------|
| PostgreSQL | 所有 Repository | 多个 Repository 分散存储 |
| Prometheus | 指标查询（PrometheusClient） | 但 CanaryAnalysisService 未使用实时 Prometheus 数据 |
| kubectl | Istio 流量切换（TrafficManager） | 不可用时降级为模拟 |
| NGINX | 权重配置（TrafficManager） | 需文件系统权限 |

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **功能重叠**：CanaryTrafficService 和 CanaryTrafficManagerService 都管理金丝雀流量，但接口不同、Repository 不同、持久化策略不同 | **P0** | 合并两个服务，统一使用 CanaryTrafficRepository + TrafficManagerRepository，废弃 CanaryTrafficService 中的 in-memory Map |
| **持久化不一致**：CanaryTrafficService 使用 in-memory Map 作为回退，CanaryTrafficManagerService 使用 CanaryTrafficRepository，AutoProgressionEngine 直接 SQL，TrafficManager 使用 TrafficManagerRepository——同一个模块有 3 种持久化方式 | **P0** | 统一到 Repository 模式，删除直接 SQL 调用和 in-memory 回退 |
| **CanaryAnalysisService 模拟数据**：`simulateAnalysisRun` 生成随机数据，而非使用真实 Prometheus 数据 | **P1** | 接入 PrometheusClient 真实查询，模拟模式仅作为降级策略 |
| **index.ts 导出不一致**：canary-traffic/index.ts 仅导出 CanaryTrafficManagerService，遗漏 CanaryTrafficService、AutoProgressionEngine、TrafficManager、TrafficSplitter | P2 | 补全所有导出 |
| **TrafficManager.validateTrafficHealth 有拼写错误**：`validPhases` 中包含 `' Canary '`（带空格），导致永远不匹配 | P2 | 修复为正确的阶段值 |
| **AutoProgressionEngine 直接 SQL 注入风险**：虽然参数化查询，但混合在业务逻辑中，违反单一职责 | P2 | 抽取到 Repository 类 |
| **无前端页面消费**：canary-analysis 和 canary-traffic 共 20 个 API 端点，但无前端金丝雀发布管理页面 | P1 | 创建金丝雀发布管理页面（部署列表 + 分析详情 + 指标对比可视化） |
| **模型重训练空实现**：`retrainModel` 仅创建 job 记录，不执行实际训练 | P2 | 集成 ML 训练管道或标记为"待实现" |

---

## 六、总结

金丝雀发布模块是 Orion 部署能力的重要组成部分，功能覆盖面广——涵盖从 ML 分析到 Istio/NGINX 流量切换的完整链路。代码规模大（~90KB 源码 + ~95KB 测试），测试覆盖较好。

然而，该模块存在两个 **P0 级问题**：

1. **功能重叠严重**：CanaryTrafficService 和 CanaryTrafficManagerService 两个服务做类似的事，持久化策略不同
2. **持久化方式不统一**：同一模块混合使用 Repository、直接 SQL、in-memory Map 三种方式

此外，CanaryAnalysisService 当前基于模拟数据运行，未接入真实的 Prometheus 数据查询，降低了对生产环境的实际价值。

建议优先合并冗余服务、统一持久化策略，然后接入真实 Prometheus 数据，最后补全前端页面。
