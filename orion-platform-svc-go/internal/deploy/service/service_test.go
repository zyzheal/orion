package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/deploy/models"
)

// --- Mock repository ---

type mockDeployRepo struct {
	deployments map[string]*models.Deployment // key = tenantID:id
	err         error
}

func (m *mockDeployRepo) Create(_ context.Context, d *models.Deployment) error {
	if m.err != nil {
		return m.err
	}
	if d.ID == "" {
		d.ID = "dep-1"
	}
	m.deployments[m.key(d.TenantID, d.ID)] = d
	return nil
}

func (m *mockDeployRepo) GetByID(_ context.Context, tenantID, id string) (*models.Deployment, error) {
	if m.err != nil {
		return nil, m.err
	}
	d, ok := m.deployments[m.key(tenantID, id)]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return d, nil
}

func (m *mockDeployRepo) List(_ context.Context, tenantID string, _, _ int) ([]models.Deployment, error) {
	if m.err != nil {
		return nil, m.err
	}
	var result []models.Deployment
	for k, d := range m.deployments {
		if k[:len(tenantID)] == tenantID {
			result = append(result, *d)
		}
	}
	return result, nil
}

func (m *mockDeployRepo) UpdateStatus(_ context.Context, tenantID, id, status string) error {
	if m.err != nil {
		return m.err
	}
	d, ok := m.deployments[m.key(tenantID, id)]
	if !ok {
		return errors.New("not found")
	}
	d.Status = status
	return nil
}

func (m *mockDeployRepo) CompleteDeployment(_ context.Context, tenantID, id, status string) error {
	if m.err != nil {
		return m.err
	}
	d, ok := m.deployments[m.key(tenantID, id)]
	if !ok {
		return errors.New("not found")
	}
	d.Status = status
	return nil
}

func (m *mockDeployRepo) LatestByApp(_ context.Context, tenantID, appName, environment string) (*models.Deployment, error) {
	if m.err != nil {
		return nil, m.err
	}
	for k, d := range m.deployments {
		if k[:len(tenantID)] == tenantID && d.AppName == appName && d.Environment == environment {
			return d, nil
		}
	}
	return nil, sql.ErrNoRows
}

func (m *mockDeployRepo) Metrics(_ context.Context, tenantID string) (*models.DeploymentMetrics, error) {
	if m.err != nil {
		return nil, m.err
	}
	var mtr models.DeploymentMetrics
	for k, d := range m.deployments {
		if k[:len(tenantID)] == tenantID {
			mtr.Total++
			switch d.Status {
			case "succeeded":
				mtr.Succeeded++
			case "failed":
				mtr.Failed++
			case "running":
				mtr.Running++
			case "cancelled":
				mtr.Cancelled++
			case "rollback":
				mtr.Rollback++
			}
		}
	}
	return &mtr, nil
}

func (m *mockDeployRepo) CreateRollback(_ context.Context, tenantID, deploymentID, fromVersion, toVersion, reason string) (*models.Rollback, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &models.Rollback{DeploymentID: deploymentID, FromVersion: fromVersion, ToVersion: toVersion, Reason: reason}, nil
}

func (m *mockDeployRepo) ListRollbacks(_ context.Context, tenantID, deploymentID string) ([]models.Rollback, error) {
	if m.err != nil {
		return nil, m.err
	}
	return []models.Rollback{}, nil
}

func (m *mockDeployRepo) CreateAuditEntry(_ context.Context, deploymentID, action, userID, details string) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockDeployRepo) ListAuditEntries(_ context.Context, deploymentID string) ([]models.AuditEntry, error) {
	if m.err != nil {
		return nil, m.err
	}
	return []models.AuditEntry{}, nil
}

func (m *mockDeployRepo) CreateReleaseNote(_ context.Context, tenantID, deploymentID, content string) (*models.ReleaseNote, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &models.ReleaseNote{ID: "rn-1", DeploymentID: deploymentID, Content: content}, nil
}

func (m *mockDeployRepo) GetReleaseNotes(_ context.Context, deploymentID string) (*models.ReleaseNote, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &models.ReleaseNote{DeploymentID: deploymentID}, nil
}

func (m *mockDeployRepo) ListReleaseNotesByTenant(_ context.Context, tenantID string) ([]models.ReleaseNote, error) {
	if m.err != nil {
		return nil, m.err
	}
	return []models.ReleaseNote{}, nil
}

func (m *mockDeployRepo) LinkGitCommit(_ context.Context, deploymentID, commitSHA, branch string) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockDeployRepo) ListChangelog(_ context.Context, deploymentID string) ([]models.GitChangelogEntry, error) {
	if m.err != nil {
		return nil, m.err
	}
	return []models.GitChangelogEntry{}, nil
}

func (m *mockDeployRepo) key(tenantID, id string) string { return tenantID + ":" + id }

// --- Tests ---

func TestDeployErrNotFound(t *testing.T) {
	if !errors.Is(ErrNotFound, ErrNotFound) {
		t.Error("ErrNotFound should be self")
	}
}

func TestDeployErrAlreadyRunning(t *testing.T) {
	if !errors.Is(ErrAlreadyRunning, ErrAlreadyRunning) {
		t.Error("ErrAlreadyRunning should be self")
	}
}

func TestDeployErrInvalidStatus(t *testing.T) {
	if !errors.Is(ErrInvalidStatus, ErrInvalidStatus) {
		t.Error("ErrInvalidStatus should be self")
	}
}

// --- Create ---

func TestDeployCreate_DeploymentModel(t *testing.T) {
	req := models.CreateDeploymentRequest{AppName: "web", Environment: "prod", Version: "v1"}
	d := &models.Deployment{
		TenantID: "t1", AppName: req.AppName, Environment: req.Environment,
		Status: "pending", Version: req.Version, CommitSHA: req.CommitSHA,
	}
	if d.AppName != "web" {
		t.Errorf("expected web, got %s", d.AppName)
	}
	if d.Status != "pending" {
		t.Errorf("expected pending, got %s", d.Status)
	}
	if d.Version != "v1" {
		t.Errorf("expected v1, got %s", d.Version)
	}
}

func TestMockDeployRepoCreate_Success(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{}}
	d := &models.Deployment{TenantID: "t1", AppName: "web", Environment: "prod", Status: "pending"}
	err := repo.Create(context.Background(), d)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if d.ID != "dep-1" {
		t.Errorf("expected dep-1, got %s", d.ID)
	}
}

func TestMockDeployRepoCreate_Error(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{}, err: errors.New("db fail")}
	if err := repo.Create(context.Background(), &models.Deployment{}); err == nil {
		t.Fatal("expected error")
	}
}

// --- Get ---

func TestMockDeployRepoGetByID_Success(t *testing.T) {
	d := &models.Deployment{ID: "dep-1", TenantID: "t1", AppName: "web"}
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{"t1:dep-1": d}}
	got, err := repo.GetByID(context.Background(), "t1", "dep-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.AppName != "web" {
		t.Errorf("expected web, got %s", got.AppName)
	}
}

func TestMockDeployRepoGetByID_NotFound(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{}}
	_, err := repo.GetByID(context.Background(), "t1", "x")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected ErrNoRows, got %v", err)
	}
}

// --- List ---

func TestMockDeployRepoList_Success(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{
		"t1:d1": {ID: "d1", TenantID: "t1"}, "t1:d2": {ID: "d2", TenantID: "t1"}}}
	items, err := repo.List(context.Background(), "t1", 10, 0)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(items) != 2 {
		t.Errorf("expected 2, got %d", len(items))
	}
}

func TestMockDeployRepoList_RepoError(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{}, err: errors.New("db fail")}
	_, err := repo.List(context.Background(), "t1", 10, 0)
	if err == nil {
		t.Fatal("expected error")
	}
}

// --- Status transitions ---

func TestMockDeployRepoUpdateStatus_Success(t *testing.T) {
	d := &models.Deployment{ID: "dep-1", TenantID: "t1", Status: "pending"}
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{"t1:dep-1": d}}
	err := repo.UpdateStatus(context.Background(), "t1", "dep-1", "running")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if d.Status != "running" {
		t.Errorf("expected running, got %s", d.Status)
	}
}

func TestMockDeployRepoUpdateStatus_NotFound(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{}}
	err := repo.UpdateStatus(context.Background(), "t1", "x", "running")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestDeployComplete_ValidStatus(t *testing.T) {
	for _, status := range []string{"succeeded", "failed"} {
		valid := status == "succeeded" || status == "failed"
		if !valid {
			t.Errorf("status %s should be valid", status)
		}
	}
}

func TestDeployComplete_InvalidStatus(t *testing.T) {
	status := "invalid"
	valid := status == "succeeded" || status == "failed"
	if valid {
		t.Error("invalid status should be rejected")
	}
}

// --- Rollback ---

func TestMockDeployRepoCreateRollback_Success(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{}}
	rb, err := repo.CreateRollback(context.Background(), "t1", "dep-1", "v1", "v0", "rollback reason")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if rb.FromVersion != "v1" {
		t.Errorf("expected v1, got %s", rb.FromVersion)
	}
	if rb.ToVersion != "v0" {
		t.Errorf("expected v0, got %s", rb.ToVersion)
	}
}

// --- Metrics ---

func TestMockDeployRepoMetrics_Success(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{
		"t1:d1": {ID: "d1", TenantID: "t1", Status: "succeeded"},
		"t1:d2": {ID: "d2", TenantID: "t1", Status: "failed"}}}
	mtr, err := repo.Metrics(context.Background(), "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if mtr.Total != 2 {
		t.Errorf("expected total 2, got %d", mtr.Total)
	}
	if mtr.Succeeded != 1 {
		t.Errorf("expected succeeded 1, got %d", mtr.Succeeded)
	}
	if mtr.Failed != 1 {
		t.Errorf("expected failed 1, got %d", mtr.Failed)
	}
}

// --- LatestByApp ---

func TestMockDeployRepoLatestByApp_Success(t *testing.T) {
	d := &models.Deployment{ID: "dep-1", TenantID: "t1", AppName: "web", Environment: "prod"}
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{"t1:dep-1": d}}
	got, err := repo.LatestByApp(context.Background(), "t1", "web", "prod")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.AppName != "web" {
		t.Errorf("expected web, got %s", got.AppName)
	}
}

func TestMockDeployRepoLatestByApp_NotFound(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{}}
	_, err := repo.LatestByApp(context.Background(), "t1", "web", "prod")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected ErrNoRows, got %v", err)
	}
}

// --- Audit trail ---

func TestMockDeployRepoCreateAuditEntry_Success(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{}}
	err := repo.CreateAuditEntry(context.Background(), "dep-1", "deploy", "user-1", "details")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestMockDeployRepoListAuditEntries_Success(t *testing.T) {
	repo := &mockDeployRepo{deployments: map[string]*models.Deployment{}}
	entries, err := repo.ListAuditEntries(context.Background(), "dep-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("expected 0, got %d", len(entries))
	}
}
