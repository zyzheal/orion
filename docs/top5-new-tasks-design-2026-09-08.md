# TOP5 视角新增 5 项任务详细设计 (2026-09-08)

> **配套文档**：任务清单升级见 `docs/missing-feature-design-2026-08-25.md` G.0 章节
> **平台视角分析**：见 `docs/architecture-top5-platform-review-2026-09-08.md`
> **本文档定位**：T-AUDIT/T-QUOTA/T-CONFIG-LEVEL/T-POSTMORTEM/T-SPI 的详细设计方案，含数据模型、路由、服务接口、验收标准
>
> ## ⚠️ 重要修正（2026-09-08 18:00）
>
> 核实代码后发现：**本文档 5 项"新任务"中 4 项实际已存在完整实现**，"新任务"假设是错的。详细核实结果：
>
> | 任务 | 实际状态 | 行数 | 接线状态 |
> |------|---------|------|---------|
> | **T-AUDIT** 统一审计日志 | `internal/audit/` 已存在 | 2829 行 | ✅ `router.go:85` |
> | **T-QUOTA** 租户级配额 | `internal/tenant-quota/` 已存在 | 1287 行 | ✅ `wiring-tenant-quota.go` |
> | **T-CONFIG-LEVEL** 租户级配置覆盖 | `distributed-config/` 已存在 | 408K | ✅ |
> | **T-SPI** 扩展点 SPI | `internal/extension-point/` 已存在 | — | ✅ `wiring-extension-point.go` |
> | **T-POSTMORTEM** 复盘模块 | ❌ 无独立模块 | — | — |
>
> **唯一真实缺失**：T-POSTMORTEM 复盘模块。
>
> 本文档下方详细设计作为**参考设计**保留（含数据模型、路由、服务接口、验收标准），但**不需要从零新建**——前 4 项应在现有模块基础上做**深度对齐 + 缺口扩展**，仅 T-POSTMORTEM 需新建。
>
> **建议处理**：
> 1. T-AUDIT/T-QUOTA/T-CONFIG-LEVEL/T-SPI → 对比现有实现 vs 本文档设计，找出差距，做差距扩展
> 2. T-POSTMORTEM → 按本文档设计新建（5d）
> 3. v3.5 G.0 章节需同步修正"新增 5 项"为"激活/扩展 4 项 + 新建 1 项"
>
> 详细核实数据：
> - audit: `internal/audit/` 2829 行 + 20+ 路由 + 区块链哈希链 + SOC2/ISO27001 合规报告
> - tenant-quota: `internal/tenant-quota/` 1287 行（含 handler 193 行 + service 352 行 + repository 149 行 + models 106 行 + tests 464 行）
> - distributed-config: `internal/distributed-config/` 408K（4 层架构完整）
> - extension-point: `internal/extension-point/` 已接线（含 handler/repository/service）
>
> ## ⚠️ 重要修正（2026-09-08 18:00）
>
> 核实代码后发现：**本文档 5 项"新任务"中 4 项实际已存在完整实现**，"新任务"假设是错的。详细核实结果：
>
> | 任务 | 实际状态 | 行数 | 接线状态 |
> |------|---------|------|---------|
> | **T-AUDIT** 统一审计日志 | `internal/audit/` 已存在 | 2829 行 | ✅ `router.go:85` |
> | **T-QUOTA** 租户级配额 | `internal/tenant-quota/` 已存在 | 1287 行 | ✅ `wiring-tenant-quota.go` |
> | **T-CONFIG-LEVEL** 租户级配置覆盖 | `distributed-config/` 已存在 | 408K | ✅ |
> | **T-SPI** 扩展点 SPI | `internal/extension-point/` 已存在 | — | ✅ `wiring-extension-point.go` |
> | **T-POSTMORTEM** 复盘模块 | ❌ 无独立模块 | — | — |
>
> **唯一真实缺失**：T-POSTMORTEM 复盘模块。
>
> 本文档下方详细设计作为**参考设计**保留（含数据模型、路由、服务接口、验收标准），但**不需要从零新建**——前 4 项应在现有模块基础上做**深度对齐 + 缺口扩展**，仅 T-POSTMORTEM 需新建。
>
> **建议处理**：
> 1. T-AUDIT/T-QUOTA/T-CONFIG-LEVEL/T-SPI → 对比现有实现 vs 本文档设计，找出差距，做差距扩展
> 2. T-POSTMORTEM → 按本文档设计新建（5d）
> 3. v3.5 G.0 章节需同步修正"新增 5 项"为"激活/扩展 4 项 + 新建 1 项"
>
> 详细核实数据：
> - audit: `internal/audit/` 2829 行 + 20+ 路由 + 区块链哈希链 + SOC2/ISO27001 合规报告
> - tenant-quota: `internal/tenant-quota/` 1287 行（含 handler 193 行 + service 352 行 + repository 149 行 + models 106 行 + tests 464 行）
> - distributed-config: `internal/distributed-config/` 408K（4 层架构完整）
> - extension-point: `internal/extension-point/` 已接线（含 handler/repository/service）

---

## 总览

| 任务 | TOP5 视角 | 工作量 | Wave | 对标 |
|------|----------|--------|------|------|
| T-AUDIT | AWS + ServiceNow | 3d | Wave 1 | CloudTrail |
| T-QUOTA | AWS + NeatLogic | 5d | Wave 2 | Service Quotas |
| T-CONFIG-LEVEL | NeatLogic | 3d | Wave 2 | 配置中心三层 |
| T-POSTMORTEM | ServiceNow | 5d | Wave 2 | Post-incident Review |
| T-SPI | NeatLogic | 8d | Wave 3 | SPI 注册中心 |

---

## T-AUDIT：统一审计日志中心

### 背景与现状

当前各模块分散审计（dba 有 audit_rule，ticket 有 audit_log，变更有 change_audit），但**无统一审计中心**。AWS CloudTrail 是标杆：所有 API 调用自动记录到中央审计日志，支持查询/订阅/导出/合规报告。

**影响**：
- 安全审计需要跨模块查询，当前需手动拼接
- 合规报告（SOC2/ISO27001）需要统一审计数据
- 无法订阅审计事件做自动化响应

### 数据模型

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    -- 操作者
    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(50) NOT NULL, -- user|system|agent|service_account
    actor_display_name VARCHAR(255),
    -- 操作
    action VARCHAR(255) NOT NULL, -- create|update|delete|approve|reject|execute|login
    resource_type VARCHAR(255) NOT NULL, -- requirement|sprint|task|change|deploy|config
    resource_id VARCHAR(255) NOT NULL,
    resource_summary TEXT, -- 资源摘要（用于快速查看）
    -- 操作详情
    request_method VARCHAR(20),
    request_path VARCHAR(512),
    request_query JSONB,
    request_body JSONB,
    response_status INT,
    response_error TEXT,
    -- 上下文
    trace_id VARCHAR(255),
    correlation_id VARCHAR(255),
    source_ip VARCHAR(50),
    user_agent VARCHAR(512),
    -- 分类
    category VARCHAR(50) NOT NULL, -- security|config|data|workflow|access
    severity VARCHAR(20) NOT NULL DEFAULT 'info', -- debug|info|warn|error|critical
    tags JSONB,
    -- 时间
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_trace_id ON audit_logs(trace_id);

-- 审计事件订阅表（用于 webhook 推送）
CREATE TABLE IF NOT EXISTS audit_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    filter_json JSONB NOT NULL, -- {"category": "security", "severity": "warn"}
    webhook_url VARCHAR(512) NOT NULL,
    secret VARCHAR(255), -- webhook 签名密钥
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 路由设计

```
# 审计日志查询
GET    /api/v1/audit/logs                          查询审计日志（分页+筛选）
GET    /api/v1/audit/logs/:id                      单条审计详情
GET    /api/v1/audit/logs/export                   导出审计日志（CSV/JSON）
POST   /api/v1/audit/logs/search                   高级搜索（全文+聚合）
GET    /api/v1/audit/logs/stats                    审计统计（按类别/操作者/资源/时间）

# 审计订阅（webhook）
GET    /api/v1/audit/subscriptions                 列出订阅
POST   /api/v1/audit/subscriptions                 创建订阅
PUT    /api/v1/audit/subscriptions/:id             更新订阅
DELETE /api/v1/audit/subscriptions/:id             删除订阅

# 合规报告
GET    /api/v1/audit/compliance/reports            合规报告列表
GET    /api/v1/audit/compliance/reports/:id        报告详情
POST   /api/v1/audit/compliance/generate           生成合规报告
```

### 服务层接口

```go
package service

type Service struct {
    repo *repository.Repository
}

// 写入审计（中间件调用）
func (s *Service) Log(ctx context.Context, entry *models.AuditEntry) error

// 查询审计
func (s *Service) List(ctx context.Context, req *ListRequest) (*PageResult[models.AuditLog], error)
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.AuditLog, error)

// 导出
func (s *Service) Export(ctx context.Context, req *ExportRequest) (string, error) // 返回下载 URL

// 统计
func (s *Service) Stats(ctx context.Context, req *StatsRequest) (*models.AuditStats, error)

// 订阅
func (s *Service) ListSubscriptions(ctx context.Context, tenantID string) ([]models.AuditSubscription, error)
func (s *Service) CreateSubscription(ctx context.Context, req *CreateSubscriptionRequest) (*models.AuditSubscription, error)
func (s *Service) UpdateSubscription(ctx context.Context, tenantID, id string, req *UpdateSubscriptionRequest) error
func (s *Service) DeleteSubscription(ctx context.Context, tenantID, id string) error

// 合规报告
func (s *Service) ListComplianceReports(ctx context.Context, tenantID string) ([]models.ComplianceReport, error)
func (s *Service) GenerateComplianceReport(ctx context.Context, req *GenerateReportRequest) (*models.ComplianceReport, error)
```

### 中间件集成

```go
// audit_middleware.go
func AuditMiddleware(svc *service.Service, cfg Config) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 跳过健康检查/登录等
        if isExcluded(c.Request.URL.Path) {
            c.Next()
            return
        }
        // 执行请求
        c.Next()
        // 异步写入审计
        entry := buildAuditEntry(c)
        go svc.Log(context.Background(), entry)
    }
}
```

### 验收标准

- [ ] `curl :3001/api/v1/audit/logs?limit=10` 返回 200 + 数据
- [ ] `curl :3001/api/v1/audit/logs/stats?category=security` 返回聚合数据
- [ ] 中间件自动记录所有写操作（CRUD），无需手动埋点
- [ ] 创建 webhook 订阅后，触发审计事件会推送 webhook
- [ ] 导出审计日志为 CSV/JSON
- [ ] 生成合规报告（含时间范围+筛选条件）
- [ ] 单元测试：service_test 覆盖 Log/List/Stats/Subscription/Compliance
- [ ] `go vet ./internal/audit/...` 0 错误

---

## T-QUOTA：租户级配额模块

### 背景与现状

当前无配额模块，多租户隔离不彻底。AWS Service Quotas 是标杆：每个租户可配置资源上限，超限时告警或拒绝。

### 数据模型

```sql
CREATE TABLE IF NOT EXISTS tenant_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL, -- pipeline|deploy|container|dataset|api_call|storage_gb|cpu_hours
    quota_limit INT NOT NULL,
    current_usage INT NOT NULL DEFAULT 0,
    period VARCHAR(20) NOT NULL DEFAULT 'monthly', -- daily|monthly|yearly|lifetime
    unit VARCHAR(50) NOT NULL, -- count|bytes|seconds|percent
    alert_threshold_pct INT DEFAULT 80, -- 达阈值告警
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, resource_type, period)
);

CREATE INDEX IF NOT EXISTS idx_quotas_tenant_id ON tenant_quotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotas_resource_type ON tenant_quotas(resource_type);

-- 配额告警表
CREATE TABLE IF NOT EXISTS quota_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    quota_id UUID NOT NULL,
    usage_pct INT NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL, -- warn|critical
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 路由设计

```
GET    /api/v1/quota/                             列出当前租户所有配额
GET    /api/v1/quota/:resource_type               获取特定资源配额
PUT    /api/v1/quota/:resource_type               更新配额上限
POST   /api/v1/quota/check                        检查配额是否超限
POST   /api/v1/quota/consume                      消耗配额（业务调用）
POST   /api/v1/quota/release                      释放配额

# 配额告警
GET    /api/v1/quota/alerts                       列出配额告警
POST   /api/v1/quota/alerts/:id/acknowledge       确认告警

# 配额报告
GET    /api/v1/quota/report                       配额使用报告（按租户/资源/时间）
```

### 服务层接口

```go
type Service struct {
    repo *repository.Repository
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Quota, error)
func (s *Service) Get(ctx context.Context, tenantID, resourceType string) (*models.Quota, error)
func (s *Service) Update(ctx context.Context, tenantID, resourceType string, limit int) error

// 配额检查（业务调用前检查）
func (s *Service) Check(ctx context.Context, tenantID, resourceType string, amount int) (bool, *models.Quota, error)

// 配额消耗（业务执行后调用）
func (s *Service) Consume(ctx context.Context, tenantID, resourceType string, amount int) error
func (s *Service) Release(ctx context.Context, tenantID, resourceType string, amount int) error

// 告警
func (s *Service) ListAlerts(ctx context.Context, tenantID string) ([]models.QuotaAlert, error)
func (s *Service) AcknowledgeAlert(ctx context.Context, tenantID, id string) error

// 报告
func (s *Service) Report(ctx context.Context, tenantID string, period string) (*models.QuotaReport, error)
```

### 中间件集成

```go
// quota_middleware.go
func QuotaMiddleware(svc *service.Service, resourceType string, amount func(*gin.Context) int) gin.HandlerFunc {
    return func(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        amount := amount(c)
        ok, quota, err := svc.Check(c.Request.Context(), tenantID, resourceType, amount)
        if err != nil {
            c.AbortWithStatusJSON(500, gin.H{"error": err.Error()})
            return
        }
        if !ok {
            c.AbortWithStatusJSON(429, gin.H{"error": "quota exceeded", "quota": quota})
            return
        }
        c.Next()
        // 请求成功后消耗配额
        if c.Writer.Status() < 400 {
            svc.Consume(c.Request.Context(), tenantID, resourceType, amount)
        }
    }
}
```

### 验收标准

- [ ] `curl :3001/api/v1/quota/` 返回当前租户所有配额
- [ ] `curl :3001/api/v1/quota/pipeline` 返回 pipeline 配额详情
- [ ] `curl :3001/api/v1/quota/check?resource_type=pipeline&amount=1` 返回 {ok: true, quota: {...}}
- [ ] 配额超限返回 429 + quota 详情
- [ ] 配额达阈值自动告警
- [ ] 中间件集成：业务 API 自动检查+消耗配额
- [ ] 单元测试：service_test 覆盖 Check/Consume/Release/Alert

---

## T-CONFIG-LEVEL：租户级配置覆盖

### 背景与现状

当前配置中心（`config/` 408K）只有全局配置，无法按租户 override。NeatLogic 配置中心三层：平台默认 → 租户 override → 用户偏好。

### 数据模型

```sql
-- 配置层级表（替代现有 config 单表）
CREATE TABLE IF NOT EXISTS config_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL, -- 空字符串表示全局默认
    user_id VARCHAR(255), -- 空字符串表示租户级
    config_key VARCHAR(255) NOT NULL,
    config_value JSONB NOT NULL,
    priority INT NOT NULL, -- 0=全局默认, 100=租户级, 200=用户级
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_overrides_key ON config_overrides(config_key);
CREATE INDEX IF NOT EXISTS idx_config_overrides_tenant ON config_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_overrides_user ON config_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_config_overrides_priority ON config_overrides(priority DESC);
```

### 路由设计

```
GET    /api/v1/config/override/                   列出所有覆盖配置
GET    /api/v1/config/override/:key               获取特定 key 的覆盖链（全局→租户→用户）
POST   /api/v1/config/override/                   创建覆盖配置
PUT    /api/v1/config/override/:id                更新覆盖配置
DELETE /api/v1/config/override/:id                删除覆盖配置

# 配置查询（三层合并）
GET    /api/v1/config/resolve                     解析配置（返回合并后的最终值）
GET    /api/v1/config/resolve/:key                解析特定 key

# 配置模板
GET    /api/v1/config/templates                   列出配置模板
POST   /api/v1/config/templates                   创建模板
POST   /api/v1/config/templates/:id/apply         应用模板到租户
```

### 服务层接口

```go
type Service struct {
    repo *repository.Repository
}

// 覆盖配置 CRUD
func (s *Service) List(ctx context.Context, tenantID string) ([]models.ConfigOverride, error)
func (s *Service) GetChain(ctx context.Context, key string) ([]models.ConfigOverride, error)
func (s *Service) Create(ctx context.Context, req *CreateOverrideRequest) (*models.ConfigOverride, error)
func (s *Service) Update(ctx context.Context, tenantID string, id string, req *UpdateOverrideRequest) error
func (s *Service) Delete(ctx context.Context, tenantID string, id string) error

// 配置解析（三层合并）
func (s *Service) Resolve(ctx context.Context, tenantID, userID, key string) (interface{}, error)
func (s *Service) ResolveAll(ctx context.Context, tenantID, userID string) (map[string]interface{}, error)

// 模板
func (s *Service) ListTemplates(ctx context.Context) ([]models.ConfigTemplate, error)
func (s *Service) CreateTemplate(ctx context.Context, req *CreateTemplateRequest) (*models.ConfigTemplate, error)
func (s *Service) ApplyTemplate(ctx context.Context, tenantID, templateID string) error
```

### 配置解析逻辑

```go
func (s *Service) Resolve(ctx context.Context, tenantID, userID, key string) (interface{}, error) {
    // 按优先级从高到低查找：用户级 > 租户级 > 全局默认
    overrides, err := s.repo.FindByPriority(ctx, key, tenantID, userID)
    if err != nil {
        return nil, err
    }
    if len(overrides) > 0 {
        return overrides[0].ConfigValue, nil // 最高优先级的覆盖值
    }
    // 无覆盖，返回全局默认（或 nil）
    return nil, nil
}
```

### 验收标准

- [ ] `curl :3001/api/v1/config/resolve?key=theme&tenant_id=t1&user_id=u1` 返回合并后的最终值
- [ ] `curl :3001/api/v1/config/override/` 列出所有覆盖配置
- [ ] `curl :3001/api/v1/config/override/theme` 返回 key=theme 的覆盖链（全局→租户→用户）
- [ ] 创建租户级覆盖后，该租户的 resolve 返回覆盖值
- [ ] 删除租户级覆盖后，resolve 回退到全局默认
- [ ] 应用配置模板后，批量创建多个覆盖配置
- [ ] 单元测试：Resolve 三层合并逻辑（用户级覆盖租户级、租户级覆盖全局、无覆盖返回默认）

---

## T-POSTMORTEM：复盘模块 + Incident→Knowledge 链路

### 背景与现状

当前 `ticketing/Incident.ts` 1752 行 + `Problem.ts` 1388 行，但 Incident 关闭即终止，无复盘模块，知识沉淀无链路。ServiceNow Post-incident Review 是标杆：Incident 关闭后自动生成复盘草稿，复盘结论一键沉淀为知识库条目。

### 数据模型

```sql
-- 复盘表
CREATE TABLE IF NOT EXISTS postmortems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    incident_id UUID NOT NULL,
    project_id VARCHAR(255),
    title VARCHAR(512) NOT NULL,
    summary TEXT NOT NULL, -- 一句话摘要
    root_cause TEXT NOT NULL, -- 根因分析
    contributing_factors JSONB, -- 贡献因素列表
    timeline JSONB NOT NULL, -- 事件时间线 [{time, event, actor, type}]
    impact JSONB, -- 影响评估 {duration_min, users_affected, revenue_impact, sla_breach}
    action_items JSONB NOT NULL DEFAULT '[]', -- 后续行动 [{title, owner, due_date, status}]
    lessons_learned TEXT, -- 经验教训
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft|review|approved|published|archived
    author VARCHAR(255) NOT NULL,
    reviewed_by VARCHAR(255),
    approved_by VARCHAR(255),
    knowledge_id UUID, -- 关联的知识库条目
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_postmortems_incident_id ON postmortems(incident_id);
CREATE INDEX IF NOT EXISTS idx_postmortems_tenant_id ON postmortems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_postmortems_status ON postmortems(status);
CREATE INDEX IF NOT EXISTS idx_postmortems_author ON postmortems(author);

-- 复盘模板
CREATE TABLE IF NOT EXISTS postmortem_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_json JSONB NOT NULL, -- 模板结构
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 路由设计

```
# 复盘 CRUD
GET    /api/v1/postmortems                        列出复盘
GET    /api/v1/postmortems/:id                    复盘详情
POST   /api/v1/postmortems                        创建复盘（关联 incident）
PUT    /api/v1/postmortems/:id                    更新复盘
DELETE /api/v1/postmortems/:id                    删除复盘

# Incident → Postmortem 自动生成
POST   /api/v1/incidents/:id/postmortem/generate  从 incident 自动生成复盘草稿
POST   /api/v1/postmortems/:id/publish            发布复盘（沉淀到知识库）
POST   /api/v1/postmortems/:id/archive            归档复盘

# 复盘统计
GET    /api/v1/postmortems/stats                  复盘统计（按根因/影响/行动项完成率）

# 复盘模板
GET    /api/v1/postmortems/templates              列出模板
POST   /api/v1/postmortems/templates              创建模板
PUT    /api/v1/postmortems/templates/:id          更新模板
DELETE /api/v1/postmortems/templates/:id          删除模板
```

### 服务层接口

```go
type Service struct {
    repo *repository.Repository
    incidentSvc IncidentService // 注入 Incident 服务
    knowledgeSvc KnowledgeService // 注入 Knowledge 服务
}

// CRUD
func (s *Service) List(ctx context.Context, req *ListRequest) (*PageResult[models.Postmortem], error)
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Postmortem, error)
func (s *Service) Create(ctx context.Context, req *CreatePostmortemRequest) (*models.Postmortem, error)
func (s *Service) Update(ctx context.Context, tenantID, id string, req *UpdateRequest) error
func (s *Service) Delete(ctx context.Context, tenantID, id string) error

// 自动生成（核心能力）
func (s *Service) GenerateFromIncident(ctx context.Context, tenantID, incidentID string) (*models.Postmortem, error)

// 发布到知识库
func (s *Service) Publish(ctx context.Context, tenantID, postmortemID string) (knowledgeID string, err error)

// 统计
func (s *Service) Stats(ctx context.Context, tenantID string) (*models.PostmortemStats, error)

// 模板
func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]models.PostmortemTemplate, error)
func (s *Service) CreateTemplate(ctx context.Context, req *CreateTemplateRequest) (*models.PostmortemTemplate, error)
```

### 自动生成逻辑

```go
func (s *Service) GenerateFromIncident(ctx context.Context, tenantID, incidentID string) (*models.Postmortem, error) {
    // 1. 获取 incident 详情
    incident, err := s.incidentSvc.Get(ctx, tenantID, incidentID)
    if err != nil {
        return nil, err
    }
    // 2. 提取时间线
    timeline := extractTimeline(incident)
    // 3. 启发式根因分析（规则式，无 LLM）
    rootCause := inferRootCause(incident) // timeout|oom|disk|5xx|change|unknown
    // 4. 提取贡献因素
    factors := extractContributingFactors(incident)
    // 5. 估算影响
    impact := estimateImpact(incident)
    // 6. 生成复盘草稿
    postmortem := &models.Postmortem{
        IncidentID: incidentID,
        Title: fmt.Sprintf("Post-mortem: %s", incident.Title),
        Summary: incident.Summary,
        RootCause: rootCause,
        Timeline: timeline,
        Impact: impact,
        ContributingFactors: factors,
        Status: "draft",
        Author: incident.Assignee,
    }
    return s.repo.Create(ctx, postmortem)
}
```

### 验收标准

- [ ] `curl :3001/api/v1/incidents/:id/postmortem/generate` 返回自动生成复盘草稿
- [ ] 自动生成的复盘含：根因、时间线、影响评估、行动项
- [ ] `curl :3001/api/v1/postmortems/:id/publish` 返回知识库条目 ID
- [ ] 复盘统计：按根因/影响/行动项完成率聚合
- [ ] 模板管理：创建/应用复盘模板
- [ ] 单元测试：GenerateFromIncident 覆盖 timeout/oom/disk/5xx/change/unknown 6 种根因

---

## T-SPI：扩展点 SPI 注册中心

### 背景与现状

当前有 8 个扩展点（自定义任务/Skill 市场/Webhook/低代码生成/AI Agent 编排/审批工作流/配置中心/集成 API），但 NeatLogic 有 29 个扩展点。缺：租户级配置覆盖/权限 DSL/报表模板 SPI/数据源适配器 SPI/告警路由规则 SPI/变更单字段扩展/审批流自定义/表单字段校验器 SPI/审计事件订阅/通知模板渲染 SPI 等 21 个扩展点。

### 数据模型

```sql
-- 扩展点定义表
CREATE TABLE IF NOT EXISTS extension_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255), -- NULL 表示全局扩展点
    code VARCHAR(100) NOT NULL UNIQUE, -- unique code, e.g. "report_template_renderer"
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- data|workflow|ui|integration|notification|audit
    interface_type VARCHAR(100) NOT NULL, -- 接口类型，如 "ReportTemplateRenderer"
    metadata JSONB, -- 扩展点元数据（参数 schema 等）
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 扩展点实现注册表
CREATE TABLE IF NOT EXISTS extension_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    extension_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    implementation_type VARCHAR(50) NOT NULL, -- builtin|webhook|plugin|http_callback
    implementation_config JSONB NOT NULL, -- 实现配置（webhook URL/插件 ID 等）
    priority INT NOT NULL DEFAULT 100,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active|disabled|error
    last_tested_at TIMESTAMPTZ,
    last_test_result VARCHAR(20),
    registered_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extensions_code ON extension_definitions(code);
CREATE INDEX IF NOT EXISTS idx_registrations_extension_id ON extension_registrations(extension_id);
CREATE INDEX IF NOT EXISTS idx_registrations_tenant_id ON extension_registrations(tenant_id);

-- 扩展点调用日志
CREATE TABLE IF NOT EXISTS extension_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    extension_id UUID NOT NULL,
    registration_id UUID,
    action VARCHAR(50) NOT NULL,
    params JSONB,
    result JSONB,
    error TEXT,
    duration_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 路由设计

```
# 扩展点定义
GET    /api/v1/extensions/definitions               列出所有扩展点定义
GET    /api/v1/extensions/definitions/:code         获取特定扩展点
POST   /api/v1/extensions/definitions               创建扩展点定义（仅管理员）
PUT    /api/v1/extensions/definitions/:id           更新扩展点定义
DELETE /api/v1/extensions/definitions/:id           删除扩展点定义

# 扩展点注册
GET    /api/v1/extensions/registrations             列出当前租户的注册
POST   /api/v1/extensions/registrations             注册扩展点实现
PUT    /api/v1/extensions/registrations/:id         更新注册
DELETE /api/v1/extensions/registrations/:id         删除注册
POST   /api/v1/extensions/registrations/:id/test    测试注册是否可用
POST   /api/v1/extensions/registrations/:id/toggle  启用/禁用注册

# 扩展点调用
POST   /api/v1/extensions/invoke                    调用扩展点（运行时）
GET    /api/v1/extensions/calls                     查询调用日志
GET    /api/v1/extensions/calls/stats               调用统计
```

### 服务层接口

```go
type Service struct {
    repo *repository.Repository
    httpTransport HTTPTransport // webhook 调用
    pluginLoader PluginLoader   // 插件加载器
}

// 扩展点定义管理
func (s *Service) ListDefinitions(ctx context.Context, tenantID string) ([]models.ExtensionDefinition, error)
func (s *Service) GetDefinition(ctx context.Context, code string) (*models.ExtensionDefinition, error)
func (s *Service) CreateDefinition(ctx context.Context, req *CreateDefinitionRequest) (*models.ExtensionDefinition, error)

// 注册管理
func (s *Service) ListRegistrations(ctx context.Context, tenantID string) ([]models.ExtensionRegistration, error)
func (s *Service) CreateRegistration(ctx context.Context, req *CreateRegistrationRequest) (*models.ExtensionRegistration, error)
func (s *Service) TestRegistration(ctx context.Context, tenantID, id string) (*TestResult, error)

// 扩展点调用（核心能力）
func (s *Service) Invoke(ctx context.Context, tenantID, extensionCode string, params interface{}) (interface{}, error)

// 调用日志
func (s *Service) ListCalls(ctx context.Context, req *ListCallsRequest) (*PageResult[models.ExtensionCall], error)
func (s *Service) CallStats(ctx context.Context, tenantID string) (*models.CallStats, error)
```

### 扩展点调用逻辑

```go
func (s *Service) Invoke(ctx context.Context, tenantID, extensionCode string, params interface{}) (interface{}, error) {
    // 1. 查找扩展点定义
    def, err := s.repo.GetDefinitionByCode(ctx, extensionCode)
    if err != nil {
        return nil, err
    }
    // 2. 查找当前租户的注册（按优先级排序）
    regs, err := s.repo.FindRegistrations(ctx, tenantID, def.ID)
    if err != nil {
        return nil, err
    }
    // 3. 逐个尝试调用（fallback 模式）
    for _, reg := range regs {
        var result interface{}
        var callErr error
        switch reg.ImplementationType {
        case "builtin":
            result, callErr = s.invokeBuiltin(ctx, reg, params)
        case "webhook":
            result, callErr = s.invokeWebhook(ctx, reg, params)
        case "plugin":
            result, callErr = s.invokePlugin(ctx, reg, params)
        }
        // 4. 记录调用日志
        s.repo.LogCall(ctx, &models.ExtensionCall{...})
        if callErr == nil {
            return result, nil
        }
        // 5. 失败则尝试下一个（fallback）
    }
    return nil, fmt.Errorf("all registrations failed for extension %s", extensionCode)
}
```

### 8 个核心扩展点定义

| 扩展点 Code | 类别 | 接口类型 | 说明 |
|------------|------|---------|------|
| `report_template_renderer` | data | ReportTemplateRenderer | 报表模板渲染 |
| `form_field_validator` | ui | FormFieldValidator | 表单字段校验器 |
| `alert_route_rule` | workflow | AlertRouteRule | 告警路由规则 |
| `approval_rule_node` | workflow | ApprovalRuleNode | 审批流自定义节点 |
| `datasource_adapter` | data | DataSourceAdapter | 数据源适配器 |
| `notification_template` | notification | NotificationTemplate | 通知模板渲染 |
| `audit_event_subscriber` | audit | AuditEventSubscriber | 审计事件订阅 |
| `resource_field_extender` | workflow | ResourceFieldExtender | 变更单字段扩展 |

### 验收标准

- [ ] `curl :3001/api/v1/extensions/definitions` 返回 8 个核心扩展点定义
- [ ] `curl :3001/api/v1/extensions/registrations` 列出当前租户的注册
- [ ] 注册 webhook 实现后，调用扩展点会发送 HTTP 请求
- [ ] 多注册按优先级调用，失败 fallback 到下一个
- [ ] `curl :3001/api/v1/extensions/invoke` 调用扩展点并返回结果
- [ ] 调用日志：记录每次调用的参数/结果/耗时/错误
- [ ] 测试注册：`curl :3001/api/v1/extensions/registrations/:id/test` 验证连通性
- [ ] 单元测试：Invoke 覆盖 builtin/webhook/plugin + fallback + 多注册

---

## 5 项任务合计

| 任务 | 工作量 | Wave | 验收门禁 |
|------|--------|------|---------|
| T-AUDIT | 3d | Wave 1 | 中间件自动记录 + webhook 订阅 + 合规报告 |
| T-QUOTA | 5d | Wave 2 | 配额检查 + 超限 429 + 告警 + 报告 |
| T-CONFIG-LEVEL | 3d | Wave 2 | 三层合并 + 覆盖链查询 + 模板 |
| T-POSTMORTEM | 5d | Wave 2 | 自动生成 + 发布到知识库 + 统计 |
| T-SPI | 8d | Wave 3 | 8 扩展点 + webhook 注册 + fallback 调用 |

**总计 24d**，建议按 Wave 顺序执行（Wave 1 先做 T-AUDIT，Wave 2 做 T-QUOTA/T-CONFIG-LEVEL/T-POSTMORTEM，Wave 3 做 T-SPI）。
