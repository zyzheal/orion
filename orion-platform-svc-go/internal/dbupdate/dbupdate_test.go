package dbupdate

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestBuild_RendersWhitelistedColumnsSorted(t *testing.T) {
	stmt, args, err := Build("change_rfcs", map[string]any{
		"status": "approved",
		"title":  "Restart the cache",
	}, []string{"title", "description", "status"}, "r-1", "t-1")
	if err != nil {
		t.Fatal(err)
	}
	want := "UPDATE change_rfcs SET status = $1, title = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5"
	if stmt != want {
		t.Fatalf("stmt = %s\nwant = %s", stmt, want)
	}
	if len(args) != 5 {
		t.Fatalf("args = %v, want 5 entries", args)
	}
	if args[0] != "approved" || args[1] != "Restart the cache" {
		t.Fatalf("value args = %v", args[:2])
	}
	if _, ok := args[2].(time.Time); !ok {
		t.Fatalf("args[2] = %T, want time.Time", args[2])
	}
	if args[3] != "r-1" || args[4] != "t-1" {
		t.Fatalf("key args = %v, want [r-1 t-1]", args[3:])
	}
}

func TestBuild_KeepsDeterministicOrderRegardlessOfInsertion(t *testing.T) {
	allowed := []string{"title", "description", "status"}
	one, _, err := Build("change_rfcs", map[string]any{"title": "a", "description": "b", "status": "c"}, allowed, "i", "t")
	if err != nil {
		t.Fatal(err)
	}
	two, _, err := Build("change_rfcs", map[string]any{"status": "c", "description": "b", "title": "a"}, allowed, "i", "t")
	if err != nil {
		t.Fatal(err)
	}
	if one != two {
		t.Fatalf("same keys rendered differently:\n%s\n%s", one, two)
	}
}

func TestBuild_IgnoresKeysOutsideTheWhitelist(t *testing.T) {
	// rfc_number is a real column of change_rfcs but not one UpdateRFC may
	// write; it must be dropped from the SET clause, not interpolated.
	stmt, args, err := Build("change_rfcs", map[string]any{
		"title":      "T",
		"rfc_number": "RFC-9",
		"created_by": "attacker",
	}, []string{"title", "description", "status"}, "r-1", "t-1")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(stmt, "rfc_number") || strings.Contains(stmt, "created_by") {
		t.Fatalf("non-whitelisted column leaked into SQL: %s", stmt)
	}
	if !strings.Contains(stmt, "title = $1") {
		t.Fatalf("whitelisted column dropped: %s", stmt)
	}
	if len(args) != 4 {
		t.Fatalf("args = %v, want 4", args)
	}
	if args[2] != "r-1" || args[3] != "t-1" {
		t.Fatalf("key args = %v, want [r-1 t-1]", args[2:])
	}
}

func TestBuild_RejectsInjectionInTableName(t *testing.T) {
	for _, bad := range []string{"change_rfcs; DROP TABLE users", "a b", "\tt", "x' OR 1=1", ""} {
		if _, _, err := Build(bad, map[string]any{"title": "T"}, []string{"title"}, "i", "t"); !errors.Is(err, ErrUnsafeTable) {
			t.Fatalf("table %q: err = %v, want ErrUnsafeTable", bad, err)
		}
	}
}

func TestBuild_EmptyUpdates(t *testing.T) {
	if _, _, err := Build("change_rfcs", nil, []string{"title"}, "i", "t"); !errors.Is(err, ErrEmpty) {
		t.Fatalf("err = %v, want ErrEmpty", err)
	}
}

func TestBuild_NothingWhitelistedIsErrEmpty(t *testing.T) {
	if _, _, err := Build("change_rfcs", map[string]any{"rfc_number": "RFC-9"}, []string{"title"}, "i", "t"); !errors.Is(err, ErrEmpty) {
		t.Fatalf("err = %v, want ErrEmpty", err)
	}
}

// updated_at must be refreshed by Build and never taken from the caller: a map
// that only carries updated_at is an empty update, and a map that also carries
// a real column must not end up writing updated_at twice.
func TestBuild_CallersCannotSetUpdatedAt(t *testing.T) {
	if _, _, err := Build("change_rfcs", map[string]any{"updated_at": time.Now()}, []string{"title"}, "i", "t"); !errors.Is(err, ErrEmpty) {
		t.Fatalf("err = %v, want ErrEmpty", err)
	}
	stmt, args, err := Build("change_rfcs", map[string]any{"updated_at": time.Now(), "title": "T"}, []string{"title"}, "i", "t")
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.Count(stmt, "updated_at"); got != 1 {
		t.Fatalf("updated_at appears %d times: %s", got, stmt)
	}
	if len(args) != 4 {
		t.Fatalf("args = %v, want 4", args)
	}
}

func TestBuild_PlacesUpdatedAtBeforeTheKey(t *testing.T) {
	stmt, args, err := Build("worker_policies", map[string]any{"name": "n", "priority": 5},
		[]string{"name", "type", "config", "priority", "enabled"}, "p-1", "t-1")
	if err != nil {
		t.Fatal(err)
	}
	want := "UPDATE worker_policies SET name = $1, priority = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5"
	if stmt != want {
		t.Fatalf("stmt = %s\nwant = %s", stmt, want)
	}
	if args[0] != "n" || args[1] != 5 || args[2].(time.Time).IsZero() || args[3] != "p-1" || args[4] != "t-1" {
		t.Fatalf("args = %v", args)
	}
}
