package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/alert-pipeline/models"
	"orion/platform-svc-go/internal/alert-pipeline/repository"
	"go.uber.org/zap"
)

type mockRepo struct{}

func (m *mockRepo) Save(ctx context.Context, tenantID string, result *models.PipelineResult, alertName, severity string) error { return nil }
func (m *mockRepo) GetByResultID(ctx context.Context, resultID interface{}) (*repository.Result, error) { return nil, nil }
func (m *mockRepo) GetByAlertID(ctx context.Context, alertID string) (*repository.Result, error) { return nil, nil }
func (m *mockRepo) List(ctx context.Context, tenantID string, limit, offset int) ([]*repository.Result, error) { return nil, nil }
func (m *mockRepo) Count(ctx context.Context, tenantID string) (int, error) { return 0, nil }

func TestPipelineServiceNew(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	if svc == nil {
		t.Fatal("NewPipelineService returned nil")
	}
	cfg := svc.Config()
	if cfg == nil {
		t.Fatal("Config returned nil")
	}
	if !cfg.Enabled {
		t.Error("pipeline should be enabled by default")
	}
}

func TestPipelineServiceConfigHasStages(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	cfg := svc.Config()
	if len(cfg.Stages) == 0 {
		t.Error("stages should not be empty")
	}
	if cfg.Name == "" {
		t.Error("pipeline name should not be empty")
	}
}

func makeAlert(id string) models.AlertEvent {
	return models.AlertEvent{ID: id, Name: "test-alert", Severity: "warning"}
}

func TestPipelineServiceExecute(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	result := svc.Execute(context.Background(), "t1", makeAlert("a1"))
	if result == nil {
		t.Fatal("Execute returned null")
	}
	if result.Status != "success" && result.Status != "dropped" && result.Status != "error" {
		t.Errorf("unexpected status: %s", result.Status)
	}
}

func TestPipelineServiceExecuteReturnsResult(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	result := svc.Execute(context.Background(), "t1", makeAlert("a2"))
	if result.AlertID != "a2" {
		t.Errorf("AlertID=%s, want a2", result.AlertID)
	}
	if result.StageCount == 0 {
		t.Error("StageCount should be > 0")
	}
}

func TestPipelineServiceExecuteBatch(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	alerts := []models.AlertEvent{
		{ID: "b1", Name: "a", Severity: "warning"},
		{ID: "b2", Name: "b", Severity: "info"},
		{ID: "b3", Name: "c", Severity: "critical"},
	}
	results := svc.ExecuteBatch(context.Background(), "t1", alerts)
	if len(results) != len(alerts) {
		t.Errorf("got %d results, want %d", len(results), len(alerts))
	}
}

func TestPipelineServiceExecuteBatchEmpty(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	results := svc.ExecuteBatch(context.Background(), "t1", nil)
	if len(results) != 0 {
		t.Errorf("got %d results, want 0", len(results))
	}
}

func TestPipelineServiceEnableDisable(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	svc.Enable("t1", false)
	if svc.Config().Enabled {
		t.Error("pipeline should be disabled after Enable(false)")
	}
	svc.Enable("t1", true)
	if !svc.Config().Enabled {
		t.Error("pipeline should be enabled after Enable(true)")
	}
}

func TestPipelineServiceExecuteMultipleTenants(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	r1 := svc.Execute(context.Background(), "t1", makeAlert("c1"))
	r2 := svc.Execute(context.Background(), "t2", makeAlert("c2"))
	if r1.AlertID != "c1" || r2.AlertID != "c2" {
		t.Error("each tenant should get independent results")
	}
}
