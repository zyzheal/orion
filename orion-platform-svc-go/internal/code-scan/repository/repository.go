package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/code-scan/models"

	"github.com/jmoiron/sqlx"
)

// Every SELECT below names its columns explicitly instead of using *.
//
// go-common's database.Connect goes through sqlx.Open and never calls Unsafe,
// so sqlx scans in safe mode and a wildcard select dies on the first row as
// soon as a migration adds a column the models do not declare --
// "missing destination name <col>". That error is not sql.ErrNoRows, so it
// walks repository -> service -> handler and every read endpoint answers 500
// instead of data. Naming the columns returns exactly what the models declare.
const (
	runColumns = "id, tenant_id, target, branch, status, total_vulns, critical_count, high_count, medium_count, low_count, duration_sec, error, started_at, completed_at, created_at"

	findingColumns = "id, tenant_id, scan_id, category, severity, file_path, line, description, fix, created_at"
)

// Repository is the data access layer for code scan runs and their findings.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// getOne turns the driver's sql.ErrNoRows into sentinel.NotFound. The handler
// answers 404 only for errors.Is(err, sentinel.NotFound), so returning the raw
// driver error would turn a missing id into 500 "sql: no rows".
func (r *Repository) getOne(ctx context.Context, dest any, query string, args ...any) error {
	err := r.db.GetContext(ctx, dest, query, args...)
	if errors.Is(err, sql.ErrNoRows) {
		return sentinel.NotFound
	}
	return err
}

// Create inserts a pending run. The scan itself happens in the service worker,
// which is why status stays 'pending' until StartScan moves it to 'running'.
func (r *Repository) Create(ctx context.Context, rec *models.ScanRecord) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO code_scan_runs
			(id, tenant_id, target, branch, status, total_vulns, critical_count, high_count, medium_count, low_count, duration_sec, error, started_at, completed_at, created_at)
		VALUES (:id, :tenant_id, :target, :branch, :status, :total_vulns, :critical_count, :high_count, :medium_count, :low_count, :duration_sec, :error, :started_at, :completed_at, :created_at)`, rec)
	return err
}

// List returns the tenant's runs, newest first, capped at limit.
//
// tenant_id is always bound: the runs table is shared by every tenant in the
// platform, so an unscoped query would hand one tenant another tenant's targets.
func (r *Repository) List(ctx context.Context, tenantID string, limit int) ([]models.ScanRecord, error) {
	out := make([]models.ScanRecord, 0, limit)
	err := r.db.SelectContext(ctx, &out,
		`SELECT `+runColumns+` FROM code_scan_runs WHERE tenant_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2`,
		tenantID, limit)
	return out, err
}

// GetByID returns one of the tenant's runs, or sentinel.NotFound.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ScanRecord, error) {
	rec := &models.ScanRecord{}
	if err := r.getOne(ctx, rec, `SELECT `+runColumns+` FROM code_scan_runs WHERE tenant_id=$1 AND id=$2`, tenantID, id); err != nil {
		return nil, err
	}
	return rec, nil
}

// StartScan moves a run to 'running', resets its counters, clears its previous
// error, and drops the findings the last attempt produced. It serves both a
// fresh run (nothing to drop) and a rerun, so the rerun can never surface the
// previous attempt's findings under a new 'completed' status.
//
// The counter reset matters: a rerun of a clean tree must report 0 findings,
// not the 47 the first attempt found.
func (r *Repository) StartScan(ctx context.Context, tenantID, id string, startedAt time.Time) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		`DELETE FROM code_scan_findings WHERE tenant_id=$1 AND scan_id=$2`, tenantID, id); err != nil {
		return err
	}

	res, err := tx.ExecContext(ctx,
		`UPDATE code_scan_runs SET status='running', total_vulns=0, critical_count=0, high_count=0, medium_count=0, low_count=0, duration_sec=0, error='', started_at=$3, completed_at=NULL
		 WHERE tenant_id=$1 AND id=$2`, startedAt, tenantID, id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("code-scan %s: %w", id, sentinel.NotFound)
	}
	return tx.Commit()
}

// FailScan records a run that could not be scanned, keeping the error text so
// the caller can see why instead of staring at a 'running' row forever.
func (r *Repository) FailScan(ctx context.Context, tenantID, id, errMsg string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE code_scan_runs SET status='failed', completed_at=NOW(), error=$3
		 WHERE tenant_id=$1 AND id=$2`, tenantID, id, errMsg)
	return err
}

// FinishScan writes the findings and the final status of one completed run in
// a single transaction.
//
// Both halves are inside one transaction because a crash between them would
// otherwise leave a run that says 'completed' with 47 findings and no rows in
// the findings table, or a findings table with results the run does not credit.
func (r *Repository) FinishScan(ctx context.Context, tenantID, id string, counts models.Counts, durationSec int, completedAt time.Time, findings []models.VulnFinding) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		`DELETE FROM code_scan_findings WHERE tenant_id=$1 AND scan_id=$2`, tenantID, id); err != nil {
		return err
	}

	res, err := tx.ExecContext(ctx,
		`UPDATE code_scan_runs SET status='completed', total_vulns=$3, critical_count=$4, high_count=$5, medium_count=$6, low_count=$7, duration_sec=$8, error='', completed_at=$9
		 WHERE tenant_id=$1 AND id=$2`,
		counts.Total, counts.Critical, counts.High, counts.Medium, counts.Low, durationSec, completedAt, tenantID, id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("code-scan %s: %w", id, sentinel.NotFound)
	}

	for i := range findings {
		if _, err := tx.NamedExecContext(ctx, `
			INSERT INTO code_scan_findings
				(id, tenant_id, scan_id, category, severity, file_path, line, description, fix, created_at)
			VALUES (:id, :tenant_id, :scan_id, :category, :severity, :file_path, :line, :description, :fix, :created_at)`,
			&findings[i]); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ListFindings returns the tenant's findings, optionally restricted to one
// scan. The two query strings are spelled out rather than assembled so each
// one pins its placeholder positions in the sqlmock tests.
func (r *Repository) ListFindings(ctx context.Context, tenantID, scanID string, limit int) ([]models.VulnFinding, error) {
	out := make([]models.VulnFinding, 0, limit)
	if scanID == "" {
		err := r.db.SelectContext(ctx, &out,
			`SELECT `+findingColumns+` FROM code_scan_findings WHERE tenant_id=$1 ORDER BY severity, created_at DESC, id DESC LIMIT $2`,
			tenantID, limit)
		return out, err
	}
	err := r.db.SelectContext(ctx, &out,
		`SELECT `+findingColumns+` FROM code_scan_findings WHERE tenant_id=$1 AND scan_id=$2 ORDER BY severity, created_at DESC, id DESC LIMIT $3`,
		tenantID, scanID, limit)
	return out, err
}
