package service

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/deploy/models"
)

// ---------------------------------------------------------------------------
// RepositoryInterface mock with per-method error hooks
// ---------------------------------------------------------------------------

type deployRepoMock struct {
	// returns
	created       *models.Deployment
	createdList   []models.Deployment
	rollback      *models.Rollback
	rollbackList  []models.Rollback
	auditList     []models.AuditEntry
	releaseNote   *models.ReleaseNote
	releaseNotes  []models.ReleaseNote
	changelog     []models.GitChangelogEntry
	latest        *models.Deployment
	metrics       *models.DeploymentMetrics
	latestErr     error

	// errors (per-method)
	errCreate        error
	errCreateAudit   error
	errCreateRollback error
	errCreateRelease error
	errGetByID       error
	errList          error
	errListRollbacks error
	errListAudit     error
	errListReleaseByTenant error
	errListChangelog error
	errListReleaseNotesByTenant error
	errMetrics       error
	errComplete      error
	errUpdateStatus  error
	errLinkGit       error

	// capture
	lastCreate     *models.Deployment
	lastStatus     string
	lastStatusID   string
	lastRollbackTo string
	lastRollbackReason string
}

func (m *deployRepoMock) Create(ctx context.Context, d *models.Deployment) error {
	m.lastCreate = d
	return m.errCreate
}
func (m *deployRepoMock) GetByID(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	if m.errGetByID != nil {
		return nil, m.errGetByID
	}
	return m.latest, nil
}
func (m *deployRepoMock) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Deployment, error) {
	return m.createdList, m.errList
}
func (m *deployRepoMock) LatestByApp(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) {
	return m.latest, m.latestErr
}
func (m *deployRepoMock) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	m.lastStatus = status
	m.lastStatusID = id
	return m.errUpdateStatus
}
func (m *deployRepoMock) CompleteDeployment(ctx context.Context, tenantID, id, status string) error {
	return m.errComplete
}
func (m *deployRepoMock) CreateAuditEntry(ctx context.Context, deploymentID, action, userID, details string) error {
	return m.errCreateAudit
}
func (m *deployRepoMock) ListAuditEntries(ctx context.Context, tenantID, deploymentID string) ([]models.AuditEntry, error) {
	return m.auditList, m.errListAudit
}
func (m *deployRepoMock) CreateRollback(ctx context.Context, tenantID, deploymentID, fromVersion, toVersion, reason string) (*models.Rollback, error) {
	m.lastRollbackTo = toVersion
	m.lastRollbackReason = reason
	return m.rollback, m.errCreateRollback
}
func (m *deployRepoMock) ListRollbacks(ctx context.Context, tenantID, deploymentID string) ([]models.Rollback, error) {
	return m.rollbackList, m.errListRollbacks
}
func (m *deployRepoMock) CreateReleaseNote(ctx context.Context, tenantID, deploymentID, content string) (*models.ReleaseNote, error) {
	return m.releaseNote, m.errCreateRelease
}
func (m *deployRepoMock) GetReleaseNotes(ctx context.Context, tenantID, deploymentID string) (*models.ReleaseNote, error) {
	return m.releaseNote, nil
}
func (m *deployRepoMock) ListReleaseNotesByTenant(ctx context.Context, tenantID string) ([]models.ReleaseNote, error) {
	return m.releaseNotes, m.errListReleaseNotesByTenant
}
func (m *deployRepoMock) LinkGitCommit(ctx context.Context, deploymentID, commitSHA, branch string) error {
	return m.errLinkGit
}
func (m *deployRepoMock) ListChangelog(ctx context.Context, tenantID, deploymentID string) ([]models.GitChangelogEntry, error) {
	return m.changelog, m.errListChangelog
}
func (m *deployRepoMock) Metrics(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error) {
	return m.metrics, m.errMetrics
}

// Compile-time assertion.
var _ RepositoryInterface = (*deployRepoMock)(nil)

// ---------------------------------------------------------------------------
// Service — Create / Get / List
// ---------------------------------------------------------------------------

func TestDeployCreateSucceeds(t *testing.T) {
	mock := &deployRepoMock{}
	s := NewService(mock)
	out, err := s.Create(context.Background(), "t1", models.CreateDeploymentRequest{
		AppName: "web", Environment: "prod", Version: "1.2.3", CommitSHA: "abc123",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.Status != "pending" || out.AppName != "web" || out.TenantID != "t1" {
		t.Errorf("out = %+v", out)
	}
	if mock.lastCreate == nil || mock.lastCreate.Version != "1.2.3" {
		t.Errorf("repo.lastCreate = %+v", mock.lastCreate)
	}
}

func TestDeployCreatePropagatesError(t *testing.T) {
	mock := &deployRepoMock{errCreate: errors.New("db")}
	s := NewService(mock)
	if _, err := s.Create(context.Background(), "t1", models.CreateDeploymentRequest{AppName: "x", Environment: "prod"}); err == nil {
		t.Error("expected error")
	}
}

func TestDeployGetDelegates(t *testing.T) {
	mock := &deployRepoMock{latest: &models.Deployment{ID: "d1"}}
	s := NewService(mock)
	out, err := s.Get(context.Background(), "t1", "d1")
	if err != nil || out == nil || out.ID != "d1" {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestDeployGetPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errGetByID: errors.New("db")}
	s := NewService(mock)
	if _, err := s.Get(context.Background(), "t1", "x"); err == nil {
		t.Error("expected error")
	}
}

func TestDeployListDelegates(t *testing.T) {
	mock := &deployRepoMock{createdList: []models.Deployment{{ID: "d1"}}}
	s := NewService(mock)
	out, err := s.List(context.Background(), "t1", 20, 0)
	if err != nil || len(out) != 1 {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestDeployListPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errList: errors.New("db")}
	s := NewService(mock)
	if _, err := s.List(context.Background(), "t1", 20, 0); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// Service — Start / Cancel / Complete
// ---------------------------------------------------------------------------

func TestDeployStartSetsRunning(t *testing.T) {
	mock := &deployRepoMock{}
	s := NewService(mock)
	if err := s.Start(context.Background(), "t1", "d1"); err != nil {
		t.Fatalf("err: %v", err)
	}
	if mock.lastStatus != "running" || mock.lastStatusID != "d1" {
		t.Errorf("lastStatus=%q lastStatusID=%q", mock.lastStatus, mock.lastStatusID)
	}
}

func TestDeployStartPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errUpdateStatus: errors.New("db")}
	s := NewService(mock)
	if err := s.Start(context.Background(), "t1", "d1"); err == nil {
		t.Error("expected error")
	}
}

func TestDeployCancelSetsCancelled(t *testing.T) {
	mock := &deployRepoMock{}
	s := NewService(mock)
	if err := s.Cancel(context.Background(), "t1", "d1"); err != nil {
		t.Fatalf("err: %v", err)
	}
	if mock.lastStatus != "cancelled" {
		t.Errorf("lastStatus=%q, want cancelled", mock.lastStatus)
	}
}

func TestDeployCancelPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errUpdateStatus: errors.New("db")}
	s := NewService(mock)
	if err := s.Cancel(context.Background(), "t1", "d1"); err == nil {
		t.Error("expected error")
	}
}

func TestDeployCompleteAcceptsSucceeded(t *testing.T) {
	mock := &deployRepoMock{}
	s := NewService(mock)
	if err := s.Complete(context.Background(), "t1", "d1", "succeeded"); err != nil {
		t.Fatalf("err: %v", err)
	}
}

func TestDeployCompleteAcceptsFailed(t *testing.T) {
	mock := &deployRepoMock{}
	s := NewService(mock)
	if err := s.Complete(context.Background(), "t1", "d1", "failed"); err != nil {
		t.Fatalf("err: %v", err)
	}
}

func TestDeployCompleteRejectsInvalidStatus(t *testing.T) {
	mock := &deployRepoMock{}
	s := NewService(mock)
	if err := s.Complete(context.Background(), "t1", "d1", "weird"); !errors.Is(err, ErrInvalidStatus) {
		t.Errorf("err = %v, want ErrInvalidStatus", err)
	}
}

func TestDeployCompletePropagatesRepoError(t *testing.T) {
	mock := &deployRepoMock{errComplete: errors.New("db")}
	s := NewService(mock)
	if err := s.Complete(context.Background(), "t1", "d1", "succeeded"); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// Service — Metrics
// ---------------------------------------------------------------------------

func TestDeployMetrics(t *testing.T) {
	mock := &deployRepoMock{metrics: &models.DeploymentMetrics{Total: 10, Succeeded: 8}}
	s := NewService(mock)
	out, err := s.Metrics(context.Background(), "t1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.Total != 10 || out.Succeeded != 8 {
		t.Errorf("metrics = %+v", out)
	}
}

func TestDeployMetricsPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errMetrics: errors.New("db")}
	s := NewService(mock)
	if _, err := s.Metrics(context.Background(), "t1"); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// Service — Rollback
// ---------------------------------------------------------------------------

func TestDeployRollbackSucceeds(t *testing.T) {
	mock := &deployRepoMock{
		latest:   &models.Deployment{ID: "d1", Version: "1.5.0"},
		rollback: &models.Rollback{DeploymentID: "d1", FromVersion: "1.5.0", ToVersion: "1.4.0"},
	}
	s := NewService(mock)
	out, err := s.Rollback(context.Background(), "t1", "d1", "1.4.0", "regression")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if out.ToVersion != "1.4.0" || mock.lastRollbackReason != "regression" {
		t.Errorf("rollback=%+v reason=%q", out, mock.lastRollbackReason)
	}
}

func TestDeployRollbackPropagatesGetByIDError(t *testing.T) {
	mock := &deployRepoMock{errGetByID: errors.New("not found")}
	s := NewService(mock)
	if _, err := s.Rollback(context.Background(), "t1", "d1", "1.4.0", "x"); err == nil {
		t.Error("expected error")
	}
}

func TestDeployRollbackPropagatesCreateRollbackError(t *testing.T) {
	mock := &deployRepoMock{
		latest:          &models.Deployment{ID: "d1", Version: "1.5.0"},
		errCreateRollback: errors.New("db"),
	}
	s := NewService(mock)
	if _, err := s.Rollback(context.Background(), "t1", "d1", "1.4.0", "x"); err == nil {
		t.Error("expected error")
	}
}

func TestDeployGetRollbackHistory(t *testing.T) {
	mock := &deployRepoMock{rollbackList: []models.Rollback{{ID: "r1"}}}
	s := NewService(mock)
	out, err := s.GetRollbackHistory(context.Background(), "t1", "d1")
	if err != nil || len(out) != 1 {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestDeployGetRollbackHistoryPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errListRollbacks: errors.New("db")}
	s := NewService(mock)
	if _, err := s.GetRollbackHistory(context.Background(), "t1", "d1"); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// Service — Audit trail
// ---------------------------------------------------------------------------

func TestDeployLogAuditSucceeds(t *testing.T) {
	mock := &deployRepoMock{}
	s := NewService(mock)
	if err := s.LogAudit(context.Background(), "d1", "deploy", "u1", "ok"); err != nil {
		t.Fatalf("err: %v", err)
	}
}

func TestDeployLogAuditPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errCreateAudit: errors.New("db")}
	s := NewService(mock)
	if err := s.LogAudit(context.Background(), "d1", "deploy", "u1", "x"); err == nil {
		t.Error("expected error")
	}
}

func TestDeployGetAuditTrail(t *testing.T) {
	mock := &deployRepoMock{auditList: []models.AuditEntry{{ID: 1, Action: "deploy"}}}
	s := NewService(mock)
	out, err := s.GetAuditTrail(context.Background(), "t1", "d1")
	if err != nil || len(out) != 1 {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestDeployGetAuditTrailPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errListAudit: errors.New("db")}
	s := NewService(mock)
	if _, err := s.GetAuditTrail(context.Background(), "t1", "d1"); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// Service — Release notes
// ---------------------------------------------------------------------------

func TestDeployGenerateReleaseNotes(t *testing.T) {
	mock := &deployRepoMock{releaseNote: &models.ReleaseNote{ID: "rn1"}}
	s := NewService(mock)
	out, err := s.GenerateReleaseNotes(context.Background(), "t1", "d1", "content")
	if err != nil || out.ID != "rn1" {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestDeployGenerateReleaseNotesPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errCreateRelease: errors.New("db")}
	s := NewService(mock)
	if _, err := s.GenerateReleaseNotes(context.Background(), "t1", "d1", "x"); err == nil {
		t.Error("expected error")
	}
}

func TestDeployGetReleaseNotes(t *testing.T) {
	mock := &deployRepoMock{releaseNote: &models.ReleaseNote{ID: "rn1"}}
	s := NewService(mock)
	out, err := s.GetReleaseNotes(context.Background(), "t1", "d1")
	if err != nil || out.ID != "rn1" {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestDeployGetReleaseNotesByTenant(t *testing.T) {
	mock := &deployRepoMock{releaseNotes: []models.ReleaseNote{{ID: "r1"}, {ID: "r2"}}}
	s := NewService(mock)
	out, err := s.GetReleaseNotesByTenant(context.Background(), "t1")
	if err != nil || len(out) != 2 {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestDeployGetReleaseNotesByTenantPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errListReleaseNotesByTenant: errors.New("db")}
	s := NewService(mock)
	if _, err := s.GetReleaseNotesByTenant(context.Background(), "t1"); err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// Service — Git integration + Latest
// ---------------------------------------------------------------------------

func TestDeployLinkGitCommit(t *testing.T) {
	mock := &deployRepoMock{}
	s := NewService(mock)
	if err := s.LinkGitCommit(context.Background(), "d1", "abc", "main"); err != nil {
		t.Fatalf("err: %v", err)
	}
}

func TestDeployLinkGitCommitPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errLinkGit: errors.New("db")}
	s := NewService(mock)
	if err := s.LinkGitCommit(context.Background(), "d1", "abc", "main"); err == nil {
		t.Error("expected error")
	}
}

func TestDeployGetDeploymentChangelog(t *testing.T) {
	mock := &deployRepoMock{changelog: []models.GitChangelogEntry{{CommitSHA: "abc"}}}
	s := NewService(mock)
	out, err := s.GetDeploymentChangelog(context.Background(), "t1", "d1")
	if err != nil || len(out) != 1 {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestDeployGetDeploymentChangelogPropagatesError(t *testing.T) {
	mock := &deployRepoMock{errListChangelog: errors.New("db")}
	s := NewService(mock)
	if _, err := s.GetDeploymentChangelog(context.Background(), "t1", "d1"); err == nil {
		t.Error("expected error")
	}
}

func TestDeployGetLatest(t *testing.T) {
	mock := &deployRepoMock{latest: &models.Deployment{ID: "d1", AppName: "web"}}
	s := NewService(mock)
	out, err := s.GetLatest(context.Background(), "t1", "web", "prod")
	if err != nil || out == nil || out.AppName != "web" {
		t.Errorf("out=%+v err=%v", out, err)
	}
}

func TestDeployGetLatestPropagatesError(t *testing.T) {
	mock := &deployRepoMock{latestErr: errors.New("not found")}
	s := NewService(mock)
	if _, err := s.GetLatest(context.Background(), "t1", "web", "prod"); err == nil {
		t.Error("expected error")
	}
}
