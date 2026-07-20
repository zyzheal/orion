# ADR-0004: 多租户隔离设计

## Status

**Accepted** — 2026-06-28

## Context

Orion 平台是 SaaS 平台，需要支持多租户隔离。每个租户 (tenant) 是一个独立的企业/团队，拥有自己的用户、项目、Pipeline、资源等。多租户隔离需要满足以下要求：

1. **数据隔离**：租户 A 的数据对租户 B 完全不可见
2. **权限隔离**：租户 A 的用户无法操作租户 B 的资源
3. **资源隔离**：租户 A 的资源消耗不影响租户 B
4. **审计追溯**：所有操作记录租户身份，可审计

## Decision

采用 **共享数据库 + tenant_id 列过滤** 的隔离模式，所有数据访问必须包含 tenant_id 过滤条件。

### 核心原则

1. **tenant_id 无处不在**：所有数据表必须包含 `tenant_id` 列
2. **Repository 层统一过滤**：所有查询在 Repository 层强制添加 `WHERE tenant_id = $1`
3. **API 层传递**：API 请求通过 `X-Tenant-ID` header 传递租户身份
4. **中间件校验**：API 网关中间件 (tenant.ts) 校验租户存在性和用户权限
5. **事件层传递**：所有事件包含 `tenantId` 字段，消费者按租户过滤

### 数据模型

```sql
-- 所有业务表必须包含 tenant_id
CREATE TABLE pipelines (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,       -- 租户隔离
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_pipelines_tenant ON pipelines(tenant_id);
```

### 查询规范

```go
// repository 层：强制 tenant_id 过滤
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
    var p models.Pipeline
    err := r.db.GetContext(ctx, &p,
        `SELECT * FROM pipelines WHERE id = $1 AND tenant_id = $2`, id, tenantID)
    return &p, err
}

// 禁止直接查询（无 tenant_id 过滤）：
// SELECT * FROM pipelines WHERE id = $1  // 不允许！
```

### 租户中间件

```typescript
// middleware/tenant.ts
// 1. 从 X-Tenant-ID header 获取租户 ID
// 2. 校验租户存在性
// 3. 校验用户权限
// 4. 注入 request.tenantId
```

### 服务间调用

```go
// 服务间调用时传递 tenant_id
func (s *Service) CreatePipeline(ctx context.Context, tenantID string, req models.CreatePipelineRequest) (*models.Pipeline, error) {
    // 验证 tenantID 非空
    if tenantID == "" {
        return nil, ErrTenantRequired
    }
    return s.repo.Create(ctx, tenantID, req)
}
```

### 异常场景处理

| 场景 | 处理方式 |
|------|---------|
| 用户属于多个租户 | 要求请求头指定 `X-Tenant-ID`，否则返回 400 |
| 租户不存在 | 返回 403 Forbidden |
| 用户无权限 | 返回 403 Forbidden |
| tenant_id 为空 | 返回 400 Bad Request |

## Consequences

### 正面
- **数据隔离**：tenant_id 过滤确保数据严格隔离
- **统一实现**：Repository 层统一处理，避免遗漏
- **审计完整**：所有操作记录租户身份
- **成本低**：共享数据库，无需为每个租户创建独立数据库

### 负面
- **查询性能**：tenant_id 索引可能影响写性能
- **SQL 注入风险**：必须使用参数化查询，禁止字符串拼接
- **迁移复杂**：新增表必须包含 tenant_id 列
- **共享资源争抢**：同一数据库上的多租户可能互相影响

### 安全要求

1. **Repository 层必须过滤**：所有查询包含 `WHERE tenant_id = $1`
2. **API 网关必须校验**：tenant middleware 校验租户和用户
3. **服务间调用必须传递**：不能省略 tenant_id
4. **日志必须记录**：所有操作日志包含 tenant_id

## 相关 ADR

- ADR-0002: Repository 模式 — tenant_id 过滤在 Repository 层统一处理
- ADR-0003: 事件驱动架构 — 事件通过 tenantId 隔离
