package models

type PrivacyConfig struct {
    ID        string `json:"id" db:"id"`
    TenantID  string `json:"tenantId" db:"tenant_id"`
    DataMask  string `json:"dataMask" db:"data_mask"`
    Retention string `json:"retention" db:"retention"`
}
