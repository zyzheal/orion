package handler

import (
	"context"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"

	"orion/platform-svc-go/internal/policy/models"
)

// offsetRecordingService wraps the fake service and records the pagination pair
// each list method is called with. The policy handlers put no page field in
// their responses, so the database-facing value is only observable through the
// service: without the clamp `?offset=-40` reaches the database as a negative
// OFFSET, which Postgres rejects with an error instead of data. The repository
// clamps `limit <= 0` in six places but has no offset clamp at all.
type offsetRecordingService struct {
	fakePolicyService
	calls []pageCall
}

// pageCall is one list call's pagination pair as the service saw it.
type pageCall struct {
	method string
	limit  int
	offset int
}

func (s *offsetRecordingService) record(method string, limit, offset int) {
	s.calls = append(s.calls, pageCall{method: method, limit: limit, offset: offset})
}

func (s *offsetRecordingService) ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.Policy, error) {
	s.record("ListPolicies", limit, offset)
	return s.fakePolicyService.ListPolicies(ctx, tenantID, limit, offset)
}

func (s *offsetRecordingService) GetEvaluationHistory(ctx context.Context, tenantID, policyID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	s.record("GetEvaluationHistory", limit, offset)
	return s.fakePolicyService.GetEvaluationHistory(ctx, tenantID, policyID, limit, offset)
}

func (s *offsetRecordingService) ListEvaluations(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	s.record("ListEvaluations", limit, offset)
	return s.fakePolicyService.ListEvaluations(ctx, tenantID, limit, offset)
}

func (s *offsetRecordingService) ListViolations(ctx context.Context, tenantID string, limit, offset int) ([]models.Violation, error) {
	s.record("ListViolations", limit, offset)
	return s.fakePolicyService.ListViolations(ctx, tenantID, limit, offset)
}

func (s *offsetRecordingService) ListOverrides(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyOverride, error) {
	s.record("ListOverrides", limit, offset)
	return s.fakePolicyService.ListOverrides(ctx, tenantID, limit, offset)
}

// assertOffsetClamped drives one list endpoint with ?offset=-40 and checks that
// it still answers 200, that it reaches the service method named by `want`, and
// that the service saw a zero offset. Recording the method name is what pins
// ListRootEvaluations and ListEvaluationsRuns to the same service call: the two
// routes are byte-identical handlers and return the same data.
func assertOffsetClamped(t *testing.T, want string, call func(*Handler) func(c *gin.Context)) {
	t.Helper()
	svc := &offsetRecordingService{}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/?offset=-40")
	call(h)(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if len(svc.calls) != 1 {
		t.Fatalf("expected 1 recorded list call, got %d: %+v", len(svc.calls), svc.calls)
	}
	got := svc.calls[0]
	if got.method != want {
		t.Fatalf("expected the endpoint to reach %s, it reached %s", want, got.method)
	}
	if got.offset != 0 {
		t.Fatalf("expected the clamped offset 0 to reach the service, got %d", got.offset)
	}
	if got.limit != 50 {
		t.Fatalf("expected the untouched default limit 50, got %d", got.limit)
	}
}

func TestList_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, "ListPolicies", func(h *Handler) func(c *gin.Context) { return h.List })
}

// The handler ListEvaluations serves GET /policies/:id/evaluations and reaches
// the service's GetEvaluationHistory — the names do not line up.
func TestListEvaluations_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, "GetEvaluationHistory", func(h *Handler) func(c *gin.Context) { return h.ListEvaluations })
}

func TestListRootEvaluations_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, "ListEvaluations", func(h *Handler) func(c *gin.Context) { return h.ListRootEvaluations })
}

func TestListEvaluationsRuns_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, "ListEvaluations", func(h *Handler) func(c *gin.Context) { return h.ListEvaluationsRuns })
}

func TestListViolations_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, "ListViolations", func(h *Handler) func(c *gin.Context) { return h.ListViolations })
}

func TestListOverrides_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, "ListOverrides", func(h *Handler) func(c *gin.Context) { return h.ListOverrides })
}

// A valid offset must pass through untouched: the clamp is a floor, not a cap.
// limit is deliberately left alone in the handler — the repository already
// clamps `limit <= 0` in six places, and there is no division in this module to
// protect.
func TestListPolicies_ValidOffsetAndLimitPassThrough(t *testing.T) {
	svc := &offsetRecordingService{}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/?offset=14&limit=7")
	h.List(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if len(svc.calls) != 1 {
		t.Fatalf("expected 1 recorded list call, got %d: %+v", len(svc.calls), svc.calls)
	}
	got := svc.calls[0]
	if got.offset != 14 || got.limit != 7 {
		t.Fatalf("expected offset=14 limit=7 forwarded, got offset=%d limit=%d", got.offset, got.limit)
	}
}
