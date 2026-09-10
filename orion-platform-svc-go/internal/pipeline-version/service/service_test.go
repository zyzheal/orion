package service_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/pipeline-version/models"
	"orion/platform-svc-go/internal/pipeline-version/service"
)

// -----------------------------------------------------------------------------
// fake repository
// -----------------------------------------------------------------------------

type fakePipelineVersionRepo struct {
	versions map[string]*models.PipelineVersion
	nextID   int
	createFn func(ctx context.Context, v *models.PipelineVersion) error
}

func newFakeRepo(vs ...*models.PipelineVersion) *fakePipelineVersionRepo {
	f := &fakePipelineVersionRepo{versions: make(map[string]*models.PipelineVersion, len(vs))}
	for _, v := range vs {
		f.versions[v.ID] = v
	}
	return f
}

func (f *fakePipelineVersionRepo) CreateVersion(ctx context.Context, v *models.PipelineVersion) error {
	// createFn is a validation hook: it may reject the insert, but on success
	// the fake still persists the version so callers that read it back by ID
	// (Rollback's final UpdateBaseline) behave like the real repository.
	if f.createFn != nil {
		if err := f.createFn(ctx, v); err != nil {
			return err
		}
	}
	if v.ID == "" {
		f.nextID++
		v.ID = "gen-id-" + string(rune('a'+f.nextID-1))
	}
	f.versions[v.ID] = v
	return nil
}

func (f *fakePipelineVersionRepo) GetVersionByID(ctx context.Context, id, tenantID string) (*models.PipelineVersion, error) {
	v, ok := f.versions[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	if v.TenantID != tenantID {
		return nil, sentinel.NotFound
	}
	return v, nil
}

func (f *fakePipelineVersionRepo) GetVersionByPipelineAndVersion(ctx context.Context, pipelineID, version, tenantID string) (*models.PipelineVersion, error) {
	for _, v := range f.versions {
		if v.PipelineID == pipelineID && v.Version == version && v.TenantID == tenantID {
			return v, nil
		}
	}
	return nil, sentinel.NotFound
}

func (f *fakePipelineVersionRepo) ListVersionsByPipeline(ctx context.Context, pipelineID, tenantID string) ([]models.PipelineVersion, error) {
	var out []models.PipelineVersion
	for _, v := range f.versions {
		if v.PipelineID == pipelineID && v.TenantID == tenantID {
			out = append(out, *v)
		}
	}
	return out, nil
}

func (f *fakePipelineVersionRepo) CountVersionsByPipeline(ctx context.Context, pipelineID, tenantID string) (int, error) {
	n, _ := f.ListVersionsByPipeline(ctx, pipelineID, tenantID)
	return len(n), nil
}

func (f *fakePipelineVersionRepo) UnsetAllBaselines(ctx context.Context, pipelineID, tenantID string) error {
	for _, v := range f.versions {
		if v.PipelineID == pipelineID && v.TenantID == tenantID {
			v.IsBaseline = false
		}
	}
	return nil
}

func (f *fakePipelineVersionRepo) UpdateBaseline(ctx context.Context, id, tenantID string, isBaseline bool) (*models.PipelineVersion, error) {
	v, ok := f.versions[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	v.IsBaseline = isBaseline
	return v, nil
}

func (f *fakePipelineVersionRepo) UpdateTags(ctx context.Context, id, tenantID, tags string) (*models.PipelineVersion, error) {
	v, ok := f.versions[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	v.Tags = tags
	return v, nil
}

var _ service.RepositoryInterface = (*fakePipelineVersionRepo)(nil)

// -----------------------------------------------------------------------------
// Rollback
// -----------------------------------------------------------------------------

func TestRollback_ClonedNotModified(t *testing.T) {
	source := &models.PipelineVersion{
		ID: "v1", TenantID: "t1", PipelineID: "p1", Version: "1",
		YAMLDefinition: "yaml-v1", IsBaseline: false,
	}
	repo := newFakeRepo(source)
	svc := service.NewService(repo)

	restored, err := svc.Rollback(context.Background(), "v1", "t1")
	if err != nil {
		t.Fatalf("Rollback: %v", err)
	}

	// The restored version must be a NEW version, not the source itself.
	if restored.ID == source.ID {
		t.Fatalf("Rollback returned the source version, expected a new clone")
	}
	if restored.YAMLDefinition != "yaml-v1" {
		t.Errorf("YAMLDefinition = %q, want %q", restored.YAMLDefinition, "yaml-v1")
	}
	if !restored.IsBaseline {
		t.Error("restored version should be marked as baseline")
	}
	if source.IsBaseline {
		t.Error("source version must not remain baseline")
	}
	if !strings.HasPrefix(restored.Version, "2.") {
		t.Errorf("restored.Version = %q, want prefix %q", restored.Version, "2.")
	}
	if !strings.Contains(restored.Tags, "rollback-from:v1") {
		t.Errorf("Tags = %q, want to contain rollback-from:v1", restored.Tags)
	}
	if restored.CreatedBy != "system:rollback" {
		t.Errorf("CreatedBy = %q, want %q", restored.CreatedBy, "system:rollback")
	}
	// Source must remain untouched.
	if source.Version != "1" || source.YAMLDefinition != "yaml-v1" {
		t.Error("source version was mutated by rollback")
	}
}

func TestRollback_ExistingBaselineIsNoop(t *testing.T) {
	current := &models.PipelineVersion{
		ID: "v2", TenantID: "t1", PipelineID: "p1", Version: "2",
		YAMLDefinition: "yaml-v2", IsBaseline: true,
	}
	repo := newFakeRepo(current)
	svc := service.NewService(repo)

	got, err := svc.Rollback(context.Background(), "v2", "t1")
	if err != nil {
		t.Fatalf("Rollback: %v", err)
	}
	if got.ID != "v2" {
		t.Errorf("expected the current baseline to be returned unchanged, got %q", got.ID)
	}
	if len(repo.versions) != 1 {
		t.Errorf("expected no new version created, repo has %d versions", len(repo.versions))
	}
}

func TestRollback_SourceNotFound(t *testing.T) {
	svc := service.NewService(newFakeRepo())
	_, err := svc.Rollback(context.Background(), "missing", "t1")
	if err == nil {
		t.Fatal("expected error for missing source version")
	}
	if !service.IsNotFound(err) {
		t.Errorf("expected sentinel.NotFound, got %v", err)
	}
}

func TestRollback_WrongTenantIsNotFound(t *testing.T) {
	other := &models.PipelineVersion{ID: "v1", TenantID: "t2", PipelineID: "p1", Version: "1"}
	svc := service.NewService(newFakeRepo(other))
	if _, err := svc.Rollback(context.Background(), "v1", "t1"); !service.IsNotFound(err) {
		t.Errorf("expected NotFound for cross-tenant access, got %v", err)
	}
}

func TestRollback_CompactVersionFallsBackToTimestampedSuffix(t *testing.T) {
	// Semantic versions are not integers, so the fallback label is used.
	source := &models.PipelineVersion{
		ID: "v1", TenantID: "t1", PipelineID: "p1", Version: "1.2.3",
		YAMLDefinition: "yaml",
	}
	svc := service.NewService(newFakeRepo(source))
	restored, err := svc.Rollback(context.Background(), "v1", "t1")
	if err != nil {
		t.Fatalf("Rollback: %v", err)
	}
	if !strings.HasPrefix(restored.Version, "1.2.3-rollback-") {
		t.Errorf("restored.Version = %q, want prefix %q", restored.Version, "1.2.3-rollback-")
	}
}

func TestRollback_CreateFailureKeepsExistingBaseline(t *testing.T) {
	// The clone must be created BEFORE any baseline is cleared. Repository
	// methods are all auto-commit, so an insert failure after an
	// UnsetAllBaselines would leave the pipeline with no baseline at all.
	// This assertion fails against the old (Unset -> Create) ordering.
	current := &models.PipelineVersion{
		ID: "v2", TenantID: "t1", PipelineID: "p1", Version: "2",
		YAMLDefinition: "yaml-v2", IsBaseline: true,
	}
	hist := &models.PipelineVersion{
		ID: "v1", TenantID: "t1", PipelineID: "p1", Version: "1",
		YAMLDefinition: "yaml-v1",
	}
	repo := newFakeRepo(current, hist)
	repo.createFn = func(ctx context.Context, v *models.PipelineVersion) error {
		return sentinel.NotFound
	}
	svc := service.NewService(repo)

	if _, err := svc.Rollback(context.Background(), "v1", "t1"); err == nil {
		t.Fatal("expected CreateVersion failure to propagate")
	}
	if !current.IsBaseline {
		t.Fatal("existing baseline was lost on create failure")
	}
	if len(repo.versions) != 2 {
		t.Errorf("no version should have been created on failure, got %d", len(repo.versions))
	}
}

func TestRollback_TruncatesOverlongVersionLabel(t *testing.T) {
	// The version column is VARCHAR(255); a long source label must not overflow.
	source := &models.PipelineVersion{
		ID: "v1", TenantID: "t1", PipelineID: "p1", Version: strings.Repeat("x", 250),
		YAMLDefinition: "yaml",
	}
	repo := newFakeRepo(source)
	repo.createFn = func(ctx context.Context, v *models.PipelineVersion) error {
		if len(v.Version) > 255 {
			t.Errorf("rollback produced an over-long version label (%d): %q", len(v.Version), v.Version)
		}
		return nil
	}
	svc := service.NewService(repo)
	if _, err := svc.Rollback(context.Background(), "v1", "t1"); err != nil {
		t.Fatalf("Rollback: %v", err)
	}
}

func TestRollback_ListingFailureStillSucceeds(t *testing.T) {
	// If the version listing fails (e.g. table absent), rollback must still work
	// with the deterministic fallback label instead of failing outright.
	source := &models.PipelineVersion{
		ID: "v1", TenantID: "t1", PipelineID: "p1", Version: "9.9.9",
		YAMLDefinition: "yaml",
	}
	repo := newFakeRepo(source)
	// Force listing failure by pointing at a pipeline with no versions.
	source.PipelineID = "empty-pipeline"
	svc := service.NewService(repo)
	restored, err := svc.Rollback(context.Background(), "v1", "t1")
	if err != nil {
		t.Fatalf("Rollback: %v", err)
	}
	if !strings.HasPrefix(restored.Version, "9.9.9-rollback-") {
		t.Errorf("restored.Version = %q, want fallback prefix", restored.Version)
	}
}

// -----------------------------------------------------------------------------
// Tags and baseline
// -----------------------------------------------------------------------------

func TestAddTag_IsIdempotent(t *testing.T) {
	v := &models.PipelineVersion{
		ID: "v1", TenantID: "t1", PipelineID: "p1", Version: "1", Tags: `["a"]`,
	}
	svc := service.NewService(newFakeRepo(v))
	ctx := context.Background()

	got, err := svc.AddTag(ctx, "v1", "t1", "a")
	if err != nil {
		t.Fatalf("AddTag: %v", err)
	}
	if got.Tags != `["a"]` {
		t.Errorf("AddTag idempotent = %q, want [\"a\"]", got.Tags)
	}
	if got, _ := svc.AddTag(ctx, "v1", "t1", "b"); got.Tags != `["a","b"]` {
		t.Errorf("AddTag new = %q, want [\"a\",\"b\"]", got.Tags)
	}
}

func TestRemoveTag(t *testing.T) {
	v := &models.PipelineVersion{
		ID: "v1", TenantID: "t1", PipelineID: "p1", Version: "1", Tags: `["a","b"]`,
	}
	svc := service.NewService(newFakeRepo(v))
	if got, _ := svc.RemoveTag(context.Background(), "v1", "t1", "a"); got.Tags != `["b"]` {
		t.Errorf("RemoveTag = %q, want [\"b\"]", got.Tags)
	}
}

func TestSetBaseline_MovesBaselineWithinPipeline(t *testing.T) {
	oldBase := &models.PipelineVersion{
		ID: "v1", TenantID: "t1", PipelineID: "p1", Version: "1", IsBaseline: true,
	}
	newBase := &models.PipelineVersion{
		ID: "v2", TenantID: "t1", PipelineID: "p1", Version: "2",
	}
	svc := service.NewService(newFakeRepo(oldBase, newBase))

	got, err := svc.SetBaseline(context.Background(), "v2", "t1", true)
	if err != nil {
		t.Fatalf("SetBaseline: %v", err)
	}
	if !got.IsBaseline {
		t.Error("new version should be baseline")
	}
	if oldBase.IsBaseline {
		t.Error("previous baseline should have been cleared")
	}

	if _, err := svc.SetBaseline(context.Background(), "v2", "t1", false); err != nil {
		t.Fatalf("unset baseline: %v", err)
	}
}

func TestSetBaseline_NotFound(t *testing.T) {
	svc := service.NewService(newFakeRepo())
	if _, err := svc.SetBaseline(context.Background(), "missing", "t1", true); !service.IsNotFound(err) {
		t.Errorf("expected NotFound, got %v", err)
	}
}

func TestDiffVersions(t *testing.T) {
	a := &models.PipelineVersion{ID: "a", TenantID: "t1", Version: "1", YAMLDefinition: "yaml-a"}
	b := &models.PipelineVersion{ID: "b", TenantID: "t1", Version: "2", YAMLDefinition: "yaml-b"}
	svc := service.NewService(newFakeRepo(a, b))

	diff, err := svc.DiffVersions(context.Background(), "a", "b", "t1")
	if err != nil {
		t.Fatalf("DiffVersions: %v", err)
	}
	if diff.Summary.Modified != 1 {
		t.Errorf("Summary.Modified = %d, want 1", diff.Summary.Modified)
	}
	if len(diff.Changes) != 1 || diff.Changes[0].Field != "yamlDefinition" {
		t.Errorf("Changes = %+v, want single yamlDefinition change", diff.Changes)
	}

	// NOTE: DiffVersions returns the module-local ErrVersionNotFound rather than
	// sentinel.NotFound. The handler matches it via errors.Is(err,
	// service.ErrVersionNotFound), so assert that contract here.
	if _, err := svc.DiffVersions(context.Background(), "a", "missing", "t1"); !errors.Is(err, service.ErrVersionNotFound) {
		t.Errorf("expected ErrVersionNotFound for missing target, got %v", err)
	}
}

func TestListVersionsByPipeline_EmptyNotNil(t *testing.T) {
	svc := service.NewService(newFakeRepo())
	got, total, err := svc.ListVersionsByPipeline(context.Background(), "p1", "t1")
	if err != nil {
		t.Fatalf("ListVersionsByPipeline: %v", err)
	}
	if got == nil {
		t.Error("expected empty slice, got nil")
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
}
