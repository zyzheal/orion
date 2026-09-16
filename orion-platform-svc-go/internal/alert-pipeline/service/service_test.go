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

func boolp(v bool) *bool                  { return &v }
func intp(v int) *int                     { return &v }
func durp(v time.Duration) *time.Duration { return &v }

// assertStagesExecuted proves Execute ran exactly the configured stage list, in
// order, without an early stop.
//
// Chain.Execute snapshots the stage that just completed before starting the next
// one, and skips that snapshot for the very first stage (see Chain.Execute). So
// on a run that completes all N stages the history is
//
//	[c0, c1, ..., cN-1]
//
// and Stages[i] is the i-th configured stage: the count catches a chain that
// stops early (any stage returning an error) and the name comparison catches a
// chain that ran different stages in a different order.
func assertStagesExecuted(t *testing.T, got *models.PipelineResult, configured []string) {
	t.Helper()
	if got == nil {
		t.Fatal("Execute returned nil")
	}
	if len(got.Stages) != len(configured) {
		t.Fatalf("stages recorded = %v (count %d), want %d for configured %v; a stage failed: %v",
			got.Stages, len(got.Stages), len(configured), configured, got.Errors)
	}
	for i, want := range configured {
		if got.Stages[i] != want {
			t.Fatalf("stage %d = %q, want %q (configured %v)", i, got.Stages[i], want, configured)
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

	applied, err := svc.UpdateConfig(ctx, &ConfigPatch{Stages: []string{"receive", "validate"}})
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
	// An aborted run must name the stage that stopped it. Chain.Execute snapshots
	// a stage only before running the next one, so without the explicit append
	// this is ["receive"] -- indistinguishable from a pipeline configured with a
	// single stage.
	if len(got.Stages) != 2 || got.Stages[0] != "receive" || got.Stages[1] != "validate" {
		t.Fatalf("stages = %v, want [receive validate]; the aborted stage must be reported", got.Stages)
	}
	if got.StageCount != 2 {
		t.Errorf("StageCount = %d, want 2", got.StageCount)
	}
}

// A field the caller does not send keeps its current value, a field it does
// send replaces it. This is the partial-PUT contract; the first real
// implementation replaced the whole stored config with the bound request, which
// could not express it.
func TestPipelineServiceUpdateConfigKeepsUnsetFields(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	ctx := context.Background()
	name := svc.Config().Name

	applied, err := svc.UpdateConfig(ctx, &ConfigPatch{MaxRetries: intp(5)})
	if err != nil {
		t.Fatalf("UpdateConfig returned err %v", err)
	}
	if applied == nil {
		t.Fatal("UpdateConfig returned a nil config without an error")
	}
	if applied.MaxRetries != 5 {
		t.Errorf("MaxRetries = %d, want 5", applied.MaxRetries)
	}
	if applied.Name != name {
		t.Errorf("name = %q, want %q (unset field must keep the current value)", applied.Name, name)
	}
	if len(applied.Stages) == 0 {
		t.Error("stages became empty; an unset stage list must keep the current one")
	}
	if applied.Enabled != svc.Config().Enabled {
		t.Error("Enabled was changed by an update that did not mention it")
	}
	if applied.RetryDelay != time.Second {
		t.Errorf("RetryDelay = %v, want the inherited 1s", applied.RetryDelay)
	}
	if applied.StageTimeout != 5*time.Second {
		t.Errorf("StageTimeout = %v, want the inherited 5s", applied.StageTimeout)
	}
	if !applied.DeadLetterEnabled {
		t.Error("DeadLetterEnabled was cleared by an update that did not mention it")
	}
}

// The regression that pointed the way to ConfigPatch: a caller changing only the
// stage list must not zero the retry knobs or, worse, switch the pipeline off
// through the zero value of Enabled. A pointer-free patch produces exactly this.
func TestPipelineServiceUpdateConfigStagesOnlyKeepsEverythingElse(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	before := svc.Config()
	if !before.Enabled {
		t.Fatal("precondition: the pipeline starts enabled")
	}

	applied, err := svc.UpdateConfig(context.Background(),
		&ConfigPatch{Stages: []string{"receive", "validate"}})
	if err != nil {
		t.Fatalf("UpdateConfig returned err %v", err)
	}
	if applied == nil {
		t.Fatal("UpdateConfig returned a nil config without an error")
	}
	if len(applied.Stages) != 2 {
		t.Fatalf("stages = %v, want the requested two", applied.Stages)
	}
	if !applied.Enabled {
		t.Error("a stages-only update disabled the pipeline; Enabled's zero value was applied")
	}
	if applied.MaxRetries != before.MaxRetries {
		t.Errorf("MaxRetries = %d, want %d", applied.MaxRetries, before.MaxRetries)
	}
	if applied.RetryDelay != before.RetryDelay {
		t.Errorf("RetryDelay = %v, want %v", applied.RetryDelay, before.RetryDelay)
	}
	if applied.StageTimeout != before.StageTimeout {
		t.Errorf("StageTimeout = %v, want %v", applied.StageTimeout, before.StageTimeout)
	}
	if applied.DeadLetterEnabled != before.DeadLetterEnabled {
		t.Errorf("DeadLetterEnabled = %v, want %v", applied.DeadLetterEnabled, before.DeadLetterEnabled)
	}
}

// Zero values sent explicitly are still applied: a pointer distinguishes absent
// from zero, so this must not be confused with the previous test.
func TestPipelineServiceUpdateConfigAppliesExplicitZero(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	applied, err := svc.UpdateConfig(context.Background(),
		&ConfigPatch{MaxRetries: intp(0), DeadLetterEnabled: boolp(false)})
	if err != nil {
		t.Fatalf("UpdateConfig returned err %v", err)
	}
	if applied == nil {
		t.Fatal("UpdateConfig returned a nil config without an error")
	}
	if applied.MaxRetries != 0 {
		t.Errorf("MaxRetries = %d, want 0; an explicit zero is not an absent field", applied.MaxRetries)
	}
	if applied.DeadLetterEnabled {
		t.Error("DeadLetterEnabled = true, want the explicitly sent false")
	}
}

// The patch must not be able to alias the caller's stage slice: a later edit by
// the caller must not change what the pipeline runs.
func TestPipelineServiceUpdateConfigCopiesTheStageSlice(t *testing.T) {
	svc := NewPipelineService(zap.NewNop(), &mockRepo{})
	sent := []string{"receive", "validate"}
	if _, err := svc.UpdateConfig(context.Background(), &ConfigPatch{Stages: sent}); err != nil {
		t.Fatalf("UpdateConfig returned err %v", err)
	}
	sent = append(sent, "route")
	if got := svc.Config().Stages; len(got) != 2 || got[0] != "receive" || got[1] != "validate" {
		t.Fatalf("Config() stages = %v after the caller mutated its own slice", got)
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
	applied, err := svc.UpdateConfig(context.Background(), &ConfigPatch{
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
		name  string
		patch *ConfigPatch
	}{
		{"MaxRetries", &ConfigPatch{MaxRetries: intp(-1)}},
		{"RetryDelay", &ConfigPatch{RetryDelay: durp(-1 * time.Second)}},
		{"StageTimeout", &ConfigPatch{StageTimeout: durp(-1 * time.Second)}},
	}
	for _, tc := range cases {
		applied, err := svc.UpdateConfig(context.Background(), tc.patch)
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

	if _, err := svc.UpdateConfig(ctx, &ConfigPatch{Stages: []string{"route"}}); err != nil {
		t.Fatalf("UpdateConfig returned err %v", err)
	}
	for _, tenant := range []string{"t1", "t2"} {
		got := svc.Execute(ctx, tenant, makeAlert("w3"))
		assertStagesExecuted(t, got, []string{"route"})
	}
}
