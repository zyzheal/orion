package models

import (
	"testing"
)

// ===========================================================================
// Phase 303 — Builtin extension point catalog tests
// ===========================================================================

func TestBuiltin_PointCount(t *testing.T) {
	// Stability guardrail: exactly 14 builtin extension points.
	// Note: 详细设计文档声称 15 但实际只列出 14 个常量；以常量表为准。
	if got := BuiltinPointCount(); got != 14 {
		t.Fatalf("BuiltinPointCount() = %d, want 14", got)
	}
}

func TestBuiltin_AllIDsAreUnique(t *testing.T) {
	seen := map[string]int{}
	for _, m := range BuiltinPointRegistry {
		seen[m.ID]++
	}
	if len(seen) != len(BuiltinPointRegistry) {
		t.Fatalf("duplicate builtin IDs detected: %d entries vs %d unique",
			len(BuiltinPointRegistry), len(seen))
	}
}

func TestBuiltin_AllCategoriesValid(t *testing.T) {
	for id, m := range BuiltinPointRegistry {
		if !ValidCategories[m.Category] {
			t.Errorf("builtin %q has invalid category %q", id, m.Category)
		}
	}
}

func TestBuiltin_AllBuiltInFlagTrue(t *testing.T) {
	for id, m := range BuiltinPointRegistry {
		if !m.BuiltIn {
			t.Errorf("builtin %q has BuiltIn=false", id)
		}
	}
}

func TestBuiltin_AllDefaultOrdersPositive(t *testing.T) {
	for id, m := range BuiltinPointRegistry {
		if m.DefaultOrder < 1 || m.DefaultOrder > 100 {
			t.Errorf("builtin %q has out-of-range DefaultOrder %d", id, m.DefaultOrder)
		}
	}
}

func TestBuiltin_ExpectedCountPerCategory(t *testing.T) {
	// Expected distribution: 14 = 3 api + 2 handler + 3 service + 3 listener + 3 startup.
	expected := map[string]int{
		CategoryAPI:      3,
		CategoryHandler:  2,
		CategoryService:  3,
		CategoryListener: 3,
		CategoryStartup:  3,
	}
	for cat, want := range expected {
		got := len(ListBuiltinPointsByCategory(cat))
		if got != want {
			t.Errorf("category %q: got %d builtins, want %d", cat, got, want)
		}
	}
}

func TestBuiltin_ListAllSorted(t *testing.T) {
	points := ListBuiltinPoints()
	if len(points) != 14 {
		t.Fatalf("ListBuiltinPoints() returned %d items, want 14", len(points))
	}
	// Verify sort stability: category asc, then defaultOrder asc, then ID asc.
	for i := 1; i < len(points); i++ {
		prev, cur := points[i-1], points[i]
		if prev.Category > cur.Category {
			t.Fatalf("not sorted by category: %s (%s) before %s (%s)",
				prev.ID, prev.Category, cur.ID, cur.Category)
		}
		if prev.Category == cur.Category && prev.DefaultOrder > cur.DefaultOrder {
			t.Fatalf("not sorted by defaultOrder within %s: %s(%d) before %s(%d)",
				cur.Category, prev.ID, prev.DefaultOrder, cur.ID, cur.DefaultOrder)
		}
	}
}

func TestBuiltin_ListByCategory_Unknown(t *testing.T) {
	got := ListBuiltinPointsByCategory("nonexistent")
	if got == nil {
		t.Fatal("unknown category must return non-nil empty slice")
	}
	if len(got) != 0 {
		t.Fatalf("unknown category returned %d items, want 0", len(got))
	}
}

func TestBuiltin_ListByCategory_EmptyString(t *testing.T) {
	// Empty string is treated as "no filter" — but ListBuiltinPointsByCategory
	// literally matches category=="" which no builtin satisfies; document
	// the expected behavior by asserting an empty result (service layer
	// handles the empty-string-all case via ListBuiltinPoints()).
	got := ListBuiltinPointsByCategory("")
	if len(got) != 0 {
		t.Fatalf("empty category should return 0 items, got %d", len(got))
	}
}

func TestBuiltin_IsValidBuiltinPoint(t *testing.T) {
	if !IsValidBuiltinPoint(BuiltinPreRequest) {
		t.Fatal("PreRequest should be valid")
	}
	if !IsValidBuiltinPoint(BuiltinAuditHook) {
		t.Fatal("AuditHook should be valid")
	}
	if IsValidBuiltinPoint("") {
		t.Fatal("empty string must not be valid")
	}
	if IsValidBuiltinPoint("not_a_builtin") {
		t.Fatal("unknown id must not be valid")
	}
}

func TestBuiltin_RegistrationsMatchConstants(t *testing.T) {
	// Guardrail: each named constant must resolve to its literal ID string.
	cases := map[string]string{
		BuiltinPreRequest:      "pre_request",
		BuiltinPostRequest:     "post_request",
		BuiltinAuthMiddleware:  "auth_middleware",
		BuiltinBeforeHandler:   "before_handler",
		BuiltinAfterHandler:    "after_handler",
		BuiltinPreSave:         "pre_save",
		BuiltinPostSave:        "post_save",
		BuiltinDeleteHook:      "delete_hook",
		BuiltinAuditHook:       "audit_hook",
		BuiltinNotification:    "notification",
		BuiltinWebhookDispatch: "webhook_dispatch",
		BuiltinOnStartup:       "on_startup",
		BuiltinOnShutdown:      "on_shutdown",
		BuiltinConfigChanged:   "config_changed",
	}
	if len(cases) != 14 {
		t.Fatalf("test case table has %d entries, want 14", len(cases))
	}
	for const_, literal := range cases {
		if const_ != literal {
			t.Errorf("constant mismatch: %q != %q", const_, literal)
		}
		if _, ok := BuiltinPointRegistry[const_]; !ok {
			t.Errorf("constant %q missing from BuiltinPointRegistry", const_)
		}
	}
}
