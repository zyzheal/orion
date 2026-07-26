package models

import (
	"time"

	"github.com/google/uuid"
)

// DeduplicationRecord represents a deduplicated alert record.
type DeduplicationRecord struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	OriginalID  uuid.UUID `json:"original_id"`
	DuplicateID uuid.UUID `json:"duplicate_id"`
	Fingerprint string    `json:"fingerprint"`
	DedupedAt   time.Time `json:"deduped_at"`
}

// DeduplicationConfig defines deduplication settings.
type DeduplicationConfig struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	IsEnabled   bool      `json:"is_enabled"`
	WindowSec   int       `json:"window_sec"`
	FieldMask   string    `json:"field_mask"` // comma-separated fields for fingerprint
	CreatedAt   time.Time `json:"created_at"`
}
