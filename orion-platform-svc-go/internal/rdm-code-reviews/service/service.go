// Package service implements the RDM code-reviews operations.
// It persists code review records and comments to PostgreSQL.
package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"orion/platform-svc-go/internal/rdm-code-reviews/models"
	baserepo "orion/platform-svc-go/internal/repository"
)

// ReviewRepository defines the data access methods for code reviews.
type ReviewRepository interface {
	ListCodeReviews(ctx context.Context, tenantID, projectID, status string) ([]models.CodeReview, error)
	GetCodeReview(ctx context.Context, tenantID, id string) (*models.CodeReview, error)
	CreateCodeReview(ctx context.Context, review *models.CodeReview) error
	DeleteCodeReview(ctx context.Context, tenantID, id string) error
	ListComments(ctx context.Context, tenantID, reviewID string) ([]models.CodeReviewComment, error)
	CreateComment(ctx context.Context, comment *models.CodeReviewComment) error
}

// Service implements the 6 code-review operations.
type Service struct {
	repo ReviewRepository
}

// NewService constructs a Service. Pass nil for a no-op stub service;
// pass a concrete *repository.Repository for real persistence.
func NewService(repo ReviewRepository) *Service {
	return &Service{repo: repo}
}

// ListCodeReviews returns code reviews for the tenant.
func (s *Service) ListCodeReviews(ctx context.Context, tenantID, projectID, status string) ([]models.CodeReview, error) {
	ctx = baserepo.WithTenant(ctx, tenantID)
	if s.repo == nil {
		return []models.CodeReview{}, nil
	}
	return s.repo.ListCodeReviews(ctx, tenantID, projectID, status)
}

// GetCodeReview returns a single review by ID.
func (s *Service) GetCodeReview(ctx context.Context, tenantID, id string) (*models.CodeReview, error) {
	ctx = baserepo.WithTenant(ctx, tenantID)
	if s.repo == nil {
		return nil, nil
	}
	return s.repo.GetCodeReview(ctx, tenantID, id)
}

// CreateCodeReview creates a new review record.
func (s *Service) CreateCodeReview(ctx context.Context, tenantID string, req models.CreateCodeReviewRequest) (*models.CodeReview, error) {
	ctx = baserepo.WithTenant(ctx, tenantID)
	if s.repo == nil {
		// Stub fallback: echo back with generated ID
		now := time.Now().UTC()
		return &models.CodeReview{
			ID: uuid.New().String(), TenantID: tenantID, ProjectID: req.ProjectID,
			Title: req.Title, SourceBranch: req.SourceBranch, TargetBranch: req.TargetBranch,
			SourceCommit: req.SourceCommit, Status: "pending", Reviewers: req.Reviewers,
			CommentsCount: 0, CreatedAt: now, UpdatedAt: now,
		}, nil
	}
	now := time.Now().UTC()
	review := &models.CodeReview{
		ID: uuid.New().String(), TenantID: tenantID, ProjectID: req.ProjectID,
		Title: req.Title, SourceBranch: req.SourceBranch, TargetBranch: req.TargetBranch,
		SourceCommit: req.SourceCommit, Status: "pending", Reviewers: req.Reviewers,
		CommentsCount: 0, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.repo.CreateCodeReview(ctx, review); err != nil {
		return nil, fmt.Errorf("create code review: %w", err)
	}
	return review, nil
}

// DeleteCodeReview removes a review record.
func (s *Service) DeleteCodeReview(ctx context.Context, tenantID, id string) error {
	ctx = baserepo.WithTenant(ctx, tenantID)
	if s.repo == nil {
		return nil
	}
	return s.repo.DeleteCodeReview(ctx, tenantID, id)
}

// ListComments returns comments on a review.
func (s *Service) ListComments(ctx context.Context, tenantID, reviewID string) ([]models.CodeReviewComment, error) {
	ctx = baserepo.WithTenant(ctx, tenantID)
	if s.repo == nil {
		return []models.CodeReviewComment{}, nil
	}
	return s.repo.ListComments(ctx, tenantID, reviewID)
}

// CreateComment adds a comment to a review.
func (s *Service) CreateComment(ctx context.Context, tenantID, reviewID string, req models.CreateCodeReviewCommentRequest) (*models.CodeReviewComment, error) {
	ctx = baserepo.WithTenant(ctx, tenantID)
	if s.repo == nil {
		// Stub fallback
		return &models.CodeReviewComment{
			ID: uuid.New().String(), ReviewID: reviewID,
			Content: req.Content, File: strPtrOrNil(req.File), Line: req.Line,
			CreatedAt: time.Now().UTC(),
		}, nil
	}
	var file *string
	if req.File != "" {
		file = &req.File
	}
	comment := &models.CodeReviewComment{
		ID: uuid.New().String(), TenantID: tenantID, ReviewID: reviewID,
		Content: req.Content, File: file, Line: req.Line,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.repo.CreateComment(ctx, comment); err != nil {
		return nil, fmt.Errorf("create comment: %w", err)
	}
	return comment, nil
}

func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
