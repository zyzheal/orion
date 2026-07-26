package service

import (
	"testing"

	"orion/notification-svc-go/internal/notification/models"
)

func TestEvaluateCondition(t *testing.T) {
	tests := []struct {
		name       string
		fieldValue interface{}
		operator   models.PolicyConditionOperator
		condValue  interface{}
		want       bool
	}{
		// eq
		{"eq_match_string", "critical", models.PolicyOpEQ, "critical", true},
		{"eq_no_match_string", "warning", models.PolicyOpEQ, "critical", false},
		{"eq_match_number", 10, models.PolicyOpEQ, 10, true},
		{"eq_no_match_number", 5, models.PolicyOpEQ, 10, false},

		// neq
		{"neq_match", "warning", models.PolicyOpNEQ, "critical", true},
		{"neq_no_match", "critical", models.PolicyOpNEQ, "critical", false},

		// contains
		{"contains_match", "OOMKilled pod restarted", models.PolicyOpContains, "OOM", true},
		{"contains_no_match", "healthy", models.PolicyOpContains, "OOM", false},
		{"contains_non_string_field", 123, models.PolicyOpContains, "OOM", false},
		{"contains_non_string_value", "hello", models.PolicyOpContains, 123, false},

		// gt
		{"gt_true", 10, models.PolicyOpGT, 5, true},
		{"gt_false", 3, models.PolicyOpGT, 5, false},
		{"gt_non_number_field", "abc", models.PolicyOpGT, 5, false},

		// lt
		{"lt_true", 3, models.PolicyOpLT, 5, true},
		{"lt_false", 10, models.PolicyOpLT, 5, false},

		// gte
		{"gte_true_equal", 5, models.PolicyOpGTE, 5, true},
		{"gte_true_greater", 10, models.PolicyOpGTE, 5, true},
		{"gte_false", 3, models.PolicyOpGTE, 5, false},

		// lte
		{"lte_true_equal", 5, models.PolicyOpLTE, 5, true},
		{"lte_true_less", 3, models.PolicyOpLTE, 5, true},
		{"lte_false", 10, models.PolicyOpLTE, 5, false},

		// in
		{"in_match", "prod", models.PolicyOpIn, []interface{}{"prod", "staging"}, true},
		{"in_no_match", "dev", models.PolicyOpIn, []interface{}{"prod", "staging"}, false},
		{"in_non_array", "prod", models.PolicyOpIn, "not-array", false},

		// regex (simple wildcard support)
		{"regex_wildcard", "production-us", models.PolicyOpRegex, "production*", true},
		{"regex_no_match", "staging-us", models.PolicyOpRegex, "production*", false},
		{"regex_non_string_field", 123, models.PolicyOpRegex, "production*", false},
		{"regex_empty_pattern", "anything", models.PolicyOpRegex, "", false},

		// unknown operator
		{"unknown_operator", "x", "unknown", "x", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluateCondition(tt.fieldValue, tt.operator, tt.condValue)
			if got != tt.want {
				t.Errorf("evaluateCondition(%v, %q, %v) = %v, want %v",
					tt.fieldValue, tt.operator, tt.condValue, got, tt.want)
			}
		})
	}
}

func TestGetNestedValue(t *testing.T) {
	tests := []struct {
		name string
		obj  map[string]interface{}
		path string
		want interface{}
	}{
		{"top_level", map[string]interface{}{"severity": "critical"}, "severity", "critical"},
		{"nested", map[string]interface{}{"alert": map[string]interface{}{"severity": "critical"}}, "alert.severity", "critical"},
		{"deep_nested", map[string]interface{}{"a": map[string]interface{}{"b": map[string]interface{}{"c": 42}}}, "a.b.c", 42},
		{"missing_top", map[string]interface{}{"severity": "critical"}, "missing", nil},
		{"missing_nested", map[string]interface{}{"alert": map[string]interface{}{"severity": "critical"}}, "alert.missing", nil},
		{"nil_intermediate", map[string]interface{}{"alert": nil}, "alert.severity", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getNestedValue(tt.obj, tt.path)
			if got != tt.want {
				t.Errorf("getNestedValue(%v, %q) = %v, want %v", tt.obj, tt.path, got, tt.want)
			}
		})
	}

	// empty_path should return the object itself (special case, map not comparable)
	t.Run("empty_path_returns_object", func(t *testing.T) {
		obj := map[string]interface{}{"severity": "critical"}
		got := getNestedValue(obj, "")
		if got == nil {
			t.Error("empty path should return the object, got nil")
		}
		// Verify it returns the original object by checking a key
		if m, ok := got.(map[string]interface{}); ok {
			if m["severity"] != "critical" {
				t.Errorf("expected severity=critical, got %v", m["severity"])
			}
		} else {
			t.Errorf("expected map[string]interface{}, got %T", got)
		}
	})
}

func TestMatchesConditions(t *testing.T) {
	svc := NewPolicyService(nil, nil)

	t.Run("empty conditions returns true", func(t *testing.T) {
		if !svc.MatchesConditions(map[string]interface{}{"severity": "critical"}, nil) {
			t.Error("empty conditions should match any event")
		}
		if !svc.MatchesConditions(map[string]interface{}{"severity": "critical"}, []models.PolicyCondition{}) {
			t.Error("empty conditions should match any event")
		}
	})

	t.Run("all conditions must match (AND logic)", func(t *testing.T) {
		conditions := []models.PolicyCondition{
			{Field: "severity", Operator: models.PolicyOpEQ, Value: "critical"},
			{Field: "env", Operator: models.PolicyOpIn, Value: []interface{}{"prod", "staging"}},
		}
		event := map[string]interface{}{"severity": "critical", "env": "prod"}
		if !svc.MatchesConditions(event, conditions) {
			t.Error("both conditions match, should return true")
		}

		event2 := map[string]interface{}{"severity": "critical", "env": "dev"}
		if svc.MatchesConditions(event2, conditions) {
			t.Error("second condition fails, should return false")
		}
	})

	t.Run("nested field matching", func(t *testing.T) {
		conditions := []models.PolicyCondition{
			{Field: "alert.severity", Operator: models.PolicyOpEQ, Value: "critical"},
		}
		event := map[string]interface{}{"alert": map[string]interface{}{"severity": "critical"}}
		if !svc.MatchesConditions(event, conditions) {
			t.Error("nested condition should match")
		}
	})

	t.Run("contains operator", func(t *testing.T) {
		conditions := []models.PolicyCondition{
			{Field: "message", Operator: models.PolicyOpContains, Value: "OOM"},
		}
		if !svc.MatchesConditions(map[string]interface{}{"message": "OOMKilled"}, conditions) {
			t.Error("contains should match")
		}
		if svc.MatchesConditions(map[string]interface{}{"message": "healthy"}, conditions) {
			t.Error("contains should not match")
		}
	})

	t.Run("gt/lt operators", func(t *testing.T) {
		gtCondition := []models.PolicyCondition{
			{Field: "count", Operator: models.PolicyOpGT, Value: 5},
		}
		if !svc.MatchesConditions(map[string]interface{}{"count": 10}, gtCondition) {
			t.Error("gt 10 > 5 should match")
		}
		if svc.MatchesConditions(map[string]interface{}{"count": 3}, gtCondition) {
			t.Error("gt 3 > 5 should not match")
		}

		ltCondition := []models.PolicyCondition{
			{Field: "count", Operator: models.PolicyOpLT, Value: 5},
		}
		if !svc.MatchesConditions(map[string]interface{}{"count": 3}, ltCondition) {
			t.Error("lt 3 < 5 should match")
		}
	})

	t.Run("in operator", func(t *testing.T) {
		conditions := []models.PolicyCondition{
			{Field: "env", Operator: models.PolicyOpIn, Value: []interface{}{"prod", "staging"}},
		}
		if !svc.MatchesConditions(map[string]interface{}{"env": "prod"}, conditions) {
			t.Error("in prod should match")
		}
		if svc.MatchesConditions(map[string]interface{}{"env": "dev"}, conditions) {
			t.Error("in dev should not match")
		}
	})
}

func TestPolicyServiceErrors(t *testing.T) {
	if ErrPolicyNotFound.Error() != "notification policy not found" {
		t.Errorf("unexpected ErrPolicyNotFound message: %s", ErrPolicyNotFound.Error())
	}
	if ErrWorkflowNotFound.Error() != "notification workflow not found" {
		t.Errorf("unexpected ErrWorkflowNotFound message: %s", ErrWorkflowNotFound.Error())
	}
}

func TestToFloat64(t *testing.T) {
	tests := []struct {
		input    interface{}
		wantVal  float64
		wantOk   bool
	}{
		{float64(3.14), 3.14, true},
		{int(10), 10, true},
		{int64(20), 20, true},
		{uint(30), 30, true},
		{float32(1.5), 1.5, true},
		{"3.14", 3.14, true},
		{"not-a-number", 0, false},
		{nil, 0, false},
		{true, 0, false},
	}

	for _, tt := range tests {
		got, ok := toFloat64(tt.input)
		if got != tt.wantVal || ok != tt.wantOk {
			t.Errorf("toFloat64(%v) = (%v, %v), want (%v, %v)", tt.input, got, ok, tt.wantVal, tt.wantOk)
		}
	}
}
