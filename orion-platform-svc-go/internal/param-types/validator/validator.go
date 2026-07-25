package validator

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Constraints define type-specific validation rules.
// ---------------------------------------------------------------------------

// StringConstraints holds validation rules for string-type parameters.
type StringConstraints struct {
	MinLen    int    `json:"min_length,omitempty"`    // minimum character length
	MaxLen    int    `json:"max_length,omitempty"`    // maximum character length
	Pattern   string `json:"pattern,omitempty"`       // regex pattern
	TrimSpace bool   `json:"trim_space,omitempty"`    // trim leading/trailing whitespace
	NotEmpty  bool   `json:"not_empty,omitempty"`     // reject empty string
}

// NumberConstraints holds validation rules for number-type parameters.
// Pointer fields distinguish "not set" (nil) from "set to zero".
type NumberConstraints struct {
	Min         *float64 `json:"min,omitempty"`         // minimum value (inclusive)
	Max         *float64 `json:"max,omitempty"`         // maximum value (inclusive)
	Step        *float64 `json:"step,omitempty"`        // allowed increment between values
	Integer     bool     `json:"integer,omitempty"`     // reject fractional numbers
	GreaterThan *float64 `json:"greater_than,omitempty"`// strictly greater than
	LessThan    *float64 `json:"less_than,omitempty"`   // strictly less than
}

// ArrayConstraints holds validation rules for array-type parameters.
type ArrayConstraints struct {
	MinItems int   `json:"min_items,omitempty"` // minimum number of items
	MaxItems int   `json:"max_items,omitempty"` // maximum number of items
	Unique   bool  `json:"unique,omitempty"`    // reject duplicate items
	EmptyOK  bool  `json:"empty_ok,omitempty"`  // allow empty array
}

// ObjectConstraints holds validation rules for object-type parameters.
type ObjectConstraints struct {
	Required   []string           `json:"required,omitempty"`      // required field names
	Properties map[string]PropertyConstraints `json:"properties,omitempty"` // per-field rules
	MaxFields  int                `json:"max_fields,omitempty"`    // maximum number of fields
}

// PropertyConstraints holds validation rules for a single object property.
type PropertyConstraints struct {
	Type     string            `json:"type"`           // expected value type
	Required bool              `json:"required"`        // field must be present
	Enum     []interface{}     `json:"enum,omitempty"`  // allowed discrete values
	Default  interface{}       `json:"default,omitempty"` // default if absent
}

// SelectConstraints holds validation rules for select-type parameters.
type SelectConstraints struct {
	Options []string `json:"options,omitempty"` // allowed option values
	Multiple bool    `json:"multiple,omitempty"` // allow multiple selection
}

// PasswordConstraints holds validation rules for password-type parameters.
type PasswordConstraints struct {
	MinLen     int    `json:"min_length,omitempty"`     // minimum character length
	MaxLen     int    `json:"max_length,omitempty"`     // maximum character length
	RequireUpper bool `json:"require_upper,omitempty"`  // must contain uppercase
	RequireLower bool `json:"require_lower,omitempty"`  // must contain lowercase
	RequireDigit bool `json:"require_digit,omitempty"`  // must contain digit
	RequireSymbol bool `json:"require_symbol,omitempty"` // must contain symbol
	Entropy      int    `json:"entropy,omitempty"`      // minimum entropy bits
}

// FileConstraints holds validation rules for file-type parameters.
type FileConstraints struct {
	MaxSize       int64    `json:"max_size,omitempty"`       // max file size in bytes
	AllowedExt    []string `json:"allowed_ext,omitempty"`    // allowed extensions
	AllowedMime   []string `json:"allowed_mime,omitempty"`   // allowed MIME types
}

// ---------------------------------------------------------------------------
// Validation error types for structured error reporting.
// ---------------------------------------------------------------------------

// ValidationError represents a single validation failure with location info.
type ValidationError struct {
	ParamName string `json:"param_name"` // parameter name (for nested paths)
	Field     string `json:"field,omitempty"` // sub-field path (e.g., "properties.color.value")
	Type      string `json:"type"` // parameter type code
	Constraint string `json:"constraint"` // constraint name that failed
	Message   string `json:"message"` // human-readable message
	Value     interface{} `json:"value,omitempty"` // the value that failed validation
}

func (e ValidationError) Error() string {
	if e.Field != "" {
		return fmt.Sprintf("[%s.%s] %s (constraint: %s)", e.ParamName, e.Field, e.Message, e.Constraint)
	}
	return fmt.Sprintf("[%s] %s (constraint: %s)", e.ParamName, e.Message, e.Constraint)
}

// ValidationErrors is a collection of validation failures.
type ValidationErrors []ValidationError

func (vs ValidationErrors) Error() string {
	if len(vs) == 0 {
		return "no validation errors"
	}
	parts := make([]string, len(vs))
	for i, v := range vs {
		parts[i] = v.Error()
	}
	return strings.Join(parts, "; ")
}

// Contains checks if any error matches a given constraint.
func (vs ValidationErrors) Contains(paramName, constraint string) bool {
	for _, v := range vs {
		if v.ParamName == paramName && v.Constraint == constraint {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// Validator validates a parameter value against type-specific constraints.
// ---------------------------------------------------------------------------

type Validator struct {
	// Pre-compiled regex patterns for performance
	cachedPatterns map[string]*regexp.Regexp
}

func NewValidator() *Validator {
	return &Validator{
		cachedPatterns: make(map[string]*regexp.Regexp),
	}
}

// Validate runs full validation on a parameter value against the given type
// and constraints. Returns nil if valid, or a collection of ValidationError(s).
func (v *Validator) Validate(
	paramName, paramType, rawValue string,
	constraints map[string]interface{},
) ValidationErrors {
	switch paramType {
	case "string":
		return v.validateString(paramName, rawValue, parseStringConstraints(constraints))
	case "number":
		return v.validateNumber(paramName, rawValue, parseNumberConstraints(constraints))
	case "boolean":
		return v.validateBoolean(paramName, rawValue)
	case "select":
		return v.validateSelect(paramName, rawValue, parseSelectConstraints(constraints))
	case "array":
		return v.validateArray(paramName, rawValue, parseArrayConstraints(constraints))
	case "object":
		return v.validateObject(paramName, rawValue, parseObjectConstraints(constraints))
	case "password":
		return v.validatePassword(paramName, rawValue, parsePasswordConstraints(constraints))
	case "file":
		return v.validateFile(paramName, rawValue, parseFileConstraints(constraints))
	case "json":
		return v.validateJSON(paramName, rawValue)
	case "datetime":
		return v.validateDateTime(paramName, rawValue)
	case "email":
		return v.validateEmail(paramName, rawValue)
	case "url":
		return v.validateURL(paramName, rawValue)
	case "regex":
		return v.validateRegexPattern(paramName, rawValue)
	case "ip":
		return v.validateIP(paramName, rawValue)
	case "cidr":
		return v.validateCIDR(paramName, rawValue)
	case "port":
		return v.validatePort(paramName, rawValue)
	default:
		return ValidationErrors{ValidationError{
			ParamName: paramName,
			Type:      paramType,
			Constraint: "type_unknown",
			Message:   fmt.Sprintf("unknown param type: %s", paramType),
		}}
	}
}

// ---------------------------------------------------------------------------
// Type-specific validators
// ---------------------------------------------------------------------------

func (v *Validator) validateString(paramName, value string, c *StringConstraints) ValidationErrors {
	var errs ValidationErrors
	if c == nil {
		return errs
	}

	if c.NotEmpty && strings.TrimSpace(value) == "" {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "string", Constraint: "not_empty",
			Message: "string must not be empty", Value: value,
		})
		return errs
	}

	if c.MinLen > 0 && len(value) < c.MinLen {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "string", Constraint: "min_length",
			Message: fmt.Sprintf("string length %d is less than minimum %d", len(value), c.MinLen),
			Value: value,
		})
	}

	if c.MaxLen > 0 && len(value) > c.MaxLen {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "string", Constraint: "max_length",
			Message: fmt.Sprintf("string length %d exceeds maximum %d", len(value), c.MaxLen),
			Value: value,
		})
	}

	if c.Pattern != "" {
		re, ok := v.cachedPatterns[c.Pattern]
		if !ok {
			re, err := regexp.Compile(c.Pattern)
			if err != nil {
				errs = append(errs, ValidationError{
					ParamName: paramName, Type: "string", Constraint: "pattern",
					Message: fmt.Sprintf("invalid pattern %q: %v", c.Pattern, err),
				})
			} else {
				v.cachedPatterns[c.Pattern] = re
			}
		}
		if ok && re != nil && !re.MatchString(value) {
			errs = append(errs, ValidationError{
				ParamName: paramName, Type: "string", Constraint: "pattern",
				Message: fmt.Sprintf("string does not match pattern %q", c.Pattern),
				Value: value,
			})
		}
	}

	return errs
}

func (v *Validator) validateNumber(paramName, value string, c *NumberConstraints) ValidationErrors {
	var errs ValidationErrors
	f, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "number", Constraint: "parse",
			Message: fmt.Sprintf("invalid number: %v", err), Value: value,
		}}
	}

	if c == nil {
		return errs
	}

	if c.Integer && f != float64(int64(f)) {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "number", Constraint: "integer",
			Message: "number must be an integer", Value: f,
		})
	}

	if c.Min != nil && f < *c.Min {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "number", Constraint: "min",
			Message: fmt.Sprintf("value %.4f is below minimum %.4f", f, *c.Min), Value: f,
		})
	}

	if c.Max != nil && f > *c.Max {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "number", Constraint: "max",
			Message: fmt.Sprintf("value %.4f exceeds maximum %.4f", f, *c.Max), Value: f,
		})
	}

	if c.Step != nil && *c.Step > 0 {
		// Compute distance from nearest multiple of step
		stepVal := *c.Step
		if f < stepVal {
			errs = append(errs, ValidationError{
				ParamName: paramName, Type: "number", Constraint: "step",
				Message: fmt.Sprintf("value %.4f is not aligned to step %.4f", f, stepVal), Value: f,
			})
		} else {
			remainder := math.Mod(f, stepVal)
			// Handle floating point comparison with epsilon
			if remainder > 1e-9 && remainder < stepVal-1e-9 {
				errs = append(errs, ValidationError{
					ParamName: paramName, Type: "number", Constraint: "step",
					Message: fmt.Sprintf("value %.4f is not aligned to step %.4f", f, stepVal), Value: f,
				})
			}
		}
	}

	if c.GreaterThan != nil && f <= *c.GreaterThan {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "number", Constraint: "greater_than",
			Message: fmt.Sprintf("value %.4f must be greater than %.4f", f, *c.GreaterThan), Value: f,
		})
	}

	if c.LessThan != nil && f >= *c.LessThan {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "number", Constraint: "less_than",
			Message: fmt.Sprintf("value %.4f must be less than %.4f", f, *c.LessThan), Value: f,
		})
	}

	return errs
}

func (v *Validator) validateBoolean(paramName, value string) ValidationErrors {
	truthy := map[string]bool{
		"true": true, "false": false,
		"yes": true, "no": false,
		"1": true, "0": false,
		"on": true, "off": false,
		"t": true, "f": false,
	}
	_, ok := truthy[strings.ToLower(strings.TrimSpace(value))]
	if !ok {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "boolean", Constraint: "valid_boolean",
			Message: "invalid boolean value; expected true/false, yes/no, 1/0, on/off",
			Value: value,
		}}
	}
	return nil
}

func (v *Validator) validateSelect(paramName, value string, c *SelectConstraints) ValidationErrors {
	var errs ValidationErrors
	if c == nil {
		return errs
	}

	vs := strings.Split(value, ",")
	for i, opt := range vs {
		opt = strings.TrimSpace(opt)
		found := false
		for _, allowed := range c.Options {
			if strings.EqualFold(opt, allowed) {
				found = true
				break
			}
		}
		if !found {
			errs = append(errs, ValidationError{
				ParamName: paramName, Type: "select", Constraint: "option",
				Message: fmt.Sprintf("option %q (position %d) is not in allowed list %v", opt, i, c.Options),
				Value: opt,
			})
		}
	}
	return errs
}

func (v *Validator) validateArray(paramName, value string, c *ArrayConstraints) ValidationErrors {
	var errs ValidationErrors
	if c == nil {
		return errs
	}

	items := strings.Split(value, ",")
	cleanItems := make([]string, 0, len(items))
	for _, item := range items {
		t := strings.TrimSpace(item)
		if t != "" {
			cleanItems = append(cleanItems, t)
		}
	}

	if c.EmptyOK {
		return errs
	} else if len(cleanItems) == 0 {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "array", Constraint: "not_empty",
			Message: "array must not be empty", Value: value,
		})
		return errs
	}

	if c.MinItems > 0 && len(cleanItems) < c.MinItems {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "array", Constraint: "min_items",
			Message: fmt.Sprintf("array has %d items, minimum is %d", len(cleanItems), c.MinItems),
			Value: cleanItems,
		})
	}

	if c.MaxItems > 0 && len(cleanItems) > c.MaxItems {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "array", Constraint: "max_items",
			Message: fmt.Sprintf("array has %d items, maximum is %d", len(cleanItems), c.MaxItems),
			Value: cleanItems,
		})
	}

	if c.Unique {
		seen := make(map[string]bool)
		for _, item := range cleanItems {
			if seen[item] {
				errs = append(errs, ValidationError{
					ParamName: paramName, Type: "array", Constraint: "unique",
					Message: fmt.Sprintf("duplicate item %q in array", item), Value: cleanItems,
				})
				break
			}
			seen[item] = true
		}
	}

	return errs
}

func (v *Validator) validateObject(paramName, value string, c *ObjectConstraints) ValidationErrors {
	var errs ValidationErrors
	if c == nil {
		return errs
	}

	// Parse as JSON first
	var obj map[string]interface{}
	if err := unmarshalJSON(value, &obj); err != nil {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "object", Constraint: "parse",
			Message: fmt.Sprintf("invalid JSON object: %v", err), Value: value,
		}}
	}

	if c.MaxFields > 0 && len(obj) > c.MaxFields {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "object", Constraint: "max_fields",
			Message: fmt.Sprintf("object has %d fields, maximum is %d", len(obj), c.MaxFields),
			Value: obj,
		})
	}

	// Check required fields
	for _, field := range c.Required {
		if _, ok := obj[field]; !ok {
			errs = append(errs, ValidationError{
				ParamName: paramName, Type: "object", Constraint: "required",
				Message: fmt.Sprintf("required field %q is missing", field), Value: obj,
			})
		}
	}

	// Validate per-field properties
	for field, constraints := range c.Properties {
		if val, ok := obj[field]; ok {
			// Type check
			if constraints.Type != "" {
				actualType := inferJSONType(val)
				if actualType != constraints.Type {
					errs = append(errs, ValidationError{
						ParamName: paramName, Type: "object", Constraint: "field_type",
						Field: field,
						Message: fmt.Sprintf("field %q has type %s, expected %s", field, actualType, constraints.Type),
						Value: val,
					})
				}
			}
			// Enum check
			if len(constraints.Enum) > 0 {
				found := false
				for _, allowed := range constraints.Enum {
					if equalJSON(val, allowed) {
						found = true
						break
					}
				}
				if !found {
					errs = append(errs, ValidationError{
						ParamName: paramName, Type: "object", Constraint: "enum",
						Field: field,
						Message: fmt.Sprintf("field %q value %v not in allowed values %v", field, val, constraints.Enum),
						Value: val,
					})
				}
			}
		} else if constraints.Required {
			// Already handled by Required check above, but include with field context
			errs = append(errs, ValidationError{
				ParamName: paramName, Type: "object", Constraint: "required",
				Field: field,
				Message: fmt.Sprintf("required field %q is missing", field), Value: obj,
			})
		}
	}

	return errs
}

func (v *Validator) validatePassword(paramName, value string, c *PasswordConstraints) ValidationErrors {
	var errs ValidationErrors
	if c == nil {
		return errs
	}

	if c.MinLen > 0 && len(value) < c.MinLen {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "password", Constraint: "min_length",
			Message: fmt.Sprintf("password length %d is less than minimum %d", len(value), c.MinLen),
		})
	}

	if c.MaxLen > 0 && len(value) > c.MaxLen {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "password", Constraint: "max_length",
			Message: fmt.Sprintf("password length %d exceeds maximum %d", len(value), c.MaxLen),
		})
	}

	if c.RequireUpper && !hasUpper(value) {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "password", Constraint: "require_upper",
			Message: "password must contain at least one uppercase letter",
		})
	}

	if c.RequireLower && !hasLower(value) {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "password", Constraint: "require_lower",
			Message: "password must contain at least one lowercase letter",
		})
	}

	if c.RequireDigit && !hasDigit(value) {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "password", Constraint: "require_digit",
			Message: "password must contain at least one digit",
		})
	}

	if c.RequireSymbol && !hasSymbol(value) {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "password", Constraint: "require_symbol",
			Message: "password must contain at least one special character",
		})
	}

	if c.Entropy > 0 {
		entropy := calculateEntropy(value)
		if entropy < float64(c.Entropy) {
			errs = append(errs, ValidationError{
				ParamName: paramName, Type: "password", Constraint: "entropy",
				Message: fmt.Sprintf("password entropy %.1f bits is below minimum %d bits", entropy, c.Entropy),
			})
		}
	}

	return errs
}

func (v *Validator) validateFile(paramName, value string, c *FileConstraints) ValidationErrors {
	var errs ValidationErrors
	if c == nil {
		return errs
	}

	if strings.TrimSpace(value) == "" {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "file", Constraint: "not_empty",
			Message: "file reference must not be empty",
		}}
	}

	// Check allowed extensions
	if len(c.AllowedExt) > 0 {
		// Extract extension
		dotIdx := strings.LastIndex(value, ".")
		if dotIdx >= 0 {
			actualExt := strings.TrimPrefix(value[dotIdx:], ".")
			found := false
			for _, allowed := range c.AllowedExt {
				if strings.EqualFold(actualExt, allowed) {
					found = true
					break
				}
			}
			if !found {
				errs = append(errs, ValidationError{
					ParamName: paramName, Type: "file", Constraint: "allowed_ext",
					Message: fmt.Sprintf("file extension %q is not allowed; allowed: %v", actualExt, c.AllowedExt),
					Value: value,
				})
			}
		}
	}

	return errs
}

func (v *Validator) validateJSON(paramName, value string) ValidationErrors {
	var obj interface{}
	if err := unmarshalJSON(value, &obj); err != nil {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "json", Constraint: "parse",
			Message: fmt.Sprintf("invalid JSON: %v", err), Value: value,
		}}
	}
	return nil
}

func (v *Validator) validateDateTime(paramName, rawValue string) ValidationErrors {
	var errs ValidationErrors
	vs := strings.TrimSpace(rawValue)
	if vs == "" {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "datetime", Constraint: "not_empty",
			Message: "datetime must not be empty",
		}}
	}
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, layout := range formats {
		if _, err := time.Parse(layout, vs); err == nil {
			return errs
		}
	}
	errs = append(errs, ValidationError{
		ParamName: paramName, Type: "datetime", Constraint: "format",
		Message: fmt.Sprintf("unrecognized datetime format %q (expected RFC3339 or YYYY-MM-DD[T]HH:MM:SS)", rawValue),
		Value: rawValue,
	})
	return errs
}

func (v *Validator) validateEmail(paramName, rawValue string) ValidationErrors {
	var errs ValidationErrors
	vs := strings.TrimSpace(rawValue)
	if vs == "" {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "email", Constraint: "not_empty",
			Message: "email must not be empty",
		}}
	}
	emailRe := regexp.MustCompile(`^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$`)
	if !emailRe.MatchString(vs) {
		errs = append(errs, ValidationError{
			ParamName: paramName, Type: "email", Constraint: "format",
			Message: fmt.Sprintf("not a valid email address: %s", vs), Value: vs,
		})
	}
	return errs
}

func (v *Validator) validateURL(paramName, value string) ValidationErrors {
	vs := strings.TrimSpace(value)
	if vs == "" {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "url", Constraint: "not_empty",
			Message: "URL must not be empty",
		}}
	}
	if !strings.HasPrefix(vs, "http://") && !strings.HasPrefix(vs, "https://") {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "url", Constraint: "scheme",
			Message: "URL must start with http:// or https://", Value: vs,
		}}
	}
	return nil
}

func (v *Validator) validateRegexPattern(paramName, value string) ValidationErrors {
	if _, err := regexp.Compile(value); err != nil {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "regex", Constraint: "parse",
			Message: fmt.Sprintf("invalid regex pattern: %v", err), Value: value,
		}}
	}
	return nil
}

func (v *Validator) validateIP(paramName, value string) ValidationErrors {
	vs := strings.TrimSpace(value)
	if vs == "" {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "ip", Constraint: "not_empty",
			Message: "IP address must not be empty",
		}}
	}
	if !strings.Contains(vs, ".") && !strings.Contains(vs, ":") {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "ip", Constraint: "format",
			Message: fmt.Sprintf("not a valid IP address: %s", vs), Value: vs,
		}}
	}
	return nil
}

func (v *Validator) validateCIDR(paramName, value string) ValidationErrors {
	vs := strings.TrimSpace(value)
	if vs == "" {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "cidr", Constraint: "not_empty",
			Message: "CIDR must not be empty",
		}}
	}
	parts := strings.Split(vs, "/")
	if len(parts) != 2 {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "cidr", Constraint: "format",
			Message: fmt.Sprintf("CIDR must be in IP/prefix format, got %s", vs), Value: vs,
		}}
	}
	if _, err := strconv.Atoi(parts[1]); err != nil {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "cidr", Constraint: "prefix",
			Message: fmt.Sprintf("CIDR prefix must be numeric, got %s", parts[1]), Value: parts[1],
		}}
	}
	return nil
}

func (v *Validator) validatePort(paramName, value string) ValidationErrors {
	port, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "port", Constraint: "parse",
			Message: fmt.Sprintf("not a valid port number: %v", err), Value: value,
		}}
	}
	if port < 1 || port > 65535 {
		return ValidationErrors{ValidationError{
			ParamName: paramName, Type: "port", Constraint: "range",
			Message: fmt.Sprintf("port must be between 1 and 65535, got %d", port), Value: port,
		}}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Constraint parsers (convert generic map to typed struct)
// ---------------------------------------------------------------------------

func parseStringConstraints(m map[string]interface{}) *StringConstraints {
	if m == nil {
		return nil
	}
	var c StringConstraints
	c.MinLen = toInt(m, "min_length")
	c.MaxLen = toInt(m, "max_length")
	c.Pattern = toString(m, "pattern")
	c.TrimSpace = toBool(m, "trim_space")
	c.NotEmpty = toBool(m, "not_empty")
	return &c
}

func parseNumberConstraints(m map[string]interface{}) *NumberConstraints {
	if m == nil {
		return nil
	}
	var c NumberConstraints
	if v := toFloat(m, "min"); v != 0 || m["min"] != nil {
		c.Min = &v
	}
	if v := toFloat(m, "max"); v != 0 || m["max"] != nil {
		c.Max = &v
	}
	if v := toFloat(m, "step"); v != 0 || m["step"] != nil {
		c.Step = &v
	}
	c.Integer = toBool(m, "integer")
	if v := toFloat(m, "greater_than"); v != 0 || m["greater_than"] != nil {
		c.GreaterThan = &v
	}
	if v := toFloat(m, "less_than"); v != 0 || m["less_than"] != nil {
		c.LessThan = &v
	}
	return &c
}

func parseArrayConstraints(m map[string]interface{}) *ArrayConstraints {
	if m == nil {
		return nil
	}
	var c ArrayConstraints
	c.MinItems = toInt(m, "min_items")
	c.MaxItems = toInt(m, "max_items")
	c.Unique = toBool(m, "unique")
	c.EmptyOK = toBool(m, "empty_ok")
	return &c
}

func parseObjectConstraints(m map[string]interface{}) *ObjectConstraints {
	if m == nil {
		return nil
	}
	var c ObjectConstraints
	c.MaxFields = toInt(m, "max_fields")
	if required, ok := m["required"]; ok {
		c.Required = toStrSlice(required)
	}
	return &c
}

func parseSelectConstraints(m map[string]interface{}) *SelectConstraints {
	if m == nil {
		return nil
	}
	var c SelectConstraints
	c.Options = toStrSlice(m["options"])
	c.Multiple = toBool(m, "multiple")
	return &c
}

func parsePasswordConstraints(m map[string]interface{}) *PasswordConstraints {
	if m == nil {
		return nil
	}
	var c PasswordConstraints
	c.MinLen = toInt(m, "min_length")
	c.MaxLen = toInt(m, "max_length")
	c.RequireUpper = toBool(m, "require_upper")
	c.RequireLower = toBool(m, "require_lower")
	c.RequireDigit = toBool(m, "require_digit")
	c.RequireSymbol = toBool(m, "require_symbol")
	c.Entropy = toInt(m, "entropy")
	return &c
}

func parseFileConstraints(m map[string]interface{}) *FileConstraints {
	if m == nil {
		return nil
	}
	var c FileConstraints
	c.MaxSize = toInt64(m, "max_size")
	c.AllowedExt = toStrSlice(m["allowed_ext"])
	c.AllowedMime = toStrSlice(m["allowed_mime"])
	return &c
}

// ---------------------------------------------------------------------------
// Type reflection / inference helpers
// ---------------------------------------------------------------------------

func inferJSONType(val interface{}) string {
	switch val.(type) {
	case string:
		return "string"
	case bool:
		return "boolean"
	case float64:
		return "number"
	case map[string]interface{}:
		return "object"
	case []interface{}:
		return "array"
	case nil:
		return "null"
	default:
		return fmt.Sprintf("%T", val)
	}
}

func equalJSON(a, b interface{}) bool {
	switch av := a.(type) {
	case float64:
		bv, ok := b.(float64)
		return ok && av == bv
	case string:
		bv, ok := b.(string)
		return ok && av == bv
	case bool:
		bv, ok := b.(bool)
		return ok && av == bv
	default:
		return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
	}
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

func toInt(m map[string]interface{}, key string) int {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case int:
			return val
		case float64:
			return int(val)
		case string:
			i, _ := strconv.Atoi(val)
			return i
		}
	}
	return 0
}

func toFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case float64:
			return val
		case int:
			return float64(val)
		case string:
			f, _ := strconv.ParseFloat(val, 64)
			return f
		}
	}
	return 0
}

func toBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
		if s, ok := v.(string); ok {
			return s == "true" || s == "1"
		}
	}
	return false
}

func toString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
		return fmt.Sprintf("%v", v)
	}
	return ""
}

func toInt64(m map[string]interface{}, key string) int64 {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case int64:
			return val
		case int:
			return int64(val)
		case float64:
			return int64(val)
		case string:
			i, _ := strconv.ParseInt(val, 10, 64)
			return i
		}
	}
	return 0
}

func toStrSlice(v interface{}) []string {
	if arr, ok := v.([]interface{}); ok {
		out := make([]string, 0, len(arr))
		for _, item := range arr {
			out = append(out, fmt.Sprintf("%v", item))
		}
		return out
	}
	if arr, ok := v.([]string); ok {
		return arr
	}
	return nil
}

func hasUpper(s string) bool {
	for _, c := range s {
		if c >= 'A' && c <= 'Z' {
			return true
		}
	}
	return false
}

func hasLower(s string) bool {
	for _, c := range s {
		if c >= 'a' && c <= 'z' {
			return true
		}
	}
	return false
}

func hasDigit(s string) bool {
	for _, c := range s {
		if c >= '0' && c <= '9' {
			return true
		}
	}
	return false
}

func hasSymbol(s string) bool {
	for _, c := range s {
		if !(c >= 'A' && c <= 'Z') &&
			!(c >= 'a' && c <= 'z') &&
			!(c >= '0' && c <= '9') {
			return true
		}
	}
	return false
}

func calculateEntropy(s string) float64 {
	if s == "" {
		return 0
	}
	// Calculate Shannon entropy of character distribution
	freq := make(map[rune]int)
	for _, c := range s {
		freq[c]++
	}
	entropy := 0.0
	n := float64(len(s))
	for _, count := range freq {
		p := float64(count) / n
		if p > 0 {
			entropy -= p * log2(p)
		}
	}
	return entropy * n // bits per string (total entropy)
}

func log2(x float64) float64 {
	if x <= 0 {
		return 0
	}
	return math.Log(x) / math.Log(2)
}

func unmarshalJSON(s string, v interface{}) error {
	return json.Unmarshal([]byte(s), v)
}
