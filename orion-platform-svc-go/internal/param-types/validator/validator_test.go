package validator

import (
	"testing"
)

func TestValidator_Validate_String(t *testing.T) {
	v := NewValidator()

	// Valid string
	errs := v.Validate("name", "string", "hello", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %v", errs)
	}

	// Min length constraint
	errs = v.Validate("name", "string", "hi", map[string]interface{}{
		"min_length": 5,
	})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error for min_length, got %d", len(errs))
	}
	if errs[0].Constraint != "min_length" {
		t.Fatalf("expected constraint min_length, got %s", errs[0].Constraint)
	}

	// Max length constraint
	errs = v.Validate("name", "string", "verylongstring", map[string]interface{}{
		"max_length": 5,
	})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error for max_length, got %d", len(errs))
	}
	if errs[0].Constraint != "max_length" {
		t.Fatalf("expected constraint max_length, got %s", errs[0].Constraint)
	}

	// Not empty constraint
	errs = v.Validate("name", "string", "   ", map[string]interface{}{
		"not_empty": true,
	})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error for not_empty, got %d", len(errs))
	}
	if errs[0].Constraint != "not_empty" {
		t.Fatalf("expected constraint not_empty, got %s", errs[0].Constraint)
	}

	// Pattern constraint — match
	errs = v.Validate("name", "string", "abc123", map[string]interface{}{
		"pattern": "^[a-z]+[0-9]+$",
	})
	if len(errs) != 0 {
		t.Fatalf("expected no errors for matching pattern, got %v", errs)
	}

	// Pattern constraint — mismatch
	errs = v.Validate("name", "string", "123abc", map[string]interface{}{
		"pattern": "^[a-z]+[0-9]+$",
	})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error for pattern, got %d", len(errs))
	}
	if errs[0].Constraint != "pattern" {
		t.Fatalf("expected constraint pattern, got %s", errs[0].Constraint)
	}

	// Invalid pattern
	errs = v.Validate("name", "string", "hello", map[string]interface{}{
		"pattern": "[invalid",
	})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error for invalid pattern, got %d", len(errs))
	}
	if errs[0].Constraint != "pattern" {
		t.Fatalf("expected constraint pattern, got %s", errs[0].Constraint)
	}
}

func TestValidator_Validate_Number(t *testing.T) {
	v := NewValidator()

	// Valid number
	errs := v.Validate("count", "number", "42", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %v", errs)
	}

	// Invalid number
	errs = v.Validate("count", "number", "abc", nil)
	if len(errs) != 1 {
		t.Fatalf("expected 1 error for invalid number, got %d", len(errs))
	}
	if errs[0].Constraint != "parse" {
		t.Fatalf("expected constraint parse, got %s", errs[0].Constraint)
	}

	// Integer constraint — fails for float
	errs = v.Validate("count", "number", "3.5", map[string]interface{}{
		"integer": true,
	})
	if len(errs) != 1 || errs[0].Constraint != "integer" {
		t.Fatalf("expected integer constraint error, got %v", errs)
	}

	// Integer constraint — passes for integer
	errs = v.Validate("count", "number", "3", map[string]interface{}{
		"integer": true,
	})
	if len(errs) != 0 {
		t.Fatalf("expected no errors for integer 3, got %v", errs)
	}

	// Min constraint
	errs = v.Validate("count", "number", "1", map[string]interface{}{
		"min": 10.0,
	})
	if len(errs) != 1 || errs[0].Constraint != "min" {
		t.Fatalf("expected min constraint error, got %v", errs)
	}

	// Max constraint
	errs = v.Validate("count", "number", "100", map[string]interface{}{
		"max": 10.0,
	})
	if len(errs) != 1 || errs[0].Constraint != "max" {
		t.Fatalf("expected max constraint error, got %v", errs)
	}

	// Step constraint
	errs = v.Validate("count", "number", "7", map[string]interface{}{
		"step": 2.0,
	})
	if len(errs) != 1 || errs[0].Constraint != "step" {
		t.Fatalf("expected step constraint error, got %v", errs)
	}

	// Step constraint passes
	errs = v.Validate("count", "number", "8", map[string]interface{}{
		"step": 2.0,
	})
	if len(errs) != 0 {
		t.Fatalf("expected no errors for step-aligned value, got %v", errs)
	}

	// Greater than constraint
	errs = v.Validate("count", "number", "5", map[string]interface{}{
		"greater_than": 5.0,
	})
	if len(errs) != 1 || errs[0].Constraint != "greater_than" {
		t.Fatalf("expected greater_than constraint error, got %v", errs)
	}

	// Less than constraint
	errs = v.Validate("count", "number", "5", map[string]interface{}{
		"less_than": 5.0,
	})
	if len(errs) != 1 || errs[0].Constraint != "less_than" {
		t.Fatalf("expected less_than constraint error, got %v", errs)
	}
}

func TestValidator_Validate_Boolean(t *testing.T) {
	v := NewValidator()

	for _, val := range []string{"true", "false", "yes", "no", "1", "0", "on", "off", "t", "f"} {
		errs := v.Validate("flag", "boolean", val, nil)
		if len(errs) != 0 {
			t.Fatalf("expected valid boolean %q, got %v", val, errs)
		}
	}

	errs := v.Validate("flag", "boolean", "maybe", nil)
	if len(errs) != 1 {
		t.Fatalf("expected 1 error for invalid boolean, got %d", len(errs))
	}
}

func TestValidator_Validate_Select(t *testing.T) {
	v := NewValidator()

	errs := v.Validate("env", "select", "prod", map[string]interface{}{
		"options": []interface{}{"dev", "staging", "prod"},
	})
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid select, got %v", errs)
	}

	errs = v.Validate("env", "select", "prod,invalid", map[string]interface{}{
		"options": []interface{}{"dev", "staging", "prod"},
	})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error for invalid select option, got %d", len(errs))
	}
	if errs[0].Constraint != "option" {
		t.Fatalf("expected constraint option, got %s", errs[0].Constraint)
	}

	// Case-insensitive match
	errs = v.Validate("env", "select", "PROD", map[string]interface{}{
		"options": []interface{}{"dev", "staging", "prod"},
	})
	if len(errs) != 0 {
		t.Fatalf("expected no errors for case-insensitive select, got %v", errs)
	}
}

func TestValidator_Validate_Array(t *testing.T) {
	v := NewValidator()

	// Valid array
	errs := v.Validate("tags", "array", "a, b, c", map[string]interface{}{
		"min_items": 2, "max_items": 5, "unique": true,
	})
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid array, got %v", errs)
	}

	// Min items
	errs = v.Validate("tags", "array", "a", map[string]interface{}{
		"min_items": 3,
	})
	if len(errs) != 1 || errs[0].Constraint != "min_items" {
		t.Fatalf("expected min_items error, got %v", errs)
	}

	// Max items
	errs = v.Validate("tags", "array", "a,b,c,d", map[string]interface{}{
		"max_items": 2,
	})
	if len(errs) != 1 || errs[0].Constraint != "max_items" {
		t.Fatalf("expected max_items error, got %v", errs)
	}

	// Unique violation
	errs = v.Validate("tags", "array", "a,a,b", map[string]interface{}{
		"unique": true,
	})
	if len(errs) != 1 || errs[0].Constraint != "unique" {
		t.Fatalf("expected unique error, got %v", errs)
	}

	// Empty not OK
	errs = v.Validate("tags", "array", "  ", map[string]interface{}{
		"empty_ok": false,
	})
	if len(errs) != 1 || errs[0].Constraint != "not_empty" {
		t.Fatalf("expected not_empty error, got %v", errs)
	}

	// Empty OK
	errs = v.Validate("tags", "array", "", map[string]interface{}{
		"empty_ok": true,
	})
	if len(errs) != 0 {
		t.Fatalf("expected no errors for empty_ok array, got %v", errs)
	}
}

func TestValidator_Validate_Object(t *testing.T) {
	v := NewValidator()

	// Valid object
	errs := v.Validate("config", "object", `{"name":"x","age":10}`, map[string]interface{}{
		"required": []interface{}{"name"},
	})
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid object, got %v", errs)
	}

	// Missing required field
	errs = v.Validate("config", "object", `{"name":"x"}`, map[string]interface{}{
		"required": []interface{}{"name", "age"},
	})
	if len(errs) < 1 {
		t.Fatalf("expected required field error, got %d", len(errs))
	}
	if !errs.Contains("config", "required") {
		t.Fatalf("expected required constraint")
	}

	// Invalid JSON
	errs = v.Validate("config", "object", `not json`, map[string]interface{}{
		"max_fields": 10,
	})
	if len(errs) != 1 || errs[0].Constraint != "parse" {
		t.Fatalf("expected parse error for invalid JSON, got %d errors %v", len(errs), errs)
	}

	// Max fields
	errs = v.Validate("config", "object", `{"a":1,"b":2,"c":3}`, map[string]interface{}{
		"max_fields": 2,
	})
	if len(errs) != 1 || errs[0].Constraint != "max_fields" {
		t.Fatalf("expected max_fields error, got %v", errs)
	}
}

func TestValidator_Validate_Password(t *testing.T) {
	v := NewValidator()

	// Valid password
	errs := v.Validate("pwd", "password", "P@ss123", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid password, got %v", errs)
	}

	// Min length
	errs = v.Validate("pwd", "password", "short", map[string]interface{}{
		"min_length": 10,
	})
	if len(errs) != 1 || errs[0].Constraint != "min_length" {
		t.Fatalf("expected min_length error, got %v", errs)
	}

	// Require uppercase
	errs = v.Validate("pwd", "password", "alllower", map[string]interface{}{
		"require_upper": true,
	})
	if len(errs) != 1 || errs[0].Constraint != "require_upper" {
		t.Fatalf("expected require_upper error, got %v", errs)
	}

	// Require digit
	errs = v.Validate("pwd", "password", "NoDigits", map[string]interface{}{
		"require_digit": true,
	})
	if len(errs) != 1 || errs[0].Constraint != "require_digit" {
		t.Fatalf("expected require_digit error, got %v", errs)
	}

	// Require symbol
	errs = v.Validate("pwd", "password", "NoSymbols1", map[string]interface{}{
		"require_symbol": true,
	})
	if len(errs) != 1 || errs[0].Constraint != "require_symbol" {
		t.Fatalf("expected require_symbol error, got %v", errs)
	}

	// Entropy too low
	errs = v.Validate("pwd", "password", "aa", map[string]interface{}{
		"entropy": 10,
	})
	if len(errs) != 1 || errs[0].Constraint != "entropy" {
		t.Fatalf("expected entropy error, got %v", errs)
	}
}

func TestValidator_Validate_File(t *testing.T) {
	v := NewValidator()

	// Valid file reference
	errs := v.Validate("f", "file", "data.csv", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid file, got %v", errs)
	}

	// Empty file
	errs = v.Validate("f", "file", "  ", map[string]interface{}{})
	if len(errs) != 1 || errs[0].Constraint != "not_empty" {
		t.Fatalf("expected not_empty error for file, got %v", errs)
	}

	// Disallowed extension
	errs = v.Validate("f", "file", "image.png", map[string]interface{}{
		"allowed_ext": []interface{}{"csv", "json"},
	})
	if len(errs) != 1 || errs[0].Constraint != "allowed_ext" {
		t.Fatalf("expected allowed_ext error, got %v", errs)
	}
}

func TestValidator_Validate_JSON(t *testing.T) {
	v := NewValidator()

	errs := v.Validate("j", "json", `{"key": 42}`, nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid JSON, got %v", errs)
	}

	errs = v.Validate("j", "json", `not json`, nil)
	if len(errs) != 1 || errs[0].Constraint != "parse" {
		t.Fatalf("expected parse error for invalid JSON, got %v", errs)
	}
}

func TestValidator_Validate_DateTime(t *testing.T) {
	v := NewValidator()

	errs := v.Validate("ts", "datetime", "2026-01-15T12:00:00Z", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid datetime, got %v", errs)
	}

	errs = v.Validate("ts", "datetime", "2026-01-15", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for date-only, got %v", errs)
	}

	errs = v.Validate("ts", "datetime", "", nil)
	if len(errs) != 1 || errs[0].Constraint != "not_empty" {
		t.Fatalf("expected not_empty for empty datetime, got %v", errs)
	}

	errs = v.Validate("ts", "datetime", "not-a-date", nil)
	if len(errs) != 1 || errs[0].Constraint != "format" {
		t.Fatalf("expected format error for invalid datetime, got %v", errs)
	}
}

func TestValidator_Validate_Email(t *testing.T) {
	v := NewValidator()

	errs := v.Validate("e", "email", "user@example.com", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid email, got %v", errs)
	}

	errs = v.Validate("e", "email", "", nil)
	if len(errs) != 1 || errs[0].Constraint != "not_empty" {
		t.Fatalf("expected not_empty for empty email, got %v", errs)
	}

	errs = v.Validate("e", "email", "not-an-email", nil)
	if len(errs) != 1 || errs[0].Constraint != "format" {
		t.Fatalf("expected format error for invalid email, got %v", errs)
	}
}

func TestValidator_Validate_URL(t *testing.T) {
	v := NewValidator()

	errs := v.Validate("u", "url", "https://example.com", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid URL, got %v", errs)
	}

	errs = v.Validate("u", "url", "", nil)
	if len(errs) != 1 || errs[0].Constraint != "not_empty" {
		t.Fatalf("expected not_empty for empty URL, got %v", errs)
	}

	errs = v.Validate("u", "url", "ftp://example.com", nil)
	if len(errs) != 1 || errs[0].Constraint != "scheme" {
		t.Fatalf("expected scheme error for invalid URL, got %v", errs)
	}
}

func TestValidator_Validate_Regex(t *testing.T) {
	v := NewValidator()

	errs := v.Validate("r", "regex", `^[a-z]+$`, nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid regex, got %v", errs)
	}

	errs = v.Validate("r", "regex", `[invalid`, nil)
	if len(errs) != 1 || errs[0].Constraint != "parse" {
		t.Fatalf("expected parse error for invalid regex, got %v", errs)
	}
}

func TestValidator_Validate_IP(t *testing.T) {
	v := NewValidator()

	errs := v.Validate("i", "ip", "192.168.1.1", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid IP, got %v", errs)
	}

	errs = v.Validate("i", "ip", "", nil)
	if len(errs) != 1 || errs[0].Constraint != "not_empty" {
		t.Fatalf("expected not_empty for empty IP, got %v", errs)
	}

	errs = v.Validate("i", "ip", "notanip", nil)
	if len(errs) != 1 || errs[0].Constraint != "format" {
		t.Fatalf("expected format error for invalid IP, got %v", errs)
	}
}

func TestValidator_Validate_CIDR(t *testing.T) {
	v := NewValidator()

	errs := v.Validate("c", "cidr", "192.168.0.0/16", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid CIDR, got %v", errs)
	}

	errs = v.Validate("c", "cidr", "192.168.0.0", nil)
	if len(errs) != 1 || errs[0].Constraint != "format" {
		t.Fatalf("expected format error for CIDR without prefix, got %v", errs)
	}

	errs = v.Validate("c", "cidr", "192.168.0.0/abc", nil)
	if len(errs) != 1 || errs[0].Constraint != "prefix" {
		t.Fatalf("expected prefix error for non-numeric CIDR, got %v", errs)
	}
}

func TestValidator_Validate_Port(t *testing.T) {
	v := NewValidator()

	errs := v.Validate("p", "port", "8080", nil)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for valid port, got %v", errs)
	}

	errs = v.Validate("p", "port", "abc", nil)
	if len(errs) != 1 || errs[0].Constraint != "parse" {
		t.Fatalf("expected parse error for invalid port, got %v", errs)
	}

	errs = v.Validate("p", "port", "0", nil)
	if len(errs) != 1 || errs[0].Constraint != "range" {
		t.Fatalf("expected range error for port 0, got %v", errs)
	}

	errs = v.Validate("p", "port", "70000", nil)
	if len(errs) != 1 || errs[0].Constraint != "range" {
		t.Fatalf("expected range error for port 70000, got %v", errs)
	}
}

func TestValidator_UnknownType(t *testing.T) {
	v := NewValidator()

	errs := v.Validate("x", "unknown", "value", nil)
	if len(errs) != 1 {
		t.Fatalf("expected 1 error for unknown type, got %d", len(errs))
	}
	if errs[0].Constraint != "type_unknown" {
		t.Fatalf("expected constraint type_unknown, got %s", errs[0].Constraint)
	}
}

func TestValidationErrors_Error(t *testing.T) {
	errs := ValidationErrors{
		{ParamName: "a", Type: "string", Constraint: "min_length", Message: "too short"},
		{ParamName: "b", Type: "string", Constraint: "max_length", Message: "too long"},
	}
	s := errs.Error()
	if s == "" {
		t.Fatal("error string should not be empty")
	}

	emptyErrs := ValidationErrors{}
	if emptyErrs.Error() != "no validation errors" {
		t.Fatalf("empty errors message mismatch, got %q", emptyErrs.Error())
	}

	// Contains
	if !errs.Contains("a", "min_length") {
		t.Fatal("Contains should find existing constraint")
	}
	if errs.Contains("a", "nonexistent") {
		t.Fatal("Contains should not find nonexistent constraint")
	}
}

func TestValidationErrors_FieldPath(t *testing.T) {
	err := ValidationError{
		ParamName: "config", Field: "color.value", Type: "object",
		Constraint: "field_type", Message: "wrong type",
	}
	s := err.Error()
	if s == "" {
		t.Fatal("error string should not be empty")
	}
}
