package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/branch-policy/models"
)

// TestMigrationChecksumChecker_NilRequest guards against a nil dereference.
func TestMigrationChecksumChecker_NilRequest(t *testing.T) {
	c := NewMigrationChecksumChecker(newFakeRepo(), 0)
	_, err := c.CheckSchemaCompatibility(context.Background(), nil)
	if err == nil {
		t.Error("expected error for nil request")
	}
}

// TestMigrationChecksumChecker_NoArtifactID returns nil (informational pass).
func TestMigrationChecksumChecker_NoArtifactID(t *testing.T) {
	c := NewMigrationChecksumChecker(newFakeRepo(), 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res != nil {
		t.Errorf("expected nil result (informational pass), got %+v", res)
	}
}

// TestMigrationChecksumChecker_ArtifactNotFound returns nil.
func TestMigrationChecksumChecker_ArtifactNotFound(t *testing.T) {
	repo := newFakeRepo()
	c := NewMigrationChecksumChecker(repo, 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "missing", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res != nil {
		t.Errorf("expected nil result, got %+v", res)
	}
}

// TestMigrationChecksumChecker_ArtifactNoChecksum returns nil.
func TestMigrationChecksumChecker_ArtifactNoChecksum(t *testing.T) {
	repo := newFakeRepo()
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-1", TenantID: "t1",
	})
	c := NewMigrationChecksumChecker(repo, 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "art-1", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res != nil {
		t.Errorf("expected nil result, got %+v", res)
	}
}

// TestMigrationChecksumChecker_NoPriorDeploy returns nil when the target env
// has never had a successful deploy.
func TestMigrationChecksumChecker_NoPriorDeploy(t *testing.T) {
	repo := newFakeRepo()
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-1", TenantID: "t1", MigrationChecksum: "v3:hash",
	})
	c := NewMigrationChecksumChecker(repo, 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "art-1", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res != nil {
		t.Errorf("expected nil result, got %+v", res)
	}
}

// TestMigrationChecksumChecker_DeployIsUpgrade is compatible.
func TestMigrationChecksumChecker_DeployIsUpgrade(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now()
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-old", TenantID: "t1", MigrationChecksum: "v2:oldhash",
	})
	repo.deployEvents["de-1"] = &models.DeployEvent{
		ID: "de-1", TenantID: "t1", Env: "prod",
		ArtifactID: "art-old", Outcome: models.DeployOutcomeSuccess,
		StartedAt: now.Add(-1 * time.Hour), CreatedAt: now.Add(-1 * time.Hour),
	}
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-new", TenantID: "t1", MigrationChecksum: "v3:newhash",
	})
	c := NewMigrationChecksumChecker(repo, 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "art-new", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res == nil {
		t.Fatal("expected non-nil result")
	}
	if !res.Compatible {
		t.Errorf("expected Compatible=true, got breaking=%v", res.Breaking)
	}
	if res.CheckedAgainstArtifactSchemaVersion != "v3:newhash" {
		t.Errorf("CheckedAgainstArtifactSchemaVersion = %q", res.CheckedAgainstArtifactSchemaVersion)
	}
	if res.CheckedAgainstSchemaVersion != "v2:oldhash" {
		t.Errorf("CheckedAgainstSchemaVersion = %q", res.CheckedAgainstSchemaVersion)
	}
}

// TestMigrationChecksumChecker_DeployIsDowngrade is incompatible (blocking).
func TestMigrationChecksumChecker_DeployIsDowngrade(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now()
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-old", TenantID: "t1", MigrationChecksum: "v5:oldhash",
	})
	repo.deployEvents["de-1"] = &models.DeployEvent{
		ID: "de-1", TenantID: "t1", Env: "prod",
		ArtifactID: "art-old", Outcome: models.DeployOutcomeSuccess,
		StartedAt: now.Add(-1 * time.Hour), CreatedAt: now.Add(-1 * time.Hour),
	}
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-new", TenantID: "t1", MigrationChecksum: "v3:newhash",
	})
	c := NewMigrationChecksumChecker(repo, 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "art-new", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res == nil {
		t.Fatal("expected non-nil result")
	}
	if res.Compatible {
		t.Error("expected Compatible=false (migration downgrade)")
	}
	if len(res.Breaking) != 1 {
		t.Fatalf("expected 1 breaking item, got %d", len(res.Breaking))
	}
	if !strings.Contains(res.Breaking[0], "downgrade") {
		t.Errorf("breaking message should mention downgrade, got %q", res.Breaking[0])
	}
}

// TestMigrationChecksumChecker_SameVersion is compatible.
func TestMigrationChecksumChecker_SameVersion(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now()
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-old", TenantID: "t1", MigrationChecksum: "v3:hashA",
	})
	repo.deployEvents["de-1"] = &models.DeployEvent{
		ID: "de-1", TenantID: "t1", Env: "prod",
		ArtifactID: "art-old", Outcome: models.DeployOutcomeSuccess,
		StartedAt: now.Add(-1 * time.Hour), CreatedAt: now.Add(-1 * time.Hour),
	}
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-new", TenantID: "t1", MigrationChecksum: "v3:hashB",
	})
	c := NewMigrationChecksumChecker(repo, 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "art-new", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res == nil {
		t.Fatal("expected non-nil result")
	}
	if !res.Compatible {
		t.Errorf("same version should be compatible, got breaking=%v", res.Breaking)
	}
}

// TestMigrationChecksumChecker_NoComparableMarkerOnNewChecksum passes with a
// warning rather than blocking.
func TestMigrationChecksumChecker_NoComparableMarkerOnNewChecksum(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now()
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-old", TenantID: "t1", MigrationChecksum: "v3:old",
	})
	repo.deployEvents["de-1"] = &models.DeployEvent{
		ID: "de-1", TenantID: "t1", Env: "prod",
		ArtifactID: "art-old", Outcome: models.DeployOutcomeSuccess,
		StartedAt: now.Add(-1 * time.Hour), CreatedAt: now.Add(-1 * time.Hour),
	}
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-new", TenantID: "t1", MigrationChecksum: "no-version-marker",
	})
	c := NewMigrationChecksumChecker(repo, 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "art-new", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res == nil {
		t.Fatal("expected non-nil result")
	}
	if !res.Compatible {
		t.Error("non-comparable marker should not block")
	}
	if len(res.Warnings) == 0 {
		t.Error("expected at least one warning")
	}
}

// TestMigrationChecksumChecker_NoComparableMarkerOnOldChecksum passes with a
// warning.
func TestMigrationChecksumChecker_NoComparableMarkerOnOldChecksum(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now()
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-old", TenantID: "t1", MigrationChecksum: "opaque-hash",
	})
	repo.deployEvents["de-1"] = &models.DeployEvent{
		ID: "de-1", TenantID: "t1", Env: "prod",
		ArtifactID: "art-old", Outcome: models.DeployOutcomeSuccess,
		StartedAt: now.Add(-1 * time.Hour), CreatedAt: now.Add(-1 * time.Hour),
	}
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-new", TenantID: "t1", MigrationChecksum: "v5:new",
	})
	c := NewMigrationChecksumChecker(repo, 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "art-new", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res == nil {
		t.Fatal("expected non-nil result")
	}
	if !res.Compatible {
		t.Error("non-comparable old marker should not block")
	}
	if len(res.Warnings) == 0 {
		t.Error("expected warnings")
	}
}

// TestMigrationChecksumChecker_IgnoresNonSuccessDeploys only considers
// Outcome=success events as the "currently deployed" baseline.
func TestMigrationChecksumChecker_IgnoresNonSuccessDeploys(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now()
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-old", TenantID: "t1", MigrationChecksum: "v5:old",
	})
	repo.deployEvents["de-fail"] = &models.DeployEvent{
		ID: "de-fail", TenantID: "t1", Env: "prod",
		ArtifactID: "art-old", Outcome: models.DeployOutcomeFailed,
		StartedAt: now.Add(-1 * time.Hour), CreatedAt: now.Add(-1 * time.Hour),
	}
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-new", TenantID: "t1", MigrationChecksum: "v3:new",
	})
	c := NewMigrationChecksumChecker(repo, 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "art-new", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res != nil {
		t.Errorf("expected nil result (no success baseline), got %+v", res)
	}
}

// TestMigrationChecksumChecker_TenantIsolation does not see another tenant's
// artifacts or deploy events.
func TestMigrationChecksumChecker_TenantIsolation(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now()
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-other", TenantID: "t-other", MigrationChecksum: "v99:old",
	})
	repo.deployEvents["de-other"] = &models.DeployEvent{
		ID: "de-other", TenantID: "t-other", Env: "prod",
		ArtifactID: "art-other", Outcome: models.DeployOutcomeSuccess,
		StartedAt: now.Add(-1 * time.Hour), CreatedAt: now.Add(-1 * time.Hour),
	}
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "art-new", TenantID: "t1", MigrationChecksum: "v3:new",
	})
	c := NewMigrationChecksumChecker(repo, 0)
	res, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "art-new", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res != nil {
		t.Errorf("expected nil (tenant isolation), got %+v", res)
	}
}

// TestMigrationChecksumChecker_LookbackZeroUsesDefault verifies the default
// lookback is applied when the caller passes 0.
func TestMigrationChecksumChecker_LookbackZeroUsesDefault(t *testing.T) {
	repo := newFakeRepo()
	c := NewMigrationChecksumChecker(repo, 0)
	if c.lookback != SchemaCompatCheckerDefaultLookback {
		t.Errorf("lookback = %d, want default %d", c.lookback, SchemaCompatCheckerDefaultLookback)
	}
}

// TestMigrationChecksumChecker_RepoErrorPropagates surfaces a repository
// failure as a checker error.
func TestMigrationChecksumChecker_RepoErrorPropagates(t *testing.T) {
	errRepo := &errorRepoFull{fakeRepo: newFakeRepo(), err: errors.New("db down")}
	c := NewMigrationChecksumChecker(errRepo, 0)
	_, err := c.CheckSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", ArtifactID: "art-1", TargetEnv: "prod",
	})
	if err == nil {
		t.Fatal("expected error from repository")
	}
}

// errorRepoFull wraps a fakeRepo but overrides GetBuildArtifact to always
// return an error, so tests can exercise the checker's error-propagation path.
type errorRepoFull struct {
	*fakeRepo
	err error
}

func (e *errorRepoFull) GetBuildArtifact(ctx context.Context, tenantID, id string) (*models.BuildArtifact, error) {
	return nil, e.err
}

// TestMigrationChecksumChecker_EndToEndDowngradeBlocksGate is the design-doc
// L1072 acceptance path: a DB-migration downgrade discovered by the real
// MigrationChecksumChecker flips R6 to failed and — because R6 is Blocking —
// lands in result.Blocked and fails the whole PreDeployGate.
func TestMigrationChecksumChecker_EndToEndDowngradeBlocksGate(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now()
	// currently deployed to prod: artifact with migration v2
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "cur-v2", TenantID: "t1", MigrationChecksum: "v2:20260908-cd34",
	})
	repo.deployEvents["evt-1"] = &models.DeployEvent{
		ID: "evt-1", TenantID: "t1", Env: "prod",
		ArtifactID: "cur-v2", Outcome: models.DeployOutcomeSuccess,
		StartedAt: now.Add(-1 * time.Hour), CreatedAt: now.Add(-1 * time.Hour),
	}
	// deploying: artifact with migration v1 (downgrade)
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "new-v1", TenantID: "t1", MigrationChecksum: "v1:20260901-ab12",
	})

	svc := NewService(repo).WithSchemaChecker(NewMigrationChecksumChecker(repo, 0))
	result, err := svc.CheckPreDeployGate(context.Background(), "t1", models.DeployRequest{
		TenantID: "t1", Branch: "main", TargetEnv: "prod", PipelineName: "p", ArtifactID: "new-v1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Passed {
		t.Error("gate must fail overall when a blocking migration downgrade is detected")
	}
	if !containsString(result.Blocked, GateRuleIDSchema) {
		t.Errorf("R6 (Blocking) must be in result.Blocked; got %v", result.Blocked)
	}
	var r6 *models.GateRuleResult
	for i := range result.Rules {
		if result.Rules[i].RuleID == GateRuleIDSchema {
			r6 = &result.Rules[i]
			break
		}
	}
	if r6 == nil {
		t.Fatalf("R6 rule missing from result.Rules: %+v", result.Rules)
	}
	if r6.Passed {
		t.Error("R6 should fail on migration downgrade")
	}
	if !strings.Contains(r6.Detail, "DB migration downgrade") ||
		!strings.Contains(r6.Detail, "v1") || !strings.Contains(r6.Detail, "v2") {
		t.Errorf("R6 detail should name both versions, got %q", r6.Detail)
	}
}

// TestMigrationChecksumChecker_EndToEndUpgradePasses asserts the mirror case:
// deploying a strictly higher migration version passes the gate.
func TestMigrationChecksumChecker_EndToEndUpgradePasses(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now()
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "cur-v1", TenantID: "t1", MigrationChecksum: "v1:old",
	})
	repo.deployEvents["evt-1"] = &models.DeployEvent{
		ID: "evt-1", TenantID: "t1", Env: "prod",
		ArtifactID: "cur-v1", Outcome: models.DeployOutcomeSuccess,
		StartedAt: now.Add(-1 * time.Hour), CreatedAt: now.Add(-1 * time.Hour),
	}
	_ = repo.CreateBuildArtifact(context.Background(), &models.BuildArtifact{
		ID: "new-v2", TenantID: "t1", MigrationChecksum: "v2:new",
	})

	svc := NewService(repo).WithSchemaChecker(NewMigrationChecksumChecker(repo, 0))
	result, err := svc.CheckPreDeployGate(context.Background(), "t1", models.DeployRequest{
		TenantID: "t1", Branch: "main", TargetEnv: "prod", PipelineName: "p", ArtifactID: "new-v2",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Note: we deliberately assert only R6 behavior here. The minimal DeployRequest
	// also drives R1-R3 (approval/artifact checks), which fail on this synthetic
	// payload and correctly land in result.Blocked — so result.Passed overall is
	// NOT a meaningful signal for the schema-compat dimension.
	if containsString(result.Blocked, GateRuleIDSchema) {
		t.Errorf("R6 must not be blocked on upgrade; blocked=%v", result.Blocked)
	}
	var r6 *models.GateRuleResult
	for i := range result.Rules {
		if result.Rules[i].RuleID == GateRuleIDSchema {
			r6 = &result.Rules[i]
			break
		}
	}
	if r6 == nil {
		t.Fatalf("R6 rule missing from result.Rules: %+v", result.Rules)
	}
	if !r6.Passed {
		t.Errorf("R6 should pass on a migration upgrade; detail=%q", r6.Detail)
	}
	if !strings.Contains(r6.Detail, "not lower than deployed v1") {
		t.Errorf("R6 detail should note the upgrade direction, got %q", r6.Detail)
	}
}
