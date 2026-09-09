package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/branch-policy/models"
)

// fakeRepo is an in-memory RepositoryInterface for service tests.
type fakeRepo struct {
	branchProfiles    map[string]*models.BranchProfile
	artifacts         map[string]*models.BuildArtifact
	namespaceBindings map[string]*models.NamespaceBinding
	syncPolicies      map[string]*models.SyncPolicy
	syncRunLogs       []models.SyncRunLog
	deployEvents      map[string]*models.DeployEvent
	mergePreviews     map[string]*models.MergePreview
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		branchProfiles:    make(map[string]*models.BranchProfile),
		artifacts:         make(map[string]*models.BuildArtifact),
		namespaceBindings: make(map[string]*models.NamespaceBinding),
		syncPolicies:      make(map[string]*models.SyncPolicy),
		deployEvents:      make(map[string]*models.DeployEvent),
		mergePreviews:     make(map[string]*models.MergePreview),
	}
}

func (f *fakeRepo) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return &models.Record{}, nil
}

func (f *fakeRepo) Delete(ctx context.Context, tenantID, id string) error { return nil }

func (f *fakeRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return nil, nil
}

func (f *fakeRepo) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return []models.Record{}, nil
}

func (f *fakeRepo) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return &models.Record{}, nil
}

func (f *fakeRepo) CreateBranchProfile(ctx context.Context, p *models.BranchProfile) error {
	if p.ID == "" {
		return errors.New("id required")
	}
	cp := *p
	f.branchProfiles[p.ID] = &cp
	return nil
}

func (f *fakeRepo) GetBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error) {
	p, ok := f.branchProfiles[id]
	if !ok {
		return nil, nil
	}
	cp := *p
	return &cp, nil
}

func (f *fakeRepo) ListBranchProfiles(ctx context.Context, tenantID string, q models.BranchProfileQuery) ([]models.BranchProfile, error) {
	out := make([]models.BranchProfile, 0, len(f.branchProfiles))
	for _, p := range f.branchProfiles {
		if p.TenantID != tenantID {
			continue
		}
		if q.Status != nil && *q.Status != p.Status {
			continue
		}
		if q.Semantic != nil && *q.Semantic != p.Semantic {
			continue
		}
		if q.RepoID != nil && *q.RepoID != p.RepoID {
			continue
		}
		if q.OwnerID != nil && *q.OwnerID != p.OwnerID {
			continue
		}
		out = append(out, *p)
	}
	return out, nil
}

func (f *fakeRepo) UpdateBranchProfile(ctx context.Context, tenantID, id string, p *models.BranchProfile) (*models.BranchProfile, error) {
	cp := *p
	f.branchProfiles[id] = &cp
	return &cp, nil
}

func (f *fakeRepo) CreateBuildArtifact(ctx context.Context, a *models.BuildArtifact) error {
	if a.ID == "" {
		return errors.New("id required")
	}
	cp := *a
	f.artifacts[a.ID] = &cp
	return nil
}

func (f *fakeRepo) GetBuildArtifact(ctx context.Context, tenantID, id string) (*models.BuildArtifact, error) {
	a, ok := f.artifacts[id]
	if !ok {
		return nil, nil
	}
	cp := *a
	return &cp, nil
}

func (f *fakeRepo) ListBuildArtifacts(ctx context.Context, tenantID string, q models.ArtifactQuery) ([]models.BuildArtifact, error) {
	out := make([]models.BuildArtifact, 0, len(f.artifacts))
	for _, a := range f.artifacts {
		if a.TenantID != tenantID {
			continue
		}
		if q.BranchProfileID != nil && *q.BranchProfileID != a.BranchProfileID {
			continue
		}
		if q.Branch != nil && *q.Branch != a.Branch {
			continue
		}
		if q.CommitSHA != nil && *q.CommitSHA != a.CommitSHA {
			continue
		}
		if q.Status != nil && *q.Status != a.Status {
			continue
		}
		if q.SignatureValid != nil && *q.SignatureValid != a.SignatureValid {
			continue
		}
		out = append(out, *a)
	}
	return out, nil
}

func (f *fakeRepo) UpdateBuildArtifact(ctx context.Context, tenantID, id string, a *models.BuildArtifact) (*models.BuildArtifact, error) {
	cp := *a
	f.artifacts[id] = &cp
	return &cp, nil
}

// --- P0-MB Phase 2 fakeRepo methods (namespace_bindings) ---

func (f *fakeRepo) CreateNamespaceBinding(ctx context.Context, b *models.NamespaceBinding) error {
	if b.ID == "" {
		return errors.New("id required")
	}
	cp := *b
	f.namespaceBindings[b.ID] = &cp
	return nil
}

func (f *fakeRepo) GetNamespaceBinding(ctx context.Context, tenantID, id string) (*models.NamespaceBinding, error) {
	b, ok := f.namespaceBindings[id]
	if !ok {
		return nil, nil
	}
	cp := *b
	return &cp, nil
}

func (f *fakeRepo) GetNamespaceBindingByBranchEnv(ctx context.Context, tenantID, branchProfileID, envName string) (*models.NamespaceBinding, error) {
	for _, b := range f.namespaceBindings {
		if b.TenantID != tenantID {
			continue
		}
		if b.BranchProfileID == branchProfileID && b.EnvName == envName {
			cp := *b
			return &cp, nil
		}
	}
	return nil, nil
}

func (f *fakeRepo) ListNamespaceBindings(ctx context.Context, tenantID string, q models.NamespaceBindingQuery) ([]models.NamespaceBinding, error) {
	out := make([]models.NamespaceBinding, 0, len(f.namespaceBindings))
	for _, b := range f.namespaceBindings {
		if b.TenantID != tenantID {
			continue
		}
		if q.BranchProfileID != nil && *q.BranchProfileID != b.BranchProfileID {
			continue
		}
		if q.EnvName != nil && *q.EnvName != b.EnvName {
			continue
		}
		out = append(out, *b)
	}
	return out, nil
}

func (f *fakeRepo) DeleteNamespaceBinding(ctx context.Context, tenantID, id string) error {
	delete(f.namespaceBindings, id)
	return nil
}

// --- P0-MB Phase 3 fakeRepo methods (sync_policies + sync_run_logs) ---

func (f *fakeRepo) CreateSyncPolicy(ctx context.Context, p *models.SyncPolicy) error {
	if p.ID == "" {
		return errors.New("id required")
	}
	cp := *p
	f.syncPolicies[p.ID] = &cp
	return nil
}

func (f *fakeRepo) GetSyncPolicy(ctx context.Context, tenantID, id string) (*models.SyncPolicy, error) {
	p, ok := f.syncPolicies[id]
	if !ok {
		return nil, nil
	}
	cp := *p
	return &cp, nil
}

func (f *fakeRepo) ListSyncPolicies(ctx context.Context, tenantID string, q models.SyncPolicyQuery) ([]models.SyncPolicy, error) {
	out := make([]models.SyncPolicy, 0, len(f.syncPolicies))
	for _, p := range f.syncPolicies {
		if p.TenantID != tenantID {
			continue
		}
		if q.Enabled != nil && *q.Enabled != p.Enabled {
			continue
		}
		if q.Frequency != nil && *q.Frequency != p.Frequency {
			continue
		}
		if q.Strategy != nil && *q.Strategy != p.Strategy {
			continue
		}
		if q.SourceBranch != nil && *q.SourceBranch != p.SourceBranch {
			continue
		}
		if q.AutoResolve != nil && *q.AutoResolve != p.AutoResolve {
			continue
		}
		out = append(out, *p)
	}
	return out, nil
}

func (f *fakeRepo) UpdateSyncPolicy(ctx context.Context, tenantID, id string, p *models.SyncPolicy) (*models.SyncPolicy, error) {
	cp := *p
	f.syncPolicies[id] = &cp
	out := *p
	return &out, nil
}

func (f *fakeRepo) DeleteSyncPolicy(ctx context.Context, tenantID, id string) error {
	delete(f.syncPolicies, id)
	return nil
}

func (f *fakeRepo) CreateSyncRunLog(ctx context.Context, l *models.SyncRunLog) error {
	cp := *l
	f.syncRunLogs = append(f.syncRunLogs, cp)
	return nil
}

func (f *fakeRepo) UpdateSyncRunLog(ctx context.Context, tenantID, id string, l *models.SyncRunLog) (*models.SyncRunLog, error) {
	cp := *l
	return &cp, nil
}

func (f *fakeRepo) ListSyncRunLogs(ctx context.Context, tenantID string, q models.SyncRunLogQuery) ([]models.SyncRunLog, error) {
	out := make([]models.SyncRunLog, 0, len(f.syncRunLogs))
	for _, l := range f.syncRunLogs {
		if l.TenantID != tenantID {
			continue
		}
		if q.PolicyID != nil && *q.PolicyID != l.PolicyID {
			continue
		}
		if q.Status != nil && *q.Status != l.Status {
			continue
		}
		out = append(out, l)
	}
	if q.Limit > 0 && len(out) > q.Limit {
		out = out[:q.Limit]
	}
	return out, nil
}

// --- P0-MB Phase 4 fakeRepo methods ---

func (f *fakeRepo) CreateDeployEvent(ctx context.Context, evt *models.DeployEvent) error {
	if evt.ID == "" {
		return errors.New("id required")
	}
	cp := *evt
	f.deployEvents[evt.ID] = &cp
	return nil
}

func (f *fakeRepo) GetDeployEvent(ctx context.Context, tenantID, id string) (*models.DeployEvent, error) {
	e, ok := f.deployEvents[id]
	if !ok {
		return nil, nil
	}
	if e.TenantID != tenantID {
		return nil, nil
	}
	cp := *e
	return &cp, nil
}

func (f *fakeRepo) UpdateDeployEvent(ctx context.Context, tenantID, id string, evt *models.DeployEvent) (*models.DeployEvent, error) {
	e, ok := f.deployEvents[id]
	if !ok {
		return nil, nil
	}
	if e.TenantID != tenantID {
		return nil, nil
	}
	cp := *evt
	f.deployEvents[id] = &cp
	out := *evt
	return &out, nil
}

func (f *fakeRepo) ListDeployEvents(ctx context.Context, tenantID string, q models.DeployEventQuery) ([]models.DeployEvent, error) {
	out := make([]models.DeployEvent, 0, len(f.deployEvents))
	for _, e := range f.deployEvents {
		if e.TenantID != tenantID {
			continue
		}
		if q.Branch != nil && *q.Branch != e.Branch {
			continue
		}
		if q.Env != nil && *q.Env != e.Env {
			continue
		}
		if q.ActorID != nil && *q.ActorID != e.ActorID {
			continue
		}
		if q.ApprovalID != nil && *q.ApprovalID != e.ApprovalID {
			continue
		}
		if q.Outcome != nil && *q.Outcome != e.Outcome {
			continue
		}
		if q.From != nil && e.StartedAt.Before(*q.From) {
			continue
		}
		if q.To != nil && e.StartedAt.After(*q.To) {
			continue
		}
		out = append(out, *e)
	}
	if q.Limit > 0 && len(out) > q.Limit {
		out = out[:q.Limit]
	}
	return out, nil
}

func (f *fakeRepo) ListDeployEventsByBranch(ctx context.Context, tenantID, branch string, limit int) ([]models.DeployEvent, error) {
	b := branch
	q := models.DeployEventQuery{Branch: &b, Limit: limit}
	return f.ListDeployEvents(ctx, tenantID, q)
}

func (f *fakeRepo) ListDeployEventsByEnv(ctx context.Context, tenantID, env string, limit int) ([]models.DeployEvent, error) {
	e := env
	q := models.DeployEventQuery{Env: &e, Limit: limit}
	return f.ListDeployEvents(ctx, tenantID, q)
}

func (f *fakeRepo) ListDeployEventsByActor(ctx context.Context, tenantID, actorID string, limit int) ([]models.DeployEvent, error) {
	a := actorID
	q := models.DeployEventQuery{ActorID: &a, Limit: limit}
	return f.ListDeployEvents(ctx, tenantID, q)
}

// --- P0-MB Phase 5 fakeRepo methods ---

func (f *fakeRepo) CreateMergePreview(ctx context.Context, p *models.MergePreview) error {
	if p == nil {
		return fmt.Errorf("nil preview")
	}
	cp := *p
	f.mergePreviews[p.ID] = &cp
	return nil
}

func (f *fakeRepo) GetMergePreview(ctx context.Context, tenantID, id string) (*models.MergePreview, error) {
	p, ok := f.mergePreviews[id]
	if !ok || p.TenantID != tenantID {
		return nil, errors.New("sentinel: not found")
	}
	cp := *p
	return &cp, nil
}

func (f *fakeRepo) ListMergePreviews(ctx context.Context, tenantID string, limit int) ([]models.MergePreview, error) {
	out := make([]models.MergePreview, 0, len(f.mergePreviews))
	for _, p := range f.mergePreviews {
		if p.TenantID != tenantID {
			continue
		}
		out = append(out, *p)
	}
	// Newest first.
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[j].PreviewedAt.After(out[i].PreviewedAt) {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

// TestBP_Create_Validation verifies branch-profile create rejects malformed input.
func TestBP_Create_Validation(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	cases := []struct {
		name string
		req  *models.CreateBranchProfileRequest
		want string // expected error substring
	}{
		{"empty-repo", &models.CreateBranchProfileRequest{Name: "main", Semantic: models.BranchMain, OwnerID: "u1"}, "repoId"},
		{"empty-name", &models.CreateBranchProfileRequest{RepoID: "r1", Semantic: models.BranchMain, OwnerID: "u1"}, "name"},
		{"empty-owner", &models.CreateBranchProfileRequest{RepoID: "r1", Name: "main", Semantic: models.BranchMain}, "ownerId"},
		{"bad-semantic", &models.CreateBranchProfileRequest{RepoID: "r1", Name: "main", Semantic: "weird", OwnerID: "u1"}, "semantic"},
		{"main-name-mismatch", &models.CreateBranchProfileRequest{RepoID: "r1", Name: "master", Semantic: models.BranchMain, OwnerID: "u1"}, "exactly \"main\""},
		{"release-missing-merge", &models.CreateBranchProfileRequest{RepoID: "r1", Name: "release/x", Semantic: models.BranchRelease, OwnerID: "u1"}, "mergeTargets"},
		{"lts-missing-until", &models.CreateBranchProfileRequest{RepoID: "r1", Name: "lts/2026", Semantic: models.BranchLTS, OwnerID: "u1", MergeTargets: []string{"main"}}, "ltsUntil"},
		{"name-mismatch-prefix", &models.CreateBranchProfileRequest{RepoID: "r1", Name: "master", Semantic: models.BranchRelease, OwnerID: "u1", MergeTargets: []string{"main"}}, "must start with"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := svc.CreateBranchProfile(ctx, "t1", c.req)
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", c.want)
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Fatalf("error %q does not contain %q", err.Error(), c.want)
			}
		})
	}
}

func TestBP_Create_Success(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	req := &models.CreateBranchProfileRequest{
		RepoID:        "repo-1",
		Name:          "release/enterprise-2026",
		Semantic:      models.BranchRelease,
		OwnerID:       "owner-1",
		MergeTargets:  []string{"main"},
		MergeSources:  []string{"feature/x"},
		ProtectedEnvs: []string{"prod", "staging"},
	}
	p, err := svc.CreateBranchProfile(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.ID == "" {
		t.Fatal("id must be non-empty")
	}
	if p.Status != models.BranchStatusActive {
		t.Fatalf("status = %q, want active", p.Status)
	}
	if p.CreatedAt.IsZero() {
		t.Fatal("createdAt must be set")
	}
}

func TestBP_LTS_RequiresUntilDate(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	req := &models.CreateBranchProfileRequest{
		RepoID:       "repo-1",
		Name:         "lts/2026",
		Semantic:     models.BranchLTS,
		OwnerID:      "owner-1",
		MergeTargets: []string{"main"},
	}
	_, err := svc.CreateBranchProfile(ctx, "t1", req)
	if err == nil {
		t.Fatal("expected error for missing LTSUntil")
	}
	if !strings.Contains(err.Error(), "ltsUntil") {
		t.Fatalf("err = %q, want ltsUntil", err.Error())
	}
}

func TestBP_LTS_FutureUntilOK(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	future := time.Now().Add(365 * 24 * time.Hour)
	req := &models.CreateBranchProfileRequest{
		RepoID:       "repo-1",
		Name:         "lts/2026",
		Semantic:     models.BranchLTS,
		OwnerID:      "owner-1",
		MergeTargets: []string{"main"},
		LTSUntil:     &future,
	}
	p, err := svc.CreateBranchProfile(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.LTSUntil == nil {
		t.Fatal("LTSUntil must be persisted")
	}
}

func TestBP_Name_MustMatchSemanticPrefix(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	future := time.Now().Add(365 * 24 * time.Hour)
	cases := []struct {
		name     string
		semantic models.BranchSemantic
	}{
		{"release/x", models.BranchRelease},
		{"hotfix/critical", models.BranchHotfix},
		{"lts/2026", models.BranchLTS},
		{"custom/acme-corp", models.BranchCustomerCustom},
	}
	for _, c := range cases {
		t.Run(string(c.semantic), func(t *testing.T) {
			req := &models.CreateBranchProfileRequest{
				RepoID:       "repo-1",
				Name:         c.name,
				Semantic:     c.semantic,
				OwnerID:      "u1",
				MergeTargets: []string{"main"},
				LTSUntil:     &future,
			}
			p, err := svc.CreateBranchProfile(ctx, "t1", req)
			if err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if p.Name != c.name {
				t.Fatalf("name = %q, want %q", p.Name, c.name)
			}
		})
	}
}

func TestBP_Update_NameSemanticMismatch(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	// Create a release profile, then try to rename to "master".
	req := &models.CreateBranchProfileRequest{
		RepoID:       "repo-1",
		Name:         "release/x",
		Semantic:     models.BranchRelease,
		OwnerID:      "u1",
		MergeTargets: []string{"main"},
	}
	p, _ := svc.CreateBranchProfile(ctx, "t1", req)
	badName := "master"
	_, err := svc.UpdateBranchProfile(ctx, "t1", p.ID, &models.UpdateBranchProfileRequest{Name: &badName})
	if err == nil {
		t.Fatal("expected error on semantic/name mismatch")
	}
}

func TestBP_Archive_CascadesRequiresDeprecation(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	req := &models.CreateBranchProfileRequest{
		RepoID:       "repo-1",
		Name:         "release/x",
		Semantic:     models.BranchRelease,
		OwnerID:      "u1",
		MergeTargets: []string{"main"},
	}
	p, _ := svc.CreateBranchProfile(ctx, "t1", req)
	// Register an active artifact first.
	art, err := svc.RegisterBuildArtifact(ctx, "t1", &models.RegisterArtifactRequest{
		BranchProfileID: p.ID,
		Branch:          "release/x",
		CommitSHA:       strings.Repeat("a", 40),
		ImageDigest:     "sha256:" + strings.Repeat("b", 64),
		ImageTag:        "v1",
		ImageRepo:       "reg/app",
		BuildPipelineID: "pipe-1",
		TargetEnvs:      []string{"staging"},
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	// Archive should refuse — active artifacts exist.
	_, err = svc.ArchiveBranchProfile(ctx, "t1", p.ID)
	if err == nil {
		t.Fatal("expected error when artifacts exist")
	}
	if !strings.Contains(err.Error(), "active artifacts") {
		t.Fatalf("err = %q", err.Error())
	}
	// Deprecate the artifact and try again.
	if _, err := svc.DeprecateBuildArtifact(ctx, "t1", art.ID, "superseded"); err != nil {
		t.Fatalf("deprecate: %v", err)
	}
	p2, err := svc.ArchiveBranchProfile(ctx, "t1", p.ID)
	if err != nil {
		t.Fatalf("archive after deprecate: %v", err)
	}
	if p2.Status != models.BranchStatusArchived {
		t.Fatalf("status = %q, want archived", p2.Status)
	}
	if p2.ArchivedAt == nil {
		t.Fatal("archivedAt must be set")
	}
}

func TestBP_Activate_ExpiredLTSBlocked(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	past := time.Now().Add(-24 * time.Hour)
	// Directly insert into the fake repo to bypass validation.
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-expired"] = &models.BranchProfile{
		ID:           "bp-expired",
		TenantID:     "t1",
		RepoID:       "repo-1",
		Name:         "lts/2026",
		Semantic:     models.BranchLTS,
		OwnerID:      "u1",
		MergeTargets: []string{"main"},
		Status:       models.BranchStatusArchived,
		LTSUntil:     &past,
	}
	_, err := svc.ActivateBranchProfile(ctx, "t1", "bp-expired")
	if err == nil {
		t.Fatal("expected error for expired LTS")
	}
	if !strings.Contains(err.Error(), "expired") {
		t.Fatalf("err = %q", err.Error())
	}
}

func TestBP_Update_ArchivedRejected(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-arch"] = &models.BranchProfile{
		ID:       "bp-arch",
		TenantID: "t1",
		Name:     "main",
		Semantic: models.BranchMain,
		OwnerID:  "u1",
		Status:   models.BranchStatusArchived,
	}
	desc := "new desc"
	_, err := svc.UpdateBranchProfile(ctx, "t1", "bp-arch", &models.UpdateBranchProfileRequest{Description: &desc})
	if err == nil {
		t.Fatal("expected error for updating archived profile")
	}
	if !strings.Contains(err.Error(), "archived") {
		t.Fatalf("err = %q", err.Error())
	}
}

func TestBP_NotFound(t *testing.T) {
	svc := NewService(newFakeRepo())
	_, err := svc.GetBranchProfile(context.Background(), "t1", "nope")
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrBranchProfileNotFound) {
		t.Fatalf("err = %v, want ErrBranchProfileNotFound", err)
	}
}

// --- BuildArtifact tests ---

func TestBA_Register_Success(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{
		ID:           "bp-1",
		TenantID:     "t1",
		Name:         "release/x",
		Semantic:     models.BranchRelease,
		OwnerID:      "u1",
		MergeTargets: []string{"main"},
		Status:       models.BranchStatusActive,
	}
	art, err := svc.RegisterBuildArtifact(ctx, "t1", &models.RegisterArtifactRequest{
		BranchProfileID: "bp-1",
		Branch:          "release/x",
		CommitSHA:       strings.Repeat("a", 40),
		ImageDigest:     "sha256:" + strings.Repeat("b", 64),
		ImageTag:        "v1",
		ImageRepo:       "reg/app",
		BuildPipelineID: "pipe-1",
		TargetEnvs:      []string{"staging", "prod"},
		SignedBy:        "cosign",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if art.ID == "" {
		t.Fatal("id must be set")
	}
	if !art.SignatureValid {
		t.Fatal("signatureValid should be true when SignedBy is set")
	}
	if art.Status != models.ArtifactStatusActive {
		t.Fatalf("status = %q", art.Status)
	}
}

func TestBA_Digest_MustBeSha256(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{
		ID:       "bp-1",
		TenantID: "t1",
		Name:     "release/x",
		Semantic: models.BranchRelease,
		OwnerID:  "u1",
		MergeTargets: []string{"main"},
		Status: models.BranchStatusActive,
	}
	badDigests := []string{"md5:abc", "sha256:zzzz", "notadigest", "", "sha256:" + strings.Repeat("a", 63)}
	for _, d := range badDigests {
		_, err := svc.RegisterBuildArtifact(ctx, "t1", &models.RegisterArtifactRequest{
			BranchProfileID: "bp-1",
			Branch:          "release/x",
			CommitSHA:       strings.Repeat("a", 40),
			ImageDigest:     d,
			ImageTag:        "v1",
			ImageRepo:       "reg/app",
			BuildPipelineID: "pipe-1",
			TargetEnvs:      []string{"staging"},
		})
		if err == nil {
			t.Fatalf("expected error for digest %q", d)
		}
	}
}

func TestBA_Digest_AutoPromotesBareHex(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{
		ID:       "bp-1",
		TenantID: "t1",
		Name:     "release/x",
		Semantic: models.BranchRelease,
		OwnerID:  "u1",
		MergeTargets: []string{"main"},
		Status: models.BranchStatusActive,
	}
	bare := strings.Repeat("C", 64) // uppercase — should be normalized
	art, err := svc.RegisterBuildArtifact(ctx, "t1", &models.RegisterArtifactRequest{
		BranchProfileID: "bp-1",
		Branch:          "release/x",
		CommitSHA:       strings.Repeat("a", 40),
		ImageDigest:     bare,
		ImageTag:        "v1",
		ImageRepo:       "reg/app",
		BuildPipelineID: "pipe-1",
		TargetEnvs:      []string{"staging"},
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	want := "sha256:" + strings.Repeat("c", 64)
	if art.ImageDigest != want {
		t.Fatalf("digest = %q, want %q", art.ImageDigest, want)
	}
}

func TestBA_CommitSHA_MustBe40Hex(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{
		ID:       "bp-1",
		TenantID: "t1",
		Name:     "release/x",
		Semantic: models.BranchRelease,
		OwnerID:  "u1",
		MergeTargets: []string{"main"},
		Status: models.BranchStatusActive,
	}
	badSHAs := []string{"abc", strings.Repeat("a", 39), strings.Repeat("a", 41), strings.Repeat("g", 40)}
	for _, s := range badSHAs {
		_, err := svc.RegisterBuildArtifact(ctx, "t1", &models.RegisterArtifactRequest{
			BranchProfileID: "bp-1",
			Branch:          "release/x",
			CommitSHA:       s,
			ImageDigest:     "sha256:" + strings.Repeat("b", 64),
			ImageTag:        "v1",
			ImageRepo:       "reg/app",
			BuildPipelineID: "pipe-1",
			TargetEnvs:      []string{"staging"},
		})
		if err == nil {
			t.Fatalf("expected error for sha %q", s)
		}
	}
}

func TestBA_TargetEnvs_ValidatesNames(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{
		ID:       "bp-1",
		TenantID: "t1",
		Name:     "release/x",
		Semantic: models.BranchRelease,
		OwnerID:  "u1",
		MergeTargets: []string{"main"},
		Status: models.BranchStatusActive,
	}
	for _, env := range []string{"UPPER", "has spaces", "-bad", "a" + strings.Repeat("b", 65), ""} {
		_, err := svc.RegisterBuildArtifact(ctx, "t1", &models.RegisterArtifactRequest{
			BranchProfileID: "bp-1",
			Branch:          "release/x",
			CommitSHA:       strings.Repeat("a", 40),
			ImageDigest:     "sha256:" + strings.Repeat("b", 64),
			ImageTag:        "v1",
			ImageRepo:       "reg/app",
			BuildPipelineID: "pipe-1",
			TargetEnvs:      []string{env},
		})
		if err == nil {
			t.Fatalf("expected error for env %q", env)
		}
	}
}

func TestBA_Register_OnInactiveProfileRejects(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-arch"] = &models.BranchProfile{
		ID:       "bp-arch",
		TenantID: "t1",
		Name:     "release/x",
		Semantic: models.BranchRelease,
		OwnerID:  "u1",
		MergeTargets: []string{"main"},
		Status: models.BranchStatusArchived,
	}
	_, err := svc.RegisterBuildArtifact(ctx, "t1", &models.RegisterArtifactRequest{
		BranchProfileID: "bp-arch",
		Branch:          "release/x",
		CommitSHA:       strings.Repeat("a", 40),
		ImageDigest:     "sha256:" + strings.Repeat("b", 64),
		ImageTag:        "v1",
		ImageRepo:       "reg/app",
		BuildPipelineID: "pipe-1",
		TargetEnvs:      []string{"staging"},
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "archived") {
		t.Fatalf("err = %q", err.Error())
	}
}

func TestBA_VerifySignature_Unsigned(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.artifacts["ba-1"] = &models.BuildArtifact{
		ID:         "ba-1",
		TenantID:   "t1",
		BranchProfileID: "bp-1",
		SignedBy: "",
		Status: models.ArtifactStatusActive,
	}
	res, err := svc.VerifyBuildArtifactSignature(ctx, "t1", "ba-1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Valid {
		t.Fatal("unsigned should not be valid")
	}
	if res.Reason != "unsigned artifact" {
		t.Fatalf("reason = %q", res.Reason)
	}
	// Check the stored flag was downgraded.
	stored, _ := svc.GetBuildArtifact(ctx, "t1", "ba-1")
	if stored.SignatureValid {
		t.Fatal("stored SignatureValid should be false")
	}
}

func TestBA_VerifySignature_Signed(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.artifacts["ba-1"] = &models.BuildArtifact{
		ID:         "ba-1",
		TenantID:   "t1",
		SignedBy:   "cosign",
		Status:     models.ArtifactStatusActive,
	}
	res, err := svc.VerifyBuildArtifactSignature(ctx, "t1", "ba-1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !res.Valid {
		t.Fatalf("signed should be valid, got %+v", res)
	}
	if !strings.Contains(res.Reason, "trusted-signer") {
		t.Fatalf("reason = %q", res.Reason)
	}
}

func TestBA_Deprecate_RequiresReason(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.artifacts["ba-1"] = &models.BuildArtifact{
		ID:     "ba-1",
		TenantID: "t1",
		Status: models.ArtifactStatusActive,
	}
	_, err := svc.DeprecateBuildArtifact(ctx, "t1", "ba-1", "   ")
	if err == nil {
		t.Fatal("expected error for empty reason")
	}
}

func TestBA_Deprecate_DoubleRejected(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	now := time.Now()
	repo.artifacts["ba-1"] = &models.BuildArtifact{
		ID:             "ba-1",
		TenantID:       "t1",
		Status:         models.ArtifactStatusDeprecated,
		DeprecatedAt:   &now,
		DeprecatedReason: "already",
	}
	_, err := svc.DeprecateBuildArtifact(ctx, "t1", "ba-1", "again")
	if err == nil {
		t.Fatal("expected error for double deprecate")
	}
}

func TestBA_Deprecate_Success(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.artifacts["ba-1"] = &models.BuildArtifact{
		ID:     "ba-1",
		TenantID: "t1",
		Status: models.ArtifactStatusActive,
	}
	a, err := svc.DeprecateBuildArtifact(ctx, "t1", "ba-1", "superseded by v2")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if a.Status != models.ArtifactStatusDeprecated {
		t.Fatalf("status = %q", a.Status)
	}
	if a.DeprecatedAt == nil || a.DeprecatedReason != "superseded by v2" {
		t.Fatalf("deprecate fields: %+v", a)
	}
}

func TestBA_List_Filters(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.artifacts["ba-1"] = &models.BuildArtifact{ID: "ba-1", TenantID: "t1", Branch: "b1", Status: models.ArtifactStatusActive, SignatureValid: true}
	repo.artifacts["ba-2"] = &models.BuildArtifact{ID: "ba-2", TenantID: "t1", Branch: "b2", Status: models.ArtifactStatusDeprecated, SignatureValid: false}
	active := models.ArtifactStatusActive
	out, err := svc.ListBuildArtifacts(ctx, "t1", models.ArtifactQuery{Status: &active})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 1 || out[0].ID != "ba-1" {
		t.Fatalf("got %+v", out)
	}
	wantValid := true
	out, err = svc.ListBuildArtifacts(ctx, "t1", models.ArtifactQuery{SignatureValid: &wantValid})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 1 || out[0].ID != "ba-1" {
		t.Fatalf("got %+v", out)
	}
	// Tenant isolation.
	out, err = svc.ListBuildArtifacts(ctx, "other", models.ArtifactQuery{})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 0 {
		t.Fatalf("expected 0 for other tenant, got %d", len(out))
	}
}

func TestBP_List_TenantIsolation(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{ID: "bp-1", TenantID: "t1", Status: models.BranchStatusActive}
	repo.branchProfiles["bp-2"] = &models.BranchProfile{ID: "bp-2", TenantID: "t2", Status: models.BranchStatusActive}
	out, err := svc.ListBranchProfiles(ctx, "t1", models.BranchProfileQuery{})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 1 || out[0].ID != "bp-1" {
		t.Fatalf("got %+v", out)
	}
}

// ============================================================================
// P0-MB Phase 2 — NamespaceBinding (L2) tests
// ============================================================================

func TestNS_BuildSlug(t *testing.T) {
	cases := []struct{ in, want string }{
		{"release/enterprise-2026", "release-enterprise-2026"},
		{"lts/2026", "lts-2026"},
		{"hotfix/v1.2.3", "hotfix-v1-2-3"},
		{"main", "main"},
		{"  feature/  new  widget  ", "feature-new-widget"},
		{"//", "custom"},
	}
	for _, c := range cases {
		got := buildSlug(c.in)
		if got != c.want {
			t.Fatalf("buildSlug(%q) = %q, want %q", c.in, got, c.want)
		}
	}
	// Length cap.
	long := strings.Repeat("a", 100)
	if got := buildSlug(long); len(got) > 59 {
		t.Fatalf("buildSlug length cap failed: got len=%d", len(got))
	}
}

func TestNS_Create_Validation(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{ID: "bp-1", TenantID: "t1", Name: "release/enterprise-2026", Semantic: models.BranchRelease, Status: models.BranchStatusActive, OwnerID: "u1", RepoID: "r1", MergeTargets: []string{"main"}}

	ctx := context.Background()
	cases := []struct {
		name string
		req  *models.CreateNamespaceRequest
		want string
	}{
		{"bad-env-upper", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "Prod", ImageTagPrefix: "myrepo/release-ent"}, "envName"},
		{"bad-env-long", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: strings.Repeat("a", 32), ImageTagPrefix: "myrepo/release-ent"}, "envName"},
		{"bad-image-tag", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "BAD!TAG"}, "imageTagPrefix"},
		{"bad-k8s-ns", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent", K8sNamespace: "my-ns"}, "k8sNamespace"},
		{"bad-config-ns", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent", ConfigNamespace: "orion/x"}, "configNamespace"},
		{"bad-db", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent", DBName: "orion-x"}, "dbName"},
		{"bad-mq", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent", MQTopicPrefix: "orion/whatever"}, "mqTopicPrefix"},
		{"bad-redis", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent", RedisKeyPrefix: "orion-x"}, "redisKeyPrefix"},
		{"missing-profile", &models.CreateNamespaceRequest{BranchProfileID: "nope", EnvName: "prod", ImageTagPrefix: "myrepo/x"}, "not found"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := svc.CreateNamespaceBinding(ctx, "t1", c.req)
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", c.want)
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Fatalf("error %q does not contain %q", err.Error(), c.want)
			}
		})
	}
}

func TestNS_Create_RejectsArchivedProfile(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-arch"] = &models.BranchProfile{ID: "bp-arch", TenantID: "t1", Name: "release/old", Semantic: models.BranchRelease, Status: models.BranchStatusArchived, OwnerID: "u1", RepoID: "r1", MergeTargets: []string{"main"}}
	_, err := svc.CreateNamespaceBinding(context.Background(), "t1", &models.CreateNamespaceRequest{
		BranchProfileID: "bp-arch", EnvName: "prod", ImageTagPrefix: "myrepo/release-old",
	})
	if err == nil {
		t.Fatalf("expected archived-profile error")
	}
	if !strings.Contains(err.Error(), "archived") {
		t.Fatalf("error %q does not mention archived", err.Error())
	}
}

func TestNS_Create_AutoFillsOptionalFields(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{ID: "bp-1", TenantID: "t1", Name: "release/enterprise-2026", Semantic: models.BranchRelease, Status: models.BranchStatusActive, OwnerID: "u1", RepoID: "r1", MergeTargets: []string{"main"}}

	b, err := svc.CreateNamespaceBinding(context.Background(), "t1", &models.CreateNamespaceRequest{
		BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if b.K8sNamespace != "orion-release-enterprise-2026" {
		t.Fatalf("k8s=%q", b.K8sNamespace)
	}
	if b.ConfigNamespace != "nacos/orion-release-enterprise-2026" {
		t.Fatalf("config=%q", b.ConfigNamespace)
	}
	if b.DBName != "orion_release-enterprise-2026" {
		t.Fatalf("db=%q", b.DBName)
	}
	if b.MQTopicPrefix != "orion-release-enterprise-2026-*" {
		t.Fatalf("mq=%q", b.MQTopicPrefix)
	}
	if b.RedisKeyPrefix != "orion:release-enterprise-2026:*" {
		t.Fatalf("redis=%q", b.RedisKeyPrefix)
	}
	if !strings.HasPrefix(b.ID, "nb-") {
		t.Fatalf("id=%q missing nb- prefix", b.ID)
	}
}

func TestNS_Create_EnforcesUniqueness(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{ID: "bp-1", TenantID: "t1", Name: "release/ent", Semantic: models.BranchRelease, Status: models.BranchStatusActive, OwnerID: "u1", RepoID: "r1", MergeTargets: []string{"main"}}

	req := &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent"}
	if _, err := svc.CreateNamespaceBinding(context.Background(), "t1", req); err != nil {
		t.Fatalf("first create failed: %v", err)
	}
	_, err := svc.CreateNamespaceBinding(context.Background(), "t1", req)
	if err == nil {
		t.Fatalf("expected uniqueness error")
	}
	if !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("error %q does not mention already exists", err.Error())
	}
}

func TestNS_List_And_Get_And_Delete(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{ID: "bp-1", TenantID: "t1", Name: "release/ent", Semantic: models.BranchRelease, Status: models.BranchStatusActive, OwnerID: "u1", RepoID: "r1", MergeTargets: []string{"main"}}
	ctx := context.Background()

	created, err := svc.CreateNamespaceBinding(ctx, "t1", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := svc.CreateNamespaceBinding(ctx, "t1", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "staging", ImageTagPrefix: "myrepo/release-ent"}); err != nil {
		t.Fatalf("create2: %v", err)
	}

	out, err := svc.ListNamespaceBindings(ctx, "t1", models.NamespaceBindingQuery{})
	if err != nil || len(out) != 2 {
		t.Fatalf("list err=%v len=%d", err, len(out))
	}
	byEnv := models.NamespaceBindingQuery{EnvName: &[]string{"prod"}[0]}
	out, err = svc.ListNamespaceBindings(ctx, "t1", byEnv)
	if err != nil || len(out) != 1 || out[0].EnvName != "prod" {
		t.Fatalf("filtered list err=%v out=%v", err, out)
	}

	got, err := svc.GetNamespaceBinding(ctx, "t1", created.ID)
	if err != nil || got == nil || got.EnvName != "prod" {
		t.Fatalf("get err=%v got=%v", err, got)
	}

	if err := svc.DeleteNamespaceBinding(ctx, "t1", created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := svc.GetNamespaceBinding(ctx, "t1", created.ID); err != nil {
		t.Fatalf("get-after-delete should return nil,nil; got err=%v", err)
	}
	out, _ = svc.ListNamespaceBindings(ctx, "t1", models.NamespaceBindingQuery{})
	if len(out) != 1 {
		t.Fatalf("post-delete list len=%d", len(out))
	}
}

func TestNS_Validate_AllRules(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{ID: "bp-1", TenantID: "t1", Name: "release/ent", Semantic: models.BranchRelease, Status: models.BranchStatusActive, OwnerID: "u1", RepoID: "r1", MergeTargets: []string{"main"}}
	ctx := context.Background()

	// No binding yet → binding check fails.
	res, err := svc.ValidateNamespaceBinding(ctx, "t1", "bp-1", "prod")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Valid {
		t.Fatalf("expected invalid with no binding")
	}
	var sawBinding bool
	for _, c := range res.Checks {
		if c.Field == "binding" {
			sawBinding = true
			if c.Valid {
				t.Fatalf("binding check should fail when no binding exists")
			}
		}
	}
	if !sawBinding {
		t.Fatalf("no binding check in result: %+v", res.Checks)
	}

	// Create a binding → all checks pass.
	if _, err := svc.CreateNamespaceBinding(ctx, "t1", &models.CreateNamespaceRequest{BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	res, err = svc.ValidateNamespaceBinding(ctx, "t1", "bp-1", "prod")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !res.Valid {
		t.Fatalf("expected valid: %+v", res.Checks)
	}
}

func TestNS_Validate_BadEnvFormat(t *testing.T) {
	svc := NewService(newFakeRepo())
	res, err := svc.ValidateNamespaceBinding(context.Background(), "t1", "bp-1", "BAD")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Valid {
		t.Fatalf("expected invalid for bad env format")
	}
	found := false
	for _, c := range res.Checks {
		if c.Field == "envName" && !c.Valid {
			found = true
		}
	}
	if !found {
		t.Fatalf("envName check should fail: %+v", res.Checks)
	}
}

func TestVerifyImageTagMatch_ExactMatch(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	repo.namespaceBindings["nb-1"] = &models.NamespaceBinding{ID: "nb-1", TenantID: "t1", BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent"}

	ok, err := svc.VerifyImageTagMatch(context.Background(), "t1", "bp-1", "prod", "myrepo/release-ent")
	if err != nil || !ok {
		t.Fatalf("expected ok=true got ok=%v err=%v", ok, err)
	}
}

func TestVerifyImageTagMatch_SuffixSlash(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	repo.namespaceBindings["nb-1"] = &models.NamespaceBinding{ID: "nb-1", TenantID: "t1", BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "myrepo/release-ent"}

	ok, err := svc.VerifyImageTagMatch(context.Background(), "t1", "bp-1", "prod", "myrepo/release-ent/abc123")
	if err != nil || !ok {
		t.Fatalf("expected ok=true for /suffix got ok=%v err=%v", ok, err)
	}
	// Prefix that looks like a partial name must not match.
	ok, err = svc.VerifyImageTagMatch(context.Background(), "t1", "bp-1", "prod", "myrepo/release-enterprise")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if ok {
		t.Fatalf("prefix substring should not match: tag=%q", "myrepo/release-enterprise")
	}
}

func TestVerifyImageTagMatch_SuffixDash(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	repo.namespaceBindings["nb-1"] = &models.NamespaceBinding{ID: "nb-1", TenantID: "t1", BranchProfileID: "bp-1", EnvName: "prod", ImageTagPrefix: "release-ent"}

	ok, err := svc.VerifyImageTagMatch(context.Background(), "t1", "bp-1", "prod", "release-ent-1.2.3")
	if err != nil || !ok {
		t.Fatalf("expected ok=true for -suffix got ok=%v err=%v", ok, err)
	}
	// Prefix ending in "/" should NOT accept "-suffix".
	repo.namespaceBindings["nb-2"] = &models.NamespaceBinding{ID: "nb-2", TenantID: "t1", BranchProfileID: "bp-2", EnvName: "prod", ImageTagPrefix: "myrepo/"}
	ok, err = svc.VerifyImageTagMatch(context.Background(), "t1", "bp-2", "prod", "myrepo/-1.2.3")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if ok {
		t.Fatalf("prefix ending in / should not accept -suffix")
	}
}

func TestVerifyImageTagMatch_NoBinding_FailClosed(t *testing.T) {
	svc := NewService(newFakeRepo())
	ok, err := svc.VerifyImageTagMatch(context.Background(), "t1", "bp-1", "prod", "myrepo/whatever")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if ok {
		t.Fatalf("expected fail-closed (false) when no binding exists")
	}
	// Also fail-closed when binding has empty imageTagPrefix.
	repo := svc.repo.(*fakeRepo)
	repo.namespaceBindings["nb-empty"] = &models.NamespaceBinding{ID: "nb-empty", TenantID: "t1", BranchProfileID: "bp-2", EnvName: "prod", ImageTagPrefix: ""}
	ok, err = svc.VerifyImageTagMatch(context.Background(), "t1", "bp-2", "prod", "myrepo/whatever")
	if err != nil || ok {
		t.Fatalf("expected fail-closed for empty prefix: ok=%v err=%v", ok, err)
	}
}

func TestVerifyBranchEnvBinding(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	ctx := context.Background()
	repo.namespaceBindings["nb-1"] = &models.NamespaceBinding{ID: "nb-1", TenantID: "t1", BranchProfileID: "bp-1", EnvName: "prod"}

	ok, err := svc.VerifyBranchEnvBinding(ctx, "t1", "bp-1", "prod")
	if err != nil || !ok {
		t.Fatalf("expected true: ok=%v err=%v", ok, err)
	}
	ok, err = svc.VerifyBranchEnvBinding(ctx, "t1", "bp-1", "staging")
	if err != nil || ok {
		t.Fatalf("expected false: ok=%v err=%v", ok, err)
	}
}

func TestGetNamespaceMatrix_Build(t *testing.T) {
	svc := NewService(newFakeRepo())
	repo := svc.repo.(*fakeRepo)
	repo.branchProfiles["bp-1"] = &models.BranchProfile{ID: "bp-1", TenantID: "t1", Name: "release/ent", Semantic: models.BranchRelease, Status: models.BranchStatusActive, OwnerID: "u1", RepoID: "r1", MergeTargets: []string{"main"}}
	repo.branchProfiles["bp-arch"] = &models.BranchProfile{ID: "bp-arch", TenantID: "t1", Name: "release/old", Semantic: models.BranchRelease, Status: models.BranchStatusArchived, OwnerID: "u1", RepoID: "r1", MergeTargets: []string{"main"}}
	repo.namespaceBindings["nb-1"] = &models.NamespaceBinding{ID: "nb-1", TenantID: "t1", BranchProfileID: "bp-1", EnvName: "prod", K8sNamespace: "orion-release-ent", ImageTagPrefix: "myrepo/release-ent", DBName: "orion_release-ent"}
	repo.namespaceBindings["nb-2"] = &models.NamespaceBinding{ID: "nb-2", TenantID: "t1", BranchProfileID: "bp-1", EnvName: "uat", K8sNamespace: "orion-release-ent", ImageTagPrefix: "myrepo/release-ent", DBName: "orion_release-ent"}

	matrix, err := svc.GetNamespaceMatrix(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(matrix.Branches) != 1 {
		t.Fatalf("expected 1 active branch row (archived excluded), got %d", len(matrix.Branches))
	}
	// Envs should include canonical + uat.
	envSet := make(map[string]bool, len(matrix.Envs))
	for _, e := range matrix.Envs {
		envSet[e] = true
	}
	for _, want := range []string{"dev", "staging", "prod", "uat"} {
		if !envSet[want] {
			t.Fatalf("envs missing %q: %+v", want, matrix.Envs)
		}
	}
	row := matrix.Branches[0]
	if !row.Bindings["prod"].Exists {
		t.Fatalf("prod cell should exist")
	}
	if row.Bindings["prod"].K8sNamespace != "orion-release-ent" {
		t.Fatalf("prod k8sNs=%q", row.Bindings["prod"].K8sNamespace)
	}
	if row.Bindings["dev"].Exists {
		t.Fatalf("dev cell should not exist (no binding)")
	}
}

// ============================================================================
// P0-MB Phase 3 — L4 SyncPolicy + SyncRunLog service tests
// ============================================================================

func TestSync_Create_Validation(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	base := &models.CreateSyncPolicyRequest{
		Name:           "daily-release",
		SourceBranch:   "main",
		TargetBranches: []string{"release/2026.10"},
		Frequency:      models.SyncFrequencyDaily,
		Strategy:       models.SyncStrategyRebase,
		AutoResolve:    models.SyncResolveSkipConflict,
	}
	cases := []struct {
		name string
		mut  func(r *models.CreateSyncPolicyRequest)
		want string
	}{
		{"empty-name", func(r *models.CreateSyncPolicyRequest) { r.Name = "" }, "name"},
		{"bad-name-chars", func(r *models.CreateSyncPolicyRequest) { r.Name = "bad name!" }, "name"},
		{"bad-source-branch", func(r *models.CreateSyncPolicyRequest) { r.SourceBranch = "has spaces!" }, "sourceBranch"},
		{"empty-targets", func(r *models.CreateSyncPolicyRequest) { r.TargetBranches = nil }, "targetBranches must be non-empty"},
		{"bad-target-branch", func(r *models.CreateSyncPolicyRequest) { r.TargetBranches = []string{"bad target!"} }, "targetBranch"},
		{"bad-frequency", func(r *models.CreateSyncPolicyRequest) { r.Frequency = "hourly" }, "frequency"},
		{"bad-strategy", func(r *models.CreateSyncPolicyRequest) { r.Strategy = "patch" }, "strategy"},
		{"bad-auto-resolve", func(r *models.CreateSyncPolicyRequest) { r.AutoResolve = "auto-merge" }, "autoResolve"},
		{"bad-webhook", func(r *models.CreateSyncPolicyRequest) { r.NotifyWebhook = "not-a-url" }, "notifyWebhook"},
		{"bad-cron", func(r *models.CreateSyncPolicyRequest) { r.CronExpr = "1 2 3" }, "cronExpr"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := *base
			c.mut(&req)
			_, err := svc.CreateSyncPolicy(ctx, "t1", &req)
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", c.want)
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Fatalf("error %q does not contain %q", err.Error(), c.want)
			}
		})
	}
}

func TestSync_Create_Success(t *testing.T) {
	svc := NewService(newFakeRepo())
	req := &models.CreateSyncPolicyRequest{
		Name:           "daily-release",
		SourceBranch:   "main",
		TargetBranches: []string{"release/2026.10", "release/2026.11"},
		Frequency:      models.SyncFrequencyDaily,
		CronExpr:       "0 3 * * *",
		Strategy:       models.SyncStrategyRebase,
		AutoResolve:    models.SyncResolveManualRequired,
		NotifyWebhook:  "https://hooks.slack.example/t/1",
	}
	p, err := svc.CreateSyncPolicy(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if p.ID == "" || !strings.HasPrefix(p.ID, "sp-") {
		t.Fatalf("expected sp- prefix id, got %q", p.ID)
	}
	if p.Enabled != true {
		t.Fatalf("expected Enabled=true by default, got %v", p.Enabled)
	}
	if len(p.TargetBranches) != 2 {
		t.Fatalf("expected 2 targets, got %d", len(p.TargetBranches))
	}
}

func TestSync_Create_SourceEqualsTarget(t *testing.T) {
	svc := NewService(newFakeRepo())
	req := &models.CreateSyncPolicyRequest{
		Name:           "self-sync",
		SourceBranch:   "main",
		TargetBranches: []string{"release/2026.10", "main"},
		Frequency:      models.SyncFrequencyDaily,
		Strategy:       models.SyncStrategyRebase,
		AutoResolve:    models.SyncResolveNone,
	}
	_, err := svc.CreateSyncPolicy(context.Background(), "t1", req)
	if err == nil {
		t.Fatalf("expected error for sourceBranch == targetBranch, got nil")
	}
	if !strings.Contains(err.Error(), "cannot be its own target") {
		t.Fatalf("error %q missing 'cannot be its own target'", err.Error())
	}
}

func TestSync_Update_Validation(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()

	seed := &models.SyncPolicy{
		ID: "sp-1", TenantID: "t1", Name: "old", SourceBranch: "main",
		TargetBranches: []string{"release/a"}, Frequency: models.SyncFrequencyDaily,
		Strategy: models.SyncStrategyRebase, AutoResolve: models.SyncResolveNone, Enabled: true,
	}
	if err := repo.CreateSyncPolicy(ctx, seed); err != nil {
		t.Fatalf("seed: %v", err)
	}

	cases := []struct {
		name string
		req  *models.UpdateSyncPolicyRequest
		want string
	}{
		{"bad-name", &models.UpdateSyncPolicyRequest{Name: strPtr("bad name!")}, "name"},
		{"bad-frequency", &models.UpdateSyncPolicyRequest{Frequency: func() *models.SyncFrequency { f := models.SyncFrequency("hourly"); return &f }()}, "frequency"},
		{"bad-strategy", &models.UpdateSyncPolicyRequest{Strategy: func() *models.SyncStrategy { s := models.SyncStrategy("patch"); return &s }()}, "strategy"},
		{"bad-auto-resolve", &models.UpdateSyncPolicyRequest{AutoResolve: func() *models.SyncResolve { r := models.SyncResolve("auto-merge"); return &r }()}, "autoResolve"},
		{"empty-targets", &models.UpdateSyncPolicyRequest{TargetBranches: &[]string{}}, "targetBranches must be non-empty"},
		{"source-equals-target", &models.UpdateSyncPolicyRequest{TargetBranches: &[]string{"main"}}, "cannot be its own target"},
		{"bad-webhook", &models.UpdateSyncPolicyRequest{NotifyWebhook: strPtr("not-a-url")}, "notifyWebhook"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := svc.UpdateSyncPolicy(ctx, "t1", "sp-1", c.req)
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", c.want)
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Fatalf("error %q does not contain %q", err.Error(), c.want)
			}
		})
	}
}

func TestSync_Update_Applies(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()

	repo.syncPolicies["sp-1"] = &models.SyncPolicy{
		ID: "sp-1", TenantID: "t1", Name: "old", SourceBranch: "main",
		TargetBranches: []string{"release/a"}, Frequency: models.SyncFrequencyDaily,
		Strategy: models.SyncStrategyRebase, AutoResolve: models.SyncResolveNone, Enabled: true,
	}
	weekly := models.SyncFrequencyWeekly
	disabled := false
	p, err := svc.UpdateSyncPolicy(ctx, "t1", "sp-1", &models.UpdateSyncPolicyRequest{
		Frequency: &weekly,
		Enabled:   &disabled,
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if p.Frequency != models.SyncFrequencyWeekly {
		t.Fatalf("expected weekly, got %q", p.Frequency)
	}
	if p.Enabled {
		t.Fatalf("expected Enabled=false")
	}
	if p.Name != "old" {
		t.Fatalf("untouched field changed: name=%q", p.Name)
	}
}

func TestSync_Enable_Disable(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()

	repo.syncPolicies["sp-1"] = &models.SyncPolicy{ID: "sp-1", TenantID: "t1", Enabled: false}

	enabled, err := svc.EnableSyncPolicy(ctx, "t1", "sp-1")
	if err != nil {
		t.Fatalf("enable: %v", err)
	}
	if !enabled.Enabled {
		t.Fatalf("expected Enabled=true after enable")
	}

	disabled, err := svc.DisableSyncPolicy(ctx, "t1", "sp-1")
	if err != nil {
		t.Fatalf("disable: %v", err)
	}
	if disabled.Enabled {
		t.Fatalf("expected Enabled=false after disable")
	}
}

func TestSync_Enable_Disable_NotFound(t *testing.T) {
	svc := NewService(newFakeRepo())
	_, err := svc.EnableSyncPolicy(context.Background(), "t1", "sp-none")
	if err == nil {
		t.Fatalf("expected error for missing policy")
	}
}

func TestSync_ListSyncPolicies_Filters(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	enabled := true
	disabled := false

	repo.syncPolicies["sp-1"] = &models.SyncPolicy{ID: "sp-1", TenantID: "t1", Enabled: enabled, Frequency: models.SyncFrequencyDaily, Strategy: models.SyncStrategyRebase, AutoResolve: models.SyncResolveNone, SourceBranch: "main"}
	repo.syncPolicies["sp-2"] = &models.SyncPolicy{ID: "sp-2", TenantID: "t1", Enabled: disabled, Frequency: models.SyncFrequencyWeekly, Strategy: models.SyncStrategyMerge, AutoResolve: models.SyncResolveSkipConflict, SourceBranch: "release/a"}
	repo.syncPolicies["sp-3"] = &models.SyncPolicy{ID: "sp-3", TenantID: "t2", Enabled: enabled, Frequency: models.SyncFrequencyDaily}

	out, err := svc.ListSyncPolicies(ctx, "t1", models.SyncPolicyQuery{Enabled: &enabled})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 enabled t1 policy, got %d", len(out))
	}
	if out[0].ID != "sp-1" {
		t.Fatalf("unexpected policy id %q", out[0].ID)
	}
}

// stubExecutor is a fake syncExecutor that returns per-target results.
type stubExecutor struct {
	results map[string]models.SyncRunResult
}

func (s stubExecutor) Execute(_ context.Context, _ *models.SyncPolicy, targetBranch, _ string) models.SyncRunResult {
	if r, ok := s.results[targetBranch]; ok {
		return r
	}
	return models.SyncRunResult{TargetBranch: targetBranch, Applied: true, NewCommitSHA: "abc12345"}
}

func TestSync_RunNow_Success(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.syncPolicies["sp-1"] = &models.SyncPolicy{
		ID: "sp-1", TenantID: "t1", SourceBranch: "main",
		TargetBranches: []string{"release/a", "release/b"},
		Strategy: models.SyncStrategyRebase, AutoResolve: models.SyncResolveNone, Enabled: true,
	}

	log, err := svc.RunNow(ctx, "t1", "sp-1", "alice", "abcdef1234567890")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if log.Status != models.SyncStatusSuccess {
		t.Fatalf("expected success, got %q", log.Status)
	}
	if log.TriggeredBy != models.SyncTriggerManual {
		t.Fatalf("expected manual, got %q", log.TriggeredBy)
	}
	if log.SourceCommit != "abcdef1234567890" {
		t.Fatalf("sourceCommit mismatch: %q", log.SourceCommit)
	}
	if len(repo.syncRunLogs) != 1 {
		t.Fatalf("expected 1 run log, got %d", len(repo.syncRunLogs))
	}
	// Policy summary should be updated.
	p, _ := repo.GetSyncPolicy(ctx, "t1", "sp-1")
	if p == nil || p.LastRunAt == nil {
		t.Fatalf("policy LastRunAt not set")
	}
	if p.LastRunStatus == nil || *p.LastRunStatus != models.SyncStatusSuccess {
		t.Fatalf("policy LastRunStatus not set to success")
	}
}

func TestSync_RunNow_HeadFallback(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.syncPolicies["sp-1"] = &models.SyncPolicy{
		ID: "sp-1", TenantID: "t1", TargetBranches: []string{"release/a"},
		Strategy: models.SyncStrategyRebase, AutoResolve: models.SyncResolveNone, Enabled: true,
	}
	log, err := svc.RunNow(ctx, "t1", "sp-1", "alice", "")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if log.SourceCommit != "HEAD" {
		t.Fatalf("expected HEAD fallback, got %q", log.SourceCommit)
	}
}

func TestSync_RunNow_SchedulerTrigger(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.syncPolicies["sp-1"] = &models.SyncPolicy{
		ID: "sp-1", TenantID: "t1", TargetBranches: []string{"release/a"},
		Strategy: models.SyncStrategyRebase, AutoResolve: models.SyncResolveNone, Enabled: true,
	}
	log, err := svc.RunNow(ctx, "t1", "sp-1", "scheduler", "")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if log.TriggeredBy != models.SyncTriggerScheduler {
		t.Fatalf("expected scheduler trigger, got %q", log.TriggeredBy)
	}
}

func TestSync_RunNow_BadSourceCommit(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.syncPolicies["sp-1"] = &models.SyncPolicy{
		ID: "sp-1", TenantID: "t1", TargetBranches: []string{"release/a"},
		Strategy: models.SyncStrategyRebase, AutoResolve: models.SyncResolveNone, Enabled: true,
	}
	_, err := svc.RunNow(ctx, "t1", "sp-1", "alice", "zzz-not-hex")
	if err == nil {
		t.Fatalf("expected error for bad sourceCommit")
	}
	if !strings.Contains(err.Error(), "invalid") {
		t.Fatalf("error %q missing 'invalid'", err.Error())
	}
}

func TestSync_RunNow_MissingActor(t *testing.T) {
	svc := NewService(newFakeRepo())
	_, err := svc.RunNow(context.Background(), "t1", "sp-1", "", "")
	if err == nil {
		t.Fatalf("expected error for empty actor")
	}
}

func TestSync_RunNow_NoTargets(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.syncPolicies["sp-1"] = &models.SyncPolicy{ID: "sp-1", TenantID: "t1"}
	_, err := svc.RunNow(ctx, "t1", "sp-1", "alice", "")
	if err == nil {
		t.Fatalf("expected error for empty targetBranches")
	}
	if !strings.Contains(err.Error(), "no target branches") {
		t.Fatalf("error %q missing 'no target branches'", err.Error())
	}
}

func TestSync_RunNow_ConflictManualRequired_FailClosed(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.syncPolicies["sp-1"] = &models.SyncPolicy{
		ID: "sp-1", TenantID: "t1", SourceBranch: "main",
		TargetBranches: []string{"release/a", "release/b"},
		Strategy: models.SyncStrategyRebase, AutoResolve: models.SyncResolveManualRequired, Enabled: true,
	}
	exec := stubExecutor{results: map[string]models.SyncRunResult{
		"release/a": {TargetBranch: "release/a", ConflictFiles: []string{"file.go"}},
		"release/b": {TargetBranch: "release/b", ConflictFiles: []string{"never-shown.go"}},
	}}
	log, err := svc.RunNowWithExecutor(ctx, "t1", "sp-1", "alice", "", exec)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if log.Status != models.SyncStatusConflict {
		t.Fatalf("expected conflict, got %q", log.Status)
	}
	// Fail-closed: only release/a should appear (b is skipped).
	if len(log.ConflictFiles) != 1 || log.ConflictFiles[0] != "release/a:file.go" {
		t.Fatalf("expected 1 qualified conflict entry, got %v", log.ConflictFiles)
	}
}

func TestSync_RunNow_ConflictSkipConflict_Continues(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.syncPolicies["sp-1"] = &models.SyncPolicy{
		ID: "sp-1", TenantID: "t1",
		TargetBranches: []string{"release/a", "release/b", "release/c"},
		Strategy: models.SyncStrategyRebase, AutoResolve: models.SyncResolveSkipConflict, Enabled: true,
	}
	exec := stubExecutor{results: map[string]models.SyncRunResult{
		"release/a": {TargetBranch: "release/a", ConflictFiles: []string{"file.go"}},
		"release/b": {TargetBranch: "release/b", Applied: true, NewCommitSHA: "abc12345"},
		"release/c": {TargetBranch: "release/c", ConflictFiles: []string{"other.go"}},
	}}
	log, err := svc.RunNowWithExecutor(ctx, "t1", "sp-1", "alice", "", exec)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	// skip-conflict: still success, but conflicts recorded.
	if log.Status != models.SyncStatusSuccess {
		t.Fatalf("expected success (skip-conflict), got %q", log.Status)
	}
	if len(log.ConflictFiles) != 2 {
		t.Fatalf("expected 2 conflicts recorded, got %d: %v", len(log.ConflictFiles), log.ConflictFiles)
	}
}

func TestSync_RunNow_FirstErrorOnly(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.syncPolicies["sp-1"] = &models.SyncPolicy{
		ID: "sp-1", TenantID: "t1",
		TargetBranches: []string{"release/a", "release/b"},
		Strategy: models.SyncStrategyRebase, AutoResolve: models.SyncResolveNone, Enabled: true,
	}
	exec := stubExecutor{results: map[string]models.SyncRunResult{
		"release/a": {TargetBranch: "release/a", Error: "network blip"},
		"release/b": {TargetBranch: "release/b", Error: "later error"},
	}}
	log, err := svc.RunNowWithExecutor(ctx, "t1", "sp-1", "alice", "", exec)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if log.Status != models.SyncStatusFailed {
		t.Fatalf("expected failed, got %q", log.Status)
	}
	if !strings.Contains(log.ErrorMsg, "release/a") {
		t.Fatalf("expected first error (release/a), got %q", log.ErrorMsg)
	}
}

func TestSync_GetEnabledPolicies_CronMatch(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	enabled := true

	repo.syncPolicies["sp-1"] = &models.SyncPolicy{ID: "sp-1", TenantID: "t1", Enabled: enabled, CronExpr: "0 3 * * *"}
	repo.syncPolicies["sp-2"] = &models.SyncPolicy{ID: "sp-2", TenantID: "t1", Enabled: enabled, CronExpr: "0 4 * * *"}
	repo.syncPolicies["sp-3"] = &models.SyncPolicy{ID: "sp-3", TenantID: "t1", Enabled: enabled} // no cron -> always match
	repo.syncPolicies["sp-4"] = &models.SyncPolicy{ID: "sp-4", TenantID: "t1", Enabled: false, CronExpr: "0 3 * * *"}

	match := func(expr string) bool { return expr == "0 3 * * *" }
	out, err := svc.GetEnabledPolicies(ctx, "t1", match)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	ids := map[string]bool{}
	for _, p := range out {
		ids[p.ID] = true
	}
	if !ids["sp-1"] || !ids["sp-3"] {
		t.Fatalf("expected sp-1 and sp-3, got %v", ids)
	}
	if ids["sp-2"] || ids["sp-4"] {
		t.Fatalf("unexpected: %v", ids)
	}
}

func TestSync_GetEnabledPolicies_NilCronMatch(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	enabled := true

	repo.syncPolicies["sp-1"] = &models.SyncPolicy{ID: "sp-1", TenantID: "t1", Enabled: enabled}
	repo.syncPolicies["sp-2"] = &models.SyncPolicy{ID: "sp-2", TenantID: "t1", Enabled: enabled}
	repo.syncPolicies["sp-3"] = &models.SyncPolicy{ID: "sp-3", TenantID: "t1", Enabled: false}

	out, err := svc.GetEnabledPolicies(ctx, "t1", nil)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("expected 2 enabled policies, got %d", len(out))
	}
}

func TestSync_ListRunLogs_Limit(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	for i := 0; i < 10; i++ {
		repo.syncRunLogs = append(repo.syncRunLogs, models.SyncRunLog{
			ID: fmt.Sprintf("sl-%d", i), TenantID: "t1", PolicyID: "sp-1", Status: models.SyncStatusSuccess,
		})
	}
	out, err := svc.ListSyncRunLogs(ctx, "t1", models.SyncRunLogQuery{Limit: 5})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 5 {
		t.Fatalf("expected 5, got %d", len(out))
	}
}

func TestSync_ListRunLogs_DefaultAndCap(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	for i := 0; i < 200; i++ {
		repo.syncRunLogs = append(repo.syncRunLogs, models.SyncRunLog{ID: fmt.Sprintf("sl-%d", i), TenantID: "t1", Status: models.SyncStatusSuccess})
	}
	// Default limit = 100.
	out, err := svc.ListSyncRunLogs(ctx, "t1", models.SyncRunLogQuery{})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 100 {
		t.Fatalf("expected default 100, got %d", len(out))
	}
	// Limit > 1000 capped to 1000.
	out, err = svc.ListSyncRunLogs(ctx, "t1", models.SyncRunLogQuery{Limit: 5000})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 200 {
		t.Fatalf("expected 200 (all, since < cap), got %d", len(out))
	}
}

func TestSync_ListRunLogs_FilterByPolicy(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.syncRunLogs = append(repo.syncRunLogs,
		models.SyncRunLog{ID: "sl-1", TenantID: "t1", PolicyID: "sp-1", Status: models.SyncStatusSuccess},
		models.SyncRunLog{ID: "sl-2", TenantID: "t1", PolicyID: "sp-2", Status: models.SyncStatusConflict},
	)
	pi := "sp-1"
	out, err := svc.ListSyncRunLogs(ctx, "t1", models.SyncRunLogQuery{PolicyID: &pi})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 1 || out[0].PolicyID != "sp-1" {
		t.Fatalf("expected 1 sp-1 log, got %v", out)
	}
}

func TestSync_Delete(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.syncPolicies["sp-1"] = &models.SyncPolicy{ID: "sp-1", TenantID: "t1"}
	if err := svc.DeleteSyncPolicy(ctx, "t1", "sp-1"); err != nil {
		t.Fatalf("err: %v", err)
	}
	if _, ok := repo.syncPolicies["sp-1"]; ok {
		t.Fatalf("sp-1 should be deleted")
	}
}

func TestSync_Update_NotFound(t *testing.T) {
	svc := NewService(newFakeRepo())
	_, err := svc.UpdateSyncPolicy(context.Background(), "t1", "sp-none", &models.UpdateSyncPolicyRequest{})
	if err == nil {
		t.Fatalf("expected error for missing policy")
	}
}

// strPtr is a tiny helper for pointer literals in tests.
func strPtr(s string) *string { return &s }

// ============================================================================
// P0-MB Phase 4 — L5 DeployEvent + one-click rollback + AuditTrail tests
// ============================================================================

func TestDE_Create_Validation(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	base := &models.CreateDeployEventRequest{
		ActorID:    "actor-1",
		Branch:     "main",
		Env:        "prod",
		ToCommit:   "1234567abcdef0123",
		FromCommit: "abcdef0123456789",
	}
	cases := []struct {
		name string
		mut  func(r *models.CreateDeployEventRequest)
		want string
	}{
		{"nil-request", func(r *models.CreateDeployEventRequest) { *r = models.CreateDeployEventRequest{}; _ = *r }, "actorId is required"},
		{"empty-actor", func(r *models.CreateDeployEventRequest) { r.ActorID = "" }, "actorId is required"},
		{"bad-actor", func(r *models.CreateDeployEventRequest) { r.ActorID = "has space!" }, "actorId"},
		{"empty-branch", func(r *models.CreateDeployEventRequest) { r.Branch = "" }, "branch is required"},
		{"empty-env", func(r *models.CreateDeployEventRequest) { r.Env = "" }, "env is required"},
		{"bad-env", func(r *models.CreateDeployEventRequest) { r.Env = "has space!" }, "env"},
		{"empty-to", func(r *models.CreateDeployEventRequest) { r.ToCommit = "" }, "toCommit is required"},
		{"bad-to", func(r *models.CreateDeployEventRequest) { r.ToCommit = "xyz" }, "toCommit"},
		{"bad-from", func(r *models.CreateDeployEventRequest) { r.FromCommit = "xyz" }, "fromCommit"},
		{"bad-digest", func(r *models.CreateDeployEventRequest) { r.ImageDigest = "notsha256" }, "imageDigest"},
		{"bad-outcome", func(r *models.CreateDeployEventRequest) { r.Outcome = "weird" }, "outcome"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := *base
			c.mut(&req)
			_, err := svc.CreateDeployEvent(ctx, "t1", &req)
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", c.want)
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Fatalf("error %q does not contain %q", err.Error(), c.want)
			}
		})
	}
}

func TestDE_Create_Success(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	req := &models.CreateDeployEventRequest{
		ActorID:    "actor-1",
		ActorName:  "Alice",
		Branch:     "main",
		Env:        "prod",
		FromCommit: "ABCDEF0123456789", // uppercase, should be normalized
		ToCommit:   "1234567abcdef0123",
		ArtifactID: "art-1",
		ImageDigest: "sha256:" + strings.Repeat("a", 64),
		ApprovalID: "cm-1",
	}
	evt, err := svc.CreateDeployEvent(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !strings.HasPrefix(evt.ID, "de-") {
		t.Fatalf("id %q should start with de-", evt.ID)
	}
	if evt.Outcome != models.DeployOutcomeSuccess {
		t.Fatalf("outcome = %q, want success", evt.Outcome)
	}
	if evt.ToCommit != "1234567abcdef0123" {
		t.Fatalf("toCommit = %q, want lowercased", evt.ToCommit)
	}
	if evt.FromCommit != "abcdef0123456789" {
		t.Fatalf("fromCommit = %q, want lowercased", evt.FromCommit)
	}
	if evt.StartedAt.IsZero() || evt.CreatedAt.IsZero() {
		t.Fatalf("timestamps not set")
	}
	if repo.deployEvents[evt.ID] == nil {
		t.Fatal("event not persisted in repo")
	}
}

func TestDE_Create_TenantRequired(t *testing.T) {
	svc := NewService(newFakeRepo())
	req := &models.CreateDeployEventRequest{
		ActorID:  "actor-1",
		Branch:   "main",
		Env:      "prod",
		ToCommit: "1234567abcdef0123",
	}
	_, err := svc.CreateDeployEvent(context.Background(), "", req)
	if err == nil {
		t.Fatal("expected error for empty tenantID")
	}
	if !strings.Contains(err.Error(), "tenant_id") {
		t.Fatalf("err %q", err.Error())
	}
}

func TestDE_Record_Success(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	evt := &models.DeployEvent{
		TenantID: "t1",
		ActorID:  "actor-1",
		Branch:   "main",
		Env:      "prod",
		ToCommit: "1234567abcdef0123",
	}
	if err := svc.RecordDeployEvent(context.Background(), evt); err != nil {
		t.Fatalf("err: %v", err)
	}
	if evt.ID == "" || !strings.HasPrefix(evt.ID, "de-") {
		t.Fatalf("id = %q, want de- prefix", evt.ID)
	}
	if evt.Outcome != models.DeployOutcomeSuccess {
		t.Fatalf("outcome = %q, want success default", evt.Outcome)
	}
	if evt.StartedAt.IsZero() || evt.CreatedAt.IsZero() {
		t.Fatal("timestamps not filled")
	}
	if repo.deployEvents[evt.ID] == nil {
		t.Fatal("not persisted")
	}
}

func TestDE_Record_Validation(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	if err := svc.RecordDeployEvent(ctx, nil); err == nil {
		t.Fatal("expected error for nil event")
	}
	if err := svc.RecordDeployEvent(ctx, &models.DeployEvent{}); err == nil {
		t.Fatal("expected error for missing tenantId")
	}
	if err := svc.RecordDeployEvent(ctx, &models.DeployEvent{TenantID: "t1"}); err == nil {
		t.Fatal("expected error for missing actorId")
	}
	if err := svc.RecordDeployEvent(ctx, &models.DeployEvent{TenantID: "t1", ActorID: "a"}); err == nil {
		t.Fatal("expected error for missing branch/env")
	}
	if err := svc.RecordDeployEvent(ctx, &models.DeployEvent{TenantID: "t1", ActorID: "a", Branch: "main", Env: "prod"}); err == nil {
		t.Fatal("expected error for missing toCommit")
	}
	evt := &models.DeployEvent{TenantID: "t1", ActorID: "a", Branch: "main", Env: "prod", ToCommit: "abc123", Outcome: "weird"}
	if err := svc.RecordDeployEvent(ctx, evt); err == nil {
		t.Fatal("expected error for invalid outcome")
	}
}

func TestDE_UpdateOutcome_StateMachine(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.deployEvents["de-1"] = &models.DeployEvent{
		ID: "de-1", TenantID: "t1", Outcome: models.DeployOutcomeSuccess,
		StartedAt: time.Now(), CreatedAt: time.Now(),
	}
	// success -> failed
	updated, err := svc.UpdateDeployOutcome(ctx, "t1", "de-1", models.DeployOutcomeFailed, "boom")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if updated.Outcome != models.DeployOutcomeFailed {
		t.Fatalf("outcome = %q, want failed", updated.Outcome)
	}
	if updated.ErrorMsg != "boom" {
		t.Fatalf("errorMsg = %q", updated.ErrorMsg)
	}
	if updated.CompletedAt == nil {
		t.Fatal("completedAt should be set for terminal outcome")
	}
	// failed -> success
	updated, err = svc.UpdateDeployOutcome(ctx, "t1", "de-1", models.DeployOutcomeSuccess, "")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if updated.Outcome != models.DeployOutcomeSuccess {
		t.Fatalf("outcome = %q, want success", updated.Outcome)
	}
}

func TestDE_UpdateOutcome_TerminalRejection(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.deployEvents["de-1"] = &models.DeployEvent{
		ID: "de-1", TenantID: "t1", Outcome: models.DeployOutcomeRolledBack,
		StartedAt: time.Now(), CreatedAt: time.Now(),
	}
	_, err := svc.UpdateDeployOutcome(ctx, "t1", "de-1", models.DeployOutcomeSuccess, "")
	if err == nil {
		t.Fatal("expected error for terminal outcome")
	}
	if !strings.Contains(err.Error(), "terminal") {
		t.Fatalf("err %q should mention terminal", err.Error())
	}
}

func TestDE_UpdateOutcome_NotFound(t *testing.T) {
	svc := NewService(newFakeRepo())
	_, err := svc.UpdateDeployOutcome(context.Background(), "t1", "de-none", models.DeployOutcomeSuccess, "")
	if err == nil {
		t.Fatal("expected error for missing event")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("err %q", err.Error())
	}
}

func TestDE_UpdateOutcome_InvalidEnum(t *testing.T) {
	svc := NewService(newFakeRepo())
	_, err := svc.UpdateDeployOutcome(context.Background(), "t1", "de-1", models.DeployOutcome("weird"), "")
	if err == nil {
		t.Fatal("expected error for invalid enum")
	}
}

func TestDE_UpdateMetrics_Partial(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.deployEvents["de-1"] = &models.DeployEvent{
		ID: "de-1", TenantID: "t1", Outcome: models.DeployOutcomeSuccess,
		DurationMs: 5000, ErrorRate: 0.1, P99Latency: 200,
		StartedAt: time.Now(), CreatedAt: time.Now(),
	}
	// Only set ErrorRate; DurationMs/P99Latency should be unchanged.
	updated, err := svc.UpdateDeployMetrics(ctx, "t1", "de-1", models.DeployMetrics{ErrorRate: 0.25})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if updated.ErrorRate != 0.25 {
		t.Fatalf("errorRate = %f, want 0.25", updated.ErrorRate)
	}
	if updated.DurationMs != 5000 {
		t.Fatalf("durationMs = %d, want 5000 (unchanged)", updated.DurationMs)
	}
	if updated.P99Latency != 200 {
		t.Fatalf("p99Latency = %d, want 200 (unchanged)", updated.P99Latency)
	}
}

func TestDE_UpdateMetrics_TerminalRejection(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.deployEvents["de-1"] = &models.DeployEvent{
		ID: "de-1", TenantID: "t1", Outcome: models.DeployOutcomeRolledBack,
		StartedAt: time.Now(), CreatedAt: time.Now(),
	}
	_, err := svc.UpdateDeployMetrics(ctx, "t1", "de-1", models.DeployMetrics{DurationMs: 100})
	if err == nil {
		t.Fatal("expected error for terminal outcome")
	}
	if !strings.Contains(err.Error(), "terminal") {
		t.Fatalf("err %q should mention terminal", err.Error())
	}
}

func TestDE_UpdateMetrics_Validation(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	if _, err := svc.UpdateDeployMetrics(ctx, "t1", "de-1", models.DeployMetrics{ErrorRate: -0.1}); err == nil {
		t.Fatal("expected error for negative errorRate")
	}
	if _, err := svc.UpdateDeployMetrics(ctx, "t1", "de-1", models.DeployMetrics{ErrorRate: 1.1}); err == nil {
		t.Fatal("expected error for errorRate > 1")
	}
	if _, err := svc.UpdateDeployMetrics(ctx, "t1", "de-1", models.DeployMetrics{DurationMs: -1}); err == nil {
		t.Fatal("expected error for negative durationMs")
	}
	if _, err := svc.UpdateDeployMetrics(ctx, "t1", "de-1", models.DeployMetrics{P99Latency: -1}); err == nil {
		t.Fatal("expected error for negative p99Latency")
	}
}

func TestDE_Rollback_CreatesNewEvent(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	origID := "de-orig"
	repo.deployEvents[origID] = &models.DeployEvent{
		ID: "de-orig", TenantID: "t1", ActorID: "actor-1",
		Branch: "main", Env: "prod",
		FromCommit: "abcdef0123456789", ToCommit: "1234567abcdef0123",
		ArtifactID: "art-1", ApprovalID: "cm-1",
		ImageDigest: "sha256:" + strings.Repeat("b", 64),
		Outcome: models.DeployOutcomeSuccess,
		StartedAt: time.Now(), CreatedAt: time.Now(),
	}
	rb, err := svc.RollbackDeployEvent(ctx, "t1", origID, "actor-2")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if rb.ID == origID {
		t.Fatal("rollback id must differ from original")
	}
	if rb.FromCommit != "1234567abcdef0123" {
		t.Fatalf("fromCommit = %q, want original.ToCommit", rb.FromCommit)
	}
	if rb.ToCommit != "abcdef0123456789" {
		t.Fatalf("toCommit = %q, want original.FromCommit", rb.ToCommit)
	}
	if rb.Outcome != models.DeployOutcomeRolledBack {
		t.Fatalf("outcome = %q, want rolled-back", rb.Outcome)
	}
	if rb.RollbackTo == nil || *rb.RollbackTo != origID {
		t.Fatalf("rollbackTo = %v, want %q", rb.RollbackTo, origID)
	}
	if rb.ArtifactID != "art-1" || rb.ApprovalID != "cm-1" {
		t.Fatalf("artifactId/approvalId not carried over")
	}
	if rb.ActorID != "actor-2" {
		t.Fatalf("actorId = %q, want actor-2", rb.ActorID)
	}
	// Original must remain untouched.
	if repo.deployEvents[origID].Outcome != models.DeployOutcomeSuccess {
		t.Fatal("original outcome mutated by rollback")
	}
	// Rollback must be persisted.
	if repo.deployEvents[rb.ID] == nil {
		t.Fatal("rollback not persisted")
	}
}

func TestDE_Rollback_TerminalRejection(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.deployEvents["de-1"] = &models.DeployEvent{
		ID: "de-1", TenantID: "t1",
		FromCommit: "abcdef0123456789", ToCommit: "1234567abcdef0123",
		Outcome: models.DeployOutcomeRolledBack,
	}
	_, err := svc.RollbackDeployEvent(ctx, "t1", "de-1", "actor-2")
	if err == nil {
		t.Fatal("expected error for terminal outcome")
	}
	if !strings.Contains(err.Error(), "cannot be rolled back") {
		t.Fatalf("err %q", err.Error())
	}
}

func TestDE_Rollback_MissingFields(t *testing.T) {
	svc := NewService(newFakeRepo())
	ctx := context.Background()
	if _, err := svc.RollbackDeployEvent(ctx, "", "de-1", "actor-1"); err == nil {
		t.Fatal("expected error for empty tenantID")
	}
	if _, err := svc.RollbackDeployEvent(ctx, "t1", "", "actor-1"); err == nil {
		t.Fatal("expected error for empty id")
	}
	if _, err := svc.RollbackDeployEvent(ctx, "t1", "de-1", ""); err == nil {
		t.Fatal("expected error for empty actorID")
	}
	if _, err := svc.RollbackDeployEvent(ctx, "t1", "de-1", "has space!"); err == nil {
		t.Fatal("expected error for bad actorID")
	}
	if _, err := svc.RollbackDeployEvent(ctx, "t1", "de-none", "actor-1"); err == nil {
		t.Fatal("expected error for missing event")
	}
}

func TestDE_Rollback_EmptyCommits(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	// No ToCommit — nothing to roll back from.
	repo.deployEvents["de-no-to"] = &models.DeployEvent{
		ID: "de-no-to", TenantID: "t1", Outcome: models.DeployOutcomeSuccess,
		FromCommit: "abcdef0123456789",
	}
	if _, err := svc.RollbackDeployEvent(ctx, "t1", "de-no-to", "actor-1"); err == nil {
		t.Fatal("expected error for empty ToCommit")
	}
	// No FromCommit — nothing to roll back to.
	repo.deployEvents["de-no-from"] = &models.DeployEvent{
		ID: "de-no-from", TenantID: "t1", Outcome: models.DeployOutcomeFailed,
		ToCommit: "1234567abcdef0123",
	}
	if _, err := svc.RollbackDeployEvent(ctx, "t1", "de-no-from", "actor-1"); err == nil {
		t.Fatal("expected error for empty FromCommit")
	}
}

func TestDE_List_Filters(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	now := time.Now()
	repo.deployEvents["de-1"] = &models.DeployEvent{ID: "de-1", TenantID: "t1", Branch: "main", Env: "prod", ActorID: "a1", Outcome: models.DeployOutcomeSuccess, ApprovalID: "cm-1", ArtifactID: "art-1", StartedAt: now, CreatedAt: now}
	repo.deployEvents["de-2"] = &models.DeployEvent{ID: "de-2", TenantID: "t1", Branch: "main", Env: "staging", ActorID: "a2", Outcome: models.DeployOutcomeFailed, ApprovalID: "cm-2", ArtifactID: "art-2", StartedAt: now, CreatedAt: now}
	repo.deployEvents["de-3"] = &models.DeployEvent{ID: "de-3", TenantID: "t2", Branch: "main", Env: "prod", ActorID: "a1", Outcome: models.DeployOutcomeSuccess, StartedAt: now, CreatedAt: now} // other tenant
	// All filters nil → all t1 events.
	out, err := svc.ListDeployEvents(ctx, "t1", models.DeployEventQuery{})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("len = %d, want 2 (tenant isolation)", len(out))
	}
	// Branch filter.
	out, _ = svc.ListDeployEvents(ctx, "t1", models.DeployEventQuery{Branch: strPtr("main")})
	if len(out) != 2 {
		t.Fatalf("branch filter len = %d, want 2", len(out))
	}
	// Env filter.
	out, _ = svc.ListDeployEvents(ctx, "t1", models.DeployEventQuery{Env: strPtr("prod")})
	if len(out) != 1 || out[0].ID != "de-1" {
		t.Fatalf("env filter got %d events", len(out))
	}
	// Outcome filter.
	failed := models.DeployOutcomeFailed
	out, _ = svc.ListDeployEvents(ctx, "t1", models.DeployEventQuery{Outcome: &failed})
	if len(out) != 1 || out[0].ID != "de-2" {
		t.Fatalf("outcome filter got %d events", len(out))
	}
	// ApprovalID filter.
	out, _ = svc.ListDeployEvents(ctx, "t1", models.DeployEventQuery{ApprovalID: strPtr("cm-1")})
	if len(out) != 1 || out[0].ID != "de-1" {
		t.Fatalf("approvalId filter got %d events", len(out))
	}
	// ActorID filter.
	out, _ = svc.ListDeployEvents(ctx, "t1", models.DeployEventQuery{ActorID: strPtr("a2")})
	if len(out) != 1 || out[0].ID != "de-2" {
		t.Fatalf("actorId filter got %d events", len(out))
	}
	// Limit cap.
	out, _ = svc.ListDeployEvents(ctx, "t1", models.DeployEventQuery{Limit: 1})
	if len(out) != 1 {
		t.Fatalf("limit=1 len = %d", len(out))
	}
	// Tenant empty → error.
	if _, err := svc.ListDeployEvents(ctx, "", models.DeployEventQuery{}); err == nil {
		t.Fatal("expected error for empty tenantID")
	}
}

func TestDE_ListByBranchEnvActor(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	now := time.Now()
	repo.deployEvents["de-1"] = &models.DeployEvent{ID: "de-1", TenantID: "t1", Branch: "main", Env: "prod", ActorID: "a1", StartedAt: now, CreatedAt: now}
	repo.deployEvents["de-2"] = &models.DeployEvent{ID: "de-2", TenantID: "t1", Branch: "release", Env: "prod", ActorID: "a2", StartedAt: now, CreatedAt: now}
	out, err := svc.ListDeployEventsByBranch(ctx, "t1", "main", 10)
	if err != nil || len(out) != 1 || out[0].ID != "de-1" {
		t.Fatalf("by-branch: len=%d err=%v", len(out), err)
	}
	out, err = svc.ListDeployEventsByEnv(ctx, "t1", "prod", 10)
	if err != nil || len(out) != 2 {
		t.Fatalf("by-env: len=%d err=%v", len(out), err)
	}
	out, err = svc.ListDeployEventsByActor(ctx, "t1", "a2", 10)
	if err != nil || len(out) != 1 || out[0].ID != "de-2" {
		t.Fatalf("by-actor: len=%d err=%v", len(out), err)
	}
	if _, err := svc.ListDeployEventsByBranch(ctx, "", "main", 10); err == nil {
		t.Fatal("expected error for empty tenantID (branch)")
	}
	if _, err := svc.ListDeployEventsByEnv(ctx, "t1", "", 10); err == nil {
		t.Fatal("expected error for empty env")
	}
	if _, err := svc.ListDeployEventsByActor(ctx, "t1", "", 10); err == nil {
		t.Fatal("expected error for empty actorID")
	}
}

func TestDE_GetTenantIsolation(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	repo.deployEvents["de-1"] = &models.DeployEvent{ID: "de-1", TenantID: "t1"}
	evt, err := svc.GetDeployEvent(ctx, "t1", "de-1")
	if err != nil || evt == nil {
		t.Fatalf("get own tenant: evt=%v err=%v", evt, err)
	}
	if evt.TenantID != "t1" {
		t.Fatalf("tenantId = %q", evt.TenantID)
	}
	// Other tenant sees nothing.
	evt, err = svc.GetDeployEvent(ctx, "t2", "de-1")
	if err != nil || evt != nil {
		t.Fatalf("cross-tenant get: evt=%v err=%v", evt, err)
	}
	// Empty args.
	if _, err := svc.GetDeployEvent(ctx, "", "de-1"); err == nil {
		t.Fatal("expected error for empty tenantID")
	}
	if _, err := svc.GetDeployEvent(ctx, "t1", ""); err == nil {
		t.Fatal("expected error for empty id")
	}
}

func TestDE_GetAuditTrail_FullChain(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	now := time.Now()
	// 3 events: two on main/prod (dedup should collapse envs), one on release/staging.
	repo.deployEvents["de-1"] = &models.DeployEvent{ID: "de-1", TenantID: "t1", Branch: "main", Env: "prod", ArtifactID: "art-1", ApprovalID: "cm-1", StartedAt: now, CreatedAt: now}
	repo.deployEvents["de-2"] = &models.DeployEvent{ID: "de-2", TenantID: "t1", Branch: "main", Env: "prod", ArtifactID: "art-2", ApprovalID: "cm-1", StartedAt: now, CreatedAt: now}
	repo.deployEvents["de-3"] = &models.DeployEvent{ID: "de-3", TenantID: "t1", Branch: "release", Env: "staging", ArtifactID: "art-3", ApprovalID: "cm-2", StartedAt: now, CreatedAt: now}
	res, err := svc.GetAuditTrail(ctx, "t1", models.AuditTrailParams{})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(res.Events) != 3 {
		t.Fatalf("events = %d, want 3", len(res.Events))
	}
	if len(res.Branches) != 2 || res.Branches[0] != "main" || res.Branches[1] != "release" {
		t.Fatalf("branches = %v, want [main release]", res.Branches)
	}
	if len(res.Envs) != 2 || res.Envs[0] != "prod" || res.Envs[1] != "staging" {
		t.Fatalf("envs = %v, want [prod staging]", res.Envs)
	}
	if len(res.ArtifactIDs) != 3 {
		t.Fatalf("artifactIds = %v, want 3 unique", res.ArtifactIDs)
	}
	if len(res.ApprovalIDs) != 2 {
		t.Fatalf("approvalIds = %v, want 2 unique (dedup cm-1)", res.ApprovalIDs)
	}
	if res.GeneratedAt.IsZero() {
		t.Fatal("generatedAt not set")
	}
}

func TestDE_GetAuditTrail_Filters(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	ctx := context.Background()
	now := time.Now()
	repo.deployEvents["de-1"] = &models.DeployEvent{ID: "de-1", TenantID: "t1", Branch: "main", Env: "prod", ArtifactID: "art-1", ApprovalID: "cm-1", StartedAt: now, CreatedAt: now}
	repo.deployEvents["de-2"] = &models.DeployEvent{ID: "de-2", TenantID: "t1", Branch: "release", Env: "prod", ArtifactID: "art-2", ApprovalID: "cm-1", StartedAt: now, CreatedAt: now}
	repo.deployEvents["de-3"] = &models.DeployEvent{ID: "de-3", TenantID: "t1", Branch: "main", Env: "staging", ArtifactID: "art-1", ApprovalID: "cm-2", StartedAt: now, CreatedAt: now}
	// ArtifactID filter (client-side, art-1 matches de-1 and de-3).
	res, err := svc.GetAuditTrail(ctx, "t1", models.AuditTrailParams{ArtifactID: "art-1"})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(res.Events) != 2 {
		t.Fatalf("artifactId filter len = %d, want 2", len(res.Events))
	}
	// Branch + Env AND.
	res, _ = svc.GetAuditTrail(ctx, "t1", models.AuditTrailParams{Branch: "main", Env: "prod"})
	if len(res.Events) != 1 || res.Events[0].ID != "de-1" {
		t.Fatalf("branch+env AND len = %d", len(res.Events))
	}
	// ApprovalID filter.
	res, _ = svc.GetAuditTrail(ctx, "t1", models.AuditTrailParams{ApprovalID: "cm-2"})
	if len(res.Events) != 1 || res.Events[0].ID != "de-3" {
		t.Fatalf("approvalId filter len = %d", len(res.Events))
	}
	// Empty tenantID.
	if _, err := svc.GetAuditTrail(ctx, "", models.AuditTrailParams{}); err == nil {
		t.Fatal("expected error for empty tenantID")
	}
}

// ============================================================================
// P0-MB Phase 5 — PreDeployGate (R1-R6) + MergePreview tests
// ============================================================================

// helper: set up a passing baseline for PreDeployGate so each test only has
// to override the fields that matter.
func newGateBaseline(t *testing.T, tenantID string) (*Service, *fakeRepo, models.DeployRequest) {
	t.Helper()
	repo := newFakeRepo()
	svc := NewService(repo)
	now := time.Now()

	// Branch profile: active, allowedPipelines includes "ci-prod".
	profID := "bp-1"
	repo.branchProfiles[profID] = &models.BranchProfile{
		ID:               profID,
		TenantID:         tenantID,
		RepoID:           "r1",
		Name:             "release/enterprise-2026",
		Semantic:         models.BranchRelease,
		OwnerID:          "u1",
		Status:           models.BranchStatusActive,
		AllowedPipelines: []string{"ci-prod", "ci-ent"},
		CreatedAt:        now,
		UpdatedAt:        now,
		MergeTargets:     []string{"main"},
	}
	// Namespace binding for the profile+env: imageTagPrefix matches.
	repo.namespaceBindings["nb-1"] = &models.NamespaceBinding{
		ID:              "nb-1",
		TenantID:        tenantID,
		BranchProfileID: profID,
		EnvName:         "prod",
		K8sNamespace:    "k8s-prod",
		ImageTagPrefix:  "release-ent-2026",
		DBName:          "db_prod",
		RedisKeyPrefix:  "redis_prod:",
		CreatedAt:       now,
	}
	// Signed artifact.
	repo.artifacts["art-1"] = &models.BuildArtifact{
		ID:          "art-1",
		TenantID:    tenantID,
		ImageDigest: "sha256:" + strings.Repeat("a", 64),
		ImageTag:    "release-ent-2026/v1.0.0",
		SignedBy:    "ci-prod",
		BuiltAt:     now,
	}

	req := models.DeployRequest{
		TenantID:     tenantID,
		Branch:       profID, // lookupBranchProfile resolves via GetBranchProfile(id)
		TargetEnv:    "prod",
		ImageTag:     "release-ent-2026/v1.0.0",
		ArtifactID:   "art-1",
		ApprovalID:   "cm-1",
		PipelineName: "ci-prod",
	}
	return svc, repo, req
}

func TestPDG_CheckPreDeployGate_AllPass(t *testing.T) {
	ctx := context.Background()
	svc, _, req := newGateBaseline(t, "t1")
	res, err := svc.CheckPreDeployGate(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !res.Passed {
		t.Fatalf("expected Passed=true, got Blocked=%v", res.Blocked)
	}
	if len(res.Rules) != 6 {
		t.Fatalf("expected 6 rules, got %d", len(res.Rules))
	}
	for _, r := range res.Rules {
		if !r.Passed {
			t.Fatalf("rule %s failed unexpectedly: %s", r.RuleID, r.Detail)
		}
	}
}

func TestPDG_CheckPreDeployGate_R1ImageTagMismatch(t *testing.T) {
	ctx := context.Background()
	svc, _, req := newGateBaseline(t, "t1")
	req.ImageTag = "wrong-tag-prefix/v1.0.0"
	res, err := svc.CheckPreDeployGate(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Passed {
		t.Fatalf("expected Passed=false, got Blocked=%v", res.Blocked)
	}
	if !containsRule(res.Blocked, GateRuleIDBranchEnv) {
		t.Fatalf("expected R1 in Blocked, got %v", res.Blocked)
	}
}

func TestPDG_CheckPreDeployGate_R2UnsignedArtifact(t *testing.T) {
	ctx := context.Background()
	svc, repo, req := newGateBaseline(t, "t1")
	repo.artifacts["art-1"].SignedBy = "" // unsigned
	res, err := svc.CheckPreDeployGate(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Passed {
		t.Fatalf("expected Passed=false, got Blocked=%v", res.Blocked)
	}
	if !containsRule(res.Blocked, GateRuleIDDigest) {
		t.Fatalf("expected R2 in Blocked, got %v", res.Blocked)
	}
}

func TestPDG_CheckPreDeployGate_R2SkipsWhenArtifactMissing(t *testing.T) {
	ctx := context.Background()
	svc, _, req := newGateBaseline(t, "t1")
	req.ArtifactID = ""
	res, err := svc.CheckPreDeployGate(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !res.Passed {
		t.Fatalf("expected Passed=true when artifactId omitted, got Blocked=%v", res.Blocked)
	}
}

func TestPDG_CheckPreDeployGate_R3MissingApproval(t *testing.T) {
	ctx := context.Background()
	svc, _, req := newGateBaseline(t, "t1")
	req.ApprovalID = ""
	res, err := svc.CheckPreDeployGate(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Passed {
		t.Fatalf("expected Passed=false, got Blocked=%v", res.Blocked)
	}
	if !containsRule(res.Blocked, GateRuleIDApproval) {
		t.Fatalf("expected R3 in Blocked, got %v", res.Blocked)
	}
}

func TestPDG_CheckPreDeployGate_R4ArchivedBranch(t *testing.T) {
	ctx := context.Background()
	svc, repo, req := newGateBaseline(t, "t1")
	repo.branchProfiles["bp-1"].Status = models.BranchStatusArchived
	res, err := svc.CheckPreDeployGate(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Passed {
		t.Fatalf("expected Passed=false, got Blocked=%v", res.Blocked)
	}
	if !containsRule(res.Blocked, GateRuleIDBranchActive) {
		t.Fatalf("expected R4 in Blocked, got %v", res.Blocked)
	}
}

func TestPDG_CheckPreDeployGate_R5PipelineNotAllowed(t *testing.T) {
	ctx := context.Background()
	svc, _, req := newGateBaseline(t, "t1")
	req.PipelineName = "ci-evil"
	res, err := svc.CheckPreDeployGate(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Passed {
		t.Fatalf("expected Passed=false, got Blocked=%v", res.Blocked)
	}
	if !containsRule(res.Blocked, GateRuleIDPipeline) {
		t.Fatalf("expected R5 in Blocked, got %v", res.Blocked)
	}
}

func TestPDG_CheckPreDeployGate_MultipleFailures(t *testing.T) {
	ctx := context.Background()
	svc, _, req := newGateBaseline(t, "t1")
	req.ApprovalID = ""
	req.PipelineName = "ci-evil"
	req.ImageTag = "wrong"
	res, err := svc.CheckPreDeployGate(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Passed {
		t.Fatalf("expected Passed=false")
	}
	if len(res.Blocked) != 3 {
		t.Fatalf("expected 3 blocking failures, got %v", res.Blocked)
	}
}

func TestPDG_CheckPreDeployGate_Validation(t *testing.T) {
	ctx := context.Background()
	svc, _, req := newGateBaseline(t, "t1")
	if _, err := svc.CheckPreDeployGate(ctx, "", req); err == nil {
		t.Fatal("expected error for empty tenantID")
	}
	if _, err := svc.CheckPreDeployGate(ctx, "t1", models.DeployRequest{}); err == nil {
		t.Fatal("expected error for missing branch")
	}
	if _, err := svc.CheckPreDeployGate(ctx, "t1", models.DeployRequest{Branch: "b"}); err == nil {
		t.Fatal("expected error for missing targetEnv")
	}
}

func TestPDG_CheckPreDeployGate_UnknownBranchSkipsR4R5(t *testing.T) {
	ctx := context.Background()
	svc, _, req := newGateBaseline(t, "t1")
	req.Branch = "unknown-bp-id"
	res, err := svc.CheckPreDeployGate(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	// R4 and R5 should be skipped (warning) — they should NOT be in Blocked.
	if containsRule(res.Blocked, GateRuleIDBranchActive) {
		t.Fatalf("R4 should be skipped when profile unknown, got Blocked=%v", res.Blocked)
	}
	if containsRule(res.Blocked, GateRuleIDPipeline) {
		t.Fatalf("R5 should be skipped when profile unknown, got Blocked=%v", res.Blocked)
	}
	// R1 may fail because we can't look up the binding for "unknown-bp-id".
	// That is expected behavior — verifyImageTagMatch returns false for
	// a profile that has no binding.
	_ = res
}

// containsRule is a small test helper (mirrors containsString but keeps the
// test file self-contained).
func containsRule(list []string, id string) bool {
	for _, v := range list {
		if v == id {
			return true
		}
	}
	return false
}

func TestMP_CreateMergePreview_Validation(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newFakeRepo())
	if _, err := svc.CreateMergePreview(ctx, "", &models.MergePreviewRequest{SourceBranch: "a", TargetBranch: "b"}); err == nil {
		t.Fatal("expected error for empty tenantID")
	}
	if _, err := svc.CreateMergePreview(ctx, "t1", nil); err == nil {
		t.Fatal("expected error for nil req")
	}
	if _, err := svc.CreateMergePreview(ctx, "t1", &models.MergePreviewRequest{TargetBranch: "b"}); err == nil {
		t.Fatal("expected error for missing sourceBranch")
	}
	if _, err := svc.CreateMergePreview(ctx, "t1", &models.MergePreviewRequest{SourceBranch: "a"}); err == nil {
		t.Fatal("expected error for missing targetBranch")
	}
	if _, err := svc.CreateMergePreview(ctx, "t1", &models.MergePreviewRequest{SourceBranch: "a", TargetBranch: "a"}); err == nil {
		t.Fatal("expected error when source==target")
	}
	if _, err := svc.CreateMergePreview(ctx, "t1", &models.MergePreviewRequest{SourceBranch: "a", TargetBranch: "b", SourceCommit: "xyz"}); err == nil {
		t.Fatal("expected error for bad sourceCommit")
	}
	if _, err := svc.CreateMergePreview(ctx, "t1", &models.MergePreviewRequest{SourceBranch: "a", TargetBranch: "b", TargetCommit: "xyz"}); err == nil {
		t.Fatal("expected error for bad targetCommit")
	}
}

func TestMP_CreateMergePreview_HappyPath(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := NewService(repo)
	req := &models.MergePreviewRequest{
		SourceBranch: "feat/x",
		TargetBranch: "main",
		SourceCommit: "abcdef1234567890",
		TargetCommit: "1234567890abcdef",
		ConflictFiles: []string{"a.go", "b.go"},
		AddedFiles:    []string{"new.go"},
		ModifiedFiles: []string{"c.go"},
		DeletedFiles:  []string{"old.go"},
	}
	p, err := svc.CreateMergePreview(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if p.ID == "" || !strings.HasPrefix(p.ID, "mp-") {
		t.Fatalf("expected mp- prefixed id, got %q", p.ID)
	}
	if p.TenantID != "t1" || p.SourceBranch != "feat/x" || p.TargetBranch != "main" {
		t.Fatalf("unexpected preview fields: %+v", p)
	}
	if p.ConflictCount != 2 {
		t.Fatalf("expected ConflictCount=2, got %d", p.ConflictCount)
	}
	if p.RiskLevel != models.RiskLevelMedium {
		t.Fatalf("expected RiskLevel=medium, got %s", p.RiskLevel)
	}
	if repo.mergePreviews[p.ID] == nil {
		t.Fatal("expected preview to be persisted")
	}
}

func TestMP_RiskLevelBuckets(t *testing.T) {
	cases := []struct {
		n    int
		want models.RiskLevel
	}{
		{0, models.RiskLevelLow},
		{1, models.RiskLevelMedium},
		{2, models.RiskLevelMedium},
		{3, models.RiskLevelHigh},
		{5, models.RiskLevelHigh},
		{6, models.RiskLevelCritical},
		{100, models.RiskLevelCritical},
	}
	for _, c := range cases {
		if got := riskLevelForConflicts(c.n); got != c.want {
			t.Fatalf("riskLevelForConflicts(%d)=%s, want %s", c.n, got, c.want)
		}
	}
}

func TestMP_GetMergePreview_TenantScoped(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := NewService(repo)
	repo.mergePreviews["mp-1"] = &models.MergePreview{ID: "mp-1", TenantID: "t1", SourceBranch: "a", TargetBranch: "b", PreviewedAt: time.Now()}
	if _, err := svc.GetMergePreview(ctx, "t2", "mp-1"); err == nil {
		t.Fatal("expected error for cross-tenant get")
	}
	if _, err := svc.GetMergePreview(ctx, "", "mp-1"); err == nil {
		t.Fatal("expected error for empty tenantID")
	}
	if _, err := svc.GetMergePreview(ctx, "t1", ""); err == nil {
		t.Fatal("expected error for empty id")
	}
	p, err := svc.GetMergePreview(ctx, "t1", "mp-1")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if p.ID != "mp-1" {
		t.Fatalf("unexpected preview: %+v", p)
	}
}

func TestMP_ListMergePreviews_LimitAndOrder(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := NewService(repo)
	now := time.Now()
	for i := 0; i < 5; i++ {
		id := fmt.Sprintf("mp-%d", i)
		repo.mergePreviews[id] = &models.MergePreview{
			ID:          id,
			TenantID:    "t1",
			SourceBranch: "a",
			TargetBranch: "b",
			PreviewedAt: now.Add(time.Duration(i) * time.Second),
		}
	}
	// Other-tenant preview should not leak.
	repo.mergePreviews["mp-other"] = &models.MergePreview{ID: "mp-other", TenantID: "t2", SourceBranch: "a", TargetBranch: "b", PreviewedAt: now}
	out, err := svc.ListMergePreviews(ctx, "t1", 3)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if len(out) != 3 {
		t.Fatalf("expected 3 previews, got %d", len(out))
	}
	// Newest first — mp-4 should be first.
	if out[0].ID != "mp-4" {
		t.Fatalf("expected mp-4 first, got %s", out[0].ID)
	}
	// Cap check.
	out, _ = svc.ListMergePreviews(ctx, "t1", 5000)
	if len(out) != 5 {
		t.Fatalf("expected 5 (cap 1000 not hit, all returned), got %d", len(out))
	}
	// Default limit.
	out, _ = svc.ListMergePreviews(ctx, "t1", 0)
	if len(out) != 5 {
		t.Fatalf("expected 5 with default limit, got %d", len(out))
	}
}
