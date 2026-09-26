package handler

import (
	"net/http"
	"testing"
)

// TestListJobs_PaginationReachesTheService pins the offset and limit the handler
// derives from page and page_size. The service and repository both hand them to
// `OFFSET / LIMIT` untouched, so these assertions are the only guard on the
// path: before the clamp, `page=-1` reached Postgres as OFFSET -20, which is an
// error instead of data and turned a GET into a 500.
func TestListJobs_PaginationReachesTheService(t *testing.T) {
	cases := []struct {
		name       string
		query      string
		wantStatus string
		wantOff    int
		wantLimit  int
	}{
		{"negativePageIsClamped", "?page=-40&page_size=20", "", 0, 20},
		{"zeroPageIsClamped", "?page=0&page_size=25", "", 0, 25},
		{"negativePageSizeIsClamped", "?page=2&page_size=-5", "", 20, 20},
		{"zeroPageSizeFallsBack", "?page=2&page_size=0", "", 20, 20},
		{"unparsableUsesDefaults", "?page=abc&page_size=", "", 0, 20},
		{"absentUsesDefaults", "", "", 0, 20},
		{"validPageReachesTheService", "?page=3&page_size=25", "", 50, 25},
		{"pageOneIsOffsetZero", "?page=1&page_size=100", "", 0, 100},
		{"overTheCapIsCappedBeforeDerivation", "?page=2&page_size=1000", "", 100, 100},
		{"exactlyTheCapPassesThrough", "?page=2&page_size=100", "", 100, 100},
		{"overTheCapOnPageOne", "?page=1&page_size=500", "", 0, 100},
		{"statusIsForwarded", "?page=2&page_size=10&status=running", "running", 10, 10},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := &fakeImportService{}
			h := NewHandler(svc)
			c, w := makeCtx(http.MethodGet, "/jobs"+tc.query, "")
			h.ListJobs(c)
			if w.Code != http.StatusOK {
				t.Fatalf("got %d, want 200 (body: %s)", w.Code, w.Body.String())
			}
			if svc.lastTenant != "tenant-1" {
				t.Fatalf("tenant not forwarded, got %q", svc.lastTenant)
			}
			if svc.lastStatus != tc.wantStatus {
				t.Fatalf("status = %q, want %q", svc.lastStatus, tc.wantStatus)
			}
			if svc.lastOffset != tc.wantOff || svc.lastLimit != tc.wantLimit {
				t.Fatalf("query %q: got offset=%d limit=%d, want offset=%d limit=%d",
					tc.query, svc.lastOffset, svc.lastLimit, tc.wantOff, tc.wantLimit)
			}
		})
	}
}

// TestListJobs_EnvelopeReportsTheDerivedValues pins the response envelope
// against the same integers the handler sent to the service. Deriving the
// offset from the requested page size and capping the limit afterwards made the
// second case report offset 1000 / limit 100 for rows the client could not have
// asked for by page number, so the envelope and the query disagreed.
func TestListJobs_EnvelopeReportsTheDerivedValues(t *testing.T) {
	cases := []struct {
		name      string
		query     string
		wantOff   int
		wantLimit int
	}{
		{"validPage", "?page=3&page_size=25", 50, 25},
		{"capAppliedBeforeDerivation", "?page=2&page_size=1000", 100, 100},
		{"absentParams", "", 0, 20},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := &fakeImportService{}
			h := NewHandler(svc)
			c, w := makeCtx(http.MethodGet, "/jobs"+tc.query, "")
			h.ListJobs(c)
			body := decodeBody(t, w)
			inner, ok := body["data"].(map[string]interface{})
			if !ok {
				t.Fatalf("missing data envelope: %v", body)
			}
			if got, _ := inner["offset"].(float64); got != float64(tc.wantOff) {
				t.Fatalf("offset = %v, want %d", inner["offset"], tc.wantOff)
			}
			if got, _ := inner["limit"].(float64); got != float64(tc.wantLimit) {
				t.Fatalf("limit = %v, want %d", inner["limit"], tc.wantLimit)
			}
			if got := inner["total"]; got != float64(0) {
				t.Fatalf("total = %v, want 0 (the fake returns no rows)", inner["total"])
			}
		})
	}
}
