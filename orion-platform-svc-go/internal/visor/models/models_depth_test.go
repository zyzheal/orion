package models

import (
	"testing"
)

// JSONB.Value / Scan — the only code in this bridge package with runtime logic.

func TestJSONBValueNilReturnsNil(t *testing.T) {
	var j JSONB
	v, err := j.Value()
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if v != nil {
		t.Errorf("nil JSONB.Value() = %v, want nil", v)
	}
}

func TestJSONBValueMarshal(t *testing.T) {
	j := JSONB{"x": 1}
	v, err := j.Value()
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	b, ok := v.([]byte)
	if !ok || string(b) != `{"x":1}` {
		t.Errorf("marshaled = %v", v)
	}
}

func TestJSONBScanNil(t *testing.T) {
	j := JSONB{"old": 1}
	if err := j.Scan(nil); err != nil {
		t.Fatalf("err: %v", err)
	}
	if j != nil {
		t.Errorf("Scan(nil) should set to nil, got %v", j)
	}
}

func TestJSONBScanFromBytes(t *testing.T) {
	var j JSONB
	if err := j.Scan([]byte(`{"a":"b"}`)); err != nil {
		t.Fatalf("err: %v", err)
	}
	if j["a"] != "b" {
		t.Errorf("j = %v", j)
	}
}

func TestJSONBScanFromString(t *testing.T) {
	var j JSONB
	if err := j.Scan(`{"c":2}`); err != nil {
		t.Fatalf("err: %v", err)
	}
	if j["c"] != float64(2) {
		t.Errorf("j = %v", j)
	}
}

func TestJSONBScanRejectsUnsupportedType(t *testing.T) {
	var j JSONB
	if err := j.Scan(42); err == nil {
		t.Error("int should return error")
	}
}

func TestJSONBScanRejectsInvalidJSON(t *testing.T) {
	var j JSONB
	if err := j.Scan([]byte("not-json")); err == nil {
		t.Error("invalid JSON should return error")
	}
}

// PaginatedResponse — plain data holder; verify constructor + zero value.
func TestPaginatedResponseZeroValue(t *testing.T) {
	p := PaginatedResponse{}
	if p.Total != 0 || p.Data != nil {
		t.Errorf("zero PaginatedResponse should have Total=0 Data=nil, got %+v", p)
	}
}
