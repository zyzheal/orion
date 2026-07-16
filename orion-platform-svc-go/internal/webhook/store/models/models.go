// Package models defines the domain-agnostic config entry used by webhook/store.
// This replaces 30 separate webhook-* modules (each with identical table schemas)
// with a single table + domain discriminator column.
package models

import "time"

// ConfigEntry represents a generic key-value configuration entry scoped to a
// tenant and domain. The Domain field replaces the 30 separate table names
// that previously existed (webhook-approval, webhook-auth, webhook-cache, ...).
type ConfigEntry struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Domain    string    `json:"domain" db:"domain"`
	Name      string    `json:"name" db:"name"`
	Value     string    `json:"value" db:"value"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// CreateConfigEntryRequest is the request body for creating a config entry.
type CreateConfigEntryRequest struct {
	Name    string `json:"name" validate:"required"`
	Value   string `json:"value" validate:"required"`
	Enabled bool   `json:"enabled"`
}

// UpdateConfigEntryRequest is the request body for updating a config entry.
type UpdateConfigEntryRequest struct {
	Name    *string `json:"name,omitempty"`
	Value   *string `json:"value,omitempty"`
	Enabled *bool   `json:"enabled,omitempty"`
}