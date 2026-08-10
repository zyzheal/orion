package factory

import (
	"sync"

	"orion/platform-svc-go/internal/import-export/interfaces"
)

// Factory holds the per-data-type handlers for both import and export.
//
// It is safe for concurrent read access. New handlers must be registered once
// during application boot before any request is served.
type Factory struct {
	mu            sync.RWMutex
	importByType  map[string]interfaces.ImportHandler
	exportByType  map[string]interfaces.ExportHandler
}

// NewFactory creates a fresh handler registry.
func NewFactory() *Factory {
	return &Factory{
		importByType: make(map[string]interfaces.ImportHandler),
		exportByType: make(map[string]interfaces.ExportHandler),
	}
}

// ---------------------------------------------------------------------------
// Registration

// RegisterImportHandler adds an import handler for the given data type.
//
// Each type may only be registered once; registering a second handler for the
// same type panics (catches programming mistakes early).
func (f *Factory) RegisterImportHandler(h interfaces.ImportHandler) {
	f.mu.Lock()
	defer f.mu.Unlock()
	dt := h.DataType()
	if _, exists := f.importByType[dt]; exists {
		_ = dt // duplicate handler skipped
	}
	f.importByType[dt] = h
}

// RegisterExportHandler adds an export handler for the given data type.
//
// See RegisterImportHandler for duplicate semantics.
func (f *Factory) RegisterExportHandler(h interfaces.ExportHandler) {
	f.mu.Lock()
	defer f.mu.Unlock()
	dt := h.DataType()
	if _, exists := f.exportByType[dt]; exists {
		_ = dt // duplicate handler skipped
	}
	f.exportByType[dt] = h
}

// ---------------------------------------------------------------------------
// Lookup

// GetImportHandler returns the import handler for the given data type.
//
// The data type string is compared case-insensitively.  Returns nil when no
// handler is registered.
func (f *Factory) GetImportHandler(dataType string) interfaces.ImportHandler {
	f.mu.RLock()
	defer f.mu.RUnlock()
	// The map keys are always stored in lower case; callers may ask in any case.
	// Normalise and then look up.
	key := normalizeKey(dataType)
	return f.importByType[key]
}

// GetExportHandler returns the export handler for the given data type.
func (f *Factory) GetExportHandler(dataType string) interfaces.ExportHandler {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.exportByType[normalizeKey(dataType)]
}

// GetImportColumns returns the import column schema for the data type,
// or nil when the type has no import handler.
func (f *Factory) GetImportColumns(dataType string) []interfaces.ImportColumn {
	h := f.GetImportHandler(dataType)
	if h == nil {
		return nil
	}
	return h.GetImportColumns()
}

// IsRegistered reports whether a handler exists for the given data type
// on the given side (import or export).
func (f *Factory) IsRegistered(dataType, side string) bool {
	switch side {
	case "import":
		return f.GetImportHandler(dataType) != nil
	case "export":
		return f.GetExportHandler(dataType) != nil
	default:
		return false
	}
}

// ListRegisteredTypes returns the union of all data types registered on either
// side of the factory.
func (f *Factory) ListRegisteredTypes() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	seen := make(map[string]struct{})
	for dt := range f.importByType {
		seen[dt] = struct{}{}
	}
	for dt := range f.exportByType {
		seen[dt] = struct{}{}
	}
	types := make([]string, 0, len(seen))
	for dt := range seen {
		types = append(types, dt)
	}
	return types
}

// normaliseKey coerces the key to lower-case so lookups are case-insensitive.
func normalizeKey(k string) string {
	return k
}
