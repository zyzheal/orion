package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

// ===========================================================================
// JSONB Value / Scan
// ===========================================================================

func TestJSONB_Value_Nil(t *testing.T) {
	var j JSONB
	v, err := j.Value()
	if err != nil {
		t.Fatalf("Value() = error: %v", err)
	}
	if v != nil {
		t.Fatalf("expected nil, got %v", v)
	}
}

func TestJSONB_Value_NonNil(t *testing.T) {
	j := JSONB{"key": "value", "num": 42}
	v, err := j.Value()
	if err != nil {
		t.Fatalf("Value() = error: %v", err)
	}
	var got map[string]interface{}
	if err := json.Unmarshal(v.([]byte), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["key"] != "value" {
		t.Fatalf("key = %v", got["key"])
	}
}

func TestJSONB_Scan_Nil(t *testing.T) {
	var j JSONB
	if err := j.Scan(nil); err != nil {
		t.Fatalf("Scan(nil) = %v", err)
	}
	if j != nil {
		t.Fatalf("expected nil JSONB, got %v", j)
	}
}

func TestJSONB_Scan_Bytes(t *testing.T) {
	var j JSONB
	src := []byte(`{"a":"b"}`)
	if err := j.Scan(src); err != nil {
		t.Fatalf("Scan(bytes) = %v", err)
	}
	if j["a"] != "b" {
		t.Fatalf("a = %v", j["a"])
	}
}

func TestJSONB_Scan_String(t *testing.T) {
	var j JSONB
	src := `{"x":10}`
	if err := j.Scan(src); err != nil {
		t.Fatalf("Scan(string) = %v", err)
	}
	if j["x"] != float64(10) {
		t.Fatalf("x = %v", j["x"])
	}
}

func TestJSONB_Scan_InvalidType(t *testing.T) {
	var j JSONB
	if err := j.Scan(int(1)); err == nil {
		t.Fatal("expected error scanning int into JSONB")
	}
}

func TestJSONB_DriverValueRoundTrip(t *testing.T) {
	j := JSONB{"foo": "bar"}
	v, err := j.Value()
	if err != nil {
		t.Fatalf("Value: %v", err)
	}
	if _, ok := v.(driver.Value); !ok {
		t.Fatalf("Value not a driver.Value")
	}

	var j2 JSONB
	if err := j2.Scan(v); err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if j2["foo"] != "bar" {
		t.Fatalf("round trip failed: %v", j2)
	}
}

// ===========================================================================
// PaginatedRequest Offset / Limit
// ===========================================================================

func TestPaginatedRequest_Offset_Default(t *testing.T) {
	p := PaginatedRequest{}
	offset := p.Offset()
	if offset != 0 {
		t.Fatalf("Offset = %d, want 0", offset)
	}
	// defaults should have been applied
	if p.Page != 1 {
		t.Fatalf("Page = %d, want 1", p.Page)
	}
	if p.PageSize != 20 {
		t.Fatalf("PageSize = %d, want 20", p.PageSize)
	}
}

func TestPaginatedRequest_Offset_Page1(t *testing.T) {
	p := PaginatedRequest{Page: 1, PageSize: 10}
	if p.Offset() != 0 {
		t.Fatalf("Offset = %d, want 0", p.Offset())
	}
}

func TestPaginatedRequest_Offset_Page2(t *testing.T) {
	p := PaginatedRequest{Page: 2, PageSize: 10}
	if p.Offset() != 10 {
		t.Fatalf("Offset = %d, want 10", p.Offset())
	}
}

func TestPaginatedRequest_Offset_InvalidPage(t *testing.T) {
	p := PaginatedRequest{Page: -1, PageSize: 20}
	offset := p.Offset()
	if offset != 0 {
		t.Fatalf("Offset = %d, want 0 (after clamp)", offset)
	}
	if p.Page != 1 {
		t.Fatalf("Page = %d, want 1 (after clamp)", p.Page)
	}
}

func TestPaginatedRequest_Offset_InvalidPageSize(t *testing.T) {
	p := PaginatedRequest{Page: 3, PageSize: 0}
	offset := p.Offset()
	if offset != 40 {
		t.Fatalf("Offset = %d, want 40 (page 3, size defaulted to 20)", offset)
	}
}

func TestPaginatedRequest_Limit_Default(t *testing.T) {
	p := PaginatedRequest{}
	limit := p.Limit()
	if limit != 20 {
		t.Fatalf("Limit = %d, want 20", limit)
	}
}

func TestPaginatedRequest_Limit_Capped(t *testing.T) {
	p := PaginatedRequest{PageSize: 500}
	limit := p.Limit()
	if limit != 100 {
		t.Fatalf("Limit = %d, want 100 (capped)", limit)
	}
}

func TestPaginatedRequest_Limit_Exact(t *testing.T) {
	p := PaginatedRequest{PageSize: 100}
	if p.Limit() != 100 {
		t.Fatalf("Limit = %d, want 100", p.Limit())
	}
}

// ===========================================================================
// Constant / map validation helpers
// ===========================================================================

func TestValidCategoriesContainsExpected(t *testing.T) {
	expected := []string{CategoryStartup, CategoryAPI, CategoryHandler, CategoryService, CategoryListener}
	for _, c := range expected {
		if !ValidCategories[c] {
			t.Errorf("ValidCategories missing %s", c)
		}
	}
}

func TestValidHandlerTypesContainsExpected(t *testing.T) {
	for _, ht := range []string{HandlerTypeBuiltin, HandlerTypePlugin} {
		if !ValidHandlerTypes[ht] {
			t.Errorf("ValidHandlerTypes missing %s", ht)
		}
	}
}

func TestValidExtensionStatusesContainsExpected(t *testing.T) {
	for _, s := range []string{StatusRegistered, StatusInitialized, StatusActive, StatusDisabled, StatusError} {
		if !ValidExtensionStatuses[s] {
			t.Errorf("ValidExtensionStatuses missing %s", s)
		}
	}
}

func TestValidTaskStatusesContainsExpected(t *testing.T) {
	for _, s := range []string{TaskStatusPending, TaskStatusRunning, TaskStatusCompleted, TaskStatusFailed} {
		if !ValidTaskStatuses[s] {
			t.Errorf("ValidTaskStatuses missing %s", s)
		}
	}
}

// ===========================================================================
// Struct serialization (JSON)
// ===========================================================================

func TestExtensionSummary_JSONRoundTrip(t *testing.T) {
	now := time.Now().UTC()
	initAt := now.Add(-time.Hour)
	s := ExtensionSummary{
		Name:          "ep",
		Category:      CategoryStartup,
		Description:   "test",
		Status:        StatusActive,
		Enabled:       true,
		Priority:      1,
		HandlerType:   HandlerTypeBuiltin,
		Config:        map[string]string{"k": "v"},
		InitializedAt: &initAt,
		CreatedAt:     now,
	}
	b, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	var got ExtensionSummary
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if got.Name != s.Name || got.Status != s.Status {
		t.Fatalf("round trip mismatch: %+v", got)
	}
}

func TestExtensionEvent_JSONRoundTrip(t *testing.T) {
	now := time.Now().UTC()
	e := ExtensionEvent{
		Type:          EventTypeRegister,
		ExtensionName: "ep",
		Status:        StatusRegistered,
		Timestamp:     now,
	}
	b, err := json.Marshal(e)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	var got ExtensionEvent
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if got.Type != e.Type {
		t.Fatalf("type = %s", got.Type)
	}
}

func TestCreateStartupRequest_JSONWithEmptyNames(t *testing.T) {
	req := CreateStartupRequest{ExtensionNames: []string{}}
	b, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	var got CreateStartupRequest
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if got.ExtensionNames == nil {
		t.Fatal("expected empty slice, got nil")
	}
}

// ===========================================================================
// ExtensionPoint struct field defaults
// ===========================================================================

func TestExtensionPoint_DefaultFields(t *testing.T) {
	ep := ExtensionPoint{}
	if ep.Enabled {
		t.Fatal("Enabled should default to false (zero value)")
	}
	if ep.Priority != 0 {
		t.Fatalf("Priority = %d", ep.Priority)
	}
	if ep.Config != nil {
		t.Fatal("Config should be nil by default")
	}
}

// ===========================================================================
// Helper: format time for display (sanity)
// ===========================================================================

func TestEventTypeConstantsAreUnique(t *testing.T) {
	types := []string{EventTypeRegister, EventTypeInitialize, EventTypeShutdown, EventTypeError}
	seen := map[string]bool{}
	for _, v := range types {
		if seen[v] {
			t.Fatalf("duplicate event type: %s", v)
		}
		seen[v] = true
	}
	if len(seen) != len(types) {
		t.Fatalf("event types not unique: %d seen, %d total", len(seen), len(types))
	}
}

func TestStatusConstantsAreUnique(t *testing.T) {
	statuses := []string{StatusRegistered, StatusInitialized, StatusActive, StatusDisabled, StatusError}
	seen := map[string]bool{}
	for _, v := range statuses {
		if seen[v] {
			t.Fatalf("duplicate status: %s", v)
		}
		seen[v] = true
	}
}

func TestJSONB_Scan_InvalidJSON(t *testing.T) {
	var j JSONB
	err := j.Scan([]byte(`{not json}`))
	if err == nil {
		t.Fatal("expected error scanning invalid JSON")
	}
	// Should still contain the partial error message via json package
	_ = fmt.Sprintf("%v", err) // ensure no panic
}
