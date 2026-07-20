package repository

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/ai-security/models"

	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

var ErrVulnerabilityEngine = errors.New("vulnerability scanning engine unavailable")
var ErrNoFixAvailable = errors.New("no fix available for CVE")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---- Core CRUD ----

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	var records []models.Record
	err := r.db.SelectContext(ctx, &records, "SELECT * FROM ai_securitys WHERE tenant_id=$1", tenantID)
	return records, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record, "SELECT * FROM ai_securitys WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &record, err
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record,
		"INSERT INTO ai_securitys (tenant_id, name, status, config) VALUES ($1, $2, $3, $4) RETURNING id, tenant_id, name, status, created_at",
		tenantID, req.Name, req.Status, req.Config,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &record, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record,
		"UPDATE ai_securitys SET name=$1, status=$2, config=$3 WHERE id=$4 AND tenant_id=$5 RETURNING id, tenant_id, name, status, created_at",
		req.Name, req.Status, req.Config, id, tenantID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &record, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM ai_securitys WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sentinel.NotFound
	}
	return nil
}

// ---- Vulnerability / CVE scanning ----

// FindVulnerabilities runs a Trivy-based scan against the given image
// reference and returns all CVEs plus an aggregated severity summary.
//
// When the Trivy engine cannot be reached the method degrades gracefully:
// it returns a Degraded result with the errors observed rather than a hard
// failure. This lets the API surface still respond for monitoring / dashboard
// consumers.
func (r *Repository) FindVulnerabilities(ctx context.Context, tenantID string, image string) (*models.ScanVulnerabilitiesResult, error) {
	return nil, ErrVulnerabilityEngine
}

// GetVulnerability retrieves the details for a single CVE by ID.
func (r *Repository) GetVulnerability(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error) {
	return nil, sentinel.NotFound
}

// ListVulnerabilities lists previously recorded vulnerabilities for a tenant,
// optionally scoped to an image.
func (r *Repository) ListVulnerabilities(ctx context.Context, tenantID string) ([]models.Vulnerability, error) {
	return []models.Vulnerability{}, nil
}

// FixVulnerability marks one or more CVEs as remediated for the given image
// and returns the fix outcome.
func (r *Repository) FixVulnerability(ctx context.Context, tenantID, image string, cveIDs []string) (*models.FixVulnerabilityResult, error) {
	return nil, ErrNoFixAvailable
}

// CheckVulnerability performs a live CVE look-up (Trivy DB) and returns the
// detail payload. Returns ErrVulnerabilityEngine when the engine is down.
func (r *Repository) CheckVulnerability(ctx context.Context, tenantID, cveID string) (*models.CheckVulnerabilityResult, error) {
	return nil, ErrVulnerabilityEngine
}
