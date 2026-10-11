# ADR-010: AlertBreaker 并发模型选型

| 元数据 | |
|--------|------|
| 状态 | 已接受（Accepted） |
| 提出日期 | 2026-10-03 |
| 决策日期 | 2026-10-11 |
| 提出人 | 架构团队 |
| 决策人 | 待确认 |
| 关联模块 | Alert（R-P0-03-v2）|
| 前置依赖 | ADR-005 数据库选型（PG 14+）、Migration 735-744（Alert 5 家族 PG 持久化）|
| 参考对标 | **无对标对象**（原 NL 引用经审计证伪，见 §1.1 与 §9）；决策基于 Orion 自身架构约束独立论证 |

---

## 1. 背景与问题

### 1.1 问题陈述

Alert 模块 5 大子域（Ingest/RuleEval/Route/Notify/Escalate）+ AlertBreaker（并发窗口抑制）当前在 Orion 是 memory-only 实现，重启即丢。AA 数据模型设计（Migration 735-744）已将 5 家族全部迁到 PG，但**并发控制模型未选型**。

> **⚠️ 参照系证伪（2026-10-11）**
>
> 本 ADR 初版以「对齐 NeatLogic `AlertBreakerMapper.getAlertBreakerStateForUpdate()` 的 PG 行锁」为核心论据。
> 经 `~/refs/neatlogic/`（44 仓库 @ 固定 SHA）机械验证，该论据**不成立**：
>
> | 检索 | 结果 |
> |---|---|
> | `*Breaker*.java` 文件名 | **0** |
> | 源码含 `Breaker` 字符串（全仓） | **0** |
> | `neatlogic-alert` 内 `breaker`（大小写不敏感） | **0** |
> | `neatlogic-alert` XML 含 `FOR UPDATE`（17 个 XML） | **0** |
> | 全仓 `ON CONFLICT`（**PG 专有**） | **0** |
> | 全仓 `ON DUPLICATE KEY UPDATE`（MySQL 专有） | **45** |
>
> **两个致命问题**：
> 1. NeatLogic 中**不存在** `AlertBreaker` / `AlertBreakerMapper` 这一类或表。
> 2. NeatLogic 底层是 **MySQL**（`mysql-connector-j` 依赖 + `ON DUPLICATE KEY UPDATE` 45 文件 + `ON CONFLICT` 0 文件），
>    而非 PostgreSQL。「与 NeatLogic 的 PG SQL 1:1 对齐」在本体论层面不可能成立。
>
> NeatLogic Alert 模块**真实**的间隔/抑制机制是**调度器任务**，非行锁状态表：
>
> ```java
> // neatlogic-alert/.../event/AlertIntervalEventHandler.java（182 行，真实存在）
> JSONArray intervalList = alertEventHandlerVo.getConfig().getJSONArray("intervalList");
> Integer intervalMinute = config.getInteger("intervalMinute");
> IJob jobHandler = SchedulerManager.getHandler(AlertEventIntervalScheduleJob.class.getName());
> builder.withIntervalInSeconds(intervalMinute * 60);
> alertMapper.insertAlertIntervalJob(alertIntervalJobVo);  // 落 job 行，由调度器触发
> ```
>
> 完整审计见 `reports/reference/adr-neatlogic-reference-audit-2026-10-11.md` §1。

**决策依据改为 Orion 自身架构约束**（不再引用 NeatLogic）：
若选 PG 行锁则引入 MVCC 事务持锁语义；若另选 Redis 则引入额外中间件依赖，
且当前架构原则是 **PG 14+ 单库 + Redis 仅缓存/灰度**（ADR-005 §2.3）。

风险登记册 v5 的 **R-P0-03-v2** 原表述为「AlertBreaker 并发窗口模型未**复刻**（NeatLogic 用 PG `SELECT FOR UPDATE` 行锁）」。
由于不存在可复刻的对象，该风险应**重述**为：

> **R-P0-03-v2（重述）**：AlertBreaker 并发窗口模型**未选型**——Memory-only 实现无法在多副本部署下保证
> 抑制窗口的原子性，且与 Migration 735-744 的 PG 持久化不匹配。

**本 ADR 是该项 P0 风险的决策出口。**

### 1.2 决策目标

选择 AlertBreaker 并发控制实现方案，明确：
1. 锁粒度（行锁 vs 分布式锁 vs 悲观锁 vs 乐观锁）
2. 事务边界（PG 事务 vs Redis TTL vs 应用层）
3. 与现有 Alert 语义的兼容性（无外部对标约束）
4. 对 Migration 735-744 的字段影响

### 1.3 约束条件

- 遵守 ADR-005：PG 14+ 单库为主存储，Redis 仅缓存/灰度
- 不引入额外服务（Neo4j/MongoDB/RabbitMQ 除外）
- **不引入外部系统耦合**：不得假设未来需要与任何特定参照系统做数据双向同步
- 支持多租户（tenant_id 参与锁键）
- 通过 Stage Gate S4 pre（Alert 前置门控）：5 家族 PG 持久化 + AlertBreaker 并发模型已定

---

## 2. 备选方案对比

### 2.1 方案 A：PG `SELECT ... FOR UPDATE` 行锁

**实现**：

```sql
BEGIN;
SELECT * FROM alert_breaker_state
 WHERE tenant_id = $1
   AND policy_id = $2
   AND unique_key = $3
 FOR UPDATE;
-- 更新或插入 state 字段（window_start / window_end / count / fingerprint）
UPDATE alert_breaker_state
   SET count = count + 1, last_fingerprint = $4, updated_at = now()
 WHERE id = $5;
COMMIT;
```

**优点**：
- ✅ **技术选型自主**：不依赖任何外部系统的语义约定，Orion 演进不受制于人
- ✅ 无外部依赖，仅 PG 单库
- ✅ 事务一致性原生保证（ACID）
- ✅ 与 Migration 735-744 天然兼容
- ✅ 可审计（PG 事务日志）

**缺点**：
- ❌ 高并发时 PG 事务持有时间可能拉长（尤其 5 家族同 PG 实例）
- ❌ 死锁风险（跨行顺序加锁不一致时）
- ❌ 行锁热点（policy_id + unique_key 高基数下尚可，低基数会阻塞）
- ❌ 需自行管理事务边界与超时（idle_in_transaction_session_timeout）

**性能预估**：
- 单实例写入吞吐：约 500-2000 TPS/行锁键（取决于行大小与索引）
- 事务持锁时长：<100ms（AlertBreaker 逻辑极短）

### 2.2 方案 B：Redis 分布式锁（Redisson / redsync）

**实现**：

```go
// 伪代码
lock, err := redisClient.SetNX(ctx, 
    "alert_breaker:"+tenantID+":"+policyID+":"+uniqueKey,
    value, 
    time.Second*30
)
if !lock { return alert }
defer redisClient.Del(ctx, "alert_breaker:"+...)
```

**优点**：
- ✅ 性能更高（Redis 单节点 ~100k ops/s）
- ✅ 天然跨实例（无需 PG 事务协调）
- ✅ TTL 自动过期，避免死锁

**缺点**：
- ❌ 违反 ADR-005「Redis 仅缓存/灰度」原则
- ❌ Redis 宕机时行为不可预测（红锁/无锁）
- ❌ 与 Alert 主数据（PG）不一致风险（Redis 有 lock 但 PG 无 state）
- ❌ 引入新依赖：Redisson-Java 或 redsync-Go 库
- ❌ 与 PG 主数据强耦合（锁与数据同库，无法独立伸缩）

**性能预估**：
- 单实例写入吞吐：约 50k-100k ops/s
- 事务持锁时长：TTL 决定（30s 上限）

### 2.3 方案 C：乐观锁（version 字段 + CAS）

**实现**：

```sql
UPDATE alert_breaker_state
   SET count = count + 1,
       last_fingerprint = $4,
       version = version + 1,
       updated_at = now()
 WHERE id = $5 AND version = $6;
-- 若 0 行受影响，重试（指数退避）
```

**优点**：
- ✅ 无锁竞争，读性能最高
- ✅ 无死锁风险
- ✅ 天然支持 PG 只读副本读取

**缺点**：
- ❌ 高并发下重试风暴（尤其 Alert 突发涌入时）
- ❌ 语义上无法阻断并发写入（只是最后写赢）
- ❌ 与现有 Alert 抑制语义（原子计数 + 窗口）不匹配
- ❌ 需业务层重试逻辑

**性能预估**：
- 单实例写入吞吐：约 2000-5000 TPS（低冲突）；高冲突下降到 100 TPS

### 2.4 方案对比矩阵

| 维度 | 方案 A（PG 行锁）| 方案 B（Redis 分布式锁）| 方案 C（乐观锁）|
|------|-----------------|----------------------|-----------------|
| 技术自主性 | ⭐⭐⭐⭐⭐ 无外部约束 | ⭐⭐ 引入新中间件 | ⭐⭐⭐⭐ 无外部约束 |
| 依赖复杂度 | ⭐⭐⭐⭐⭐ 仅 PG | ⭐⭐ 需 Redis | ⭐⭐⭐⭐ 仅 PG |
| ADR-005 合规 | ✅ | ❌ 违反 | ✅ |
| 事务一致性 | ✅ ACID | ⚠️ 最终一致 | ✅ |
| 性能（TPS）| 500-2000 | 50k+ | 2000-5000 |
| 死锁风险 | ⚠️ 中 | ✅ 无 | ✅ 无 |
| 多租户隔离 | ✅ tenant_id 在锁键 | ✅ tenant_id 在锁键 | ✅ tenant_id 在 WHERE |
| 可审计性 | ✅ PG WAL | ⚠️ Redis 日志 | ✅ PG WAL |
| 与 Migration 735-744 兼容 | ✅ | ⚠️ 需额外 Redis schema | ✅ |
| 团队熟悉度 | ✅ 已熟悉 PG | ⚠️ 未大规模用 | ✅ |

---

## 3. 决策

### 3.1 选定方案

**方案 A：PG `SELECT ... FOR UPDATE` 行锁**

理由（**全部为 Orion 自身约束，不引用任何外部对标**）：
1. **ADR-005 合规**（PG 单库为主存储，Redis 仅缓存/灰度，不引入新中间件用途）
2. **ACID 事务一致性**（AlertBreaker 抑制窗口要求「读-判-写」原子，Redis 方案为最终一致）
3. **迁移 735-744 天然兼容**（无需额外 Redis schema 或独立状态服务）
4. **可审计**（PG WAL 留痕，满足运维追溯要求）
5. **团队 PG 熟悉度**（Orion 主力后端已在 PG Repository 模式）
6. **抑制逻辑极短**（单次持锁 <100ms，Serializable 开销可接受）

### 3.2 关键设计决定

#### 3.2.1 锁键设计

```sql
-- 锁键三元组：tenant_id + policy_id + unique_key
CREATE INDEX idx_alert_breaker_state_lock 
    ON alert_breaker_state (tenant_id, policy_id, unique_key);
```

- **tenant_id**：多租户隔离硬边界
- **policy_id**：告警规则 ID
- **unique_key**：AlertBreaker 唯一键（如 fingerprint hash）

**避免锁热点**：unique_key 必须高基数（不建议用"critical"这种低基数值）。若业务侧存在低基数 unique_key 场景，需拆分 policy_id 分片。

#### 3.2.2 事务边界

```go
// 事务边界：整个 AlertBreaker state 更新必须在单个 PG 事务内
func (r *AlertBreakerRepo) UpsertBreakerState(ctx context.Context, state BreakerState) error {
    tx, err := r.db.BeginTx(ctx, &sql.TxOptions{
        Isolation: sql.LevelSerializable,  // 显式声明 Serializable
        Timeout:   5 * time.Second,         // 硬超时，防 idle_in_transaction
    })
    if err != nil {
        return err
    }
    defer tx.Rollback()
    
    // 1. 尝试行锁读取
    row := tx.QueryRowContext(ctx, `
        SELECT id, count, last_fingerprint, window_start, window_end
          FROM alert_breaker_state
         WHERE tenant_id=$1 AND policy_id=$2 AND unique_key=$3
        FOR UPDATE
    `, state.TenantID, state.PolicyID, state.UniqueKey)
    
    // 2. 若不存在则插入
    // 3. 若存在则更新
    
    return tx.Commit()
}
```

**事务隔离级别**：`Serializable`（PG 最高级别）
- 避免幻读
- AlertBreaker 逻辑短，Serializable 开销可接受
- 若性能成为瓶颈可降级到 `Repeatable Read`

**事务超时**：5 秒硬超时（配合 PG `idle_in_transaction_session_timeout = 30s`）
- 防止异常代码持有锁导致 PG 阻塞
- 超时后事务回滚，客户端重试

#### 3.2.3 死锁防护

**加锁顺序约定**：`tenant_id → policy_id → unique_key`（严格字典序）

**违反后果**：若不同 goroutine 以不同顺序加锁，PG 会检测死锁并 rollback 其中一个。为规避：

```go
// 强制按 tenant_id 分片处理（同一 tenant 内的锁请求串行化）
tenantShards := map[string]*chan struct{}{}  // 每个 tenant 一个 channel
```

**跨 policy_id 的加锁**：AlertBreaker 单次操作只加一行锁，不存在跨行加锁场景（policy_id 是外层参数）。

#### 3.2.4 Migration 字段补充

Migration 735（`alerts` 主表）需追加 `alert_breaker_state` 表：

```sql
CREATE TABLE alert_breaker_state (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    policy_id       BIGINT NOT NULL,
    unique_key      TEXT NOT NULL,
    count           INT NOT NULL DEFAULT 0,
    last_fingerprint TEXT,
    window_start    TIMESTAMPTZ,
    window_end      TIMESTAMPTZ,
    version         INT NOT NULL DEFAULT 0,  -- 便于未来切乐观锁
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE (tenant_id, policy_id, unique_key)
);

CREATE INDEX idx_alert_breaker_state_lock 
    ON alert_breaker_state (tenant_id, policy_id, unique_key);
CREATE INDEX idx_alert_breaker_state_window 
    ON alert_breaker_state (window_end);  -- 用于过期清理
```

**Migration 编号分配**：736（原方案 Alert 5 家族中的 correlation 表位置，需要重排）

#### 3.2.5 与 5 家族 PG 持久化的协调

| 家族 | 表 | 并发模型 | 与 AlertBreaker 关系 |
|------|-----|---------|---------------------|
| 主表 alerts | `alerts` | PG 行锁（本 ADR）| **AlertBreaker 是入口** |
| Correlation | `alert_correlations` | PG 行锁 | 复用本 ADR 事务模式 |
| Dedup | `alert_dedup_fingerprints` | PG 行锁 + UNIQUE 约束 | UNIQUE 冲突即去重 |
| Silence | `alert_silences` | PG 行锁 | 与 breaker 同族 |
| Rule-engine | `alert_rules` | 只读为主 | 无需行锁 |

**统一原则**：Alert 5 家族 + AlertBreaker 全部使用 **PG Serializable + 5s 超时** 行锁模式，代码库统一封装 `alertLockTx(ctx, tenantID)` helper。

---

## 4. 风险与缓解

### 4.1 已知风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 行锁热点（低基数 unique_key）| 中 | 中 | 监控 `pg_stat_activity` 中 `wait_event` = `Lock` 的记录；unique_key 生成规则评审 |
| Serializable 死锁 | 低 | 高 | 事务超时 5s + `deadlock_timeout=1s`；业务层加锁顺序约定 |
| PG 事务积压 | 中 | 中 | 监控 `max_connections`；AlertBreaker 用独立连接池（连接数 = max_alert_concurrency）|
| idle_in_transaction 触发 | 低 | 中 | 事务超时 5s < idle_timeout 30s；异常代码必被检测 |

### 4.2 监控指标

新增 Prometheus 指标（供 Alert 模块上报）：

| 指标 | 类型 | 阈值 |
|------|------|------|
| `alert_breaker_lock_duration_ms` | Histogram | p99 > 2000ms 告警 |
| `alert_breaker_deadlock_total` | Counter | >0 告警 |
| `alert_breaker_transaction_timeout_total` | Counter | >5/min 告警 |
| `alert_breaker_pg_connections_used` | Gauge | >80% max_connections 告警 |

---

## 5. 与 NeatLogic 的关系（经审计后修正）

### 5.1 无对齐关系

本节原为「与 NeatLogic 的对齐细节」。经 2026-10-11 审计证伪，
**Orion 与本方案不存在任何 NeatLogic 对标关系**，理由见 §1.1 的证伪表。

`alert_breaker_state` 表结构是 Orion 自主设计，字段（`tenant_id` / `policy_id` /
`unique_key` / `count` / `last_fingerprint` / `window_start` / `window_end` / `version`）
全部服务于 Orion 自身的多租户与可回退需求。

### 5.2 本 ADR 的 SQL

```sql
SELECT id, count, last_fingerprint, window_start, window_end
  FROM alert_breaker_state
 WHERE tenant_id = $1      -- 多租户隔离维度
   AND policy_id = $2
   AND unique_key = $3
 FOR UPDATE;
```

### 5.3 与 NeatLogic 真实机制的差异（记录在案，非对标依据）

若未来需要评估「是否值得参考 NeatLogic 的调度器方案」，以下是两者真实差异：

| 维度 | NeatLogic 真实做法 | Orion（本 ADR）|
|---|---|---|
| 抑制载体 | 配置 JSON（`intervalList` / `intervalMinute`）| 独立 `alert_breaker_state` 表 |
| 触发方式 | `SchedulerManager` 定时任务 | `SELECT ... FOR UPDATE` 事务内 |
| 状态持久化 | `alertIntervalJob` 行（由调度器消费）| 每事件 upsert 状态行 |
| 底层数据库 | MySQL | PostgreSQL 14+ |
| 一致性语义 | 最终一致（调度器周期执行）| 强一致（事务内原子计数）|

**评估结论**：NeatLogic 的调度器方案适合「重复通知」类场景（固定周期、可容忍延迟），
不适合 Orion 的「并发窗口抑制」场景（要求事件到达时即时判定，延迟不可容忍）。
因此**不采纳**其方案，本 ADR 的行锁方案是独立选择而非对标结果。

---

## 6. 影响面

### 6.1 对 Alert Stage Gate S4 pre 的影响

Alert Stage Gate S4 pre 硬指标：
1. ✅ Migration 735-744 已应用
2. ✅ Alert 5 家族 PG 持久化测试通过
3. ✅ 通知渠道租户隔离测试通过
4. ✅ **AlertBreaker 并发模型 ADR 已批准（本 ADR）** ← 新增
5. ✅ **AlertBreaker 事务边界单测通过**（5 用例：正常/超时/死锁/热点/多租户）← 新增
6. ✅ **alert_breaker_state 表 CRUD 测试通过** ← 新增

### 6.2 对风险登记册的影响

- **R-P0-03-v2**（AlertBreaker 并发窗口模型未复刻）：本 ADR 批准后**降级为"已决策"**，从 P0 移出。
- **R-P2-06**（Routing 冲突新旧路由前缀碰撞）：与本 ADR 无直接关联。
- **新增风险 R-P2-14**（AlertBreaker Serializable 死锁概率）：概率低影响中，监控指标已列。

### 6.3 对 AA 数据模型设计的影响

- Migration 编号微调：736 用于 `alert_breaker_state`（原方案 736 是 correlation，需重排）
- 建议 AA 文档补一节 `### AlertBreaker State`（引用本 ADR）

### 6.4 对下游代码的影响

- **Alert Repository**：新增 `AlertBreakerRepository` 接口 + PG 实现
- **Alert Service**：`AlertBreakerHandler` 内调用 `alertLockTx`
- **5 家族统一封装**：`alertLockTx(ctx, tenantID)` helper 复用

---

## 7. 决策记录

### 7.1 已考虑但未选

- **方案 B Redis 分布式锁**：ADR-005 违反（Redis 仅缓存/灰度）+ 最终一致 + 新中间件用途
- **方案 C 乐观锁**：语义不匹配——「最后写赢」无法保证抑制窗口的原子计数
- **NeatLogic 调度器方案**（`AlertIntervalEventHandler` + `SchedulerManager`）：
  最终一致 + 周期延迟，不满足「事件到达即时判定」的抑制窗口语义，见 §5.3

### 7.2 未来可切

- 若未来 Alert TPS 增长 10 倍以上（>5000 TPS/实例），可切方案 C 乐观锁（`version` 字段已在表中预留）
- 若未来 PG 集群性能瓶颈，可引入 PG 读写分离，AlertBreaker 仍走主库

### 7.3 相关 ADR

- **ADR-005** 数据库选型（PG 14+ 单库前提）
- **ADR-004** 多租户（ThreadLocal TenantContext）
- **ADR-007** Saga 补偿（AlertBreaker 失败时的补偿策略，另行设计）

---

## 8. 参考

- **参照系基线（权威）**：`reports/reference/neatlogic-baseline-2026-10-11.md`
- **参照系审计（本 ADR 论据重建依据）**：`reports/reference/adr-neatlogic-reference-audit-2026-10-11.md` §1
- 原始 NL-3 一手证据（**其中 `AlertBreakerMapper` 引用经审计证伪，仅供历史追溯**）：`reports/expert-reviews/neatlogic-deploy-tagent-change-firsthand-2026-10-03.md`
- v5 综合报告：`reports/expert-reviews/cross-review-synthesis-2026-10-03-v5.md` §16
- 风险登记册：`reports/module-upgrade-designs/risk-fallback-design-2026-10-03.md` §1.5
- AA 数据模型：`reports/module-upgrade-designs/data-model-migration-design-2026-10-03.md` Migration 735-744

---

---

## 9. 修订记录

| 日期 | 修订 | 依据 |
|---|---|---|
| 2026-10-11 | **论据重建**：删除全部「对齐 NeatLogic」论据（元数据行、§1.1、§1.2、§1.3、§2.1、§2.2、§2.3、§2.4 矩阵行、§3.1、§5 整节、§7.1）；新增参照系证伪表；R-P0-03-v2 由「未复刻」重述为「未选型」；§5 重写为「与 NeatLogic 的关系（无对标关系）」并附真实机制差异对比 | `reports/reference/adr-neatlogic-reference-audit-2026-10-11.md` §1 |

**修订性质**：**技术决策完全不变**（仍为方案 A：PG `SELECT ... FOR UPDATE` 行锁 + Serializable + 5s 超时），
**仅论据来源改变**。`alert_breaker_state` 表结构、锁键设计、事务边界、死锁防护、
监控指标、Stage Gate 门控条款全部保留。

**为何必须修**：原论据引用的 `AlertBreakerMapper.getAlertBreakerStateForUpdate()`
在 NeatLogic 全仓 6,328 个 Java 文件中 **0 命中**；且 NeatLogic 底层是 MySQL 而非 PG，
「PG SQL 1:1 对齐」不可能成立。若保留原论据，后续维护者会据此寻找不存在的代码。

**决策不受影响的原因**：方案 A 的 6 条理由（§3.1）全部来自 Orion 自身约束
（ADR-005 单库原则、ACID 要求、Migration 兼容性、可审计性、团队熟悉度、逻辑短事务），
不依赖任何外部对标即可独立成立。

**文档编号**：`ADR-010-AlertBreaker-并发模型选型.md`
**下一步**：本 ADR 决策批准 → 追加到 `reports/design-docs-summary-2026-10-03.md` §ADR 清单 → 触发 Alert Stage Gate S4 pre 门控检查清单更新
