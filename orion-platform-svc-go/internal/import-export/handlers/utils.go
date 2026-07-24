package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"

	"orion/platform-svc-go/internal/import-export/formatters"
	"orion/platform-svc-go/internal/import-export/models"
)

// ---------------------------------------------------------------------------
// Common helpers (shared across all data-type handlers)

// min returns the smaller of a and b.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// getString returns the string value of key, or "" when missing/nil.
func getString(m map[string]interface{}, key string) string {
	v := m[key]
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// formatToJSON marshals records into a JSON array byte slice.
func formatToJSON(records []map[string]interface{}) []byte {
	b, err := json.Marshal(records)
	if err != nil {
		return nil
	}
	return b
}

// readerFromBytes wraps a byte slice into an io.Reader.
func readerFromBytes(b []byte) io.Reader {
	if b == nil {
		return strings.NewReader("[]\n")
	}
	return bytes.NewReader(b)
}

// formatToCSV builds a CSV reader from records.
func formatToCSV(records []map[string]interface{}) io.Reader {
	var buf bytes.Buffer
	if err := formatters.ToCSVRows(&buf, records, nil, true); err != nil {
		buf.WriteString("key,value\n")
	}
	return &buf
}

// writeErrors persist a slice of validation errors to the repository.
func writeErrors(repo interface {
	BatchSaveErrors(ctx context.Context, errs []models.ValidationError) error
}, ctx context.Context, errs []models.ValidationError) error {
	return repo.BatchSaveErrors(ctx, errs)
}
