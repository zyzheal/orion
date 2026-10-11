// Package service implements the RDM code-reviews operations.
//
// Stub phase: no DB persistence. All methods return well-formed
// empty/echo responses so the 6 endpoints declared in
// orion-frontend/src/api/rdm.ts return 200 instead of 404.
//
// Real persistence (Migrations 745-754 per AA v5.4 allocation):
// when rdm_code_reviews + rdm_code_review_comments tables land,
// inject *rdm.Repository into NewService(repo) — method signatures
// will not change. Repository interface is kept minimal here so the
// compile-time dependency is a stub (interface{}); replace with a
// concrete interface when the real repo arrives.
package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"orion/platform-svc-go/internal/rdm-code-reviews/models"
)

// Repository is the future dependency for real persistence. Kept as
// interface{} so Service compiles in the stub phase; replace with a
// concrete *rdm.Repository when the tables land.
type Repository interface{}

// Service implements the 6 code-review operations declared by the
// frontend API client.
type Service struct {
	repo Repository
}

// NewService constructs a Service. Pass nil in the stub phase.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// ListCodeReviews returns code reviews for the tenant, optionally
// filtered by projectId and status.
//
// Stub: returns empty slice regardless of filters. Frontend renders
// empty state, which is the correct visual for "no code reviews yet".
func (s *Service) ListCodeReviews(ctx context.Context, tenantID, projectID, status string) ([]models.CodeReview, error) {
	_ = ctx
	_ = tenantID
	_ = projectID
	_ = status
	return []models.CodeReview{}, nil
}

// GetCodeReview returns a single review by ID.
//
// Stub: returns 404-equivalent (nil, ErrNotFound). Real impl will
// look up in rdm_code_reviews WHERE id=$1 AND tenant_id=$2.
func (s *Service) GetCodeReview(ctx context.Context, tenantID, id string) (*models.CodeReview, error) {
	_ = ctx
	_ = tenantID
	_ = id
	// Stub phase: no records exist. Return a NotFound-style result by
	// returning (nil, nil) and letting the handler map that to 404.
	// Chosen over ErrNotFound so this file doesn't introduce a new
	// error sentinel package.
	return nil, nil
}

// CreateCodeReview creates a new review record.
//
// Stub: echoes the request back with generated ID and current time.
// No persistence. Frontend createCodeReview() returns 200 with the
// expected shape so form submits don't error out.
func (s *Service) CreateCodeReview(ctx context.Context, tenantID string, req models.CreateCodeReviewRequest) (*models.CodeReview, error) {
	_ = ctx
	now := time.Now().UTC()
	return &models.CodeReview{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		ProjectID:     req.ProjectID,
		Title:         req.Title,
		SourceBranch:  req.SourceBranch,
		TargetBranch:  req.TargetBranch,
		SourceCommit:  req.SourceCommit,
		Status:        "pending",
		Reviewers:     req.Reviewers,
		CommentsCount: 0,
		CreatedAt:     now,
		UpdatedAt:     now,
	}, nil
}

// DeleteCodeReview removes a review record.
//
// Stub: no-op success. Real impl deletes from rdm_code_reviews.
func (s *Service) DeleteCodeReview(ctx context.Context, tenantID, id string) error {
	_ = ctx
	_ = tenantID
	_ = id
	return nil
}

// ListComments returns comments on a review.
//
// Stub: empty slice. Real impl joins rdm_code_review_comments on review_id.
func (s *Service) ListComments(ctx context.Context, tenantID, reviewID string) ([]models.CodeReviewComment, error) {
	_ = ctx
	_ = tenantID
	_ = reviewID
	return []models.CodeReviewComment{}, nil
}

// CreateComment adds a comment to a review.
//
// Stub: echoes request with generated ID. Real impl inserts into
// rdm_code_review_comments and increments comments_count on parent.
func (s *Service) CreateComment(ctx context.Context, tenantID, reviewID string, req models.CreateCodeReviewCommentRequest) (*models.CodeReviewComment, error) {
	_ = ctx
	return &models.CodeReviewComment{
		ID:        uuid.New().String(),
		ReviewID:  reviewID,
		Author:    "", // Would be populated from auth context in real impl.
		Content:   req.Content,
		File:      strPtrOrNil(req.File),
		Line:      req.Line,
		CreatedAt: time.Now().UTC(),
	}, nil
}

// strPtrOrNil returns nil for empty string, pointer to value otherwise.
// Keeps the JSON response null for file-level comments that aren't
// anchored to a file.
func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
