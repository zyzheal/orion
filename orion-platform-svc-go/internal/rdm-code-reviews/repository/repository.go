// Package repository provides the data access layer for RDM code reviews.
// It persists code review records and their comments to PostgreSQL.
package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/rdm-code-reviews/models"
	baserepo "orion/platform-svc-go/internal/repository"
)

// Repository provides CRUD operations for code reviews and comments.
type Repository struct {
	TenantAwareRepository baserepo.TenantAwareRepository[any]
}

// NewRepository creates a new RDM code reviews repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		TenantAwareRepository: baserepo.NewTenantAwareRepository(db),
	}
}

// ListCodeReviews returns code reviews for the tenant, optionally filtered.
func (r *Repository) ListCodeReviews(ctx context.Context, tenantID, projectID, status string) ([]models.CodeReview, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if projectID != "" {
		where = append(where, fmt.Sprintf("project_id = $%d", idx))
		args = append(args, projectID)
		idx++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", idx))
		args = append(args, status)
		idx++
	}

	whereStr := ""
	for i, w := range where {
		if i > 0 {
			whereStr += " AND "
		}
		whereStr += w
	}

	var rows []models.CodeReview
	err := r.TenantAwareRepository.Select(ctx, &rows,
		fmt.Sprintf(`SELECT id, tenant_id, project_id, title, source_branch, target_branch,
			source_commit, status, author, reviewers, comments_count, created_at, updated_at
			FROM rdm_code_reviews WHERE %s ORDER BY created_at DESC`, whereStr), args...)
	if err != nil {
		return nil, fmt.Errorf("list code reviews: %w", err)
	}
	if rows == nil {
		return []models.CodeReview{}, nil
	}
	return rows, nil
}

// GetCodeReview returns a single code review by ID.
func (r *Repository) GetCodeReview(ctx context.Context, tenantID, id string) (*models.CodeReview, error) {
	var row models.CodeReview
	err := r.TenantAwareRepository.Get(ctx, &row,
		`SELECT id, tenant_id, project_id, title, source_branch, target_branch,
			source_commit, status, author, reviewers, comments_count, created_at, updated_at
		FROM rdm_code_reviews WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get code review: %w", err)
	}
	return &row, nil
}

// CreateCodeReview inserts a new code review record.
func (r *Repository) CreateCodeReview(ctx context.Context, review *models.CodeReview) error {
	_, err := r.TenantAwareRepository.Exec(ctx,
		`INSERT INTO rdm_code_reviews (id, tenant_id, project_id, title, source_branch, target_branch,
			source_commit, status, author, reviewers, comments_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		review.ID, review.TenantID, review.ProjectID, review.Title, review.SourceBranch,
		review.TargetBranch, review.SourceCommit, review.Status, review.Author,
		review.Reviewers, review.CommentsCount, review.CreatedAt, review.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create code review: %w", err)
	}
	return nil
}

// DeleteCodeReview removes a code review and its comments (cascade).
func (r *Repository) DeleteCodeReview(ctx context.Context, tenantID, id string) error {
	_, err := r.TenantAwareRepository.Exec(ctx,
		`DELETE FROM rdm_code_reviews WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete code review: %w", err)
	}
	return nil
}

// ListComments returns comments for a code review.
func (r *Repository) ListComments(ctx context.Context, tenantID, reviewID string) ([]models.CodeReviewComment, error) {
	var rows []models.CodeReviewComment
	err := r.TenantAwareRepository.Select(ctx, &rows,
		`SELECT id, review_id, author, content, file, line, created_at
		FROM rdm_code_review_comments WHERE review_id = $1 ORDER BY created_at ASC`, reviewID)
	if err != nil {
		return nil, fmt.Errorf("list comments: %w", err)
	}
	if rows == nil {
		return []models.CodeReviewComment{}, nil
	}
	return rows, nil
}

// CreateComment inserts a new comment on a code review.
func (r *Repository) CreateComment(ctx context.Context, comment *models.CodeReviewComment) error {
	_, err := r.TenantAwareRepository.Exec(ctx,
		`INSERT INTO rdm_code_review_comments (id, tenant_id, review_id, author, content, file, line, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		comment.ID, comment.TenantID, comment.ReviewID, comment.Author,
		comment.Content, comment.File, comment.Line, comment.CreatedAt)
	if err != nil {
		return fmt.Errorf("create comment: %w", err)
	}

	// Increment comments_count on the parent review
	_, _ = r.TenantAwareRepository.Exec(ctx,
		`UPDATE rdm_code_reviews SET comments_count = comments_count + 1, updated_at = NOW() WHERE id = $1`,
		comment.ReviewID)

	return nil
}

// GenerateID creates a new UUID for code review records.
func GenerateID() string {
	return uuid.New().String()
}
