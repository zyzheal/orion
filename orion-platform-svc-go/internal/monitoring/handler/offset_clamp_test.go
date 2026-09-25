package handler

import (
	"context"
	"net/http"
	"testing"

	"orion/platform-svc-go/internal/monitoring/models"
	"orion/platform-svc-go/internal/monitoring/service"

	"github.com/gin-gonic/gin"
)

// offsetRecordingRepo wraps the mock repository and records the pagination pair
// each list method is called with. The monitoring handlers put no page field in
// their responses, so the database-facing value is only observable through the
// repository: without the clamp `?offset=-40` reaches the database as a
// negative OFFSET, which Postgres rejects with an error instead of data. The
// repository clamps `limit <= 0` in ten places but has no offset clamp at all.
type offsetRecordingRepo struct {
	*mockMonitoringRepo
	calls []pageCall
}

// pageCall is one list call's pagination pair as the repository saw it.
type pageCall struct {
	limit  int
	offset int
}

func newOffsetRecordingRepo() *offsetRecordingRepo {
	return &offsetRecordingRepo{mockMonitoringRepo: newMockRepo()}
}

func (r *offsetRecordingRepo) record(limit, offset int) {
	r.calls = append(r.calls, pageCall{limit: limit, offset: offset})
}

func (r *offsetRecordingRepo) ListMetrics(ctx context.Context, tenantID string, limit, offset int) ([]models.Metric, error) {
	r.record(limit, offset)
	return r.mockMonitoringRepo.ListMetrics(ctx, tenantID, limit, offset)
}

func (r *offsetRecordingRepo) ListRules(ctx context.Context, tenantID string, limit, offset int) ([]models.AlertRule, error) {
	r.record(limit, offset)
	return r.mockMonitoringRepo.ListRules(ctx, tenantID, limit, offset)
}

func (r *offsetRecordingRepo) ListAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error) {
	r.record(limit, offset)
	return r.mockMonitoringRepo.ListAlerts(ctx, tenantID, limit, offset)
}

func (r *offsetRecordingRepo) ListActiveAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error) {
	r.record(limit, offset)
	return r.mockMonitoringRepo.ListActiveAlerts(ctx, tenantID, limit, offset)
}

func (r *offsetRecordingRepo) ListChannels(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationChannel, error) {
	r.record(limit, offset)
	return r.mockMonitoringRepo.ListChannels(ctx, tenantID, limit, offset)
}

func (r *offsetRecordingRepo) ListEscalationPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.EscalationPolicy, error) {
	r.record(limit, offset)
	return r.mockMonitoringRepo.ListEscalationPolicies(ctx, tenantID, limit, offset)
}

func (r *offsetRecordingRepo) ListNotificationRecords(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationRecord, error) {
	r.record(limit, offset)
	return r.mockMonitoringRepo.ListNotificationRecords(ctx, tenantID, limit, offset)
}

func (r *offsetRecordingRepo) ListWidgetConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.WidgetConfig, error) {
	r.record(limit, offset)
	return r.mockMonitoringRepo.ListWidgetConfigs(ctx, tenantID, limit, offset)
}

func (r *offsetRecordingRepo) ListAnomalies(ctx context.Context, tenantID string, limit, offset int) ([]models.Anomaly, error) {
	r.record(limit, offset)
	return r.mockMonitoringRepo.ListAnomalies(ctx, tenantID, limit, offset)
}

// assertOffsetClamped drives one list endpoint with ?offset=-40 and checks that
// it still answers 200 and that the repository saw a zero offset. `last` is the
// index of the call to assert on: every endpoint but DetectAnomalies makes one
// list call, while DetectAnomalies first lists the metric catalog with a
// hard-coded offset and only then lists anomalies.
func assertOffsetClamped(t *testing.T, last int, call func(*Handler) func(c *gin.Context)) {
	t.Helper()
	repo := newOffsetRecordingRepo()
	h := newHandlerWithSvc(service.NewService(repo))

	w := performRequest(h, call(h), "GET", nil, nil, map[string]string{"offset": "-40"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if len(repo.calls) != last+1 {
		t.Fatalf("expected %d recorded list calls, got %d: %+v", last+1, len(repo.calls), repo.calls)
	}
	if got := repo.calls[last].offset; got != 0 {
		t.Fatalf("expected the clamped offset 0 to reach the repository, got %d", got)
	}
	if got := repo.calls[last].limit; got != 50 {
		t.Fatalf("expected the untouched default limit 50, got %d", got)
	}
}

func TestGetRegisteredMetrics_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, 0, func(h *Handler) func(c *gin.Context) { return h.GetRegisteredMetrics })
}

func TestGetRules_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, 0, func(h *Handler) func(c *gin.Context) { return h.GetRules })
}

func TestGetAlerts_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, 0, func(h *Handler) func(c *gin.Context) { return h.GetAlerts })
}

func TestGetActiveAlerts_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, 0, func(h *Handler) func(c *gin.Context) { return h.GetActiveAlerts })
}

func TestGetChannels_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, 0, func(h *Handler) func(c *gin.Context) { return h.GetChannels })
}

func TestGetEscalationPolicies_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, 0, func(h *Handler) func(c *gin.Context) { return h.GetEscalationPolicies })
}

func TestGetNotificationHistory_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, 0, func(h *Handler) func(c *gin.Context) { return h.GetNotificationHistory })
}

func TestGetWidgetConfigs_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, 0, func(h *Handler) func(c *gin.Context) { return h.GetWidgetConfigs })
}

// DetectAnomalies is the only one of the nine that writes: it creates anomaly
// records for every enabled metric before it lists them, so a negative offset
// used to answer 500 after the writes had already happened.
func TestDetectAnomalies_NegativeOffsetIsClamped(t *testing.T) {
	assertOffsetClamped(t, 1, func(h *Handler) func(c *gin.Context) { return h.DetectAnomalies })
}

// A valid offset must pass through untouched: the clamp is a floor, not a cap.
// limit is deliberately left alone in the handler — the repository already
// clamps `limit <= 0` in ten places, and there is no division in this module to
// protect.
func TestGetRules_ValidOffsetAndLimitPassThrough(t *testing.T) {
	repo := newOffsetRecordingRepo()
	h := newHandlerWithSvc(service.NewService(repo))

	w := performRequest(h, h.GetRules, "GET", nil, nil, map[string]string{"offset": "14", "limit": "7"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if len(repo.calls) != 1 {
		t.Fatalf("expected 1 recorded list call, got %d: %+v", len(repo.calls), repo.calls)
	}
	if got := repo.calls[0]; got.offset != 14 || got.limit != 7 {
		t.Fatalf("expected offset=14 limit=7 forwarded, got offset=%d limit=%d", got.offset, got.limit)
	}
}
