// Package assertion provides field-level assertions that replace Snapshot
// Assertion anti-patterns (e.g. `!= nil` checks on complex objects).
//
// The anti-pattern: a test calls a service and asserts `result != nil`,
// which passes even if every field of the returned object is empty or wrong.
// The fix: use AssertFieldsEqual to compare each field by name.
package assertion

import (
	"fmt"
	"reflect"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/domain/events"
)

// T is the minimal testing surface used by assertions in this package.
// *testing.T, *testing.B, and testing.TB all satisfy it. A fake test
// double only needs to implement these three methods.
type T interface {
	Helper()
	Errorf(format string, args ...any)
	Fatalf(format string, args ...any)
}

// FieldsEqual compares two structs/maps by a subset of named fields.
// expected and actual must be of the same type.
// If a field does not exist on the type, the test fails with a clear error.
//
// Example:
//
//	assertion.FieldsEqual(t, expectedEvent, actualEvent, "AggregateID", "TenantID", "EventType")
func FieldsEqual(t T, expected, actual interface{}, fields ...string) {
	t.Helper()
	if expected == nil && actual == nil {
		return
	}
	if expected == nil || actual == nil {
		t.Fatalf("FieldsEqual: one side is nil (expected=%v, actual=%v)", expected, actual)
		return
	}

	ev := reflect.ValueOf(expected)
	av := reflect.ValueOf(actual)
	for _, e := range []struct {
		name string
		v    reflect.Value
	}{
		{"expected", ev},
		{"actual", av},
	} {
		if e.v.Kind() == reflect.Ptr {
			if e.v.IsNil() {
				t.Fatalf("FieldsEqual: %s is nil pointer", e.name)
				return
			}
		}
	}

	if ev.Kind() == reflect.Ptr {
		ev = ev.Elem()
	}
	if av.Kind() == reflect.Ptr {
		av = av.Elem()
	}
	if ev.Kind() != av.Kind() {
		t.Fatalf("FieldsEqual: kind mismatch expected=%s actual=%s", ev.Kind(), av.Kind())
		return
	}

	if ev.Kind() == reflect.Map {
		for _, f := range fields {
			kv := reflect.ValueOf(f)
			evv := ev.MapIndex(kv)
			avv := av.MapIndex(kv)
			if !evv.IsValid() {
				t.Fatalf("FieldsEqual: field %q missing on expected map", f)
				return
			}
			if !avv.IsValid() {
				t.Fatalf("FieldsEqual: field %q missing on actual map", f)
				return
			}
			if !reflect.DeepEqual(evv.Interface(), avv.Interface()) {
				t.Errorf("FieldsEqual: field %q expected=%v actual=%v", f, evv.Interface(), avv.Interface())
			}
		}
		return
	}

	if ev.Kind() != reflect.Struct {
		t.Fatalf("FieldsEqual: unsupported kind %s (use assert.Equal instead)", ev.Kind())
		return
	}
	et := ev.Type()
	for _, f := range fields {
		_, ok := et.FieldByName(f)
		if !ok {
			t.Fatalf("FieldsEqual: field %q does not exist on type %s", f, et.Name())
			return
		}
		evv := ev.FieldByName(f)
		avv := av.FieldByName(f)
		if !reflect.DeepEqual(evv.Interface(), avv.Interface()) {
			t.Errorf("FieldsEqual: field %q expected=%v actual=%v", f, evv.Interface(), avv.Interface())
		}
	}
}

// AssertEventFieldsEqual compares two DomainEvent instances by a curated
// field set. This is the recommended replacement for `!= nil` on events.
//
// Default fields compared: AggregateType, AggregateID, TenantID, EventType.
// Pass additional field names (e.g. "CorrelationID") as needed.
func AssertEventFieldsEqual(t T, expected, actual events.DomainEvent, extraFields ...string) {
	t.Helper()
	if expected == nil || actual == nil {
		t.Fatalf("AssertEventFieldsEqual: expected=%v actual=%v (both must be non-nil)", expected, actual)
		return
	}
	fields := append([]string{"BaseAggregateType", "BaseAggregateID", "BaseTenantID", "BaseEventType"}, extraFields...)

	ev, ok := expected.(*events.BaseDomainEvent)
	if !ok {
		t.Fatalf("AssertEventFieldsEqual: expected must be *events.BaseDomainEvent (got %T)", expected)
		return
	}
	av, ok := actual.(*events.BaseDomainEvent)
	if !ok {
		t.Fatalf("AssertEventFieldsEqual: actual must be *events.BaseDomainEvent (got %T)", actual)
		return
	}
	FieldsEqual(t, ev, av, fields...)
}

// AssertEventEqual is a strict variant that compares every BaseDomainEvent
// field. Use when you want full-field equality rather than a curated subset.
func AssertEventEqual(t T, expected, actual events.DomainEvent) {
	t.Helper()
	if expected == nil || actual == nil {
		t.Fatalf("AssertEventEqual: expected=%v actual=%v", expected, actual)
		return
	}
	ev, ok := expected.(*events.BaseDomainEvent)
	if !ok {
		t.Fatalf("AssertEventEqual: expected must be *events.BaseDomainEvent (got %T)", expected)
		return
	}
	av, ok := actual.(*events.BaseDomainEvent)
	if !ok {
		t.Fatalf("AssertEventEqual: actual must be *events.BaseDomainEvent (got %T)", actual)
		return
	}
	assert.Equal(t, ev, av, "events must be deeply equal")
}

// AssertUUIDv4 validates that s is a non-empty UUID v4 string. Useful for
// asserting that persisted IDs are generated correctly.
func AssertUUIDv4(t T, s string, msgAndArgs ...interface{}) {
	t.Helper()
	if s == "" {
		t.Fatalf("AssertUUIDv4: value is empty (%s)", formatMsg(msgAndArgs))
		return
	}
	u, err := uuid.Parse(s)
	if err != nil {
		t.Fatalf("AssertUUIDv4: %q is not a UUID (%s)", s, formatMsg(msgAndArgs))
		return
	}
	if u.Version() != 4 {
		t.Fatalf("AssertUUIDv4: %q is UUID v%d, expected v4 (%s)", s, u.Version(), formatMsg(msgAndArgs))
	}
}

// AssertTimestampRecent validates that ts is within maxAge of time.Now().
// Use it to assert that persisted timestamps are set, not left zero.
func AssertTimestampRecent(t T, ts time.Time, maxAge time.Duration, msgAndArgs ...interface{}) {
	t.Helper()
	if ts.IsZero() {
		t.Fatalf("AssertTimestampRecent: timestamp is zero (%s)", formatMsg(msgAndArgs))
		return
	}
	delta := time.Since(ts)
	if delta < 0 {
		delta = -delta
	}
	if delta > maxAge {
		t.Fatalf("AssertTimestampRecent: ts=%s is %s old (max %s) (%s)",
			ts.Format(time.RFC3339), delta, maxAge, formatMsg(msgAndArgs))
	}
}

// AssertNonEmptyString asserts that s is a non-empty, non-whitespace string.
// Prefer this over `assert.NotNil` when the field is conceptually a string ID
// or label.
func AssertNonEmptyString(t T, s string, name string) {
	t.Helper()
	if s == "" {
		t.Errorf("AssertNonEmptyString: %s is empty", name)
		return
	}
	for _, r := range s {
		if r != ' ' && r != '\t' && r != '\n' {
			return
		}
	}
	t.Errorf("AssertNonEmptyString: %s is all whitespace (%q)", name, s)
}

func formatMsg(msgAndArgs []interface{}) string {
	if len(msgAndArgs) == 0 {
		return ""
	}
	if s, ok := msgAndArgs[0].(string); ok {
		return fmt.Sprintf(s, msgAndArgs[1:]...)
	}
	return fmt.Sprintf("%v", msgAndArgs)
}
