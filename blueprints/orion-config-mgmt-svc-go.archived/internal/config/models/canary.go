package models

import "time"

const (
	CanaryStatusActive     = "active"
	CanaryStatusPromoted   = "promoted"
	CanaryStatusRolledBack = "rolled_back"
)

// ConfigCanary represents a canary deployment for a configuration.
type ConfigCanary struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	ConfigID      string    `db:"config_id" json:"config_id"`
	CanaryValue   string    `db:"canary_value" json:"canary_value"`
	BaselineValue string    `db:"baseline_value" json:"baseline_value"`
	Status        string    `db:"status" json:"status"`
	CreatedBy     string    `db:"created_by" json:"created_by"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

type CreateCanaryRequest struct {
	CanaryValue string `json:"canary_value" binding:"required"`
	CreatedBy   string `json:"created_by"`
}