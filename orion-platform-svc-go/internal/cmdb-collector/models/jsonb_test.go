package models

import (
	"database/sql"
	"database/sql/driver"
	"testing"
)

// JSONB is the type behind the config, metadata and attributes columns. The
// repository binds these fields as INSERT/UPDATE arguments and scans them back
// on SELECT, so JSONB must implement both driver.Valuer and sql.Scanner — a
// bare map[string]interface{} implements neither and fails in both directions.

func TestJSONBValueNilIsNULL(t *testing.T) {
	var j JSONB
	v, err := j.Value()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Fatalf("expected a NULL driver value for a nil JSONB, got %v", v)
	}
}

func TestJSONBValueMarshalsToJSON(t *testing.T) {
	j := JSONB{"community": "public", "retries": 3}
	v, err := j.Value()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	bytes, ok := v.([]byte)
	if !ok {
		t.Fatalf("expected a []byte driver value, got %T", v)
	}
	if got := string(bytes); got != `{"community":"public","retries":3}` {
		t.Fatalf("unexpected payload: %s", got)
	}
}

func TestJSONBScanNULLIsNil(t *testing.T) {
	var j JSONB
	if err := j.Scan(nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if j != nil {
		t.Fatalf("expected a nil JSONB after scanning NULL, got %v", j)
	}
}

func TestJSONBScanBytes(t *testing.T) {
	var j JSONB
	if err := j.Scan([]byte(`{"community":"public","retries":3}`)); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if j["community"] != "public" {
		t.Fatalf("community = %v, want public", j["community"])
	}
	if j["retries"] != float64(3) {
		t.Fatalf("retries = %v, want float64(3)", j["retries"])
	}
}

func TestJSONBScanString(t *testing.T) {
	var j JSONB
	if err := j.Scan(`{"version":"v2c"}`); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if j["version"] != "v2c" {
		t.Fatalf("version = %v, want v2c", j["version"])
	}
}

func TestJSONBScanUnsupportedSourceIsError(t *testing.T) {
	var j JSONB
	if err := j.Scan(17); err == nil {
		t.Fatal("expected scanning an int into JSONB to fail")
	}
}

// TestJSONBColumnsAreBidirectional pins the five DB-backed fields to JSONB. If
// one of them reverted to a bare map[string]interface{}, its INSERT argument
// would be rejected by the driver and its SELECT scan would fail, so both
// interfaces are asserted per field.
func TestJSONBColumnsAreBidirectional(t *testing.T) {
	target := Target{}
	device := Device{}
	collection := Collection{}
	fields := []struct {
		name    string
		valuer  any
		scanner any
	}{
		{"Target.Config", target.Config, &target.Config},
		{"Target.Metadata", target.Metadata, &target.Metadata},
		{"Device.Attributes", device.Attributes, &device.Attributes},
		{"Device.Metadata", device.Metadata, &device.Metadata},
		{"Collection.Attributes", collection.Attributes, &collection.Attributes},
	}
	for _, f := range fields {
		if _, ok := f.valuer.(driver.Valuer); !ok {
			t.Errorf("%s does not implement driver.Valuer — INSERT bind would fail", f.name)
		}
		if _, ok := f.scanner.(sql.Scanner); !ok {
			t.Errorf("%s does not implement sql.Scanner — SELECT scan would fail", f.name)
		}
	}
}
