package validators

import (
	"context"
	"testing"
)

func TestCMDBValidator_CIANameRequired(t *testing.T) {
	v := NewCMDBValidator(Options{})

	data := map[string]interface{}{"id": "uuid-123", "ci_type": "server"}
	rpt := v.ValidateRecord(context.Background(), "uuid-123", "CI", data)

	if rpt.Passed {
		t.Error("expected validation to fail for missing name")
	}
	if len(rpt.Errors) == 0 {
		t.Error("expected at least one error")
	}
}

func TestCMDBValidator_CIDeprecationCrossField(t *testing.T) {
	v := NewCMDBValidator(Options{})

	// CI with status=retired but no deprecation_date -> should warn
	data := map[string]interface{}{
		"id":     "uuid-123",
		"ci_type": "server",
		"name":   "web-01",
		"status": "retired",
	}
	rpt := v.ValidateRecord(context.Background(), "uuid-123", "CI", data)

	found := false
	for _, e := range rpt.Errors {
		if e.Category == "cross_field" {
			found = true
			if e.Message == "" {
				t.Error("expected deprecation cross-field error message")
			}
		}
	}
	if !found {
		t.Error("expected cross_field error for retired CI missing deprecation_date")
	}
}

func TestCMDBValidator_CIStatusEnum(t *testing.T) {
	v := NewCMDBValidator(Options{})

	data := map[string]interface{}{
		"id":     "uuid-123",
		"ci_type": "server",
		"name":   "web-01",
		"status": "invalid_status",
	}
	rpt := v.ValidateRecord(context.Background(), "uuid-123", "CI", data)

	found := false
	for _, e := range rpt.Errors {
		if e.Category == "enum" && e.RuleID == "builtin-ci-status" {
			found = true
		}
	}
	if !found {
		t.Error("expected enum validation error for invalid status")
	}
}

func TestCMDBValidator_ValidCI(t *testing.T) {
	v := NewCMDBValidator(Options{StopOnFirstError: false, MaxErrors: 50})

	data := map[string]interface{}{
		"id":              "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		"ci_type":         "server",
		"name":            "web-01",
		"status":          "active",
		"lifecycle_state": "in_service",
		"version":         float64(1),
	}
	rpt := v.ValidateRecord(context.Background(), "a1b2c3d4", "CI", data)

	// All built-in checks should pass; any errors must be warnings for optional fields
	errorCount := 0
	for _, e := range rpt.Errors {
		if e.Severity == "error" {
			errorCount++
		}
	}
	if errorCount != 0 {
		t.Errorf("expected 0 error-severity violations, got %d: %v", errorCount, rpt.Errors)
	}
}

func TestCMDBValidator_RequiredFieldPresent(t *testing.T) {
	v := NewCMDBValidator(Options{})

	data := map[string]interface{}{
		"id":     "uuid-123",
		"ci_type": "server",
		"name":   "web-01",
		"status": "active",
	}
	rpt := v.ValidateRecord(context.Background(), "uuid-123", "CI", data)

	nameErrors := 0
	for _, e := range rpt.Errors {
		if e.Field == "name" {
			nameErrors++
		}
	}
	if nameErrors > 0 {
		t.Error("name field is present and should not trigger required error")
	}
}

func TestCMDBValidator_StopOnFirstError(t *testing.T) {
	v := NewCMDBValidator(Options{StopOnFirstError: true})

	data := map[string]interface{}{
		"id":     "uuid-123",
		"ci_type": "server",
	}
	rpt := v.ValidateRecord(context.Background(), "uuid-123", "CI", data)

	// With StopOnFirstError, we should get at most a small number of errors
	if len(rpt.Errors) > 5 {
		t.Errorf("expected few errors with StopOnFirstError, got %d", len(rpt.Errors))
	}
}

func TestRequiredValidator(t *testing.T) {
	tests := []struct {
		operator string
		value    interface{}
		expect   bool
	}{
		{"not_null", "hello", true},
		{"not_null", nil, false},
		{"not_empty", "hello", true},
		{"not_empty", "", false},
		{"not_blank", "  hello  ", true},
		{"not_blank", "   ", false},
	}

	for _, tc := range tests {
		cond := `{"field":"name","operator":"` + tc.operator + `"}`
		validator := NewRequiredValidator("test", cond, "test error")

		data := map[string]interface{}{"name": tc.value}
		passed, msg := validator.Validate(context.Background(), data)

		if passed != tc.expect {
			t.Errorf("operator=%s value=%v: expected %v, got %v (msg=%s)", tc.operator, tc.value, tc.expect, passed, msg)
		}
	}
}

func TestCrossFieldValidator_Triggers(t *testing.T) {
	cond := `{"when":"status","equals":"retired","then":"deprecation_date","must":"not_null"}`
	validator := NewCrossFieldValidator("test-xfield", cond, "deprecation_date required")

	// Should fail: status=retired, no deprecation_date
	data1 := map[string]interface{}{"status": "retired", "name": "web-01"}
	passed1, _ := validator.Validate(context.Background(), data1)
	if passed1 {
		t.Error("expected cross-field validation to fail when status=retired and no deprecation_date")
	}

	// Should pass: status=retired, has deprecation_date
	data2 := map[string]interface{}{"status": "retired", "deprecation_date": "2025-01-01", "name": "web-01"}
	passed2, _ := validator.Validate(context.Background(), data2)
	if !passed2 {
		t.Error("expected cross-field validation to pass when deprecation_date is present")
	}

	// Should pass: status=active (rule not triggered)
	data3 := map[string]interface{}{"status": "active", "name": "web-01"}
	passed3, _ := validator.Validate(context.Background(), data3)
	if !passed3 {
		t.Error("expected cross-field validation to pass when status is not retired")
	}
}

func TestLengthValidator(t *testing.T) {
	cond := `{"field":"name","operator":"length_min","value":"3"}`
	validator := NewLengthValidator("test-len", cond, "name too short")

	data1 := map[string]interface{}{"name": "ab"}
	passed1, _ := validator.Validate(context.Background(), data1)
	if passed1 {
		t.Error("expected length_min=3 to fail for 'ab'")
	}

	data2 := map[string]interface{}{"name": "abc"}
	passed2, _ := validator.Validate(context.Background(), data2)
	if !passed2 {
		t.Error("expected length_min=3 to pass for 'abc'")
	}
}

func TestCMDBValidator_AddRule_RemoveRule(t *testing.T) {
	v := NewCMDBValidator(Options{})

	err := v.AddRule("custom-1", "Custom rule", "custom", "CI",
		`{"field":"name","operator":"not_empty"}`, "custom error", "error")
	if err != nil {
		t.Fatalf("AddRule failed: %v", err)
	}

	v.RemoveRule("custom-1")

	// Add back to check removal
	err = v.AddRule("custom-1", "Custom rule", "custom", "CI",
		`{"field":"name","operator":"not_empty"}`, "custom error", "error")
	if err != nil {
		t.Fatalf("AddRule failed: %v", err)
	}
}

func TestCMDBValidator_ValidateRecords(t *testing.T) {
	v := NewCMDBValidator(Options{})

	records := []RecordInput{
		{"r1", "CI", map[string]interface{}{"name": "server1", "ci_type": "srv", "id": "uuid-1"}},
		{"r2", "CI", map[string]interface{}{"name": "", "ci_type": "srv", "id": "uuid-2"}},
	}
	reports := v.ValidateRecords(context.Background(), records)

	if len(reports) != 2 {
		t.Fatalf("expected 2 reports, got %d", len(reports))
	}
	// r2 (empty name) should have at least as many errors as r1 (valid name)
	if len(reports[0].Errors) > len(reports[1].Errors) {
		t.Errorf("expected r2 errors (%d) >= r1 errors (%d): r1=%v r2=%v",
			len(reports[1].Errors), len(reports[0].Errors), reports[0].Errors, reports[1].Errors)
	}
}

func TestParseCondition(t *testing.T) {
	cond := `{"field":"name","operator":"not_empty","enum_values":["a","b"]}`
	rc, err := ParseCondition(cond)
	if err != nil {
		t.Fatalf("ParseCondition failed: %v", err)
	}
	if rc.Field != "name" || rc.Operator != "not_empty" || len(rc.EnumValues) != 2 {
		t.Errorf("unexpected parsed condition: %+v", rc)
	}
}

func TestParseConditionEmpty(t *testing.T) {
	_, err := ParseCondition("")
	if err == nil {
		t.Error("expected error for empty condition")
	}
}
