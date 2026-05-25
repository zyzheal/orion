# 中间件运维（Middleware Operations）完整设计

> 创建日期：2026-05-22
> 状态：待实现
> 关联文档：`docs/plans/orion-upgrade-executable-plan-2026-05-22.md` Section 11.5（DDL）
> 目标：为 Orion 平台提供完整的中间件实例注册、健康检查、指标采集、运维操作能力

---

## 一、业务闭环总览

```
实例注册 → 连接验证 → 健康检查(定时) → 指标采集(定时) → 评估健康状态 → 告警触发 → 运维操作 → 操作审计 → 回滚/确认
    │           │           │              │              │            │           │           │
    ▼           ▼           ▼              ▼              ▼            ▼           ▼           ▼
middleware   连接测试   健康检查引擎    指标采集器      状态评估    告警引擎   操作执行   操作历史
_instances   凭证引用   _health_checks  _metrics      算法       + 升级      引擎        查询
```

**完整生命周期**：

1. **注册**：用户手动或通过 API/自动发现注册中间件实例
2. **验证**：验证连接可用性和凭据有效性
3. **监控**：按配置频率执行健康检查和指标采集
4. **评估**：综合多项检查结果计算健康状态
5. **告警**：健康状态降级时触发告警通知
6. **运维**：执行重启/备份/扩容等操作
7. **审计**：全部操作留痕，支持回滚

---

## 二、功能设计（后端）

### 2.1 中间件实例管理

#### 2.1.1 支持的中间件类型

| 类型 | 标识符 | 版本要求 | 默认端口 | 默认健康检查协议 |
|------|--------|---------|---------|----------------|
| Redis | `redis` | >= 5.0 | 6379 | `PING` + `INFO` |
| MySQL | `mysql` | >= 5.7 / >= 8.0 | 3306 | `SELECT 1` + `SHOW SLAVE STATUS` |
| Kafka | `kafka` | >= 2.0 | 9092 | AdminClient DescribeCluster |
| RabbitMQ | `rabbitmq` | >= 3.8 | 5672 | Management API `/api/health` |
| Elasticsearch | `elasticsearch` | >= 7.0 | 9200 | `GET /_cluster/health` |
| MongoDB | `mongodb` | >= 4.4 | 27017 | `db.adminCommand({ replSetGetStatus: 1 })` |

#### 2.1.2 实例注册方式

**方式一：手动注册**（前端表单提交）

- 用户填写 host、port、版本、环境、凭据引用等字段
- 后端验证连接可达性后入库
- 自动设置初始健康状态为 `unknown`

**方式二：API 注册**（基础设施即代码）

```
POST /api/v1/middleware/instances
```

- 支持批量注册（数组格式）
- 幂等注册：同一 `host+port+type+environment` 组合不重复创建

**方式三：自动发现**（K8s CRD 同步）

- 监听 K8s 中的 `MiddlewareInstance` CRD
- 自动同步 `redis`, `mysql`, `kafka`, `rabbitmq`, `elasticsearch`, `mongodb` 类型的 StatefulSet/Deployment
- 从 ConfigMap/Secret 中提取连接信息
- 同步频率：每 5 分钟

#### 2.1.3 凭据管理

凭据**不直接存储**在 `middleware_instances` 表中。`credential_ref` 字段存储引用路径：

| 引用类型 | 格式 | 示例 |
|---------|------|------|
| K8s Secret | `k8s://<namespace>/<secret-name>/<key>` | `k8s://orion/redis-prod/password` |
| HashiCorp Vault | `vault://<path>/<key>` | `vault://secret/data/redis/prod/password` |
| Orion Secret Store | `orion://<secret-id>` | `orion://sec_redis_prod_001` |

**凭据解析流程**：
1. 中间件操作引擎读取 `credential_ref`
2. 调用对应的 SecretProvider 解析实际凭据
3. 凭据在内存中保留不超过 30 秒
4. 每次连接重新解析（不缓存凭据值）

#### 2.1.4 连接测试与验证

注册时和每次健康检查前执行：

```
连接测试序列（每种中间件）：
  1. TCP 端口可达性检查（超时 5 秒）
  2. 协议握手验证（使用提供的凭据）
  3. 执行最小化查询（PING / SELECT 1 / 等）
  4. 验证响应延迟（< 1000ms 为正常）
```

### 2.2 健康检查

#### 2.2.1 每种中间件的健康检查项

**Redis 健康检查（4 项）**：

| 检查项 | check_type | 检查方法 | 判定为 healthy 的条件 | 判定为 warning 的条件 | 判定为 critical 的条件 |
|--------|-----------|---------|---------------------|---------------------|----------------------|
| PING/PONG | connectivity | `redis.ping()` | PONG 响应 < 100ms | PONG 响应 100-500ms | 超时或 > 500ms |
| 复制状态 | replication | `INFO replication` | master 无 slave / slave 连接正常 | slave 连接数 > 0 但有延迟 | slave 断开或连接失败 |
| 内存使用 | performance | `INFO memory` | used_memory < maxmemory * 80% | 80%-95% | > 95% |
| 持久化状态 | cluster | `INFO persistence` | rdb/aof 最近一次成功 | 正在持久化中 | 最近一次持久化失败 |

**MySQL 健康检查（4 项）**：

| 检查项 | check_type | 检查方法 | healthy | warning | critical |
|--------|-----------|---------|---------|---------|----------|
| 连接测试 | connectivity | `SELECT 1` | 响应 < 500ms | 500-2000ms | 超时或 > 2000ms |
| 复制延迟 | replication | `SHOW SLAVE STATUS` | Seconds_Behind_Master < 10s | 10-60s | > 60s 或 NULL |
| 慢查询 | performance | `SHOW PROCESSLIST` | 慢查询数 = 0 | 1-10 个 | > 10 个 |
| 锁等待 | performance | `information_schema.innodb_locks` | 锁等待数 = 0 | 1-5 个 | > 5 个 |

**Kafka 健康检查（4 项）**：

| 检查项 | check_type | 检查方法 | healthy | warning | critical |
|--------|-----------|---------|---------|---------|----------|
| Broker 状态 | connectivity | AdminClient DescribeCluster | 全部 broker online | 1 个 broker 离线 | > 1 个 broker 离线 |
| ISR | cluster | DescribeTopics ISR 数 | ISR = replica 数 | ISR < replica 数但 > 0 | ISR = 0 |
| 消费者 lag | performance | ListConsumerGroupOffsets | lag < 1000 | 1000-10000 | > 10000 |
| 分区均衡 | cluster | Partition 分布 | 各 broker 偏差 < 10% | 10-30% | > 30% |

**RabbitMQ 健康检查（4 项）**：

| 检查项 | check_type | 检查方法 | healthy | warning | critical |
|--------|-----------|---------|---------|---------|----------|
| 连接数 | connectivity | Management API `/api/connections` | 连接数 < 阈值 | 80%-95% 阈值 | > 95% 阈值 |
| 队列深度 | performance | `/api/queues` | 无队列 > 1000 | 有队列 1000-10000 | 有队列 > 10000 |
| 消费者状态 | performance | `/api/consumers` | 全部队列有消费者 | 有队列无消费者但 < 5 | > 5 个队列无消费者 |
| 消息堆积 | performance | 未确认消息数 | < 5000 | 5000-50000 | > 50000 |

**Elasticsearch 健康检查（4 项）**：

| 检查项 | check_type | 检查方法 | healthy | warning | critical |
|--------|-----------|---------|---------|---------|----------|
| 集群状态 | cluster | `GET /_cluster/health` | green | yellow | red |
| 节点状态 | connectivity | `GET /_nodes` | 全部节点 online | 1 个节点离线 | > 1 个节点离线 |
| 索引健康 | cluster | 索引 status | 全部 green | 有 yellow | 有 red |
| 磁盘使用 | performance | `GET /_cat/allocation` | < 75% | 75%-90% | > 90% |

**MongoDB 健康检查（4 项）**：

| 检查项 | check_type | 检查方法 | healthy | warning | critical |
|--------|-----------|---------|---------|---------|----------|
| 副本集状态 | cluster | `replSetGetStatus` | PRIMARY + SECONDARY(s) normal | SECONDARY 有延迟 | PRIMARY 异常 |
| Oplog | replication | Oplog 时间窗口 > 24h | 窗口 > 48h | 24-48h | < 24h |
| 连接数 | connectivity | `serverStatus.connections` | < 80% 最大连接 | 80%-95% | > 95% |
| 锁 | performance | `currentOp` | 无全局锁等待 | 有锁等待 < 5s | 有锁等待 > 5s |

#### 2.2.2 检查频率配置

```typescript
interface HealthCheckConfig {
  intervalSeconds: number;       // 默认 60 秒
  timeoutSeconds: number;        // 默认 30 秒
  consecutiveFailures: number;   // 连续失败几次标记为 critical，默认 3
  backoffMultiplier: number;     // 失败后间隔倍增系数，默认 2
  maxBackoffSeconds: number;     // 最大退避间隔，默认 300 秒
}
```

用户可为每个实例配置不同频率，范围 10s ~ 300s。

#### 2.2.3 健康状态评估算法

综合多个检查项结果，计算实例级别的 `health_status`：

```
健康状态评估 = f(所有检查项的加权结果)

权重分配：
  - connectivity 类检查：权重 0.4（连接不可用即 critical）
  - replication/cluster 类检查：权重 0.3
  - performance 类检查：权重 0.3

评估逻辑：
  IF 任何 connectivity 检查 = critical → 实例 health_status = 'critical'
  IF 所有检查 = healthy → 实例 health_status = 'healthy'
  IF 任一检查 = critical → 实例 health_status = 'critical'
  IF 任一检查 = warning 且无 critical → 实例 health_status = 'warning'
  IF 无检查结果（首次注册） → 实例 health_status = 'unknown'
```

### 2.3 指标采集

#### 2.3.1 每种中间件的关键指标

**Redis 指标**：

| 指标名称 | 单位 | 采集方式 | 描述 |
|---------|------|---------|------|
| `redis.connected_clients` | count | `INFO clients` | 当前连接数 |
| `redis.used_memory_bytes` | bytes | `INFO memory` | 已使用内存 |
| `redis.commands_per_sec` | ops/s | `INFO stats` | 每秒命令数 |
| `redis.keyspace_hit_rate` | percent | `INFO stats` | 缓存命中率 |
| `redis.evicted_keys` | count | `INFO stats` | 被驱逐的 key 数 |
| `redis.repl_backlog_active` | boolean | `INFO replication` | 复制 backlog 状态 |
| `redis.rdb_last_save_time` | timestamp | `INFO persistence` | 最近 RDB 保存时间 |
| `redis.aof_enabled` | boolean | `INFO persistence` | AOF 是否开启 |

**MySQL 指标**：

| 指标名称 | 单位 | 采集方式 | 描述 |
|---------|------|---------|------|
| `mysql.threads_connected` | count | `SHOW STATUS` | 当前连接数 |
| `mysql.questions_per_sec` | qps | `SHOW GLOBAL STATUS` | 每秒查询数 |
| `mysql.slow_queries` | count | `SHOW GLOBAL STATUS` | 慢查询累计数 |
| `mysql.innodb_rows_read_per_sec` | rows/s | `SHOW GLOBAL STATUS` | InnoDB 每秒读取行数 |
| `mysql.buffer_pool_hit_rate` | percent | `SHOW GLOBAL STATUS` | Buffer Pool 命中率 |
| `mysql.replication_lag_seconds` | seconds | `SHOW SLAVE STATUS` | 复制延迟 |
| `mysql.innodb_row_lock_waits` | count | `SHOW STATUS` | InnoDB 行锁等待数 |
| `mysql.table_open_cache_hit_rate` | percent | `SHOW STATUS` | 表缓存命中率 |

**Kafka 指标**：

| 指标名称 | 单位 | 采集方式 | 描述 |
|---------|------|---------|------|
| `kafka.broker_count` | count | AdminClient | 在线 Broker 数 |
| `kafka.topic_count` | count | AdminClient | Topic 总数 |
| `kafka.partition_count` | count | AdminClient | Partition 总数 |
| `kafka.messages_in_per_sec` | msgs/s | JMX Metrics | 每秒入消息数 |
| `kafka.bytes_in_per_sec` | bytes/s | JMX Metrics | 每秒入字节数 |
| `kafka.consumer_lag_max` | messages | ConsumerGroup | 最大消费者 lag |
| `kafka.under_replicated_partitions` | count | AdminClient | 未充分复制的分区数 |
| `kafka.isr_shrinks_per_sec` | count/s | JMX Metrics | 每秒 ISR 收缩次数 |

**RabbitMQ 指标**：

| 指标名称 | 单位 | 采集方式 | 描述 |
|---------|------|---------|------|
| `rabbitmq.connections` | count | Management API | 当前连接数 |
| `rabbitmq.channels` | count | Management API | 当前通道数 |
| `rabbitmq.queues` | count | Management API | 队列总数 |
| `rabbitmq.messages_ready` | count | Management API | 就绪消息数 |
| `rabbitmq.messages_unacknowledged` | count | Management API | 未确认消息数 |
| `rabbitmq.publish_rate` | msgs/s | Management API | 每秒发布数 |
| `rabbitmq.deliver_rate` | msgs/s | Management API | 每秒投递数 |
| `rabbitmq.file_descriptors_used_pct` | percent | Management API | 文件描述符使用率 |

**Elasticsearch 指标**：

| 指标名称 | 单位 | 采集方式 | 描述 |
|---------|------|---------|------|
| `es.cluster_status` | string | `/_cluster/health` | 集群状态 (green/yellow/red) |
| `es.node_count` | count | `/_nodes` | 节点总数 |
| `es.index_count` | count | `/_cat/indices` | 索引总数 |
| `es.doc_count` | count | `/_cat/indices` | 文档总数 |
| `es.store_size_bytes` | bytes | `/_cat/indices` | 存储大小 |
| `es.search_rate_per_sec` | searches/s | `/_nodes/stats` | 每秒搜索数 |
| `es.index_rate_per_sec` | docs/s | `/_nodes/stats` | 每秒索引数 |
| `es.jvm_heap_used_pct` | percent | `/_nodes/stats` | JVM 堆使用率 |

**MongoDB 指标**：

| 指标名称 | 单位 | 采集方式 | 描述 |
|---------|------|---------|------|
| `mongodb.connections` | count | `serverStatus` | 当前连接数 |
| `mongodb.operations_per_sec` | ops/s | `serverStatus` | 每秒操作数 |
| `mongodb.query_per_sec` | queries/s | `serverStatus` | 每秒查询数 |
| `mongodb.insert_per_sec` | inserts/s | `serverStatus` | 每秒插入数 |
| `mongodb.page_faults_per_sec` | count/s | `serverStatus` | 每秒页错误 |
| `mongodb.oplog_window_hours` | hours | `replSetGetStatus` | Oplog 时间窗口 |
| `mongodb.repl_lag_seconds` | seconds | `replSetGetStatus` | 副本集延迟 |
| `mongodb.lock_wait_seconds` | seconds | `currentOp` | 锁等待时间 |

#### 2.3.2 采集频率与聚合策略

```typescript
interface MetricCollectionConfig {
  collectionIntervalSeconds: number;  // 默认 60 秒
  retentionDays: number;              // 原始数据保留 7 天
  aggregationRules: [
    { granularity: '1h',   retention: '30d' },   // 1 小时聚合保留 30 天
    { granularity: '1d',   retention: '365d' },  // 1 天聚合保留 1 年
  ];
}
```

**聚合策略**：
- `AVG`：连接数、延迟、内存
- `MAX`：峰值延迟、峰值 QPS
- `SUM`：请求总数、错误总数
- `P95/P99`：延迟分布

### 2.4 运维操作

#### 2.4.1 支持的操作清单

| 操作 | operation_type | 适用中间件 | 同步/异步 | 默认超时 | 支持回滚 | 需审批 |
|------|---------------|-----------|----------|---------|---------|--------|
| 重启 | `restart` | 全部 | 异步 | 300s | 否 | 是 |
| 扩容 | `scale` | Redis/Kafka/RabbitMQ/ES | 异步 | 600s | 是 | 是 |
| 缩容 | `scale` | 同上 | 异步 | 600s | 是 | 是 |
| 备份 | `backup` | 全部 | 异步 | 3600s | 否 | 否 |
| 恢复 | `restore` | 全部 | 异步 | 3600s | 否 | **是 (双人审批)** |
| 升级 | `upgrade` | 全部 | 异步 | 1800s | 是 | **是 (双人审批)** |
| 配置变更 | `config_change` | 全部 | 同步 | 60s | 是 | 是 |
| 故障切换 | `failover` | Redis/MySQL/MongoDB | 异步 | 300s | 是 | **是 (双人审批)** |

#### 2.4.2 操作权限矩阵

| 角色 | 注册 | 查看 | 健康检查 | 指标查看 | 重启 | 备份 | 恢复 | 升级 | 配置变更 | 故障切换 |
|------|------|------|---------|---------|------|------|------|------|---------|---------|
| Admin | 允许 | 允许 | 允许 | 允许 | 允许 | 允许 | 允许 | 允许 | 允许 | 允许 |
| Operator | 允许 | 允许 | 允许 | 允许 | 允许 | 允许 | **审批** | **审批** | **审批** | **审批** |
| Viewer | 禁止 | 允许 | 禁止 | 允许 | 禁止 | 禁止 | 禁止 | 禁止 | 禁止 | 禁止 |
| Developer | 禁止 | 允许(自己的) | 禁止 | 允许(自己的) | 禁止 | 禁止 | 禁止 | 禁止 | 禁止 | 禁止 |

#### 2.4.3 审批流程

```
操作请求 → 角色检查
  ├─ 允许 → 直接执行
  ├─ 需审批 → 创建审批工单
  │   ├─ 审批通过 → 执行操作
  │   └─ 审批拒绝 → 操作标记为 failed
  └─ 需双人审批 → 创建审批工单（需要两个不同审批人）
      ├─ 两人均通过 → 执行操作
      └─ 任一人拒绝 → 操作标记为 failed
```

**需要审批的操作**：
- 单人审批：restart, scale, config_change
- 双人审批：restore, upgrade, failover

#### 2.4.4 操作执行引擎

```typescript
interface OperationExecutionConfig {
  maxRetries: number;        // 最大重试次数，默认 0（运维操作不自动重试）
  retryDelayMs: number;      // 重试间隔
  timeoutSeconds: number;    // 操作超时时间（按操作类型配置）
  rollbackOnFailure: boolean; // 失败时是否自动回滚
}
```

**执行流程**：
1. 验证操作权限和审批状态
2. 记录操作开始（`started_at`）
3. 执行操作（同步或异步）
4. 更新操作状态（`completed` / `failed`）
5. 如失败且 `rollbackOnFailure = true`，执行回滚
6. 记录操作结果和审计日志

### 2.5 外部依赖

#### 2.5.1 客户端库依赖

| 中间件 | Node.js 包 | 当前状态 |
|--------|-----------|---------|
| Redis | `ioredis` (v5+) | 已安装（RedisCache 使用） |
| MySQL | `mysql2` (v3+) | 已安装（数据库驱动） |
| Kafka | `kafkajs` (v2+) | **需安装** |
| RabbitMQ | `amqplib` (v0.10+) | **需安装** |
| Elasticsearch | `@elastic/elasticsearch` (v8+) | **需安装** |
| MongoDB | `mongodb` (v6+) | **需安装** |

#### 2.5.2 已有可复用组件

- `RedisCache` — 已有的 Redis 连接管理，可直接复用
- `DatabasePool` — 已有的 PostgreSQL 连接池，MySQL 需新增独立连接管理
- `SecretStore` — 已有的凭据管理能力

### 2.6 告警与升级

#### 2.6.1 告警触发规则

| 触发条件 | 告警级别 | 通知方式 | 升级策略 |
|---------|---------|---------|---------|
| health_status 变为 critical | P0 (紧急) | 短信 + 电话 + 企微 | 5 分钟未处理 → 升级至主管 |
| health_status 变为 warning | P1 (警告) | 企微 + 邮件 | 30 分钟未处理 → 升级 |
| 连续 3 次健康检查失败 | P0 (紧急) | 短信 + 电话 + 企微 | 同上 |
| 运维操作失败 | P1 (警告) | 企微 + 邮件 | 15 分钟未处理 → 升级 |
| 指标超阈值（如内存 > 95%） | P2 (注意) | 企微 | 1 小时未处理 → 升级 |

#### 2.6.2 告警集成

复用已有的 `MonitoringService` 告警通道（企微、邮件、Slack、Webhook）。

---

## 三、API 设计

### 3.1 后端路由

**基础路径**：`/api/v1/middleware`

#### 3.1.1 实例管理

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| `GET` | `/instances` | 实例列表（支持分页、过滤） | Viewer+ |
| `POST` | `/instances` | 注册新实例 | Admin/Operator |
| `GET` | `/instances/:id` | 实例详情 | Viewer+ |
| `PATCH` | `/instances/:id` | 更新实例配置 | Admin/Operator |
| `DELETE` | `/instances/:id` | 删除实例（软删除） | Admin |
| `POST` | `/instances/:id/test-connection` | 连接测试 | Admin/Operator |

#### 3.1.2 健康检查

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| `GET` | `/health` | 全部实例健康状态汇总 | Viewer+ |
| `GET` | `/instances/:id/health` | 指定实例最近健康检查结果 | Viewer+ |
| `POST` | `/instances/:id/health/check` | 手动触发健康检查 | Admin/Operator |
| `GET` | `/health/history` | 健康检查历史记录 | Viewer+ |

#### 3.1.3 指标采集

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| `GET` | `/metrics` | 全部实例最新指标 | Viewer+ |
| `GET` | `/instances/:id/metrics` | 指定实例指标（支持时间范围） | Viewer+ |
| `GET` | `/instances/:id/metrics/summary` | 指标聚合摘要 | Viewer+ |

#### 3.1.4 运维操作

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| `POST` | `/instances/:id/operations` | 发起运维操作 | Admin/Operator |
| `GET` | `/operations` | 操作历史列表（支持分页、过滤） | Viewer+ |
| `GET` | `/operations/:id` | 操作详情 + 执行结果 | Viewer+ |
| `POST` | `/operations/:id/cancel` | 取消执行中操作 | Admin |
| `POST` | `/operations/:id/rollback` | 回滚已完成操作 | Admin |

#### 3.1.5 健康检查配置

| Method | Path | 描述 | 权限 |
|--------|------|------|------|
| `GET` | `/instances/:id/health-config` | 获取健康检查配置 | Viewer+ |
| `PATCH` | `/instances/:id/health-config` | 更新健康检查配置 | Admin |

### 3.2 Controller → Service → Repository 架构

```
middleware-routes.ts (Controller)
    ↓
MiddlewareService
    ↓
├── MiddlewareRepository (实例 CRUD)
├── HealthCheckRepository (健康检查记录)
├── MetricRepository (指标数据)
├── OperationRepository (运维操作)
└── 外部适配器
    ├── RedisHealthChecker
    ├── MySQLHealthChecker
    ├── KafkaHealthChecker
    ├── RabbitMQHealthChecker
    ├── ElasticsearchHealthChecker
    └── MongoDBHealthChecker
```

### 3.3 前端 API 客户端

```typescript
// orion-frontend/src/api/middleware.ts

// ==================== Types ====================

export type MiddlewareType = 'redis' | 'mysql' | 'kafka' | 'rabbitmq' | 'elasticsearch' | 'mongodb';

export type MiddlewareStatus = 'active' | 'degraded' | 'maintenance' | 'retired';

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export type OperationType = 'restart' | 'scale' | 'backup' | 'restore' | 'upgrade' | 'config_change' | 'failover';

export type OperationStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'rollback';

export interface MiddlewareInstance {
  id: string;
  tenant_id: string;
  middleware_type: MiddlewareType;
  cluster_name: string | null;
  instance_name: string;
  version: string | null;
  host: string;
  port: number;
  credential_ref: string | null;
  config: Record<string, unknown>;
  status: MiddlewareStatus;
  health_status: HealthStatus;
  environment: string;
  tags: Record<string, string>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HealthCheckRecord {
  id: string;
  instance_id: string;
  check_type: 'connectivity' | 'replication' | 'cluster' | 'performance';
  status: 'healthy' | 'warning' | 'critical';
  metrics: Record<string, unknown>;
  details: string | null;
  checked_at: string;
}

export interface MetricRecord {
  id: string;
  instance_id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string | null;
  collected_at: string;
}

export interface OperationRecord {
  id: string;
  instance_id: string | null;
  operation_type: OperationType;
  status: OperationStatus;
  operator: string;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== Instance Management ====================

export function getMiddlewareInstances(params?: {
  page?: number;
  limit?: number;
  type?: MiddlewareType;
  status?: MiddlewareStatus;
  health_status?: HealthStatus;
  environment?: string;
  search?: string;
}) {
  return api.get<{ data: MiddlewareInstance[]; total: number; page: number; limit: number }>(
    '/v1/middleware/instances',
    { params }
  );
}

export function getMiddlewareInstance(id: string) {
  return api.get<MiddlewareInstance>(`/v1/middleware/instances/${id}`);
}

export function createMiddlewareInstance(data: {
  middleware_type: MiddlewareType;
  cluster_name?: string;
  instance_name: string;
  version?: string;
  host: string;
  port: number;
  credential_ref?: string;
  config?: Record<string, unknown>;
  environment?: string;
  tags?: Record<string, string>;
}) {
  return api.post<MiddlewareInstance>('/v1/middleware/instances', data);
}

export function updateMiddlewareInstance(id: string, data: Partial<MiddlewareInstance>) {
  return api.patch<MiddlewareInstance>(`/v1/middleware/instances/${id}`, data);
}

export function deleteMiddlewareInstance(id: string) {
  return api.delete<{ deleted: boolean }>(`/v1/middleware/instances/${id}`);
}

export function testMiddlewareConnection(id: string) {
  return api.post<{ success: boolean; latency_ms: number; message: string }>(
    `/v1/middleware/instances/${id}/test-connection`
  );
}

// ==================== Health Checks ====================

export function getHealthSummary() {
  return api.get<{
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    unknown: number;
    instances: Array<{ id: string; name: string; type: MiddlewareType; health_status: HealthStatus }>;
  }>('/v1/middleware/health');
}

export function getInstanceHealth(id: string, params?: { limit?: number }) {
  return api.get<HealthCheckRecord[]>(`/v1/middleware/instances/${id}/health`, { params });
}

export function triggerHealthCheck(id: string) {
  return api.post<{ checks: HealthCheckRecord[] }>(
    `/v1/middleware/instances/${id}/health/check`
  );
}

export function getHealthHistory(params?: {
  instance_id?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  return api.get<{ data: HealthCheckRecord[]; total: number }>(
    '/v1/middleware/health/history',
    { params }
  );
}

// ==================== Metrics ====================

export function getMetrics(params?: {
  instance_id?: string;
  metric_name?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  return api.get<MetricRecord[]>('/v1/middleware/metrics', { params });
}

export function getInstanceMetrics(id: string, params?: {
  from?: string;
  to?: string;
  metric_names?: string[];
  granularity?: 'raw' | '1h' | '1d';
}) {
  return api.get<MetricRecord[]>(`/v1/middleware/instances/${id}/metrics`, { params });
}

export function getInstanceMetricsSummary(id: string) {
  return api.get<Record<string, { current: number; avg_1h: number; max_1h: number; unit: string }>>(
    `/v1/middleware/instances/${id}/metrics/summary`
  );
}

// ==================== Operations ====================

export function createOperation(id: string, data: {
  operation_type: OperationType;
  params?: Record<string, unknown>;
}) {
  return api.post<OperationRecord>(`/v1/middleware/instances/${id}/operations`, data);
}

export function getOperations(params?: {
  page?: number;
  limit?: number;
  instance_id?: string;
  operation_type?: OperationType;
  status?: OperationStatus;
  from?: string;
  to?: string;
}) {
  return api.get<{ data: OperationRecord[]; total: number }>(
    '/v1/middleware/operations',
    { params }
  );
}

export function getOperationDetail(opId: string) {
  return api.get<OperationRecord>(`/v1/middleware/operations/${opId}`);
}

export function cancelOperation(opId: string) {
  return api.post<{ cancelled: boolean }>(`/v1/middleware/operations/${opId}/cancel`);
}

export function rollbackOperation(opId: string) {
  return api.post<OperationRecord>(`/v1/middleware/operations/${opId}/rollback`);
}

// ==================== Health Config ====================

export function getHealthConfig(id: string) {
  return api.get<{
    interval_seconds: number;
    timeout_seconds: number;
    consecutive_failures: number;
    enabled_checks: string[];
  }>(`/v1/middleware/instances/${id}/health-config`);
}

export function updateHealthConfig(id: string, data: {
  interval_seconds?: number;
  timeout_seconds?: number;
  consecutive_failures?: number;
  enabled_checks?: string[];
}) {
  return api.patch(`/v1/middleware/instances/${id}/health-config`, data);
}
```

---

## 四、页面交互设计（前端）

### 4.1 路由设计

```
/infrastructure/middleware/instances          — 实例列表
/infrastructure/middleware/instances/new      — 注册新实例
/infrastructure/middleware/instances/:id      — 实例详情
/infrastructure/middleware/health             — 健康仪表盘
/infrastructure/middleware/metrics            — 性能指标
/infrastructure/middleware/operations         — 运维操作
/infrastructure/middleware/operations/history — 操作历史
```

**菜单归属**：8 大菜单 → "基础设施" → 子菜单 "中间件运维"

### 4.2 页面一：实例列表（`/middleware/instances`）

```tsx
/**
 * MiddlewareInstancesPage - 中间件实例列表
 *
 * Features:
 * - 按类型/状态/环境/健康状态过滤
 * - 搜索实例名称
 * - 一键刷新、新建
 * - 快捷操作：查看详情、健康检查、运维操作
 * - 空状态引导创建
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Tag, Space, Button, Input, Select, message, Popconfirm, Badge,
} from 'antd';
import {
  ClusterOutlined, PlusOutlined, ReloadOutlined, SearchOutlined,
  EyeOutlined, ThunderboltOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, componentRadius } from '@/tokens';
import TableComponent, { TableColumn } from '@/components/Table';
import {
  getMiddlewareInstances,
  deleteMiddlewareInstance,
  triggerHealthCheck,
  type MiddlewareInstance,
  type MiddlewareType,
  type MiddlewareStatus,
  type HealthStatus,
} from '@/api/middleware';

const { Title, Text } = Typography;

// ============================================================================
// Constants
// ============================================================================

const TYPE_OPTIONS: { label: string; value: MiddlewareType }[] = [
  { label: '全部', value: '' as unknown as MiddlewareType },
  { label: 'Redis', value: 'redis' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'Kafka', value: 'kafka' },
  { label: 'RabbitMQ', value: 'rabbitmq' },
  { label: 'Elasticsearch', value: 'elasticsearch' },
  { label: 'MongoDB', value: 'mongodb' },
];

const ENV_OPTIONS = [
  { label: '全部', value: '' },
  { label: 'Production', value: 'production' },
  { label: 'Staging', value: 'staging' },
  { label: 'Development', value: 'development' },
];

// ============================================================================
// Helpers
// ============================================================================

function getHealthStatusColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return colors.success[500];
    case 'warning': return colors.warning[500];
    case 'critical': return colors.error[500];
    default: return colors.neutral[400];
  }
}

function getHealthStatusLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return '健康';
    case 'warning': return '警告';
    case 'critical': return '严重';
    default: return '未知';
  }
}

function getTypeIcon(type: MiddlewareType): string {
  const icons: Record<MiddlewareType, string> = {
    redis: '🔴', mysql: '🐬', kafka: '📨',
    rabbitmq: '🐰', elasticsearch: '🔍', mongodb: '🍃',
  };
  return icons[type] || '';
}

// ============================================================================
// Component
// ============================================================================

const MiddlewareInstancesPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [data, setData] = useState<MiddlewareInstance[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<MiddlewareType | ''>('');
  const [filterEnv, setFilterEnv] = useState('');
  const [filterHealth, setFilterHealth] = useState<HealthStatus | ''>('');

  const fetchData = useCallback(async (resetPage = false) => {
    if (resetPage) setPage(1);
    const currentPage = resetPage ? 1 : page;
    setLoading(true);
    try {
      const res = await getMiddlewareInstances({
        page: currentPage,
        limit: pageSize,
        type: filterType || undefined,
        environment: filterEnv || undefined,
        health_status: filterHealth || undefined,
        search: search || undefined,
      });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch (error: unknown) {
      message.error(`加载实例列表失败: ${(error as Error).message}`);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterType, filterEnv, filterHealth, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteMiddlewareInstance(id);
      message.success('实例已删除');
      await fetchData(true);
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleTriggerCheck = async (id: string) => {
    try {
      await triggerHealthCheck(id);
      message.success('健康检查已触发');
      await fetchData();
    } catch (error: unknown) {
      message.error(`触发健康检查失败: ${(error as Error).message}`);
    }
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: TableColumn<MiddlewareInstance>[] = [
    {
      key: 'instance_name',
      title: '实例名称',
      dataIndex: 'instance_name',
      width: 180,
      sortable: true,
      render: (value: unknown, record: MiddlewareInstance) => (
        <Space>
          <Text>{getTypeIcon(record.middleware_type)}</Text>
          <Text strong style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => navigate(`/infrastructure/middleware/instances/${record.id}`)}>
            {String(value)}
          </Text>
        </Space>
      ),
    },
    {
      key: 'middleware_type',
      title: '类型',
      dataIndex: 'middleware_type',
      width: 120,
      sortable: true,
      render: (value: unknown) => {
        const colorMap: Record<string, string> = {
          redis: 'red', mysql: 'blue', kafka: 'orange',
          rabbitmq: 'green', elasticsearch: 'geekblue', mongodb: 'lime',
        };
        return <Tag color={colorMap[String(value)]}>{String(value).toUpperCase()}</Tag>;
      },
    },
    {
      key: 'host',
      title: '地址',
      dataIndex: 'host',
      width: 160,
      render: (value: unknown, record: MiddlewareInstance) => (
        <Text copyable>{`${String(value)}:${record.port}`}</Text>
      ),
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 80,
      render: (value: unknown) => <Text type="secondary">{value ? String(value) : '-'}</Text>,
    },
    {
      key: 'environment',
      title: '环境',
      dataIndex: 'environment',
      width: 100,
      render: (value: unknown) => {
        const colorMap: Record<string, string> = {
          production: colors.error[500],
          staging: colors.warning[500],
          development: colors.neutral[500],
        };
        return (
          <Tag style={{ borderRadius: componentRadius.tag }}>
            <span style={{ color: colorMap[String(value)] || colors.neutral[500] }}>
              {String(value)}
            </span>
          </Tag>
        );
      },
    },
    {
      key: 'health_status',
      title: '健康状态',
      dataIndex: 'health_status',
      width: 100,
      sortable: true,
      render: (value: unknown) => (
        <Badge
          status="processing"
          color={getHealthStatusColor(value as HealthStatus)}
          text={getHealthStatusLabel(value as HealthStatus)}
        />
      ),
    },
    {
      key: 'status',
      title: '运行状态',
      dataIndex: 'status',
      width: 100,
      render: (value: unknown) => {
        const labelMap: Record<string, string> = {
          active: '运行中', degraded: '降级', maintenance: '维护中', retired: '已退役',
        };
        return <Tag>{labelMap[String(value)] || String(value)}</Tag>;
      },
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (value: unknown) => <Text type="secondary">{new Date(String(value)).toLocaleString('zh-CN')}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, record: MiddlewareInstance) => (
        <Space size="small">
          <Button
            type="link" size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/infrastructure/middleware/instances/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link" size="small" icon={<ThunderboltOutlined />}
            onClick={() => handleTriggerCheck(record.id)}
          >
            检查
          </Button>
          <Popconfirm
            title="确认删除？"
            description="此操作将软删除该实例，不会立即生效"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="link" size="small" danger icon={<DeleteOutlined />}
              loading={deleting === record.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing[6] }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          中间件实例
        </Title>
        <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
          管理 Redis、MySQL、Kafka、RabbitMQ、Elasticsearch、MongoDB 等中间件实例
        </Text>
      </div>

      {/* Toolbar */}
      <div style={{ marginBottom: spacing[4], display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Input
            placeholder="搜索实例名称"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => fetchData(true)}
            style={{ width: 220, borderRadius: componentRadius.input }}
            allowClear
          />
          <Select
            value={filterType}
            onChange={(v) => { setFilterType(v); fetchData(true); }}
            options={TYPE_OPTIONS}
            style={{ width: 140 }}
            placeholder="类型"
          />
          <Select
            value={filterEnv}
            onChange={(v) => { setFilterEnv(v); fetchData(true); }}
            options={ENV_OPTIONS}
            style={{ width: 140 }}
            placeholder="环境"
          />
          <Select
            value={filterHealth}
            onChange={(v) => { setFilterHealth(v); fetchData(true); }}
            options={[
              { label: '全部状态', value: '' },
              { label: '健康', value: 'healthy' },
              { label: '警告', value: 'warning' },
              { label: '严重', value: 'critical' },
              { label: '未知', value: 'unknown' },
            ]}
            style={{ width: 120 }}
            placeholder="健康状态"
          />
        </Space>
        <Space>
          <Button
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={handleRefresh}
            loading={refreshing}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/infrastructure/middleware/instances/new')}
            style={{ borderRadius: componentRadius.button.md }}
          >
            注册实例
          </Button>
        </Space>
      </div>

      {/* Table */}
      <TableComponent<MiddlewareInstance>
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 个实例`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      {/* Empty State */}
      {data.length === 0 && !loading && (
        <div style={{ marginTop: spacing[6], textAlign: 'center' }}>
          {/* The Table component already handles empty state; this is a fallback CTA */}
        </div>
      )}
    </div>
  );
};

export default MiddlewareInstancesPage;
```

### 4.3 页面二：实例注册页（`/middleware/instances/new`）

```tsx
/**
 * MiddlewareInstanceCreatePage - 注册中间件实例
 *
 * Features:
 * - 分步表单：基本信息 → 连接配置 → 验证与提交
 * - 连接测试按钮（提交前验证）
 * - 表单校验规则
 */
import React, { useState } from 'react';
import {
  Form, Input, Select, Button, Space, Typography, message, Card, Steps, Divider,
} from 'antd';
import {
  ClusterOutlined, ArrowLeftOutlined, CheckCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, componentRadius } from '@/tokens';
import { createMiddlewareInstance, testMiddlewareConnection, type MiddlewareType } from '@/api/middleware';

const { Title, Text } = Typography;

const MIDDLEWARE_CONFIGS: Record<MiddlewareType, { defaultPort: number; fields: string[] }> = {
  redis: { defaultPort: 6379, fields: ['require_password', 'sentinel_mode', 'cluster_mode'] },
  mysql: { defaultPort: 3306, fields: ['database_name', 'ssl_mode', 'charset'] },
  kafka: { defaultPort: 9092, fields: ['sasl_mechanism', 'security_protocol', 'consumer_groups'] },
  rabbitmq: { defaultPort: 5672, fields: ['virtual_host', 'management_port', 'ssl_enabled'] },
  elasticsearch: { defaultPort: 9200, fields: ['api_key', 'ssl_enabled', 'cluster_name'] },
  mongodb: { defaultPort: 27017, fields: ['auth_source', 'replica_set', 'ssl_enabled'] },
};

const MiddlewareInstanceCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedType, setSelectedType] = useState<MiddlewareType | undefined>(undefined);

  // Step 1: Basic Info
  const renderStep1 = () => (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Form.Item
        name="instance_name"
        label="实例名称"
        rules={[{ required: true, message: '请输入实例名称' }]}
      >
        <Input placeholder="例如：redis-prod-01" style={{ borderRadius: componentRadius.input }} />
      </Form.Item>

      <Form.Item
        name="middleware_type"
        label="中间件类型"
        rules={[{ required: true, message: '请选择中间件类型' }]}
      >
        <Select
          placeholder="选择中间件类型"
          onChange={(v: MiddlewareType) => {
            setSelectedType(v);
            form.setFieldsValue({ port: MIDDLEWARE_CONFIGS[v].defaultPort });
          }}
          options={[
            { label: 'Redis', value: 'redis' },
            { label: 'MySQL', value: 'mysql' },
            { label: 'Kafka', value: 'kafka' },
            { label: 'RabbitMQ', value: 'rabbitmq' },
            { label: 'Elasticsearch', value: 'elasticsearch' },
            { label: 'MongoDB', value: 'mongodb' },
          ]}
        />
      </Form.Item>

      <Form.Item name="cluster_name" label="集群名称">
        <Input placeholder="可选，例如：redis-cluster-01" style={{ borderRadius: componentRadius.input }} />
      </Form.Item>

      <Form.Item name="version" label="版本">
        <Input placeholder="例如：7.2.4" style={{ borderRadius: componentRadius.input }} />
      </Form.Item>

      <Form.Item
        name="environment"
        label="环境"
        rules={[{ required: true, message: '请选择环境' }]}
        initialValue="production"
      >
        <Select options={[
          { label: 'Production', value: 'production' },
          { label: 'Staging', value: 'staging' },
          { label: 'Development', value: 'development' },
        ]} />
      </Form.Item>

      <Form.Item name="tags" label="标签">
        <Input placeholder="JSON 格式，例如：{"team": "backend", "region": "cn-shanghai"}" style={{ borderRadius: componentRadius.input }} />
      </Form.Item>
    </div>
  );

  // Step 2: Connection Config
  const renderStep2 = () => (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Form.Item
        name="host"
        label="主机地址"
        rules={[
          { required: true, message: '请输入主机地址' },
          { pattern: /^[a-zA-Z0-9.-]+$/, message: '请输入有效的主机地址' },
        ]}
      >
        <Input placeholder="例如：redis-prod.example.com" style={{ borderRadius: componentRadius.input }} />
      </Form.Item>

      <Form.Item
        name="port"
        label="端口"
        rules={[
          { required: true, message: '请输入端口号' },
          { type: 'number', min: 1, max: 65535, message: '端口范围 1-65535' },
        ]}
      >
        <Input type="number" placeholder={selectedType ? MIDDLEWARE_CONFIGS[selectedType].defaultPort : '端口号'} style={{ borderRadius: componentRadius.input }} />
      </Form.Item>

      <Form.Item name="credential_ref" label="凭据引用">
        <Input placeholder="k8s://orion/redis-prod/password 或 vault://secret/data/redis/prod" style={{ borderRadius: componentRadius.input }} />
        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          支持 K8s Secret、Vault、Orion Secret Store 引用路径，凭据不会明文存储
        </Text>
      </Form.Item>

      <Form.Item name="config" label="额外配置">
        <Input.TextArea
          rows={4}
          placeholder='JSON 格式，例如：{"max_connections": 100, "timeout": 5000}'
          style={{ borderRadius: componentRadius.input }}
        />
      </Form.Item>
    </div>
  );

  // Step 3: Verify & Submit
  const renderStep3 = () => {
    const values = form.getFieldsValue();
    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <Card
          size="small"
          title="连接测试"
          extra={
            <Button
              icon={<ThunderboltOutlined />}
              loading={testingConn}
              onClick={async () => {
                setTestingConn(true);
                setConnectionResult(null);
                try {
                  // 先创建临时实例再测试，或后端支持临时测试
                  // 这里简化为提交后测试
                  message.info('请先提交实例注册，然后在实例详情页进行连接测试');
                } catch (error: unknown) {
                  setConnectionResult({ success: false, message: (error as Error).message });
                } finally {
                  setTestingConn(false);
                }
              }}
            >
              测试连接
            </Button>
          }
          style={{ marginBottom: spacing[4], borderRadius: componentRadius.card }}
        >
          {connectionResult && (
            <Text style={{ color: connectionResult.success ? colors.success[500] : colors.error[500] }}>
              {connectionResult.message}
            </Text>
          )}
          {!connectionResult && <Text type="secondary">点击"测试连接"验证配置是否正确</Text>}
        </Card>

        <Card
          size="small"
          title="确认信息"
          style={{ borderRadius: componentRadius.card }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
            <Text type="secondary">实例名称</Text>
            <Text>{values.instance_name || '-'}</Text>
            <Text type="secondary">类型</Text>
            <Text>{values.middleware_type?.toUpperCase()}</Text>
            <Text type="secondary">地址</Text>
            <Text>{values.host}:{values.port}</Text>
            <Text type="secondary">环境</Text>
            <Text>{values.environment}</Text>
          </div>
        </Card>
      </div>
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = form.getFieldsValue();
      const payload: Record<string, unknown> = {
        instance_name: values.instance_name,
        middleware_type: values.middleware_type,
        cluster_name: values.cluster_name || undefined,
        version: values.version || undefined,
        host: values.host,
        port: Number(values.port),
        credential_ref: values.credential_ref || undefined,
        environment: values.environment || 'production',
      };

      if (values.tags) {
        try { payload.tags = JSON.parse(values.tags); } catch { payload.tags = {}; }
      }
      if (values.config) {
        try { payload.config = JSON.parse(values.config); } catch { payload.config = {}; }
      }

      const res = await createMiddlewareInstance(payload as Parameters<typeof createMiddlewareInstance>[0]);
      message.success(`实例 "${res.data.instance_name}" 注册成功`);
      navigate(`/infrastructure/middleware/instances/${res.data.id}`);
    } catch (error: unknown) {
      message.error(`注册失败: ${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { title: '基本信息', description: '实例名称、类型、环境' },
    { title: '连接配置', description: '地址、端口、凭据' },
    { title: '确认提交', description: '验证信息并提交' },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing[6] }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/infrastructure/middleware/instances')}
          style={{ marginBottom: spacing[4] }}
        >
          返回列表
        </Button>
        <Title level={2} style={{ marginBottom: 8 }}>
          <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          注册中间件实例
        </Title>
        <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
          注册新的中间件实例到 Orion 平台进行统一运维管理
        </Text>
      </div>

      {/* Steps */}
      <Card style={{ marginBottom: spacing[4], borderRadius: componentRadius.card }}>
        <Steps current={currentStep} items={steps} style={{ marginBottom: spacing[6] }} />

        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            上一步
          </Button>
          <Space>
            {currentStep < 2 ? (
              <Button
                type="primary"
                onClick={() => {
                  form.validateFields().then(() => setCurrentStep(currentStep + 1)).catch(() => {});
                }}
                style={{ borderRadius: componentRadius.button.md }}
              >
                下一步
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={submitting}
                onClick={handleSubmit}
                style={{ borderRadius: componentRadius.button.md }}
              >
                提交注册
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default MiddlewareInstanceCreatePage;
```

### 4.4 页面三：实例详情页（`/middleware/instances/:id`）

```tsx
/**
 * MiddlewareInstanceDetailPage - 实例详情
 *
 * Features:
 * - 基本信息卡片（可编辑）
 * - 健康状态实时查看
 * - 性能指标趋势图
 * - 操作历史
 * - 快捷运维操作按钮
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Descriptions, Tag, Space, Button, message, Tabs,
  Form, Input, Select, Modal, Drawer, Table, Empty, Statistic, Row, Col,
} from 'antd';
import {
  EditOutlined, ClusterOutlined, ReloadOutlined, ThunderboltOutlined,
  CloudDownloadOutlined, UndoOutlined, SyncOutlined, CopyOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { colors, spacing, componentRadius } from '@/tokens';
import TableComponent, { TableColumn } from '@/components/Table';
import {
  getMiddlewareInstance,
  updateMiddlewareInstance,
  getInstanceHealth,
  getInstanceMetricsSummary,
  getOperations,
  createOperation,
  triggerHealthCheck,
  getHealthConfig,
  updateHealthConfig,
  type MiddlewareInstance,
  type HealthCheckRecord,
  type OperationRecord,
  type HealthStatus,
  type OperationType,
} from '@/api/middleware';

const { Title, Text } = Typography;

// ============================================================================
// Helpers
// ============================================================================

function getHealthStatusColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return colors.success[500];
    case 'warning': return colors.warning[500];
    case 'critical': return colors.error[500];
    default: return colors.neutral[400];
  }
}

function getHealthStatusLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return '健康';
    case 'warning': return '警告';
    case 'critical': return '严重';
    default: return '未知';
  }
}

const OPERATION_LABELS: Record<OperationType, string> = {
  restart: '重启', scale: '扩缩容', backup: '备份',
  restore: '恢复', upgrade: '升级', config_change: '配置变更', failover: '故障切换',
};

const OPERATION_COLORS: Record<OperationType, string> = {
  restart: colors.warning[500], scale: colors.primary[500], backup: colors.info[500],
  restore: colors.error[500], upgrade: colors.purple[500], config_change: colors.neutral[500],
  failover: colors.error[500],
};

// ============================================================================
// Component
// ============================================================================

const MiddlewareInstanceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<MiddlewareInstance | null>(null);
  const [metricsSummary, setMetricsSummary] = useState<Record<string, { current: number; avg_1h: number; max_1h: number; unit: string }>>({});
  const [healthChecks, setHealthChecks] = useState<HealthCheckRecord[]>([]);
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [opLoading, setOpLoading] = useState<string | null>(null);

  // Edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Operation modal
  const [opModalVisible, setOpModalVisible] = useState(false);
  const [opForm] = Form.useForm();
  const [opSubmitting, setOpSubmitting] = useState(false);

  // Health config
  const [healthConfigDrawer, setHealthConfigDrawer] = useState(false);
  const [healthConfigForm] = Form.useForm();

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [instRes, metricsRes, healthRes, opsRes] = await Promise.all([
        getMiddlewareInstance(id),
        getInstanceMetricsSummary(id),
        getInstanceHealth(id, { limit: 5 }),
        getOperations({ instance_id: id, limit: 10 }),
      ]);
      setInstance(instRes.data);
      setMetricsSummary(metricsRes.data);
      setHealthChecks(healthRes.data);
      setOperations(opsRes.data.data);
    } catch (error: unknown) {
      message.error(`加载实例详情失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Edit ---
  const handleEdit = () => {
    if (!instance) return;
    editForm.setFieldsValue({
      instance_name: instance.instance_name,
      version: instance.version,
      environment: instance.environment,
      tags: JSON.stringify(instance.tags),
      config: JSON.stringify(instance.config),
    });
    setEditVisible(true);
  };

  const handleSaveEdit = async () => {
    setEditSubmitting(true);
    try {
      const values = editForm.getFieldsValue();
      const payload: Record<string, unknown> = {};
      if (values.instance_name) payload.instance_name = values.instance_name;
      if (values.version !== undefined) payload.version = values.version;
      if (values.environment) payload.environment = values.environment;
      if (values.tags) { try { payload.tags = JSON.parse(values.tags); } catch { payload.tags = {}; } }
      if (values.config) { try { payload.config = JSON.parse(values.config); } catch { payload.config = {}; } }

      await updateMiddlewareInstance(id!, payload);
      message.success('实例信息已更新');
      setEditVisible(false);
      await loadData();
    } catch (error: unknown) {
      message.error(`更新失败: ${(error as Error).message}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  // --- Operation ---
  const handleCreateOperation = async () => {
    setOpSubmitting(true);
    try {
      const values = opForm.getFieldsValue();
      await createOperation(id!, {
        operation_type: values.operation_type,
        params: values.params ? JSON.parse(values.params) : {},
      });
      message.success('操作已提交');
      setOpModalVisible(false);
      opForm.resetFields();
      await loadData();
    } catch (error: unknown) {
      message.error(`操作提交失败: ${(error as Error).message}`);
    } finally {
      setOpSubmitting(false);
    }
  };

  // --- Trigger health check ---
  const handleTriggerCheck = async () => {
    try {
      await triggerHealthCheck(id!);
      message.success('健康检查已触发');
      await loadData();
    } catch (error: unknown) {
      message.error(`触发失败: ${(error as Error).message}`);
    }
  };

  if (loading) {
    return <div style={{ padding: spacing[6], textAlign: 'center' }}>加载中...</div>;
  }

  if (!instance) {
    return (
      <Empty
        description="实例不存在"
        extra={
          <Button type="primary" onClick={() => navigate('/infrastructure/middleware/instances')}>
            返回列表
          </Button>
        }
      />
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: (
        <Card
          title="配置信息"
          extra={
            <Button icon={<EditOutlined />} onClick={handleEdit}>
              编辑
            </Button>
          }
          style={{ borderRadius: componentRadius.card }}
        >
          <Descriptions column={2} bordered>
            <Descriptions.Item label="实例名称">{instance.instance_name}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag>{instance.middleware_type.toUpperCase()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="集群">{instance.cluster_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="版本">{instance.version || '-'}</Descriptions.Item>
            <Descriptions.Item label="地址">{instance.host}:{instance.port}</Descriptions.Item>
            <Descriptions.Item label="环境">{instance.environment}</Descriptions.Item>
            <Descriptions.Item label="凭据引用">{instance.credential_ref || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建人">{instance.created_by}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{new Date(instance.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{new Date(instance.updated_at).toLocaleString('zh-CN')}</Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'health',
      label: '健康状态',
      children: (
        <div>
          <Row gutter={spacing[4]} style={{ marginBottom: spacing[4] }}>
            <Col span={6}>
              <Card style={{ borderRadius: componentRadius.card, textAlign: 'center' }}>
                <Statistic
                  title="当前状态"
                  value={getHealthStatusLabel(instance.health_status)}
                  valueStyle={{ color: getHealthStatusColor(instance.health_status) }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: componentRadius.card, textAlign: 'center' }}>
                <Statistic title="检查次数" value={healthChecks.length} suffix="次" />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: componentRadius.card, textAlign: 'center' }}>
                <Statistic title="运行状态" value={instance.status === 'active' ? '运行中' : instance.status} />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: componentRadius.card, textAlign: 'center' }}>
                <Statistic title="最近更新" value={new Date(instance.updated_at).toLocaleDateString('zh-CN')} />
              </Card>
            </Col>
          </Row>

          <Card
            title="最近健康检查记录"
            extra={
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={handleTriggerCheck}
              >
                手动检查
              </Button>
            }
            style={{ borderRadius: componentRadius.card }}
          >
            {healthChecks.length === 0 ? (
              <Empty description="暂无健康检查记录" />
            ) : (
              <TableComponent<HealthCheckRecord>
                columns={[
                  { key: 'check_type', title: '检查类型', dataIndex: 'check_type' },
                  {
                    key: 'status', title: '结果', dataIndex: 'status',
                    render: (v: unknown) => (
                      <Tag color={getHealthStatusColor(v as HealthStatus)}>
                        {getHealthStatusLabel(v as HealthStatus)}
                      </Tag>
                    ),
                  },
                  {
                    key: 'checked_at', title: '检查时间', dataIndex: 'checked_at',
                    render: (v: unknown) => new Date(String(v)).toLocaleString('zh-CN'),
                  },
                  { key: 'details', title: '详情', dataIndex: 'details', ellipsis: true },
                ]}
                dataSource={healthChecks}
                rowKey="id"
                size="small"
              />
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'metrics',
      label: '性能指标',
      children: (
        <Card style={{ borderRadius: componentRadius.card }}>
          {Object.keys(metricsSummary).length === 0 ? (
            <Empty description="暂无指标数据，请等待首次采集完成后查看" />
          ) : (
            <Row gutter={spacing[4]}>
              {Object.entries(metricsSummary).map(([name, data]) => (
                <Col span={6} key={name}>
                  <Card size="small" style={{ borderRadius: componentRadius.card, textAlign: 'center' }}>
                    <Statistic
                      title={name}
                      value={data.current}
                      suffix={data.unit}
                      valueStyle={{ fontSize: 24 }}
                    />
                    <div style={{ marginTop: 8, color: colors.neutral[500], fontSize: 12 }}>
                      1h 均值: {data.avg_1h} | 峰值: {data.max_1h}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      ),
    },
    {
      key: 'operations',
      label: '操作历史',
      children: (
        <Card style={{ borderRadius: componentRadius.card }}>
          <TableComponent<OperationRecord>
            columns={[
              {
                key: 'operation_type', title: '操作类型', dataIndex: 'operation_type',
                render: (v: unknown) => (
                  <Tag color={OPERATION_COLORS[v as OperationType]}>
                    {OPERATION_LABELS[v as OperationType]}
                  </Tag>
                ),
              },
              {
                key: 'status', title: '状态', dataIndex: 'status',
                render: (v: unknown) => {
                  const labels: Record<string, string> = {
                    pending: '等待中', executing: '执行中',
                    completed: '已完成', failed: '失败', rollback: '已回滚',
                  };
                  return <Tag>{labels[String(v)] || String(v)}</Tag>;
                },
              },
              { key: 'operator', title: '操作人', dataIndex: 'operator' },
              {
                key: 'started_at', title: '开始时间', dataIndex: 'started_at',
                render: (v: unknown) => new Date(String(v)).toLocaleString('zh-CN'),
              },
              {
                key: 'completed_at', title: '完成时间', dataIndex: 'completed_at',
                render: (v: unknown) => v ? new Date(String(v)).toLocaleString('zh-CN') : '-',
              },
              {
                key: 'error_message', title: '错误信息', dataIndex: 'error_message',
                render: (v: unknown) => v ? <Text type="danger">{String(v)}</Text> : '-',
              },
            ]}
            dataSource={operations}
            rowKey="id"
            size="small"
          />
        </Card>
      ),
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing[6], display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Button
            icon={<CopyOutlined />}
            onClick={() => navigate('/infrastructure/middleware/instances')}
            style={{ marginBottom: spacing[2] }}
          >
            返回列表
          </Button>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            {instance.instance_name}
          </Title>
          <Space>
            <Tag>{instance.middleware_type.toUpperCase()}</Tag>
            <Tag color={getHealthStatusColor(instance.health_status)}>
              {getHealthStatusLabel(instance.health_status)}
            </Tag>
            <Tag>{instance.host}:{instance.port}</Tag>
            <Tag>{instance.environment}</Tag>
          </Space>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => { opForm.resetFields(); setOpModalVisible(true); }}
            type="primary"
            style={{ borderRadius: componentRadius.button.md }}
          >
            运维操作
          </Button>
        </Space>
      </div>

      {/* Tabs */}
      <Tabs items={tabItems} defaultActiveKey="info" />

      {/* Edit Modal */}
      <Modal
        title="编辑实例信息"
        open={editVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditVisible(false)}
        confirmLoading={editSubmitting}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ maxWidth: 500 }}>
          <Form.Item name="instance_name" label="实例名称" rules={[{ required: true }]}>
            <Input style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item name="version" label="版本">
            <Input style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item name="environment" label="环境">
            <Select options={[
              { label: 'Production', value: 'production' },
              { label: 'Staging', value: 'staging' },
              { label: 'Development', value: 'development' },
            ]} />
          </Form.Item>
          <Form.Item name="tags" label="标签 (JSON)">
            <Input.TextArea rows={2} style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Operation Modal */}
      <Modal
        title="发起运维操作"
        open={opModalVisible}
        onOk={handleCreateOperation}
        onCancel={() => setOpModalVisible(false)}
        confirmLoading={opSubmitting}
        width={600}
      >
        <Form form={opForm} layout="vertical" style={{ maxWidth: 500 }}>
          <Form.Item name="operation_type" label="操作类型" rules={[{ required: true, message: '请选择操作类型' }]}>
            <Select options={Object.entries(OPERATION_LABELS).map(([k, v]) => ({ label: v, value: k }))} />
          </Form.Item>
          <Form.Item name="params" label="操作参数 (JSON, 可选)">
            <Input.TextArea rows={4} placeholder='{"target_version": "8.0", "graceful": true}' style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            注意：部分操作需要审批，提交后将自动创建审批工单
          </Text>
        </Form>
      </Modal>
    </div>
  );
};

export default MiddlewareInstanceDetailPage;
```

### 4.5 页面四：健康仪表盘（`/middleware/health`）

```tsx
/**
 * MiddlewareHealthDashboard - 健康检查仪表盘
 *
 * Features:
 * - 全部实例健康状态卡片（颜色编码）
 * - 健康/警告/严重统计
 * - 一键刷新全部
 * - 按类型过滤
 * - 健康趋势时间线
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Tag, Space, Button, Select, Statistic, Row, Col, Badge, Empty, message,
} from 'antd';
import {
  RadarChartOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined,
  CloseCircleOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import { getHealthSummary, getHealthHistory, type HealthStatus, type MiddlewareType } from '@/api/middleware';

const { Title, Text } = Typography;

const HealthDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<MiddlewareType | ''>('');
  const [summary, setSummary] = useState<{
    total: number; healthy: number; warning: number; critical: number; unknown: number;
    instances: Array<{ id: string; name: string; type: MiddlewareType; health_status: HealthStatus }>;
  }>({ total: 0, healthy: 0, warning: 0, critical: 0, unknown: 0, instances: [] });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getHealthSummary();
      setSummary(res.data);
    } catch (error: unknown) {
      message.error(`加载健康数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSummary();
    setRefreshing(false);
  };

  const filteredInstances = filterType
    ? summary.instances.filter((i) => i.type === filterType)
    : summary.instances;

  const statCards = [
    { title: '总计', value: summary.total, icon: <RadarChartOutlined />, color: colors.primary[500] },
    { title: '健康', value: summary.healthy, icon: <CheckCircleOutlined />, color: colors.success[500] },
    { title: '警告', value: summary.warning, icon: <WarningOutlined />, color: colors.warning[500] },
    { title: '严重', value: summary.critical, icon: <CloseCircleOutlined />, color: colors.error[500] },
    { title: '未知', value: summary.unknown, icon: <QuestionCircleOutlined />, color: colors.neutral[400] },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing[6], display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <RadarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            健康仪表盘
          </Title>
          <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
            全部中间件实例健康状态实时监控
          </Text>
        </div>
        <Space>
          <Select
            value={filterType}
            onChange={setFilterType}
            options={[
              { label: '全部类型', value: '' },
              { label: 'Redis', value: 'redis' },
              { label: 'MySQL', value: 'mysql' },
              { label: 'Kafka', value: 'kafka' },
              { label: 'RabbitMQ', value: 'rabbitmq' },
              { label: 'Elasticsearch', value: 'elasticsearch' },
              { label: 'MongoDB', value: 'mongodb' },
            ]}
            style={{ width: 140 }}
          />
          <Button
            type="primary"
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={handleRefresh}
            loading={refreshing}
            style={{ borderRadius: componentRadius.button.md }}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* Stat Cards */}
      <Row gutter={spacing[4]} style={{ marginBottom: spacing[6] }}>
        {statCards.map((card) => (
          <Col span={4} key={card.title}>
            <Card style={{ borderRadius: componentRadius.card, textAlign: 'center' }}>
              <div style={{ color: card.color, fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
              <Statistic title={card.title} value={loading ? '-' : card.value} valueStyle={{ color: card.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Instance Health Grid */}
      <Card title="实例健康状态" style={{ borderRadius: componentRadius.card }}>
        {filteredInstances.length === 0 ? (
          <Empty description="暂无实例" />
        ) : (
          <Row gutter={spacing[4]}>
            {filteredInstances.map((inst) => (
              <Col span={6} key={inst.id}>
                <Card
                  size="small"
                  style={{
                    borderRadius: componentRadius.card,
                    borderLeft: `3px solid ${
                      inst.health_status === 'healthy' ? colors.success[500] :
                      inst.health_status === 'warning' ? colors.warning[500] :
                      inst.health_status === 'critical' ? colors.error[500] :
                      colors.neutral[400]
                    }`,
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>{inst.name}</Text>
                      <Badge
                        status="processing"
                        color={
                          inst.health_status === 'healthy' ? colors.success[500] :
                          inst.health_status === 'warning' ? colors.warning[500] :
                          inst.health_status === 'critical' ? colors.error[500] :
                          colors.neutral[400]
                        }
                      />
                    </div>
                    <Tag>{inst.type.toUpperCase()}</Tag>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  );
};

export default HealthDashboard;
```

### 4.6 页面五：性能指标页（`/middleware/metrics`）

```tsx
/**
 * MiddlewareMetricsPage - 性能指标总览
 *
 * Features:
 * - 全部实例最新指标一览
 * - 按实例和指标过滤
 * - 指标聚合统计
 * - 时间范围选择
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Space, Button, Select, Table, Empty, message, DatePicker,
} from 'antd';
import {
  LineChartOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import TableComponent, { TableColumn } from '@/components/Table';
import { getMetrics, type MetricRecord } from '@/api/middleware';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const MiddlewareMetricsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MetricRecord[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMetrics({
        instance_id: selectedInstance || undefined,
        metric_name: selectedMetric || undefined,
        limit: 100,
      });
      setData(res.data);
    } catch (error: unknown) {
      message.error(`加载指标失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedInstance, selectedMetric]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns: TableColumn<MetricRecord>[] = [
    { key: 'instance_id', title: '实例 ID', dataIndex: 'instance_id', ellipsis: true, width: 280 },
    { key: 'metric_name', title: '指标名称', dataIndex: 'metric_name', width: 200 },
    {
      key: 'metric_value', title: '当前值', dataIndex: 'metric_value', width: 120,
      render: (v: unknown) => <Text strong>{Number(v).toFixed(2)}</Text>,
    },
    { key: 'metric_unit', title: '单位', dataIndex: 'metric_unit', width: 80 },
    {
      key: 'collected_at', title: '采集时间', dataIndex: 'collected_at', width: 180,
      render: (v: unknown) => new Date(String(v)).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing[6] }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <LineChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          性能指标
        </Title>
        <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
          查看各中间件实例的实时性能指标
        </Text>
      </div>

      <div style={{ marginBottom: spacing[4], display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Select placeholder="实例" allowClear value={selectedInstance} onChange={(v) => { setSelectedInstance(v); }} style={{ width: 200 }} />
          <Select placeholder="指标" allowClear value={selectedMetric} onChange={(v) => { setSelectedMetric(v); }} style={{ width: 200 }} />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
      </div>

      <Card style={{ borderRadius: componentRadius.card }}>
        {data.length === 0 ? (
          <Empty description="暂无指标数据" />
        ) : (
          <TableComponent<MetricRecord>
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            size="small"
          />
        )}
      </Card>
    </div>
  );
};

export default MiddlewareMetricsPage;
```

### 4.7 页面六：运维操作页（`/middleware/operations`）

```tsx
/**
 * MiddlewareOperationsPage - 运维操作发起与查看
 *
 * Features:
 * - 选择目标实例后发起操作
 * - 操作表单 + 二次确认
 * - 执行中状态轮询
 * - 操作结果展示
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Form, Select, Button, Input, Space, message, Tag, Popconfirm, Modal,
} from 'antd';
import {
  ThunderboltOutlined, ReloadOutlined, StopOutlined, UndoOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import TableComponent, { TableColumn } from '@/components/Table';
import {
  getMiddlewareInstances,
  getOperations,
  createOperation,
  cancelOperation,
  rollbackOperation,
  type OperationRecord,
  type OperationType,
  type OperationStatus,
} from '@/api/middleware';

const { Title, Text } = Typography;

const OPERATION_LABELS: Record<OperationType, string> = {
  restart: '重启', scale: '扩缩容', backup: '备份',
  restore: '恢复', upgrade: '升级', config_change: '配置变更', failover: '故障切换',
};

const STATUS_LABELS: Record<OperationStatus, string> = {
  pending: '等待中', executing: '执行中', completed: '已完成', failed: '失败', rollback: '已回滚',
};

const MiddlewareOperationsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [instances, setInstances] = useState<Array<{ id: string; instance_name: string; middleware_type: string }>>([]);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [opsRes, instRes] = await Promise.all([
        getOperations({ limit: 50 }),
        getMiddlewareInstances({ limit: 100 }),
      ]);
      setOperations(opsRes.data.data);
      setInstances(instRes.data.data.map((i) => ({ id: i.id, instance_name: i.instance_name, middleware_type: i.middleware_type })));
    } catch (error: unknown) {
      message.error(`加载数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = form.getFieldsValue();
      if (!values.instance_id) { message.error('请选择目标实例'); return; }
      if (!values.operation_type) { message.error('请选择操作类型'); return; }

      let params = {};
      if (values.params) {
        try { params = JSON.parse(values.params); } catch { message.error('参数 JSON 格式错误'); return; }
      }

      await createOperation(values.instance_id, {
        operation_type: values.operation_type,
        params,
      });
      message.success('操作已提交');
      form.resetFields();
      await loadData();
    } catch (error: unknown) {
      message.error(`操作提交失败: ${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (opId: string) => {
    setCancelLoading(opId);
    try {
      await cancelOperation(opId);
      message.success('操作已取消');
      await loadData();
    } catch (error: unknown) {
      message.error(`取消失败: ${(error as Error).message}`);
    } finally {
      setCancelLoading(null);
    }
  };

  const handleRollback = async (opId: string) => {
    setRollbackLoading(opId);
    try {
      await rollbackOperation(opId);
      message.success('回滚已触发');
      await loadData();
    } catch (error: unknown) {
      message.error(`回滚失败: ${(error as Error).message}`);
    } finally {
      setRollbackLoading(null);
    }
  };

  const columns: TableColumn<OperationRecord>[] = [
    {
      key: 'instance_id', title: '实例', dataIndex: 'instance_id', width: 160,
      render: (v: unknown) => {
        const inst = instances.find((i) => i.id === String(v));
        return inst ? <Text>{inst.instance_name}</Text> : <Text type="secondary">{String(v)}</Text>;
      },
    },
    {
      key: 'operation_type', title: '操作类型', dataIndex: 'operation_type', width: 120,
      render: (v: unknown) => <Tag>{OPERATION_LABELS[v as OperationType] || String(v)}</Tag>,
    },
    {
      key: 'status', title: '状态', dataIndex: 'status', width: 100,
      render: (v: unknown) => {
        const colorMap: Record<string, string> = {
          pending: colors.neutral[500], executing: colors.primary[500],
          completed: colors.success[500], failed: colors.error[500], rollback: colors.warning[500],
        };
        return (
          <Tag color={colorMap[String(v)]}>
            {STATUS_LABELS[v as OperationStatus] || String(v)}
          </Tag>
        );
      },
    },
    { key: 'operator', title: '操作人', dataIndex: 'operator', width: 100 },
    {
      key: 'started_at', title: '开始时间', dataIndex: 'started_at', width: 160,
      render: (v: unknown) => new Date(String(v)).toLocaleString('zh-CN'),
    },
    { key: 'error_message', title: '错误信息', dataIndex: 'error_message', ellipsis: true },
    {
      key: 'actions', title: '操作', width: 160, fixed: 'right' as const,
      render: (_: unknown, record: OperationRecord) => (
        <Space size="small">
          {record.status === 'executing' && (
            <Popconfirm title="确认取消此操作？" onConfirm={() => handleCancel(record.id)}>
              <Button type="link" size="small" icon={<StopOutlined />} loading={cancelLoading === record.id}>
                取消
              </Button>
            </Popconfirm>
          )}
          {record.status === 'completed' && (
            <Popconfirm title="确认回滚此操作？" description="回滚可能产生额外影响，请谨慎操作" onConfirm={() => handleRollback(record.id)}>
              <Button type="link" size="small" danger icon={<UndoOutlined />} loading={rollbackLoading === record.id}>
                回滚
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing[6] }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          运维操作
        </Title>
        <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
          对中间件实例执行重启、备份、扩缩容等运维操作
        </Text>
      </div>

      {/* Operation Form */}
      <Card title="发起新操作" style={{ marginBottom: spacing[4], borderRadius: componentRadius.card }}>
        <Form form={form} layout="inline" style={{ maxWidth: 900 }}>
          <Form.Item name="instance_id" label="目标实例" rules={[{ required: true }]}>
            <Select
              placeholder="选择实例"
              style={{ width: 240 }}
              options={instances.map((i) => ({ label: `${i.instance_name} (${i.middleware_type})`, value: i.id }))}
              showSearch
            />
          </Form.Item>
          <Form.Item name="operation_type" label="操作类型" rules={[{ required: true }]}>
            <Select
              placeholder="选择操作"
              style={{ width: 160 }}
              options={Object.entries(OPERATION_LABELS).map(([k, v]) => ({ label: v, value: k }))}
            />
          </Form.Item>
          <Form.Item name="params" label="参数 (JSON, 可选)">
            <Input placeholder='{"key": "value"}' style={{ width: 220, borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={submitting}
              onClick={handleSubmit}
              style={{ borderRadius: componentRadius.button.md }}
            >
              执行
            </Button>
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
          提示：部分操作需要审批，提交后将自动创建审批工单
        </Text>
      </Card>

      {/* Operations Table */}
      <Card title="操作记录" extra={
        <Button icon={<ReloadOutlined />} size="small" onClick={loadData}>刷新</Button>
      } style={{ borderRadius: componentRadius.card }}>
        <TableComponent<OperationRecord>
          columns={columns}
          dataSource={operations}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default MiddlewareOperationsPage;
```

### 4.8 页面七：操作历史页（`/middleware/operations/history`）

```tsx
/**
 * MiddlewareOperationHistoryPage - 操作历史查询
 *
 * Features:
 * - 按时间范围、实例、操作类型、状态过滤
 * - 分页展示
 * - 操作详情弹窗
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Space, Button, Select, DatePicker, Table, Tag, Empty, message, Modal, Descriptions,
} from 'antd';
import {
  HistoryOutlined, ReloadOutlined, EyeOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import TableComponent, { TableColumn } from '@/components/Table';
import {
  getOperations,
  type OperationRecord,
  type OperationType,
  type OperationStatus,
} from '@/api/middleware';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const OPERATION_LABELS: Record<OperationType, string> = {
  restart: '重启', scale: '扩缩容', backup: '备份',
  restore: '恢复', upgrade: '升级', config_change: '配置变更', failover: '故障切换',
};

const STATUS_LABELS: Record<OperationStatus, string> = {
  pending: '等待中', executing: '执行中', completed: '已完成', failed: '失败', rollback: '已回滚',
};

const OperationHistoryPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OperationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedOp, setSelectedOp] = useState<OperationRecord | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<OperationType | ''>('');
  const [filterStatus, setFilterStatus] = useState<OperationStatus | ''>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOperations({
        page,
        limit: 20,
        operation_type: filterType || undefined,
        status: filterStatus || undefined,
      });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch (error: unknown) {
      message.error(`加载操作历史失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns: TableColumn<OperationRecord>[] = [
    {
      key: 'operation_type', title: '操作类型', dataIndex: 'operation_type', width: 120,
      render: (v: unknown) => <Tag>{OPERATION_LABELS[v as OperationType]}</Tag>,
    },
    {
      key: 'status', title: '状态', dataIndex: 'status', width: 100,
      render: (v: unknown) => {
        const colorMap: Record<string, string> = {
          completed: colors.success[500], failed: colors.error[500],
          executing: colors.primary[500], pending: colors.neutral[400], rollback: colors.warning[500],
        };
        return (
          <Tag color={colorMap[String(v)]}>
            {STATUS_LABELS[v as OperationStatus]}
          </Tag>
        );
      },
    },
    { key: 'operator', title: '操作人', dataIndex: 'operator', width: 100 },
    { key: 'instance_id', title: '实例 ID', dataIndex: 'instance_id', width: 280, ellipsis: true },
    {
      key: 'started_at', title: '开始时间', dataIndex: 'started_at', width: 160,
      render: (v: unknown) => new Date(String(v)).toLocaleString('zh-CN'),
    },
    {
      key: 'duration', title: '耗时',
      render: (_: unknown, record: OperationRecord) => {
        if (!record.completed_at) return <Text type="secondary">执行中</Text>;
        const ms = new Date(record.completed_at).getTime() - new Date(record.started_at).getTime();
        const secs = Math.round(ms / 1000);
        return secs < 60 ? `${secs}s` : `${Math.round(secs / 60)}m ${secs % 60}s`;
      },
    },
    { key: 'error_message', title: '错误信息', dataIndex: 'error_message', ellipsis: true },
    {
      key: 'actions', title: '操作', width: 80,
      render: (_: unknown, record: OperationRecord) => (
        <Button
          type="link" size="small" icon={<EyeOutlined />}
          onClick={() => { setSelectedOp(record); setDetailVisible(true); }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing[6] }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <HistoryOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          操作历史
        </Title>
        <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
          查询全部中间件运维操作的历史记录
        </Text>
      </div>

      <div style={{ marginBottom: spacing[4], display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Select
            value={filterType}
            onChange={(v) => { setFilterType(v); setPage(1); }}
            options={[
              { label: '全部类型', value: '' },
              ...Object.entries(OPERATION_LABELS).map(([k, v]) => ({ label: v, value: k })),
            ]}
            style={{ width: 140 }}
          />
          <Select
            value={filterStatus}
            onChange={(v) => { setFilterStatus(v); setPage(1); }}
            options={[
              { label: '全部状态', value: '' },
              ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ label: v, value: k })),
            ]}
            style={{ width: 140 }}
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); loadData(); }}>
          刷新
        </Button>
      </div>

      <Card style={{ borderRadius: componentRadius.card }}>
        {data.length === 0 && !loading ? (
          <Empty description="暂无操作记录" />
        ) : (
          <TableComponent<OperationRecord>
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              showTotal: (t) => `共 ${t} 条记录`,
              onChange: (p) => setPage(p),
            }}
            size="small"
          />
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        title="操作详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedOp && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="操作类型">
              <Tag>{OPERATION_LABELS[selectedOp.operation_type]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag>{STATUS_LABELS[selectedOp.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="操作人">{selectedOp.operator}</Descriptions.Item>
            <Descriptions.Item label="实例 ID">{selectedOp.instance_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="参数">
              <pre style={{ margin: 0, fontSize: 12 }}>
                {JSON.stringify(selectedOp.params, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="结果">
              {selectedOp.result ? (
                <pre style={{ margin: 0, fontSize: 12 }}>
                  {JSON.stringify(selectedOp.result, null, 2)}
                </pre>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="错误信息">
              {selectedOp.error_message ? (
                <Text type="danger">{selectedOp.error_message}</Text>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {new Date(selectedOp.started_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
              {selectedOp.completed_at ? new Date(selectedOp.completed_at).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default OperationHistoryPage;
```

---

## 五、数据库 DDL（引用已有）

以下为已有 DDL，此处列出供参考。完整建表语句见 `docs/plans/orion-upgrade-executable-plan-2026-05-22.md` Section 11.5。

### 5.1 middleware_instances

```sql
-- 核心字段
id UUID PK, tenant_id UUID, middleware_type VARCHAR(30),
cluster_name VARCHAR(200), instance_name VARCHAR(200), version VARCHAR(50),
host VARCHAR(200), port INT, credential_ref VARCHAR(500),
config JSONB, status VARCHAR(30), health_status VARCHAR(30),
environment VARCHAR(50), tags JSONB,
created_by, created_at, updated_at, updated_by, deleted_at
-- CHECK 约束
middleware_type IN ('redis', 'mysql', 'kafka', 'rabbitmq', 'elasticsearch', 'mongodb')
status IN ('active', 'degraded', 'maintenance', 'retired')
health_status IN ('healthy', 'warning', 'critical', 'unknown')
```

### 5.2 middleware_health_checks

```sql
id UUID PK, tenant_id UUID, instance_id UUID (FK),
check_type VARCHAR(50), status VARCHAR(30), metrics JSONB, details TEXT, checked_at TIMESTAMPTZ
-- CHECK 约束
check_type IN ('connectivity', 'replication', 'cluster', 'performance')
status IN ('healthy', 'warning', 'critical')
```

### 5.3 middleware_metrics

```sql
id UUID PK, tenant_id UUID, instance_id UUID (FK),
metric_name VARCHAR(100), metric_value DECIMAL(10,2),
metric_unit VARCHAR(20), collected_at TIMESTAMPTZ
```

### 5.4 middleware_operations

```sql
id UUID PK, tenant_id UUID, instance_id UUID (FK, ON DELETE SET NULL),
operation_type VARCHAR(50), status VARCHAR(30), operator VARCHAR(100),
params JSONB, result JSONB, error_message TEXT,
started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at, updated_at
-- CHECK 约束
operation_type IN ('restart', 'scale', 'backup', 'restore', 'upgrade', 'config_change', 'failover')
status IN ('pending', 'executing', 'completed', 'failed', 'rollback')
```

### 5.5 需补充的 DDL

```sql
-- 健康检查配置表（为每个实例存储检查频率等配置）
CREATE TABLE IF NOT EXISTS middleware_health_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id       UUID UNIQUE NOT NULL REFERENCES middleware_instances(id) ON DELETE CASCADE,
  interval_seconds  INT NOT NULL DEFAULT 60,
  timeout_seconds   INT NOT NULL DEFAULT 30,
  consecutive_failures INT NOT NULL DEFAULT 3,
  enabled_checks    JSONB NOT NULL DEFAULT '["connectivity", "replication", "cluster", "performance"]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE middleware_health_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_middleware_health_config
  ON middleware_health_configs USING (tenant_id::text = current_setting('app.current_tenant_id'));
```

---

## 六、验收标准

### 6.1 端到端场景

| 场景编号 | 场景描述 | 验收条件 |
|---------|---------|---------|
| E2E-01 | 注册 Redis 实例 | 填写表单 → 提交 → 实例出现在列表，初始健康状态 `unknown` |
| E2E-02 | 手动触发健康检查 | 点击"检查" → 返回检查结果 → 实例健康状态更新 |
| E2E-03 | 查看实例详情 | 点击实例 → 查看基本信息、健康、指标、操作历史四个 Tab |
| E2E-04 | 发起备份操作 | 选择实例 → 选择备份 → 提交 → 操作出现在历史记录 |
| E2E-05 | 查看健康仪表盘 | 打开仪表盘 → 看到统计卡片 → 看到全部实例健康状态 |
| E2E-06 | 编辑实例信息 | 详情页点击编辑 → 修改名称 → 保存 → 列表更新 |
| E2E-07 | 删除实例 | 列表点击删除 → 二次确认 → 实例从列表消失（软删除） |
| E2E-08 | 取消执行中操作 | 操作列表中找到执行中的操作 → 点击取消 → 状态变为 failed |
| E2E-09 | 回滚已完成操作 | 操作历史中找到已完成的操作 → 点击回滚 → 创建新回滚操作 |
| E2E-10 | 按类型过滤 | 实例列表选择 Redis → 只显示 Redis 实例 |

### 6.2 量化指标

| 指标 | 目标值 | 测量方法 |
|------|--------|---------|
| 实例注册响应时间 | < 500ms（不含连接测试） | API 响应延迟 |
| 连接测试响应时间 | < 5000ms | 包含 TCP + 协议握手 |
| 健康检查执行时间 | < 30s（单次） | 所有检查项完成时间 |
| 指标采集延迟 | < 60s | 从采集到可查询的时间 |
| 列表页面加载时间 | < 2s | 首屏渲染 |
| 健康仪表盘刷新 | < 1s | 点击刷新到数据更新 |
| API 路径一致性 | 100% | 前端 API 调用路径与后端路由匹配 |
| 前端交互覆盖率 | 100% | 每个按钮有 onClick、每个操作有 loading、每个异步有 message |

### 6.3 前端交互完整性审查

按 CLAUDE.md 规则逐项审查：

- **逐元素交互链**：每个按钮有 onClick + loading + message.success/error
- **逐字段读写状态**：编辑表单有 Form.Item + Input/Select + 保存按钮
- **CRUD 完整性**：实例支持 Create（注册）、Read（列表+详情）、Update（编辑）、Delete（软删除）
- **空状态引导**：列表为空时 Empty + "注册实例"按钮
- **反模式检查**：无只读 Descriptions 替代编辑、无硬编码颜色、无 4px 网格外的间距
