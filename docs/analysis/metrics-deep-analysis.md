# Metrics 模块深度分析

**生成日期**: 2026-07-03  
**分析范围**: `orion-platform-service` 中 metrics 服务与路由  
**服务路径**: `src/services/metrics/`  
**路由文件**: `metrics-routes.ts`  
**控制器**: `MetricsController.ts`

---

## 一、现状概述

### 模块定位

Metrics 模块提供轻量级的时间序列指标存储和查询能力，支持按租户隔离的指标记录、范围查询和聚合统计（avg/min/max/count）。该模块定位为 Orion 平台内部指标存储，而非替代 Prometheus——适用于存储平台自身的运营指标（API 调用量、流水线执行时长等），而非基础设施监控指标。

**当前状态**: 功能简洁完整，PostgreSQL 持久化，有完整的 Controller 层和测试覆盖。但功能范围较窄，缺乏高级聚合能力。

### 文件结构

```
src/services/metrics/
├── __tests__/
│   ├── MetricsService.test.ts          (17,781 字节)
│   ├── MetricsRepository.test.ts       (13,598 字节)
│   └── index.test.ts                   (1,039 字节)
├── MetricsRepository.ts                (1,430 字节)  — 直接 SQL 操作
├── MetricsService.ts                   (2,131 字节)  — 业务逻辑层
└── index.ts                            (164 字节)    — 导出所有

src/api/
├── metrics-routes.ts                   — 3 个端点
└── controllers/MetricsController.ts    — HTTP handler
```

### 核心数据模型

```sql
metrics 表:
- id:          UUID (PK)
- tenant_id:   VARCHAR  — 租户隔离
- name:        VARCHAR  — 指标名称
- value:       NUMERIC  — 指标值
- unit:        VARCHAR  — 单位
- timestamp:   TIMESTAMPTZ  — 记录时间
```

**接口定义 (`Metric`)**:
```typescript
interface Metric {
  id: string;
  tenant_id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
}
```

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 指标记录 | ✅ 完整 | `MetricsService.record()` + `MetricsRepository.record()` |
| 按租户查询 | ✅ 完整 | 所有查询带 `tenant_id` 过滤 |
| 时间范围查询 | ✅ 完整 | `MetricsService.query(startTime, endTime)` |
| 聚合统计 | ✅ 完整 | avg/min/max/count 聚合查询 |
| 自动租户上下文 | ✅ 完整 | `recordCurrent()` 使用 `getCurrentTenantId()` 自动绑定 |
| 最新 N 条查询 | ✅ 完整 | `queryLatest()` 默认返回最近 24h 的 100 条 |
| 权限控制 | ✅ 完整 | 路由注册了 `requirePermission`（read/write） |
| 批量记录 | ❌ 缺失 | 仅支持单条记录插入 |
| Prometheus 兼容查询 | ❌ 缺失 | 无 PromQL 解析或 Remote Read/Write 协议 |
| 标维度标签 | ❌ 缺失 | 仅 name/value/unit，无 tags/labels 机制 |
| 预聚合 / 降采样 | ❌ 缺失 | 无自动 Rollup 或 Retention 策略 |
| 告警规则 | ❌ 缺失 | 无基于阈值的告警触发 |

---

## 三、API 端点

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/api/v1/metrics/record` | MetricsController.record | 记录单条指标（需 tenantId/name/value/unit） |
| POST | `/api/v1/metrics/query` | MetricsController.query | 按名称和时间范围查询 |
| POST | `/api/v1/metrics/stats` | MetricsController.getStats | 聚合统计（avg/min/max/count） |

### 路由注册

- `metrics-routes.ts` → 注册于 `/api/v1/metrics`（routes.ts:677）
- 所有端点需要身份认证 + 权限校验

---

## 四、依赖关系

### 内部依赖

| 组件 | 依赖项 | 用途 |
|------|--------|------|
| MetricsService | MetricsRepository | 数据持久化 |
| MetricsController | MetricsService | 业务逻辑调用 |
| MetricsRepository | DatabasePool | PostgreSQL 连接 |

### 外部依赖

| 依赖 | 用途 | 备注 |
|------|------|------|
| PostgreSQL | metrics 表 | 直接 SQL 操作，非 ORM/QueryBuilder |

### 被依赖关系

| 调用方 | 用途 |
|--------|------|
| 其他 Service | 通过 `MetricsService` 记录运营指标 |
| Dashboard / 监控页面 | 通过 API 查询指标数据 |

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **功能范围过窄**：仅支持单条记录/查询/聚合，缺乏批量操作、标签维度、预聚合等企业级特性 | P2 | 增加 `POST /metrics/batch` 批量记录、支持标签维度（tags JSONB）、增加自动降采样策略 |
| **Repository 使用原始 SQL**：`MetricsRepository` 代码中 SQL 字符串拼接无参数化风险（已使用参数化），但缺少抽象层 | P2 | 可考虑引入 QueryBuilder 或迁移到 Kysely/TypeORM |
| **无数据保留策略**：metrics 表无限增长，缺少 TTL 或自动清理 | P1 | 增加 `cleanupOlderThan(retentionDays)` 方法 + 定时任务 |
| **无缓存层**：高频查询直接命中 PostgreSQL，缺少内存缓存 | P2 | 对热点指标（最近 1h）增加内存缓存，减少 DB 压力 |
| **Controller 异常处理不统一**：使用 `reply.status(500).send(...)` 而非 `handleError` 工具函数 | P2 | 统一使用 `handleError` 错误处理 |
| **测试覆盖虽全但场景有限**：现有测试覆盖 CRUD，但无高并发、大数据量、租户隔离的验证 | P2 | 补充压力测试和租户隔离集成测试 |

---

## 六、总结

Metrics 模块定位清晰、实现简洁，是 Orion 平台内部指标存储的轻量级解决方案。代码质量较高——有完整的 Service/Repository/Controller 分层、PostgreSQL 持久化、租户隔离和权限控制。测试覆盖全面（~31KB 测试代码）。

主要短板在于功能范围：缺乏批量记录、标签维度、数据保留策略和企业级预聚合能力。对于当前"平台自身运营指标"的场景够用，但若要支撑更复杂的监控需求（如自定义仪表盘展示），需要增强功能。建议优先添加批量写入和自动清理机制。
