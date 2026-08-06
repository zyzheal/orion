package models

import (
	"database/sql"
	"encoding/json"
	"testing"
)

func TestParamTypeCatalog(t *testing.T) {
	catalog := ParamTypeCatalog()
	if len(catalog) != 20 {
		t.Fatalf("expected 20 built-in param types, got %d", len(catalog))
	}

	// Check a few expected entries
	codes := make(map[string]bool, len(catalog))
	for _, p := range catalog {
		codes[p.Code] = true
	}
	for _, code := range []string{"string", "number", "boolean", "email", "url", "json"} {
		if !codes[code] {
			t.Fatalf("catalog missing code %s", code)
		}
	}

	// Each entry should have name and category
	for _, p := range catalog {
		if p.Name == "" {
			t.Fatalf("param type %s has empty name", p.Code)
		}
		if p.Category == "" {
			t.Fatalf("param type %s has empty category", p.Code)
		}
	}
}

func TestJSONB_Value(t *testing.T) {
	jb := JSONB{"key": "value"}
	v, err := jb.Value()
	if err != nil {
		t.Fatalf("JSONB.Value: %v", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(v.([]byte)), &m); err != nil {
		t.Fatalf("JSONB.Value should produce valid JSON: %v", err)
	}

	// nil JSONB
	jbNil := JSONB(nil)
	v2, err := jbNil.Value()
	if err != nil {
		t.Fatalf("nil JSONB.Value: %v", err)
	}
	if v2 != nil {
		t.Fatalf("nil JSONB.Value should return nil, got %v", v2)
	}
}

func TestJSONB_Scan(t *testing.T) {
	var jb JSONB

	// Scan from []byte
	if err := jb.Scan([]byte(`{"x":1}`)); err != nil {
		t.Fatalf("JSONB.Scan from []byte: %v", err)
	}
	if jb["x"] != float64(1) {
		t.Fatalf("expected x=1, got %v", jb["x"])
	}

	// Scan from string
	jb2 := JSONB{}
	if err := jb2.Scan(`{"y":"hello"}`); err != nil {
		t.Fatalf("JSONB.Scan from string: %v", err)
	}
	if jb2["y"] != "hello" {
		t.Fatalf("expected y=hello, got %v", jb2["y"])
	}

	// Scan nil
	jb3 := JSONB{"old": true}
	if err := jb3.Scan(nil); err != nil {
		t.Fatalf("JSONB.Scan nil: %v", err)
	}
	if jb3 != nil {
		t.Fatalf("expected nil after scanning nil, got %v", jb3)
	}

	// Scan unsupported type
	var jb4 JSONB
	err := jb4.Scan(sql.NullInt64{Int64: 42, Valid: true})
	if err == nil {
		t.Fatal("JSONB.Scan unsupported type should error")
	}
}

func TestScriptParamType_JSONMarshal(t *testing.T) {
	pt := ScriptParamType{
		ID:       "test-1",
		TenantID: "t1",
		Name:     "Test String",
		Code:     "string",
		Label:    "Test",
		Category: "basic",
		Enabled:  true,
	}
	data, err := json.Marshal(pt)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var out ScriptParamType
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.ID != "test-1" || out.Code != "string" {
		t.Fatalf("round-trip mismatch: %+v", out)
	}
}

func TestScriptParamTemplate_JSONMarshal(t *testing.T) {
	template := ScriptParamTemplate{
		ID:        "tpl-1",
		TenantID:  "t1",
		Name:      "Env",
		ParamType: "select",
		Required:  true,
		Position:  1,
		Example:   "prod",
	}
	data, err := json.Marshal(template)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var out ScriptParamTemplate
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.ID != "tpl-1" || out.Position != 1 {
		t.Fatalf("round-trip mismatch: %+v", out)
	}
}

func TestValidateParamResponse(t *testing.T) {
	resp := ValidateParamResponse{
		Valid:  true,
		Type:   "number",
		Parsed: float64(42),
	}
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var out ValidateParamResponse
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !out.Valid || out.Type != "number" {
		t.Fatalf("round-trip mismatch: %+v", out)
	}
}

func TestCreateParamTypeRequest(t *testing.T) {
	req := CreateParamTypeRequest{
		Name:     "Custom",
		Code:     "string",
		Enabled:  true,
		Validation: JSONB{"min_length": 5},
	}
	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var out CreateParamTypeRequest
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.Name != "Custom" || !out.Enabled {
		t.Fatalf("round-trip mismatch: %+v", out)
	}
}
