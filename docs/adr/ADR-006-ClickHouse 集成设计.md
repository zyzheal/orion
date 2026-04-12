# ADR-006 ClickHouse 集成设计

> 版本：v1.0  
> 创建日期：2026-04-10  
> 状态：草案  
> 负责人：后端团队 + SRE 团队

---

## 一、背景

### 1.1 问题陈述

ADR-003 定义了成本数据采集架构使用 ClickHouse 存储明细数据，但主架构图中未明确体现 ClickHouse 的位置，存在以下设计缺失：

1. **架构定位模糊**：ClickHouse 与 MySQL 的分工不清晰
2. **同步机制未定义**：数据如何从业务系统流入 ClickHouse 未说明
3. **表结构缺失**：缺少详细的表定义和优化策略
4. **运维方案空白**：部署、备份、监控等运维配置未定义

### 1.2 决策目标

完善 ClickHouse 集成设计，明确：
- ClickHouse 在整体架构中的位置和数据流转
- 明细数据存储方案和查询优化
- MySQL ↔ ClickHouse 数据同步机制
- 生产环境运维配置

---

## 二、架构定位

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Orion 平台架构                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│  │  Web 前端     │    │  移动端      │    │  第三方系统   │                 │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                 │
│         │                   │                   │                           │
│         └───────────────────┼───────────────────┘                           │
│                             ▼                                               │
│                    ┌─────────────────┐                                      │
│                    │   API Gateway   │                                      │
│                    └────────┬────────┘                                      │
│                             │                                               │
│         ┌───────────────────┼───────────────────┐                           │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────┐   ┌─────────────────┐   ┌─────────────┐                  │
│  │ 业务服务层   │   │  成本采集服务    │   │  分析服务    │                  │
│  │ (CRUD 操作)  │   │  (Cost Collector)│   │ (Analyzer)  │                  │
│  └──────┬──────┘   └────────┬────────┘   └──────┬──────┘                  │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                        数据存储层                                │       │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │       │
│  │  │   MySQL     │◄──┤   Redis     │   │  ClickHouse │           │       │
│  │  │  (主库)     │   │   (缓存)    │   │  (分析库)   │           │       │
│  │  │             │   │             │   │             │           │       │
│  │  │ • 用户/权限  │   │ • 热点数据   │   │ • 成本明细   │           │       │
│  │  │ • 订单/交易  │   │ • Session   │   │ • 用量记录   │           │       │
│  │  │ • 配置数据   │   │ • 分布式锁   │   │ • 聚合指标   │           │       │
│  │  │ • 汇总数据   │   │             │   │ • 历史趋势   │           │       │
│  │  └──────┬──────┘   └─────────────┘   └──────┬──────┘           │       │
│  │         │                                   │                   │       │
│  │         └──────────────►◄───────────────────┘                   │       │
│  │                   数据同步层 (CDC/ETL)                          │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流转路径

```
┌──────────────────────────────────────────────────────────────────┐
│                       数据流转流程图                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  数据源层                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │   K8s   │  │  AWS   │  ┤  Azure  │  │  CMDB   │            │
│  │ Metrics │  │ 账单 API │  │ 账单 API │  │ 资产库   │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │           │           │           │                     │
│       └───────────┴─────┬─────┴───────────┘                     │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           成本采集服务 (Cost Collector)                  │   │
│  │  • 每 5 分钟采集资源用量                                    │   │
│  │  • 每小时同步云厂商账单                                    │   │
│  │  • 数据清洗和标签关联                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    数据写入                              │   │
│  │  ┌─────────────────┐         ┌─────────────────┐       │   │
│  │  │    MySQL        │         │   ClickHouse    │       │   │
│  │  │  (事务写入)     │────────►│   (批量写入)    │       │   │
│  │  │                 │  异步同步│                 │       │   │
│  │  │ • 每日汇总       │         │ • 分钟级明细     │       │   │
│  │  │ • 预算数据       │         │ • 资源用量记录   │       │   │
│  │  │ • 配置数据       │         │ • 原始账单数据   │       │   │
│  │  └─────────────────┘         └─────────────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 MySQL vs ClickHouse 分工

| 维度 | MySQL | ClickHouse |
|------|-------|------------|
| **定位** | OLTP 主库 | OLAP 分析库 |
| **数据时效** | 实时 | 近实时（秒级延迟）|
| **写入模式** | 单行/小批量事务写入 | 大批量顺序写入 |
| **查询模式** | 点查、小范围查询 | 大范围扫描、聚合查询 |
| **存储内容** | 业务数据、配置、汇总结果 | 原始明细、历史数据 |
| **保留周期** | 永久 | 1 年（可配置）|
| **一致性** | 强一致 | 最终一致 |

---

## 三、表结构设计

### 3.1 成本明细表

```sql
-- 资源用量明细表（分钟级）
CREATE TABLE orion_cost.resource_usage_minute
(
    -- 时间维度
    time                DateTime64(3) DEFAULT now(),
    date                Date DEFAULT toDate(time),
    hour                UInt8 DEFAULT toHour(time),
    
    -- 归属维度
    team_id             String,
    team_name           String,
    project_id          String,
    project_name        String,
    environment         LowCardinality(String),  -- dev/staging/prod
    namespace           String,
    
    -- 资源维度
    resource_id         String,                  -- Pod ID/实例 ID
    resource_type       LowCardinality(String),  -- pod/vm/container
    resource_name       String,
    cloud_provider      LowCardinality(String),  -- aws/azure/gcp/internal
    region              LowCardinality(String),
    availability_zone   LowCardinality(String),
    instance_type       String,
    
    -- 用量指标
    cpu_request         Float64 DEFAULT 0,       -- CPU 请求（核）
    cpu_limit           Float64 DEFAULT 0,       -- CPU 限制（核）
    cpu_usage           Float64 DEFAULT 0,       -- CPU 实际使用（核）
    memory_request      Float64 DEFAULT 0,       -- 内存请求（GB）
    memory_limit        Float64 DEFAULT 0,       -- 内存限制（GB）
    memory_usage        Float64 DEFAULT 0,       -- 内存实际使用（GB）
    storage_used        Float64 DEFAULT 0,       -- 存储使用（GB）
    network_in          Float64 DEFAULT 0,       -- 入站流量（GB）
    network_out         Float64 DEFAULT 0,       -- 出站流量（GB）
    gpu_count           UInt8 DEFAULT 0,         -- GPU 数量
    gpu_usage           Float32 DEFAULT 0,       -- GPU 使用率
    
    -- 成本指标
    cpu_cost            Float64 DEFAULT 0,       -- CPU 成本（USD）
    memory_cost         Float64 DEFAULT 0,       -- 内存成本（USD）
    storage_cost        Float64 DEFAULT 0,       -- 存储成本（USD）
    network_cost        Float64 DEFAULT 0,       -- 网络成本（USD）
    gpu_cost            Float64 DEFAULT 0,       -- GPU 成本（USD）
    total_cost          Float64 DEFAULT 0,       -- 总成本（USD）
    
    -- 标签
    labels              Map(String, String),
    
    -- 元数据
    created_at          DateTime64(3) DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (time, team_id, project_id, environment, resource_type, resource_id)
TTL date + INTERVAL 1 YEAR
SETTINGS 
    index_granularity = 8192,
    max_parts_per_block = 100,
    ttl_only_drop_parts = 1;

-- 添加跳数索引（加速筛选查询）
ALTER TABLE orion_cost.resource_usage_minute 
ADD INDEX idx_team_id team_id TYPE bloom_filter GRANULARITY 4;

ALTER TABLE orion_cost.resource_usage_minute 
ADD INDEX idx_project_id project_id TYPE bloom_filter GRANULARITY 4;

ALTER TABLE orion_cost.resource_usage_minute 
ADD INDEX idx_environment environment TYPE set(20) GRANULARITY 4;
```

### 3.2 指标聚合表

```sql
-- 小时级聚合表
CREATE TABLE orion_cost.resource_usage_hourly
(
    hour_time           DateTime64(3),
    date                Date,
    
    -- 聚合维度
    team_id             String,
    team_name           String,
    project_id          String,
    environment         LowCardinality(String),
    resource_type       LowCardinality(String),
    cloud_provider      LowCardinality(String),
    region              LowCardinality(String),
    
    -- 用量汇总
    cpu_total           Float64,                 -- CPU 总用量（核时）
    memory_total        Float64,                 -- 内存总用量（GB 时）
    storage_total       Float64,                 -- 存储总用量（GB）
    network_total       Float64,                 -- 网络总流量（GB）
    
    -- 用量统计
    cpu_avg             Float64,                 -- CPU 平均使用率
    cpu_max             Float64,                 -- CPU 峰值使用率
    memory_avg          Float64,                 -- 内存平均使用率
    memory_max          Float64,                 -- 内存峰值使用率
    
    -- 成本汇总
    total_cost          Float64,                 -- 总成本（USD）
    cpu_cost            Float64,
    memory_cost         Float64,
    storage_cost        Float64,
    network_cost        Float64,
    
    -- 记录数（用于数据校验）
    record_count        UInt64
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (hour_time, team_id, project_id, environment, resource_type)
TTL date + INTERVAL 1 YEAR;

-- 日级聚合表
CREATE TABLE orion_cost.resource_usage_daily
(
    date                Date,
    
    -- 聚合维度
    team_id             String,
    team_name           String,
    project_id          String,
    environment         LowCardinality(String),
    resource_type       LowCardinality(String),
    cloud_provider      LowCardinality(String),
    region              LowCardinality(String),
    
    -- 用量汇总
    cpu_total           Float64,
    memory_total        Float64,
    storage_total       Float64,
    network_total       Float64,
    
    -- 用量统计
    cpu_avg             Float64,
    cpu_max             Float64,
    cpu_p95             Float64,
    memory_avg          Float64,
    memory_max          Float64,
    memory_p95          Float64,
    
    -- 成本汇总
    total_cost          Float64,
    cpu_cost            Float64,
    memory_cost         Float64,
    storage_cost        Float64,
    network_cost        Float64,
    
    -- 记录数
    record_count        UInt64
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, team_id, project_id, environment, resource_type)
TTL date + INTERVAL 2 YEAR;
```

### 3.3 物化视图

```sql
-- 小时级聚合物化视图
CREATE MATERIALIZED VIEW orion_cost.mv_usage_hourly
TO orion_cost.resource_usage_hourly
AS SELECT
    toStartOfHour(time) AS hour_time,
    toDate(time) AS date,
    team_id,
    any(team_name) AS team_name,
    project_id,
    environment,
    resource_type,
    cloud_provider,
    region,
    
    -- 用量汇总
    sum(cpu_usage) * 60 AS cpu_total,           -- 核时 = 核 × 分钟
    sum(memory_usage) * 60 AS memory_total,     -- GB 时
    avg(storage_used) AS storage_total,
    sum(network_in + network_out) AS network_total,
    
    -- 用量统计
    avg(cpu_usage / cpu_limit) AS cpu_avg,
    max(cpu_usage / cpu_limit) AS cpu_max,
    avg(memory_usage / memory_limit) AS memory_avg,
    max(memory_usage / memory_limit) AS memory_max,
    
    -- 成本汇总
    sum(cpu_cost) AS cpu_cost,
    sum(memory_cost) AS memory_cost,
    sum(storage_cost) AS storage_cost,
    sum(network_cost) AS network_cost,
    sum(total_cost) AS total_cost,
    
    -- 记录数
    count() AS record_count

FROM orion_cost.resource_usage_minute
GROUP BY
    hour_time, date, team_id, project_id, 
    environment, resource_type, cloud_provider, region;

-- 日级聚合物化视图
CREATE MATERIALIZED VIEW orion_cost.mv_usage_daily
TO orion_cost.resource_usage_daily
AS SELECT
    toDate(hour_time) AS date,
    team_id,
    any(team_name) AS team_name,
    project_id,
    environment,
    resource_type,
    cloud_provider,
    region,
    
    -- 用量汇总
    sum(cpu_total) AS cpu_total,
    sum(memory_total) AS memory_total,
    sum(storage_total) AS storage_total,
    sum(network_total) AS network_total,
    
    -- 用量统计
    avg(cpu_avg) AS cpu_avg,
    max(cpu_max) AS cpu_max,
    quantileExact(0.95)(cpu_avg) AS cpu_p95,
    avg(memory_avg) AS memory_avg,
    max(memory_max) AS memory_max,
    quantileExact(0.95)(memory_avg) AS memory_p95,
    
    -- 成本汇总
    sum(cpu_cost) AS cpu_cost,
    sum(memory_cost) AS memory_cost,
    sum(storage_cost) AS storage_cost,
    sum(network_cost) AS network_cost,
    sum(total_cost) AS total_cost,
    
    -- 记录数
    sum(record_count) AS record_count

FROM orion_cost.resource_usage_hourly
GROUP BY
    date, team_id, project_id, 
    environment, resource_type, cloud_provider, region;
```

---

## 四、数据同步方案

### 4.1 同步架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      数据同步架构                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐                                               │
│  │   MySQL     │  主库（业务数据）                               │
│  │  binlog     │                                               │
│  └──────┬──────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              CDC 捕获层                                   │   │
│  │  ┌─────────────────┐  ┌─────────────────┐              │   │
│  │  │   Debezium      │  │   MySQL CDC     │              │   │
│  │  │   (Connector)   │  │   (Binlog)      │              │   │
│  │  └────────┬────────┘  └────────┬────────┘              │   │
│  │           │                    │                        │   │
│  │           └──────────┬─────────┘                        │   │
│  │                      ▼                                   │   │
│  │           ┌──────────────────┐                          │   │
│  │           │    Kafka         │  消息缓冲                  │   │
│  │           │  (cdc.events)    │                          │   │
│  │           └────────┬─────────┘                          │   │
│  └────────────────────│────────────────────────────────────┘   │
│                       │                                         │
│                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              数据转换层                                   │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │              ETL Processor                       │   │   │
│  │  │  • 数据清洗（去除无效数据）                       │   │   │
│  │  │  • 格式转换（MySQL → ClickHouse 类型）            │   │   │
│  │  │  • 标签关联（team/project 信息）                  │   │   │
│  │  │  • 成本计算（用量 × 单价）                        │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                       │                                         │
│                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ClickHouse Writer                          │   │
│  │  • 批量写入（每批次 1000-5000 条）                         │   │
│  │  • 乱序处理（按时间排序）                                 │   │
│  │  • 失败重试（指数退避）                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                       │                                         │
│                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │   ClickHouse                                            │   │
│  │   • resource_usage_minute (明细表)                      │   │
│  │   • resource_usage_hourly (小时聚合)                     │   │
│  │   • resource_usage_daily (日聚合)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 同步配置

#### 4.2.1 Debezium MySQL Connector

```json
{
  "name": "orion-mysql-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "mysql.orion.svc.cluster.local",
    "database.port": "3306",
    "database.user": "cdc_reader",
    "database.password": "${CDC_PASSWORD}",
    "database.server.id": "184054",
    "database.server.name": "orion",
    "database.include.list": "orion_public",
    "table.include.list": "orion_public.resource_rates,orion_public.teams,orion_public.projects",
    "binlog.enabled": true,
    "snapshot.mode": "when_needed",
    "snapshot.locking.mode": "minimal",
    
    "topic.prefix": "orion.cdc",
    "schema.history.internal.kafka.bootstrap.servers": "kafka:9092",
    "schema.history.internal.kafka.topic": "schema-changes.orion",
    
    "transforms": "unwrap,extractKey",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.extractKey.type": "org.apache.kafka.connect.transforms.ExtractField$Key",
    "transforms.extractKey.field": "id",
    
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": false,
    "value.converter.schemas.enable": false
  }
}
```

#### 4.2.2 ETL Processor 配置

```yaml
# config/etl-processor.yaml
processor:
  name: orion-cost-etl
  
  source:
    kafka:
      bootstrap_servers: kafka:9092
      consumer_group: orion-cost-etl-group
      topics:
        - orion.cdc.orion_public.resource_rates
        - orion.cdc.orion_public.teams
        - orion.cdc.orion_public.projects
      auto_offset_reset: earliest
      max_poll_records: 1000
      
  sink:
    clickhouse:
      hosts:
        - clickhouse-server:8123
      database: orion_cost
      user: etl_writer
      password: "${CH_PASSWORD}"
      
      # 写入配置
      write:
        batch_size: 2000
        batch_timeout_ms: 5000
        max_retries: 3
        retry_backoff_ms: 1000
        
      # 目标表映射
      tables:
        - source: resource_rates
          target: resource_rates_dict
          mode: dictionary
        
        - source: teams
          target: teams_dict
          mode: dictionary
          
  transform:
    # 数据清洗规则
    filters:
      - field: status
        operator: equals
        value: active
        
    # 字段映射
    mappings:
      - source: id
        target: team_id
        
    # 计算规则
    calculations:
      - field: total_cost
        formula: "cpu_usage * cpu_rate + memory_usage * memory_rate"
        
  monitoring:
    metrics_enabled: true
    metrics_port: 9090
    health_check_port: 8080
```

### 4.3 同步频率与延迟

| 数据流 | 同步方式 | 频率 | 预期延迟 | SLA |
|--------|---------|------|---------|-----|
| K8s Metrics → ClickHouse | 直接写入 | 5 分钟 | < 30 秒 | 99.9% |
| 云厂商 API → ClickHouse | 直接写入 | 1 小时 | < 5 分钟 | 99.5% |
| MySQL 配置 → ClickHouse | CDC + ETL | 实时 | < 10 秒 | 99.9% |
| 明细 → 小时聚合 | 物化视图 | 自动 | < 1 分钟 | 99.99% |
| 小时 → 日聚合 | 物化视图 | 自动 | < 5 分钟 | 99.99% |

### 4.4 数据一致性校验

```sql
-- 校验脚本：对比 MySQL 汇总与 ClickHouse 聚合结果

-- MySQL 端查询（日汇总）
SELECT 
    DATE(usage_time) as date,
    team_id,
    SUM(total_cost) as mysql_total
FROM orion_public.cost_daily_summary
WHERE date = '2026-04-09'
GROUP BY date, team_id;

-- ClickHouse 端查询（日聚合）
SELECT 
    date,
    team_id,
    sum(total_cost) as ch_total
FROM orion_cost.resource_usage_daily
WHERE date = '2026-04-09'
GROUP BY date, team_id;

-- 差异阈值：5%
-- 告警：|mysql_total - ch_total| / mysql_total > 0.05
```

```python
# consistency_checker.py
import asyncio
from datetime import datetime, timedelta

class ConsistencyChecker:
    async def check_daily_consistency(self, date: str) -> ConsistencyReport:
        """校验每日数据一致性"""
        mysql_result = await self.mysql.query(
            "SELECT team_id, SUM(total_cost) as total FROM cost_daily_summary WHERE date = %s GROUP BY team_id",
            [date]
        )
        
        ch_result = await self.clickhouse.query(
            "SELECT team_id, sum(total_cost) as total FROM resource_usage_daily WHERE date = %s GROUP BY team_id",
            [date]
        )
        
        report = ConsistencyReport(date=date)
        
        for mysql_row in mysql_result:
            team_id = mysql_row['team_id']
            ch_row = next((r for r in ch_result if r['team_id'] == team_id), None)
            
            if ch_row:
                diff_pct = abs(mysql_row['total'] - ch_row['total']) / mysql_row['total']
                if diff_pct > 0.05:
                    report.add_discrepancy(team_id, mysql_row['total'], ch_row['total'], diff_pct)
        
        return report
```

---

## 五、查询优化

### 5.1 典型查询场景

#### 场景 1：团队月度成本趋势

```sql
SELECT 
    date,
    team_name,
    sum(total_cost) as daily_cost,
    sum(total_cost) OVER (PARTITION BY team_id ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as cost_7d_ma
FROM orion_cost.resource_usage_daily
WHERE 
    team_id = 'team-abc123'
    AND date >= '2026-04-01'
    AND date < '2026-05-01'
GROUP BY date, team_id, team_name
ORDER BY date;
```

#### 场景 2：项目成本 TOP10

```sql
SELECT 
    project_id,
    project_name,
    environment,
    sum(total_cost) as total,
    sum(cpu_cost) as cpu_cost,
    sum(memory_cost) as memory_cost,
    sum(storage_cost) as storage_cost
FROM orion_cost.resource_usage_daily
WHERE 
    team_id = 'team-abc123'
    AND date >= addMonths(toDate('2026-04-10'), -1)
GROUP BY project_id, project_name, environment
ORDER BY total DESC
LIMIT 10;
```

#### 场景 3：成本异常检测

```sql
WITH daily_stats AS (
    SELECT 
        date,
        team_id,
        sum(total_cost) as daily_cost,
        avg(sum(total_cost)) OVER (
            PARTITION BY team_id 
            ORDER BY date 
            ROWS BETWEEN 29 PRECEDING AND 1 PRECEDING
        ) as avg_cost_30d,
        stddev(sum(total_cost)) OVER (
            PARTITION BY team_id 
            ORDER BY date 
            ROWS BETWEEN 29 PRECEDING AND 1 PRECEDING
        ) as stddev_cost_30d
    FROM orion_cost.resource_usage_daily
    WHERE date >= addMonths(toDate('2026-04-10'), -2)
    GROUP BY date, team_id
)
SELECT 
    date,
    team_id,
    daily_cost,
    avg_cost_30d,
    (daily_cost - avg_cost_30d) / stddev_cost_30d as z_score
FROM daily_stats
WHERE 
    date >= addDays(toDate('2026-04-10'), -7)
    AND (daily_cost - avg_cost_30d) / stddev_cost_30d > 3  -- 超过 3 个标准差
ORDER BY z_score DESC;
```

#### 场景 4：资源利用率分析

```sql
SELECT 
    team_name,
    project_name,
    environment,
    resource_type,
    
    -- CPU 利用率
    avg(cpu_avg) as cpu_avg_util,
    max(cpu_max) as cpu_peak_util,
    avg(cpu_avg) / avg(cpu_limit) as cpu_efficiency,
    
    -- 内存利用率
    avg(memory_avg) as memory_avg_util,
    max(memory_max) as memory_peak_util,
    
    -- 成本
    sum(total_cost) as total_cost,
    
    -- 浪费估算（请求 - 实际使用）
    sum((cpu_limit - cpu_avg) * cpu_cost) as cpu_waste_cost,
    sum((memory_limit - memory_avg) * memory_cost) as memory_waste_cost
    
FROM orion_cost.resource_usage_hourly
WHERE 
    date >= addDays(toDate('2026-04-10'), -7)
    AND environment = 'prod'
GROUP BY team_name, project_name, environment, resource_type
HAVING total_cost > 0
ORDER BY (cpu_waste_cost + memory_waste_cost) DESC
LIMIT 20;
```

### 5.2 查询性能优化建议

| 优化项 | 配置 | 说明 |
|--------|------|------|
| 使用投影 | `CREATE PROJECTION` | 预排序常用查询维度 |
| 缓存结果 | `max_query_cache_size` | 设置查询缓存（默认 0，建议 1GB）|
| 并行查询 | `max_threads` | 根据 CPU 核心数设置 |
| 压缩 | `compression` | 启用 lz4 或 zstd 压缩 |
| 预读取 | `max_read_buffer_size` | 增加预读取缓冲区 |

---

## 六、运维配置

### 6.1 ClickHouse 集群部署

```yaml
# deploy/clickhouse-cluster.yaml
apiVersion: "clickhouse-keeper.com/v1"
kind: "ClickHouseCluster"
metadata:
  name: orion-clickhouse
  namespace: orion-infra
spec:
  version: "24.3"
  
  configuration:
    users:
      default/password: "${CH_DEFAULT_PASSWORD}"
      etl_writer/password: "${CH_ETL_PASSWORD}"
      analyst/password: "${CH_ANALYST_PASSWORD}"
      
      default/networks:
        - "10.0.0.0/8"
      etl_writer/networks:
        - "10.0.0.0/8"
      analyst/networks:
        - "10.0.0.0/8"
        
      default/profile: "default"
      default/quota: "default"
      
    profiles:
      default/max_memory_usage: "16000000000"  # 16GB
      default/max_execution_time: "300"
      default/max_threads: "8"
      default/max_query_cache_size: "1073741824"  # 1GB
      
    quotas:
      default/interval/1h/queries: "1000"
      default/interval/1h/query_rows: "10000000"
      
    settings:
      logger/level: "information"
      logger/log: "/var/log/clickhouse-server/clickhouse-server.log"
      logger/errorlog: "/var/log/clickhouse-server/clickhouse-server.err.log"
      
      http_port: "8123"
      tcp_port: "9000"
      
      max_concurrent_queries: "100"
      uncompressed_cache_size: "8589934592"  # 8GB
      mark_cache_size: "5368709120"  # 5GB
      
  cluster:
    layout:
      shardsCount: 2
      replicasCount: 2
      
  templates:
    volumeClaimTemplates:
      - name: data
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 500Gi
          storageClassName: "ssd-premium"
          
    podTemplates:
      - name: clickhouse-server
        spec:
          containers:
            - name: clickhouse-server
              image: clickhouse/clickhouse-server:24.3
              resources:
                requests:
                  cpu: "2000m"
                  memory: "8Gi"
                limits:
                  cpu: "4000m"
                  memory: "16Gi"
              volumeMounts:
                - name: data
                  mountPath: /var/lib/clickhouse
```

### 6.2 备份恢复策略

```yaml
# config/backup-config.yaml
backup:
  enabled: true
  
  # 备份工具
  tool: clickhouse-backup
  
  # 存储后端
  storage:
    type: s3
    bucket: orion-clickhouse-backups
    region: ap-northeast-1
    path: /daily-backups
    credentials:
      access_key: "${AWS_ACCESS_KEY}"
      secret_key: "${AWS_SECRET_KEY}"
  
  # 全量备份
  full:
    schedule: "0 2 * * *"  # 每天凌晨 2 点
    retention_days: 30
    
  # 增量备份
  incremental:
    schedule: "0 */6 * * *"  # 每 6 小时
    retention_days: 7
    
  # 备份表
  tables:
    include:
      - "orion_cost.*"
    exclude:
      - "orion_cost.sys_*"
  
  # 恢复测试
  test_restore:
    enabled: true
    schedule: "0 4 * * 0"  # 每周日凌晨 4 点
    database: backup_test

# 恢复命令示例
# clickhouse-backup create daily_20260410
# clickhouse-backup upload daily_20260410
# clickhouse-backup download daily_20260410
# clickhouse-backup restore daily_20260410
```

### 6.3 监控指标

```yaml
# prometheus/clickhouse-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: clickhouse-alerts
  namespace: orion-infra
spec:
  groups:
    - name: clickhouse
      rules:
        # 服务可用性
        - alert: ClickHouseDown
          expr: up{job="clickhouse"} == 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "ClickHouse 实例 {{ $labels.instance }} 宕机"
            
        # 查询延迟
        - alert: ClickHouseSlowQueries
          expr: |
            histogram_quantile(0.99, 
              rate(clickhouse_query_duration_seconds_bucket[5m])
            ) > 10
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "ClickHouse P99 查询延迟超过 10 秒"
            
        # 磁盘使用率
        - alert: ClickHouseDiskUsage
          expr: |
            clickhouse_disk_usage_bytes / clickhouse_disk_total_bytes > 0.85
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "ClickHouse 磁盘使用率超过 85%"
            
        # 磁盘使用率（严重）
        - alert: ClickHouseDiskCritical
          expr: |
            clickhouse_disk_usage_bytes / clickhouse_disk_total_bytes > 0.95
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "ClickHouse 磁盘使用率超过 95%"
            
        # 内存使用率
        - alert: ClickHouseMemoryUsage
          expr: |
            clickhouse_memory_usage_bytes / clickhouse_memory_limit_bytes > 0.9
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "ClickHouse 内存使用率超过 90%"
            
        # 副本延迟
        - alert: ClickHouseReplicationLag
          expr: clickhouse_replication_delay_seconds > 60
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "ClickHouse 副本延迟超过 60 秒"
            
        # 写入失败
        - alert: ClickHouseWriteErrors
          expr: |
            rate(clickhouse_inserted_rows_total[5m]) == 0
            AND
            rate(clickhouse_inserted_bytes_total[5m]) == 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "ClickHouse 写入停滞"
            
        # 查询失败率
        - alert: ClickHouseQueryErrors
          expr: |
            rate(clickhouse_failed_queries_total[5m]) 
            / 
            rate(clickhouse_queries_total[5m]) > 0.01
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "ClickHouse 查询失败率超过 1%"
```

```yaml
# grafana/clickhouse-dashboard.json (关键指标)
{
  "dashboard": {
    "title": "ClickHouse 监控",
    "panels": [
      {
        "title": "QPS",
        "targets": [{"expr": "rate(clickhouse_queries_total[1m])"}]
      },
      {
        "title": "P99 延迟",
        "targets": [{
          "expr": "histogram_quantile(0.99, rate(clickhouse_query_duration_seconds_bucket[5m]))"
        }]
      },
      {
        "title": "磁盘使用量",
        "targets": [{"expr": "clickhouse_disk_usage_bytes"}]
      },
      {
        "title": "内存使用量",
        "targets": [{"expr": "clickhouse_memory_usage_bytes"}]
      },
      {
        "title": "活跃连接数",
        "targets": [{"expr": "clickhouse_connections"}]
      },
      {
        "title": "队列深度",
        "targets": [{"expr": "clickhouse_background_pool_tasks"}]
      },
      {
        "title": "复制延迟",
        "targets": [{"expr": "clickhouse_replication_delay_seconds"}]
      }
    ]
  }
}
```

---

## 七、总结

本设计文档完善了 ClickHouse 在 Orion 成本管理平台中的集成方案：

1. **架构定位**：ClickHouse 作为 OLAP 分析库，与 MySQL 形成互补
2. **表结构**：分钟级明细表 + 小时/日级聚合表 + 物化视图
3. **同步方案**：CDC + ETL 实现准实时数据同步，延迟 < 10 秒
4. **查询优化**：针对典型场景提供 SQL 示例和索引策略
5. **运维配置**：包含集群部署、备份恢复、监控告警完整方案

---

_文档版本：v1.0_  
_创建日期：2026-04-10_  
_状态：草案_
