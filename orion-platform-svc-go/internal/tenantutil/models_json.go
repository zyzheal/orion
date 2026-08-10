package tenantutil

type TenantConfig struct {
    TenantID  string `json:"tenant_id"`
    Name      string `json:"name"`
    Enabled   bool   `json:"enabled"`
}
