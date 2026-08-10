package lock

type LockMetadata struct {
    Key      string `json:"key"`
    TenantID string `json:"tenant_id"`
    Holder   string `json:"holder"`
    Expired  bool   `json:"expired"`
}
