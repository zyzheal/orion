package service_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/release-management/models"
	"orion/platform-svc-go/internal/release-management/service"
)

// ---------------------------------------------------------------------------
// Fake Repository
// ---------------------------------------------------------------------------

var errNotFound = errors.New("not found")

type fakeReleaseRepo struct {
	releases  map[string]*models.Release
	createID  int
	createErr error
	getErr    error
	listErr   error
	updateErr error
	deleteErr error
	approveErr error
}

func newFakeReleaseRepo() *fakeReleaseRepo {
	return &fakeReleaseRepo{
		releases: make(map[string]*models.Release),
	}
}

func (f *fakeReleaseRepo) Create(ctx context.Context, tenantID string, req *models.CreateReleaseRequest) (*models.Release, error) {
	if f.createErr != nil {
		return nil, f.createErr
	}
	f.createID++
	now := time.Now().UTC()
	r := &models.Release{
		ID:           "release-" + string(rune('0'+f.createID)),
		TenantID:     tenantID,
		Name:         req.Name,
		Version:      req.Version,
		Description:  req.Description,
		Status:       models.ReleaseStatusDraft,
		ArtifactID:   req.ArtifactID,
		PipelineID:   req.PipelineID,
		ReleaseNotes: req.ReleaseNotes,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	f.releases[r.ID] = r
	return r, nil
}

func (f *fakeReleaseRepo) Get(ctx context.Context, tenantID, id string) (*models.Release, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	r, ok := f.releases[id]
	if !ok {
		return nil, errNotFound
	}
	return r, nil
}

func (f *fakeReleaseRepo) List(ctx context.Context, tenantID string, q models.ListReleasesQuery) (*models.ReleaseListResponse, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	var items []models.Release
	for _, r := range f.releases {
		if r.TenantID != tenantID {
			continue
		}
		if q.Status != nil && r.Status != *q.Status {
			continue
		}
		if q.PipelineID != "" && r.PipelineID != q.PipelineID {
			continue
		}
		items = append(items, *r)
	}
	if items == nil {
		items = []models.Release{}
	}
	page := q.Page
	if page < 1 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	start := (page - 1) * pageSize
	end := start + pageSize
	if start >= len(items) {
		items = []models.Release{}
	} else if end > len(items) {
		items = items[start:]
	} else {
		items = items[start:end]
	}
	return &models.ReleaseListResponse{
		Items:    items,
		Total:    len(items),
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (f *fakeReleaseRepo) Update(ctx context.Context, tenantID, id string, req *models.UpdateReleaseRequest) (*models.Release, error) {
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	r, ok := f.releases[id]
	if !ok {
		return nil, errNotFound
	}
	if req.Name != nil {
		r.Name = *req.Name
	}
	if req.Description != nil {
		r.Description = *req.Description
	}
	if req.ReleaseNotes != nil {
		r.ReleaseNotes = *req.ReleaseNotes
	}
	if req.Status != nil {
		r.Status = *req.Status
	}
	r.UpdatedAt = time.Now().UTC()
	return r, nil
}

func (f *fakeReleaseRepo) Delete(ctx context.Context, tenantID, id string) error {
	if f.deleteErr != nil {
		return f.deleteErr
	}
	if _, ok := f.releases[id]; !ok {
		return errNotFound
	}
	delete(f.releases, id)
	return nil
}

func (f *fakeReleaseRepo) Approve(ctx context.Context, releaseID, approvedBy, comment string) (*models.ReleaseApproval, error) {
	if f.approveErr != nil {
		return nil, f.approveErr
	}
	return &models.ReleaseApproval{
		ID:         "approval-" + releaseID,
		ReleaseID:  releaseID,
		ApprovedBy: approvedBy,
		Comment:    comment,
		CreatedAt:  time.Now().UTC(),
	}, nil
}

func (f *fakeReleaseRepo) RecordRollback(ctx context.Context, releaseID, reason, performedBy string) error {
	r, ok := f.releases[releaseID]
	if !ok {
		return errNotFound
	}
	r.Status = models.ReleaseStatusRolledBack
	r.RollbackID = "rollback-" + releaseID
	r.DeployedBy = performedBy
	r.UpdatedAt = time.Now().UTC()
	return nil
}

var _ service.RepositoryInterface = (*fakeReleaseRepo)(nil)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestService_NewService(t *testing.T) {
	repo := newFakeReleaseRepo()
	s := service.NewService(repo)
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

// --- Create ---

func TestService_Create_success(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	req := &models.CreateReleaseRequest{
		Name:        "release-v1",
		Version:     "1.0.0",
		Description: "First release",
		ArtifactID:  "art-123",
		PipelineID:  "pipe-1",
		ReleaseNotes: "initial",
	}
	r, err := svc.Create(context.Background(), "tenant-1", req)
	if err != nil {
		t.Fatalf("Create error: %v", err)
	}
	if r == nil {
		t.Fatal("Create returned nil release")
	}
	if r.Name != "release-v1" {
		t.Errorf("Name = %q, want release-v1", r.Name)
	}
	if r.Version != "1.0.0" {
		t.Errorf("Version = %q, want 1.0.0", r.Version)
	}
	if r.TenantID != "tenant-1" {
		t.Errorf("TenantID = %q, want tenant-1", r.TenantID)
	}
	if r.Status != models.ReleaseStatusDraft {
		t.Errorf("Status = %q, want draft", r.Status)
	}
	if r.ArtifactID != "art-123" {
		t.Errorf("ArtifactID = %q, want art-123", r.ArtifactID)
	}
	if r.PipelineID != "pipe-1" {
		t.Errorf("PipelineID = %q, want pipe-1", r.PipelineID)
	}
	if r.ReleaseNotes != "initial" {
		t.Errorf("ReleaseNotes = %q, want initial", r.ReleaseNotes)
	}
	if r.ID == "" {
		t.Error("ID should not be empty")
	}
	if r.CreatedAt.IsZero() {
		t.Error("CreatedAt should be set")
	}
}

func TestService_Create_requiresName(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	req := &models.CreateReleaseRequest{
		Version: "1.0.0",
	}
	_, err := svc.Create(context.Background(), "tenant-1", req)
	if err == nil {
		t.Fatal("Create should error when name is empty")
	}
	if !strings.Contains(err.Error(), "name") {
		t.Errorf("error = %q, want contains 'name'", err.Error())
	}
}

func TestService_Create_requiresVersion(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	req := &models.CreateReleaseRequest{
		Name: "release-v1",
	}
	_, err := svc.Create(context.Background(), "tenant-1", req)
	if err == nil {
		t.Fatal("Create should error when version is empty")
	}
	if !strings.Contains(err.Error(), "version") {
		t.Errorf("error = %q, want contains 'version'", err.Error())
	}
}

func TestService_Create_repoError(t *testing.T) {
	repo := newFakeReleaseRepo()
	repo.createErr = errors.New("db down")
	svc := service.NewService(repo)

	req := &models.CreateReleaseRequest{
		Name:    "release-v1",
		Version: "1.0.0",
	}
	_, err := svc.Create(context.Background(), "tenant-1", req)
	if err == nil {
		t.Fatal("Create should propagate repo error")
	}
	if err.Error() != "db down" {
		t.Errorf("error = %q, want 'db down'", err.Error())
	}
}

// --- Get ---

func TestService_Get_success(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	// Seed a release
	r, _ := svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:    "release-v1",
		Version: "1.0.0",
	})

	fetched, err := svc.Get(context.Background(), "tenant-1", r.ID)
	if err != nil {
		t.Fatalf("Get error: %v", err)
	}
	if fetched == nil {
		t.Fatal("Get returned nil")
	}
	if fetched.Name != "release-v1" {
		t.Errorf("Name = %q, want release-v1", fetched.Name)
	}
}

func TestService_Get_notFound(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	_, err := svc.Get(context.Background(), "tenant-1", "does-not-exist")
	if err == nil {
		t.Fatal("Get should error when release not found")
	}
}

func TestService_Get_repoError(t *testing.T) {
	repo := newFakeReleaseRepo()
	repo.getErr = errors.New("db down")
	svc := service.NewService(repo)

	_, err := svc.Get(context.Background(), "tenant-1", "id-1")
	if err == nil {
		t.Fatal("Get should propagate repo error")
	}
	if err.Error() != "db down" {
		t.Errorf("error = %q", err.Error())
	}
}

// --- List ---

func TestService_List_success(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:     "r1",
		Version:  "1.0",
		PipelineID: "pipe-a",
	})
	svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:     "r2",
		Version:  "2.0",
		PipelineID: "pipe-b",
	})
	svc.Create(context.Background(), "tenant-2", &models.CreateReleaseRequest{
		Name:    "other",
		Version: "3.0",
	})

	res, err := svc.List(context.Background(), "tenant-1", models.ListReleasesQuery{})
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if res == nil {
		t.Fatal("List returned nil")
	}
	if len(res.Items) != 2 {
		t.Errorf("List tenant-1 items = %d, want 2", len(res.Items))
	}
	if res.PageSize != 20 {
		t.Errorf("PageSize = %d, want default 20", res.PageSize)
	}
}

func TestService_List_filteredByStatus(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:    "draft-r",
		Version: "1.0",
	})

	statusFilter := models.ReleaseStatusApproved
	res, err := svc.List(context.Background(), "tenant-1", models.ListReleasesQuery{
		Status: &statusFilter,
	})
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if len(res.Items) != 0 {
		t.Errorf("List with approved filter = %d items, want 0 (release is draft)", len(res.Items))
	}
}

func TestService_List_empty(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	res, err := svc.List(context.Background(), "tenant-1", models.ListReleasesQuery{})
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if res.Items == nil {
		t.Error("Items should be empty slice, not nil")
	}
	if res.Total != 0 {
		t.Errorf("Total = %d, want 0", res.Total)
	}
}

func TestService_List_repoError(t *testing.T) {
	repo := newFakeReleaseRepo()
	repo.listErr = errors.New("db down")
	svc := service.NewService(repo)

	_, err := svc.List(context.Background(), "tenant-1", models.ListReleasesQuery{})
	if err == nil {
		t.Fatal("List should propagate repo error")
	}
}

// --- Update ---

func TestService_Update_success(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	r, _ := svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:    "release-v1",
		Version: "1.0.0",
	})

	newName := "release-v2"
	newDesc := "Updated description"
	updated, err := svc.Update(context.Background(), "tenant-1", r.ID, &models.UpdateReleaseRequest{
		Name:        &newName,
		Description: &newDesc,
	})
	if err != nil {
		t.Fatalf("Update error: %v", err)
	}
	if updated.Name != "release-v2" {
		t.Errorf("Name = %q, want release-v2", updated.Name)
	}
	if updated.Description != "Updated description" {
		t.Errorf("Description = %q, want 'Updated description'", updated.Description)
	}
}

func TestService_Update_notFound(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	newName := "x"
	_, err := svc.Update(context.Background(), "tenant-1", "no-such-id", &models.UpdateReleaseRequest{
		Name: &newName,
	})
	if err == nil {
		t.Fatal("Update should error on not found")
	}
}

// --- Delete ---

func TestService_Delete_success(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	r, _ := svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:    "release-v1",
		Version: "1.0.0",
	})

	err := svc.Delete(context.Background(), "tenant-1", r.ID)
	if err != nil {
		t.Fatalf("Delete error: %v", err)
	}

	// Verify it's gone
	_, err = svc.Get(context.Background(), "tenant-1", r.ID)
	if err == nil {
		t.Error("Deleted release should not be found")
	}
}

func TestService_Delete_notFound(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	err := svc.Delete(context.Background(), "tenant-1", "no-such-id")
	if err == nil {
		t.Fatal("Delete should error on not found")
	}
}

func TestService_Delete_repoError(t *testing.T) {
	repo := newFakeReleaseRepo()
	repo.deleteErr = errors.New("db down")
	svc := service.NewService(repo)

	err := svc.Delete(context.Background(), "tenant-1", "id-1")
	if err == nil {
		t.Fatal("Delete should propagate repo error")
	}
	if err.Error() != "db down" {
		t.Errorf("error = %q", err.Error())
	}
}

// --- Approve ---

func TestService_Approve_success(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	r, _ := svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:    "release-v1",
		Version: "1.0.0",
	})

	ap, err := svc.Approve(context.Background(), "tenant-1", r.ID, "approver", "LGTM")
	if err != nil {
		t.Fatalf("Approve error: %v", err)
	}
	if ap == nil {
		t.Fatal("Approve returned nil")
	}
	if ap.ReleaseID != r.ID {
		t.Errorf("ReleaseID = %q", ap.ReleaseID)
	}
	if ap.ApprovedBy != "approver" {
		t.Errorf("ApprovedBy = %q, want approver", ap.ApprovedBy)
	}
	if ap.Comment != "LGTM" {
		t.Errorf("Comment = %q, want LGTM", ap.Comment)
	}
}

func TestService_Approve_notDraft(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	r, _ := svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:    "release-v1",
		Version: "1.0.0",
	})
	// Change status to approved directly
	repo.releases[r.ID].Status = models.ReleaseStatusApproved

	_, err := svc.Approve(context.Background(), "tenant-1", r.ID, "approver", "LGTM")
	if err == nil {
		t.Fatal("Approve should error on non-draft release")
	}
	if !strings.Contains(err.Error(), "not in draft status") {
		t.Errorf("error = %q, want 'not in draft status'", err.Error())
	}
}

func TestService_Approve_notFound(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	_, err := svc.Approve(context.Background(), "tenant-1", "no-such", "approver", "c")
	if err == nil {
		t.Fatal("Approve should error on not found")
	}
}

// --- Deploy ---

func TestService_Deploy_success(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	r, _ := svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:    "release-v1",
		Version: "1.0.0",
	})
	// Manually set to approved
	repo.releases[r.ID].Status = models.ReleaseStatusApproved

	updated, err := svc.Deploy(context.Background(), "tenant-1", r.ID, "deployer")
	if err != nil {
		t.Fatalf("Deploy error: %v", err)
	}
	if updated.Status != models.ReleaseStatusDeployed {
		t.Errorf("Status = %q, want deployed", updated.Status)
	}
}

func TestService_Deploy_notApproved(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	r, _ := svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:    "release-v1",
		Version: "1.0.0",
	})
	// Status is still draft

	_, err := svc.Deploy(context.Background(), "tenant-1", r.ID, "deployer")
	if err == nil {
		t.Fatal("Deploy should error on non-approved release")
	}
	if !strings.Contains(err.Error(), "not approved") {
		t.Errorf("error = %q, want 'not approved'", err.Error())
	}
}

// --- Rollback ---

func TestService_Rollback_success(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	r, _ := svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:    "release-v1",
		Version: "1.0.0",
	})
	// Manually set to deployed
	repo.releases[r.ID].Status = models.ReleaseStatusDeployed

	updated, err := svc.Rollback(context.Background(), "tenant-1", r.ID, "bad deploy", "ops-user")
	if err != nil {
		t.Fatalf("Rollback error: %v", err)
	}
	if updated.Status != models.ReleaseStatusRolledBack {
		t.Errorf("Status = %q, want rolled_back", updated.Status)
	}
	if updated.RollbackID == "" {
		t.Error("RollbackID should be set")
	}
}

func TestService_Rollback_notDeployed(t *testing.T) {
	repo := newFakeReleaseRepo()
	svc := service.NewService(repo)

	r, _ := svc.Create(context.Background(), "tenant-1", &models.CreateReleaseRequest{
		Name:    "release-v1",
		Version: "1.0.0",
	})
	// Status is still draft

	_, err := svc.Rollback(context.Background(), "tenant-1", r.ID, "reason", "ops")
	if err == nil {
		t.Fatal("Rollback should error on non-deployed release")
	}
	if !strings.Contains(err.Error(), "not deployed") {
		t.Errorf("error = %q, want 'not deployed'", err.Error())
	}
}
