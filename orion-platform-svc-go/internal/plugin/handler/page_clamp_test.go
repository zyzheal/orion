package handler

import (
	"context"
	"net/http"
	"testing"

	"orion/platform-svc-go/internal/plugin/models"
)

// listRecordingSvc records the offset and limit List hands to the service. It
// exists so the tests can assert on the values actually derived from the query
// string instead of the bytes in the JSON body.
type listRecordingSvc struct {
	fakePluginService
	offset int
	limit  int
}

func (s *listRecordingSvc) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Plugin, error) {
	s.offset, s.limit = offset, limit
	return nil, nil
}

// List used to do
//
//	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
//	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
//	items, err := h.svc.List(ctx, tenantID, (page-1)*ps, ps)
//
// Page numbering is 1-based, so `?page=-40` derived OFFSET -800 and `?page=0`
// derived OFFSET -20, and Postgres rejects a negative OFFSET with an error
// instead of data: a GET became a 500. `?page_size=-5` did the same through a
// negative LIMIT. The handler was the only guard on the path.
func assertListPagination(t *testing.T, path string, wantOffset, wantLimit int) {
	t.Helper()
	svc := &listRecordingSvc{}
	h := NewHandler(svc)
	c, w := makeCtx(http.MethodGet, "/plugins"+path)
	h.List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("%s: expected 200, got %d body=%s", path, w.Code, w.Body.String())
	}
	if svc.offset != wantOffset || svc.limit != wantLimit {
		t.Fatalf("%s: offset=%d limit=%d, want offset=%d limit=%d", path, svc.offset, svc.limit, wantOffset, wantLimit)
	}
}

func TestList_NegativePageIsClamped(t *testing.T) {
	assertListPagination(t, "?page=-40&page_size=20", 0, 20)
}

func TestList_ZeroPageIsClamped(t *testing.T) {
	// Page 0 is not the first page, it is one before it, and it read harmlessly
	// in a log line while still sending a negative OFFSET to the database.
	assertListPagination(t, "?page=0&page_size=25", 0, 25)
}

func TestList_NegativePageSizeIsClamped(t *testing.T) {
	assertListPagination(t, "?page=2&page_size=-5", 20, 20)
}

func TestList_UnparsablePaginationUsesDefaults(t *testing.T) {
	assertListPagination(t, "?page=abc&page_size=junk", 0, 20)
}

func TestList_AbsentPaginationUsesDefaults(t *testing.T) {
	assertListPagination(t, "", 0, 20)
}

func TestList_ValidPagePassesThrough(t *testing.T) {
	// The clamp is a floor, not a cap: a valid page must reach the repository
	// unchanged.
	assertListPagination(t, "?page=3&page_size=25", 50, 25)
}
