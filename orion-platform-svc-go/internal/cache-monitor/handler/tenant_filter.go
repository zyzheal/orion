package handler

import (
    "context"
    "fmt"
    "strings"
)

// TenantContext is a context wrapper that carries tenant_id for multi-tenant operations.
type TenantContext struct {
    ctx      context.Context
    TenantID string
}

func NewTenantContext(ctx context.Context, tenantID string) *TenantContext {
    return &TenantContext{ctx: ctx, TenantID: strings.TrimSpace(tenantID)}
}

func (tc *TenantContext) GetContext() context.Context {
    return tc.ctx
}

func (tc *TenantContext) GetTenantID() string {
    return tc.TenantID
}

func (tc *TenantContext) ValidateTenantID() error {
    if tc.TenantID == "" {
        return fmt.Errorf("cache-monitor: tenant_id is required")
    }
    return nil
}

func (tc *TenantContext) WithTenantFilter(prefix string) string {
    return fmt.Sprintf("%s:%s", tc.TenantID, prefix)
}
