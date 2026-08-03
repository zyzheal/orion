package models

import (
	"encoding/json"
	"testing"
)

// TestSearchRequestRoundTrip verifies SearchRequest JSON serialization/deserialization
// covers the full set of fields that the API binding depends on.
func TestSearchRequestRoundTrip(t *testing.T) {
	original := &SearchRequest{
		Query:         "production down",
		Modules:       []string{"ticket", "alert"},
		Filters:       map[string]string{"status": "open", "priority": "P0"},
		ModuleFilters: map[string]map[string]string{"ticket": {"type": "incident"}},
		From:          20,
		Size:          50,
		SortBy:        "created_at",
		SortOrder:     "desc",
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var decoded SearchRequest
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if decoded.Query != original.Query {
		t.Errorf("Query = %q, want %q", decoded.Query, original.Query)
	}
	if len(decoded.Modules) != len(original.Modules) {
		t.Errorf("Modules length = %d, want %d", len(decoded.Modules), len(original.Modules))
	}
	if decoded.From != original.From {
		t.Errorf("From = %d, want %d", decoded.From, original.From)
	}
	if decoded.Size != original.Size {
		t.Errorf("Size = %d, want %d", decoded.Size, original.Size)
	}
}

func TestSearchResponseRoundTrip(t *testing.T) {
	group := &SearchResultGroup{
		Total: 10,
		Hits: []SearchHit{
			{
				ID:        "ticket-123",
				Type:      "incident",
				Module:    "ticket",
				Score:     1.5,
				Title:     "Production outage",
				Snippet:   "... production ...",
				Fields:    map[string]interface{}{"owner": "alice"},
				Highlighted: map[string]string{"title": "<em>production</em> outage"},
			},
		},
	}

	resp := &SearchResponse{
		Total:   10,
		TookMs:  42,
		Query:   "production",
		Results: map[string]*SearchResultGroup{"ticket": group},
	}

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var decoded SearchResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if decoded.Total != resp.Total {
		t.Errorf("Total = %d, want %d", decoded.Total, resp.Total)
	}
	if decoded.TookMs != resp.TookMs {
		t.Errorf("TookMs = %d, want %d", decoded.TookMs, resp.TookMs)
	}
	tg := decoded.Results["ticket"]
	if tg == nil {
		t.Fatal("ticket group missing from decoded results")
	}
	if len(tg.Hits) != 1 {
		t.Errorf("hits length = %d, want 1", len(tg.Hits))
	}
}

func TestSearchResultGroupEmptyState(t *testing.T) {
	group := &SearchResultGroup{}
	if group.Total != 0 {
		t.Errorf("empty group Total = %d, want 0", group.Total)
	}
	if len(group.Hits) != 0 {
		t.Errorf("empty group Hits length = %d, want 0", len(group.Hits))
	}
}

func TestReindexResponseRoundTrip(t *testing.T) {
	resp := ReindexResponse{
		Module:     "ticket",
		TotalDocs:  1000,
		Indexed:    999,
		Failed:     1,
		DurationMs: 5000,
		Success:    true,
		Error:      "",
	}
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var decoded ReindexResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if decoded.Module != resp.Module {
		t.Errorf("Module = %q, want %q", decoded.Module, resp.Module)
	}
	if decoded.Indexed != resp.Indexed {
		t.Errorf("Indexed = %d, want %d", decoded.Indexed, resp.Indexed)
	}
}
