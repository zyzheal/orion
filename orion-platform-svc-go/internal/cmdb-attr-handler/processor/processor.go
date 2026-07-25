// Package processor provides the CMDB attribute value processor — the domain
// orchestration layer that validates, transforms, and persists attribute values.
//
// It sits above the per-type value handlers (valhandlers) and the runtime
// Validator (validator package), coordinating the full lifecycle of a CMDB CI
// attribute value: input validation → runtime rules → type validation →
// transformation → persistence.
//
// The processor has NO dependency on the handler.Service type; it only requires
// the Repository (for persistence) and a map of value handlers (injected at
// construction time). This keeps the layer boundaries explicit and testable.
package processor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"

	"orion/platform-svc-go/internal/cmdb-attr-handler/models"
	"orion/platform-svc-go/internal/cmdb-attr-handler/validator"
	"orion/platform-svc-go/internal/cmdb-attr-handler/valhandlers"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// Public errors
// ---------------------------------------------------------------------------

var (
	ErrInvalidDataType    = errors.New("invalid attribute data type")
	ErrMissingAttributeName = errors.New("attribute name is required")
	ErrValidationFailed   = errors.New("attribute value validation failed")
	ErrPersistFailed      = errors.New("failed to persist attribute value")
	ErrTransformFailed    = errors.New("failed to transform attribute value")
)

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

// AttributeValue holds the domain representation of a CMDB CI attribute.
//
//   attributeName  — human-readable name of the attribute (e.g. "cpu_model").
//   value          — raw input value as a string; may be empty to request default.
//   dataType       — attribute type identifier (string|number|boolean|enum|
//                    reference|date|json|datetime|... any built-in or custom type).
//   validationRules — optional runtime validation rules passed to the Validator.
//   defaultValue   — optional fallback used when value is empty.
type AttributeValue struct {
	AttributeName   string            `json:"attribute_name"`
	Value           string            `json:"value"`
	DataType        string            `json:"data_type"`
	ValidationRules map[string]string `json:"validation_rules,omitempty"`
	DefaultValue    string            `json:"default_value,omitempty"`
}

// ValidateAttributeValue is the input for Validate (no persistence).
type ValidateAttributeValue struct {
	AttributeName   string            `json:"attribute_name"`
	Value           string            `json:"value"`
	DataType        string            `json:"data_type"`
	ValidationRules map[string]string `json:"validation_rules,omitempty"`
}

// ProcessedValue is the output of Process containing the typed, persisted result.
type ProcessedValue struct {
	AttributeName    string               `json:"attribute_name"`
	Value            interface{}          `json:"value"`
	SerializedValue  string               `json:"serialized_value"`
	DataType         string               `json:"data_type"`
	AppliedDefault   bool                 `json:"applied_default"`
	Record           *models.CMDBAttributeValue
}

// ---------------------------------------------------------------------------
// Interfaces — minimal contracts the processor needs
// ---------------------------------------------------------------------------

// Repository is the persistence interface the processor delegates to.
type Repository interface {
	Upsert(ctx context.Context, tenantID, ciID, attrID, value, attrType string) error
	Get(ctx context.Context, tenantID, ciID, attrID string) (*models.CMDBAttributeValue, error)
	Delete(ctx context.Context, tenantID, ciID, attrID string) error
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

// Processor orchestrates validate → transform → persist for CMDB CI attributes.
//
// It is built from a registry of value handlers, a validator, a repository, and
// an optional service for list/get semantics. The processor itself is stateless
// and safe for concurrent use once built.
type Processor struct {
	mu sync.RWMutex

	// handlers maps data type -> value handler (owned by the processor, not the
	// service, so that the processor can operate independently).
	handlers map[string]handlers.AttributeValueHandler

	validator *validator.Validator
	repo      Repository
	svc       Service // optional — used for list/count; nil is OK
	logger    *zap.Logger
}

// Service defines the service-layer interface the processor may call for
// list/count/get operations when it is wired alongside handler.Service.
type Service interface {
	ListValues(ctx context.Context, tenantID, ciID string, offset, limit int) ([]models.CMDBAttributeValue, error)
	CountValues(ctx context.Context, tenantID, ciID string) (int, error)
}

// NewProcessor creates a Processor backed by the given Repository.
// All built-in attribute type handlers (including "date") are pre-registered.
// Pass an optional Service for list/count semantics, or nil to skip them.
func NewProcessor(repo Repository, svc Service, logger *zap.Logger) *Processor {
	p := &Processor{
		handlers: make(map[string]handlers.AttributeValueHandler),
		validator: validator.NewValidator(logger),
		repo:      repo,
		svc:       svc,
		logger:    logger.Named("cmdb-attr-processor"),
	}
	for t, h := range handlers.AllHandlers() {
		p.handlers[t] = h
	}
	return p
}

// Register adds (or overrides) a custom type handler.
func (p *Processor) Register(h handlers.AttributeValueHandler) {
	if h == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.handlers[h.Type()] = h
}

// getHandler returns the handler for a data type, or ErrInvalidDataType.
func (p *Processor) getHandler(dataType string) (handlers.AttributeValueHandler, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	h, ok := p.handlers[dataType]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrInvalidDataType, dataType)
	}
	return h, nil
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Process validates, transforms, and persists an attribute value for a CI.
//
// When aValue.Value is empty and aValue.DefaultValue is set, the default is used
// (with AppliedDefault=true in the result). The returned ProcessedValue contains
// the typed parsed value, the serialised storage form, and the persisted record.
func (p *Processor) Process(ctx context.Context, tenantID, ciID, attrID string, aValue *AttributeValue) (*ProcessedValue, error) {
	if err := p.processInput(aValue); err != nil {
		return nil, err
	}

	effective, appliedDefault := p.resolveValue(aValue)

	// 1. Runtime validation rules (required, allowed set, regex, format, ...)
	if err := p.validator.Validate(aValue.DataType, effective, aValue.ValidationRules); err != nil {
		return nil, fmt.Errorf("%w (rules %s/%s): %w", ErrValidationFailed, aValue.AttributeName, aValue.DataType, err)
	}

	// 2. Type handler validation
	if err := p.validateType(aValue.DataType, effective); err != nil {
		return nil, fmt.Errorf("%w (type %s/%s): %w", ErrValidationFailed, aValue.AttributeName, aValue.DataType, err)
	}

	// 3. Transform (parse) via type handler
	typedValue, err := p.transform(aValue.DataType, effective)
	if err != nil {
		return nil, fmt.Errorf("%w (%s): %w", ErrTransformFailed, aValue.DataType, err)
	}

	// 4. Serialize for persistence
	serialized := p.serialize(aValue.DataType, typedValue)

	// 5. Persist
	if err := p.repo.Upsert(ctx, tenantID, ciID, attrID, serialized, aValue.DataType); err != nil {
		return nil, fmt.Errorf("%w (upsert %s): %w", ErrPersistFailed, attrID, err)
	}

	// 6. Fetch the record back
	attr, err := p.repo.Get(ctx, tenantID, ciID, attrID)
	if err != nil {
		return nil, fmt.Errorf("%w (fetch %s): %w", ErrPersistFailed, attrID, err)
	}

	p.logger.Info("processed attribute value",
		zap.String("tenant_id", tenantID),
		zap.String("ci_id", ciID),
		zap.String("attribute_id", attrID),
		zap.String("attribute_name", aValue.AttributeName),
		zap.String("data_type", aValue.DataType),
		zap.Bool("applied_default", appliedDefault),
	)

	return &ProcessedValue{
		AttributeName:   aValue.AttributeName,
		Value:           typedValue,
		SerializedValue: serialized,
		DataType:        aValue.DataType,
		AppliedDefault:  appliedDefault,
		Record:          attr,
	}, nil
}

// Validate checks an attribute value against runtime rules + type rules without
// persisting. Useful for form submission pre-flight checks.
func (p *Processor) Validate(aValue *ValidateAttributeValue) error {
	if aValue.DataType == "" {
		return errors.New("data type is required")
	}
	if aValue.AttributeName == "" {
		return ErrMissingAttributeName
	}
	if _, ok := p.handlers[aValue.DataType]; !ok {
		return fmt.Errorf("%w: %s", ErrInvalidDataType, aValue.DataType)
	}
	// Runtime rules
	if err := p.validator.Validate(aValue.DataType, aValue.Value, aValue.ValidationRules); err != nil {
		return err
	}
	// Type rules
	if _, ok := p.handlers[aValue.DataType]; !ok {
		return fmt.Errorf("%w: %s", ErrInvalidDataType, aValue.DataType)
	}
	h := p.handlers[aValue.DataType]
	return h.Validate(aValue.Value)
}

// Parse parses a raw value for a given data type.
func (p *Processor) Parse(dataType, value string) (interface{}, error) {
	return p.transform(dataType, value)
}

// Serialize converts a typed value to its string storage form.
func (p *Processor) Serialize(dataType string, v interface{}) string {
	return p.serialize(dataType, v)
}

// GetHandler returns the handler for a data type.
func (p *Processor) GetHandler(dataType string) (handlers.AttributeValueHandler, error) {
	return p.getHandler(dataType)
}

// ListValues lists attribute values for a CI.
func (p *Processor) ListValues(ctx context.Context, tenantID, ciID string, offset, limit int) ([]models.CMDBAttributeValue, error) {
	if p.svc == nil {
		return nil, errors.New("processor service not set; cannot list values")
	}
	return p.svc.ListValues(ctx, tenantID, ciID, offset, limit)
}

// CountValues returns the number of attribute values for a CI.
func (p *Processor) CountValues(ctx context.Context, tenantID, ciID string) (int, error) {
	if p.svc == nil {
		return 0, errors.New("processor service not set; cannot count values")
	}
	return p.svc.CountValues(ctx, tenantID, ciID)
}

// GetHandlerInfo returns metadata for a registered data type.
func (p *Processor) GetHandlerInfo(dataType string) (*models.HandlerInfo, error) {
	if _, ok := p.handlers[dataType]; !ok {
		return nil, fmt.Errorf("%w: %s", ErrInvalidDataType, dataType)
	}
	return &models.HandlerInfo{
		Type:        dataType,
		Description: dataType + " attribute value processor",
	}, nil
}

// ListHandlerInfos returns all registered data types.
func (p *Processor) ListHandlerInfos() []models.HandlerInfo {
	info := make([]models.HandlerInfo, 0, len(p.handlers))
	for t, h := range p.handlers {
		info = append(info, models.HandlerInfo{
			Type:        t,
			Description: h.Type() + " attribute value processor",
		})
	}
	return info
}

// SupportedTypes returns the list of supported data type identifiers, sorted.
func (p *Processor) SupportedTypes() []string {
	types := make([]string, 0, len(p.handlers))
	for t := range p.handlers {
		types = append(types, t)
	}
	sort.Strings(types)
	return types
}

// ---------------------------------------------------------------------------
// Internal pipeline steps
// ---------------------------------------------------------------------------

// processInput validates the AttributeValue input fields (non-empty checks).
func (p *Processor) processInput(av *AttributeValue) error {
	if av == nil {
		return errors.New("attribute value is required")
	}
	if av.AttributeName == "" {
		return ErrMissingAttributeName
	}
	if av.DataType == "" {
		return errors.New("data type is required")
	}
	return nil
}

// resolveValue returns the effective value and whether a default was applied.
func (p *Processor) resolveValue(av *AttributeValue) (string, bool) {
	if av.Value != "" {
		return av.Value, false
	}
	if av.DefaultValue != "" {
		return av.DefaultValue, true
	}
	return "", false
}

// validateType runs the type-handler's Validate for a value.
func (p *Processor) validateType(dataType, value string) error {
	h, ok := p.handlers[dataType]
	if !ok {
		return fmt.Errorf("%w: %s", ErrInvalidDataType, dataType)
	}
	return h.Validate(value)
}

// transform parses the raw value using the type handler.
func (p *Processor) transform(dataType, value string) (interface{}, error) {
	h, ok := p.handlers[dataType]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrInvalidDataType, dataType)
	}
	return h.Parse(value)
}

// serialize converts a typed value to its string storage form.
func (p *Processor) serialize(dataType string, v interface{}) string {
	h, ok := p.handlers[dataType]
	if !ok {
		if v == nil {
			return ""
		}
		if b, err := json.Marshal(v); err == nil {
			return string(b)
		}
		return fmt.Sprintf("%v", v)
	}
	return h.Serialize(v)
}

// ---------------------------------------------------------------------------
// Re-export key validator constants for callers
// ---------------------------------------------------------------------------

// ValidationRules returns the canonical rule-key documentation for consumer docs.
func ValidationRules() map[string]string {
	return map[string]string{
		"required":         "true — value must not be empty",
		"nullable":         "false — zero-value / empty is rejected",
		"min":              "min string length (string) or min numeric value (number)",
		"max":              "max string length (string) or max numeric value (number)",
		"min_value":        "minimum numeric value (number)",
		"max_value":        "maximum numeric value (number)",
		"precision":        "max total digits (number)",
		"scale":            "max decimal places (number)",
		"regex":            "PCRE pattern that the value must match",
		"pattern":          "alias for regex",
		"allowed":          "comma-separated list of allowed values",
		"allowed_set":      "JSON array of allowed values (superset of allowed)",
		"case_insensitive": "true — makes allowed/allowed_set case-insensitive",
		"format":           "named format: email|ip|ipv4|ipv6|uuid|url|date",
		"uuid":             "true — reference value must be a UUID",
		"options":          "comma-separated enum options (enum type)",
	}
}
