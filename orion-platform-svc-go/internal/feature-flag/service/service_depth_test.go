package service

import (
	"testing"

	"orion/platform-svc-go/internal/feature-flag/models"
)

// ---------------------------------------------------------------------------
// hashUserID
// ---------------------------------------------------------------------------

func TestHashUserIDReturnsBucket0To99(t *testing.T) {
	for _, userId := range []string{"", "alice", "bob-999", "very-long-user-id-that-should-still-hash"} {
		for _, key := range []string{"", "flag-a", "flag-b"} {
			b := hashUserID(userId, key)
			if b < 0 || b >= 100 {
				t.Errorf("hashUserID(%q, %q) = %d, want 0..99", userId, key, b)
			}
		}
	}
}

func TestHashUserIDDeterministic(t *testing.T) {
	a := hashUserID("user-1", "flag-x")
	b := hashUserID("user-1", "flag-x")
	if a != b {
		t.Errorf("not deterministic: %d vs %d", a, b)
	}
}

func TestHashUserIDDiffersByUserID(t *testing.T) {
	seen := map[int]int{}
	for i := 0; i < 50; i++ {
		b := hashUserID(string(rune('a'+i%26))+string(rune('0'+i/26)), "same")
		seen[b]++
	}
	if len(seen) < 10 {
		t.Errorf("expected many distinct buckets, got %d distinct", len(seen))
	}
}

func TestHashUserIDDiffersByFlagKey(t *testing.T) {
	a := hashUserID("same-user", "flag-A")
	b := hashUserID("same-user", "flag-B")
	if a == b {
		t.Errorf("different flag keys should give different buckets, both = %d", a)
	}
}

// ---------------------------------------------------------------------------
// containsEnvironment
// ---------------------------------------------------------------------------

func TestContainsEnvironmentFound(t *testing.T) {
	envs := models.StringArray{"dev", "prod", "staging"}
	if !containsEnvironment(envs, "prod") {
		t.Error("prod should be found")
	}
}

func TestContainsEnvironmentNotFound(t *testing.T) {
	envs := models.StringArray{"dev", "prod"}
	if containsEnvironment(envs, "qa") {
		t.Error("qa should not be found")
	}
}

func TestContainsEnvironmentEmpty(t *testing.T) {
	if containsEnvironment(nil, "anything") {
		t.Error("nil slice should return false")
	}
	if containsEnvironment(models.StringArray{}, "anything") {
		t.Error("empty slice should return false")
	}
}

func TestContainsEnvironmentCaseSensitive(t *testing.T) {
	envs := models.StringArray{"PROD"}
	if containsEnvironment(envs, "prod") {
		t.Error("comparison should be case-sensitive")
	}
}

// ---------------------------------------------------------------------------
// evaluateRule
// ---------------------------------------------------------------------------

func TestEvaluateRuleEquals(t *testing.T) {
	if !evaluateRule("equals", "foo", "foo") {
		t.Error("equals foo==foo")
	}
	if evaluateRule("equals", "foo", "bar") {
		t.Error("equals foo!=bar")
	}
	// int vs int64 same value
	if !evaluateRule("equals", 42, int64(42)) {
		t.Error("equals 42 vs int64(42) should match via fmt.Sprintf")
	}
}

func TestEvaluateRuleContains(t *testing.T) {
	if !evaluateRule("contains", "orion", "orion-platform") {
		t.Error("contains orion in orion-platform")
	}
	if evaluateRule("contains", "xyz", "orion-platform") {
		t.Error("contains xyz not in orion-platform")
	}
}

func TestEvaluateRuleIn(t *testing.T) {
	values := []interface{}{"a", "b", "c"}
	if !evaluateRule("in", values, "b") {
		t.Error("in: b should match [a b c]")
	}
	if evaluateRule("in", values, "z") {
		t.Error("in: z should not match [a b c]")
	}
	if evaluateRule("in", "not-a-slice", "b") {
		t.Error("in: non-slice rule value should return false")
	}
}

func TestEvaluateRuleNumericComparisons(t *testing.T) {
	if !evaluateRule("gt", 5, 10) {
		t.Error("gt: 10 > 5")
	}
	if evaluateRule("gt", 5, 5) {
		t.Error("gt: 5 !> 5")
	}
	if !evaluateRule("lt", 10, 5) {
		t.Error("lt: 5 < 10")
	}
	if evaluateRule("lt", 5, 5) {
		t.Error("lt: 5 !< 5")
	}
}

func TestEvaluateRuleRejectsNonNumericForGtLt(t *testing.T) {
	if evaluateRule("gt", "x", "y") {
		t.Error("gt with non-numeric should return false")
	}
	if evaluateRule("lt", 5, "not-a-number") {
		t.Error("lt with non-numeric attr should return false")
	}
}

func TestEvaluateRuleRegex(t *testing.T) {
	if !evaluateRule("regex", `^pro`, "prod") {
		t.Error("regex ^pro should match prod")
	}
	if evaluateRule("regex", `^dev`, "prod") {
		t.Error("regex ^dev should not match prod")
	}
	// invalid pattern
	if evaluateRule("regex", "[", "prod") {
		t.Error("invalid regex should return false")
	}
	// non-string rule value
	if evaluateRule("regex", 42, "prod") {
		t.Error("non-string rule value should return false")
	}
}

func TestEvaluateRuleUnknownOperator(t *testing.T) {
	if evaluateRule("unknown", "x", "y") {
		t.Error("unknown operator should return false")
	}
}

// ---------------------------------------------------------------------------
// matchTargetingRules
// ---------------------------------------------------------------------------

func TestMatchTargetingRulesAllMatch(t *testing.T) {
	rules := models.JSONArray{
		map[string]interface{}{"attribute": "env", "operator": "equals", "value": "prod"},
		map[string]interface{}{"attribute": "role", "operator": "in", "value": []interface{}{"admin", "dev"}},
	}
	attrs := map[string]interface{}{"env": "prod", "role": "admin"}
	if !matchTargetingRules(rules, attrs) {
		t.Error("all rules should match")
	}
}

func TestMatchTargetingRulesFailsOnAnyMismatch(t *testing.T) {
	rules := models.JSONArray{
		map[string]interface{}{"attribute": "env", "operator": "equals", "value": "prod"},
		map[string]interface{}{"attribute": "role", "operator": "equals", "value": "admin"},
	}
	attrs := map[string]interface{}{"env": "prod", "role": "user"}
	if matchTargetingRules(rules, attrs) {
		t.Error("second rule mismatch should fail")
	}
}

func TestMatchTargetingRulesFailsOnMissingAttribute(t *testing.T) {
	rules := models.JSONArray{
		map[string]interface{}{"attribute": "missing", "operator": "equals", "value": "x"},
	}
	attrs := map[string]interface{}{"env": "prod"}
	if matchTargetingRules(rules, attrs) {
		t.Error("missing attribute should fail")
	}
}

func TestMatchTargetingRulesEmptyRulesPass(t *testing.T) {
	if !matchTargetingRules(models.JSONArray{}, map[string]interface{}{}) {
		t.Error("empty rules should pass (vacuously true)")
	}
	if !matchTargetingRules(nil, map[string]interface{}{}) {
		t.Error("nil rules should pass")
	}
}

func TestMatchTargetingRulesSkipsMalformedRules(t *testing.T) {
	rules := models.JSONArray{
		"not-a-map",                                     // skipped
		map[string]interface{}{"attribute": "env", "operator": "equals", "value": "prod"},
	}
	attrs := map[string]interface{}{"env": "prod"}
	if !matchTargetingRules(rules, attrs) {
		t.Error("malformed rule should be skipped, valid one should match")
	}
}

// ---------------------------------------------------------------------------
// toFloat
// ---------------------------------------------------------------------------

func TestToFloatAcceptsNumericTypes(t *testing.T) {
	cases := []struct {
		input interface{}
		want  float64
	}{
		{1.5, 1.5},
		{float32(2.5), 2.5},
		{42, 42},
		{int64(99), 99},
		{"3.14", 3.14},
	}
	for _, tc := range cases {
		got, err := toFloat(tc.input)
		if err != nil {
			t.Errorf("toFloat(%v) err: %v", tc.input, err)
			continue
		}
		if got != tc.want {
			t.Errorf("toFloat(%v) = %v, want %v", tc.input, got, tc.want)
		}
	}
}

func TestToFloatRejectsInvalidString(t *testing.T) {
	if _, err := toFloat("not-a-number"); err == nil {
		t.Error("invalid string should return error")
	}
}

func TestToFloatRejectsUnsupportedTypes(t *testing.T) {
	_, err := toFloat([]int{1, 2})
	if err == nil {
		t.Error("slice should return error")
	}
	_, err = toFloat(true)
	if err == nil {
		t.Error("bool should return error")
	}
	_, err = toFloat(map[string]int{})
	if err == nil {
		t.Error("map should return error")
	}
}
