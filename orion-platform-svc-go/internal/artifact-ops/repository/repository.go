package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/artifact-ops/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------- Artifact Operation ----------

func (r *Repository) CreateOperation(ctx context.Context, op *models.ArtifactOperation) error {
	op.ID = uuid.New().String()
	op.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO artifact_operations (id, tenant_id, artifact_id, action, actor_id, details, created_at)
		 VALUES (:id, :tenant_id, :artifact_id, :action, :actor_id, :details, :created_at)`, op)
	return err
}

func (r *Repository) ListOperationsByArtifact(ctx context.Context, tenantID, artifactID string, limit, offset int) ([]models.ArtifactOperation, error) {
	var items []models.ArtifactOperation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifact_operations WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, artifactID, limit, offset)
	return items, err
}

// ---------- Artifact Stats ----------

func (r *Repository) GetArtifactStats(ctx context.Context, tenantID, artifactID string) (*models.ArtifactStats, error) {
	var stats models.ArtifactStats
	err := r.db.GetContext(ctx, &stats, `
		SELECT artifact_id, count(*) as total_ops,
		       COALESCE((SELECT action FROM artifact_operations WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY created_at DESC LIMIT 1), '') as last_action
		FROM artifact_operations WHERE tenant_id=$1 AND artifact_id=$2 GROUP BY artifact_id
	`, tenantID, artifactID, tenantID, artifactID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// ---------- Artifact Scan ----------

func (r *Repository) CreateScan(ctx context.Context, scan *models.ArtifactScan) error {
	scan.ID = uuid.New().String()
	scan.CreatedAt = time.Now().UTC()
	scan.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO artifact_scans (id, tenant_id, artifact_id, status, report_id, error, created_at, updated_at)
		 VALUES (:id, :tenant_id, :artifact_id, :status, :report_id, :error, :created_at, :updated_at)`, scan)
	return err
}

func (r *Repository) GetScanByID(ctx context.Context, tenantID, id string) (*models.ArtifactScan, error) {
	var scan models.ArtifactScan
	err := r.db.GetContext(ctx, &scan,
		`SELECT * FROM artifact_scans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &scan, nil
}

func (r *Repository) ListScansByArtifact(ctx context.Context, tenantID, artifactID string) ([]models.ArtifactScan, error) {
	var items []models.ArtifactScan
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifact_scans WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY created_at DESC`,
		tenantID, artifactID)
	return items, err
}

func (r *Repository) UpdateScanStatus(ctx context.Context, tenantID, id, status, reportID, error string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE artifact_scans SET status=$1, report_id=$2, error=$3, updated_at=NOW() WHERE id=$4 AND tenant_id=$5`,
		status, reportID, error, id, tenantID)
	return err
}

// ---------- Scan Report ----------

func (r *Repository) CreateScanReport(ctx context.Context, report *models.ScanReport) error {
	report.ID = uuid.New().String()
	report.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO artifact_scan_reports (id, tenant_id, scan_id, artifact_id, status, findings, created_at)
		 VALUES (:id, :tenant_id, :scan_id, :artifact_id, :status, :findings, :created_at)`, report)
	return err
}

func (r *Repository) GetScanReportByID(ctx context.Context, tenantID, id string) (*models.ScanReport, error) {
	var report models.ScanReport
	err := r.db.GetContext(ctx, &report,
		`SELECT * FROM artifact_scan_reports WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *Repository) GetScanReportsByArtifact(ctx context.Context, tenantID, artifactID string) ([]models.ScanReport, error) {
	var items []models.ScanReport
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifact_scan_reports WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY created_at DESC`,
		tenantID, artifactID)
	return items, err
}

// ---------- Retention Policy ----------

func (r *Repository) CreatePolicy(ctx context.Context, policy *models.RetentionPolicy) error {
	policy.ID = uuid.New().String()
	policy.CreatedAt = time.Now().UTC()
	policy.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO artifact_retention_policies (id, tenant_id, name, rule, enabled, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :rule, :enabled, :created_at, :updated_at)`, policy)
	return err
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string) ([]models.RetentionPolicy, error) {
	var items []models.RetentionPolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifact_retention_policies WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) GetPolicyByID(ctx context.Context, tenantID, id string) (*models.RetentionPolicy, error) {
	var policy models.RetentionPolicy
	err := r.db.GetContext(ctx, &policy,
		`SELECT * FROM artifact_retention_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &policy, nil
}

func (r *Repository) DeletePolicy(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM artifact_retention_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) UpdatePolicyEnabled(ctx context.Context, tenantID, id string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE artifact_retention_policies SET enabled=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		enabled, id, tenantID)
	return err
}
