package repository

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/branch-policy/models"

	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	var records []models.Record
	err := r.db.SelectContext(ctx, &records, "SELECT * FROM branch-policys WHERE tenant_id=$1", tenantID)
	return records, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record, "SELECT * FROM branch-policys WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &record, err
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	return sentinel.NotFound
}

// --- P0-MB Phase 1 stubs ---
//
// The branch_profiles and build_artifacts tables are defined in the module
// design doc (docs/flagship-review-v3.0-2026-08-25.md) but not yet added to
// the running DB. These stubs return sentinel errors so the handler layer can
// return a clean 500 rather than panicking on a nil table. Once the migration
// lands, replace each stub with the real SQLX implementation.

func (r *Repository) CreateBranchProfile(ctx context.Context, p *models.BranchProfile) error {
	return sentinel.NotFound
}

func (r *Repository) GetBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) ListBranchProfiles(ctx context.Context, tenantID string, q models.BranchProfileQuery) ([]models.BranchProfile, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) UpdateBranchProfile(ctx context.Context, tenantID, id string, p *models.BranchProfile) (*models.BranchProfile, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) CreateBuildArtifact(ctx context.Context, a *models.BuildArtifact) error {
	return sentinel.NotFound
}

func (r *Repository) GetBuildArtifact(ctx context.Context, tenantID, id string) (*models.BuildArtifact, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) ListBuildArtifacts(ctx context.Context, tenantID string, q models.ArtifactQuery) ([]models.BuildArtifact, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) UpdateBuildArtifact(ctx context.Context, tenantID, id string, a *models.BuildArtifact) (*models.BuildArtifact, error) {
	return nil, sentinel.NotFound
}

// --- P0-MB Phase 2 stubs ---
//
// The namespace_bindings table is defined in the module design doc
// (docs/multi-branch-strategy-design-v2-impl-2026-09-08.md §2.2) but not yet
// added to the running DB. These stubs return sentinel errors so the handler
// layer can return a clean 500 rather than panicking on a nil table. Once the
// migration lands, replace each stub with the real SQLX implementation.

func (r *Repository) CreateNamespaceBinding(ctx context.Context, b *models.NamespaceBinding) error {
	return sentinel.NotFound
}

func (r *Repository) GetNamespaceBinding(ctx context.Context, tenantID, id string) (*models.NamespaceBinding, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) GetNamespaceBindingByBranchEnv(ctx context.Context, tenantID, branchProfileID, envName string) (*models.NamespaceBinding, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) ListNamespaceBindings(ctx context.Context, tenantID string, q models.NamespaceBindingQuery) ([]models.NamespaceBinding, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) DeleteNamespaceBinding(ctx context.Context, tenantID, id string) error {
	return sentinel.NotFound
}

// --- P0-MB Phase 3 stubs ---
//
// The sync_policies and sync_run_logs tables are defined in the module
// design doc (docs/multi-branch-strategy-design-v2-impl-2026-09-08.md
// §3.2) but not yet added to the running DB. These stubs return sentinel
// errors so the handler layer can return a clean 500 rather than
// panicking on a nil table. Once the migration lands, replace each stub
// with the real SQLX implementation.

func (r *Repository) CreateSyncPolicy(ctx context.Context, p *models.SyncPolicy) error {
	return sentinel.NotFound
}

func (r *Repository) GetSyncPolicy(ctx context.Context, tenantID, id string) (*models.SyncPolicy, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) ListSyncPolicies(ctx context.Context, tenantID string, q models.SyncPolicyQuery) ([]models.SyncPolicy, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) UpdateSyncPolicy(ctx context.Context, tenantID, id string, p *models.SyncPolicy) (*models.SyncPolicy, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) DeleteSyncPolicy(ctx context.Context, tenantID, id string) error {
	return sentinel.NotFound
}

func (r *Repository) CreateSyncRunLog(ctx context.Context, l *models.SyncRunLog) error {
	return sentinel.NotFound
}

func (r *Repository) UpdateSyncRunLog(ctx context.Context, tenantID, id string, l *models.SyncRunLog) (*models.SyncRunLog, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) ListSyncRunLogs(ctx context.Context, tenantID string, q models.SyncRunLogQuery) ([]models.SyncRunLog, error) {
	return nil, sentinel.NotFound
}
