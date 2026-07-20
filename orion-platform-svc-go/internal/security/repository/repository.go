package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/security/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new vulnerability record.
func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateVulnerabilityRequest) (*models.Vulnerability, error) {
	now := time.Now().UTC()
	v := &models.Vulnerability{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		CVEID:          req.CVEID,
		PackageName:    req.PackageName,
		PackageVersion: req.PackageVersion,
		Severity:       req.Severity,
		Description:    req.Description,
		FixVersion:     req.FixVersion,
		Status:         models.VulnerabilityStatusOpen,
		DetectedAt:     now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO vulnerabilities (id, tenant_id, cve_id, package_name, package_version,
			severity, description, fix_version, status, detected_at, created_at, updated_at)
		VALUES (:id, :tenantId, :cveId, :packageName, :packageVersion, :severity,
			:description, :fixVersion, :status, :detectedAt, :createdAt, :updatedAt)
	`, v)
	return v, err
}

// GetByID retrieves a vulnerability by its internal UUID.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Vulnerability, error) {
	var v models.Vulnerability
	err := r.db.GetContext(ctx, &v, `SELECT * FROM vulnerabilities WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &v, nil
}

// GetByCVEID retrieves a vulnerability by CVE ID.
func (r *Repository) GetByCVEID(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error) {
	var v models.Vulnerability
	err := r.db.GetContext(ctx, &v, `SELECT * FROM vulnerabilities WHERE cve_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`, cveID, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &v, nil
}

// GetByCVEIDAndPackage retrieves a vulnerability by CVE ID and package name.
func (r *Repository) GetByCVEIDAndPackage(ctx context.Context, tenantID, cveID, packageName string) (*models.Vulnerability, error) {
	var v models.Vulnerability
	err := r.db.GetContext(ctx, &v, `SELECT * FROM vulnerabilities WHERE cve_id=$1 AND package_name=$2 AND tenant_id=$3`, cveID, packageName, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &v, nil
}

// List retrieves vulnerabilities with optional filtering and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, opt models.ListVulnerabilitiesOptions) ([]models.Vulnerability, int, error) {
	limit := opt.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := (opt.Page - 1) * limit
	if opt.Page <= 0 {
		opt.Page = 1
		offset = 0
	}

	whereParts := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if opt.Severity != "" {
		whereParts = append(whereParts, fmt.Sprintf("severity = $%d", argIdx))
		args = append(args, string(opt.Severity))
		argIdx++
	}

	whereClause := strings.Join(whereParts, " AND ")

	var total int
	if err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM vulnerabilities WHERE "+whereClause, args...); err != nil {
		return nil, 0, err
	}

	dataSQL := fmt.Sprintf("SELECT * FROM vulnerabilities WHERE %s ORDER BY detected_at DESC LIMIT $%d OFFSET $%d",
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var vulns []models.Vulnerability
	if err := r.db.SelectContext(ctx, &vulns, dataSQL, args...); err != nil {
		return nil, 0, err
	}
	return vulns, total, nil
}

// UpdateStatus updates the status of a vulnerability.
func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id string, status models.VulnerabilityStatus) (*models.Vulnerability, error) {
	now := time.Now().UTC()
	var v models.Vulnerability
	err := r.db.GetContext(ctx, &v,
		`UPDATE vulnerabilities SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4 RETURNING *`,
		string(status), now, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &v, nil
}

// BatchCreate inserts multiple vulnerability records in a transaction.
func (r *Repository) BatchCreate(ctx context.Context, tenantID string, vulns []models.CreateVulnerabilityRequest) ([]models.Vulnerability, error) {
	if len(vulns) == 0 {
		return []models.Vulnerability{}, nil
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	results := make([]models.Vulnerability, 0, len(vulns))
	for _, v := range vulns {
		now := time.Now().UTC()
		vuln := &models.Vulnerability{
			ID:             uuid.New().String(),
			TenantID:       tenantID,
			CVEID:          v.CVEID,
			PackageName:    v.PackageName,
			PackageVersion: v.PackageVersion,
			Severity:       v.Severity,
			Description:    v.Description,
			FixVersion:     v.FixVersion,
			Status:         models.VulnerabilityStatusOpen,
			DetectedAt:     now,
			CreatedAt:      now,
			UpdatedAt:      now,
		}

		_, err := tx.NamedExecContext(ctx, `
			INSERT INTO vulnerabilities (id, tenant_id, cve_id, package_name, package_version,
				severity, description, fix_version, status, detected_at, created_at, updated_at)
			VALUES (:id, :tenantId, :cveId, :packageName, :packageVersion, :severity,
				:description, :fixVersion, :status, :detectedAt, :createdAt, :updatedAt)
		`, vuln)
		if err != nil {
			return nil, err
		}
		results = append(results, *vuln)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return results, nil
}

// GetScanStats returns aggregated vulnerability statistics for a tenant.
func (r *Repository) GetScanStats(ctx context.Context, tenantID string) (*models.VulnerabilityReport, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM vulnerabilities WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	bySeverity := make(map[string]int)
	var svRows []struct {
		Severity string `db:"severity"`
		Count    int    `db:"count"`
	}
	if err := r.db.SelectContext(ctx, &svRows,
		`SELECT severity, COUNT(*) as count FROM vulnerabilities WHERE tenant_id=$1 GROUP BY severity`, tenantID); err != nil {
		return nil, err
	}
	for _, row := range svRows {
		bySeverity[row.Severity] = row.Count
	}

	byStatus := make(map[string]int)
	var stRows []struct {
		Status string `db:"status"`
		Count  int    `db:"count"`
	}
	if err := r.db.SelectContext(ctx, &stRows,
		`SELECT status, COUNT(*) as count FROM vulnerabilities WHERE tenant_id=$1 GROUP BY status`, tenantID); err != nil {
		return nil, err
	}
	for _, row := range stRows {
		byStatus[row.Status] = row.Count
	}

	var openCritical, openHigh int
	_ = r.db.GetContext(ctx, &openCritical,
		`SELECT COUNT(*) FROM vulnerabilities WHERE tenant_id=$1 AND status=$2 AND severity=$3`,
		tenantID, string(models.VulnerabilityStatusOpen), string(models.VulnerabilitySeverityCritical))
	_ = r.db.GetContext(ctx, &openHigh,
		`SELECT COUNT(*) FROM vulnerabilities WHERE tenant_id=$1 AND status=$2 AND severity=$3`,
		tenantID, string(models.VulnerabilityStatusOpen), string(models.VulnerabilitySeverityHigh))

	return &models.VulnerabilityReport{
		TotalVulnerabilities: total,
		BySeverity:           bySeverity,
		ByStatus:             byStatus,
		OpenCritical:         openCritical,
		OpenHigh:             openHigh,
	}, nil
}
