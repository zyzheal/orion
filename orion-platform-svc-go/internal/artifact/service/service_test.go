package service

import (
	"context"
	"errors"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/artifact/models"
)

// fakeRepo records the tenant id each repository call received.
//
// These calls are the ones that used to drop the tenant: the service took it as
// a parameter and never passed it down, so the repository queried the shared
// artifact tables without a tenant predicate and one tenant could read and
// overwrite another tenant's tags, downloads and promotion history.
type fakeRepo struct {
	store map[string]*models.Artifact

	seenTenant map[string]string
	nextStage  string

	currentStageErr error
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{store: map[string]*models.Artifact{}, seenTenant: map[string]string{}}
}

func (f *fakeRepo) mark(call, tenantID string) { f.seenTenant[call] = tenantID }

func (f *fakeRepo) Create(ctx context.Context, m *models.Artifact) error {
	f.store[m.ID] = m
	return nil
}

func (f *fakeRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	if m, ok := f.store[id]; ok {
		return m, nil
	}
	return nil, ErrNotFoundArtifact(id)
}

func (f *fakeRepo) ExistsByNamespaceNameVersion(ctx context.Context, tenantID, namespace, name, version string) (bool, error) {
	return false, nil
}

func (f *fakeRepo) List(ctx context.Context, tenantID string, q models.ListArtifactsQuery) ([]models.Artifact, error) {
	return nil, nil
}

func (f *fakeRepo) Count(ctx context.Context, tenantID string, q models.ListArtifactsQuery) (int, error) {
	return 0, nil
}

func (f *fakeRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	m, ok := f.store[id]
	if !ok {
		return ErrNotFoundArtifact(id)
	}
	if s, ok := updates["status"]; ok {
		m.Status = s.(models.ArtifactStatus)
	}
	if v, ok := updates["metadata"]; ok {
		m.Metadata = v.(string)
	}
	return nil
}

func (f *fakeRepo) SoftDelete(ctx context.Context, tenantID, id string) error {
	delete(f.store, id)
	return nil
}

func (f *fakeRepo) AddTags(ctx context.Context, tenantID, artifactID string, tags []string) error {
	f.mark("AddTags", tenantID)
	return nil
}

func (f *fakeRepo) RemoveTags(ctx context.Context, tenantID, artifactID string, tags []string) error {
	f.mark("RemoveTags", tenantID)
	return nil
}

func (f *fakeRepo) GetTags(ctx context.Context, tenantID, artifactID string) ([]string, error) {
	f.mark("GetTags", tenantID)
	return nil, nil
}

func (f *fakeRepo) RecordDownload(ctx context.Context, tenantID, artifactID string, req models.DownloadArtifactRequest) error {
	f.mark("RecordDownload", tenantID)
	return nil
}

func (f *fakeRepo) GetDownloadHistory(ctx context.Context, tenantID, artifactID string) ([]models.ArtifactDownload, error) {
	f.mark("GetDownloadHistory", tenantID)
	return nil, nil
}

func (f *fakeRepo) Search(ctx context.Context, tenantID string, query string, limit, offset int) ([]models.Artifact, error) {
	return nil, nil
}

func (f *fakeRepo) CreatePromotion(ctx context.Context, p *models.ArtifactPromotion) error {
	f.mark("CreatePromotion", p.TenantID)
	return nil
}

func (f *fakeRepo) GetCurrentStage(ctx context.Context, tenantID, id string) (string, error) {
	f.mark("GetCurrentStage", tenantID)
	return f.nextStage, f.currentStageErr
}

func (f *fakeRepo) GetPromotionHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactPromotion, error) {
	return nil, nil
}

func (f *fakeRepo) GetStats(ctx context.Context, tenantID string) (*models.ArtifactStats, error) {
	return nil, nil
}

func (f *fakeRepo) GetTypeStats(ctx context.Context, tenantID string) ([]models.ArtifactTypeStat, error) {
	return nil, nil
}

func (f *fakeRepo) GetNamespaces(ctx context.Context, tenantID string) ([]models.NamespaceStat, error) {
	return nil, nil
}

var _ RepositoryInterface = (*fakeRepo)(nil)

const tenant = "tenant-alpha"

func newArtifact(t *testing.T, repo *fakeRepo) string {
	t.Helper()
	got, err := NewService(repo).Create(context.Background(), tenant, models.CreateArtifactRequest{
		Name: "redis", Namespace: "libs", Version: "7.2", Type: "CONTAINER_IMAGE",
		SizeBytes: 42, StoragePath: "/s3/redis", CreatedBy: "user-1",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	return got.ID
}

func TestPromote_RecordsTheRealCurrentStage(t *testing.T) {
	repo := newFakeRepo()
	repo.nextStage = "staging"
	id := newArtifact(t, repo)

	p, err := NewService(repo).Promote(context.Background(), tenant, id, models.PromoteArtifactRequest{
		PromotedBy: "user-1", Stage: "production", Reason: "sign-off",
	})
	if err != nil {
		t.Fatalf("Promote: %v", err)
	}
	if p.FromStage != "staging" {
		t.Fatalf("FromStage = %q, want the stage the artifact really is at", p.FromStage)
	}
	if p.FromStage == "current" {
		t.Fatal("FromStage is still the literal \"current\", which is not a stage name")
	}
	if p.TenantID != tenant || repo.seenTenant["CreatePromotion"] != tenant {
		t.Fatalf("promotion tenant = %q / repo saw %q", p.TenantID, repo.seenTenant["CreatePromotion"])
	}
}

func TestPromote_NeverPromotedArtifactIsUnstaged(t *testing.T) {
	repo := newFakeRepo()
	id := newArtifact(t, repo)

	p, err := NewService(repo).Promote(context.Background(), tenant, id, models.PromoteArtifactRequest{
		PromotedBy: "user-1", Stage: "production",
	})
	if err != nil {
		t.Fatalf("Promote: %v", err)
	}
	if p.FromStage != "default" {
		t.Fatalf("FromStage = %q for an artifact with no history, want \"default\"", p.FromStage)
	}
}

func TestPromote_PropagatesStageLookupErrors(t *testing.T) {
	repo := newFakeRepo()
	repo.currentStageErr = errors.New("connection refused")
	id := newArtifact(t, repo)

	_, err := NewService(repo).Promote(context.Background(), tenant, id, models.PromoteArtifactRequest{
		PromotedBy: "user-1", Stage: "production",
	})
	if err == nil {
		t.Fatal("Promote must not record a promotion when the current stage cannot be read")
	}
}

func TestService_PassesTenantToEverySubResourceCall(t *testing.T) {
	repo := newFakeRepo()
	id := newArtifact(t, repo)
	svc := NewService(repo)

	requireNoError(t, svc.AddTags(context.Background(), tenant, id, []string{"latest"}))
	requireNoError(t, svc.RemoveTags(context.Background(), tenant, id, []string{"latest"}))
	if _, err := svc.GetTags(context.Background(), tenant, id); err != nil {
		requireNoError(t, err)
	}
	if _, err := svc.Download(context.Background(), tenant, id,
		models.DownloadArtifactRequest{DownloadedBy: "user-1"}); err != nil {
		requireNoError(t, err)
	}
	if _, err := svc.GetDownloadHistory(context.Background(), tenant, id); err != nil {
		requireNoError(t, err)
	}

	for call, got := range repo.seenTenant {
		if got != tenant {
			t.Errorf("%s saw tenant %q, want %q", call, got, tenant)
		}
	}
}

func TestGetStage_EmptyHistoryIsNotFound(t *testing.T) {
	repo := newFakeRepo()
	id := newArtifact(t, repo)

	stage, err := NewService(repo).GetCurrentStage(context.Background(), tenant, id)
	if stage != nil {
		t.Fatalf("GetCurrentStage = %v for an artifact with no history", *stage)
	}
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
}

func requireNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
