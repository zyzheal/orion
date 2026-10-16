// Package repository provides the data access layer for RDM statistics.
// It queries the rdm_requirements table to compute burndown, velocity,
// defect statistics, and sprint summaries.
package repository

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/rdm-statistics/models"
	"orion/platform-svc-go/internal/repository"
)

// Repository provides aggregated statistics from the rdm_requirements table.
type Repository struct {
	TenantAwareRepository repository.TenantAwareRepository[any]
}

// NewRepository creates a new RDM statistics repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		TenantAwareRepository: repository.NewTenantAwareRepository(db),
	}
}

// GetBurndown returns burndown data points for a sprint.
// It computes the current remaining points vs the ideal trajectory.
// Since we don't have daily history tables, this returns a single
// "current" data point plus the ideal start/end points.
func (r *Repository) GetBurndown(ctx context.Context, tenantID, sprintID string) ([]models.BurndownPoint, error) {
	type pointRow struct {
		TotalPoints     int    `db:"total_points"`
		CompletedPoints int    `db:"completed_points"`
		SprintStart     string `db:"sprint_start"`
	}
	var row pointRow
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT
			COALESCE(SUM(effort_points), 0) AS total_points,
			COALESCE(SUM(CASE WHEN status = 'done' THEN effort_points ELSE 0 END), 0) AS completed_points,
			COALESCE(MIN(created_at)::date::text, '') AS sprint_start
		FROM rdm_requirements
		WHERE sprint_id = $1`, sprintID)
	if err != nil {
		return nil, fmt.Errorf("get burndown: %w", err)
	}

	if row.TotalPoints == 0 {
		return []models.BurndownPoint{}, nil
	}

	remaining := row.TotalPoints - row.CompletedPoints
	points := []models.BurndownPoint{
		{
			Date:            row.SprintStart,
			RemainingPoints: row.TotalPoints,
			IdealPoints:     row.TotalPoints,
		},
		{
			Date:            row.SprintStart,
			RemainingPoints: remaining,
			IdealPoints:     row.TotalPoints / 2,
		},
		{
			Date:            row.SprintStart,
			RemainingPoints: 0,
			IdealPoints:     0,
		},
	}
	return points, nil
}

// GetVelocity returns velocity (completed points) across recent sprints.
func (r *Repository) GetVelocity(ctx context.Context, tenantID, projectID string, limit int) ([]models.VelocityPoint, error) {
	query := `SELECT
			sprint_id AS sprint,
			COALESCE(SUM(CASE WHEN status = 'done' THEN effort_points ELSE 0 END), 0) AS completed_points
		FROM rdm_requirements
		WHERE sprint_id IS NOT NULL AND status = 'done'
		GROUP BY sprint_id
		ORDER BY MAX(created_at) DESC`
	args := []interface{}{}
	if limit > 0 {
		query += ` LIMIT $1`
		args = append(args, limit)
	}
	var rows []models.VelocityPoint
	err := r.TenantAwareRepository.Select(ctx, &rows, query, args...)
	if err != nil {
		return nil, fmt.Errorf("get velocity: %w", err)
	}
	if rows == nil {
		return []models.VelocityPoint{}, nil
	}
	return rows, nil
}

// GetDefectStats returns defect counts by severity and status.
// Defects are rdm_requirements with type = 'bug'.
func (r *Repository) GetDefectStats(ctx context.Context, tenantID, projectID string) (*models.DefectStats, error) {
	var bySeverity []models.DefectBySeverity
	err := r.TenantAwareRepository.Select(ctx, &bySeverity,
		`SELECT
			COALESCE(NULLIF(severity, ''), 'unspecified') AS severity,
			COUNT(*) AS count
		FROM rdm_requirements
		WHERE type = 'bug'
		GROUP BY severity
		ORDER BY count DESC`)
	if err != nil {
		return nil, fmt.Errorf("get defect stats by severity: %w", err)
	}
	if bySeverity == nil {
		bySeverity = []models.DefectBySeverity{}
	}

	var byStatus []models.DefectByStatus
	err = r.TenantAwareRepository.Select(ctx, &byStatus,
		`SELECT
			status,
			COUNT(*) AS count
		FROM rdm_requirements
		WHERE type = 'bug'
		GROUP BY status
		ORDER BY count DESC`)
	if err != nil {
		return nil, fmt.Errorf("get defect stats by status: %w", err)
	}
	if byStatus == nil {
		byStatus = []models.DefectByStatus{}
	}

	return &models.DefectStats{
		BySeverity: bySeverity,
		ByStatus:   byStatus,
	}, nil
}

// GetSprintStats returns per-sprint aggregate stats.
func (r *Repository) GetSprintStats(ctx context.Context, tenantID, projectID string) (models.SprintSummaryList, error) {
	var rows []models.SprintSummary
	err := r.TenantAwareRepository.Select(ctx, &rows,
		`SELECT
			sprint_id AS sprint_id,
			sprint_id AS sprint_name,
			COUNT(*) AS total_tasks,
			COUNT(*) FILTER (WHERE status = 'done') AS completed_tasks,
			COALESCE(SUM(effort_points), 0) AS total_points,
			COALESCE(SUM(CASE WHEN status = 'done' THEN effort_points ELSE 0 END), 0) AS completed_points
		FROM rdm_requirements
		WHERE sprint_id IS NOT NULL
		GROUP BY sprint_id
		ORDER BY MAX(created_at) DESC`)
	if err != nil {
		return nil, fmt.Errorf("get sprint stats: %w", err)
	}
	if rows == nil {
		return models.SprintSummaryList{}, nil
	}
	return models.SprintSummaryList(rows), nil
}
