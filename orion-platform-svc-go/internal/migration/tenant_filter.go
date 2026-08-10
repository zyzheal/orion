package migration

type TenantFilter struct { TenantID string; Active bool }

func NewTenantFilter(tenantID string) *TenantFilter {
    return &TenantFilter{TenantID: tenantID, Active: true}
}
