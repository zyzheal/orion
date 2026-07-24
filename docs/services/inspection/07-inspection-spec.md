# 巡检服务 Spec 文档 (inspection-svc-go)

**生成日期**: 2026-07-03
**状态**: 编写中
**成熟度**: L2（已实现基础 CRUD，测试完备）
**所属模块**: 治理 (Governance) → 安全与合规巡检

---

## 一、服务定位

巡检服务（Inspection Service）是 Orion 治理与合规体系的核心组件，负责定义和执行基础设施及应用的定期巡检规则，并将巡检结果持久化用于审计和修复追踪。

**核心价值**：通过可编程的巡检规则（Rule）对目标资源（K8s 集群、节点、应用、中间件等）进行周期性检查，记录检查结果（Result）并提供修复建议（Remediation），帮助运维团队提前发现配置漂移、安全漏洞和合规偏离。

**当前状态**：已完成基础 CRUD 框架，支持巡检规则和巡检结果两个核心实体的全生命周期管理，使用 PostgreSQL 持久化（JSONB 存储柔性条件/详情），集成 JWT 认证和 RBAC 权限管控。

---

## 二、验收标准

| 编号 | 验收标准 | 优先级 | 验证方式 |
|------|---------|--------|---------|
| IS-01 | 支持创建巡检规则，返回完整实体（含 ID、时间戳），必填字段校验 (name, rule_type, target, condition) | P0 | API 测试 |
| IS-02 | 支持按租户分页查询巡检规则列表，默认 page=1, page_size=20 | P0 | API 测试 |
| IS-03 | 支持按 ID 查询单个巡检规则详情（含 tenant_id 隔离） | P0 | API 测试 |
| IS-04 | 支持更新巡检规则（name, description, rule_type, target, condition, severity, schedule） | P0 | API 测试 |
| IS-05 | 支持删除巡检规则（按 ID + tenant_id） | P0 | API 测试 |
| IS-06 | 创建规则时默认 enabled=true，默认 severity="medium" | P0 | 集成测试 |
| IS-07 | 支持按租户分页查询巡检结果列表，默认 page=1, page_size=20 | P0 | API 测试 |
| IS-08 | 支持按规则 ID 查询关联的巡检结果列表（分页） | P0 | API 测试 |
| IS-09 | 支持查询巡检规则总数（按租户统计） | P1 | API 测试 |
| IS-10 | 所有 API 端点（除 healthz）均需经过 JWT 认证 | P0 | 集成测试 |
| IS-11 | 写操作端点需经过 RBAC 权限控制（inspection:write / inspection:delete） | P0 | 集成测试 |
| IS-12 | 所有列表接口按 tenant_id 隔离（从 JWT 提取） | P0 | 集成测试 |
| IS-13 | 服务启动时自动运行数据库迁移 | P0 | 部署测试 |
| IS-14 | 支持 JSONB 格式的 condition 和 details 字段的读写 | P0 | 单元测试 |
| IS-15 | 分页参数有上限保护：page_size 最大 100 | P0 | 单元测试 |

---

## 三、API 设计

所有 API 以 `/api/v1/inspections` 为前缀，通过 Gin RouterGroup 注册。认证由 `auth.Auth` 中间件统一拦截（JWT + Redis Session），写操作额外使用 `auth.RequirePermission` 进行 RBAC 控制。

### 辅助端点

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | /healthz | 健康检查 | - | `{ "status": "ok" }` |

### 巡检规则 CRUD

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| POST | /api/v1/inspections/rules | 创建巡检规则 | Body: `{ name (必填), description, rule_type (必填), target (必填), condition (必填, JSONB), severity (默认 medium), schedule }` | `201` + InspectionRule 实体 |
| GET | /api/v1/inspections/rules | 分页查询规则列表 | Query: `page`(默认1), `page_size`(默认20,最大100) | `{ "data": [InspectionRule...] }` |
| GET | /api/v1/inspections/rules/:id | 查询规则详情 | Path: `id` | InspectionRule 实体 |
| PUT | /api/v1/inspections/rules/:id | 更新规则 | Path: `id`, Body: CreateRuleRequest | InspectionRule 实体 |
| DELETE | /api/v1/inspections/rules/:id | 删除规则 | Path: `id` | `204` No Content |

### 巡检结果查询

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | /api/v1/inspections/results | 分页查询结果列表 | Query: `page`(默认1), `page_size`(默认20,最大100) | `{ "data": [InspectionResult...] }` |
| GET | /api/v1/inspections/rules/:id/results | 按规则查询结果 | Path: `rule_id`, Query: `page`, `page_size` | `{ "data": [InspectionResult...] }` |

### 统计

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| GET | /api/v1/inspections/count | 统计规则总数 | - | `{ "count": int }` |

### 其他操作

| 方法 | 路径 | 功能说明 | 请求参数 | 响应 |
|------|------|---------|---------|------|
| DELETE | /api/v1/inspections/:id | 删除规则（别名，同 DELETE /rules/:id） | Path: `id` | `{ "message": "deleted" }` |

> **注意**：`DELETE /:id` 与 `DELETE /rules/:id` 功能重复，均调用 `DeleteRule` 方法。前者返回 `200 + message`，后者返回 `204`。建议统一保留 `/rules/:id` 端点。

---

## 四、数据模型

### 4.1 核心实体概览

服务使用 PostgreSQL 作为存储，共 2 张表。所有表位于 `orion_inspection` 数据库。

### 4.2 实体关系图

```
inspection_rules ──1:N── inspection_results
```

### 4.3 核心实体定义

#### inspection_rules — 巡检规则

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键，由服务端生成 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID，用于多租户隔离 |
| name | VARCHAR(256) | NOT NULL | 规则名称 |
| description | TEXT | - | 规则描述 |
| rule_type | VARCHAR(64) | NOT NULL | 规则类型（如 health, security, compliance, custom） |
| target | VARCHAR(256) | NOT NULL | 巡检目标（如 k8s:default:pod, host:192.168.1.1） |
| condition | JSONB | NOT NULL DEFAULT '{}' | 检查条件（柔性 JSON 结构，按 rule_type 解析） |
| severity | VARCHAR(16) | NOT NULL DEFAULT 'medium' | 严重级别：low / medium / high / critical |
| enabled | BOOLEAN | NOT NULL DEFAULT true | 是否启用 |
| schedule | VARCHAR(64) | - | 调度表达式（如 cron 表达式），空表示手动触发 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 更新时间 |

```sql
CREATE INDEX idx_inspection_rules_tenant ON inspection_rules(tenant_id, created_at);
```

#### inspection_results — 巡检结果

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| rule_id | VARCHAR(128) | NOT NULL | 关联规则 ID |
| rule_name | VARCHAR(256) | NOT NULL | 规则名称（快照，规则改名后仍保持历史记录） |
| status | VARCHAR(32) | NOT NULL DEFAULT 'pending' | 状态：pending / pass / fail / error / skipped |
| target | VARCHAR(256) | NOT NULL | 被检查的目标标识 |
| details | JSONB | DEFAULT '{}' | 检查结果详情（按 rule_type 有不同的结构） |
| remediation | TEXT | - | 修复建议 |
| executed_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 执行时间 |

```sql
CREATE INDEX idx_inspection_results_tenant ON inspection_results(tenant_id, executed_at);
CREATE INDEX idx_inspection_results_rule ON inspection_results(tenant_id, rule_id);
```

### 4.4 Condition / Details 结构约定

condition 和 details 字段使用 JSONB 存储，具体结构由 rule_type 决定：

| rule_type | condition 结构示例 | details 结构示例 |
|-----------|-------------------|-----------------|
| `health` | `{ "cpu_threshold": 90, "mem_threshold": 85 }` | `{ "cpu_usage": 45.2, "mem_usage": 62.1, "status": "ok" }` |
| `security` | `{ "check_ports": [22, 3306], "allowed_cidrs": ["10.0.0.0/8"] }` | `{ "open_ports": [22], "violations": [], "score": 95 }` |
| `compliance` | `{ "require_labels": ["app", "env"], "forbid_ns": ["default"] }` | `{ "missing_labels": [], "compliant": true }` |
| `custom` | 自定义 JSON | 自定义 JSON |

### 4.5 Severity 级别

| 级别 | 说明 |
|------|------|
| low | 信息性提示，不影响业务 |
| medium | 一般性问题，建议关注 |
| high | 重问题，需尽快处理 |
| critical | 严重问题，需立即处理 |

### 4.6 Result Status 状态

```
pending ─→ running ─→ pass
                   ↘ fail
                   ↘ error
                   ↘ skipped
```

| 状态 | 说明 |
|------|------|
| pending | 等待执行 |
| pass | 检查通过 |
| fail | 检查未通过 |
| error | 检查执行出错 |
| skipped | 跳过（如目标不可达） |

---

## 五、依赖与集成

### 5.1 内部依赖

| 依赖模块 | 用途 | 引用形式 |
|---------|------|---------|
| `orion/go-common/pkg/database` | PostgreSQL 连接与管理、自动迁移 | `replace` 指令本地引用 |
| `orion/go-common/pkg/redis` | Redis 客户端、JWT Session 缓存 | `replace` 指令本地引用 |
| `orion/go-common/pkg/auth` | JWT 认证中间件 + RBAC 权限鉴定 | `replace` 指令本地引用 |
| `orion/go-common/pkg/middleware` | 通用中间件（Recovery, RequestID, StructuredLogger, CORS） | `replace` 指令本地引用 |
| `orion/go-common/pkg/logger` | 结构化日志 | `replace` 指令本地引用 |

### 5.2 外部依赖

| 依赖 | 用途 | 版本 |
|------|------|------|
| `github.com/gin-gonic/gin` | HTTP 框架 | v1.10.0 |
| `github.com/jmoiron/sqlx` | PostgreSQL 数据访问层 | v1.4.0 |
| `github.com/google/uuid` | UUID 生成 | v1.6.0 |
| `github.com/lib/pq` | PostgreSQL 驱动 | v1.10.9（间接） |
| PostgreSQL | 数据持久化 | - |
| Redis | JWT Session 缓存 | - |

### 5.3 中间件栈（按注册顺序）

| 中间件 | 来源 | 说明 |
|--------|------|------|
| Recovery | `orion/go-common/pkg/middleware` | panic 恢复，避免服务崩溃 |
| RequestID | `orion/go-common/pkg/middleware` | 每个请求注入唯一请求 ID |
| StructuredLogger | `orion/go-common/pkg/middleware` | 结构化请求日志 |
| CORS | `orion/go-common/pkg/middleware` | 跨域配置（默认配置） |
| Auth | `orion/go-common/pkg/auth` | JWT 认证（SkipPaths: /healthz） |

### 5.4 基础设施配置

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|---------|--------|------|
| 服务端口 | `PORT` | 8080 | HTTP 监听端口 |
| 数据库 DSN | `DATABASE_URL` | postgres://orion:orion@localhost:5432/orion_inspection?sslmode=disable | PostgreSQL 连接串 |
| Redis 地址 | `REDIS_ADDR` | localhost:6379 | Redis 连接地址 |
| JWT 密钥 | `JWT_SECRET` | change-me-in-production | JWT 认证密钥 |

---

## 六、已知问题与注意事项

### 6.1 代码级问题

| # | 问题 | 位置 | 影响 | 建议修复 |
|---|------|------|------|---------|
| B1 | `Count` 查询使用了错误的表名 `inspections`（应为 `inspection_rules`） | `internal/repository/inspection_repository.go:62` | COUNT 查询始终返回 0 | 将 `FROM inspections` 改为 `FROM inspection_rules` |
| B2 | `DELETE /:id`（无 `/rules/` 前缀）与 `DELETE /rules/:id` 功能重复，且返回状态码不一致（200 vs 204） | `internal/handler/handler.go:25,94-98` | API 设计不一致 | 移除 `DELETE /:id` 路由，或统一行为 |
| B3 | `ResultRepository.Create` 已实现，但 handler 层未注册创建结果的 API 端点 | - | 无法通过 API 写入巡检结果 | 补充 `POST /results` 端点 |
| B4 | `ResultRepository` 缺少 `GetByID` 方法 | - | 无法查询单条结果详情 | 新增 `GetResult` 方法 + handler |
| B5 | 创建/更新规则时未校验 `severity` 的值域（low/medium/high/critical） | service 层 | 可写入无效级别 | 添加 enum 校验 |
| B6 | 更新规则时不更新 `enabled` 字段 | `service.go:52-63` | 无法通过更新接口启用/禁用规则 | 补充 `req.Enabled` 字段复用或单独加启禁端点 |

### 6.2 功能缺失

| # | 缺失功能 | 说明 | 建议优先级 |
|---|---------|------|:---------:|
| G1 | 巡检执行引擎 | 当前只有规则配置和结果存储，没有实际的巡检执行引擎 | P0 |
| G2 | 定时调度 | `schedule` 字段已定义但无调度器消费（需 cron/调度引擎集成） | P1 |
| G3 | 巡检结果写入 API | 有 Repository.Create 但无 HTTP 端点暴露 | P1 |
| G4 | 批量删除历史结果 | 无按时间/规则批量清理结果的 API | P2 |
| G5 | 结果统计聚合 | 无按状态/严重级别统计结果的接口 | P2 |
| G6 | 规则启禁单独 API | 目前只能通过更新全字段启禁 | P1 |

### 6.3 后续优化方向

| 优先级 | 优化项 | 说明 |
|--------|--------|------|
| P0 | 修复 Count 表名错误 | `inspections` → `inspection_rules` |
| P0 | 实现巡检执行引擎 | 根据规则定义的 condition 对 target 执行实际检查 |
| P1 | 补充结果创建/详情 API | 让巡检引擎或外部系统能写入结果 |
| P1 | 引入统一错误码 | 替代 `http.StatusInternalServerError(500)` 返回所有错误 |
| P1 | 规则启禁独立接口 | `POST /rules/:id/enable` / `POST /rules/:id/disable` |
| P2 | 集成分布式调度 | 对接 Orion Cron 服务或内置 cron 消费 `schedule` 字段 |
| P2 | 批量清理结果 | `DELETE /results?before=2026-01-01&status=fail` |
| P2 | 结果统计看板 | 按规则/状态/严重级别聚合统计 |
| P2 | 添加 Prometheus 指标 | 巡检执行数、通过率、耗时等 |

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
