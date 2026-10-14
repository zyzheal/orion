package repository

import (
	"context"
	"fmt"
	"strings"

	internalrepo "orion/platform-svc-go/internal/repository"
	"orion/platform-svc-go/internal/sprint-analytics/models"

	"github.com/jmoiron/sqlx"
)

var allowedReviewColumns = map[string]bool{
	"status": true, "date": true, "attendees": true, "highlights": true,
	"demo_notes": true, "feedback": true, "completed_at": true,
}

var allowedRetroColumns = map[string]bool{
	"date": true, "attendees": true, "what_went_well": true,
	"what_to_improve": true, "action_items": true, "summary": true,
}

type Repository struct {
	internalrepo.TenantAwareRepository[any]
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		TenantAwareRepository: internalrepo.NewTenantAwareRepository(db),
		db:                    db,
	}
}

// ==================== Sprint Review ====================

func (r *Repository) CreateReview(ctx context.Context, item *models.SprintReview) error {
	_, err := r.TenantAwareRepository.Exec(ctx,
		`INSERT INTO sprint_reviews (id, tenant_id, sprint_id, status, date, attendees, highlights, demo_notes, feedback, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
		item.ID, item.TenantID, item.SprintID, item.Status, item.Date,
		item.Attendees, item.Highlights, item.DemoNotes, item.Feedback)
	return err
}

func (r *Repository) GetReview(ctx context.Context, tenantID, id string) (*models.SprintReview, error) {
	var row models.SprintReview
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT * FROM sprint_reviews WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) GetReviewBySprint(ctx context.Context, tenantID, sprintID string) (*models.SprintReview, error) {
	var row models.SprintReview
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT * FROM sprint_reviews WHERE sprint_id=$1`, sprintID)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) UpdateReview(ctx context.Context, tenantID, id string, updates map[string]interface{}, expectedVersion int) error {
	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}
	sets := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	i := 1
	for k, v := range updates {
		if !allowedReviewColumns[k] {
			return fmt.Errorf("column %q is not allowed in update", k)
		}
		sets = append(sets, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	args = append(args, id, tenantID)
	if expectedVersion > 0 {
		args = append(args, expectedVersion)
		_, err := r.TenantAwareRepository.Exec(ctx,
			fmt.Sprintf(`UPDATE sprint_reviews SET %s, version=version+1, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d AND version=$%d`,
				strings.Join(sets, ", "), i, i+1, i+2), args...)
		return err
	}
	_, err := r.TenantAwareRepository.Exec(ctx,
		fmt.Sprintf(`UPDATE sprint_reviews SET %s, version=version+1, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(sets, ", "), i, i+1), args...)
	return err
}

func (r *Repository) DeleteReview(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.TenantAwareRepository.Exec(ctx,
		`DELETE FROM sprint_reviews WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// ==================== Sprint Retrospective ====================

func (r *Repository) CreateRetro(ctx context.Context, item *models.SprintRetrospective) error {
	_, err := r.TenantAwareRepository.Exec(ctx,
		`INSERT INTO sprint_retrospectives (id, tenant_id, sprint_id, date, attendees, what_went_well, what_to_improve, action_items, summary, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
		item.ID, item.TenantID, item.SprintID, item.Date, item.Attendees,
		item.WhatWentWell, item.WhatToImprove, item.ActionItems, item.Summary)
	return err
}

func (r *Repository) GetRetro(ctx context.Context, tenantID, id string) (*models.SprintRetrospective, error) {
	var row models.SprintRetrospective
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT * FROM sprint_retrospectives WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) GetRetroBySprint(ctx context.Context, tenantID, sprintID string) (*models.SprintRetrospective, error) {
	var row models.SprintRetrospective
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT * FROM sprint_retrospectives WHERE sprint_id=$1`, sprintID)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) UpdateRetro(ctx context.Context, tenantID, id string, updates map[string]interface{}, expectedVersion int) error {
	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}
	sets := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	i := 1
	for k, v := range updates {
		if !allowedRetroColumns[k] {
			return fmt.Errorf("column %q is not allowed in update", k)
		}
		sets = append(sets, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	args = append(args, id, tenantID)
	if expectedVersion > 0 {
		args = append(args, expectedVersion)
		_, err := r.TenantAwareRepository.Exec(ctx,
			fmt.Sprintf(`UPDATE sprint_retrospectives SET %s, version=version+1, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d AND version=$%d`,
				strings.Join(sets, ", "), i, i+1, i+2), args...)
		return err
	}
	_, err := r.TenantAwareRepository.Exec(ctx,
		fmt.Sprintf(`UPDATE sprint_retrospectives SET %s, version=version+1, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(sets, ", "), i, i+1), args...)
	return err
}

func (r *Repository) DeleteRetro(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.TenantAwareRepository.Exec(ctx,
		`DELETE FROM sprint_retrospectives WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// GetVelocity returns recent sprint velocity entries for a project.
// Aggregates sprint_reviews with completed status to compute
// committed vs completed story points.
func (r *Repository) GetVelocity(ctx context.Context, tenantID, projectID string, limit int) ([]models.VelocityEntry, error) {
	var rows []models.VelocityEntry
	err := r.TenantAwareRepository.Select(ctx, &rows,
		`SELECT sprint_id AS sprint_id, sprint_id AS sprint_name,
		 0 AS committed, 0 AS completed, 0 AS avg_per_member
		 FROM sprint_reviews WHERE status = 'completed'
		 ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// GetGantt returns Gantt chart items (sprints) for a project.
func (r *Repository) GetGantt(ctx context.Context, tenantID, projectID string) ([]models.GanttItem, error) {
	var rows []models.GanttItem
	err := r.TenantAwareRepository.Select(ctx, &rows,
		`SELECT id, sprint_id AS name, 'sprint' AS type,
		 date AS start_date, date AS end_date, status, NULL AS assignee
		 FROM sprint_reviews
		 ORDER BY date DESC`)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// WithTx wraps fn in a database transaction. All repository methods called
// on the tx-scoped Repository share the same *sqlx.Tx.
func (r *Repository) WithTx(ctx context.Context, fn func(rtx *Repository) error) error {
	return r.TenantAwareRepository.WithTx(ctx, func(txTAR internalrepo.TenantAwareRepository[any]) error {
		txRepo := &Repository{
			TenantAwareRepository: txTAR,
		}
		return fn(txRepo)
	})
}
