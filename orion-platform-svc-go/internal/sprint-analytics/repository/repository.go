package repository

import (
	"context"
	"fmt"
	"strings"

	internalrepo "orion/platform-svc-go/internal/repository"
	"orion/platform-svc-go/internal/sprint-analytics/models"

	"github.com/jmoiron/sqlx"
)

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
	_, err := r.db.ExecContext(ctx,
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

func (r *Repository) UpdateReview(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}
	sets := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	i := 1
	for k, v := range updates {
		sets = append(sets, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE sprint_reviews SET %s, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(sets, ", "), i, i+1), args...)
	return err
}

// ==================== Sprint Retrospective ====================

func (r *Repository) CreateRetro(ctx context.Context, item *models.SprintRetrospective) error {
	_, err := r.db.ExecContext(ctx,
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

func (r *Repository) UpdateRetro(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}
	sets := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	i := 1
	for k, v := range updates {
		sets = append(sets, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE sprint_retrospectives SET %s, updated_at=NOW() WHERE id=$%d AND tenant_id=$%d`,
			strings.Join(sets, ", "), i, i+1), args...)
	return err
}
