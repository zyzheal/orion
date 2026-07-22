package models

import "time"

// Locale represents a locale definition.
type Locale struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	LocaleCode string   `json:"locale_code" db:"locale_code"`
	LocaleName string   `json:"locale_name" db:"locale_name"`
	IsDefault bool      `json:"is_default" db:"is_default"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// Translation represents a single translation entry.
type Translation struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	LocaleCode string   `json:"locale_code" db:"locale_code"`
	Namespace  string   `json:"namespace" db:"namespace"`
	Key        string   `json:"key" db:"key"`
	Value      string   `json:"value" db:"value"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// CreateLocaleRequest is the body for creating a locale.
type CreateLocaleRequest struct {
	LocaleCode string `json:"locale_code" binding:"required"`
	LocaleName string `json:"locale_name" binding:"required"`
	IsDefault  bool   `json:"is_default"`
}

// SetTranslationRequest is the body for creating/updating a translation.
type SetTranslationRequest struct {
	LocaleCode string `json:"locale_code" binding:"required"`
	Namespace  string `json:"namespace" binding:"required"`
	Key        string `json:"key" binding:"required"`
	Value      string `json:"value" binding:"required"`
}

// SetBulkTranslationsRequest is the body for bulk-setting translations.
type SetBulkTranslationsRequest struct {
	LocaleCode   string            `json:"locale_code" binding:"required"`
	Namespace    string            `json:"namespace" binding:"required"`
	Translations map[string]string `json:"translations" binding:"required"`
}
