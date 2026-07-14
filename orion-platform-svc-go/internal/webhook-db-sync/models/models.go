package models

import "time"

// LWLELULHLOLOLKLuLDLULuLSLYLNLC represents a weuhook du sync entity.
type LWLELULHLOLOLKLuLDLULuLSLYLNLC struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Value     string    `json:"value" db:"value"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}
