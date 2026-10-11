// Schema validation entry (ADR-013 §4.2).
//
// Provides the top-level ValidateCIAttributes function which takes a
// CI type's attribute definitions and a map of attribute values, then
// returns a list of validation errors.
//
// This is the "CI attributes ↔ type.attributes 双向校验" contract:
//   - Every REQUIRED attribute must be present in values
//   - Every attribute that has a Validator config must have its value
//     validated against the config
//   - Extra keys in values are reported as unknown attributes
//
// Nil-tolerant: passing nil for any input returns an empty result
// rather than panicking, which keeps callers simple.
package attribute

import (
	"context"
	"errors"
	"fmt"
)

// ValidationErrors is the ordered list of errors from a ValidateCIAttributes
// call. Empty slice means the CI passed validation.
type ValidationErrors struct {
	Errors []error
}

// Len returns the number of validation errors.
func (v *ValidationErrors) Len() int {
	if v == nil {
		return 0
	}
	return len(v.Errors)
}

// ErrorsOrNil returns the errors slice, or nil if empty.
func (v *ValidationErrors) ErrorsOrNil() []error {
	if v == nil || len(v.Errors) == 0 {
		return nil
	}
	return v.Errors
}

// Error satisfies the error interface (returns a summary string).
func (v *ValidationErrors) Error() string {
	if v == nil || len(v.Errors) == 0 {
		return "attribute: no validation errors"
	}
	return fmt.Sprintf("attribute: %d validation error(s): %v", len(v.Errors), v.Errors)
}

// Is lets errors.Is(err, ErrValidationError) match any ValidationErrors.
func (v *ValidationErrors) Is(target error) bool {
	return target == ErrValidationError && v != nil && len(v.Errors) > 0
}

// ErrValidationError is the sentinel for validation failures.
// Returned by the schema validator when there are errors.
var ErrValidationError = errors.New("attribute: validation failed")

// ValidateCIAttributes validates the given values against the CI type's
// attribute definitions. Returns a *ValidationErrors with any problems
// found (nil when there are no errors).
//
// The factory is used to build a Validator per attribute. If factory is
// nil, a default factory is used (WithDefaults).
func ValidateCIAttributes(
	ctx context.Context,
	factory *AttrValueHandlerFactory,
	tenantID string,
	entityID string,
	definitions []*Attribute,
	values map[string]any,
) *ValidationErrors {
	_ = ctx // reserved for future validators that need tenant-aware lookups
	result := &ValidationErrors{}
	if len(definitions) == 0 {
		return result
	}
	if factory == nil {
		factory = NewWithDefaults()
	}

	valuesByAttrName := values
	if values == nil {
		valuesByAttrName = map[string]any{}
	}

	// Track which attribute definitions were matched by a value.
	seenAttrs := make(map[string]bool, len(definitions))

	for _, def := range definitions {
		if def == nil {
			result.Errors = append(result.Errors, fmt.Errorf("attribute: nil attribute definition"))
			continue
		}
		if def.ID == "" {
			result.Errors = append(result.Errors, fmt.Errorf("attribute %s: missing id", def.Name))
			continue
		}

		val, present := valuesByAttrName[def.Name]
		if !present {
			seenAttrs[def.Name] = false
			if def.Required {
				result.Errors = append(result.Errors, &ValidationError{
					Attribute: def.Name,
					Reason:    "required attribute missing",
				})
			}
			continue
		}
		seenAttrs[def.Name] = true

		validator, err := factory.BuildValidator(def)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Errorf("attribute %s: build validator: %w", def.Name, err))
			continue
		}
		if err := validator.Validate(&ValidationContext{
			Attribute: def,
			EntityID:  entityID,
			TenantID:  tenantID,
		}, val); err != nil {
			result.Errors = append(result.Errors, &ValidationError{
				Attribute: def.Name,
				Reason:    "value failed validation",
				Err:       err,
			})
		}
	}

	// Report unknown keys in values (extra attributes).
	for k := range valuesByAttrName {
		if !seenAttrs[k] {
			result.Errors = append(result.Errors, &ValidationError{
				Attribute: k,
				Reason:    "unknown attribute (not declared in CI type schema)",
			})
		}
	}

	return result
}

// IsValid returns true iff validationErrors has zero errors.
func IsValid(v *ValidationErrors) bool {
	return v == nil || len(v.Errors) == 0
}
