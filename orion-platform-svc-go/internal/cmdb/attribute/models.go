// Package attribute implements ADR-013 §4.2 (CMDB 二阶模型决策) attribute
// metadata and value validation.
//
// Design intent:
//   - Attribute is the metadata definition (对标 NL AttrVo).
//   - AttributeType enumerates the 5 supported attribute types.
//   - Validator is the SPI for value validation (enum/range/regex/ci-ref).
//   - ValidatorFactory is the registry for custom validators (ADR-012 style).
//
// Migration dependency: 706 (cmdb_ci_types), 707 (cmdb_cis.type_id).
package attribute

// AttributeType enumerates the 5 supported attribute types
// (ADR-013 §4.2, 对标 NL AttrTypeVo).
type AttributeType string

const (
	// AttrTypeString: free-form text.
	AttrTypeString AttributeType = "string"
	// AttrTypeInt: integer value.
	AttrTypeInt AttributeType = "int"
	// AttrTypeEnum: one of a fixed set of values (validator.values).
	AttrTypeEnum AttributeType = "enum"
	// AttrTypeJSON: arbitrary JSON document.
	AttrTypeJSON AttributeType = "json"
	// AttrTypeCIRef: reference to another CI entity (targetCiId).
	AttrTypeCIRef AttributeType = "ci-ref"
)

// String returns the string form.
func (t AttributeType) String() string { return string(t) }

// Attribute is the metadata definition for a CMDB attribute.
// Mirrors the NL AttrVo (45 fields) as a practical subset (10 fields).
type Attribute struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	AttributeType AttributeType  `json:"attributeType"`
	Required      bool           `json:"required"`
	Default       any            `json:"default"`
	Validator     map[string]any `json:"validator"` // enum/range/regex params
	TargetCiID    *string        `json:"targetCiId,omitempty"`
	Config        map[string]any `json:"config"`
}

// Validator is the SPI for attribute value validation.
type Validator interface {
	// Validate checks whether value satisfies the attribute's constraints.
	// Return nil if valid; return an error with a human-readable message
	// if invalid. The validator must not mutate value.
	Validate(ctx *ValidationContext, value any) error
}

// ValidationContext carries the ambient data a validator may need.
type ValidationContext struct {
	// Attribute is the definition being validated against.
	Attribute *Attribute
	// EntityID is the CI entity being validated (for ci-ref validators).
	EntityID string
	// TenantID is the tenant context (for multi-tenant validation).
	TenantID string
}

// ValidationError wraps a validation failure with the attribute name.
type ValidationError struct {
	Attribute string
	Reason    string
	Err       error
}

// Error returns the formatted error message.
func (e *ValidationError) Error() string {
	if e.Err != nil {
		return "attribute " + e.Attribute + ": " + e.Reason + ": " + e.Err.Error()
	}
	return "attribute " + e.Attribute + ": " + e.Reason
}

// Unwrap returns the underlying error (if any).
func (e *ValidationError) Unwrap() error { return e.Err }
