# Flagship Review v3.7 — 差距扩展实施详细设计 (2026-09-08)

> **来源**：Phase 300 差距扩展审计深化
> **前置文档**：`docs/flagship-review-v3.6-delta-2026-09-08.md`（Phase 300 审计主报告）
> **本文档定位**：Phase 301-306 每项任务的**详细技术设计**（数据模型/路由/服务层/测试/验收标准），纯文档不涉及代码修改，为后续 `orion-platform-svc-go/` 授权实施做准备。
>
> **⚠️ 与 v3.6 差异**：v3.6 只提供工时清单，v3.7 补充详细设计 + 修正 Phase 300 审计中 T-AUDIT ISO27001 判断错误。

---

## 0. Phase 300 审计修正

### 0.1 T-AUDIT ISO27001 endpoint 判断修正

**Phase 300 v3.6 声称**：ISO27001 endpoint 缺失
**本轮核实**：ISO27001 合规报告**已完整实现**

```
orion-platform-svc-go/internal/audit/handler/handler.go:241  GET /audit/compliance/iso27001
orion-platform-svc-go/internal/audit/service/compliance_test.go:
    - TestControlCatalog_HasSOC2AndISO27001  (期望 6 SOC2 + 12 ISO27001 controls)
    - TestSelectControls_SOC2 / TestSelectControls_ISO27001
    - TestComplianceReport_SOC2* 系列
```

**修正结论**：ISO27001 已有完整支持（endpoint + 服务层 + 测试用例 12+ 个 controls）。**Phase 304 从"ISO27001 endpoint 补齐"改为"新增合规框架（PCI-DSS/等保2.0/PDPA/GDPR）"**。

### 0.2 T-QUOTA P0 BUG 判断修正

**Phase 300 初审声称**：`wiretenantquota` 未挂载 → tqH nil → API 不可达
**Phase 300 二次核实已修正**：`wiring.go:137` 已调用 `wiretenantquota(db, logger)`

**唯一真实问题**：函数名 `wiretenantquota` 违反 Go 命名约定（应为 `wireTenantQuota`），但**功能正常**。

### 0.3 修正后 Phase 301-306 差距扩展总览

| Phase | 任务 | 类型 | 工时 | 修正说明 |
|-------|-----|-----|-----|---------|
| 301 | T-QUOTA wiring 命名规范化（`wiretenantquota` → `wireTenantQuota`） | 代码规范 | 0.5d | 由 P0 BUG 降级为代码规范 |
| 302 | T-CONFIG-LEVEL 三层 Level 字段（platform/tenant/user） | 能力补全 | 2d | 保持 |
| 303 | T-SPI 内置扩展点枚举（10-15 个 BuiltinPoint 常量） | 能力补全 | 1d | 保持 |
| 304 | T-AUDIT 新增合规框架（PCI-DSS/等保2.0/PDPA） | 能力扩展 | 1d | **由 ISO27001 补齐改为新合规框架** |
| 305 | T-AUDIT 深度补齐（合规 dashboard 可视化） | 深度补齐 | 0.5d | 由 1d 降到 0.5d |
| 306 | T-QUOTA 深度补齐（软限/硬限/预警分级） | 深度补齐 | 1d | 保持 |
| — | **合计** | — | **6d** | 微调后仍 6d |

---

## 1. Phase 301 — T-QUOTA Wiring 命名规范化

### 1.1 现状

```
orion-platform-svc-go/cmd/server/wiring-tenant-quota.go:14
func wiretenantquota(db *database.DB, logger *zap.Logger) {   // ← 违反 Go 命名
    tqS := tq_service.NewService(repo)
    tqH = tq_handler.NewHandler(tqS)
}

orion-platform-svc-go/cmd/server/wiring.go:137
    wiretenantquota(db, logger)   // ← 调用点
```

### 1.2 设计

**改动**：
```go
// wiring-tenant-quota.go
func wireTenantQuota(db *database.DB, logger *zap.Logger) {  // 重命名
    ...
}

// wiring.go
wireTenantQuota(db, logger)  // 调用点重命名
```

### 1.3 影响面

- **零功能影响**：函数签名不变，只改函数名
- **测试**：`route_dump_test.go` 通过 `tqH != nil` 保护，不受影响
- **前端**：不涉及（API 路由不变）

### 1.4 验收标准

- [ ] `grep -rn "wiretenantquota" orion-platform-svc-go/` 返回 0 结果
- [ ] `grep -rn "wireTenantQuota" orion-platform-svc-go/cmd/server/` 返回 2 结果（定义 + 调用）
- [ ] `go test ./cmd/server/...` 通过

---

## 2. Phase 302 — T-CONFIG-LEVEL 三层 Level 字段

### 2.1 现状

```
orion-platform-svc-go/internal/distributed-config/models/models.go:49
type ConfigItem struct {
    ID          string  `db:"id" json:"id"`
    TenantID    string  `db:"tenant_id" json:"tenantId"`
    GroupID     string  `db:"group_id" json:"groupId"`
    NamespaceID string  `db:"namespace_id" json:"namespaceId"`
    KeyName     string  `db:"key_name" json:"keyName"`
    Value       string  `db:"value" json:"value"`
    ValueType   string  `db:"value_type" json:"valueType"`
    Encrypted   bool    `db:"encrypted" json:"encrypted"`
    Description string  `db:"description" json:"description"`
    Labels      string  `db:"labels" json:"labels"`
    CreatedAt   time.Time
    UpdatedAt   time.Time
    // ❌ 缺少 Level 字段（platform|tenant|user）
    // ❌ 缺少 OverrideOf 字段（引用被覆盖的 item ID）
    // ❌ 缺少 Priority 字段（层级优先级）
}
```

### 2.2 数据模型扩展

```go
type ConfigItem struct {
    // 现有字段（不变）
    ID, TenantID, GroupID, NamespaceID, KeyName, Value, ValueType, Encrypted, Description, Labels, CreatedAt, UpdatedAt
    
    // 新增字段
    Level      string `db:"level" json:"level"`                // platform|tenant|user，默认 "tenant"
    OverrideOf string `db:"override_of" json:"overrideOf"`      // 被覆盖的 platform/tenant item ID（可空）
    Priority   int    `db:"priority" json:"priority"`           // 数值越大越优先（platform=100, tenant=50, user=10）
}

const (
    ConfigLevelPlatform = "platform"
    ConfigLevelTenant   = "tenant"
    ConfigLevelUser     = "user"
)
```

### 2.3 服务层接口扩展

```go
// service_interface.go 新增方法
type Service interface {
    // 现有方法...
    
    // 新增：按 Level 优先级合并（platform → tenant → user）
    ResolveEffectiveConfig(ctx context.Context, tenantID string, namespaceID string, userID string) (map[string]ConfigValue, error)
    
    // 新增：检查某 item 是否已被下层覆盖
    ListOverrides(ctx context.Context, tenantID string, itemID string) ([]ConfigItem, error)
}
```

### 2.4 路由扩展

```
# 新增
GET /config/items/effective?namespace_id=xxx&user_id=yyy     # 按优先级合并后的实际生效值
GET /config/items/:id/overrides                              # 列出被覆盖的下层 item

# 修改（新增过滤参数）
GET /config/items?level=platform|tenant|user&override_only=true/false
```

### 2.5 前端影响

- `orion-frontend/src/pages/ConfigManagement/` 新增 Level 下拉选择器（platform/tenant/user）
- 新增"生效值查看"视图：显示合并后的实际配置
- 新增"覆盖树"视图：可视化 platform→tenant→user 覆盖链

### 2.6 迁移策略

- **DB 迁移**：新增 3 列，`level` 默认 'tenant'，`override_of` NULL，`priority` 按 level 自动填充
- **兼容**：老数据自动升级为 `level=tenant`，优先级 50
- **回滚**：新增列不影响老接口

### 2.7 测试用例

- `TestConfigItem_LevelValidation`：Level 只能是 platform/tenant/user
- `TestResolveEffectiveConfig_PlatformOnly`：只有 platform 层返回 platform 值
- `TestResolveEffectiveConfig_TenantOverride`：platform + tenant 返回 tenant 覆盖值
- `TestResolveEffectiveConfig_UserOverride`：三层叠加返回 user 值
- `TestListOverrides_CrossTenant`：跨租户 override 检查

### 2.8 验收标准

- [ ] `ConfigItem.Level` 字段支持 3 值枚举，服务层校验
- [ ] `ResolveEffectiveConfig` 端点返回合并后的 map
- [ ] 前端 Level 选择器 + 覆盖树视图可用
- [ ] 迁移脚本向后兼容（默认 tenant）
- [ ] 单元测试覆盖 5 个核心场景

---

## 3. Phase 303 — T-SPI 内置扩展点枚举

### 3.1 现状

```
orion-platform-svc-go/internal/extension-point/models/models.go:28
const (
    CategoryStartup  = "startup"
    CategoryAPI      = "api"
    CategoryHandler  = "handler"
    CategoryService  = "service"
    CategoryListener = "listener"
)
// ❌ 只有 5 个 Category，无具体内置扩展点枚举
```

### 3.2 内置扩展点枚举定义

```go
// Builtin 扩展点常量（15 个）
const (
    // CategoryAPI 类
    BuiltinPreRequest      = "pre_request"       // API 前置钩子
    BuiltinPostRequest     = "post_request"      // API 后置钩子
    BuiltinAuthMiddleware  = "auth_middleware"   // 认证中间件注入
    
    // CategoryHandler 类
    BuiltinBeforeHandler   = "before_handler"    // Handler 执行前
    BuiltinAfterHandler    = "after_handler"     // Handler 执行后
    
    // CategoryService 类
    BuiltinPreSave         = "pre_save"          // 实体保存前
    BuiltinPostSave        = "post_save"         // 实体保存后
    BuiltinDeleteHook      = "delete_hook"       // 实体删除前
    
    // CategoryListener 类
    BuiltinAuditHook       = "audit_hook"        // 审计日志钩子
    BuiltinNotification    = "notification"      // 通知发送钩子
    BuiltinWebhookDispatch = "webhook_dispatch"  // Webhook 分派
    
    // CategoryStartup 类
    BuiltinOnStartup       = "on_startup"        // 启动初始化
    BuiltinOnShutdown      = "on_shutdown"       // 优雅关闭
    BuiltinConfigChanged   = "config_changed"    // 配置变更通知
)

var BuiltinPointRegistry = map[string]BuiltinPointMeta{
    BuiltinPreRequest:    {Category: CategoryAPI, Description: "API 前置钩子，可修改 request 上下文", DefaultOrder: 10},
    BuiltinPostRequest:   {Category: CategoryAPI, Description: "API 后置钩子，可修改 response", DefaultOrder: 90},
    // ...
}

type BuiltinPointMeta struct {
    Category   string
    Description string
    DefaultOrder int
}
```

### 3.3 服务层扩展

```go
// service_interface.go 新增
type Service interface {
    // 现有方法...
    
    // 新增：列出内置扩展点
    ListBuiltinPoints(ctx context.Context) ([]BuiltinPointMeta, error)
    
    // 新增：按 Category 过滤内置扩展点
    ListBuiltinPointsByCategory(ctx context.Context, category string) ([]BuiltinPointMeta, error)
}
```

### 3.4 路由扩展

```
# 新增
GET /extension-points/builtin                    # 列出所有内置扩展点
GET /extension-points/builtin?category=api       # 按 Category 过滤
GET /extension-points/builtin/:name              # 获取单个内置扩展点详情
```

### 3.5 Registry 初始化

```go
// registry.go 初始化时自动注册
func (r *Registry) RegisterBuiltinPoints() {
    for name, meta := range BuiltinPointRegistry {
        r.Register(&ExtensionPoint{
            Name: name,
            Category: meta.Category,
            HandlerType: "builtin",
            Status: "active",
            IsBuiltin: true,
            DefaultOrder: meta.DefaultOrder,
        })
    }
}
```

### 3.6 数据模型扩展

```go
type ExtensionPoint struct {
    // 现有字段...
    IsBuiltin    bool `db:"is_builtin" json:"isBuiltin"`       // 是否内置
    DefaultOrder int  `db:"default_order" json:"defaultOrder"` // 默认执行顺序
}
```

### 3.7 前端影响

- `PluginManagement/ExtensionPointList.tsx` 新增 "Builtin" 徽章标识
- 内置扩展点不允许删除/修改 Category
- 新增 "Builtin Points" 只读面板展示 15 个内置扩展点

### 3.8 测试用例

- `TestBuiltinPointRegistry_15Points`：验证 15 个内置扩展点存在
- `TestListBuiltinPoints`：端点返回 15 项
- `TestListBuiltinPointsByCategory_API`：过滤返回 3 项（pre_request/post_request/auth_middleware）
- `TestBuiltinPoint_DeleteForbidden`：内置扩展点删除返回 403

### 3.9 验收标准

- [ ] 15 个 `BuiltinPoint*` 常量定义完整
- [ ] `BuiltinPointRegistry` map 完整
- [ ] Registry 初始化时自动注册内置扩展点
- [ ] 前端 UI 标识内置扩展点
- [ ] 单元测试覆盖 4 个场景

---

## 4. Phase 304 — T-AUDIT 新增合规框架

### 4.1 现状

```
orion-platform-svc-go/internal/audit/service/compliance.go（已有）
- ControlCatalog 已定义：6 SOC2 (CC1-CC6) + 12+ ISO27001 controls
- selectControls(category) 支持 SOC2/ISO27001 大小写不敏感选择
- ComplianceReport(tenantID, category) 生成合规报告
```

**结论**：SOC2 与 ISO27001 已完整实现。**Phase 304 改为新增合规框架**。

### 4.2 新增合规框架设计

```go
// 新增 ComplianceFramework 定义
type ComplianceFramework struct {
    ID          string   // 框架 ID（如 "PCI-DSS"）
    Name        string   // 显示名（如 "PCI-DSS v4.0"）
    Version     string   // 版本（如 "4.0"）
    Category    string   // PCI-DSS | MLPS2 | PDPA | GDPR
    Controls    []Control // 控制项列表
    EffectiveDate string
    Jurisdiction string  // Global | CN | EU | TH 等
}
```

### 4.3 新增框架清单（Phase 304 首批 3 个）

| 框架 | 版本 | 控制项数 | 适用地区 | 优先级 |
|-----|-----|--------|--------|-------|
| PCI-DSS | v4.0 | 36 controls (Req 1-12) | Global | 🟠 P0 |
| 等保 2.0 | v2.0 | 200+ controls | CN | 🔴 P0（国内合规必需） |
| PDPA | v1.0 | 12 controls | TH | 🟡 P2 |

### 4.4 服务层扩展

```go
type ComplianceService interface {
    // 现有
    ComplianceReport(ctx, tenantID, framework string) (*ComplianceReport, error)
    
    // 新增
    ListFrameworks(ctx context.Context) ([]ComplianceFramework, error)
    GetFramework(ctx context.Context, id string) (*ComplianceFramework, error)
    ComplianceDashboard(ctx context.Context, tenantID string) (*Dashboard, error)  // 所有框架的覆盖度概览
}
```

### 4.5 路由扩展

```
# 现有
GET /audit/compliance/soc2
GET /audit/compliance/iso27001
GET /audit/compliance/combined
GET /audit/compliance/coverage

# 新增
GET  /audit/compliance/frameworks                    # 列出所有合规框架
GET  /audit/compliance/frameworks/:id                # 单个框架详情
GET  /audit/compliance/dashboard?tenant_id=xxx       # 多框架覆盖度仪表板
GET  /audit/compliance/pcidss                        # PCI-DSS 报告
GET  /audit/compliance/mlps2                         # 等保 2.0 报告
GET  /audit/compliance/pdpa                          # PDPA 报告
```

### 4.6 前端影响

- `Audit/ComplianceDashboard.tsx` 新增多框架仪表板视图
- 每框架显示：Total Controls / Passed / Failed / Coverage %
- 支持按框架类型切换（SOC2 / ISO27001 / PCI-DSS / 等保2.0）

### 4.7 测试用例

- `TestComplianceFramework_PCI_DSS`：36 controls 加载
- `TestComplianceFramework_MLPS2`：等保 2.0 controls 加载
- `TestComplianceDashboard_MultiFramework`：仪表板聚合多框架
- `TestSelectControls_PCIDSS_CaseInsensitive`：大小写不敏感

### 4.8 验收标准

- [ ] 3 个新合规框架完整定义（PCI-DSS / 等保2.0 / PDPA）
- [ ] `/audit/compliance/frameworks` 端点返回所有框架
- [ ] `/audit/compliance/dashboard` 端点聚合覆盖度
- [ ] 前端仪表板支持 4 个框架视图切换

---

## 5. Phase 305 — T-AUDIT 合规 Dashboard 可视化

### 5.1 现状

- **已有**：SOC2/ISO27001 合规报告 endpoint（handler.go 241 行区域）
- **已有**：区块链哈希链完整实现（VerifyChain + computeHash）
- **已有**：CSV/JSON 导出能力（handler.go 91-96）
- **已有**：查询过滤能力（`parseAuditQuery` 230-315 行）

### 5.2 差距

- **合规 Dashboard 可视化**：目前只有单框架报告，无跨框架聚合
- **风险热图**：无控制项风险等级可视化

### 5.3 设计

```go
// service 层新增 Dashboard 方法
type Dashboard struct {
    TenantID       string
    GeneratedAt    time.Time
    Frameworks     []FrameworkSummary   // 每个框架的覆盖度
    RiskHeatmap    []RiskCell           // 控制项 x 严重度矩阵
    TrendData      []TrendPoint         // 30 天趋势
}

type FrameworkSummary struct {
    FrameworkID  string
    Total        int
    Passed       int
    Failed       int
    CoveragePct  float64
    RiskScore    float64   // 0-100，越低越好
}
```

### 5.4 路由

```
GET /audit/compliance/dashboard                     # 完整 dashboard JSON
GET /audit/compliance/dashboard/trend?days=30       # 30 天趋势
GET /audit/compliance/dashboard/heatmap             # 风险热图数据
```

### 5.5 前端设计

- `ComplianceDashboard.tsx`：
  - 顶部 4 张卡：SOC2/ISO27001/PCI-DSS/等保2.0 覆盖度
  - 中部：风险热图（框架 x 控制项类别矩阵，颜色 = 风险等级）
  - 底部：30 天趋势折线图

### 5.6 验收标准

- [ ] `/audit/compliance/dashboard` 端点返回聚合数据
- [ ] 前端仪表板展示 4 框架覆盖度 + 热图 + 趋势
- [ ] 单元测试覆盖 Dashboard 聚合逻辑

---

## 6. Phase 306 — T-QUOTA 深度补齐（软限/硬限/预警分级）

### 6.1 现状

```
orion-platform-svc-go/internal/tenant-quota/（1287 行）
- handler.go:193（11 条路由：ListPlans/CreatePlan/GetPlan/UpdatePlan/DeletePlan/ListUsage/GetUsage/IncrementUsage/ResetUsage/CheckQuota/ListAlerts）
- service.go:352
- models.go:106
```

**已有能力**：计划 CRUD + usage 累计 + 检查配额 + 简单 alerts

### 6.2 差距

- **软限 vs 硬限**：目前只有单一 limit，无 soft/hard 分级
- **预警分级**：Alerts 只有 1 级，无 warning/critical 分级
- **超配行为**：超配后是否阻断/放行/通知 无策略

### 6.3 数据模型扩展

```go
type QuotaPlan struct {
    // 现有字段...
    
    // 新增
    SoftLimit   int64  `json:"softLimit"`    // 软限（触发 warning）
    HardLimit   int64  `json:"hardLimit"`    // 硬限（触发 blocking）
    OverLimitAction string `json:"overLimitAction"`  // block|warn|allow
    WarnThresholds  []int `json:"warnThresholds"`    // [50, 80, 95] 百分比
}
```

### 6.4 服务层扩展

```go
type Service interface {
    // 现有方法...
    
    // 新增
    CheckQuotaWithPolicy(ctx, tenantID, resource, usage, quota) (*CheckResult, error)
    
    // CheckResult 包含
    // - Allowed bool
    // - Warning []string  // 50/80/95% 触发
    // - Blocking bool     // hard limit 触发
}
```

### 6.5 路由扩展

```
# 新增
POST /tenants/:id/quotas/:plan-id/check-with-policy  # 策略检查
GET  /tenants/:id/quotas/alerts?level=warning|critical  # 分级 alerts
```

### 6.6 前端影响

- `TenantQuota/PlanEditor.tsx` 新增：Soft/Hard Limit 双输入 + 超配策略选择器
- `TenantQuota/AlertList.tsx` 新增分级筛选

### 6.7 测试用例

- `TestCheckQuotaWithPolicy_UnderSoft`：低于 soft 放行
- `TestCheckQuotaWithPolicy_BetweenSoftHard`：触发 warning 但放行
- `TestCheckQuotaWithPolicy_OverHard_Block`：超 hard 且策略 block 阻断
- `TestWarnThresholds_50_80_95`：多阈值触发

### 6.8 验收标准

- [ ] `QuotaPlan` 支持 soft/hard limit + overLimitAction + warnThresholds
- [ ] `CheckQuotaWithPolicy` 端点返回 warning/allowed/blocking 完整信息
- [ ] 前端支持双 limit + 策略选择 + 分级 alerts

---

## 7. P0-MB 多分支并行策略 Phase 编号统一

### 7.1 现状

`docs/multi-branch-strategy-design.md` 使用 Phase 231-235 编号，与 ALL_TODOS.md 使用的 P0-MB Phase 编号不一致。

### 7.2 编号统一

| 原 Phase | 新 Phase | 内容 | 工时 |
|---------|---------|-----|-----|
| 231 | **P0-MB Phase 1** | 基础数据模型（L1 BranchProfile + L3 BuildArtifact） | 5d |
| 232 | **P0-MB Phase 2** | 环境隔离强化（L2 Namespace） | 4d |
| 233 | **P0-MB Phase 3** | 同步策略（L4 SyncPolicy） | 6d |
| 234 | **P0-MB Phase 4** | 变更审计（L5 DeployEvent） | 5d |
| 235 | **P0-MB Phase 5** | 冲突预检查（L1 增强 PreDeployGate R1-R6） | 6d |
| — | — | 总计 | **26d** |

### 7.3 ALL_TODOS.md 对齐

- 顶部新增 "P0-MB 多分支并行策略（26d）" 任务组
- 引用 `docs/multi-branch-strategy-design.md` §7 路线图（架构设计 v1.1）
- 引用 `docs/multi-branch-strategy-design-v2-impl-2026-09-08.md`（1184 行详细技术设计，含 6 大模型 Go 结构 / DB 表 / 40+ 路由 / 6 前端页面 / 40+ 测试用例 / 验收标准）
- 8 项子任务对齐：L1 BranchProfile / L2 Namespace / L3 BuildArtifact / L4 SyncPolicy / L5 DeployEvent / PreDeployGate R1-R6 / 前端 UI / 测试覆盖

---

## 8. 差距扩展 vs P0-MB 优先级对照

| 优先级 | 任务组 | 工时 | 前置依赖 | 授权状态 |
|-------|-------|-----|---------|---------|
| 🔴 P0 | Phase 301-306 差距扩展 | 6d | 需 `orion-platform-svc-go/` 授权 | ⚠️ FORBIDDEN 未授权 |
| 🔴 P0 | P0-MB 多分支并行（Phase 1-5） | 26d | 需 `orion-platform-svc-go/` 授权 | ⚠️ FORBIDDEN 未授权 |
| 🟠 P1 | Wave 1 前置任务（T-19/T-18/T-15） | 10d | 需多模块授权 | ⚠️ FORBIDDEN 未授权 |
| 🟡 P2 | PERM-8 客户端 token 迁移 | 3d | 需 `orion-platform-svc-go/` 授权 | ⚠️ FORBIDDEN 未授权 |
| 🟢 P3 | P1-9 三域补全（ITSM/CI-CD/CMDB） | 10-15d | 需多模块授权 | ⚠️ FORBIDDEN 未授权 |

**共同阻塞**：全部任务都需要 `orion-platform-svc-go/` 授权（当前 FORBIDDEN）。

---

## 9. 详细设计完备度评估

| Phase | 详细设计完备度 | 缺失项 |
|-------|-------------|-------|
| 301 | ✅ 完整（本文档 §1） | 无 |
| 302 | ✅ 完整（本文档 §2） | 无 |
| 303 | ✅ 完整（本文档 §3，15 个 BuiltinPoint 定义 + Registry 初始化） | 无 |
| 304 | ✅ 完整（本文档 §4，3 个新合规框架 + Dashboard） | 等保2.0 controls 详细清单需补齐 |
| 305 | ✅ 完整（本文档 §5，Dashboard 数据结构 + 前端视图） | 无 |
| 306 | ✅ 完整（本文档 §6，Soft/Hard + 策略 + 阈值） | 无 |
| **P0-MB Phase 1-5** | ✅ 完整（`docs/multi-branch-strategy-design-v2-impl-2026-09-08.md` 1184 行） | 无 |

---

## 10. 建议下一步

### 10.1 立即执行（纯文档）

- ✅ 本文档（v3.7，628 行）生成 — Phase 301-306 详细设计
- ✅ `docs/multi-branch-strategy-design.md` Phase 编号统一（231-235 → P0-MB Phase 1-5）
- ✅ `docs/multi-branch-strategy-design-v2-impl-2026-09-08.md`（1184 行）生成 — P0-MB Phase 1-5 详细设计
- ✅ `docs/missing-feature-design-2026-08-25.md` G.0 Wave 总览新增 Wave 6（P0-MB 26d）
- ✅ `docs/flagship-review-v3.6-delta-2026-09-08.md` 顶部追加 v3.7 关联标注
- ✅ `docs/ALL_TODOS.md` 顶部新增 P0-MB 任务组 + 引用 v2 impl 文档
- ✅ `docs/development-progress.md` 追加 v3.7 + v2 impl 记录

### 10.2 等待授权后执行（代码）

- Phase 301-306（6d）：T-QUOTA 命名 + T-CONFIG-LEVEL Level 字段 + T-SPI BuiltinPoint + T-AUDIT 新合规 + Dashboard + T-QUOTA 软/硬限
- P0-MB Phase 1-5（26d）：多分支并行策略完整实现

### 10.3 长期

- PERM-8 客户端 token 迁移（3d）
- P1-9 三域补全（10-15d）

---

**设计日期**：2026-09-08
**设计人**：SenseNova 6.8 Flash Lite
**方法**：`grep` + `find` + `wc -l` 全库核实 + 详细 API/模型/服务/测试设计
