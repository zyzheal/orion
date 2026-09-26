package handler

import (
	"context"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"

	"orion/platform-svc-go/internal/internal-library/models"
	"orion/platform-svc-go/internal/internal-library/service"
)

// List, ListByLanguage and ListByOwner each read `offset` straight from the
// query string and passed it to the repository, which binds it into
// `OFFSET $n` after flooring `limit` only. `?offset=-40` reached Postgres as a
// negative OFFSET, which Postgres rejects with an error instead of data — a GET
// turned into a 500. offsetRecordingService records the values the handler
// forwards so the test pins the database-facing number, not the response body.
type offsetRecordingService struct {
	fakeInternal_libraryService
	method string
	limit  int
	offset int
}

var _ service.ServiceInterface = (*offsetRecordingService)(nil)

func (f *offsetRecordingService) List(ctx context.Context, tenantID string, limit, offset int) ([]models.InternalLibrary, error) {
	f.method, f.limit, f.offset = "List", limit, offset
	return []models.InternalLibrary{}, nil
}

func (f *offsetRecordingService) ListByLanguage(ctx context.Context, tenantID, language string, limit, offset int) ([]models.InternalLibrary, error) {
	f.method, f.limit, f.offset = "ListByLanguage", limit, offset
	return []models.InternalLibrary{}, nil
}

func (f *offsetRecordingService) ListByOwner(ctx context.Context, tenantID, owner string, limit, offset int) ([]models.InternalLibrary, error) {
	f.method, f.limit, f.offset = "ListByOwner", limit, offset
	return []models.InternalLibrary{}, nil
}

// Each of the three list endpoints is asserted on its own, so a clamp landing
// in only one of them cannot pass the set. The expected method name also pins
// which handler produced the call.
func TestList_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, "List", func(h *Handler) func(c *gin.Context) { return h.List })
}

func TestListByLanguage_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, "ListByLanguage", func(h *Handler) func(c *gin.Context) { return h.ListByLanguage })
}

func TestListByOwner_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, "ListByOwner", func(h *Handler) func(c *gin.Context) { return h.ListByOwner })
}

func assertOffsetClamped(t *testing.T, want string, call func(*Handler) func(c *gin.Context)) {
	t.Helper()
	svc := &offsetRecordingService{}
	c, w := makeCtx(http.MethodGet, "/?offset=-40")
	call(NewHandler(svc))(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if svc.method != want {
		t.Fatalf("expected %q to be called, got %q", want, svc.method)
	}
	if svc.offset != 0 {
		t.Fatalf("%s: expected offset=0 forwarded, got %d", want, svc.offset)
	}
	if svc.limit != 50 {
		t.Fatalf("%s: expected the default limit=50, got %d", want, svc.limit)
	}
}

// A valid offset must pass through untouched: the clamp is a floor, not a cap.
func TestListByOwner_ValidOffsetUnchanged(t *testing.T) {
	svc := &offsetRecordingService{}
	c, w := makeCtx(http.MethodGet, "/?offset=60&limit=30")
	NewHandler(svc).ListByOwner(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if svc.offset != 60 || svc.limit != 30 {
		t.Fatalf("expected offset=60 limit=30 forwarded, got offset=%d limit=%d", svc.offset, svc.limit)
	}
}
