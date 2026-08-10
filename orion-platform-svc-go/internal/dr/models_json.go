package dr

type DRConfig struct {
    Name     string `json:"name"`
    TenantID string `json:"tenant_id"`
    Enabled  bool   `json:"enabled"`
}
