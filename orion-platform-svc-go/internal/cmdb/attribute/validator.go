// Built-in validators for ADR-013 §4.2.
//
// Four validators cover the built-in types:
//   - enum: value must be one of Allowed
//   - range: numeric value within [Min, Max]
//   - regex: string matches Pattern (built via BuildValidator + cfg.pattern)
//   - ci-ref: value is a non-empty string (format check; FK check is at DB layer)
//
// Each validator is a stateful struct configured at build time from the
// Attribute.Validator map, and stateless at validate time.
package attribute

import (
	"regexp"
	"fmt"
	"strconv"
)

// EnumValidator checks that value is one of the allowed enum values.
type EnumValidator struct {
	Allowed []string
}

// Validate checks the value against the allowed list.
func (v *EnumValidator) Validate(_ *ValidationContext, value any) error {
	if value == nil {
		return &ValidationError{Reason: "enum value is nil"}
	}
	s, ok := value.(string)
	if !ok {
		return &ValidationError{Reason: fmt.Sprintf("expected string, got %T", value)}
	}
	for _, allowed := range v.Allowed {
		if s == allowed {
			return nil
		}
	}
	return &ValidationError{Reason: fmt.Sprintf("value %q not in allowed list %v", s, v.Allowed)}
}

// RangeValidator checks that a numeric value is within [Min, Max].
type RangeValidator struct {
	Min float64
	Max float64
}

// Validate checks the value is a number in [Min, Max].
func (v *RangeValidator) Validate(_ *ValidationContext, value any) error {
	if value == nil {
		return &ValidationError{Reason: "range value is nil"}
	}
	n, ok := toFloat64(value)
	if !ok {
		return &ValidationError{Reason: fmt.Sprintf("expected number, got %T", value)}
	}
	if n < v.Min || n > v.Max {
		return &ValidationError{Reason: fmt.Sprintf("value %v not in range [%v, %v]", n, v.Min, v.Max)}
	}
	return nil
}

// RegexValidator checks that a string value matches a compiled regex pattern.
type RegexValidator struct {
	// Pattern is the compiled regex; do not construct directly — use
	// BuildValidator which compiles the pattern from the attribute config.
	Pattern *regexp.Regexp
	// Source is the original pattern string, kept for error messages.
	Source string
}

// Validate checks the string against the compiled regex.
func (v *RegexValidator) Validate(_ *ValidationContext, value any) error {
	if value == nil {
		return &ValidationError{Reason: "regex value is nil"}
	}
	s, ok := value.(string)
	if !ok {
		return &ValidationError{Reason: fmt.Sprintf("expected string, got %T", value)}
	}
	if !v.Pattern.MatchString(s) {
		return &ValidationError{Reason: fmt.Sprintf("value %q does not match pattern %q", s, v.Source)}
	}
	return nil
}

// CIRefValidator checks that the value is a non-empty string. FK existence
// against cmdb_cis is checked at the DB layer; this only guards the shape.
type CIRefValidator struct{}

// Validate checks the value is a non-empty string.
func (v *CIRefValidator) Validate(_ *ValidationContext, value any) error {
	if value == nil {
		return &ValidationError{Reason: "ci-ref value is nil"}
	}
	s, ok := value.(string)
	if !ok {
		return &ValidationError{Reason: fmt.Sprintf("expected string, got %T", value)}
	}
	if s == "" {
		return &ValidationError{Reason: "ci-ref value is empty"}
	}
	return nil
}

// PassValidator accepts any non-nil value. Used as a passthrough for types
// without built-in validation (string, json).
type PassValidator struct{}

// Validate accepts any non-nil value.
func (v *PassValidator) Validate(_ *ValidationContext, value any) error {
	if value == nil {
		return &ValidationError{Reason: "value is nil"}
	}
	return nil
}

// toFloat64 converts int/int64/float32/float64/string to float64.
// Returns false for unsupported types.
func toFloat64(v any) (float64, bool) {
	switch x := v.(type) {
	case int:
		return float64(x), true
	case int8:
		return float64(x), true
	case int16:
		return float64(x), true
	case int32:
		return float64(x), true
	case int64:
		return float64(x), true
	case float32:
		return float64(x), true
	case float64:
		return x, true
	case string:
		f, err := strconv.ParseFloat(x, 64)
		if err != nil {
			return 0, false
		}
		return f, true
	}
	return 0, false
}
