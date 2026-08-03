package models

import "time"

type MaskingStrategy string

const (
	StrategyFull     MaskingStrategy = "full"
	StrategyPartial  MaskingStrategy = "partial"
	StrategyRegex    MaskingStrategy = "regex"
	StrategyHash     MaskingStrategy = "hash"
)

type MaskingRule struct {
	ID            string          `json:"id" db:"id"`
	TenantID      string          `json:"tenantId" db:"tenant_id"`
	Name          string          `json:"name" db:"name"`
	Description   string          `json:"description" db:"description"`
	Strategy      MaskingStrategy `json:"strategy" db:"strategy"`
	FieldPattern  string          `json:"fieldPattern" db:"field_pattern"`
	ResourceType  string          `json:"resourceType" db:"resource_type"`
	Replacement   string          `json:"replacement" db:"replacement"`
	ClassificationLevel string   `json:"classificationLevel" db:"classification_level"`
	Enabled       bool            `json:"enabled" db:"enabled"`
	CreatedAt     time.Time       `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time       `json:"updatedAt" db:"updated_at"`
}

type MaskRequest struct {
	Data       map[string]interface{} `json:"data" binding:"required"`
	ResourceType string               `json:"resourceType" binding:"required"`
	UserRole   string                 `json:"userRole"`
}

type MaskResult struct {
	MaskedData  map[string]interface{} `json:"maskedData"`
	MaskedFields []string              `json:"maskedFields"`
}