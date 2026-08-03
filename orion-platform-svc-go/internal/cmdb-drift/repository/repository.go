package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cmdb-drift/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound  = sql.ErrNoRows
	ErrDuplicate = errors.New("duplicate key")
)

// Repository provides data access for drift records.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// CreateDrift inserts a new drift record.
func (r *Repository) CreateDrift(ctx context.Context, d *models.DriftRecord) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	d.CreatedAt = now
	d.UpdatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_drift_records
			(id, tenant_id, ci_id, ci_name, ci_type, property, environment,
			 expected_value, actual_value, drift_type, severity,
			 detected_at, resolved_at, resolved_by, resolution, remediated,
			 created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
		d.ID, d.TenantID, d.CIID, d.CIName, d.CIType, d.Property, d.Environment,
		d.ExpectedValue, d.ActualValue, d.DriftType, d.Severity,
		d.DetectedAt, d.ResolvedAt, d.ResolvedBy, d.Resolution, d.Remediated,
		d.CreatedAt, d.UpdatedAt,
	)
	return err
}

// BatchCreateDrifts bulk inserts drift records.
func (r *Repository) BatchCreateDrifts(ctx context.Context, drifts []models.DriftRecord) error {
	if len(drifts) == 0 {
		return nil
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO cmdb_drift_records
			(id, tenant_id, ci_id, ci_name, ci_type, property, environment,
			 expected_value, actual_value, drift_type, severity,
			 detected_at, resolved_at, resolved_by, resolution, remediated,
			 created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
	)
	if err != nil {
		return fmt.Errorf("prepare: %w", err)
	}
	defer stmt.Close()

	now := time.Now().UTC()
	for i := range drifts {
		d := &drifts[i]
		if d.ID == "" {
			d.ID = uuid.New().String()
		}
		d.CreatedAt = now
		d.UpdatedAt = now
		if d.DetectedAt.IsZero() {
			d.DetectedAt = now
		}

		_, err := stmt.ExecContext(ctx,
			d.ID, d.TenantID, d.CIID, d.CIName, d.CIType, d.Property, d.Environment,
			d.ExpectedValue, d.ActualValue, d.DriftType, d.Severity,
			d.DetectedAt, d.ResolvedAt, d.ResolvedBy, d.Resolution, d.Remediated,
			d.CreatedAt, d.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("insert drift %d: %w", i, err)
		}
	}

	return tx.Commit()
}

// GetDrift returns a single drift record by id, scoped to tenant.
func (r *Repository) GetDrift(ctx context.Context, tenantID, id string) (*models.DriftRecord, error) {
	var d models.DriftRecord
	err := r.db.GetContext(ctx, &d,
		`SELECT id, tenant_id, ci_id, ci_name, ci_type, property, environment,
		        expected_value, actual_value, drift_type, severity,
		        detected_at, resolved_at, resolved_by, resolution, remediated,
		        created_at, updated_at
		 FROM cmdb_drift_records
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ListDrifts returns drift records for a tenant with optional filters.
func (r *Repository) ListDrifts(ctx context.Context, tenantID string, filter models.DriftFilter) ([]models.DriftRecord, error) {
	var items []models.DriftRecord

	query := `SELECT id, tenant_id, ci_id, ci_name, ci_type, property, environment,
	                 expected_value, actual_value, drift_type, severity,
	                 detected_at, resolved_at, resolved_by, resolution, remediated,
	                 created_at, updated_at
	          FROM cmdb_drift_records
	          WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIdx := 2

	if filter.Environment != "" {
		query += fmt.Sprintf(" AND environment = $%d", argIdx)
		args = append(args, filter.Environment)
		argIdx++
	}
	if filter.CIID != "" {
		query += fmt.Sprintf(" AND ci_id = $%d", argIdx)
		args = append(args, filter.CIID)
		argIdx++
	}
	if filter.CIType != "" {
		query += fmt.Sprintf(" AND ci_type = $%d", argIdx)
		args = append(args, filter.CIType)
		argIdx++
	}
	if filter.DriftType != "" {
		query += fmt.Sprintf(" AND drift_type = $%d", argIdx)
		args = append(args, filter.DriftType)
		argIdx++
	}
	if filter.Severity != "" {
		query += fmt.Sprintf(" AND severity = $%d", argIdx)
		args = append(args, filter.Severity)
		argIdx++
	}
	if filter.UnresolvedOnly {
		query += " AND resolved_at IS NULL"
	}

	query += " ORDER BY detected_at DESC"

	// Apply pagination
	if filter.PageSize > 0 {
		if filter.Page <= 0 {
			filter.Page = 1
		}
		offset := (filter.Page - 1) * filter.PageSize
		query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
		args = append(args, filter.PageSize, offset)
	}

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// CountDrifts returns the total count of drift records matching the filter.
func (r *Repository) CountDrifts(ctx context.Context, tenantID string, filter models.DriftFilter) (int, error) {
	query := `SELECT COUNT(*) FROM cmdb_drift_records WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filter.Environment != "" {
		query += fmt.Sprintf(" AND environment = $%d", argIdx)
		args = append(args, filter.Environment)
		argIdx++
	}
	if filter.UnresolvedOnly {
		query += " AND resolved_at IS NULL"
	}

	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// UpdateDriftResolution updates the resolution status of a drift record.
func (r *Repository) UpdateDriftResolution(ctx context.Context, tenantID, id, resolvedBy, resolution string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cmdb_drift_records
		 SET resolved_at = NOW(), resolved_by = $1, resolution = $2, updated_at = NOW()
		 WHERE id = $3 AND tenant_id = $4`,
		resolvedBy, resolution, id, tenantID,
	)
	return err
}

// BulkUpdateDriftResolution resolves multiple drift records at once.
func (r *Repository) BulkUpdateDriftResolution(ctx context.Context, tenantID string, ids []string, resolvedBy, resolution string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	query := `UPDATE cmdb_drift_records
	           SET resolved_at = NOW(), resolved_by = $1, resolution = $2, updated_at = NOW()
	           WHERE tenant_id = $3 AND id = ANY($4)`

	result, err := r.db.ExecContext(ctx, query, resolvedBy, resolution, tenantID, ids)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// MarkRemediated marks a drift record as auto-remediated.
func (r *Repository) MarkRemediated(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cmdb_drift_records
		 SET remediated = TRUE, resolved_at = NOW(), updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	return err
}

// CountUnresolvedDrifts returns the count of unresolved drifts.
func (r *Repository) CountUnresolvedDrifts(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM cmdb_drift_records
		 WHERE tenant_id = $1 AND resolved_at IS NULL`,
		tenantID,
	)
	return count, err
}

// GetDriftStats returns aggregated drift statistics.
func (r *Repository) GetDriftStats(ctx context.Context, tenantID string) (*models.DriftStats, error) {
	stats := &models.DriftStats{
		ByType:     make(map[string]int),
		BySeverity: make(map[string]int),
	}

	// Total count
	err := r.db.GetContext(ctx, &stats.TotalDrifts,
		`SELECT COUNT(*) FROM cmdb_drift_records WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, err
	}

	// Unresolved count
	err = r.db.GetContext(ctx, &stats.UnresolvedCount,
		`SELECT COUNT(*) FROM cmdb_drift_records WHERE tenant_id = $1 AND resolved_at IS NULL`, tenantID)
	if err != nil {
		return nil, err
	}

	// Count by severity
	rows, err := r.db.QueryContext(ctx,
		`SELECT severity, COUNT(*) as cnt FROM cmdb_drift_records
		 WHERE tenant_id = $1 AND resolved_at IS NULL
		 GROUP BY severity`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var sev string
		var cnt int
		if err := rows.Scan(&sev, &cnt); err != nil {
			return nil, err
		}
		stats.BySeverity[sev] = cnt
		switch sev {
		case "critical":
			stats.CriticalCount = cnt
		case "warning":
			stats.WarningCount = cnt
		case "info":
			stats.InfoCount = cnt
		}
	}

	// Count by type
	rows2, err := r.db.QueryContext(ctx,
		`SELECT drift_type, COUNT(*) as cnt FROM cmdb_drift_records
		 WHERE tenant_id = $1 AND resolved_at IS NULL
		 GROUP BY drift_type`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()
	for rows2.Next() {
		var dt string
		var cnt int
		if err := rows2.Scan(&dt, &cnt); err != nil {
			return nil, err
		}
		stats.ByType[dt] = cnt
	}

	return stats, nil
}

// DeleteDrift removes a drift record.
func (r *Repository) DeleteDrift(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM cmdb_drift_records WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}