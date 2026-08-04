package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/observability/models"
)

// mockRepo is a minimal in-memory implementation of RepositoryInterface.
type mockRepo struct {
	rules    map[string]models.AlertRule // keyed by ID
	metrics  map[string]models.Metric    // keyed by "tenant/name"
	fail     bool
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		rules:   make(map[string]models.AlertRule),
		metrics: make(map[string]models.Metric),
	}
}

func (m *mockRepo) CreateAlertRule(_ context.Context, _ string, rule *models.AlertRule) (*models.AlertRule, error) {
	if m.fail {
		return nil, context.DeadlineExceeded
	}
	if rule.ID == "" {
		rule.ID = "r-" + rule.Metric
	}
	m.rules[rule.ID] = *rule
	return rule, nil
}

func (m *mockRepo) CreateMetric(_ context.Context, tenantID string, m_ *models.Metric) (*models.Metric, error) {
	if m.fail {
		return nil, context.DeadlineExceeded
	}
	key := tenantID + "/" + m_.Name
	m.metrics[key] = *m_
	return m_, nil
}

func (m *mockRepo) GetMetric(_ context.Context, tenantID, name string) (*models.Metric, error) {
	key := tenantID + "/" + name
	m_, ok := m.metrics[key]
	if !ok {
		return nil, nil
	}
	return &m_, nil
}

func (m *mockRepo) ListAlertRules(_ context.Context, _ string) ([]models.AlertRule, error) {
	items := make([]models.AlertRule, 0, len(m.rules))
	for _, r := range m.rules {
		items = append(items, r)
	}
	return items, nil
}

func (m *mockRepo) ListMetrics(_ context.Context, tenantID string, q models.MetricQuery) ([]models.Metric, error) {
	items := make([]models.Metric, 0)
	prefix := tenantID + "/"
	for _, m_ := range m.metrics {
		if q.Name == "" || m_.Name == q.Name {
			items = append(items, m_)
		}
	}
	_ = prefix
	return items, nil
}

// ===========================================================================
// Tests
// ===========================================================================

func TestNewServiceNotNil(t *testing.T) {
	svc := NewService(newMockRepo())
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestRecordMetric(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	ctx := context.Background()

	m := &models.Metric{
		Name:      "cpu_usage",
		Value:     75.5,
		Tags:      map[string]string{"host": "node-1"},
	}
	got, err := svc.RecordMetric(ctx, "t1", m)
	if err != nil {
		t.Fatalf("RecordMetric: %v", err)
	}
	if got.Name != "cpu_usage" {
		t.Errorf("Name = %q, want %q", got.Name, "cpu_usage")
	}
	if got.Value != 75.5 {
		t.Errorf("Value = %f, want 75.5", got.Value)
	}
}

func TestGetMetric(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	ctx := context.Background()

	repo.CreateMetric(ctx, "t1", &models.Metric{
		Name:  "latency_p99",
		Value: 42.0,
	})
	m, err := svc.GetMetric(ctx, "t1", "latency_p99")
	if err != nil {
		t.Fatalf("GetMetric: %v", err)
	}
	if m == nil {
		t.Fatal("GetMetric returned nil")
	}
	if m.Value != 42.0 {
		t.Errorf("Value = %f, want 42.0", m.Value)
	}
}

func TestGetMetricNotFound(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	ctx := context.Background()

	m, err := svc.GetMetric(ctx, "t1", "nonexistent")
	if err != nil {
		t.Fatalf("GetMetric: %v", err)
	}
	if m != nil {
		t.Error("GetMetric should return nil for unknown metric")
	}
}

func TestListMetrics(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	ctx := context.Background()

	repo.CreateMetric(ctx, "t1", &models.Metric{Name: "cpu", Value: 50})
	repo.CreateMetric(ctx, "t1", &models.Metric{Name: "mem", Value: 70})

	all, err := svc.ListMetrics(ctx, "t1", models.MetricQuery{})
	if err != nil {
		t.Fatalf("ListMetrics: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("ListMetrics = %d, want 2", len(all))
	}
}

func TestListMetrics_FilterByName(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	ctx := context.Background()

	repo.CreateMetric(ctx, "t1", &models.Metric{Name: "cpu", Value: 50})
	repo.CreateMetric(ctx, "t1", &models.Metric{Name: "mem", Value: 70})

	filtered, err := svc.ListMetrics(ctx, "t1", models.MetricQuery{Name: "cpu"})
	if err != nil {
		t.Fatalf("ListMetrics: %v", err)
	}
	if len(filtered) != 1 {
		t.Fatalf("ListMetrics(filtered) = %d, want 1", len(filtered))
	}
	if filtered[0].Name != "cpu" {
		t.Errorf("Name = %q, want %q", filtered[0].Name, "cpu")
	}
}

func TestCreateAlertRule(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	ctx := context.Background()

	rule := &models.AlertRule{
		Metric:    "cpu_usage",
		Operator:  ">",
		Threshold: 90,
		Severity:  "critical",
		Enabled:   true,
	}
	got, err := svc.CreateAlertRule(ctx, "t1", rule)
	if err != nil {
		t.Fatalf("CreateAlertRule: %v", err)
	}
	if got.Threshold != 90 {
		t.Errorf("Threshold = %f, want 90", got.Threshold)
	}
	if !got.Enabled {
		t.Error("Enabled should be true")
	}
}

func TestCreateAlertRule_ReplacesEmptyID(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	ctx := context.Background()

	rule := &models.AlertRule{
		Metric:    "mem_usage",
		Operator:  "<",
		Threshold: 10,
		Severity:  "warning",
	}
	got, err := svc.CreateAlertRule(ctx, "t1", rule)
	if err != nil {
		t.Fatalf("CreateAlertRule: %v", err)
	}
	if got.ID == "" {
		t.Error("CreateAlertRule should populate empty ID")
	}
}

func TestListAlertRules(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	ctx := context.Background()

	svc.CreateAlertRule(ctx, "t1", &models.AlertRule{ID: "r1", Metric: "cpu", Threshold: 90, Severity: "high"})
	svc.CreateAlertRule(ctx, "t1", &models.AlertRule{ID: "r2", Metric: "mem", Threshold: 80, Severity: "medium"})

	rules, err := svc.ListAlertRules(ctx, "t1")
	if err != nil {
		t.Fatalf("ListAlertRules: %v", err)
	}
	if len(rules) != 2 {
		t.Fatalf("ListAlertRules = %d, want 2", len(rules))
	}
}

func TestListAlertRules_Empty(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	ctx := context.Background()

	rules, err := svc.ListAlertRules(ctx, "t1")
	if err != nil {
		t.Fatalf("ListAlertRules: %v", err)
	}
	if len(rules) != 0 {
		t.Fatalf("ListAlertRules = %d, want 0 (empty)", len(rules))
	}
}

func TestService_PassthroughRepoError(t *testing.T) {
	repo := newMockRepo()
	repo.fail = true
	svc := NewService(repo)
	ctx := context.Background()

	_, err := svc.RecordMetric(ctx, "t1", &models.Metric{Name: "cpu"})
	if err == nil {
		t.Fatal("RecordMetric should return error when repo fails")
	}
}

func TestAlertRuleModel(t *testing.T) {
	rule := models.AlertRule{
		ID:        "alert-1",
		Metric:    "disk_usage",
		Operator:  ">",
		Threshold: 85,
		Severity:  "critical",
		Enabled:   true,
	}
	if rule.Operator != ">" {
		t.Errorf("Operator = %q, want %q", rule.Operator, ">")
	}
	if rule.Severity != "critical" {
		t.Errorf("Severity = %q, want %q", rule.Severity, "critical")
	}
}

func TestMetricModel(t *testing.T) {
	m := models.Metric{
		Name:  "http_requests_total",
		Value: 12345.0,
		Tags:  map[string]string{"method": "GET", "status": "200"},
	}
	if m.Value != 12345.0 {
		t.Errorf("Value = %f, want 12345.0", m.Value)
	}
	if m.Tags["method"] != "GET" {
		t.Errorf("Tags = %v, want method=GET", m.Tags)
	}
}

func TestDashboardModel(t *testing.T) {
	d := models.Dashboard{
		ID:     "dash-1",
		Name:   "Infrastructure Overview",
		Layout: "default",
	}
	if d.Name != "Infrastructure Overview" {
		t.Errorf("Name = %q", d.Name)
	}
}

func TestMetricQueryModel(t *testing.T) {
	q := models.MetricQuery{
		Name:      "cpu",
		From:      "2024-01-01",
		To:        "2024-01-02",
		Aggregate: "avg",
	}
	if q.Aggregate != "avg" {
		t.Errorf("Aggregate = %q", q.Aggregate)
	}
	if q.From != "2024-01-01" {
		t.Errorf("From = %q", q.From)
	}
}
