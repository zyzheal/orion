package interfaces

import (
	"context"
	"io"

	"orion/platform-svc-go/internal/import-export/models"
)

// ---------- Core interfaces ----------

// ImportHandler defines the contract for importing data for a specific data type.
//
// A single handler focuses on one DataType() (e.g. "ticket", "alert", "user") and
// supports the formats its parent formatter layer can provide (CSV / JSON / Excel).
type ImportHandler interface {
	// DataType returns the logical type this handler manages, e.g. "ticket".
	DataType() string

	// Import reads the raw source, validates rows, inserts them, and returns
	// aggregate results. For large payloads callers are expected to pass an
	// async context.
	Import(ctx context.Context, source io.Reader, format string,
		opts *models.ImportOpts) (*models.ImportResult, error)

	// Validate performs import checks only (dry-run) and returns the list of
	// validation errors without writing any data.
	Validate(ctx context.Context, source io.Reader, format string,
		opts *models.ImportOpts) ([]models.ValidationError, error)

	// GetImportColumns declares the fields this data type exposes for import.
	// Consumers (the factory/formatters) use it to map spreadsheet headers to
	// internal fields.
	GetImportColumns() []ImportColumn
}

// ExportHandler defines the contract for exporting data for a specific data type.
type ExportHandler interface {
	// DataType returns the logical type this handler manages, e.g. "ticket".
	DataType() string

	// Export queries the data source, transforms the rows, and returns them as
	// a stream reader together with the content type for the requested format.
	Export(ctx context.Context, filter map[string]interface{}, format string,
		opts *models.ExportOpts) (io.Reader, string, error)
}

// ---------- Column mapping ----------

// ImportColumn describes a single field that a handler accepts via import.
type ImportColumn struct {
	// Name is the human-readable label used in spreadsheet headers.
	Name string
	// Field is the internal key used in the data model.
	Field string
	// Required means the column cannot be empty for a valid row.
	Required bool
	// Type hints at the expected Go type for validation (string, int, bool, date).
	Type string
}
