# 数据备份策略设计

**版本**: v1.0
**日期**: 2026-07-02
**状态**: 设计文档

## 1. 概述

本文档定义 Orion 平台的统一数据备份策略，覆盖所有持久化存储组件的数据保护需求。

### 1.1 备份范围

| 存储组件 | 数据类型 | 备份必要性 | 恢复优先级 |
|---------|---------|:---------:|:---------:|
| PostgreSQL 16 | 全部业务数据（Pipeline、Tenant、User、Config、Approval 等） | **高** | P0 |
| Redis 7 | 缓存、Session、Token 黑名单、限流计数 | 中 | P1 |
| NATS JetStream | 事件总线持久化消息 | 中 | P1 |

### 1.2 备份原则

1. **3-2-1 备份规则**: 至少 3 份副本、2 种不同介质、1 份异地存储
2. **加密备份**: 所有备份数据必须加密存储（AES-256-GCM）
3. **自动验证**: 每次备份完成后自动进行完整性校验
4. **最小 RPO**: PostgreSQL RPO ≤ 1 小时，Redis/NATS RPO ≤ 24 小时

---

## 2. PostgreSQL 备份策略

### 2.1 备份类型

#### 2.1.1 全量备份

| 属性 | 值 |
|------|-----|
| 频率 | 每日 1 次（北京时间 03:00） |
| 工具 | `pg_dump`（逻辑备份）或 `pg_basebackup`（物理备份） |
| 格式 | 自定义格式（`custom`） |
| 保留周期 | 30 天 |
| 存储路径 | `/data/backups/pg/full/` |
| 预计大小 | ~5GB（当前规模） |

```bash
# 全量备份示例（逻辑备份）
pg_dump -h localhost -U orion -Fc -f /data/backups/pg/full/orion_$(date +%Y%m%d).dump orion

# 全量备份示例（物理备份）
pg_basebackup -h localhost -U replicator -D /data/backups/pg/full/$(date +%Y%m%d) -X stream -P
```

#### 2.1.2 WAL 归档

| 属性 | 值 |
|------|-----|
| 频率 | 连续（每 5 分钟或 64MB 切换 WAL 段） |
| 保留周期 | 7 天 |
| 存储路径 | `/data/backups/pg/wal/` |
| 用途 | 支持 Point-in-Time Recovery (PITR) |

```conf
# postgresql.conf WAL 归档配置
wal_level = replica
archive_mode = on
archive_command = 'cp %p /data/backups/pg/wal/%f'
archive_timeout = 300  # 5 分钟
```

#### 2.1.3 逻辑备份（指定表）

| 属性 | 值 |
|------|-----|
| 频率 | 按需（迁移前/重大变更前） |
| 工具 | `pg_dump --table=<table_name>` |
| 用途 | 迁移验证、指定表回退 |

### 2.2 恢复测试

| 测试类型 | 频率 | 要求 |
|---------|------|------|
| 全量恢复测试 | 每月 1 次 | 完整恢复至测试环境，验证数据完整性 |
| PITR 测试 | 每季度 1 次 | 恢复到指定时间点，验证业务可用性 |
| 备份完整性验证 | 每次备份后 | 校验 dump 文件 MD5 + pg_restore --list |

---

## 3. Redis 备份策略

### 3.1 备份类型

#### 3.1.1 RDB 快照

| 属性 | 值 |
|------|-----|
| 频率 | 每 6 小时 |
| 配置 | `save 21600 1000`（6小时 或 ≥1000 key 变更） |
| 保留周期 | 7 天 |
| 文件路径 | `/data/backups/redis/rdb/` |

```conf
# redis.conf
save 21600 1
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
```

#### 3.1.2 AOF 持久化

| 属性 | 值 |
|------|-----|
| 同步策略 | `appendfsync everysec` |
| 自动重写 | `auto-aof-rewrite-percentage 100`、`auto-aof-rewrite-min-size 64mb` |
| 保留周期 | 与 RDB 对齐（AOF 文件随重写自动合并） |

```conf
# redis.conf
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

### 3.2 恢复优先级

Redis 作为缓存和会话存储，恢复优先级低于 PostgreSQL。
- **Key 类型标记**: 业务关键数据（Token 黑名单、限流）使用 `PERSIST` 标记持久化
- **缓存数据**: 允许从业务数据库重建

---

## 4. NATS JetStream 备份策略

### 4.1 消息持久化

| 属性 | 值 |
|------|-----|
| 存储后端 | JetStream FileStore |
| 数据路径 | `/data/nats/jetstream/` |
| 消息保留 | 根据 Stream 配置（默认 7 天） |

### 4.2 备份方式

NATS JetStream 使用 FileStore 的文件级备份：

```bash
# 在停止 NATS 服务后执行文件级备份
systemctl stop nats-server
tar -czf /data/backups/nats/jetstream_$(date +%Y%m%d).tar.gz /data/nats/jetstream/
systemctl start nats-server
```

| 属性 | 值 |
|------|-----|
| 频率 | 每日 1 次（低峰期） |
| 保留周期 | 7 天 |
| 恢复 RPO | ≤ 24 小时（如遇故障丢失 < 1 天消息） |

---

## 5. 加密与存储

### 5.1 备份加密

所有备份文件在写入存储前必须加密：

```bash
# AES-256-GCM 加密示例
openssl enc -aes-256-gcm -salt -pbkdf2 -iter 100000 \
  -in /data/backups/pg/full/orion_20260701.dump \
  -out /data/backups/encrypted/orion_20260701.dump.enc \
  -pass file:/etc/backup/backup-key.enc
```

### 5.2 密钥管理

| 属性 | 值 |
|------|-----|
| 加密密钥 | 独立密钥（非业务密钥），存储在 KMS 或硬件 HSM |
| 密钥轮换 | 每 90 天轮换一次 |
| 访问控制 | 仅备份服务和运维人员可访问 |

### 5.3 存储分层

| 层级 | 存储介质 | 保留数据 | 访问延迟 |
|------|---------|---------|---------|
| L1 | 本地 SSD（WAL + 最新全量） | 最近 7 天 | 毫秒级 |
| L2 | 对象存储（S3/MinIO） | 归档数据（7-30 天） | 秒级 |
| L3 | 异地对象存储 | 异地副本（30+ 天） | 分钟级 |

---

## 6. 备份调度

### 6.1 时间表

| 时间 | PostgreSQL | Redis | NATS |
|------|:----------:|:-----:|:----:|
| 00:00 | — | RDB 快照 | — |
| 03:00 | **全量备份** | — | — |
| 06:00 | — | RDB 快照 | 文件备份 |
| 09:00 | — | — | — |
| 12:00 | — | RDB 快照 | — |
| 15:00 | — | — | — |
| 18:00 | — | RDB 快照 | — |
| 21:00 | — | — | — |
| 持续 | WAL 归档（每 5 分钟） | AOF everysec | — |

### 6.2 备份脚本入口

```bash
# 全量备份入口脚本
scripts/backup-full.sh

# 恢复入口脚本
scripts/restore.sh --type <full|pitr|redis|nats> --point-in-time "<timestamp>"
```

---

## 7. 灾难恢复流程

### 7.1 恢复优先级

| 优先级 | 数据 | RTO | RPO |
|:------:|------|:---:|:---:|
| P0 | PostgreSQL（核心业务数据） | ≤ 30 分钟 | ≤ 5 分钟（使用 WAL） |
| P1 | Redis（Token 黑名单、Session） | ≤ 2 小时 | ≤ 24 小时 |
| P2 | NATS（事件消息） | ≤ 4 小时 | ≤ 24 小时 |

### 7.2 PostgreSQL 恢复

```
1. 停止应用 → 避免数据写入
2. 选择恢复方式：
   a. 全量恢复（最新 dump）：pg_restore
   b. PITR（指定时间点）：恢复全量 + 重放 WAL
3. 恢复后验证：
   - 用户数据完整性检查（SELECT count(*) FROM users）
   - 业务数据逻辑检查（Pipeline 状态一致性）
   - 权限和角色恢复
4. 启动应用 → 验证业务可用性
```

### 7.3 Redis 恢复

```
1. 停止 Redis 服务
2. 复制 RDB 文件到 Redis 数据目录
3. 启动 Redis 服务（自动加载 RDB）
4. 验证 Key 完整性（随机抽样 key）
```

### 7.4 定期恢复演练

| 演练频率 | 内容 | 参与方 |
|---------|------|--------|
| 每月 | PostgreSQL 全量恢复至测试环境 | 运维 + QA |
| 每季度 | PITR 恢复至指定时间点 | 运维 + SRE |
| 每季度 | Redis 数据恢复验证 | 运维 |
| 每年 | 完整 DR 演练（含异地恢复） | 全团队 |

---

## 8. 监控与告警

### 8.1 备份监控指标

| 指标 | 阈值 | 告警级别 |
|------|------|:--------:|
| 备份执行时间 | > 30 分钟 | Warning |
| 备份失败 | 任何失败 | **Critical** |
| 备份完整性校验失败 | 任何失败 | **Critical** |
| 备份文件年龄 | > 36 小时 | Warning |
| 磁盘空间使用率 | > 80% | Warning |
| WAL 归档延迟 | > 15 分钟 | Warning |

### 8.2 告警通知

- **Critical**: 即时通知（PagerDuty/短信），5 分钟内未确认升级
- **Warning**: 工作时间通知（邮件/IM）

---

## 9. 备份验证检查清单

- [ ] 每日自动备份执行日志检查
- [ ] 每周手动抽样检查备份文件完整性
- [ ] 每月 PostgreSQL 全量恢复测试
- [ ] 每季 PITR 恢复测试
- [ ] 每季 Redis 恢复测试
- [ ] 每季切换演练（主从切换 + 备份恢复）
- [ ] 每年完整 DR 演练
