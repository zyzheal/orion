package service

import (
	"context"
	stderrors "errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/alert-pipeline/models"
	"orion/platform-svc-go/internal/alert-pipeline/repository"
)

type mockRepo struct{}

func (m *mockRepo) Save(ctx context.Context, tenantID string, result *models.PipelineResult, alertName, severity string) error {
	return nil
}
func (m *mockRepo) GetByResultID(ctx context.Context, resultID uuid.UUID) (*repository.Result, error) {
	return nil, nil
}
func (m *mockRepo) GetByAlertID(ctx context.Context, alertID string) (*repository.Result, error) {
	return nil, nil
}
func (m *mockRepo) List(ctx context.Context, tenantID string, limit, offset int) ([]*repository.Result, error) {
	return nil, nil
}
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

// makeAlert builds a payload that passes validation. The validate stage
// requires "sourceId", so an alert without one stops the chain at stage 2 of 6
// and reports status "error" -- that is legitimate validation, not a bug, but
// the tests that assert end-to-end execution have to supply the field.
func makeAlert(id string) models.AlertEvent {
	return models.AlertEvent{
		ID: id, Name: "test-alert", Severity: "warning",
		SourceType: "unit-test", SourceID: "src-test",
	}
}

// defaultPipelineStages is what NewPipelineService installs. It deliberately
// differs from models.DefaultPipelineConfig, which has five stages and no
// "validate", so the two must not be conflated.
var defaultPipelineStages = []string{"receive", "validate", "dedup", "enrich", "route", "notify"}

// assertStagesExecuted proves Execute ran exactly the configured stage list, in
// order, without an early stop.
//
// Chain.Execute snapshots the stage that just completed before running the next
// one, so the recorded history is
//
//	[seeded "receive", c0, c1, ..., cN-1]
//
// and Stages[i+1] is the i-th configured stage. The count catches a chain that
// stops early (any stage returning an error) and the name comparison catches a
// chain that ran different stages in a different order.
func assertStagesExecuted(t *testing.T, got *models.PipelineResult, configured []string) {
	t.Helper()
	if got == nil {
		t.Fatal("Execute returned nil")
	}
	if len(got.Stages) != len(configured)+1 {
		t.Fatalf("stages recorded = %v (count %d), want %d for configured %v; a stage failed: %v",
			got.Stages, len(got.Stages), len(configured)+1, configured, got.Errors)
	}
	for i, want := range configured {
		if got.Stages[i+1] != want {
			t.Fatalf("stage %d = %q, want %q (configured %v)", i+1, got.Stages[i+1], want, configured)
		}
	}
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

// UpdateConfig must change what Execute actually runs. A chain is built once
// per tenant and cached, baking in cfg.Stages at construction time, so a
// config update that only mutates s.cfg is accepted and then ignored by every
// subsequent Execute. That is the invariant this test pins: the observable
// stage list has to move.
func TestPipelineServiceUpdateConfigChangesTheStagesExecuteRuns(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	ctx := context.Background()

	before := svc.Execute(ctx, "t1", makeAlert("u1"))
	assertStagesExecuted(t, before, defaultPipelineStages)
	if before.Status != "success" {
		t.Fatalf("status = %q, want success; the default pipeline must complete end to end (errors %v)",
			before.Status, before.Errors)
	}

	cfg := *svc.Config()
	cfg.Stages = []string{"receive", "validate"}
	applied, err := svc.UpdateConfig(ctx, &cfg)
	if err != nil {
		t.Fatalf("UpdateConfig returned err %v", err)
	}
	if applied == nil {
		t.Fatal("UpdateConfig returned a nil config without an error")
	}
	if len(applied.Stages) != 2 || applied.Stages[0] != "receive" || applied.Stages[1] != "validate" {
		t.Fatalf("applied stages = %v, want [receive validate]", applied.Stages)
	}

	after := svc.Execute(ctx, "t1", makeAlert("u2"))
	assertStagesExecuted(t, after, []string{"receive", "validate"})
	if got := svc.Config().Stages; len(got) != 2 {
		t.Fatalf("Config() stages = %v, want 2 entries", got)
	}
}

// The default pipeline must run all six configured stages on a well-formed
// alert. This is what broke first: Execute built the payload map without
// "sourceId", which the validate stage requires, so every execution stopped at
// stage 2 of 6 and dedup, enrich, route and notify never ran. Executing one
// stage instead of six would still pass a count-only assertion, so this test
// pins the whole list.
func TestPipelineServiceExecuteRunsEveryConfiguredStage(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	got := svc.Execute(context.Background(), "t1", makeAlert("u0"))
	assertStagesExecuted(t, got, defaultPipelineStages)
	if got.Status != "success" {
		t.Fatalf("status = %q, want success (errors %v)", got.Status, got.Errors)
	}
}

// Without sourceId the validate stage rejects the alert. That is the stage's
// documented contract, and the alert must fail rather than be silently
// accepted.
func TestPipelineServiceExecuteRejectsAlertWithoutSourceID(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	got := svc.Execute(context.Background(), "t1", models.AlertEvent{
		ID: "u9", Name: "test-alert", Severity: "warning",
	})
	if got.Status == "success" {
		t.Fatal("an alert with no sourceId passed validation; the validate stage requires it")
	}
	if !strings.Contains(strings.Join(got.Errors, " "), "sourceId") {
		t.Fatalf("errors = %v, want the validate stage to name the missing field", got.Errors)
	}
}

// Empty fields keep their current value: a caller sending only maxRetries must
// not lose its name or stage list.
func TestPipelineServiceUpdateConfigKeepsUnsetFields(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	ctx := context.Background()
	name := svc.Config().Name

	applied, err := svc.UpdateConfig(ctx, &models.PipelineConfig{MaxRetries: 5})
	if err != nil {
		t.Fatalf("UpdateConfig returned err %v", err)
	}
	if applied == nil {
		t.Fatal("UpdateConfig returned a nil config without an error")
	}
	if applied.Name != name {
		t.Errorf("name = %q, want %q (unset field must keep the current value)", applied.Name, name)
	}
	if len(applied.Stages) == 0 {
		t.Error("stages became empty; an unset stage list must keep the current one")
	}
	if applied.MaxRetries != 5 {
		t.Errorf("MaxRetries = %d, want 5", applied.MaxRetries)
	}
	if applied.Enabled != svc.Config().Enabled {
		t.Error("Enabled was changed by an update that did not mention it")
	}
}

// Every failure path of a (T, error) method must return both an error and a
// nil result.
func TestPipelineServiceUpdateConfigRejectsNilConfig(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	applied, err := svc.UpdateConfig(context.Background(), nil)
	if err == nil {
		t.Fatal("UpdateConfig accepted a nil config")
	}
	if applied != nil {
		t.Fatalf("UpdateConfig returned %v with an error; it must return nil", applied)
	}
}

func TestPipelineServiceUpdateConfigRejectsUnknownStage(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	applied, err := svc.UpdateConfig(context.Background(), &models.PipelineConfig{
		Stages: []string{"receive", "recieve"},
	})
	if err == nil {
		t.Fatal("UpdateConfig accepted the unknown stage name")
	}
	if applied != nil {
		t.Fatalf("UpdateConfig returned %v with an error; it must return nil", applied)
	}
	if !stderrors.Is(err, ErrUnknownStage) {
		t.Errorf("err = %v, want ErrUnknownStage", err)
	}
	if !strings.Contains(err.Error(), "recieve") {
		t.Errorf("err = %q, want the offending stage name in it", err.Error())
	}
	// The rejected update must not have partially applied.
	if got := svc.Config().Stages; len(got) != len(defaultPipelineStages) {
		t.Fatalf("Config() stages = %v after a rejected update, want the original %v", got, defaultPipelineStages)
	}
}

func TestPipelineServiceUpdateConfigRejectsNegativeValues(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	cases := []struct {
		name string
		cfg  *models.PipelineConfig
	}{
		{"MaxRetries", &models.PipelineConfig{MaxRetries: -1}},
		{"RetryDelay", &models.PipelineConfig{RetryDelay: -1 * time.Second}},
		{"StageTimeout", &models.PipelineConfig{StageTimeout: -1 * time.Second}},
	}
	for _, tc := range cases {
		applied, err := svc.UpdateConfig(context.Background(), tc.cfg)
		if err == nil {
			t.Errorf("%s: UpdateConfig accepted a negative value", tc.name)
			continue
		}
		if applied != nil {
			t.Errorf("%s: UpdateConfig returned %v with an error; it must return nil", tc.name, applied)
		}
		if !stderrors.Is(err, ErrInvalidConfigValue) {
			t.Errorf("%s: err = %v, want ErrInvalidConfigValue", tc.name, err)
		}
	}
	if got := svc.Config().MaxRetries; got != 3 {
		t.Errorf("Config() MaxRetries = %d after rejected updates, want 3", got)
	}
}

// A config update must not stop the pipeline running, and it must apply to
// tenants whose chain was built before the update.
func TestPipelineServiceUpdateConfigAppliesToOtherTenantsToo(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	ctx := context.Background()
	_ = svc.Execute(ctx, "t1", makeAlert("w1"))
	_ = svc.Execute(ctx, "t2", makeAlert("w2"))

	cfg := *svc.Config()
	cfg.Stages = []string{"route"}
	if _, err := svc.UpdateConfig(ctx, &cfg); err != nil {
		t.Fatalf("UpdateConfig returned err %v", err)
	}
	for _, tenant := range []string{"t1", "t2"} {
		got := svc.Execute(ctx, tenant, makeAlert("w3"))
		assertStagesExecuted(t, got, []string{"route"})
	}
}
