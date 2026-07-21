package models

import "time"

// LTLILCLKLELTLuLALULTLOLMLALTLILOLN represents a ticket automation entity.
type LTLILCLKLELTLuLALULTLOLMLALTLILOLN struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name" binding:"required"`
	Value     string    `json:"value" db:"value" binding:"required"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}
