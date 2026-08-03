package elasticsearch

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/global-search/models"
)

// newMockESServer returns a test server that answers ES-style JSON responses.
func newMockESServer(handler func(method, path string) (int, string)) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		status, body := handler(r.Method, strings.TrimRight(r.URL.Path, "/"))
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
}

func TestSearchService_Search_EmptyModules(t *testing.T) {
	svc := NewSearchService(New(nil))
	resp, err := svc.Search(context.Background(), &models.SearchRequest{Query: "test", Modules: nil})
	if err != nil {
		t.Fatalf("Search with empty modules returned error: %v", err)
	}
	if resp.Total != 0 {
		t.Errorf("Total = %d, want 0", resp.Total)
	}
}

func TestSearchService_Search_SingleModule(t *testing.T) {
	esJSON := `{
		"took": 5,
		"hits": {
			"total": {"value": 2},
			"hits": [
				{"_id": "t1", "_score": 1.5, "_source": {"title": "Outage", "type": "incident"}}
			]
		}
	}`

	ts := newMockESServer(func(method, path string) (int, string) {
		return 200, esJSON
	})
	defer ts.Close()

	client := New(&Config{URL: ts.URL, Timeout: 2 * time.Second})
	svc := NewSearchService(client)

	resp, err := svc.Search(context.Background(), &models.SearchRequest{Query: "outage", Modules: []string{"ticket"}})
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}

	if resp.Total != 2 {
		t.Errorf("Total = %d, want 2", resp.Total)
	}
	if len(resp.Results) != 1 {
		t.Fatalf("Results has %d groups, want 1", len(resp.Results))
	}
	group := resp.Results["ticket"]
	if group == nil {
		t.Fatal("ticket group missing")
	}
	if len(group.Hits) != 1 {
		t.Fatalf("ticket hits length = %d, want 1", len(group.Hits))
	}
	hit := group.Hits[0]
	if hit.Title != "Outage" {
		t.Errorf("hit Title = %q, want %q", hit.Title, "Outage")
	}
	if hit.Type != "incident" {
		t.Errorf("hit Type = %q, want %q", hit.Type, "incident")
	}
	if hit.Module != "ticket" {
		t.Errorf("hit Module = %q, want %q", hit.Module, "ticket")
	}
}

func TestSearchService_Search_DefaultSize(t *testing.T) {
	req := &models.SearchRequest{Query: "x", Size: 0}
	svc := NewSearchService(New(nil))
	_, _ = svc.Search(context.Background(), req)
	if req.Size != 20 {
		t.Errorf("Size = %d, want 20 (default)", req.Size)
	}
}

func TestSearchService_Search_MaxSize(t *testing.T) {
	req := &models.SearchRequest{Query: "x", Size: 500}
	svc := NewSearchService(New(nil))
	_, _ = svc.Search(context.Background(), req)
	if req.Size != 100 {
		t.Errorf("Size = %d, want 100 (max)", req.Size)
	}
}

func TestSearchService_Search_SortOrderDefault(t *testing.T) {
	req := &models.SearchRequest{Query: "x"}
	svc := NewSearchService(New(nil))
	_, _ = svc.Search(context.Background(), req)
	if req.SortOrder != "desc" {
		t.Errorf("SortOrder = %q, want %q (default)", req.SortOrder, "desc")
	}
}

func TestSearchService_Search_ClientUnavailable(t *testing.T) {
	// Client with empty URL should error on any request
	client := New(&Config{URL: "http://127.0.0.1:1", Timeout: time.Second})
	svc := NewSearchService(client)

	_, err := svc.Search(context.Background(), &models.SearchRequest{Query: "x", Modules: []string{"ticket"}})
	// When ES is unavailable, the client returns an error (not ErrESUnavailable),
	// so SearchService should propagate it.
	if err == nil {
		t.Error("expected error when ES is unreachable")
	}
}

func TestSearchService_BuildQueryBody(t *testing.T) {
	svc := NewSearchService(New(nil))

	body := svc.buildQueryBody(&models.SearchRequest{
		Query:     "test",
		From:      10,
		Size:      5,
		SortBy:    "score",
		SortOrder: "asc",
		Filters:   map[string]string{"status": "open"},
	})

	// from/size map to int -> interface{} which Go preserves as int.
	if from := body["from"]; from != 10 {
		t.Errorf("from = %v (%T), want 10", from, from)
	}
	if size := body["size"]; size != 5 {
		t.Errorf("size = %v (%T), want 5", size, size)
	}


	if _, ok := body["sort"]; !ok {
		t.Error("body should contain sort when SortBy is set")
	}

	boolQuery, ok := body["query"].(map[string]interface{})["bool"].(map[string]interface{})
	if !ok {
		t.Fatal("query should contain a bool filter")
	}
	if _, ok := boolQuery["filter"]; !ok {
		t.Error("bool query should contain filter when Filters are set")
	}
}

func TestSearchService_BuildQueryWithNoFilters(t *testing.T) {
	svc := NewSearchService(New(nil))
	body := svc.buildQueryBody(&models.SearchRequest{Query: "test"})

	boolQuery := body["query"].(map[string]interface{})["bool"].(map[string]interface{})
	if _, hasFilter := boolQuery["filter"]; hasFilter {
		t.Error("bool query should NOT contain filter when Filters is empty")
	}
}

func TestSearchService_BuildQueryBody_SortFieldSet(t *testing.T) {
	svc := NewSearchService(New(nil))

	// Without SortBy: sort key should NOT be present.
	bodyNoSort := svc.buildQueryBody(&models.SearchRequest{Query: "test"})
	if _, ok := bodyNoSort["sort"]; ok {
		t.Error("body should NOT contain sort when SortBy is empty")
	}

	// With SortBy: sort key should be present.
	bodyWithSort := svc.buildQueryBody(&models.SearchRequest{Query: "test", SortBy: "created_at"})
	if _, ok := bodyWithSort["sort"]; !ok {
		t.Error("body should contain sort when SortBy is set")
	}
}

func TestSearchService_ExtractTotal(t *testing.T) {
	svc := NewSearchService(New(nil))

	tests := []struct {
		name string
		raw *SearchResultRaw
		want int64
	}{
		{"nil result", nil, 0},
		{"nil total", &SearchResultRaw{Hits: HitsRaw{Total: nil}}, 0},
		{"int64 value", &SearchResultRaw{Hits: HitsRaw{Total: map[string]interface{}{"value": int64(42)}}}, 42},
		{"float64 value", &SearchResultRaw{Hits: HitsRaw{Total: map[string]interface{}{"value": float64(99)}}}, 99},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := svc.extractTotal(tc.raw)
			if got != tc.want {
				t.Errorf("extractTotal = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestSearchService_ParseHits(t *testing.T) {
	svc := NewSearchService(New(nil))

	raw := &SearchResultRaw{
		Took: 10,
		Hits: HitsRaw{
			Total: map[string]interface{}{"value": 1},
			Hits: []HitRaw{
				{
					ID:    "doc-1",
					Score: 2.0,
					Source: map[string]interface{}{
						"title": "Alert summary",
						"type":  "critical",
						"owner": "bob",
					},
					Highlight: map[string][]string{
						"title": {"<em>Alert</em> <em>summary</em>"},
					},
				},
			},
		},
	}

	hits := svc.parseHits(raw, "alert")
	if len(hits) != 1 {
		t.Fatalf("parseHits returned %d hits, want 1", len(hits))
	}

	hit := hits[0]
	if hit.ID != "doc-1" {
		t.Errorf("hit ID = %q, want %q", hit.ID, "doc-1")
	}
	if hit.Score != 2.0 {
		t.Errorf("hit Score = %f, want 2.0", hit.Score)
	}
	if hit.Module != "alert" {
		t.Errorf("hit Module = %q, want %q", hit.Module, "alert")
	}
	if hit.Title != "Alert summary" {
		t.Errorf("hit Title = %q, want %q", hit.Title, "Alert summary")
	}
	if hit.Type != "critical" {
		t.Errorf("hit Type = %q, want %q (from source)", hit.Type, "critical")
	}
	if hit.Highlighted["title"] != "<em>Alert</em> <em>summary</em>" {
		t.Errorf("highlight = %q", hit.Highlighted["title"])
	}
}

func TestSearchService_ParseHits_WithoutType(t *testing.T) {
	svc := NewSearchService(New(nil))

	raw := &SearchResultRaw{
		Hits: HitsRaw{
			Hits: []HitRaw{
				{
					ID:     "doc-1",
					Score:  1.0,
					Source: map[string]interface{}{"title": "Generic item"},
				},
			},
		},
	}

	hits := svc.parseHits(raw, "cmdb")
	if hits[0].Type != "cmdb" {
		t.Errorf("hit Type = %q, want %q (fallback to module)", hits[0].Type, "cmdb")
	}
}

func TestSearchService_ParseHits_NilResult(t *testing.T) {
	svc := NewSearchService(New(nil))
	if hits := svc.parseHits(nil, "ticket"); hits != nil {
		t.Errorf("parseHits(nil) = %v, want nil", hits)
	}
}

// --- Query body JSON serialization helpers ------------------------------------

func TestSearchService_BuildQueryBody_JSONRoundTrip(t *testing.T) {
	svc := NewSearchService(New(nil))
	body := svc.buildQueryBody(&models.SearchRequest{
		Query:   "test",
		From:    10,
		Size:    5,
		Filters: map[string]string{"status": "open"},
	})

	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if decoded["size"] != float64(5) {
		t.Errorf("json size = %v, want 5", decoded["size"])
	}
	if decoded["from"] != float64(10) {
		t.Errorf("json from = %v, want 10", decoded["from"])
	}

	if hl, ok := decoded["highlight"].(map[string]interface{}); !ok {
		t.Error("missing highlight in body")
	} else {
		if fields, ok := hl["fields"].(map[string]interface{}); !ok {
			t.Error("missing highlight.fields")
		} else {
			if _, ok := fields["title"]; !ok {
				t.Error("missing highlight.fields.title")
			}
		}
	}
}

// --- StripVersionSuffix, joinFrags, stringVal ---

func TestStripVersionSuffix(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"ticket_v1", "ticket"},
		{"ticket_v10", "ticket"},
		{"alert_v2", "alert"},
		{"cmdb_v99", "cmdb"},
		{"my_module_v1", "my_module"},
		{"ticket", "ticket"},       // no suffix
		{"ticket_v100", "ticket"},
		{"ticket_v", "ticket_v"},   // "v" alone is not valid (len(rest) > 1 guard)
		{"ticket_v0", "ticket"},
		{"_v1", ""},
		{"", ""},
	}

	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			got := stripVersionSuffix(tc.in)
			if got != tc.want {
				t.Errorf("stripVersionSuffix(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestJoinFrags(t *testing.T) {
	tests := []struct {
		in   []string
		want string
	}{
		{nil, ""},
		{[]string{}, ""},
		{[]string{"one"}, "one"},
		{[]string{"first", "last"}, "first ... last"},
		{[]string{"a", "b", "c", "d"}, "a ... d"},
	}

	for _, tc := range tests {
		t.Run("", func(t *testing.T) {
			got := joinFrags(tc.in)
			if got != tc.want {
				t.Errorf("joinFrags(%v) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestStringVal(t *testing.T) {
	tests := []struct {
		name string
		in   interface{}
		want string
	}{
		{"string", "hello", "hello"},
		{"nil", nil, ""},
		{"int", 42, ""},
		{"bool", true, ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := stringVal(tc.in)
			if got != tc.want {
				t.Errorf("stringVal(%v) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}
