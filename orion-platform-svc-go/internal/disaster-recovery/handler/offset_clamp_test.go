package handler

import (
	"context"
	"net/http"
	"testing"

	"orion/platform-svc-go/internal/disaster-recovery/models"
	"orion/platform-svc-go/internal/disaster-recovery/service"
)

// ListPlans read `offset` straight from the query string and passed it to the
// repository, which binds it into `LIMIT $2 OFFSET $3` after flooring `limit`
// only. `?offset=-40` therefore reached Postgres as a negative OFFSET, which
// Postgres rejects with an error instead of data — a GET turned into a 500.
// offsetRecordingService records the values the handler forwards so the test
// pins the database-facing number, not the response body.
type offsetRecordingService struct {
	fakeDisaster_recoveryService
	limit  int
	offset int
}

var _ service.ServiceInterface = (*offsetRecordingService)(nil)

func (f *offsetRecordingService) ListPlans(ctx context.Context, tenantID string, limit, offset int) (*models.ListPlansResponse, error) {
	f.limit, f.offset = limit, offset
	return &models.ListPlansResponse{}, nil
}

func TestListPlans_NegativeOffsetIsClamped(t *testing.T) {
	svc := &offsetRecordingService{}
	c, w := makeCtx(http.MethodGet, "/?offset=-40")
	NewHandler(svc).ListPlans(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if svc.offset != 0 {
		t.Fatalf("expected offset=0 forwarded, got %d", svc.offset)
	}
	if svc.limit != 50 {
		t.Fatalf("expected the default limit=50, got %d", svc.limit)
	}
}

// A valid offset must pass through untouched: the clamp is a floor, not a cap.
func TestListPlans_ValidOffsetUnchanged(t *testing.T) {
	svc := &offsetRecordingService{}
	c, w := makeCtx(http.MethodGet, "/?offset=40&limit=25")
	NewHandler(svc).ListPlans(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if svc.offset != 40 || svc.limit != 25 {
		t.Fatalf("expected offset=40 limit=25 forwarded, got offset=%d limit=%d", svc.offset, svc.limit)
	}
}
