package service

import (
	"context"
	"errors"
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
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		branchProfiles:    make(map[string]*models.BranchProfile),
		artifacts:         make(map[string]*models.BuildArtifact),
		namespaceBindings: make(map[string]*models.NamespaceBinding),
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
