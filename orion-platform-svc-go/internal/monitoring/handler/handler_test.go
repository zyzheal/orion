package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/platform-svc-go/internal/monitoring/models"
	"orion/platform-svc-go/internal/monitoring/service"

	"github.com/gin-gonic/gin"
)

// --- mock repository (implements service.MonitoringRepo) ---

type mockMonitoringRepo struct {
	dbErr              error
	setStatusErr       error
	getStatus          string
	getStatusErr       error
	pingErr            error
	createMetricErr    error
	createRuleErr      error
	listRules          []models.AlertRule
	getRule            *models.AlertRule
	getRuleErr         error
	deleteRuleErr      error
	listAlerts         []models.Alert
	listAlertsErr      error
	getAlert           *models.Alert
	getAlertErr        error
	createChannelErr   error
	createWidgetErr    error
	createAnomalyErr   error
}

func newMockRepo() *mockMonitoringRepo {
	return &mockMonitoringRepo{
		listRules:  make([]models.AlertRule, 0),
		listAlerts: make([]models.Alert, 0),
	}
}

func (m *mockMonitoringRepo) SetServiceStatus(_ context.Context, _ string, _ string) error {
	return m.setStatusErr
}
func (m *mockMonitoringRepo) GetServiceStatus(_ context.Context, _ string) (string, error) {
	return m.getStatus, m.getStatusErr
}
func (m *mockMonitoringRepo) PingContext(_ context.Context) error {
	return m.pingErr
}
func (m *mockMonitoringRepo) CreateMetric(_ context.Context, m1 *models.Metric) error {
	m1.ID = "m-1"
	return m.createMetricErr
}
func (m *mockMonitoringRepo) RecordMetric(_ context.Context, _ string, _ models.RecordMetricRequest) error { return m.dbErr }
func (m *mockMonitoringRepo) ListMetrics(_ context.Context, _ string, _, _ int) ([]models.Metric, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) GetMetricSeries(_ context.Context, _, _ string, _, _ *time.Time, _ int) ([]models.MetricSeriesPoint, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) GetMetricSummary(_ context.Context, _, _ string, _, _ *time.Time) (*models.MetricSummary, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) CreateRule(_ context.Context, r *models.AlertRule) error {
	r.ID = "rule-1"
	if m.createRuleErr == nil {
		m.listRules = append(m.listRules, *r)
	}
	return m.createRuleErr
}
func (m *mockMonitoringRepo) ListRules(_ context.Context, _ string, _, _ int) ([]models.AlertRule, error) { return m.listRules, m.dbErr }
func (m *mockMonitoringRepo) GetRule(_ context.Context, _, _ string) (*models.AlertRule, error) { return m.getRule, m.getRuleErr }
func (m *mockMonitoringRepo) UpdateRule(_ context.Context, _, _ string, _ map[string]interface{}) error { return m.dbErr }
func (m *mockMonitoringRepo) DeleteRule(_ context.Context, _, _ string) error { return m.deleteRuleErr }
func (m *mockMonitoringRepo) ToggleRule(_ context.Context, _, _ string, _ bool) error { return m.dbErr }
func (m *mockMonitoringRepo) SuppressRule(_ context.Context, _, _ string, _ string, _ *int) error { return m.dbErr }
func (m *mockMonitoringRepo) UnsuppressRule(_ context.Context, _, _ string) error { return m.dbErr }
func (m *mockMonitoringRepo) CreateAlert(_ context.Context, _ *models.Alert) error { return m.dbErr }
func (m *mockMonitoringRepo) ListAlerts(_ context.Context, _ string, _, _ int) ([]models.Alert, error) { return m.listAlerts, m.listAlertsErr }
func (m *mockMonitoringRepo) ListActiveAlerts(_ context.Context, _ string, _, _ int) ([]models.Alert, error) { return m.listAlerts, m.listAlertsErr }
func (m *mockMonitoringRepo) GetAlert(_ context.Context, _, _ string) (*models.Alert, error) { return m.getAlert, m.getAlertErr }
func (m *mockMonitoringRepo) AcknowledgeAlert(_ context.Context, _, _, _, _ string) error { return m.dbErr }
func (m *mockMonitoringRepo) ResolveAlert(_ context.Context, _, _ string, _ string) error { return m.dbErr }
func (m *mockMonitoringRepo) UpdateAlertStatus(_ context.Context, _, _, _, _ string) error { return m.dbErr }
func (m *mockMonitoringRepo) CreateChannel(_ context.Context, _ *models.NotificationChannel) error { return m.createChannelErr }
func (m *mockMonitoringRepo) ListChannels(_ context.Context, _ string, _, _ int) ([]models.NotificationChannel, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) GetChannel(_ context.Context, _, _ string) (*models.NotificationChannel, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) ToggleChannel(_ context.Context, _, _ string, _ bool) error { return m.dbErr }
func (m *mockMonitoringRepo) CreateEscalationPolicy(_ context.Context, _ *models.EscalationPolicy) error { return m.dbErr }
func (m *mockMonitoringRepo) ListEscalationPolicies(_ context.Context, _ string, _, _ int) ([]models.EscalationPolicy, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) CreateNotificationRecord(_ context.Context, _ *models.NotificationRecord) error { return m.dbErr }
func (m *mockMonitoringRepo) ListNotificationRecords(_ context.Context, _ string, _, _ int) ([]models.NotificationRecord, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) CreateWidgetConfig(_ context.Context, _ *models.WidgetConfig) error { return m.createWidgetErr }
func (m *mockMonitoringRepo) ListWidgetConfigs(_ context.Context, _ string, _, _ int) ([]models.WidgetConfig, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) CreateAnomaly(_ context.Context, _ *models.Anomaly) error { return m.createAnomalyErr }
func (m *mockMonitoringRepo) ListAnomalies(_ context.Context, _ string, _, _ int) ([]models.Anomaly, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) CountAnomaliesByMetric(_ context.Context, _ string) ([]struct{ Metric string "db:\"metric\""; Count int "db:\"count\""; AvgScore float64 "db:\"avg_score\"" }, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) CountAnomaliesBySeverity(_ context.Context, _ string) ([]struct{ Severity string "db:\"severity\""; Count int "db:\"count\""}, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) CountAnomaliesLast24h(_ context.Context, _ string) (int, error) { return 0, m.dbErr }
func (m *mockMonitoringRepo) CountAlertsBySeverity(_ context.Context, _ string) ([]models.Alert, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) RuleAlertCounts(_ context.Context, _ string) ([]models.RuleAlertCounts, error) { return nil, m.dbErr }

// --- helpers ---

func newHandlerWithSvc(svc *service.Service) *Handler {
	return NewHandler(svc)
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", &buf)
	c.Request.Header.Set("Content-Type", "application/json")

	if pathParams != nil {
		for k, v := range pathParams {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	if queryParams != nil {
		q := c.Request.URL.Query()
		for k, v := range queryParams {
			q.Set(k, v)
		}
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

// ==================== Service Control ====================

func TestHandler_HealthCheck_Success(t *testing.T) {
	repo := newMockRepo()
	repo.getStatus = "running"
	repo.pingErr = nil
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.HealthCheck, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_HealthCheck_Unhealthy(t *testing.T) {
	repo := newMockRepo()
	repo.pingErr = errors.New("db unavailable")
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.HealthCheck, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_StartService_Success(t *testing.T) {
	repo := newMockRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.StartService, "POST", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_StopService_ServiceError(t *testing.T) {
	repo := newMockRepo()
	repo.setStatusErr = errors.New("db error")
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.StopService, "POST", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// ==================== Alert Rules ====================

func TestHandler_CreateRule_Success(t *testing.T) {
	repo := newMockRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.CreateRule, "POST", models.CreateRuleRequest{
		Name:        "high cpu",
		Metric:      "cpu_usage",
		Operator:    "gt",
		Threshold:   90.0,
		Severity:    "critical",
		Channels: "slack",
	}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestHandler_GetRules_Success(t *testing.T) {
	repo := newMockRepo()
	repo.listRules = []models.AlertRule{{ID: "rule-1", Name: "test"}}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.GetRules, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetRule_Success(t *testing.T) {
	repo := newMockRepo()
	repo.getRule = &models.AlertRule{ID: "rule-1", Name: "test"}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.GetRule, "GET", nil, map[string]string{"id": "rule-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetRule_NotFound(t *testing.T) {
	repo := newMockRepo()
	repo.getRuleErr = service.ErrNotFound
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.GetRule, "GET", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandler_DeleteRule_Success(t *testing.T) {
	repo := newMockRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.DeleteRule, "DELETE", nil, map[string]string{"id": "rule-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_UpdateRule_ServiceError(t *testing.T) {
	repo := newMockRepo()
	repo.dbErr = errors.New("db error")
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.UpdateRule, "PUT", map[string]interface{}{"name": "updated"}, map[string]string{"id": "rule-1"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// ==================== Notifications ====================

func TestHandler_GetChannels_Success(t *testing.T) {
	repo := newMockRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.GetChannels, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_CreateEscalationPolicy_Success(t *testing.T) {
	repo := newMockRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.CreateEscalationPolicy, "POST", models.CreateEscalationPolicyRequest{
		Name:   "primary",
		Levels: "{\"order\":1,\"delay\":5}",
	}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

// ==================== Anomalies ====================

func TestHandler_DetectAnomalies_Success(t *testing.T) {
	repo := newMockRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.DetectAnomalies, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetAnomalySummary_ServiceError(t *testing.T) {
	repo := newMockRepo()
	repo.dbErr = errors.New("db error")
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.GetAnomalySummary, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}
