# Orion 平台容量规划基线 v1.0

| 元数据 | |
|--------|------|
| 状态 | 已产出（P0-7） |
| 日期 | 2026-10-11 |
| 依据 | Y 手册 v5.8 §14.2 P0-7、ADR-005（PG 16+）、ADR-011（多租户混合隔离）、ADR-006（ClickHouse） |
| 前置依赖 | P0-6 SLO/SLA 定义（8 模块 P95/P99） |
| 权威范围 | 容量基线 / 扩容触发点 / Prometheus 指标命名 / 复盘流程 |
| 约束 | 不修改生产代码（RC-03）、不估算人天/工期 |

---

## 1. 容量规划基线总览

| 资源 | 当前实测 | 规划基线 | 扩容触发点 |
|------|---------|---------|----------|
| API Gateway QPS | 待实测（Prometheus `orion_http_requests_total`） | 1000 QPS/实例（Y 手册 v5.8） | >700 预警 / >900 紧急 |
| Pipeline 并发执行 | 待实测（`orion_pipeline_running_total`） | 50 并发/平台（StageExecutor 默认） | >35 预警 / >45 紧急 |
| 告警事件/秒（EPS） | 待实测（`orion_alert_event_total`） | 200 EPS/集群 | >140 预警 / >180 紧急 |
| CMDB CI 数量 | 待实测（`orion_cmdb_ci_count`） | 500 万 CI/单库（Y P0-7 单表 1000 万上限） | >350 万 预警 / >450 万 紧急 |
| 工单数量/月 | 待实测（Ticketing 188 Service/118 Repo 现状可承载） | 50 万单/月/集群 | >35 万 预警 / >45 万 紧急 |
| AI 推理 QPS | 待实测（orion-ai-service） | 30 QPS/实例（GPU 受限） | >21 预警 / >27 紧急 |
| PG 连接数 | 待实测（`pg_stat_activity` count） | 200（ADR-005 §4.3 `max_connections=200`） | >140 预警 / >180 紧急 |
| PG 磁盘使用 | 待实测（`pg_database_size`） | 2 TB/主库（30d 备份 × 增量） | >1.4 TB 预警 / >1.8 TB 紧急 |
| Redis 内存 | 待实测（`used_memory_human`） | 8 GB/哨兵集群 | >5.6 GB 预警 / >7.2 GB 紧急 |
| 对象存储（Artifact/Backup） | 待实测（S3/MinIO） | 5 TB（含 30d 备份保留） | >3.5 TB 预警 / >4.5 TB 紧急 |
| 租户数 | 待实测（`tenants` 表 count） | ≤1000（Y P0-7 明确上限） | >700 预警 / >900 紧急 |
| Schema 数（Schema-per-tenant） | 0（ADR-011 混合方案，未启用） | ≤20 切 shared / >50 警告（Y P0-7） | >20 预警 / >45 紧急 |
| 单表行数 | 待实测（top 5 大表） | ≤1000 万行/表（Y P0-7） | >700 万 预警 / >900 万 紧急 |
| 连接池/租户 | 单库共享（ADR-0004） | 50 conn/租户（Y P0-7） | >35 预警 / >45 紧急 |

**扩容路径统一**：API/计算类走**水平扩容**（K8s HPA）；PG/Redis 走**垂直扩容 + 主从读写分离**；单表 >1000 万走**分库分表**（按 `tenant_id` 哈希）；对象存储走**生命周期策略**（30d→冷归档）。

---

## 2. 数据库容量规划（PostgreSQL 16+）

依据 ADR-005 §4.3 CloudNativePG 参数模板。

### 2.1 连接池

| 参数 | 当前值 | 规划基线 | 说明 |
|------|--------|---------|------|
| `max_connections` | 200（ADR-005） | 200 | Y P0-7 上限硬约束 |
| `shared_buffers` | 2 GB | 2 GB（8G 内存 25%） | AWS Well-Architected 推荐 |
| `effective_cache_size` | 6 GB | 6 GB（75% 内存） | — |
| `work_mem` | 16 MB | 16 MB | 需 `work_mem × max_parallel_workers` ≤ 1 GB |
| `maintenance_work_mem` | 512 MB | 512 MB | VACUUM/CREATE INDEX 使用 |
| pgbouncer | 未部署 | 部署，`pool_size=20`，`max_client_conn=1000` | 连接池化 |

### 2.2 表空间与索引

- **Migration 实测**：全仓 **2444 个 `.sql`**（`find -path '*migrations*' -name '*.sql'`）；核心表分布：Ticketing 118 / ITSM ~40 / Pipeline ~30 / CMDB ~20。
- **单表估算**：tickets 500 万行 × 2KB ≈ 10GB；pipeline_runs 300 万 × 4KB ≈ 12GB；cmdb_ci 500 万 × 1KB ≈ 5GB。
- **月度增长**：200-500 GB/月（WAL + 表膨胀 + TOAST）。
- **索引策略**：BTree（PK/FK/tenant_id 每表 1）/ GIN（JSONB 表 ~20% 表体积）/ GiST（CMDB 拓扑、SLA 时间轴）/ BRIN（logs、metrics_snapshot <1%）。
- **索引上限**：主库磁盘 30%；>40% 触发 `reindex` + 冗余索引清理。

### 2.3 WAL 与备份/PITR

| 项 | 值 | 依据 |
|----|-----|------|
| `wal_level` / `max_wal_size` / `min_wal_size` | `logical` / 4 GB / 1 GB | ADR-005 §4.3 |
| `wal_keep_size` | 2 GB（≥15min 副本延迟） | ADR-005 |
| 归档频率 / 目标 | 30s / `s3://orion-backup/postgresql/wal/` | ADR-004 PITR |
| 全量备份 / 增量 | 每日 03:00（`pg_basebackup`）/ 每 4h（PgBackRest） | ADR-005 |
| 保留策略 | 30d 备份链 | ADR-005 §4.3 |
| **RPO / RTO** | 15min（WAL 归档延迟）/ 1h（PITR 至指定时间） | ADR-005 §4.2 |
| 异地灾备 | 同 Region 跨 AZ；跨 Region 季度全量 | AWS Well-Architected Reliability |

---

## 3. 计算资源规划

### 3.1 CPU / 内存 / 副本数

| 服务 | CPU Req/Limit | 内存 Req/Limit | 副本 | 依据 |
|------|--------------|---------------|------|------|
| api-gateway-go | 500m/1000m | 512Mi/1Gi | 4 | GOMAXPROCS=4 |
| platform-svc-go | 1000m/2000m | 2Gi/4Gi | 6 | Y P0-7 1000 QPS |
| ai-service | 1000m/4000m | 4Gi/8Gi（GPU 另计） | 2 | LLM 30 QPS |
| visor（Java/Spring） | 500m/1000m | 1Gi/2Gi | 2 | GC G1，堆 1.5G |
| platform-service（TS） | 500m/1000m | 1Gi/2Gi | 2 | Node `--max-old-space-size=1536` |
| PostgreSQL (CNP) | 1000m/2000m | 8Gi | 3（1主2从） | ADR-005 §4.3 |
| Redis Sentinel | 250m/500m | 8Gi | 3（1主2从） | ADR-005 |
| ClickHouse | 2000m/8000m | 16Gi/32Gi | 3 | ADR-006 |

### 3.2 K8s HPA 模板

```yaml
apiVersion: autoscaling/v2
spec:
  minReplicas: 2
  maxReplicas: 12          # >70% 扩容，>90% 报警
  metrics:
    - resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
    - pods: { metric: { name: orion_http_requests_per_second },
              target: { type: AverageValue, averageValue: "700" } }
  behavior:
    scaleDown: { stabilizationWindowSeconds: 300 }
    scaleUp:   { stabilizationWindowSeconds: 0,
                 policies: [{ type: Percent, value: 100, periodSeconds: 30 }] }
```

### 3.3 Worker / Goroutine / Pool

| 组件 | 池大小 | 上限 |
|------|--------|------|
| Go `goroutine` | 无硬上限（GOMAXPROCS × 4） | 10 万 goroutine/进程 |
| Go `dbPool` (pgx) | `MaxOpenConns=40`，`MaxIdleConns=10` | 50/租户（Y P0-7） |
| Redis `pool` | `poolSize=20`，`maxActive=100` | 100 |
| Node.js worker_threads | `--experimental-worker`，池大小 4 | 8 |
| NATS subscriber | 每事件类型 1，`MaxPending=10000` | 20000 |

---

## 4. 存储资源规划

### 4.1 PG 磁盘与 Redis 内存

| 项 | PG 磁盘 | Redis 内存 |
|----|--------|----------|
| 初始/版本 | 500 GB（2000 表） | Redis 7.2+ Sentinel 3 节点 |
| 增长/单节点上限 | 200-500 GB/月 | 8 GB |
| 12 月累计 | 3-6 TB → 触发扩容 | — |
| 淘汰策略 | 冷归档 + TimescaleDB 聚合 | `allkeys-lru` |
| 命中率 | — | ≥ 90%（<85% 需扩容或审查热 key） |

### 4.2 对象存储生命周期

| 类别 | Bucket | 生命周期 |
|------|--------|----------|
| Pipeline Artifact | `orion-artifact` | 30d 热 / 90d 冷归档 / 180d 删除 |
| 制品版本 | `orion-image` | Tag 保留 6 个月 |
| PG 备份 | `orion-backup/postgresql/` | 30d（ADR-005 §4.3） |
| ClickHouse 冷数据 | `orion-ch-cold` | 90d 分区 → 冷归档 |
| 审计日志 | `orion-audit` | 1y |

### 4.3 日志分层（ADR-006 ClickHouse）

| 层级 | 保留 | 存储 |
|------|------|------|
| L1 结构化 | 30d | PG |
| L2 应用 | 90d 热 + 270d 冷 | ClickHouse 分布式 |
| L3 分析 | 1y | ClickHouse Archive |
| 合规归档 | 3-7y | S3 冷归档 |

---

## 5. 网络带宽规划

### 5.1 API 网关带宽

峰值 QPS 1000（Y P0-7）× 平均响应 4 KB = **4 GB/s/实例**；4 实例集群 = **16 GB/s**；预留 2× 突发 → **32 GB/s**。

### 5.2 服务间 & 外部依赖

| 链路 | 协议 | 峰值 |
|------|------|------|
| Gateway → Platform | HTTP/1.1 | 8 GB/s |
| Platform → PG / Redis / NATS | TCP pool | 4 / 2 / 1 GB/s |
| Platform → S3/MinIO / K8s API | HTTPS | 2 / 0.2 GB/s |
| AI-service ↔ Platform | gRPC HTTP/2 | 500 MB/s |
| Prometheus scrape | TCP 9090 | 100 MB/s |
| 外部：LLM / Git / 邮件 / 短信 | HTTPS | 500 MB / 100 / 100 / 50 MB/s |

### 5.3 数据库网络（读写分离）

主库入/出各 2 GB/s；只读副本 × 2 各 4 GB/s（BI 走副本）；ClickHouse 集群 8 GB/s。

---

## 6. 容量规划指标（Prometheus）

遵循 Google SRE Workbook Ch.3：每资源 3 指标（`usage_ratio` / `growth_rate` / `forecast_days_to_limit`），共 **12 资源 × 3 = 36 项 gauge**。

| 资源 | 使用率 | 周增长率 | 预测到上限天数 |
|------|--------|---------|--------------|
| API Gateway | `orion_apigw_usage_ratio` | `orion_apigw_growth_rate` | `orion_apigw_forecast_days_to_limit` |
| Pipeline | `orion_pipeline_usage_ratio` | `orion_pipeline_growth_rate` | `orion_pipeline_forecast_days_to_limit` |
| Alert | `orion_alert_usage_ratio` | `orion_alert_growth_rate` | `orion_alert_forecast_days_to_limit` |
| CMDB | `orion_cmdb_usage_ratio` | `orion_cmdb_growth_rate` | `orion_cmdb_forecast_days_to_limit` |
| Ticket | `orion_ticket_usage_ratio` | `orion_ticket_growth_rate` | `orion_ticket_forecast_days_to_limit` |
| AI | `orion_ai_usage_ratio` | `orion_ai_growth_rate` | `orion_ai_forecast_days_to_limit` |
| PG conn | `orion_pg_connection_usage_ratio` | `orion_pg_connection_growth_rate` | `orion_pg_connection_forecast_days_to_limit` |
| PG disk | `orion_pg_disk_usage_ratio` | `orion_pg_disk_growth_rate` | `orion_pg_disk_forecast_days_to_limit` |
| Redis | `orion_redis_memory_usage_ratio` | `orion_redis_growth_rate` | `orion_redis_forecast_days_to_limit` |
| ObjectStore | `orion_s3_usage_ratio` | `orion_s3_growth_rate` | `orion_s3_forecast_days_to_limit` |
| Tenants | `orion_tenant_ratio` | `orion_tenant_growth_rate` | `orion_tenant_forecast_days_to_limit` |
| Schema | `orion_schema_ratio` | `orion_schema_growth_rate` | `orion_schema_forecast_days_to_limit` |

**Alert 规则**：

```yaml
- alert: OrionCapacityHigh
  expr: <metric>_usage_ratio > 0.7
  for: 15m
  labels: { severity: warning }
- alert: OrionCapacityCritical
  expr: <metric>_usage_ratio > 0.9 OR <metric>_forecast_days_to_limit < 14
  for: 5m
  labels: { severity: critical }
```

---

## 7. 容量规划流程

| 阶段 | 频率 | 动作 | 责任人 | 输出 |
|------|------|------|--------|------|
| 日常监控 | 实时 | Prometheus 告警（70% / 90%） | SRE | 告警工单 |
| 周报 | 每周 | 12 项 `_growth_rate` 趋势 + 30d forecast | SRE | 周报 |
| 月度复盘 | 每月 | 12 项 forecast_days_to_limit 汇总 → 扩容决策 | SRE + 架构 | 扩容 PR |
| 季度规划 | 每季度 | 12 月容量路线图 + 云成本预测 | 架构 + FinOps | 路线图 |
| 事件驱动 | 事件 | 新大客户签约 / 新功能上线 → 前置评估 | 产品 + SRE | 容量评估单 |

**决策矩阵**：
- `forecast_days_to_limit > 90` → 无操作
- `90 > 天数 > 30` → 计划扩容（走月度复盘）
- `30 > 天数 > 7` → 提前扩容（走季度规划）
- `天数 < 7` → 紧急扩容（P0 走应急流程）

---

## 8. 与 Y 手册的对齐

| Y 手册任务 | 本容量规划覆盖 |
|-----------|--------------|
| **P0-6 SLO/SLA**（8 模块 P95/P99） | 容量作为 SLO 保障：CMDB P95<200ms 依赖 CMDB 表 ≤1000 万行；Alert P95<500ms 依赖 EPS ≤200 |
| **P0-7 容量规划** | ✅ 本文件（12 资源 × 3 指标 = 36 项） |
| **P0-8 混沌工程**（8 场景） | 混沌实验验证容量：DB 宕机 → 容量降级；K8s 节点失败 → 副本扩容；网络分区 → 熔断；消息积压 → 队列背压 |
| **P0-9 ADR-015 骨架** | Change 建模与容量变更挂钩：DDL 变更走 Change 工单 |
| **P0-10 门控数 29** | 容量复盘纳入门控（Y S5 阶段门控） |
| **ADR-005 数据库** | 细化 §4.3 参数：`max_connections=200`、`shared_buffers=2GB`、`wal_level=logical`、30d 备份 |
| **ADR-011 多租户** | 混合隔离容量隔离：租户数 ≤1000；schema>20 切 shared / >50 警告；连接池 50/租户 |
| **ADR-006 ClickHouse** | L2/L3 日志分层：90d 热 + 270d 冷 + 1y 归档 |

**Y §14.2 P0-7 验收映射**（6/6 覆盖）：租户数 ≤1000 / 连接池 50/租户 / QPS 1000/实例 / schema>20 切 shared >50 警告 / PG 连接池 200（ADR-005）/ 单表 1000 万行 —— 全部对应第 1/2/3/5 节。

---

## 9. 实施清单

| 项 | 状态 | 依赖 |
|----|------|------|
| 容量基线文档 | ✅ 本文件 | — |
| 12 资源 × 3 指标 Prometheus 埋点（36 项） | ⏳ 待代码落地 | RC-03 用户确认后 |
| Grafana Dashboard（12 面板 + 1 总览） | ⏳ 待配置 | 容量基线 |
| Alert 规则（70%/90% × 12 资源） | ⏳ 待配置 | 容量基线 |
| pgbouncer 部署 | ⏳ 待部署 | ADR-005 参数 |
| 月度容量复盘流程 | ⏳ 待建立流程 | 容量基线 + 周报 |
| 季度容量路线图模板 | ⏳ 待建立流程 | FinOps 接入 |
| 混沌实验 × 容量联动 | ⏳ 待建立 | P0-8 完成 |
| Y 手册 v5.9 §14.2 P0-7 状态更新为 ✅ | ⏳ 待用户确认 | 本文件 |

---

## 10. 企业级基准引用

| 来源 | 引用章节 | 应用点 |
|------|---------|--------|
| **AWS Well-Architected Framework** | Performance Efficiency Pillar | 数据库连接池、缓存策略、水平扩容 |
| **Google SRE Workbook Ch.3** | Capacity Planning | 3 指标模型（usage/growth/forecast）、告警阈值 70/90 |
| **Google SRE Book Ch.25** | Addressing Cascading Failures | 混沌实验与容量联动 |
| **Alibaba Cloud 容量规划最佳实践** | 多租户隔离下的容量隔离 | ADR-011 混合方案映射 |
| **Kubernetes HPA/VPA 最佳实践** | Autoscaling Pod Vertical | HPA 3.2 配置、VPA 内存建议 |
| **PostgreSQL 官方文档** | Section 18（Performance Tuning） | 2.1 参数基线 |
| **AWS RDS Best Practices** | Multi-AZ、PITR、备份保留 | 2.5 备份 / RPO / RTO |
| **Redis 官方文档** | maxmemory-policy、eviction | 4.2 LRU 淘汰策略 |
| **NeatLogic 一手对比** | DB-per-tenant + ThreadLocal | ADR-011 §1.2 引用 |
| **Y 手册 v5.8 §14.2** | P0-7 容量基线权威值 | 第 1 节数值来源 |

---

## 附录 A：ADR-011 混合隔离档位与 SLO 反向约束

ADR-011 混合方案三档 × 容量耦合规则：

| 档 | 触发条件 | 容量影响 | 规则 |
|----|---------|---------|------|
| L1 Shared-schema | 单租户 ≤500 万行 | 共享 200 conn 池 | schema 数 >20 自动降级回 L1（防连接池爆炸） |
| L2 Schema-per-tenant | 大客户/合规/>500 万行 | 每 schema 独立池 50 conn | schema 数 >50 告警（Y P0-7） |
| L3 DB-per-tenant | GDPR / 数据主权 | 独立实例独立配额 | 单 schema >1000 万行触发 L3 升级评估 |

容量是 SLO 的**反向约束**（超容量则 SLO 违约）：

| SLO | 容量硬约束 |
|-----|----------|
| CMDB P95<200ms | CI ≤ 500 万 |
| Alert P95<500ms | EPS ≤ 200 |
| Pipeline P95<2s | 并发 ≤ 50 |
| Ticket P95<300ms | 单表 ≤ 1000 万 |
| AI P95<5s | QPS ≤ 30 |
| BI P95<3s | ClickHouse 分区 ≤ 90d 热 |

---

## Skill Handoff Checklist

| 项 | 值 |
|----|-----|
| 产出 | P0-7 容量规划基线（docs/capacity-plan-2026-10-11.md v1.0） |
| 依据 | Y v5.8 §14.2 P0-7 / ADR-005 §4.3 / ADR-011 / ADR-006 / ADR-0004 |
| RC-03 合规 | ✅ 设计文档，未修改生产代码 |
| 无人天估算 | ✅ |
| 基准引用 | ✅ 10 项（AWS/Google/Alibaba/K8s/PG/RDS/Redis/NeatLogic/Y） |

**下游路由**：

| 技能 | count | 目标 | 说明 |
|------|-------|------|------|
| design-constraint | 0 | — | 设计文档无 AST 项 |
| design-doc-reviewer | 1 | 本文件 | 7 维度评审 |
| code-design-analyzer | 1 | PG 参数/HPA/连接池拓扑 | 与 ADR-005 §4.3 交叉验证 |
| task-decomposer | 4 | T1 Prometheus 36 指标埋点 / T2 Grafana 12 面板 / T3 Alert 70-90% × 12 / T4 pgbouncer 部署 | 全部依赖 RC-03 用户确认 |

**验收命令**：

```bash
grep -c '容量\|上限\|阈值\|QPS' docs/capacity-plan-2026-10-11.md   # 预期 >15（Y P0-7）
wc -l docs/capacity-plan-2026-10-11.md                              # 预期 200-300
grep -c '_usage_ratio\|_growth_rate\|_forecast_days_to_limit' docs/capacity-plan-2026-10-11.md  # 预期 12+
```
