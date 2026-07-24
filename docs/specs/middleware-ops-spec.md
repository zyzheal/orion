# Spec: 中间件运维 (Middleware Operations)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 中间件运维
> **目标成熟度**: L1 → L2
> **关键交付**: 中间件实例管理、备份恢复、配置管理、监控指标

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现（Go 微服务 `orion-middleware-ops-svc-go`）：
- 中间件实例 CRUD（Service + Repository）
- 备份记录管理（CreateBackupRequest/BackupRecord）
- 中间件实例状态追踪（running/stopped/error）
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无中间件类型模板（Redis/MySQL/PostgreSQL/Kafka 预置配置）
- 无自动备份调度
- 无配置漂移检测
- 无监控指标采集
- 无版本管理
- 无中间件依赖拓扑
- 无备份恢复演练

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 类型模板 | Redis/MySQL/PostgreSQL/Kafka/RabbitMQ/Nginx 预置 | L2 |
| 自动备份 | 定时自动备份 + 保留策略 | L2 |
| 备份恢复 | 从备份恢复 + 恢复验证 | L2 |
| 配置管理 | 配置版本 + 漂移检测 | L2 |
| 监控指标 | 连接数/QPS/延迟/内存 采集 | L2 |
| 版本管理 | 版本升级 + 回滚 | L2 |

## 二、验收标准

### 2.1 中间件实例管理

| # | 标准 | 验证方式 |
|---|------|----------|
| MO1 | 支持创建中间件实例（type/name/host/port/version） | API 测试 |
| MO2 | 支持中间件类型：Redis/MySQL/PostgreSQL/Kafka/RabbitMQ/Nginx | API 测试 |
| MO3 | 实例状态：running/stopped/error/degraded | API 测试 |
| MO4 | 支持启动/停止/重启实例 | API 测试 |
| MO5 | 实例配置以 JSONB 存储（连接串/参数） | API 测试 |
| MO6 | 多租户隔离 | 集成测试 |
| MO7 | 实例健康检查（心跳检测） | API 测试 |

### 2.2 类型模板

| # | 标准 | 验证方式 |
|---|------|----------|
| MO8 | 预置 6+ 中间件类型模板 | 前端验证 |
| MO9 | 模板含默认配置参数（如 Redis maxmemory） | API 测试 |
| MO10 | 从模板创建实例自动填充配置 | API 测试 |
| MO11 | 模板支持自定义 | API 测试 |

### 2.3 备份管理

| # | 标准 | 验证方式 |
|---|------|----------|
| MO12 | 支持手动创建备份 | API 测试 |
| MO13 | 支持自动定时备份（cron 表达式） | API 测试 |
| MO14 | 备份保留策略：保留最近 N 个或最近 N 天 | API 测试 |
| MO15 | 备份列表查询（按实例/时间范围） | API 测试 |
| MO16 | 备份文件大小记录 | API 测试 |
| MO17 | 备份完整性校验（checksum） | 单元测试 |

### 2.4 恢复

| # | 标准 | 验证方式 |
|---|------|----------|
| MO18 | 支持从备份恢复到目标实例 | API 测试 |
| MO19 | 恢复前确认（防止误操作） | API 测试 |
| MO20 | 恢复后自动验证（数据一致性检查） | 集成测试 |
| MO21 | 恢复失败自动回滚 | API 测试 |
| MO22 | 恢复记录审计日志 | 单元测试 |

### 2.5 配置管理

| # | 标准 | 验证方式 |
|---|------|----------|
| MO23 | 中间件配置版本管理 | API 测试 |
| MO24 | 配置漂移检测（当前配置 vs 期望配置） | 集成测试 |
| MO25 | 漂移检测周期可配置 | API 测试 |
| MO26 | 漂移告警 | 集成测试 |
| MO27 | 配置历史可回退 | API 测试 |

### 2.6 监控与版本

| # | 标准 | 验证方式 |
|---|------|----------|
| MO28 | 采集连接数/QPS/延迟/内存使用率 | API 测试 |
| MO29 | 指标按时间序列存储 | API 测试 |
| MO30 | 支持版本升级（版本号 + 升级步骤） | API 测试 |
| MO31 | 升级前自动备份 | 集成测试 |
| MO32 | 升级失败自动回滚 | API 测试 |
| MO33 | 中间件仪表盘（实例状态/指标/备份） | 前端验证 |

## 三、API 设计

```
Base: /api/v1/middleware
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/instances` | 创建实例 |
| GET | `/instances` | 实例列表 |
| GET | `/instances/:id` | 实例详情 |
| PUT | `/instances/:id` | 更新实例 |
| POST | `/instances/:id/start` | 启动 |
| POST | `/instances/:id/stop` | 停止 |
| POST | `/instances/:id/restart` | 重启 |
| GET | `/instances/:id/health` | 健康检查 |
| GET | `/templates` | 类型模板 |
| POST | `/instances/:id/backups` | 创建备份 |
| GET | `/instances/:id/backups` | 备份列表 |
| POST | `/backups/:id/restore` | 恢复备份 |
| GET | `/instances/:id/config/history` | 配置历史 |
| POST | `/instances/:id/config/rollback` | 配置回退 |
| GET | `/instances/:id/metrics` | 监控指标 |
| POST | `/instances/:id/upgrade` | 版本升级 |
| GET | `/dashboard` | 仪表盘 |

## 四、数据模型

```sql
-- 中间件实例
CREATE TABLE IF NOT EXISTS middleware_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  middleware_type VARCHAR(50) NOT NULL,
  host            VARCHAR(200) NOT NULL,
  port            INT NOT NULL,
  version         VARCHAR(50),
  status          VARCHAR(20) DEFAULT 'stopped',
  config          JSONB DEFAULT '{}',
  connection_string TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 备份记录
CREATE TABLE IF NOT EXISTS backup_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID NOT NULL REFERENCES middleware_instances(id) ON DELETE CASCADE,
  backup_type     VARCHAR(20) DEFAULT 'manual',
  file_path       TEXT NOT NULL,
  file_size       BIGINT,
  checksum        VARCHAR(64),
  status          VARCHAR(20) DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ
);

-- 配置历史
CREATE TABLE IF NOT EXISTS middleware_config_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID NOT NULL REFERENCES middleware_instances(id) ON DELETE CASCADE,
  config          JSONB NOT NULL,
  changed_by      UUID REFERENCES users(id),
  change_reason   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 监控指标
CREATE TABLE IF NOT EXISTS middleware_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID NOT NULL REFERENCES middleware_instances(id) ON DELETE CASCADE,
  metric_name     VARCHAR(100) NOT NULL,
  metric_value    DECIMAL(15,4) NOT NULL,
  recorded_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_middleware_instances_tenant ON middleware_instances(tenant_id, middleware_type);
CREATE INDEX idx_backup_records_instance ON backup_records(instance_id, created_at DESC);
CREATE INDEX idx_middleware_metrics_instance ON middleware_metrics(instance_id, recorded_at DESC);
```

## 五、前端设计

**路由**: `/middleware-ops`

主要页面：
- 实例列表页：按类型/状态筛选
- 实例详情页：配置/备份/指标
- 备份管理页：备份列表/恢复操作
- 配置历史页：版本对比/回退
- 仪表盘页：实例状态/指标图表
- 模板管理页：类型模板

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | MiddlewareService、BackupService、ConfigService |
| 集成测试 | 6 | 创建→配置→备份→恢复→漂移检测闭环 |
| 前端测试 | 4 | 实例管理、备份操作、指标图表 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
