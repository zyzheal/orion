package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/monitoring/models"
)

// mockMonitoringRepo implements MonitoringRepo with in-memory maps.
type mockMonitoringRepo struct {
	rules       map[string]*models.AlertRule // key: "tenantID:id"
	metrics     map[string]*models.Metric
	alerts      map[string]*models.Alert
	channels    map[string]*models.NotificationChannel
	escalations map[string]*models.EscalationPolicy

	nextID int
	dbErr  error
}

func newMockRepo() *mockMonitoringRepo {
	return &mockMonitoringRepo{
		rules:       map[string]*models.AlertRule{},
		metrics:     map[string]*models.Metric{},
		alerts:      map[string]*models.Alert{},
		channels:    map[string]*models.NotificationChannel{},
		escalations: map[string]*models.EscalationPolicy{},
		nextID:      1,
	}
}

func (m *mockMonitoringRepo) nextIDString() string {
	n := m.nextID
	m.nextID++
	return "id-" + string(rune(n))
}

// --- Service Control ---

func (m *mockMonitoringRepo) SetServiceStatus(_ context.Context, tenantID, status string) error {
	return m.dbErr
}

func (m *mockMonitoringRepo) GetServiceStatus(_ context.Context, tenantID string) (string, error) {
	// Return "running" for any tenant by default (keeps HealthCheck simple).
	return "running", nil
}

func (m *mockMonitoringRepo) PingContext(_ context.Context) error {
	return m.dbErr
}

// --- Metrics (stubs) ---

func (m *mockMonitoringRepo) CreateMetric(_ context.Context, _ *models.Metric) error { return m.dbErr }
func (m *mockMonitoringRepo) RecordMetric(_ context.Context, _ string, _ models.RecordMetricRequest) error { return m.dbErr }
func (m *mockMonitoringRepo) ListMetrics(_ context.Context, _ string, _, _ int) ([]models.Metric, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) GetMetricSeries(_ context.Context, _, _ string, _, _ *time.Time, _ int) ([]models.MetricSeriesPoint, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) GetMetricSummary(_ context.Context, _, _ string, _, _ *time.Time) (*models.MetricSummary, error) { return nil, m.dbErr }

// --- Alert Rules ---

func (m *mockMonitoringRepo) CreateRule(_ context.Context, rule *models.AlertRule) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if rule.ID == "" {
		rule.ID = m.nextIDString()
	}
	key := rule.TenantID + ":" + rule.ID
	m.rules[key] = rule
	return nil
}

func (m *mockMonitoringRepo) ListRules(_ context.Context, tenantID string, _, _ int) ([]models.AlertRule, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	var out []models.AlertRule
	for _, r := range m.rules {
		if r.TenantID == tenantID {
			out = append(out, *r)
		}
	}
	return out, nil
}

func (m *mockMonitoringRepo) GetRule(_ context.Context, tenantID, id string) (*models.AlertRule, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	r, ok := m.rules[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return r, nil
}

func (m *mockMonitoringRepo) UpdateRule(_ context.Context, tenantID, id string, updates map[string]interface{}) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	r, ok := m.rules[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	if v, ok := updates["name"]; ok {
		r.Name = v.(string)
	}
	if v, ok := updates["metric"]; ok {
		r.Metric = v.(string)
	}
	if v, ok := updates["operator"]; ok {
		r.Operator = v.(string)
	}
	if v, ok := updates["threshold"]; ok {
		r.Threshold = v.(float64)
	}
	if v, ok := updates["evaluation_period"]; ok {
		r.EvaluationPeriod = v.(int)
	}
	if v, ok := updates["severity"]; ok {
		r.Severity = v.(string)
	}
	if v, ok := updates["channels"]; ok {
		r.Channels = v.(string)
	}
	r.UpdatedAt = time.Now()
	return nil
}

func (m *mockMonitoringRepo) DeleteRule(_ context.Context, tenantID, id string) error {
	_, ok := m.rules[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	delete(m.rules, tenantID+":"+id)
	return nil
}

func (m *mockMonitoringRepo) ToggleRule(_ context.Context, tenantID, id string, enabled bool) error {
	r, ok := m.rules[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	r.Enabled = enabled
	return nil
}

func (m *mockMonitoringRepo) SuppressRule(_ context.Context, tenantID, id string, _ string, _ *int) error {
	r, ok := m.rules[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	r.Active = false
	return nil
}

func (m *mockMonitoringRepo) UnsuppressRule(_ context.Context, tenantID, id string) error {
	r, ok := m.rules[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	r.Active = true
	return nil
}

// --- Alerts (stubs) ---

func (m *mockMonitoringRepo) CreateAlert(_ context.Context, _ *models.Alert) error { return m.dbErr }
func (m *mockMonitoringRepo) ListAlerts(_ context.Context, _ string, _, _ int) ([]models.Alert, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) ListActiveAlerts(_ context.Context, _ string, _, _ int) ([]models.Alert, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) GetAlert(_ context.Context, _, _ string) (*models.Alert, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) AcknowledgeAlert(_ context.Context, _, _, _, _ string) error { return m.dbErr }
func (m *mockMonitoringRepo) ResolveAlert(_ context.Context, _, _ string, _ string) error { return m.dbErr }
func (m *mockMonitoringRepo) UpdateAlertStatus(_ context.Context, _, _, _, _ string) error { return m.dbErr }

// --- Notification Channels (stubs) ---

func (m *mockMonitoringRepo) CreateChannel(_ context.Context, _ *models.NotificationChannel) error { return m.dbErr }
func (m *mockMonitoringRepo) ListChannels(_ context.Context, _ string, _, _ int) ([]models.NotificationChannel, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) GetChannel(_ context.Context, _, _ string) (*models.NotificationChannel, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) ToggleChannel(_ context.Context, _, _ string, _ bool) error { return m.dbErr }

// --- Escalation Policies (stubs) ---

func (m *mockMonitoringRepo) CreateEscalationPolicy(_ context.Context, _ *models.EscalationPolicy) error { return m.dbErr }
func (m *mockMonitoringRepo) ListEscalationPolicies(_ context.Context, _ string, _, _ int) ([]models.EscalationPolicy, error) { return nil, m.dbErr }

// --- Notification History (stubs) ---

func (m *mockMonitoringRepo) CreateNotificationRecord(_ context.Context, _ *models.NotificationRecord) error { return m.dbErr }
func (m *mockMonitoringRepo) ListNotificationRecords(_ context.Context, _ string, _, _ int) ([]models.NotificationRecord, error) { return nil, m.dbErr }

// --- Dashboard Widgets (stubs) ---

func (m *mockMonitoringRepo) CreateWidgetConfig(_ context.Context, _ *models.WidgetConfig) error { return m.dbErr }
func (m *mockMonitoringRepo) ListWidgetConfigs(_ context.Context, _ string, _, _ int) ([]models.WidgetConfig, error) { return nil, m.dbErr }

// --- Anomalies (stubs) ---

func (m *mockMonitoringRepo) CreateAnomaly(_ context.Context, _ *models.Anomaly) error { return m.dbErr }
func (m *mockMonitoringRepo) ListAnomalies(_ context.Context, _ string, _, _ int) ([]models.Anomaly, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) CountAnomaliesByMetric(_ context.Context, _ string) ([]struct {
	Metric   string  `db:"metric"`
	Count    int     `db:"count"`
	AvgScore float64 `db:"avg_score"`
}, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) CountAnomaliesBySeverity(_ context.Context, _ string) ([]struct {
	Severity string `db:"severity"`
	Count    int    `db:"count"`
}, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) CountAnomaliesLast24h(_ context.Context, _ string) (int, error) { return 0, m.dbErr }

// --- Aggregation Helpers (stubs) ---

func (m *mockMonitoringRepo) CountAlertsBySeverity(_ context.Context, _ string) ([]models.Alert, error) { return nil, m.dbErr }
func (m *mockMonitoringRepo) RuleAlertCounts(_ context.Context, _ string) ([]models.RuleAlertCounts, error) { return nil, m.dbErr }

// --- Tests ---

func TestCreateRule_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := NewService(repo)

	name := "cpu-high"
	req := models.CreateRuleRequest{Name: name, Metric: "cpu_usage_percent", Operator: "gt", Threshold: 90.0}
	rule, err := svc.CreateRule(ctx, "t1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if rule.Name != name {
		t.Errorf("expected name %q, got %q", name, rule.Name)
	}
	if rule.Metric != "cpu_usage_percent" {
		t.Errorf("expected metric cpu_usage_percent, got %q", rule.Metric)
	}
	if rule.Operator != "gt" {
		t.Errorf("expected operator gt, got %q", rule.Operator)
	}
	if rule.Enabled != true {
		t.Error("expected rule to be enabled")
	}
	if rule.Active != true {
		t.Error("expected rule to be active")
	}
}

func TestCreateRule_Defaults(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := NewService(repo)

	req := models.CreateRuleRequest{Name: "r1", Metric: "m1", Operator: "", Severity: "", EvaluationPeriod: 0}
	rule, err := svc.CreateRule(ctx, "t1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if rule.Operator != "gt" {
		t.Errorf("expected default operator 'gt', got %q", rule.Operator)
	}
	if rule.Severity != "warning" {
		t.Errorf("expected default severity 'warning', got %q", rule.Severity)
	}
	if rule.EvaluationPeriod != 60 {
		t.Errorf("expected default evaluation period 60, got %d", rule.EvaluationPeriod)
	}
}

func TestGetRule_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := NewService(repo)

	_, err := svc.CreateRule(ctx, "t1", models.CreateRuleRequest{Name: "r1", Metric: "m1", Operator: "gt", Threshold: 1.0})
	if err != nil {
		t.Fatalf("expected no error creating rule, got %v", err)
	}
	// Retrieve the generated rule ID.
	rules, _ := repo.ListRules(ctx, "t1", 50, 0)
	if len(rules) != 1 {
		t.Fatalf("expected 1 rule, got %d", len(rules))
	}
	id := rules[0].ID

	rule, err := svc.GetRule(ctx, "t1", id)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if rule.Name != "r1" {
		t.Errorf("expected 'r1', got %q", rule.Name)
	}
}

func TestGetRule_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := NewService(repo)

	_, err := svc.GetRule(ctx, "t1", "nonexist")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestListRules_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := NewService(repo)

	_, _ = svc.CreateRule(ctx, "t1", models.CreateRuleRequest{Name: "r1", Metric: "m1", Operator: "gt", Threshold: 1.0})
	_, _ = svc.CreateRule(ctx, "t1", models.CreateRuleRequest{Name: "r2", Metric: "m2", Operator: "lt", Threshold: 2.0})

	rules, err := svc.GetRules(ctx, "t1", 50, 0)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(rules) != 2 {
		t.Errorf("expected 2 rules, got %d", len(rules))
	}
}

func TestUpdateRule_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := NewService(repo)

	_, err := svc.CreateRule(ctx, "t1", models.CreateRuleRequest{Name: "r1", Metric: "m1", Operator: "gt", Threshold: 1.0})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	rules, _ := repo.ListRules(ctx, "t1", 50, 0)
	id := rules[0].ID

	newName := "updated"
	newOp := "lt"
	req := models.UpdateRuleRequest{Name: &newName, Operator: &newOp}
	rule, err := svc.UpdateRule(ctx, "t1", id, req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if rule.Name != "updated" {
		t.Errorf("expected 'updated', got %q", rule.Name)
	}
	if rule.Operator != "lt" {
		t.Errorf("expected 'lt', got %q", rule.Operator)
	}
}

func TestUpdateRule_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := NewService(repo)

	newName := "x"
	_, err := svc.UpdateRule(ctx, "t1", "nonexist", models.UpdateRuleRequest{Name: &newName})
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestDeleteRule_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := NewService(repo)

	_, err := svc.CreateRule(ctx, "t1", models.CreateRuleRequest{Name: "r1", Metric: "m1", Operator: "gt", Threshold: 1.0})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	rules, _ := repo.ListRules(ctx, "t1", 50, 0)
	id := rules[0].ID

	err = svc.DeleteRule(ctx, "t1", id)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	_, err = repo.GetRule(ctx, "t1", id)
	if !errors.Is(err, sql.ErrNoRows) {
		t.Error("expected rule to be deleted")
	}
}

func TestToggleRule_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := NewService(repo)

	_, err := svc.CreateRule(ctx, "t1", models.CreateRuleRequest{Name: "r1", Metric: "m1", Operator: "gt", Threshold: 1.0})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	rules, _ := repo.ListRules(ctx, "t1", 50, 0)
	id := rules[0].ID

	// Disable the rule.
	rule, err := svc.ToggleRule(ctx, "t1", id, false)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if rule.Enabled {
		t.Error("expected rule to be disabled")
	}

	// Re-enable it.
	rule, err = svc.ToggleRule(ctx, "t1", id, true)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !rule.Enabled {
		t.Error("expected rule to be enabled")
	}
}

func TestHealthCheck_Healthy(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	svc := NewService(repo)

	health, err := svc.HealthCheck(ctx, "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if health.Status != "healthy" {
		t.Errorf("expected 'healthy', got %q", health.Status)
	}
}

func TestHealthCheck_DBDown(t *testing.T) {
	ctx := context.Background()
	repo := newMockRepo()
	repo.dbErr = sql.ErrConnDone
	svc := NewService(repo)

	health, err := svc.HealthCheck(ctx, "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if health.Status != "unhealthy" {
		t.Errorf("expected 'unhealthy', got %q", health.Status)
	}
}
