package util

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestDefaultPaginationConfig(t *testing.T) {
	cfg := DefaultPaginationConfig()
	if cfg.MaxLimit != 100 {
		t.Errorf("expected MaxLimit 100, got %d", cfg.MaxLimit)
	}
	if cfg.DefaultLimit != 20 {
		t.Errorf("expected DefaultLimit 20, got %d", cfg.DefaultLimit)
	}
	if cfg.MinLimit != 1 {
		t.Errorf("expected MinLimit 1, got %d", cfg.MinLimit)
	}
}

func TestOffsetPaginator_ParseParams(t *testing.T) {
	p := NewOffsetPaginator(DefaultPaginationConfig())

	params := p.ParseParams(0, 0, "", "")
	if params.Limit != 20 {
		t.Errorf("expected default limit 20, got %d", params.Limit)
	}
	if params.Offset != 0 {
		t.Errorf("expected offset 0, got %d", params.Offset)
	}
	if params.Order != "desc" {
		t.Errorf("expected default order desc, got %s", params.Order)
	}

	params = p.ParseParams(50, 100, "name", "asc")
	if params.Limit != 50 {
		t.Errorf("expected limit 50, got %d", params.Limit)
	}
	if params.Offset != 100 {
		t.Errorf("expected offset 100, got %d", params.Offset)
	}
	if params.Sort != "name" {
		t.Errorf("expected sort name, got %s", params.Sort)
	}
	if params.Order != "asc" {
		t.Errorf("expected order asc, got %s", params.Order)
	}

	// Max limit clamp
	params = p.ParseParams(200, 0, "", "")
	if params.Limit != 100 {
		t.Errorf("expected max limit 100, got %d", params.Limit)
	}

	// Zero limit becomes default
	params = p.ParseParams(0, 0, "", "")
	if params.Limit != 20 {
		t.Errorf("expected default limit 20 for 0, got %d", params.Limit)
	}
}

func TestOffsetPaginator_CreateResponse(t *testing.T) {
	p := NewOffsetPaginator(DefaultPaginationConfig())
	data := []map[string]interface{}{{"name": "test"}}
	params := p.ParseParams(10, 0, "", "")

	resp := p.CreateResponse(data, 25, params, "req-123")
	meta, ok := resp.Pagination.(OffsetMeta)
	if !ok {
		t.Fatal("expected OffsetMeta")
	}
	if meta.Total != 25 {
		t.Errorf("expected total 25, got %d", meta.Total)
	}
	if meta.Limit != 10 {
		t.Errorf("expected limit 10, got %d", meta.Limit)
	}
	if !meta.HasMore {
		t.Error("expected HasMore true (1 item in 10-limit page of 25 total)")
	}
	if meta.Offset != 0 {
		t.Errorf("expected offset 0, got %d", meta.Offset)
	}
	if meta.Type != "offset" {
		t.Errorf("expected type offset, got %s", meta.Type)
	}
	if resp.Meta.RequestID != "req-123" {
		t.Errorf("expected request_id req-123, got %s", resp.Meta.RequestID)
	}
}

func TestOffsetPaginator_HasMoreFalse(t *testing.T) {
	p := NewOffsetPaginator(DefaultPaginationConfig())
	data := make([]interface{}, 10)
	params := p.ParseParams(10, 0, "", "")

	resp := p.CreateResponse(data, 10, params, "req-1")
	meta := resp.Pagination.(OffsetMeta)
	if meta.HasMore {
		t.Error("expected HasMore false (all items fit in one page)")
	}
}

func TestOffsetPaginator_GetTotalPages(t *testing.T) {
	p := NewOffsetPaginator(DefaultPaginationConfig())
	if p.GetTotalPages(25, 10) != 3 {
		t.Error("expected 3 pages for 25 items, limit 10")
	}
	if p.GetTotalPages(20, 10) != 2 {
		t.Error("expected 2 pages for 20 items, limit 10")
	}
	if p.GetTotalPages(0, 10) != 0 {
		t.Error("expected 0 pages for 0 items")
	}
	if p.GetTotalPages(1, 10) != 1 {
		t.Error("expected 1 page for 1 item")
	}
	if p.GetTotalPages(100, 100) != 1 {
		t.Error("expected 1 page for 100 items, limit 100")
	}
	if p.GetTotalPages(10, 0) != 0 {
		t.Error("expected 0 pages for limit 0")
	}
}

func TestOffsetPaginator_HasNextPage(t *testing.T) {
	p := NewOffsetPaginator(DefaultPaginationConfig())
	if !p.HasNextPage(0, 10, 25) {
		t.Error("expected has_next at offset 0 with 25 items")
	}
	if !p.HasNextPage(10, 10, 25) {
		t.Error("expected has_next at offset 10 with 25 items")
	}
	if p.HasNextPage(20, 10, 25) {
		t.Error("expected no next at offset 20 with 25 items")
	}
	if p.HasNextPage(20, 10, 20) {
		t.Error("expected no next when offset+limit == total")
	}
}

func TestOffsetPaginator_HasPreviousPage(t *testing.T) {
	p := NewOffsetPaginator(DefaultPaginationConfig())
	if p.HasPreviousPage(0) {
		t.Error("expected no previous at offset 0")
	}
	if !p.HasPreviousPage(10) {
		t.Error("expected has_previous at offset 10")
	}
	if !p.HasPreviousPage(1) {
		t.Error("expected has_previous at offset 1")
	}
}

func TestCursorPaginator_ParseParams(t *testing.T) {
	p := NewCursorPaginator(DefaultPaginationConfig())

	params := p.ParseParams(0, "", "")
	if params.Limit != 20 {
		t.Errorf("expected default limit 20, got %d", params.Limit)
	}
	if params.Direction != "next" {
		t.Errorf("expected default direction next, got %s", params.Direction)
	}

	params = p.ParseParams(50, "some_cursor", "prev")
	if params.Limit != 50 {
		t.Errorf("expected limit 50, got %d", params.Limit)
	}
	if params.Cursor != "some_cursor" {
		t.Errorf("expected cursor some_cursor, got %s", params.Cursor)
	}
	if params.Direction != "prev" {
		t.Errorf("expected direction prev, got %s", params.Direction)
	}
}

func TestCursorPaginator_EncodeDecodeCursor(t *testing.T) {
	p := NewCursorPaginator(DefaultPaginationConfig())

	original := "user-123"
	encoded := p.EncodeCursor(original)
	if encoded == original {
		t.Error("encoded cursor should differ from original")
	}

	decoded, err := p.DecodeCursor(encoded)
	if err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if decoded != original {
		t.Errorf("expected %q, got %q", original, decoded)
	}
}

func TestCursorPaginator_DecodeCursorInvalid(t *testing.T) {
	p := NewCursorPaginator(DefaultPaginationConfig())
	_, err := p.DecodeCursor("invalid-base64-!!!")
	if err == nil {
		t.Error("expected error for invalid cursor")
	}
}

func TestCursorPaginator_DecodeCursorRoundTrip(t *testing.T) {
	p := NewCursorPaginator(DefaultPaginationConfig())
	for _, val := range []string{"abc", "12345", "unicode-你好"} {
		encoded := p.EncodeCursor(val)
		decoded, err := p.DecodeCursor(encoded)
		if err != nil {
			t.Errorf("decode failed for %q: %v", val, err)
			continue
		}
		if decoded != val {
			t.Errorf("round trip failed: expected %q, got %q", val, decoded)
		}
	}
}

func TestCursorPaginator_DecodeCursorEmpty(t *testing.T) {
	p := NewCursorPaginator(DefaultPaginationConfig())
	_, err := p.DecodeCursor("")
	if err == nil {
		t.Error("expected error for empty cursor")
	}
}

func TestCursorPaginator_CreateResponse(t *testing.T) {
	p := NewCursorPaginator(DefaultPaginationConfig())
	data := []map[string]interface{}{
		{"id": "item-1", "name": "first"},
		{"id": "item-2", "name": "second"},
		{"id": "item-3", "name": "third"},
	}
	params := p.ParseParams(3, "", "after")

	resp := p.CreateResponse(data, params, "id", "req-abc")
	meta, ok := resp.Pagination.(CursorMeta)
	if !ok {
		t.Fatal("expected CursorMeta")
	}
	if meta.Type != "cursor" {
		t.Errorf("expected type cursor, got %s", meta.Type)
	}
	if !meta.HasMore {
		t.Error("expected HasMore true when len(data) == limit")
	}
	if meta.Cursor.Next == "" {
		t.Error("expected non-empty next cursor")
	}
	if meta.Cursor.Previous == "" {
		t.Error("expected non-empty previous cursor")
	}
	if resp.Meta.RequestID != "req-abc" {
		t.Errorf("expected request_id req-abc, got %s", resp.Meta.RequestID)
	}
}

func TestCursorPaginator_CreateResponseNoCursor(t *testing.T) {
	p := NewCursorPaginator(DefaultPaginationConfig())
	data := []map[string]interface{}{
		{"id": "item-1", "name": "first"},
	}
	params := p.ParseParams(10, "", "after")

	resp := p.CreateResponse(data, params, "id", "req-1")
	meta := resp.Pagination.(CursorMeta)
	if meta.HasMore {
		t.Error("expected HasMore false when len(data) < limit")
	}
}

func TestApplyOffsetPagination(t *testing.T) {
	items := make([]interface{}, 20)
	for i := 0; i < 20; i++ {
		items[i] = fmt.Sprintf("item-%d", i)
	}

	result := ApplyOffsetPagination(items, 0, 10)
	if len(result) != 10 {
		t.Errorf("expected 10 items, got %d", len(result))
	}

	result = ApplyOffsetPagination(items, 10, 10)
	if len(result) != 10 {
		t.Errorf("expected 10 items, got %d", len(result))
	}

	result = ApplyOffsetPagination(items, 15, 10)
	if len(result) != 5 {
		t.Errorf("expected 5 items, got %d", len(result))
	}

	result = ApplyOffsetPagination(items, 20, 10)
	if len(result) != 0 {
		t.Errorf("expected 0 items, got %d", len(result))
	}

	result = ApplyOffsetPagination(items, 0, 50)
	if len(result) != 20 {
		t.Errorf("expected 20 items when limit > total, got %d", len(result))
	}

	result = ApplyOffsetPagination(nil, 0, 10)
	if len(result) != 0 {
		t.Errorf("expected empty slice for nil items, got %v", result)
	}

	result = ApplyOffsetPagination(items, 0, 1)
	if len(result) != 1 {
		t.Errorf("expected 1 item with limit 1, got %d", len(result))
	}
}

func TestPaginationResponse_JSONMarshaling(t *testing.T) {
	p := NewOffsetPaginator(DefaultPaginationConfig())
	params := p.ParseParams(10, 0, "", "")
	resp := p.CreateResponse([]map[string]interface{}{{"id": "1"}}, 10, params, "req-1")

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("JSON marshal failed: %v", err)
	}
	if len(data) == 0 {
		t.Error("expected non-empty JSON")
	}

	var unmarshaled map[string]interface{}
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("JSON unmarshal failed: %v", err)
	}
	if _, ok := unmarshaled["data"]; !ok {
		t.Error("expected data key in JSON")
	}
	if _, ok := unmarshaled["pagination"]; !ok {
		t.Error("expected pagination key in JSON")
	}
}
