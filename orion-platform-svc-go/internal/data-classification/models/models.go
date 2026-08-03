package models

import "time"

type ClassificationLevel string

const (
	LevelPublic     ClassificationLevel = "public"
	LevelInternal   ClassificationLevel = "internal"
	LevelConfidential ClassificationLevel = "confidential"
	LevelRestricted ClassificationLevel = "restricted"
	LevelCritical   ClassificationLevel = "critical"
)

type ClassificationRule struct {
	ID            string              `json:"id" db:"id"`
	TenantID      string              `json:"tenantId" db:"tenant_id"`
	Name          string              `json:"name" db:"name"`
	Description   string              `json:"description" db:"description"`
	Level         ClassificationLevel `json:"level" db:"level"`
	Pattern       string              `json:"pattern" db:"pattern"`
	ResourceType  string              `json:"resourceType" db:"resource_type"`
	Enabled       bool                `json:"enabled" db:"enabled"`
	CreatedAt     time.Time           `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time           `json:"updatedAt" db:"updated_at"`
}

type ClassifiedResource struct {
	ID          string              `json:"id" db:"id"`
	TenantID    string              `json:"tenantId" db:"tenant_id"`
	ResourceID  string              `json:"resourceId" db:"resource_id"`
	ResourceType string             `json:"resourceType" db:"resource_type"`
	Level       ClassificationLevel `json:"level" db:"level"`
	RuleID      string              `json:"ruleId" db:"rule_id"`
	ClassifiedBy string             `json:"classifiedBy" db:"classified_by"`
	CreatedAt   time.Time           `json:"createdAt" db:"created_at"`
}

type CreateRuleRequest struct {
	Name         string              `json:"name" binding:"required"`
	Description  string              `json:"description"`
	Level        ClassificationLevel `json:"level" binding:"required"`
	Pattern      string              `json:"pattern" binding:"required"`
	ResourceType string              `json:"resourceType" binding:"required"`
}

type ClassifyRequest struct {
	ResourceID   string `json:"resourceId" binding:"required"`
	ResourceType string `json:"resourceType" binding:"required"`
	Content      string `json:"content"`
}