package handler

type HandlerTenantFilter struct { TenantID string; Active bool }

func NewHandlerTenantFilter(tenantID string) *HandlerTenantFilter {
    return &HandlerTenantFilter{TenantID: tenantID, Active: true}
}
