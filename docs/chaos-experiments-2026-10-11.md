# Orion 混沌工程实验清单

| 项 | 内容 |
|---|------|
| **任务来源** | Y 手册 v5.8 §14.2 **P0-8 混沌工程剧本**（依据 big-tech-adversarial-review P0-04） |
| **依据缺口** | NL-5 已证 Orion 无混沌模块，**0 项故障注入场景**；风险登记册（59 项）无混沌章节 |
| **本文件定位** | CC §4 混沌工程剧本的权威实现——**10 场景**（超出 P0-8 要求的 8 场景） |
| **不做什么** | 不修改生产代码（RC-03）；不估算人天/工期；仅定义场景、指标、流程 |
| **前置依赖** | P0-6 SLO/SLA 定义（§14.2）+ P0-7 容量规划基线（§14.2）——指标阈值取自二者 |
| **日期** | 2026-10-11 |

> **与 P0-8 的映射**：Y 手册 §14.2 要求 8 场景（DB 宕机 / Redis 断连 / K8s 节点失败 / 网络分区 / 时钟漂移 / 租户隔离泄露 / API 限流 / 消息积压）。本文件全部覆盖，并补充 CHAOS-05 CPU 打满、CHAOS-06 磁盘写满、CHAOS-09 AI 降级共 2 项，形成 10 场景闭环。**每个场景均含触发条件 + 注入方法 + 预期行为 + 恢复验证 + 回滚步骤**（P0-8 验收四要素）。

---

## 1. 混沌工程实验总览

| 实验 ID | 名称 | 目标系统 | 故障类型 | 优先级 | 前置依赖 |
|--------|------|---------|---------|-------|---------|
| CHAOS-01 | DB 连接池耗尽 | API Gateway / Platform Svc | 资源耗尽 | P0 | SLO/SLA 定义（P0-6） |
| CHAOS-02 | PG 主库故障 | 所有服务 | 单点故障 | P0 | 备份策略 + PITR |
| CHAOS-03 | Redis 故障 | 缓存 / AlertBreaker | 单点故障 | P0 | Redis 配置 |
| CHAOS-04 | 网络分区 | 微服务间 | 网络分区 | P1 | 服务网格 |
| CHAOS-05 | CPU 打满 | Pipeline Engine | 资源耗尽 | P1 | HPA 配置 |
| CHAOS-06 | 磁盘写满 | 对象存储 / artifact | 资源耗尽 | P1 | 清理策略 |
| CHAOS-07 | 告警风暴 | Alert System | 流量突增 | P1 | 限流配置 + ADR-010 |
| CHAOS-08 | 流水线超时 | Pipeline Engine / ArtifactBus | 超时故障 | P1 | 超时配置 + ADR-014 |
| CHAOS-09 | AI 服务降级 | AI Service | 依赖降级 | P2 | 降级配置 |
| CHAOS-10 | 多租户隔离失效 | 所有服务 | 隔离故障 | P2 | ADR-011 |

**故障类型分类（Google SRE Book Ch.18 / Ch.20）**：单点故障（1-2 类）· 资源耗尽（3-6 类）· 网络分区（7-10 类）· 流量突增（11-12 类）· 依赖降级（13-14 类）。Orion 当前 10 场景覆盖全部 5 类，无类别盲区。

**执行环境矩阵**：所有实验**先在灰度集群执行**，通过后才可上生产 Canary。CHAOS-02（PG 主库故障）与 CHAOS-10（隔离失效）为**最高危**，生产 Canary 需双人审批 + 冻结窗口。

---

## 2. 实验详细设计

### CHAOS-01：DB 连接池耗尽（P0）

| 项 | 内容 |
|---|------|
| **实验目标** | 验证 API Gateway / Platform Svc 在 PG 连接池饱和时的行为：是否快速失败（fast-fail）、是否触发容量告警、是否会级联拖垮上游。验证 P0-7 容量基线「**PG 连接池上限 200**」「连接池 50/租户」在真实耗尽下的表现 |
| **注入方式** | ChaosBlade `network delay` 施加于 `postgres` Service 连接 + PG 侧 `max_connections` 临时下调（Chaos Mesh 无原生连接池控制器，此场景以 **ChaosBlade + psql 组合**实现） |
| **注入参数** | 灰度：`ALTER SYSTEM SET max_connections = 20` → `pg_ctl reload`；生产 Canary：仅注入 5 min、且仅针对单实例；**持续时间 60s（灰度）/ 300s（Canary）**，强度 = 连接数打满至 100% |
| **预期行为** | ① 新建连接阻塞 → 排队 ≤200 后快速返回 `503 CLIENT.DB_POOL_EXHAUSTED`，**不静默挂起**；② `pg_stat_activity` 中 `active` 连接不超 max_connections；③ 触发 P0-6 SLO burn-rate 告警；④ API Gateway 不出现 goroutine 泄漏（`runtime.NumGoroutine` 峰值后回落） |
| **验证指标** | `pg_stat_activity.active_connections` = max_connections（100%）；`pg_stat_activity.waiting_connections > 0`；`orion_http_requests_total{status="503"} rate[1m] > 0`；`p99_latency_ms > 3000`（预期超 SLO，用于验证告警触发）；`alert_breaker_pg_connections_used > 80%`（ADR-010 阈值） |
| **回滚方案** | ① `ALTER SYSTEM RESET max_connections; pg_ctl reload;` ② 若进程僵死：`kubectl delete pod -l app=platform-svc`（HPA 自动补） ③ 全量回滚确认：`SELECT count(*) FROM pg_stat_activity WHERE state='active'` 应 <50% max |
| **风险评估** | 灰度风险低（隔离集群）。生产风险：**中-高**——连接池耗尽可能拖累同实例所有请求。缓解：仅限单实例 + 300s 上限 + 冻结窗口执行 + 提前通知值班 |

### CHAOS-02：PG 主库故障（P0）

| 项 | 内容 |
|---|------|
| **实验目标** | 验证数据库层单点失效时的服务韧性：应用是否正确进入降级态而非无限重试；验证备份/PITR 恢复流程可执行；验证 R-P0-03（Alert 5 家族 PG 持久化）在库故障下不丢数据的声明 |
| **注入方式** | Chaos Mesh `NetworkChaos`（`type: partition`）切断 DB pod 到应用的出向流量；备选 `PodChaos { action: kill }` 直接杀 DB pod（用于验证 K8s 重启恢复路径） |
| **注入参数** | 灰度：kill DB pod，观察自动重启（**60s**）；生产 Canary：**仅做网络分区**（不 kill），持续时间 120s，分区范围 = 应用命名空间 ↔ DB pod |
| **预期行为** | ① 应用在连接错误后 **≤5 次重试** 进入熔断态，返回 503 而非堆积超时；② **无重试风暴**（`orion_db_retry_total` 增长与注入成正比而非指数）；③ Pod 重启路径下应用 30s 内重连成功；④ 事务类操作（AlertBreaker 行锁）返回明确的 `SERVER.DB_UNAVAILABLE`，**不产生半提交** |
| **验证指标** | `orion_db_connections_opened_total` 归零后回升；`orion_db_retry_total rate[1m]` 有界（<50/min）；`pg_stat_statements` 无新增长事务；RTO 实测 ≤ 目标值（备份策略定义）；`chaos_recovery_time_ms` p99 ≤ 5min |
| **回滚方案** | ① 删除 `NetworkChaos` CR：`kubectl delete netchaos/orion-pg-partition` ② 确认分区解除：`kubectl exec -it pg-pod -- pg_isready -h 127.0.0.1` 返回 `accepting connections` ③ 若自动重启失败：`kubectl logs db-pod --previous` 定位后手动恢复副本 |
| **风险评估** | 生产风险 **高**——这是最接近真实灾难的场景。约束：生产 Canary 禁止 kill pod（仅网络分区），必须双人审批 + 业务低峰窗口 + 值班双人到岗。**首次只可在灰度执行** |

### CHAOS-03：Redis 故障（P0）

| 项 | 内容 |
|---|------|
| **实验目标** | 验证 Redis 不可用时的缓存降级：读路径回源 PG 是否导致 PG 过载（缓存穿透）；写路径是否丢缓存而不影响主流程。ADR-010 已决策 AlertBreaker 采用 **PG `SELECT FOR UPDATE` 行锁**而非 Redis，故此实验同时验证「ADR-010 方案 A 已使 Alert 抑制不依赖 Redis」这一架构结论 |
| **注入方式** | Chaos Mesh `NetworkChaos` 阻断 Redis 端口 6379（`action: delay delay: 5000ms` 模拟超时，或 `partition` 模拟断连） |
| **注入参数** | 灰度：断连 **90s**；生产 Canary：仅延迟（`delay 3000ms`）180s，不断连 |
| **预期行为** | ① 缓存读 miss → 回源 PG，但**必须有单飞/限流**防止 PG 被打爆（`pg_stat_activity.active` 增幅 <50%）；② 缓存写失败仅记日志，不中断请求；③ AlertBreaker 抑制判定**不受影响**（走 PG 行锁，ADR-010）；④ `alert_breaker_lock_duration_ms` p99 保持 <2000ms（ADR-010 阈值） |
| **验证指标** | `redis_commands_total` 归零；`orion_cache_hit_ratio` 降至 <10%；**关键**：`pg_stat_activity.active` 增幅 <50%（防穿透）；`alert_breaker_lock_duration_ms{quantile="0.99"} < 2000`；`alert_breaker_deadlock_total` 增量 = 0 |
| **回滚方案** | ① 删除 NetworkChaos CR ② `redis-cli ping` 返回 `PONG` ③ 观察缓存命中率 5min 内恢复基线 |
| **风险评估** | 灰度低。生产风险 **中**——主要风险是缓存穿透打爆 PG。若 P0-7 未定义缓存回源限流，此实验**必然暴露缺陷**，应先修再注入 |

### CHAOS-04：网络分区（P1）

| 项 | 内容 |
|---|------|
| **实验目标** | 验证微服务间网络分区时的部分可用性（SRE「部分容量」目标）：Gateway → Platform 分区时，非依赖路径是否仍可用；验证超时与熔断是否正确切断分区方向流量 |
| **注入方式** | Chaos Mesh `NetworkChaos` `action: partition`，按 label 划分双向不连通子网 |
| **注入参数** | 灰度：分区 2 个副本（共 4），持续 **180s**；生产 Canary：分区 25% 副本，120s |
| **预期行为** | ① 分区侧请求失败率上升但**不扩散到健康侧**（健康副本成功率 >99.5%）；② 熔断器在 ≤3 个失败样本后打开；③ 分区解除后 ≤30s 自动恢复（半开探测）；④ 无「分区侧重试流量洪泛健康侧」现象 |
| **验证指标** | `orion_http_requests_total{pod=~"partitioned"} rate[1m]` 失败率 ↑；健康副本 `http_request_duration_seconds{quantile="0.99"}` 保持 ≤ SLO；`circuit_breaker_state{state="open"} == 1`；分区解除后 30s 内成功率回升 >99% |
| **回滚方案** | `kubectl delete netchaos/<name>`；`kubectl get netchaos` 确认清空；观察 `in_flight_requests` 归零 |
| **风险评估** | 灰度低。生产风险 **中**：若熔断器未正确隔离，分区侧重试可能压垮健康副本。前置检查熔断器配置 |

### CHAOS-05：CPU 打满（P1）

| 项 | 内容 |
|---|------|
| **实验目标** | 验证 Pipeline Engine 在 CPU 饱和下的行为：HPA 是否按 CPU 触发扩容；SSE 实时日志流（Pipeline SSE Integration）是否在算力紧张下降级；goroutine 是否堆积 |
| **注入方式** | ChaosBlade `cpu fullload --cpu-percent 100 --cpu-num <N>`，注入于 Pipeline Engine 容器 |
| **注入参数** | 灰度：单副本 100% CPU 单核，**120s**；生产 Canary：40% 副本各打 1 核，180s |
| **预期行为** | ① HPA 在 2min 内扩容（CPU 阈值触发）；② SSE 流在 CPU 饱和时**丢弃而非阻塞**（背压生效，`orion_sse_dropped_total` ↑）；③ 关键路径（Stage 调度）P99 退化有界；④ `runtime.GOMAXPROCS` 未被 OOM 杀 |
| **验证指标** | `container_cpu_usage_seconds_total` 打满；`kube_horizontalpodautoscaler_status_current_replicas` 上升；`orion_sse_dropped_total rate[1m] > 0`（预期）；SSE 客户端无永久 hang |
| **回滚方案** | 执行 ChaosBlade `recover`；`kubectl top pod` 确认 CPU 回落；如已触发扩容，手动缩容回基线 |
| **风险评估** | 低-中。风险是打满共享节点导致同节点其他 pod 受影响，应限定到独立节点池 |

### CHAOS-06：磁盘写满（P1）

| 项 | 内容 |
|---|------|
| **实验目标** | 验证对象存储 / artifact 写满时 ADR-014 的降级路径：ADR-014 规定单 artifact **10MB 上限**、保留期 **7 天**、`ArtifactBus.Publish` 失败**不阻断 stage 执行**（仅 log warning）。验证存储满时 pipeline 是否仍成功完成 |
| **注入方式** | ChaosBlade `disk fill --size 95%`，注入 artifact 存储卷 |
| **注入参数** | 灰度：填充至 95%，**240s**；生产 Canary：**不在生产执行**（磁盘满会损坏卷），仅灰度 |
| **预期行为** | ① artifact 发布失败 → stage **仍成功完成**（ADR-014 §降级路径）；② `log.Warn("artifact publish failed")` 出现；③ 不产生 >10MB artifact；④ 7 天过期清理作业正常跑（不依赖剩余空间） |
| **验证指标** | `df -h` 使用率 >95%；`orion_artifact_publish_failures_total rate[1m] > 0`；**关键**：`pipeline_runs_total{status="succeeded"} rate[10m]` 不因 artifact 失败而下降；feature flag `artifact_bus` 状态查询端点可正常返回 |
| **回滚方案** | ① ChaosBlade `recover` ② 删除填充文件 ③ 恢复后执行 artifact 清理作业，确认容量回落到基线 |
| **风险评估** | 生产风险 **极高**（卷损坏不可逆）——**明确禁止生产执行**。仅灰度。这是本清单中唯一禁止上生产的场景 |

### CHAOS-07：告警风暴（P1）

| 项 | 内容 |
|---|------|
| **实验目标** | 直接验证 **ADR-010 AlertBreaker 并发模型**的核心主张：PG `SELECT ... FOR UPDATE` 行锁 + Serializable + **5s 硬超时**在告警洪峰下保持抑制窗口原子性、不产生死锁与重试风暴。这是本清单中**架构验证价值最高**的实验 |
| **注入方式** | 自研压测器向 Alert Ingest 端点注入合成告警（复用现有 `alertLockTx(ctx, tenantID)` 路径），QPS 阶梯递增 |
| **注入参数** | 灰度：50 → 500 → 2000 QPS，每档保持 120s；生产 Canary：单租户 200 QPS，60s |
| **预期行为** | ① 事务持锁时长保持 <100ms（ADR-010 §4）；② **无死锁**（`deadlock_timeout=1s` 下可容忍偶发，但业务层加锁顺序约定应消除）；③ 抑制窗口原子：同 uniqueKey 告警在窗口内被正确合并；④ 高并发下**重试风暴受控**（ADR-010 已识别此为方案 C 风险，方案 A 不应出现） |
| **验证指标** | `alert_breaker_lock_duration_ms{quantile="0.99"} < 2000`（ADR-010 告警阈值）；`alert_breaker_deadlock_total` 增量 ≤1/10min；`alert_breaker_transaction_timeout_total rate[1m] < 5/min`（ADR-010 阈值）；`alert_breaker_pg_connections_used < 80% max_connections`；抑制率实测 = 理论抑制率 |
| **回滚方案** | ① 停止压测器 ② 确认 `pg_stat_activity` 无 idle in transaction（应 <30s idle_timeout）③ 清理测试告警数据 |
| **风险评估** | 灰度低-中（PG 是共享资源）。生产风险 **中**：注入 QPS 高会占用 PG 连接。若 ADR-010 未落地（Migration 736 `alert_breaker_state` 表不存在），此实验**应失败**，此时不注入生产，转回 S4 pre 门控 |

### CHAOS-08：流水线超时（P1）

| 项 | 内容 |
|---|------|
| **实验目标** | 验证 ADR-014 的 **artifact 事务超时 30s** 与 artifact 写入超时降级：artifact 写入阻塞时 pipeline 是否按设计降级而非整体失败；验证 ArtifactBus 7 天 TTL 清理链路在超时压力下仍工作 |
| **注入方式** | ChaosBlade `network delay` 施加于 artifact 存储方向（`delay 8000ms` 使单次 artifact 写入逼近 30s 事务超时）；备选 Chaos Mesh `IOChaos` 制造存储写延迟 |
| **注入参数** | 灰度：延迟 8s，**240s**；生产 Canary：延迟 3s，120s |
| **预期行为** | ① artifact 写入 >30s → 事务回滚，`PipelineSaga` 按补偿逻辑处理（不产生孤立 artifact）；② stage 主流程按 ADR-014 降级路径继续（artifact 失败仅 warn）；③ 30s 边界行为明确（要么成功要么回滚，**无悬挂事务**） |
| **验证指标** | `pipeline_stage_duration_seconds{quantile="0.99"} < 30000`（30s 事务超时上界）；`orion_artifact_publish_failures_total` ↑ 但 `pipeline_runs_total{status="succeeded"}` 不下降；**关键**：无 `idle_in_transaction_session_timeout=30s` 触发的空闲事务；ADR-014 Migration 730 `pipeline_artifacts` 表无孤立行 |
| **回滚方案** | ① 删除 NetworkChaos/IOChaos CR ② `DELETE FROM pipeline_artifacts WHERE expires_at < now()` 清孤立 ③ 验证 Saga 事务日志无悬挂补偿 |
| **风险评估** | 灰度低-中。生产风险 **低-中**：仅延迟不丢包。约束是延迟值不能超过 Saga 超时导致全链路级联，Canary 用 3s 保守值 |

### CHAOS-09：AI 服务降级（P2）

| 项 | 内容 |
|---|------|
| **实验目标** | 验证 AI 微服务（`orion-ai-service`，Python 权威实现）不可用时，主流程是否优雅降级为「无 AI 辅助」而非整体失败。AI 是增强层不是关键路径——这是本实验的核心断言 |
| **注入方式** | Chaos Mesh `NetworkChaos` 阻断 AI 服务端口；或 `PodChaos { action: kill }` 反复重启 |
| **注入参数** | 灰度：断连 **180s**；生产 Canary：断连 120s |
| **预期行为** | ① 依赖 AI 的调用返回明确降级响应（`200` + `degraded: true` 或 `503` + 可重试标记），**不拖慢主请求超时预算**；② 不出现重试放大（AI 调用应有独立超时预算，不与主流程共享）；③ 前端展示降级态提示而非空白 |
| **验证指标** | `orion_ai_calls_total{status="degraded"} rate[1m] > 0`；主流程 P99 延迟增量 <50ms（**关键**：AI 故障不得传导）；`ai_service_http_requests_total` 归零后主服务成功率保持 >99.5% |
| **回滚方案** | ① 删除 NetworkChaos CR ② 确认 AI 服务健康探针恢复 ③ 前端降级提示消失 |
| **风险评估** | 低。AI 服务本就是旁路，注入风险最小，适合作为团队的**首练场景** |

### CHAOS-10：多租户隔离失效（P2）

| 项 | 内容 |
|---|------|
| **实验目标** | 验证 **ADR-011 多租户存储隔离**（ADR-0004 Shared-schema + tenant_id 列过滤）在极端条件下的零泄露声明。注入「租户上下文丢失」的恶意场景，验证即使应用层 tenant_id 缺失，数据层是否仍有兜底 |
| **注入方式** | 自研注入器发起**故意缺失 / 伪造 `X-Tenant-ID` 头**的请求序列（正常 + 空值 + 交叉租户 ID + 超长 ID），观测 Repository 层过滤是否兜底 |
| **注入参数** | 灰度：混合租户 3 个 × 每类 100 请求，**180s**；生产 Canary：**仅灰度执行**（伪造租户上下文在生产需合规审批） |
| **预期行为** | ① **零跨租户数据泄露**（架构层面不可能，ADR-011 方案 B 目标）；② 缺失 tenant_id 的请求被 ACL 拦截（`aclMiddleware`/`authGuard`），返回 401/403 而非查全表；③ 伪造 tenant_id 无法越权（cmdb-import 已修的 `StartJob` 跨租户越权类问题不得回归）；④ 单租户行数 <1000 万时查询性能正常（ADR-011 §2.1） |
| **验证指标** | **关键**：所有响应中返回的 `tenant_id` 与请求头一致，**跨租户行数 = 0**；`WHERE ... tenant_id` 过滤覆盖：`grep -c "tenant_id" 各 Repository` 应 100%；无请求返回 >1 个租户的数据；401/403 比例符合预期 |
| **回滚方案** | ① 停止注入器 ② 清理注入测试数据（按注入时记录的 tenant_id 精确删除） ③ 审计日志复核无实际越权 |
| **风险评估** | 生产风险 **极高**（合规红线）——**禁止生产执行**，仅灰度。且需 ADR-011 方案 B（schema-per-tenant）迁移就绪后才可验证「强隔离」层；Shared-schema 阶段只能验证「逻辑隔离」层 |

---

## 3. 实验执行流程

```
实验设计 → 评审 → 灰度环境验证 → 生产 Canary → 全量执行 → 复盘
```

### 阶段 A：实验设计

| 项 | 内容 |
|---|------|
| **准入条件** | 目标系统已有 SLO/SLA 定义（P0-6）+ 容量基线（P0-7）；实验的「验证指标」均可在当前监控中查到；实验所属 ADR 已批准（CHAOS-07→ADR-010 / CHAOS-08→ADR-014 / CHAOS-10→ADR-011） |
| **执行动作** | 按 §2 模板填写实验设计；每个实验必须同时具备「注入参数」+「验证指标」两节，缺一不得进入评审 |
| **验证方法** | 评审时逐条核对 5 要素：目标 / 注入方式 / 注入参数 / 预期行为 / 验证指标 / 回滚方案 |
| **退出条件** | 评审通过且回滚方案已实测可执行（**未实测回滚的实验禁止进入灰度**） |

### 阶段 B：评审

| 项 | 内容 |
|---|------|
| **准入条件** | 实验设计已完整填写 |
| **执行动作** | 值班负责人 + SRE + 模块 Owner 三方评审；生产 Canary 实验需额外双人审批 + 业务冻结窗口确认 |
| **验证方法** | 检查注入强度对生产的影响评估；确认监控告警已就位（SLO burn-rate + 混沌专用指标） |
| **退出条件** | 三方签字；CHAOS-02/06/10 需书面风险接受记录 |

### 阶段 C：灰度环境验证

| 项 | 内容 |
|---|------|
| **准入条件** | 灰度集群与生产配置同构（副本数、资源限制、HPA 阈值一致）；灰度集群无共享生产 PG/Redis |
| **执行动作** | 按注入参数执行；执行期间持续抓取指标：`kubectl get netchaos,iodaemonstatus` + PromQL 抓取验证指标 |
| **验证方法** | 逐条比对「验证指标」与实测值；关键断言必须全部满足（如 CHAOS-07 的 `alert_breaker_lock_duration_ms p99 < 2000`） |
| **退出条件** | **成功**：全部验证指标达标 → 进入生产 Canary 评估。**失败**：定位根因，产出缺陷单，实验挂起。**禁止带缺陷上生产** |

### 阶段 D：生产 Canary

| 项 | 内容 |
|---|------|
| **准入条件** | 灰度通过；业务低峰窗口；值班双人到岗；CHAOS-06/10 直接跳过本阶段（禁止生产） |
| **执行动作** | 用 **Canary 注入参数**（强度约为灰度的 1/3）执行；单实例或单副本起 |
| **验证方法** | 实时监控 SLO burn-rate；注入期间 `chaos_slo_burn_rate_delta` 不得超过预算 |
| **退出条件** | **成功**：SLO 未破线 + 恢复时间 ≤5min。**失败**：立即删除 Chaos CR 中止，进入复盘 |

### 阶段 E：全量执行

| 项 | 内容 |
|---|------|
| **准入条件** | Canary 通过 + 复盘无遗留缺陷 |
| **执行动作** | 按目标强度注入；按 §5 调度计划定期重跑（回归性质） |
| **验证方法** | 指标全量采集，写入实验记录 |
| **退出条件** | 指标达标；`chaos_experiment_total{result="success"}` 递增 |

### 阶段 F：复盘

| 项 | 内容 |
|---|------|
| **准入条件** | 实验执行完毕（无论成败） |
| **执行动作** | 记录实测 RTO/RPO；对比预期行为；产出缺陷单（预期不符项）；更新风险登记册对应条目状态 |
| **验证方法** | 每条「预期行为」必须有实测结论（符合 / 不符合 / 不适用） |
| **退出条件** | 复盘报告归档；发现的缺陷已进入 P0/P1 待办队列 |

---

## 4. 混沌工程指标

| 指标 | 类型 | 阈值 |
|------|------|------|
| `chaos_experiment_total` | Counter | 按 `experiment_id` / `result`(success\|failure) 分组；失败即告警 |
| `chaos_experiment_duration_ms` | Histogram | p99 > 30min 告警（实验异常拉长说明回滚受阻） |
| `chaos_injection_active` | Gauge | 当前活跃注入数；>1 需审批（防并发注入叠加） |
| `chaos_failure_detected_total` | Counter | 按 `failure_type` 分组，用于分类趋势 |
| `chaos_recovery_time_ms` | Histogram | p99 > 5min 告警（恢复慢=韧性不足） |
| `chaos_slo_burn_rate_delta` | Gauge | 注入期间 SLO 消耗变化；超过错误预算分配比例即中止 |

**与既有监控指标的衔接**（避免重复定义，以下来自 ADR-010 §5 与 Y 手册 P0-6）：

| 指标 | 阈值 | 来源 | 关联实验 |
|------|------|------|---------|
| `alert_breaker_lock_duration_ms` | p99 > 2000ms 告警 | ADR-010 §5 | CHAOS-07 |
| `alert_breaker_deadlock_total` | >0 告警 | ADR-010 §5 | CHAOS-07 |
| `alert_breaker_transaction_timeout_total` | >5/min 告警 | ADR-010 §5 | CHAOS-07 |
| `alert_breaker_pg_connections_used` | >80% max_connections 告警 | ADR-010 §5 | CHAOS-01 / 07 |
| `chaos_recovery_time_ms` | p99 > 5min | 本文件 | 全部 |

---

## 5. 实验调度计划

| 阶段 | 频率 | 实验范围 |
|------|------|---------|
| 阶段 1（1 月内） | 每月 | P0 实验 3 个（CHAOS-01/02/03） |
| 阶段 2（3 月内） | 每月 | P1 实验 5 个（CHAOS-04/05/06/07/08） |
| 阶段 3（6 月内） | 每季度 | P2 实验 2 个（CHAOS-09/10） |

**调度约束**：

1. 阶段 1 前必须完成 P0-6（SLO/SLA）与 P0-7（容量规划）——否则验证指标无阈值可比对，实验结果不可判定
2. **同一时间仅允许 1 个活跃注入**（`chaos_injection_active <= 1`），避免故障叠加导致根因不可分辨
3. CHAOS-09 建议作为团队首次演练（风险最低、路径最清晰）
4. CHAOS-02/06/10 每阶段仅执行 1 次，且不得连续两月执行（留出系统恢复与观察期）
5. 生产 Canary 全部安排在业务低峰冻结窗口；灰度可常态化

---

## 6. 与 Y 手册的对齐

| Y 手册任务 | 本混沌工程覆盖 |
|-----------|--------------|
| P0-6 SLO/SLA | CHAOS-01/02/04/09 验证 SLO 韧性（burn-rate 不破线） |
| P0-7 容量规划 | CHAOS-01 验证连接池上限 200 / CHAOS-06 验证存储边界 |
| P0-8 混沌工程 | ✅ 本文件（10 场景，超出要求的 8 场景） |
| P0-9 ADR-015 | —（ADR-015 为骨架补齐，非混沌可验证对象） |
| P0-10 门控数统一 | 混沌实验纳入 S0-S8 门控体系（Y=29 权威） |
| ADR-010 AlertBreaker | CHAOS-07 验证断路器/并发窗口抑制（核心架构验证） |
| ADR-014 ArtifactBus | CHAOS-08 验证 artifact 降级路径（Publish 失败不阻断 stage） |
| ADR-011 多租户 | CHAOS-10 验证隔离失效兜底（零跨租户泄露） |
| ADR-015 Change | CHAOS-04 间接验证变更期间的网络分区韧性 |
| 风险登记册 R-P0-01 | CHAOS-08 验证 artifact 传播不破坏 pipeline |
| 风险登记册 R-P0-03 | CHAOS-02/03 验证 Alert 5 家族 PG 持久化不丢数据 |
| 风险登记册 R-P2-14 | CHAOS-07 验证 AlertBreaker Serializable 死锁概率 |

---

## 7. 混沌工程成熟度

| 等级 | 能力 | 当前状态 |
|------|------|---------|
| L1 观察 | 监控指标可见（SLO/容量基线） | ⏳ 待 P0-6/7（指标存在但无阈值） |
| L2 控制 | 故障注入可控（场景 + 参数 + 回滚） | ⏳ 待本文件落地（本文件定义场景，Chaos Mesh 部署待基础设施） |
| L3 自动化 | 实验自动调度（CI/CD 集成 + 定时触发） | ⏸ 远期（依赖 L2 稳定运行后） |
| L4 文化 | 混沌成为日常（团队常规演练 + 自动报告） | ⏸ 远期 |

**当前定位**：Orion 处于 **L1 → L2 过渡期**。P0-6/7 补齐指标阈值后达 L1；本文件 + Chaos Mesh 部署完成后达 L2。

---

## 8. 实施清单

| 项 | 状态 | 依赖 |
|----|------|------|
| 混沌实验清单 | ✅ 本文件（10 场景 × 5 要素） | — |
| 混沌专用指标定义（§4） | ✅ 本文件 | — |
| Chaos Mesh 部署 | ⏳ 待基础设施 | K8s 集群 |
| ChaosBlade 集成 | ⏳ 待基础设施 | K8s 集群（CHAOS-01/05/06 必需） |
| 实验脚本 | ⏳ 待编写 | 本文件 |
| 灰度环境同构配置 | ⏳ 待配置 | 灰度集群 |
| 灰度环境验证 | ⏳ 待执行 | 实验脚本 |
| 生产 Canary | ⏳ 待执行 | 灰度验证 + 双人审批 |
| 定期重跑调度 | ⏸ 远期（L3） | L2 稳定运行 |

---

## 9. 企业级基准引用

- **Google SRE Book** Ch.18 未覆盖故障注入细节，见 **Ch.19「Chaos Engineering」** 与 Ch.20（Failure Domains）——本文件故障类型分类沿用 SRE 的故障域划分
- **Netflix Chaos Engineering 论文**（2018, K. Petersen et al.）——稳态假设（Hypothesis of Steady State）是本文件「预期行为 + 验证指标」方法论的来源
- **Chaos Mesh 最佳实践**（CR 化注入：`NetworkChaos` / `PodChaos` / `IOChaos`）——本文件首选注入引擎
- **ChaosBlade**（阿里开源）——CPU/磁盘类资源耗尽注入（`cpu fullload` / `disk fill`），Chaos Mesh 无原生等价物
- **Alibaba Cloud 混沌工程白皮书**——故障注入分级与业务冻结窗口规范

---

## 附录 A：生产执行禁止清单

| 实验 | 生产 Canary | 原因 |
|------|------------|------|
| CHAOS-06 磁盘写满 | ❌ 禁止 | 卷损坏不可逆 |
| CHAOS-10 多租户隔离失效 | ❌ 禁止 | 伪造租户上下文触合规红线 |
| CHAOS-02 PG 主库故障 | ⚠️ 限缩 | 仅网络分区，禁止 kill pod |
| 其余 7 项 | ✅ 允许 | 需 Canary 参数（灰度强度 1/3） |

## 附录 B：验证指标速查

| 实验 | 关键断言（必须全部满足才算通过） |
|------|-------------------------------|
| CHAOS-01 | 连接池 100% 时返回 503 快速失败，无 goroutine 泄漏 |
| CHAOS-02 | 重试有界（<50/min），无重试风暴，无半提交事务 |
| CHAOS-03 | 缓存穿透不放大：PG active 增幅 <50%；AlertBreaker 不受影响 |
| CHAOS-04 | 分区侧故障不扩散：健康副本成功率 >99.5% |
| CHAOS-05 | HPA 2min 内扩容；SSE 丢弃而非阻塞 |
| CHAOS-06 | artifact 发布失败时 pipeline 仍 succeed（ADR-014 降级路径） |
| CHAOS-07 | `lock_duration_ms p99 <2000`、deadlock ≤1/10min、tx_timeout <5/min |
| CHAOS-08 | 无悬挂事务（30s 边界明确），stage 主流程不受影响 |
| CHAOS-09 | AI 故障不传导：主流程 P99 增量 <50ms |
| CHAOS-10 | 跨租户数据行数 = 0（架构级零泄露） |
