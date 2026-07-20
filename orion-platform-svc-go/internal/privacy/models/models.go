package models

// PrivacyConfig holds per-tenant privacy settings.
type PrivacyConfig struct {
	ID                 string            `json:"id" db:"id"`
	TenantID           string            `json:"tenant_id" db:"tenant_id"`
	DataMask           string            `json:"dataMask" db:"data_mask"` // "enabled"|"disabled"
	RetentionDays      int               `json:"retentionDays" db:"retention_days"`
	DataEncryption     bool              `json:"dataEncryption" db:"data_encryption"`
	AnonymousStats     bool              `json:"anonymousStats" db:"anonymous_stats"`
	CCPAEnabled        bool              `json:"ccpaEnabled" db:"ccpa_enabled"`
	GDPRCompliance     bool              `json:"gdrpCompliance" db:"gdpr_compliance"`
	UserDeletionPolicy string            `json:"userDeletionPolicy" db:"user_deletion_policy"` // "graceful"|"immediate"
	Metadata           map[string]string `json:"metadata" db:"metadata"`
}

// UpdatePrivacyConfigRequest is the input for updating privacy config.
type UpdatePrivacyConfigRequest struct {
	DataMask           *string `json:"dataMask"`
	RetentionDays      *int    `json:"retentionDays"`
	DataEncryption     *bool   `json:"dataEncryption"`
	AnonymousStats     *bool   `json:"anonymousStats"`
	CCPAEnabled        *bool   `json:"ccpaEnabled"`
	GDPRCompliance     *bool   `json:"gdprCompliance"`
	UserDeletionPolicy *string `json:"userDeletionPolicy"`
}

// ComplianceStatus aggregates privacy compliance per tenant.
type ComplianceStatus struct {
	TenantID       string `json:"tenant_id"`
	CCPAEnabled    bool   `json:"ccpa_enabled"`
	GDPRCompliance bool   `json:"gdpr_compliance"`
	DataEncryption bool   `json:"data_encryption"`
	RetentionDays  int    `json:"retention_days"`
}
