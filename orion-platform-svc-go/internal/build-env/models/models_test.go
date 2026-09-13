package models

import "testing"

// ValidEventType is the guard that keeps an unknown event_type out of
// cache_events. It is the complement of the table's CHECK constraint: without
// it a caller recording event_type "probe" would insert a row that every
// COUNT(*) FILTER in the repository ignores, so the write would succeed and
// change nothing.
func TestValidEventTypeAcceptsTheThreeRecordedKinds(t *testing.T) {
	for _, v := range []string{EventTypeHit, EventTypeMiss, EventTypeEvict} {
		if !ValidEventType(v) {
			t.Fatalf("ValidEventType(%q) = false, want true", v)
		}
	}
}

func TestValidEventTypeRejectsUnknownAndEmpty(t *testing.T) {
	for _, v := range []string{"", "HIT", "Hit", "hits", "probe", "cache-hit", "unknown", "evicts"} {
		if ValidEventType(v) {
			t.Fatalf("ValidEventType(%q) = true, want false", v)
		}
	}
}
