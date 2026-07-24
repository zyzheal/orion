# 效能/性能模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/efficiency/`、`performance/`、`capacity/`

---

## 模块概览

Orion 平台效能/性能模块包含 3 大子模块：Efficiency（效能度量与 DORA 指标）、Performance（性能基线与剖析）、Capacity（容量规划与预测）。三个模块均采用 PostgreSQL Repository 持久化，但 Efficiency 仍保留大量内存 Map 降级模式。

| 模块 | 路径 | 文件数 | 代码行数 | 完成度 |
|------|------|--------|---------|--------|
| **Efficiency** | `src/services/efficiency/` | 8 + 1 test | ~1200 | 65% |
| **Performance** | `src/services/performance/` | 3 + 1 test | ~720 | 75% |
| **Capacity** | `src/services/capacity/` | 2 + 1 test | ~350 | 80% |

### 核心类

| 类 | 职责 |
|------|------|
| `EfficiencyReportService` | 效能报告生成（团队/项目/全局） |
| `DORACalculator` | DORA 四项指标计算（部署频率/变更前置时间/变更失败率/恢复时间） |
| `EfficiencyDashboardService` | 效能仪表盘聚合 |
| `WeeklyReportService` | 周报自动生成 |
| `EventHandler` | 监听 Pipeline/Incident 事件更新指标 |
| `ClickHouseSync` | 效能数据同步到 ClickHouse |
| `PerformanceBaselineService` | 性能基线创建/评估/版本管理 |
| `PerformanceProfileService` | 服务性能剖析与瓶颈分析 |
| `CapacityService` | 容量指标采集、预测、告警、报告 |

---

## 架构设计

### Efficiency（效能度量）

```
efficiency-routes.ts
    ↓
EfficiencyReportService + DORACalculator
    ↓
EfficiencyReportRepository (5 个 Repository)
    ↓
PostgreSQL (efficiency_team_data, efficiency_project_data, efficiency_reports, efficiency_global_deployments, efficiency_global_pipelines)
```

**关键问题**：EfficiencyReportService 内部仍使用 5 个内存 Map（teamData/projectData/reportHistory/globalDeployments/globalPipelineRecords）作为主存储，PostgreSQL Repository 仅作为异步持久化（fire-and-forget），读取不穿透 DB。

### Performance（性能管理）

```
performance-routes.ts
    ↓
PerformanceController
    ↓
PerformanceBaselineService + PerformanceProfileService
    ↓
PerformanceRepository (3 个 Repository)
    ↓
PostgreSQL (performance_baselines, performance_evaluations, performance_test_results)
```

**特点**：已完整迁移到 PostgreSQL Repository 模式，支持基线版本管理和性能回归分析。

### Capacity（容量规划）

```
capacity-routes.ts
    ↓
CapacityService
    ↓
CapacityRepository (4 个 Repository)
    ↓
PostgreSQL (capacity_metrics, capacity_forecasts, capacity_alerts, capacity_reports)
```

**特点**：Phase 4 新建模块，直接基于 PostgreSQL Repository 实现，无历史技术债务。

---

## 与设计文档对比

| 设计能力 | 设计文档要求 | Efficiency | Performance | Capacity |
|---------|------------|-----------|-------------|----------|
| DORA 指标计算 | 四项指标自动计算 | ✅ | N/A | N/A |
| 团队/项目效能看板 | 多维度聚合 | ✅ 基础聚合 | N/A | N/A |
| 周报自动生成 | 定时生成 + 推送 | ⚠️ 生成存在，推送未实现 | N/A | N/A |
| 效能趋势分析 | 历史趋势对比 | ✅ 支持 | N/A | N/A |
| 性能基线管理 | 基线 CRUD + 版本 | N/A | ✅ | N/A |
| 性能回归检测 | 自动检测性能劣化 | N/A | ✅ 基础规则 | N/A |
| 性能剖析 | 瓶颈分析 | N/A | ⚠️ 基础实现 | N/A |
| 容量预测 | 基于趋势预测 | N/A | N/A | ✅ 30/90 天预测 |
| 容量告警 | 阈值告警 | N/A | N/A | ✅ 支持 |
| 容量报告 | 定期报告 | N/A | N/A | ⚠️ 生成存在，推送未实现 |
| ClickHouse 同步 | 时序数据持久化 | ⚠️ 同步存在，无查询 | N/A | N/A |

---

## 功能完整性评估

### Efficiency（效能度量）

| 功能域 | 功能点 | 实现状态 | 备注 |
|--------|--------|----------|------|
| DORA | 部署频率 | ✅ | 基于 deployment 记录 |
| DORA | 变更前置时间 | ✅ | commit → deploy 时间差 |
| DORA | 变更失败率 | ✅ | 失败部署 / 总部署 |
| DORA | 恢复时间 | ✅ | incident → recovery 时间差 |
| 报告 | 团队指标 | ✅ | 内存计算 |
| 报告 | 项目指标 | ✅ | 内存计算 |
| 报告 | 时间段对比 | ✅ | A/B 周期对比 |
| 报告 | 周报生成 | ⚠️ | 生成逻辑存在，无推送 |
| 仪表盘 | 全局看板 | ✅ | EfficiencyDashboardService |
| 同步 | ClickHouse | ⚠️ | 同步逻辑存在，查询未对接 |

**核心问题**：所有报告生成完全依赖内存 Map，服务重启后数据丢失。PostgreSQL 持久化是异步 fire-and-forget，读取时不查询 DB。

### Performance（性能管理）

| 功能域 | 功能点 | 实现状态 | 备注 |
|--------|--------|----------|------|
| 基线 | 创建基线 | ✅ | 支持多环境 |
| 基线 | 版本管理 | ✅ | 自动递增 version |
| 评估 | 性能评估 | ✅ | 对比基线阈值 |
| 评估 | 回归检测 | ✅ | 检测指标劣化 |
| 评估 | 评估历史 | ✅ | 记录每次评估 |
| 剖析 | 服务剖析 | ⚠️ | 基础实现，无火焰图 |
| 剖析 | 瓶颈识别 | ⚠️ | 基于规则，非 AI |
| 测试 | 压测结果接入 | ⚠️ | 结构存在，未对接实际压测工具 |

### Capacity（容量规划）

| 功能域 | 功能点 | 实现状态 | 备注 |
|--------|--------|----------|------|
| 指标 | 容量指标采集 | ✅ | 多资源类型 |
| 预测 | 30/90 天预测 | ✅ | 线性趋势预测 |
| 告警 | 容量告警 | ✅ | info/warning/critical |
| 报告 | 容量报告 | ⚠️ | 生成存在，无推送 |
| 建议 | 扩容建议 | ⚠️ | 文本建议，非自动化 |

---

## 关键问题清单

### P0 - 数据一致性风险

1. **Efficiency 内存主存储**：EfficiencyReportService 的所有报告生成依赖内存 Map（teamData/projectData/globalDeployments/globalPipelineRecords），服务重启后历史数据全部丢失。PostgreSQL Repository 仅异步持久化，读取时不查询 DB。

### P1 - 功能不完整

2. **DORA 数据来源**：DORA 指标依赖 `globalDeployments` 和 `globalPipelineRecords`，但这两个 Map 无外部数据接入接口，需手动注入或通过 EventHandler 监听事件。EventHandler 仅监听部分事件，数据覆盖不完整。
3. **性能剖析可视化缺失**：PerformanceProfileService 仅返回文本格式瓶颈分析，无火焰图、调用栈可视化。
4. **容量预测算法简单**：CapacityService 使用线性趋势预测，未考虑季节性、突发流量等复杂模式。
5. **ClickHouse 同步单向**：ClickHouseSync 仅支持写入，不支持从 ClickHouse 查询历史时序数据。

### P2 - 代码质量

6. **EventHandler 耦合**：Efficiency 模块通过 EventHandler 监听多个 domain 事件，但事件处理逻辑分散，无统一的事件过滤/重试机制。
7. **Capacity 测试覆盖不足**：capacity 目录仅有 `__tests__` 占位，无实际测试用例。
8. **性能基线评估硬编码**：PerformanceBaselineService 的性能评估使用固定阈值，不支持动态基线（如基于历史 P95）。

---

## 完成度评分

| 维度 | Efficiency | Performance | Capacity |
|------|-----------|-------------|----------|
| 功能完整性 | 60% | 75% | 80% |
| 持久化覆盖 | 30% | 95% | 90% |
| API 覆盖率 | 85% | 90% | 80% |
| 前端页面 | 70% | 60% | 70% |
| 测试覆盖 | 50% | 60% | 20% |
| **综合完成度** | **65%** | **75%** | **80%** |

### 模块综合评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整性 | 70% | Performance/Capacity 完整，Efficiency 核心功能完整但数据持久化有缺陷 |
| 持久化覆盖 | 65% | Efficiency 内存依赖严重，Performance/Capacity 已完整迁移 |
| API 覆盖率 | 85% | 三个模块均有完整路由层 |
| 前端页面 | 65% | EfficiencyDashboard/ 存在，performance/ capacity 页面简单 |
| 测试覆盖 | 40% | Efficiency 有部分测试，Capacity 几乎无测试 |
| **综合完成度** | **73%** | |

---

## 改进建议

### 短期（1-2 周）

1. **修复 Efficiency 持久化**：将 EfficiencyReportService 的主存储从内存 Map 迁移到 PostgreSQL Repository，确保服务重启数据不丢失。
2. **完善 EventHandler**：统一事件过滤、重试和错误处理，确保 DORA 数据完整性。
3. **补充 Capacity 测试**：为 CapacityService 编写单元测试和集成测试。

### 中期（3-4 周）

4. **实现性能剖析可视化**：在 Performance 模块集成火焰图展示（对接 Jaeger/Span）。
5. **优化容量预测算法**：引入指数平滑或简单机器学习模型，提升预测准确率。
6. **ClickHouse 查询对接**：支持从 ClickHouse 查询历史效能/容量时序数据。

### 长期（2-3 个月）

7. **智能性能告警**：基于基线自动检测性能回归，关联代码变更和部署。
8. **自动扩容建议**：CapacityService 输出扩容建议后，自动创建工单或触发审批流程。
