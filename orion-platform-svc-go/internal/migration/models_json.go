package migration

type MigrationMetadata struct {
    Name       string `json:"name"`
    Version    string `json:"version"`
    TenantID   string `json:"tenant_id"`
    Description string `json:"description,omitempty"`
}
