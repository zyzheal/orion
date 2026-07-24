# Map → PostgreSQL 迁移计划 (2026-07-22)

## 总览

| 指标 | 数值 |
|------|------|
| 总 repository 目录数 | 227 |
| Map-based repositories | 160 (70%) |
| SQL-based repositories | 221 (97%) -- 160 个 map 仓库同时包含 SQL 模式代码 |
| 纯 SQL repositories (no map) | 61 (27%) |
| 已有迁移文件 | 90 (56%) |
| 需要新迁移文件 | 70 (44%) |

> 注：160 个 map 仓库中全部同时包含 `SELECT`/`INSERT INTO`/`WHERE` 等 SQL 模式代码，说明这些仓库是 map + SQL 混合实现。0 个仓库是纯 map 实现。61 个仓库是纯 SQL 实现（无 map 引用）。

**风险等级：P0** -- 160 个模块的数据在服务重启后丢失，这是整个 Go 平台服务中最高优先级的技术债务。

## 批次划分

### Batch 1: 高流量 + 高优先级模块 (32 模块)

**选择标准**：路由数 >= 18，且已有迁移文件。这些模块拥有最多的 API 端点，数据丢失风险最高，且数据库 schema 已就绪，迁移成本最低。

| 模块 | 路由 | 迁移文件 | 总 LOC | 复杂度 |
|------|------|---------|--------|--------|
| ticketing | 85 | Y | 6643 | L |
| developer-portal | 58 | Y | 3977 | L |
| config | 45 | Y | 2710 | L |
| monitoring | 38 | Y | 3232 | L |
| finops-v2 | 35 | Y | 2129 | L |
| cmdb | 34 | Y | 2349 | L |
| tenant | 30 | Y | 3103 | L |
| capability | 29 | Y | 3081 | L |
| visor-exec | 28 | Y | 1650 | M |
| code-repo | 26 | Y | 1782 | M |
| multi-cloud | 25 | Y | 1993 | M |
| approval | 25 | Y | 1596 | M |
| build-env | 24 | Y | 1469 | M |
| incident | 22 | Y | 1957 | M |
| infrastructure | 21 | Y | 3079 | L |
| problem | 21 | Y | 2106 | L |
| internal-library | 21 | Y | 1470 | M |
| artifact | 21 | Y | 1433 | M |
| chaos | 20 | Y | 2990 | L |
| oncall | 20 | Y | 1941 | M |
| security-compliance | 20 | Y | 1866 | M |
| knowledge | 20 | Y | 1606 | M |
| change | 20 | Y | 1551 | M |
| api-governance | 20 | Y | 1481 | M |
| billing | 20 | Y | 1476 | M |
| report-designer | 20 | Y | 1465 | M |
| iac | 19 | Y | 1612 | M |
| dba | 19 | Y | 1565 | M |
| sla | 19 | Y | 1506 | M |
| serverless | 18 | Y | 1338 | M |
| deploy-enhanced | 18 | Y | 1323 | M |
| backup | 18 | Y | 1224 | M |

**预计工作量**：32 模块，平均每个 ~1-2 天 = 4-8 人周
**估算依赖**：无阻塞依赖，所有模块已有迁移文件
**建议策略**：按路由数降序逐个迁移，ticketing(85 路由) 单独分配 1 人

### Batch 2: 中高优先级模块 (32 模块)

**选择标准**：路由数 13-17，混有已有迁移（22 个）和需要新迁移（10 个）的模块。

| 模块 | 路由 | 迁移文件 | 总 LOC | 复杂度 |
|------|------|---------|--------|--------|
| governance | 17 | Y | 2736 | L |
| product-line | 17 | Y | 1095 | M |
| notification-policy | 17 | N | 1096 | M |
| finops | 16 | Y | 2486 | L |
| deploy | 16 | Y | 1654 | M |
| lowcode | 16 | Y | 1363 | M |
| cost-allocation | 16 | Y | 1055 | M |
| cron | 16 | Y | 831 | M |
| service-topology | 16 | N | 1103 | M |
| pipeline-batch | 16 | N | 890 | M |
| data-quality | 15 | Y | 2694 | L |
| change-request | 15 | Y | 1240 | M |
| team | 15 | Y | 1110 | M |
| build | 15 | Y | 1066 | M |
| handler-registry | 15 | Y | 994 | M |
| pipeline | 15 | Y | 990 | M |
| pipeline-templates | 15 | N | 3330 | L |
| chaos-gateway | 15 | N | 1596 | M |
| scheduled-notification | 15 | N | 961 | M |
| progressive | 14 | Y | 1413 | M |
| ci-type | 14 | Y | 1123 | M |
| webhook | 14 | N | 1588 | M |
| config-mgmt-enhanced | 14 | N | 1342 | M |
| canary-analysis | 14 | N | 719 | S |
| ai-decisions | 13 | Y | 2558 | L |
| workflow | 13 | Y | 1882 | M |
| llm-trace | 13 | Y | 1261 | M |
| notification-template | 13 | Y | 821 | M |
| test-selector | 13 | N | 2235 | L |
| digital-twin-simulation | 13 | N | 2093 | L |
| ai-agents | 13 | N | 2018 | L |
| self-healing | 13 | N | 1512 | M |

**预计工作量**：32 模块，含 10 个需创建迁移文件（平均 +0.5 天/个）= 5-10 人周
**估算依赖**：10 个模块需要先创建 SQL 迁移文件（设计 schema 映射）
**建议策略**：先迁移 22 个已有迁移文件的模块，再处理 10 个无迁移的模块

### Batch 3: 中等优先级模块 (32 模块)

**选择标准**：路由数 10-12，含已有迁移（20 个）和需要新迁移（12 个）的模块。

| 模块 | 路由 | 迁移文件 | 总 LOC | 复杂度 |
|------|------|---------|--------|--------|
| tenant-gateway | 13 | N | 1249 | M |
| circuit-breaker | 13 | N | 990 | M |
| chaos-enhanced | 13 | N | 774 | S |
| notification | 12 | Y | 1241 | M |
| smart-deploy | 12 | Y | 1228 | M |
| slo | 12 | Y | 788 | S |
| sprint | 12 | Y | 743 | S |
| tracing | 12 | Y | 724 | S |
| service-health | 12 | N | 1018 | M |
| community-advanced | 12 | N | 667 | S |
| data-catalog | 11 | Y | 1353 | M |
| page-registry | 11 | Y | 845 | M |
| contract | 11 | Y | 823 | M |
| data-lineage | 11 | Y | 815 | M |
| queue | 11 | Y | 739 | S |
| apm | 11 | Y | 722 | S |
| logging | 11 | Y | 611 | S |
| pipeline-versions | 11 | N | 2111 | L |
| vulnerability | 11 | N | 1317 | M |
| health-check | 11 | N | 740 | S |
| service-catalog | 11 | N | 718 | S |
| oci-registry | 11 | N | 599 | S |
| multi-modal-trigger | 11 | N | 556 | S |
| subapp | 10 | Y | 1025 | M |
| user | 10 | Y | 811 | M |
| api-consumption | 10 | Y | 787 | S |
| project-member | 10 | Y | 573 | S |
| apk-upload-history | 10 | N | 710 | S |
| canary-traffic | 10 | N | 699 | S |
| gateway-dynamic | 9 | Y | 1621 | M |
| runbook | 9 | Y | 712 | S |
| vector | 9 | Y | 560 | S |

**预计工作量**：32 模块，含 12 个需创建迁移文件 = 4-8 人周
**估算依赖**：12 个模块需要新的迁移文件
**建议策略**：重点关注 pipeline-versions(2111 LOC, L) 和 vulnerability(1317 LOC, M) 等较大模块

### Batch 4: 中低优先级模块 (32 模块)

**选择标准**：路由数 7-9，含已有迁移（18 个）和需要新迁移（14 个）的模块。

| 模块 | 路由 | 迁移文件 | 总 LOC | 复杂度 |
|------|------|---------|--------|--------|
| pipeline-template | 9 | N | 1520 | M |
| pipeline-sse | 9 | N | 1501 | M |
| escalation | 9 | N | 625 | S |
| cluster | 9 | N | 611 | S |
| artifact-lifecycle | 9 | N | 531 | S |
| ephemeral-env | 9 | N | 480 | S |
| pipeline-engine | 8 | Y | 2826 | L |
| sandbox | 8 | Y | 635 | S |
| sso | 8 | Y | 612 | S |
| mcp | 8 | Y | 565 | S |
| i18n | 8 | Y | 550 | S |
| permission | 8 | Y | 524 | S |
| channel | 8 | Y | 523 | S |
| cache | 8 | Y | 447 | S |
| community | 8 | Y | 433 | S |
| workbench | 8 | Y | 400 | S |
| disaster-recovery | 8 | N | 517 | S |
| sso-providers | 8 | N | 463 | S |
| cache-cleanup | 8 | N | 435 | S |
| bi-dashboard | 8 | N | 433 | S |
| security | 7 | Y | 1669 | M |
| service-registry | 7 | Y | 686 | S |
| degradation | 7 | Y | 434 | S |
| integration | 7 | Y | 414 | S |
| script | 7 | Y | 378 | S |
| topology | 7 | Y | 378 | S |
| risk | 7 | Y | 377 | S |
| metrics | 7 | Y | 360 | S |
| storage | 7 | N | 793 | S |
| abac-policy | 7 | N | 509 | S |
| terminal-audit | 7 | N | 483 | S |
| module | 7 | N | 473 | S |

**预计工作量**：32 模块，含 14 个需创建迁移文件 = 3-6 人周
**估算依赖**：14 个模块需要新的迁移文件；pipeline-engine(2826 LOC) 是最大模块需单独分配
**建议策略**：pipeline-engine 和 security 两个大模块优先，其余小模块可批量处理

### Batch 5: 低优先级/小模块 (32 模块)

**选择标准**：路由数 2-7，大部分为小模块（S 级），含已有迁移（6 个）和需要新迁移（26 个）的模块。

| 模块 | 路由 | 迁移文件 | 总 LOC | 复杂度 |
|------|------|---------|--------|--------|
| env-lifecycle | 7 | N | 439 | S |
| env-profile | 7 | N | 439 | S |
| decision-explanation | 7 | N | 434 | S |
| dual-engine | 7 | N | 434 | S |
| cross-domain | 7 | N | 433 | S |
| dependency-coordination | 7 | N | 433 | S |
| alert-breaker | 7 | N | 430 | S |
| global-param | 7 | N | 414 | S |
| maintenance-window | 7 | N | 413 | S |
| observability | 7 | N | 391 | S |
| vector-store | 7 | N | 389 | S |
| sso-unified | 7 | N | 384 | S |
| script-library | 7 | N | 378 | S |
| self-service | 7 | N | 378 | S |
| ticket-knowledge | 7 | N | 378 | S |
| unified-config | 7 | N | 378 | S |
| version-archive | 7 | N | 378 | S |
| script-version | 7 | N | 377 | S |
| vectorize-rules | 7 | N | 376 | S |
| notification-management | 7 | N | 369 | S |
| ticket-automation | 7 | N | 368 | S |
| plugin-hotreload | 7 | N | 360 | S |
| process-step | 7 | N | 360 | S |
| message-queue | 7 | N | 359 | S |
| incident-action | 7 | N | 350 | S |
| privacy | 6 | Y | 393 | S |
| ai-cost | 6 | N | 522 | S |
| do-not-disturb | 6 | N | 373 | S |
| user-profile | 6 | N | 346 | S |
| pipeline-trend | 5 | N | 475 | S |
| task-timeout | 4 | N | 568 | S |
| chatops | 2 | Y | 5769 | L |

**预计工作量**：32 模块，含 26 个需创建迁移文件。但大部分为小模块（S 级），平均 0.5 天/个 = 3-6 人周
**估算依赖**：26 个模块需要新迁移文件；chatops(5769 LOC) 是特例，虽路由少但代码量大，需单独分配
**建议策略**：chatops 作为特例提前处理（代码量大但与 chatops 功能相关，schema 已存在）；其余小模块可批量并行处理，每个 0.5 天

## 汇总统计

| 批次 | 模块数 | 有迁移文件 | 需要新迁移 | 预计工作量 | 关键依赖 |
|------|--------|-----------|-----------|-----------|---------|
| Batch 1 | 32 | 32 | 0 | 4-8 人周 | 无 |
| Batch 2 | 32 | 22 | 10 | 5-10 人周 | 10 个模块需创建迁移文件 |
| Batch 3 | 32 | 20 | 12 | 4-8 人周 | 12 个模块需创建迁移文件 |
| Batch 4 | 32 | 18 | 14 | 3-6 人周 | 14 个模块需创建迁移文件 |
| Batch 5 | 32 | 4 | 28 | 3-6 人周 | 28 个模块需创建迁移文件 |
| **总计** | **160** | **90** | **70** | **19-38 人周** | -- |

## 迁移模式建议

### 模式一：已有迁移文件 (90 个模块)
1. 确认迁移文件中的 DDL 与当前 Repository 的 `map[string]` 数据结构一致
2. 将 Repository 中的 map 操作替换为 `*sqlx.DB` 查询
3. 移除 map 字段，保留 `*sqlx.DB` 注入
4. 更新单元测试（使用 testcontainers 或 mock DB）

### 模式二：无迁移文件 (70 个模块)
1. 分析 Repository 中的数据结构，提取所有字段
2. 设计 PostgreSQL schema（表名、列名、索引、外键）
3. 创建迁移文件（含 up/down SQL）
4. 执行迁移模式一的步骤 2-4

### 迁移步骤模板
每个模块的迁移遵循以下 5 步：
1. **分析**：梳理 Repository 中所有 map 操作和数据结构
2. **Schema**：创建/确认迁移文件
3. **实现**：将 map CRUD 替换为 sqlx 查询
4. **测试**：编写 SQL 查询的单元测试
5. **验证**：运行集成测试确认数据持久化

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 不正确迁移导致数据丢失 | 生产数据丢失 | 每个模块迁移后保留 map 作为 fallback，逐步切换 |
| Schema 与业务逻辑不一致 | 运行时报错 | 迁移前梳理所有 map 操作，确保 schema 覆盖所有字段 |
| 测试覆盖不足 | 回归 bug | 迁移前后运行相同测试集，确保测试覆盖率不下降 |
| 70 个模块无迁移文件 | 额外 schema 设计工作 | 优先复用其他模块的 schema 模式，避免重复设计 |
| 迁移期间服务中断 | 影响用户体验 | 支持灰度切换，map 和 PG 可同时运行 |

## 迁移优先级决策树

```
路由数 >= 18 且 有迁移文件 → Batch 1 (立即开始)
路由数 13-17 → Batch 2
路由数 10-12 → Batch 3
路由数 7-9   → Batch 4
路由数 < 7   → Batch 5
```

在 Batch 内部，有迁移文件的模块优先于无迁移文件的模块。