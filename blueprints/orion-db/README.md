# Orion Database Infrastructure

Orion 平台数据库基础架构，包含 PostgreSQL 集群、Redis 缓存层、多租户隔离和分片表设计。

## 目录结构

```
orion-db/
├── docker/
│   ├── postgres/
│   │   ├── docker-compose.yml       # PostgreSQL + Patroni + Etcd + PgBouncer
│   │   ├── config/
│   │   │   └── patroni.yml          # Patroni 配置
│   │   └── init/
│   │       ├── 001-init.sql         # 数据库初始化
│   │       └── 002-initial-data.sql # 初始数据
│   └── redis/
│       ├── docker-compose.yml       # Redis Master-Slave-Sentinel
│       └── config/
│           ├── redis-master.conf
│           ├── redis-replica.conf
│           └── sentinel.conf
├── schema/
│   ├── 001-base-schema.sql          # 基础表结构
│   ├── 002-rls-policies.sql         # 行级安全策略
│   ├── 003-partition-tables.sql     # 分片表设计
│   └── 004-indexes.sql              # 索引设计
├── migrations/                       # 数据库迁移文件
├── src/
│   ├── index.js                     # 数据库客户端工具
│   ├── test-rls.js                  # RLS 测试
│   ├── test-redis.js                # Redis 测试
│   └── test-partitions.js           # 分区表测试
├── package.json
├── .env.example
└── README.md
```

## 快速开始

### 1. 启动 PostgreSQL 集群

```bash
cd docker/postgres
docker-compose up -d
```

等待所有服务启动：
- 3 个 Etcd 节点（分布式键值存储）
- 3 个 PostgreSQL 节点（1 主 2 从，Patroni 管理）
- 1 个 PgBouncer（连接池）

### 2. 启动 Redis 集群

```bash
cd docker/redis
docker-compose up -d
```

等待所有服务启动：
- 1 个 Redis Master
- 2 个 Redis Replica
- 3 个 Redis Sentinel（高可用）

### 3. 验证服务状态

```bash
# 检查 PostgreSQL 集群状态
docker-compose -f docker/postgres/docker-compose.yml ps

# 检查 Redis 集群状态
docker-compose -f docker/redis/docker-compose.yml ps

# 查看 Patroni 集群状态
docker exec orion-patroni-master patronictl -c /etc/patroni/patroni.yml list

# 查看 Redis 主从状态
docker exec orion-redis-master redis-cli -a redis_password info replication
```

### 4. 初始化数据库 Schema

```bash
# 连接到 PostgreSQL
docker exec -it orion-patroni-master psql -U postgres -d orion_tenant_db

# 执行 Schema 脚本
\i /docker-entrypoint-initdb.d/001-base-schema.sql
\i /docker-entrypoint-initdb.d/002-rls-policies.sql
\i /docker-entrypoint-initdb.d/003-partition-tables.sql
\i /docker-entrypoint-initdb.d/004-indexes.sql
```

或者从主机执行：

```bash
# 复制 SQL 文件到容器
docker cp schema/001-base-schema.sql orion-patroni-master:/tmp/
docker cp schema/002-rls-policies.sql orion-patroni-master:/tmp/
docker cp schema/003-partition-tables.sql orion-patroni-master:/tmp/
docker cp schema/004-indexes.sql orion-patroni-master:/tmp/

# 执行
docker exec -it orion-patroni-master psql -U postgres -d orion_tenant_db -f /tmp/001-base-schema.sql
docker exec -it orion-patroni-master psql -U postgres -d orion_tenant_db -f /tmp/002-rls-policies.sql
docker exec -it orion-patroni-master psql -U postgres -d orion_tenant_db -f /tmp/003-partition-tables.sql
docker exec -it orion-patroni-master psql -U postgres -d orion_tenant_db -f /tmp/004-indexes.sql
```

### 5. 安装 Node.js 依赖并运行测试

```bash
npm install

# 运行所有测试
npm run test:all

# 单独测试
npm run test:rls         # RLS 租户隔离测试
npm run test:redis       # Redis 缓存层测试
npm run test:partitions  # 分区表测试
```

## 连接信息

### PostgreSQL

| 组件 | 主机 | 端口 | 用户 | 密码 |
|------|------|------|------|------|
| 主库（写） | localhost | 5432 | postgres | postgres_password |
| 从库 1（读） | localhost | 5433 | postgres | postgres_password |
| 从库 2（读） | localhost | 5434 | postgres | postgres_password |
| PgBouncer（连接池） | localhost | 6432 | orion_app | orion_app_password |

### Redis

| 组件 | 主机 | 端口 | 密码 |
|------|------|------|------|
| Master | localhost | 6379 | redis_password |
| Replica 1 | localhost | 6380 | redis_password |
| Replica 2 | localhost | 6381 | redis_password |
| Sentinel 1 | localhost | 26379 | redis_password |
| Sentinel 2 | localhost | 26380 | redis_password |
| Sentinel 3 | localhost | 26381 | redis_password |

## 验证测试

### 1. PostgreSQL 集群验证

```bash
# 验证主从复制
docker exec orion-patroni-master psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# 验证故障切换（手动）
docker stop orion-patroni-master
# 等待 10 秒，检查新的主库选举
docker exec orion-patroni-replica1 patronictl -c /etc/patroni/patroni.yml list
```

### 2. RLS 策略验证

```bash
# 测试租户 1
docker exec -it orion-patroni-master psql -U orion_app -d orion_tenant_db -c "
SET app.current_tenant_id = '1';
SELECT count(*) FROM core.users;
"

# 测试租户 2
docker exec -it orion-patroni-master psql -U orion_app -d orion_tenant_db -c "
SET app.current_tenant_id = '2';
SELECT count(*) FROM core.users;
"
```

### 3. 分区表验证

```bash
# 查看分区列表
docker exec -it orion-patroni-master psql -U orion_app -d orion_tenant_db -c "
SELECT
  parent.relname AS parent_table,
  child.relname AS partition_name
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'audit_logs_partitioned'
ORDER BY child.relname;
"
```

### 4. Redis 验证

```bash
# 测试 Redis 写入
docker exec orion-redis-master redis-cli -a redis_password set test_key "hello"

# 测试 Redis 读取
docker exec orion-redis-master redis-cli -a redis_password get test_key

# 测试 Sentinel 故障检测
docker exec orion-redis-sentinel1 redis-cli -p 26379 sentinel master mymaster
```

## 技术细节

### PostgreSQL 高可用架构

- **Patroni**: 高可用管理，自动故障切换
- **Etcd**: 分布式键值存储， consensus
- **PgBouncer**: 连接池，支持事务池模式

### Redis 高可用架构

- **Master-Slave**: 一主两从，异步复制
- **Sentinel**: 三节点哨兵，自动故障转移

### 多租户隔离

采用单 Database + Schema + RLS（行级安全）方案：

- **Schema 隔离**: 不同业务模块使用不同 Schema（core, cmdb, cicd, gitops, ai, audit）
- **RLS 隔离**: 基于 tenant_id 的行级安全策略
- **上下文传递**: 通过 `SET app.current_tenant_id` 设置租户上下文

### 分片表设计

| 表名 | 分片键 | 分片方法 | 保留期 |
|------|--------|----------|--------|
| audit_logs | create_time | 按月分区 | 12 个月 |
| event_logs | create_time | 按月分区 | 12 个月 |
| pipeline_runs | create_time | 按月分区 | 12 个月 |
| deployment_history | create_time | 按月分区 | 12 个月 |
| user_activity | create_time | 按月分区 | 12 个月 |

### 缓存键命名规范

```
格式：orion:{模块}:{资源}:{ID}

示例:
- orion:user:{userId}           # 用户信息
- orion:session:{sessionId}     # 会话信息
- orion:team:{teamId}           # 团队信息
- orion:pl:{plId}               # 产品线信息
- orion:pipeline:{pipelineId}   # 流水线信息
- orion:run:{runId}             # 运行记录
- orion:k8s:cluster:{clusterId} # K8s 集群
- orion:lock:{resource}         # 分布式锁
```

### 缓存过期策略

| 级别 | 时间 | 适用场景 |
|------|------|----------|
| SHORT | 5 分钟 | 频繁变更数据、临时缓存 |
| MEDIUM | 30 分钟 | 一般业务数据 |
| LONG | 2 小时 | 配置类数据、热点数据 |
| PERMANENT | 7 天 | 极少变更数据 |

## 运维命令

### PostgreSQL 维护

```bash
# 查看连接数
docker exec orion-patroni-master psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# 查看慢查询
docker exec orion-patroni-master psql -U postgres -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# 查看表大小
docker exec orion-patroni-master psql -U postgres -d orion_tenant_db -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname IN ('core', 'cmdb', 'cicd', 'audit')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### Redis 维护

```bash
# 查看内存使用
docker exec orion-redis-master redis-cli -a redis_password info memory

# 查看键空间
docker exec orion-redis-master redis-cli -a redis_password info keyspace

# 慢查询日志
docker exec orion-redis-master redis-cli -a redis_password slowlog get 10
```

## 故障处理

### PostgreSQL 主库故障

```bash
# 1. 停止主库
docker stop orion-patroni-master

# 2. 查看集群状态（应已自动选举新主）
docker exec orion-patroni-replica1 patronictl list

# 3. 恢复原主库（将成为从库）
docker start orion-patroni-master
```

### Redis Master 故障

```bash
# 1. 停止主库
docker stop orion-redis-master

# 2. 等待 Sentinel 选举（约 5 秒）
# 3. 查看新主库
docker exec orion-redis-sentinel1 redis-cli -p 26379 sentinel get-master-addr-by-name mymaster

# 4. 恢复原主库
docker start orion-redis-master
# 原主库将作为从库启动
```

## 扩展阅读

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Patroni 文档](https://patroni.readthedocs.io/)
- [Redis 官方文档](https://redis.io/documentation)
- [行级安全最佳实践](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## License

Apache-2.0
