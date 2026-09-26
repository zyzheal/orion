package handler

import (
	"context"
	"net/http"
	"testing"

	"orion/platform-svc-go/internal/inception/models"
)

// History used to do
//
//	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
//	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
//	items, err := h.svc.List(ctx, tenantID, (page-1)*ps, ps)
//
// Page numbering is 1-based, so `?page=-40` derived OFFSET -800 and `?page=0`
// derived OFFSET -20. Postgres rejects a negative OFFSET with an error instead
// of data, so a GET became a 500; `?page_size=-5` did the same thing through a
// negative LIMIT. Neither endpoint of the arithmetic was ever checked, and the
// repository binds both values raw, so the handler was the only place to fix
// it. listAuditsFn pins the pair the service actually receives.
func assertHistoryPagination(t *testing.T, query map[string]string, wantOffset, wantLimit int) {
	t.Helper()
	var gotOffset, gotLimit int
	svc := &mockSvc{
		listAuditsFn: func(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLAuditHistory, error) {
			if tenantID != "tenant-1" {
				t.Fatalf("tenantID = %q, want tenant-1", tenantID)
			}
			gotOffset, gotLimit = offset, limit
			return nil, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.History, "GET", nil, nil, query)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if gotOffset != wantOffset || gotLimit != wantLimit {
		t.Fatalf("offset=%d limit=%d, want offset=%d limit=%d", gotOffset, gotLimit, wantOffset, wantLimit)
	}
}

func TestHistory_NegativePageIsClamped(t *testing.T) {
	assertHistoryPagination(t, map[string]string{"page": "-40", "page_size": "20"}, 0, 20)
}

func TestHistory_ZeroPageIsClamped(t *testing.T) {
	// Page 0 is not the first page, it is one before the first page, and it was
	// the one value that read harmlessly in logs while still sending a negative
	// OFFSET to the database.
	assertHistoryPagination(t, map[string]string{"page": "0", "page_size": "25"}, 0, 25)
}

func TestHistory_NegativePageSizeIsClamped(t *testing.T) {
	assertHistoryPagination(t, map[string]string{"page": "2", "page_size": "-5"}, 20, 20)
}

func TestHistory_UnparsablePaginationUsesDefaults(t *testing.T) {
	assertHistoryPagination(t, map[string]string{"page": "abc", "page_size": "junk"}, 0, 20)
}

func TestHistory_AbsentPaginationUsesDefaults(t *testing.T) {
	assertHistoryPagination(t, nil, 0, 20)
}

func TestHistory_ValidPagePassesThrough(t *testing.T) {
	// The clamp is a floor, not a cap: a valid page must reach the repository
	// unchanged.
	assertHistoryPagination(t, map[string]string{"page": "3", "page_size": "25"}, 50, 25)
}
