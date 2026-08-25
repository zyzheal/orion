// ============================================================
// Plan 29 — 多租户隔离 (Multi-Tenancy)
// ============================================================
// 优先级: P1
// 来源: v3.5 系统评审
// 本地证据:
//   - internal/tenant/: 有租户管理模块
//   - internal/tenant-quota/: 有配额管理模块
//   - migrations/002_enable_rls.sql: 已启用 RLS
//   - orion-go-common/pkg/database/rls_test.go: 有 RLS 测试
//   - 544 个迁移文件中仅 2 个顶层 RLS 文件 — 部分模块可能未启用 RLS
// 合并方案:
//   1. 本 Plan 的 BoundaryChecker 用于 RLS 覆盖审计 → plan-44-rls-audit/
//   2. 本 Plan 的 QuotaEnforcer 合并到本地 tenant-quota 模块
//   3. RLS 全覆盖审计脚本 → plan-44-rls-audit/audit_rls_coverage.sql
// 详细设计参见 docs/deliverables/README.md P1-14 小节
// ============================================================

package multitenancy

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "strings"
    "sync"
)

var (
    ErrTenantNotFound     = errors.New("tenant not found")
    ErrTenantSuspended    = errors.New("tenant is suspended")
    ErrQuotaExceeded      = errors.New("tenant quota exceeded")
    ErrCrossTenantAccess  = errors.New("cross-tenant access denied")
    ErrResourceLimit      = errors.New("resource limit reached")
)

type TenantStatus string

const (
    TenantActive     TenantStatus = "active"
    TenantSuspended  TenantStatus = "suspended"
    TenantPending    TenantStatus = "pending"
    TenantExpired    TenantStatus = "expired"
)

type TenantPlan string

const (
    PlanFree    TenantPlan = "free"
    PlanPro     TenantPlan = "pro"
    PlanEnterprise TenantPlan = "enterprise"
)

type Tenant struct {
    ID          string      `json:"id"`
    Name        string      `json:"name"`
    Status      TenantStatus `json:"status"`
    Plan        TenantPlan   `json:"plan"`
    Domain      string      `json:"domain"`
    Quota       TenantQuota `json:"quota"`
    Attributes  map[string]string `json:"attributes"`
    CreatedAt   int64       `json:"createdAt"`
    UpdatedAt   int64       `json:"updatedAt"`
}

type TenantQuota struct {
    MaxUsers        int    `json:"maxUsers"`
    MaxPipelines    int    `json:"maxPipelines"`
    MaxStorageGB    int    `json:"maxStorageGB"`
    MaxAPIQPS       int    `json:"maxAPIQPS"`
    MaxConcurrent   int    `json:"maxConcurrent"`
}

type TenantContext struct {
    TenantID  string
    Tenant    *Tenant
    UserID    string
    Roles     []string
    Attributes map[string]string
}

type TenantStore struct {
    tenants  map[string]*Tenant
    mu       sync.RWMutex
}

func NewTenantStore() *TenantStore {
    return &TenantStore{tenants: make(map[string]*Tenant)}
}

func (s *TenantStore) Create(t *Tenant) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    if _, exists := s.tenants[t.ID]; exists {
        return fmt.Errorf("tenant %s already exists", t.ID)
    }
    if t.Quota == (TenantQuota{}) {
        t.Quota = defaultQuotaForPlan(t.Plan)
    }
    s.tenants[t.ID] = t
    return nil
}

func (s *TenantStore) Get(ctx context.Context, tenantID string) (*Tenant, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    t, ok := s.tenants[tenantID]
    if !ok { return nil, ErrTenantNotFound }
    if t.Status == TenantSuspended { return nil, ErrTenantSuspended }
    return t, nil
}

func (s *TenantStore) UpdateStatus(tenantID string, status TenantStatus) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    t, ok := s.tenants[tenantID]
    if !ok { return ErrTenantNotFound }
    t.Status = status
    return nil
}

func (s *TenantStore) UpdateQuota(tenantID string, quota TenantQuota) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    t, ok := s.tenants[tenantID]
    if !ok { return ErrTenantNotFound }
    t.Quota = quota
    return nil
}

type BoundaryChecker struct {
    store *TenantStore
}

func NewBoundaryChecker(store *TenantStore) *BoundaryChecker {
    return &BoundaryChecker{store: store}
}

func (c *BoundaryChecker) Validate(ctx context.Context, tenantID string) (*TenantContext, error) {
    tenant, err := c.store.Get(ctx, tenantID)
    if err != nil { return nil, err }

    ctxValue := ctx.Value("tenantContext")
    if ctxValue != nil {
        existing, ok := ctxValue.(*TenantContext)
        if ok && existing.TenantID != tenantID {
            return nil, ErrCrossTenantAccess
        }
    }

    tc := &TenantContext{
        TenantID:   tenantID,
        Tenant:     tenant,
        UserID:     ctx.Value("userId").(string),
        Roles:      ctx.Value("roles").([]string),
        Attributes: make(map[string]string),
    }
    return tc, nil
}

type QuotaEnforcer struct {
    store     *TenantStore
    usedCache map[string]map[string]int
    mu        sync.Mutex
}

func NewQuotaEnforcer(store *TenantStore) *QuotaEnforcer {
    return &QuotaEnforcer{store: store, usedCache: make(map[string]map[string]int)}
}

func (e *QuotaEnforcer) Check(ctx context.Context, tenantID string, resourceType string) error {
    tenant, err := e.store.Get(ctx, tenantID)
    if err != nil { return err }

    e.mu.Lock()
    used, _ := e.usedCache[tenantID][resourceType]
    e.mu.Unlock()

    limit := 0
    switch resourceType {
    case "users":        limit = tenant.Quota.MaxUsers
    case "pipelines":    limit = tenant.Quota.MaxPipelines
    case "storage":      limit = tenant.Quota.MaxStorageGB
    case "qps":          limit = tenant.Quota.MaxAPIQPS
    case "concurrent":   limit = tenant.Quota.MaxConcurrent
    default:             return fmt.Errorf("unknown resource type: %s", resourceType)
    }

    if used >= limit {
        return fmt.Errorf("%w: %s limit %d reached (used: %d)", ErrQuotaExceeded, resourceType, limit, used)
    }
    return nil
}

func (e *QuotaEnforcer) Consume(ctx context.Context, tenantID string, resourceType string, amount int) error {
    if err := e.Check(ctx, tenantID, resourceType); err != nil { return err }
    e.mu.Lock()
    if _, ok := e.usedCache[tenantID]; !ok { e.usedCache[tenantID] = make(map[string]int) }
    e.usedCache[tenantID][resourceType] += amount
    e.mu.Unlock()
    return nil
}

func (e *QuotaEnforcer) Release(ctx context.Context, tenantID string, resourceType string, amount int) {
    e.mu.Lock()
    defer e.mu.Unlock()
    if cache, ok := e.usedCache[tenantID]; ok {
        cache[resourceType] -= amount
        if cache[resourceType] < 0 { cache[resourceType] = 0 }
    }
}

type ABACEvaluator struct {
    policies []ABACPolicy
    mu       sync.RWMutex
}

type ABACPolicy struct {
    ID       string            `json:"id"`
    Name     string            `json:"name"`
    Subject  map[string]string `json:"subject"`
    Resource map[string]string `json:"resource"`
    Action   string            `json:"action"`
    Effect   string            `json:"effect"`
    Condition map[string]string `json:"condition"`
}

func NewABACEvaluator() *ABACEvaluator {
    return &ABACEvaluator{policies: make([]ABACPolicy, 0)}
}

func (e *ABACEvaluator) AddPolicy(p ABACPolicy) {
    e.mu.Lock()
    defer e.mu.Unlock()
    e.policies = append(e.policies, p)
}

func (e *ABACEvaluator) Evaluate(subject, resource map[string]string, action string) (bool, error) {
    e.mu.RLock()
    defer e.mu.RUnlock()

    for _, p := range e.policies {
        if !matchesMap(p.Subject, subject) { continue }
        if !matchesMap(p.Resource, resource) { continue }
        if p.Action != action && p.Action != "*" { continue }
        for k, v := range p.Condition {
            if sv, ok := subject[k]; !ok || !strings.Contains(sv, v) {
                goto next
            }
        }
        if p.Effect == "deny" { return false, nil }
        if p.Effect == "allow" { return true, nil }
    next:
    }
    return false, fmt.Errorf("no matching ABAC policy found")
}

func matchesMap(pattern, target map[string]string) bool {
    for k, v := range pattern {
        if v == "*" { continue }
        tv, ok := target[k]
        if !ok || tv != v { return false }
    }
    return true
}

func defaultQuotaForPlan(plan TenantPlan) TenantQuota {
    switch plan {
    case PlanEnterprise: return TenantQuota{MaxUsers: 1000, MaxPipelines: 500, MaxStorageGB: 1000, MaxAPIQPS: 10000, MaxConcurrent: 200}
    case PlanPro:        return TenantQuota{MaxUsers: 100, MaxPipelines: 50, MaxStorageGB: 100, MaxAPIQPS: 1000, MaxConcurrent: 20}
    default:             return TenantQuota{MaxUsers: 10, MaxPipelines: 5, MaxStorageGB: 10, MaxAPIQPS: 100, MaxConcurrent: 5}
    }
}

func MarshalTenant(t *Tenant) ([]byte, error) {
    return json.Marshal(t)
}
