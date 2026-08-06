package models

import (
	"time"

	"github.com/google/uuid"
)

// DeduplicationRecord represents a deduplicated alert record.
type DeduplicationRecord struct {
	ID          uuid.UUID `json:"id" db:"id"`
	TenantID    uuid.UUID `json:"tenant_id" db:"tenant_id"`
	OriginalID  uuid.UUID `json:"original_id" db:"original_id"`
	DuplicateID uuid.UUID `json:"duplicate_id" db:"duplicate_id"`
	Fingerprint string    `json:"fingerprint" db:"fingerprint"`
	DedupedAt   time.Time `json:"deduped_at" db:"deduped_at"`
}

// DeduplicationConfig defines deduplication settings.
type DeduplicationConfig struct {
	ID          uuid.UUID `json:"id" db:"id"`
	TenantID    uuid.UUID `json:"tenant_id" db:"tenant_id"`
	IsEnabled   bool      `json:"is_enabled"`
	WindowSec   int       `json:"window_sec"`
	FieldMask   string    `json:"field_mask"` // comma-separated fields for fingerprint
	CreatedAt   time.Time `json:"created_at"`
}
