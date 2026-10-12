package models

import "time"

// InspectionTemplate defines a reusable inspection rule set.
type InspectionTemplate struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenantId" db:"tenant_id"`
	Name          string    `json:"name" db:"name"`
	Description   *string   `json:"description" db:"description"`
	Category      string    `json:"category" db:"category"`
	TargetType    string    `json:"targetType" db:"target_type"`
	Rules         []Rule    `json:"rules" db:"rules"`
	Enabled       bool      `json:"enabled" db:"enabled"`
	Version       int       `json:"version" db:"version"`
	CreatedBy     string    `json:"createdBy" db:"created_by"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt" db:"updated_at"`
}

// Rule is a single inspection rule within a template.
type Rule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	CheckType   string `json:"checkType"`
	Target      string `json:"target"`
	Expression  string `json:"expression"`
	Threshold   *float64 `json:"threshold"`
	Critical    bool   `json:"critical"`
	Remediation *string `json:"remediation"`
}

// CreateTemplateRequest is the request body for creating a template.
type CreateTemplateRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Category    string  `json:"category"`
	TargetType  string  `json:"targetType"`
	Rules       []Rule  `json:"rules"`
	Enabled     bool    `json:"enabled"`
	TenantID    *string `json:"tenantId"`
	CreatedBy   string  `json:"createdBy"`
}

// UpdateTemplateRequest is the request body for updating a template.
type UpdateTemplateRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Category    *string `json:"category"`
	TargetType  *string `json:"targetType"`
	Rules       []Rule  `json:"rules"`
	Enabled     *bool   `json:"enabled"`
}
