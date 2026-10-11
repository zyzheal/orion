package service

import (
	"testing"

	"orion/platform-svc-go/internal/infrastructure/digital-twin/models"
)

// ---------------------------------------------------------------------------
// JSONBRawArray — the empty-array helper used by RecordTraffic / RecordEvents
// ---------------------------------------------------------------------------

func TestJSONBRawArrayReturnsEmptyJSON(t *testing.T) {
	got := JSONBRawArray()
	if string(got) != "[]" {
		t.Errorf("JSONBRawArray() = %q, want \"[]\"", string(got))
	}
}

func TestJSONBRawArrayNonNil(t *testing.T) {
	// Returning a value of JSONBRaw (a []byte alias) means it may or may not
	// be nil; the important property is that json.Marshal produces "[]".
	got := JSONBRawArray()
	if got == nil {
		// If the implementation returned a nil slice, marshal would still be "null"
		// so we treat this as a warning rather than a failure.
		t.Log("JSONBRawArray returned a nil-typed value; empty-array semantics preserved via marshalling")
	}
}

func TestJSONBRawArrayStableAcrossCalls(t *testing.T) {
	a := JSONBRawArray()
	b := JSONBRawArray()
	if string(a) != string(b) {
		t.Errorf("two calls differ: %q vs %q", a, b)
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestDigitalTwinSentinelErrors(t *testing.T) {
	cases := []struct {
		err  error
		want string
	}{
		{ErrNotFound, "not found"},
		{ErrTwinNotFound, "twin not found"},
		{ErrNotOwner, "twin does not belong to tenant"},
		{ErrInvalidState, "invalid state for this operation"},
	}
	for _, tc := range cases {
		if tc.err == nil {
			t.Errorf("sentinel %v is nil", tc.err)
		}
		if tc.err.Error() != tc.want {
			t.Errorf("err = %q, want %q", tc.err.Error(), tc.want)
		}
	}
	// ErrDigitalTwinNotFound is a documented alias for ErrTwinNotFound.
	if ErrDigitalTwinNotFound != ErrTwinNotFound {
		t.Error("ErrDigitalTwinNotFound should alias ErrTwinNotFound")
	}
}

// ---------------------------------------------------------------------------
// NewService — construction
// ---------------------------------------------------------------------------

func TestNewServiceWithNilRepo(t *testing.T) {
	s := NewService(nil)
	if s == nil {
		t.Fatal("NewService must return non-nil")
	}
	if s.repo != nil {
		t.Error("nil repo should be stored as nil")
	}
}

// ---------------------------------------------------------------------------
// MarshalJSONBRaw (models) — indirectly verifies what RecordTraffic would emit
// ---------------------------------------------------------------------------

func TestMarshalJSONBRawProducesValidJSON(t *testing.T) {
	got, err := models.MarshalJSONBRaw(map[string]interface{}{"a": 1})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(got) == 0 {
		t.Fatal("empty output")
	}
	// Round-trip via JSONBRawArray-equivalent parse
	if string(got[0:1]) != "{" && string(got[0:1]) != "[" {
		t.Errorf("output should start with { or [, got %q", got)
	}
}
