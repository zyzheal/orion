package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"

	"orion/platform-svc-go/internal/branch-policy/models"
)

// This file covers the 7 stubs that were replaced with real implementations:
//   - ListArtifacts
//   - ListPipelines
//   - ValidateBranch
//   - GetCoverage
//   - EnforcePolicy
//   - ListViolations
//   - GetStats
//
// They all share the fakeRepo defined in service_test.go.

func makeBranchProfile(id, name string, semantic models.BranchSemantic, status models.BranchStatus) *models.BranchProfile {
	return &models.BranchProfile{
		ID:       id,
		TenantID: "t1",
		RepoID:   "r1",
		Name:     name,
		Semantic: semantic,
		Status:   status,
	}
}

func makeArtifact(id, pipelineID string, valid bool) *models.BuildArtifact {
	return &models.BuildArtifact{
		ID:              id,
		TenantID:        "t1",
		Branch:          "main",
		BuildPipelineID: pipelineID,
		SignatureValid:  valid,
	}
}

// --- ListArtifacts ---

func TestListArtifacts_ReturnsIDs(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	repo.CreateBuildArtifact(context.Background(), makeArtifact("a1", "p1", true))
	repo.CreateBuildArtifact(context.Background(), makeArtifact("a2", "p2", false))

	ids, err := svc.ListArtifacts(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 2 {
		t.Fatalf("expected 2 ids, got %d: %v", len(ids), ids)
	}
	set := map[string]bool{"a1": true, "a2": true}
	for _, id := range ids {
		if !set[id] {
			t.Errorf("unexpected id %q", id)
		}
	}
}

func TestListArtifacts_EmptyTenantIsNoOp(t *testing.T) {
	svc := NewService(newFakeRepo())
	ids, err := svc.ListArtifacts(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 0 {
		t.Errorf("expected empty, got %v", ids)
	}
}

func TestListArtifacts_FiltersByTenant(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	repo.CreateBuildArtifact(context.Background(), makeArtifact("a1", "p1", true))
	// Different tenant.
	other := makeArtifact("a2", "p2", true)
	other.TenantID = "other"
	repo.CreateBuildArtifact(context.Background(), other)

	ids, err := svc.ListArtifacts(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 1 || ids[0] != "a1" {
		t.Errorf("expected [a1], got %v", ids)
	}
}

// --- ListPipelines ---

func TestListPipelines_DedupsAndSkipsEmpty(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	repo.CreateBuildArtifact(context.Background(), makeArtifact("a1", "p1", true))
	repo.CreateBuildArtifact(context.Background(), makeArtifact("a2", "p1", true)) // dup
	repo.CreateBuildArtifact(context.Background(), makeArtifact("a3", "p2", false))
	repo.CreateBuildArtifact(context.Background(), makeArtifact("a4", "", false))   // empty pipeline

	pipelines, err := svc.ListPipelines(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pipelines) != 2 {
		t.Fatalf("expected 2 pipelines, got %d: %v", len(pipelines), pipelines)
	}
	set := map[string]bool{"p1": true, "p2": true}
	for _, p := range pipelines {
		if !set[p] {
			t.Errorf("unexpected pipeline %q", p)
		}
	}
}

func TestListPipelines_EmptyTenantIsNoOp(t *testing.T) {
	svc := NewService(newFakeRepo())
	pipelines, err := svc.ListPipelines(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pipelines) != 0 {
		t.Errorf("expected empty, got %v", pipelines)
	}
}

// --- ValidateBranch ---

func TestValidateBranch_ExactMatchOnActiveProfile(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	repo.CreateBranchProfile(context.Background(), makeBranchProfile("p1", "main", models.BranchMain, models.BranchStatusActive))

	ok, err := svc.ValidateBranch(context.Background(), "t1", "main")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected main to be valid")
	}
}

func TestValidateBranch_ExactMatchOnInactiveProfile(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	repo.CreateBranchProfile(context.Background(), makeBranchProfile("p1", "main", models.BranchMain, models.BranchStatusArchived))

	ok, err := svc.ValidateBranch(context.Background(), "t1", "main")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("expected archived main to be invalid")
	}
}

func TestValidateBranch_MatchOnMergeTargetOfActiveProfile(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	p := makeBranchProfile("p1", "release/1.0", models.BranchRelease, models.BranchStatusActive)
	p.MergeTargets = []string{"main"}
	repo.CreateBranchProfile(context.Background(), p)

	ok, err := svc.ValidateBranch(context.Background(), "t1", "main")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected main (as a merge target) to be valid")
	}
}

func TestValidateBranch_MatchOnMergeSourceOfActiveProfile(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	p := makeBranchProfile("p1", "hotfix/bug", models.BranchHotfix, models.BranchStatusActive)
	p.MergeSources = []string{"staging"}
	repo.CreateBranchProfile(context.Background(), p)

	ok, err := svc.ValidateBranch(context.Background(), "t1", "staging")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected staging (as a merge source) to be valid")
	}
}

func TestValidateBranch_UnregisteredBranchIsInvalid(t *testing.T) {
	svc := NewService(newFakeRepo())
	ok, err := svc.ValidateBranch(context.Background(), "t1", "does-not-exist")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("expected unregistered branch to be invalid")
	}
}

func TestValidateBranch_EmptyArgsAreNoOp(t *testing.T) {
	svc := NewService(newFakeRepo())
	if ok, err := svc.ValidateBranch(context.Background(), "", "main"); err != nil || ok {
		t.Errorf("empty tenant: ok=%v err=%v", ok, err)
	}
	if ok, err := svc.ValidateBranch(context.Background(), "t1", ""); err != nil || ok {
		t.Errorf("empty branch: ok=%v err=%v", ok, err)
	}
}

// --- GetCoverage ---

func TestGetCoverage_ComputesCountsAndPct(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	activeMain := makeBranchProfile("p1", "main", models.BranchMain, models.BranchStatusActive)
	activeMain.ProtectedEnvs = []string{"prod"}
	repo.CreateBranchProfile(context.Background(), activeMain)

	activeRel := makeBranchProfile("p2", "release/1.0", models.BranchRelease, models.BranchStatusActive)
	repo.CreateBranchProfile(context.Background(), activeRel)

	archived := makeBranchProfile("p3", "release/0.9", models.BranchRelease, models.BranchStatusArchived)
	repo.CreateBranchProfile(context.Background(), archived)

	coverage, err := svc.GetCoverage(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := coverage["totalProfiles"]; got != 3 {
		t.Errorf("totalProfiles = %v, want 3", got)
	}
	if got := coverage["activeProfiles"]; got != 2 {
		t.Errorf("activeProfiles = %v, want 2", got)
	}
	if got := coverage["archivedProfiles"]; got != 1 {
		t.Errorf("archivedProfiles = %v, want 1", got)
	}
	if got := coverage["protectedEnvProfiles"]; got != 1 {
		t.Errorf("protectedEnvProfiles = %v, want 1", got)
	}
	// 2/3 = 66.67%
	coveragePctRaw, ok := coverage["coveragePct"]
	if !ok {
		t.Fatal("coveragePct missing")
	}
	pct, ok := coveragePctRaw.(float64)
	if !ok {
		t.Fatalf("coveragePct not float64: %T", coveragePctRaw)
	}
	if pct < 66.6 || pct > 66.7 {
		t.Errorf("coveragePct = %v, want ~66.67", pct)
	}
	semDist, ok := coverage["semanticDistribution"].(map[string]int)
	if !ok {
		t.Fatalf("semanticDistribution type: %T", coverage["semanticDistribution"])
	}
	if semDist["main"] != 1 || semDist["release"] != 2 {
		t.Errorf("semanticDistribution = %v", semDist)
	}
}

func TestGetCoverage_EmptyTenantReturnsEmptyMap(t *testing.T) {
	svc := NewService(newFakeRepo())
	coverage, err := svc.GetCoverage(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(coverage) != 0 {
		t.Errorf("expected empty map, got %v", coverage)
	}
}

func TestGetCoverage_EmptyRepoYieldsZeroPct(t *testing.T) {
	svc := NewService(newFakeRepo())
	coverage, err := svc.GetCoverage(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := coverage["totalProfiles"]; got != 0 {
		t.Errorf("totalProfiles = %v, want 0", got)
	}
	if got := coverage["coveragePct"]; got != 0.0 {
		t.Errorf("coveragePct = %v, want 0.0", got)
	}
}

// --- ListViolations ---

func TestListViolations_NoViolationsWhenAllGood(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	// Main branch — no merge targets required, name prefix matches.
	main := makeBranchProfile("p1", "main", models.BranchMain, models.BranchStatusActive)
	repo.CreateBranchProfile(context.Background(), main)

	// Release branch with merge targets and matching prefix.
	rel := makeBranchProfile("p2", "release/1.0", models.BranchRelease, models.BranchStatusActive)
	rel.MergeTargets = []string{"main"}
	repo.CreateBranchProfile(context.Background(), rel)

	// LTS with future LTSUntil and a merge target (non-main rule).
	future := time.Now().Add(365 * 24 * time.Hour)
	lts := makeBranchProfile("p3", "lts/2026", models.BranchLTS, models.BranchStatusActive)
	lts.LTSUntil = &future
	lts.MergeTargets = []string{"main"}
	repo.CreateBranchProfile(context.Background(), lts)

	violations, err := svc.ListViolations(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(violations) != 0 {
		t.Errorf("expected no violations, got %v", violations)
	}
}

func TestListViolations_NonMainWithoutMergeTargets(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	rel := makeBranchProfile("p1", "release/1.0", models.BranchRelease, models.BranchStatusActive)
	repo.CreateBranchProfile(context.Background(), rel)

	violations, err := svc.ListViolations(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(violations) != 1 {
		t.Fatalf("expected 1 violation, got %d: %v", len(violations), violations)
	}
	if !strings.Contains(violations[0], "non-main branch must have merge targets") {
		t.Errorf("unexpected violation message: %s", violations[0])
	}
}

func TestListViolations_LTSWithoutLTSUntil(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	lts := makeBranchProfile("p1", "lts/2026", models.BranchLTS, models.BranchStatusActive)
	lts.MergeTargets = []string{"main"}
	repo.CreateBranchProfile(context.Background(), lts)

	violations, err := svc.ListViolations(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(violations) != 1 {
		t.Fatalf("expected 1 violation, got %d: %v", len(violations), violations)
	}
	if !strings.Contains(violations[0], "LTS branch must have LTSUntil set") {
		t.Errorf("unexpected violation message: %s", violations[0])
	}
}

func TestListViolations_LTSUntilInPast(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	past := time.Now().Add(-24 * time.Hour)
	lts := makeBranchProfile("p1", "lts/2025", models.BranchLTS, models.BranchStatusActive)
	lts.LTSUntil = &past
	lts.MergeTargets = []string{"main"}
	repo.CreateBranchProfile(context.Background(), lts)

	violations, err := svc.ListViolations(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(violations) != 1 {
		t.Fatalf("expected 1 violation, got %d: %v", len(violations), violations)
	}
	if !strings.Contains(violations[0], "LTSUntil") || !strings.Contains(violations[0], "past") {
		t.Errorf("unexpected violation message: %s", violations[0])
	}
}

func TestListViolations_NamePrefixMismatch(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	// Release semantic but name doesn't start with "release/".
	rel := makeBranchProfile("p1", "wrong-prefix", models.BranchRelease, models.BranchStatusActive)
	rel.MergeTargets = []string{"main"}
	repo.CreateBranchProfile(context.Background(), rel)

	violations, err := svc.ListViolations(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(violations) != 1 {
		t.Fatalf("expected 1 violation, got %d: %v", len(violations), violations)
	}
	if !strings.Contains(violations[0], `name must start with "release/"`) {
		t.Errorf("unexpected violation message: %s", violations[0])
	}
}

func TestListViolations_ArchivedProfileIsSkipped(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	// Archived release with no merge targets + wrong prefix — should be skipped.
	bad := makeBranchProfile("p1", "wrong", models.BranchRelease, models.BranchStatusArchived)
	repo.CreateBranchProfile(context.Background(), bad)

	violations, err := svc.ListViolations(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(violations) != 0 {
		t.Errorf("expected no violations for archived profile, got %v", violations)
	}
}

func TestListViolations_EmptyTenantIsNoOp(t *testing.T) {
	svc := NewService(newFakeRepo())
	violations, err := svc.ListViolations(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(violations) != 0 {
		t.Errorf("expected empty, got %v", violations)
	}
}

// --- EnforcePolicy ---

func TestEnforcePolicy_LogsViolations(t *testing.T) {
	repo := newFakeRepo()
	core, logs := observer.New(zapcore.WarnLevel)
	logger := zap.New(core)
	svc := NewService(repo).WithLogger(logger)

	// Active release without merge targets → 1 violation.
	rel := makeBranchProfile("p1", "release/1.0", models.BranchRelease, models.BranchStatusActive)
	repo.CreateBranchProfile(context.Background(), rel)

	if err := svc.EnforcePolicy(context.Background(), "t1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if logs.Len() != 1 {
		t.Fatalf("expected 1 warn log, got %d", logs.Len())
	}
	entry := logs.All()[0]
	if entry.Level != zapcore.WarnLevel {
		t.Errorf("expected Warn, got %s", entry.Level)
	}
	// Fields should include count and violations.
	foundCount, foundViolations := false, false
	for _, f := range entry.Context {
		if f.Key == "count" && f.Integer == 1 {
			foundCount = true
		}
		if f.Key == "violations" {
			foundViolations = true
		}
	}
	if !foundCount {
		t.Error("expected count=1 field")
	}
	if !foundViolations {
		t.Error("expected violations field")
	}
}

func TestEnforcePolicy_SilentWhenNoViolations(t *testing.T) {
	repo := newFakeRepo()
	core, logs := observer.New(zapcore.DebugLevel)
	logger := zap.New(core)
	svc := NewService(repo).WithLogger(logger)

	// Healthy main branch.
	main := makeBranchProfile("p1", "main", models.BranchMain, models.BranchStatusActive)
	repo.CreateBranchProfile(context.Background(), main)

	if err := svc.EnforcePolicy(context.Background(), "t1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if logs.Len() != 0 {
		t.Errorf("expected no logs, got %d", logs.Len())
	}
}

func TestEnforcePolicy_NilLoggerIsNoOp(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo) // no logger
	rel := makeBranchProfile("p1", "release/1.0", models.BranchRelease, models.BranchStatusActive)
	repo.CreateBranchProfile(context.Background(), rel)

	if err := svc.EnforcePolicy(context.Background(), "t1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// --- GetStats ---

func TestGetStats_AggregatesAllEntities(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	// 2 active profiles + 1 archived.
	repo.CreateBranchProfile(context.Background(), makeBranchProfile("p1", "main", models.BranchMain, models.BranchStatusActive))
	repo.CreateBranchProfile(context.Background(), makeBranchProfile("p2", "release/1.0", models.BranchRelease, models.BranchStatusActive))
	repo.CreateBranchProfile(context.Background(), makeBranchProfile("p3", "release/0.9", models.BranchRelease, models.BranchStatusArchived))

	// 3 artifacts, 2 signed.
	repo.CreateBuildArtifact(context.Background(), makeArtifact("a1", "p1", true))
	repo.CreateBuildArtifact(context.Background(), makeArtifact("a2", "p2", true))
	repo.CreateBuildArtifact(context.Background(), makeArtifact("a3", "p1", false))

	// 2 sync policies.
	repo.CreateSyncPolicy(context.Background(), &models.SyncPolicy{ID: "s1", TenantID: "t1"})
	repo.CreateSyncPolicy(context.Background(), &models.SyncPolicy{ID: "s2", TenantID: "t1"})

	// 4 deploy events: 2 success, 1 failed, 1 rolled-back.
	repo.CreateDeployEvent(context.Background(), &models.DeployEvent{ID: "e1", TenantID: "t1", Outcome: models.DeployOutcomeSuccess})
	repo.CreateDeployEvent(context.Background(), &models.DeployEvent{ID: "e2", TenantID: "t1", Outcome: models.DeployOutcomeSuccess})
	repo.CreateDeployEvent(context.Background(), &models.DeployEvent{ID: "e3", TenantID: "t1", Outcome: models.DeployOutcomeFailed})
	repo.CreateDeployEvent(context.Background(), &models.DeployEvent{ID: "e4", TenantID: "t1", Outcome: models.DeployOutcomeRolledBack})

	stats, err := svc.GetStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := map[string]int{
		"totalProfiles":     3,
		"activeProfiles":    2,
		"totalArtifacts":    3,
		"signedArtifacts":   2,
		"totalSyncPolicies": 2,
		"totalDeployEvents": 4,
		"successfulDeploys": 2,
		"failedDeploys":     1,
	}
	for k, v := range want {
		if got := stats[k]; got != v {
			t.Errorf("%s = %v, want %d", k, got, v)
		}
	}
}

func TestGetStats_EmptyTenantReturnsEmptyMap(t *testing.T) {
	svc := NewService(newFakeRepo())
	stats, err := svc.GetStats(context.Background(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(stats) != 0 {
		t.Errorf("expected empty map, got %v", stats)
	}
}

func TestGetStats_EmptyRepoYieldsZeroCounts(t *testing.T) {
	svc := NewService(newFakeRepo())
	stats, err := svc.GetStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(stats) == 0 {
		t.Fatal("expected non-empty stats map")
	}
	for k, v := range stats {
		if v != 0 {
			t.Errorf("%s = %v, want 0", k, v)
		}
	}
}
