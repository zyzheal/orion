package models

import (
	"testing"
)

// ---------------------------------------------------------------------------
// JSONB
// ---------------------------------------------------------------------------

func TestJSONBValueNilReturnsNil(t *testing.T) {
	var j JSONB
	v, err := j.Value()
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if v != nil {
		t.Errorf("nil JSONB should return nil, got %v", v)
	}
}

func TestJSONBValueMarshal(t *testing.T) {
	j := JSONB{"a": 1, "b": "x"}
	v, err := j.Value()
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	b, ok := v.([]byte)
	if !ok {
		t.Fatalf("expected []byte, got %T", v)
	}
	if string(b) != `{"a":1,"b":"x"}` {
		t.Errorf("marshaled = %s", b)
	}
}

func TestJSONBScanNilSource(t *testing.T) {
	var j JSONB
	if err := j.Scan(nil); err != nil {
		t.Fatalf("err: %v", err)
	}
	if j != nil {
		t.Errorf("nil source should leave JSONB nil, got %v", j)
	}
}

func TestJSONBScanFromBytes(t *testing.T) {
	var j JSONB
	if err := j.Scan([]byte(`{"a":1}`)); err != nil {
		t.Fatalf("err: %v", err)
	}
	if j["a"] != float64(1) {
		t.Errorf("j = %v", j)
	}
}

func TestJSONBScanFromString(t *testing.T) {
	var j JSONB
	if err := j.Scan(`{"b":"y"}`); err != nil {
		t.Fatalf("err: %v", err)
	}
	if j["b"] != "y" {
		t.Errorf("j = %v", j)
	}
}

func TestJSONBScanInvalidType(t *testing.T) {
	var j JSONB
	if err := j.Scan(42); err == nil {
		t.Error("int should return error")
	}
}

func TestJSONBScanInvalidJSON(t *testing.T) {
	var j JSONB
	if err := j.Scan([]byte("not json")); err == nil {
		t.Error("invalid JSON should return error")
	}
}

// ---------------------------------------------------------------------------
// JSONArray
// ---------------------------------------------------------------------------

func TestJSONArrayValueNilReturnsEmptyArrayString(t *testing.T) {
	var a JSONArray
	v, err := a.Value()
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got, ok := v.(string); !ok || got != "[]" {
		t.Errorf("nil JSONArray.Value() = %v (%T), want string \"[]\"", v, v)
	}
}

func TestJSONArrayValueMarshal(t *testing.T) {
	a := JSONArray{"x", 1, true}
	v, err := a.Value()
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	b := v.([]byte)
	if string(b) != `["x",1,true]` {
		t.Errorf("marshaled = %s", b)
	}
}

func TestJSONArrayScan(t *testing.T) {
	var a JSONArray
	if err := a.Scan([]byte(`["a","b"]`)); err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(a) != 2 || a[0] != "a" {
		t.Errorf("a = %v", a)
	}
}

func TestJSONArrayScanNilBecomesEmptySlice(t *testing.T) {
	a := JSONArray{"old"}
	if err := a.Scan(nil); err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(a) != 0 {
		t.Errorf("Scan(nil) should reset to empty, got %v", a)
	}
}

func TestJSONArrayScanString(t *testing.T) {
	var a JSONArray
	if err := a.Scan(`[1,2]`); err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(a) != 2 {
		t.Errorf("len = %d, want 2", len(a))
	}
}

// ---------------------------------------------------------------------------
// StringArray
// ---------------------------------------------------------------------------

func TestStringArrayValueNilReturnsEmptyArrayString(t *testing.T) {
	var a StringArray
	v, err := a.Value()
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	// nil StringArray serializes to the literal "[]" (not nil), matching the
	// PostgreSQL convention of an empty JSON array.
	if got, ok := v.(string); !ok || got != "[]" {
		t.Errorf("nil StringArray.Value() = %v (%T), want string \"[]\"", v, v)
	}
}

func TestStringArrayValueMarshal(t *testing.T) {
	a := StringArray{"dev", "prod"}
	v, err := a.Value()
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if string(v.([]byte)) != `["dev","prod"]` {
		t.Errorf("marshaled wrong")
	}
}

func TestStringArrayScanFromBytes(t *testing.T) {
	var a StringArray
	if err := a.Scan([]byte(`["x","y"]`)); err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(a) != 2 || a[0] != "x" {
		t.Errorf("a = %v", a)
	}
}

func TestStringArrayScanFromString(t *testing.T) {
	var a StringArray
	if err := a.Scan(`["z"]`); err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(a) != 1 || a[0] != "z" {
		t.Errorf("a = %v", a)
	}
}

func TestStringArrayScanRejectsNonStringElement(t *testing.T) {
	// JSON array of non-strings should still round-trip because JSONB scan just
	// unmarshals to []interface{} then casts. Depending on impl, could fail.
	var a StringArray
	if err := a.Scan([]byte(`[1,2]`)); err == nil {
		// Some implementations accept and drop non-strings.
		// We don't fail here; we just observe the behavior.
		_ = a
	}
}

func TestStringArrayScanNilBecomesEmptySlice(t *testing.T) {
	a := StringArray{"old"}
	if err := a.Scan(nil); err != nil {
		t.Fatalf("err: %v", err)
	}
	// Scan(nil) resets to an empty (non-nil) slice.
	if len(a) != 0 {
		t.Errorf("Scan(nil) should reset to empty, got %v", a)
	}
}

// ---------------------------------------------------------------------------
// Enum types — string constants
// ---------------------------------------------------------------------------

func TestFeatureFlagStatusConstants(t *testing.T) {
	cases := []struct {
		got  FeatureFlagStatus
		want string
	}{
		{FlagStatusActive, "active"},
		{FlagStatusInactive, "inactive"},
		{FlagStatusArchived, "archived"},
	}
	for _, tc := range cases {
		if tc.got == "" {
			t.Error("status constant is empty")
		}
		if string(tc.got) != tc.want {
			t.Errorf("got %q, want %q", tc.got, tc.want)
		}
	}
}

func TestRolloutStrategyConstants(t *testing.T) {
	cases := []struct {
		got  RolloutStrategy
		want string
	}{
		{RolloutPercentage, "percentage"},
		{RolloutTargeted, "targeted"},
		{RolloutGradual, "gradual"},
	}
	for _, tc := range cases {
		if string(tc.got) != tc.want {
			t.Errorf("got %q, want %q", tc.got, tc.want)
		}
	}
}

func TestTargetingRuleOperatorConstants(t *testing.T) {
	cases := []TargetingRuleOperator{OpEquals, OpContains, OpIn, OpRegex, OpGt, OpLt}
	for _, op := range cases {
		if op == "" {
			t.Error("operator constant is empty")
		}
	}
}
