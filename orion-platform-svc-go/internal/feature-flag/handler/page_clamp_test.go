package handler

import (
	"context"
	"net/http"
	"testing"

	"orion/platform-svc-go/internal/feature-flag/models"
)

// Search used to derive the offset as `(page-1)*pageSize` from two unchecked
// `strconv.Atoi` results: `?page=-40&page_size=20` bound OFFSET -800 and
// `?page=0` bound OFFSET -20, and Postgres rejects a negative OFFSET with an
// error instead of data, so a GET became a 500. `?page_size=-5` did the same
// through a negative LIMIT. searchFn pins the pair the service receives.
func assertSearchPagination(t *testing.T, query map[string]string, wantOffset, wantLimit int) {
	t.Helper()
	var gotOffset, gotLimit int
	svc := &mockSvc{
		searchFn: func(ctx context.Context, tenantID, q string, offset, limit int) ([]models.FeatureFlag, error) {
			if tenantID != "tenant-1" {
				t.Fatalf("tenantID = %q, want tenant-1", tenantID)
			}
			if q != "dark" {
				t.Fatalf("query = %q, want dark", q)
			}
			gotOffset, gotLimit = offset, limit
			return nil, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Search, "GET", nil, nil, query)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if gotOffset != wantOffset || gotLimit != wantLimit {
		t.Fatalf("offset=%d limit=%d, want offset=%d limit=%d", gotOffset, gotLimit, wantOffset, wantLimit)
	}
}

func TestSearch_NegativePageIsClamped(t *testing.T) {
	assertSearchPagination(t, map[string]string{"q": "dark", "page": "-40", "page_size": "20"}, 0, 20)
}

func TestSearch_ZeroPageIsClamped(t *testing.T) {
	assertSearchPagination(t, map[string]string{"q": "dark", "page": "0", "page_size": "25"}, 0, 25)
}

func TestSearch_NegativePageSizeIsClamped(t *testing.T) {
	assertSearchPagination(t, map[string]string{"q": "dark", "page": "2", "page_size": "-5"}, 20, 20)
}

func TestSearch_UnparsablePaginationUsesDefaults(t *testing.T) {
	assertSearchPagination(t, map[string]string{"q": "dark", "page": "abc", "page_size": "junk"}, 0, 20)
}

func TestSearch_ValidPagePassesThrough(t *testing.T) {
	// The clamp is a floor, not a cap: a valid page must reach the repository
	// unchanged.
	assertSearchPagination(t, map[string]string{"q": "dark", "page": "3", "page_size": "25"}, 50, 25)
}
