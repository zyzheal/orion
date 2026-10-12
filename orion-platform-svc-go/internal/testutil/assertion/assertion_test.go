package assertion

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/domain/events"
)

// fakeT implements the assertion.T interface for use in failure-path tests.
// It records the first failure message without aborting the test, allowing a
// single test function to verify multiple failure branches.
type fakeT struct {
	failed bool
	msg    string
}

func (f *fakeT) Helper()                            {}
func (f *fakeT) Errorf(format string, args ...any) { f.failed = true; f.msg = fmt.Sprintf(format, args...) }
func (f *fakeT) Fatalf(format string, args ...any)  { f.failed = true; f.msg = fmt.Sprintf(format, args...) }

func TestAssertion_FieldsEqualOnStruct(t *testing.T) {
	type Foo struct {
		Name string
		ID   int
		Skip string
	}
	a := Foo{Name: "alice", ID: 1, Skip: "old"}
	b := Foo{Name: "alice", ID: 1, Skip: "new"}
	capture := &fakeT{}
	FieldsEqual(capture, a, b, "Name", "ID")
	if capture.failed {
		t.Fatalf("FieldsEqual should pass on matching fields, got: %s", capture.msg)
	}
}

func TestAssertion_FieldsEqualFailsOnMismatch(t *testing.T) {
	type Foo struct{ Name string }
	capture := &fakeT{}
	FieldsEqual(capture, Foo{Name: "a"}, Foo{Name: "b"}, "Name")
	if !capture.failed {
		t.Fatal("FieldsEqual should fail on mismatch")
	}
	if !strings.Contains(capture.msg, "Name") {
		t.Errorf("Failure message should name the field, got: %s", capture.msg)
	}
}

func TestAssertion_FieldsEqualFailsOnMissingField(t *testing.T) {
	type Foo struct{ Name string }
	capture := &fakeT{}
	FieldsEqual(capture, Foo{Name: "a"}, Foo{Name: "b"}, "Nonexistent")
	if !capture.failed {
		t.Fatal("FieldsEqual should fail on missing field")
	}
	if !strings.Contains(capture.msg, "Nonexistent") {
		t.Errorf("Failure should mention the missing field, got: %s", capture.msg)
	}
}

func TestAssertion_FieldsEqualFailsOnNil(t *testing.T) {
	type Foo struct{ Name string }
	capture := &fakeT{}
	FieldsEqual(capture, (*Foo)(nil), Foo{Name: "a"}, "Name")
	if !capture.failed {
		t.Fatal("FieldsEqual should fail when expected is nil")
	}
}

func TestAssertion_AssertEventFieldsEqual(t *testing.T) {
	a := &events.BaseDomainEvent{
		BaseAggregateType: "pipeline",
		BaseAggregateID:   "id-1",
		BaseTenantID:      "tenant-1",
		BaseEventType:     "pipeline.created",
		BaseVersion:       5,
	}
	b := &events.BaseDomainEvent{
		BaseAggregateType: "pipeline",
		BaseAggregateID:   "id-1",
		BaseTenantID:      "tenant-1",
		BaseEventType:     "pipeline.created",
		BaseVersion:       5,
	}
	capture := &fakeT{}
	AssertEventFieldsEqual(capture, a, b, "BaseVersion")
	if capture.failed {
		t.Fatalf("AssertEventFieldsEqual should pass: %s", capture.msg)
	}
}

func TestAssertion_AssertEventFieldsEqualFails(t *testing.T) {
	a := &events.BaseDomainEvent{BaseAggregateID: "id-1"}
	b := &events.BaseDomainEvent{BaseAggregateID: "id-2"}
	capture := &fakeT{}
	AssertEventFieldsEqual(capture, a, b)
	if !capture.failed {
		t.Fatal("AssertEventFieldsEqual should fail on different IDs")
	}
}

func TestAssertion_AssertEventEqual(t *testing.T) {
	a := &events.BaseDomainEvent{BaseAggregateID: "id-1", BaseVersion: 2}
	b := &events.BaseDomainEvent{BaseAggregateID: "id-1", BaseVersion: 2}
	capture := &fakeT{}
	AssertEventEqual(capture, a, b)
	if capture.failed {
		t.Fatalf("AssertEventEqual should pass on identical events: %s", capture.msg)
	}
}

func TestAssertion_AssertUUIDv4(t *testing.T) {
	capture := &fakeT{}
	AssertUUIDv4(capture, "6ba7b810-9dad-11d1-80b4-00c04fd430c8")
	if !capture.failed {
		t.Fatal("v1 UUID should fail v4 assertion")
	}

	capture = &fakeT{}
	AssertUUIDv4(capture, "6ba7b810-9dad-41d1-80b4-00c04fd430c8")
	if capture.failed {
		t.Fatalf("v4 UUID should pass: %s", capture.msg)
	}

	capture = &fakeT{}
	AssertUUIDv4(capture, "")
	if !capture.failed {
		t.Fatal("Empty string should fail v4 assertion")
	}
}

func TestAssertion_AssertTimestampRecent(t *testing.T) {
	capture := &fakeT{}
	AssertTimestampRecent(capture, time.Now().UTC(), 5*time.Second)
	if capture.failed {
		t.Fatalf("Current time should be recent: %s", capture.msg)
	}

	capture = &fakeT{}
	AssertTimestampRecent(capture, time.Time{}, 5*time.Second)
	if !capture.failed {
		t.Fatal("Zero timestamp should fail recent assertion")
	}

	capture = &fakeT{}
	AssertTimestampRecent(capture, time.Now().Add(-10*time.Minute), 5*time.Second)
	if !capture.failed {
		t.Fatal("10-min-old timestamp should fail 5s recent assertion")
	}
}

func TestAssertion_AssertNonEmptyString(t *testing.T) {
	capture := &fakeT{}
	AssertNonEmptyString(capture, "hello", "name")
	if capture.failed {
		t.Errorf("Non-empty string should pass: %s", capture.msg)
	}

	capture = &fakeT{}
	AssertNonEmptyString(capture, "", "name")
	if !capture.failed {
		t.Error("Empty string should fail")
	}

	capture = &fakeT{}
	AssertNonEmptyString(capture, "   \t  \n", "name")
	if !capture.failed {
		t.Error("All-whitespace string should fail")
	}
}

func TestAssertion_FieldsEqualOnMap(t *testing.T) {
	a := map[string]interface{}{"k1": "v1", "k2": "v2"}
	b := map[string]interface{}{"k1": "v1", "k2": "v2"}
	capture := &fakeT{}
	FieldsEqual(capture, a, b, "k1", "k2")
	if capture.failed {
		t.Fatalf("FieldsEqual on map should pass: %s", capture.msg)
	}
}

func TestAssertion_FieldsEqualMapFailsOnMissing(t *testing.T) {
	a := map[string]interface{}{"k1": "v1"}
	b := map[string]interface{}{"k1": "v1"}
	capture := &fakeT{}
	FieldsEqual(capture, a, b, "missing")
	if !capture.failed {
		t.Fatal("FieldsEqual on map should fail on missing field")
	}
}
