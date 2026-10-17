package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"orion/platform-svc-go/internal/rdm-code-reviews/models"
)

// mockReviewRepo implements ReviewRepository for testing.
type mockReviewRepo struct {
	reviews      []models.CodeReview
	review       *models.CodeReview
	comments     []models.CodeReviewComment
	comment      *models.CodeReviewComment
	createErr    error
	deleteErr    error
	listErr      error
	getErr       error
	commentErr   error
	createCalled bool
	deleteCalled bool
}

func (m *mockReviewRepo) ListCodeReviews(ctx context.Context, tenantID, projectID, status string) ([]models.CodeReview, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	return m.reviews, nil
}

func (m *mockReviewRepo) GetCodeReview(ctx context.Context, tenantID, id string) (*models.CodeReview, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	return m.review, nil
}

func (m *mockReviewRepo) CreateCodeReview(ctx context.Context, review *models.CodeReview) error {
	m.createCalled = true
	return m.createErr
}

func (m *mockReviewRepo) DeleteCodeReview(ctx context.Context, tenantID, id string) error {
	m.deleteCalled = true
	return m.deleteErr
}

func (m *mockReviewRepo) ListComments(ctx context.Context, tenantID, reviewID string) ([]models.CodeReviewComment, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	return m.comments, nil
}

func (m *mockReviewRepo) CreateComment(ctx context.Context, comment *models.CodeReviewComment) error {
	m.createCalled = true
	return m.commentErr
}

func TestListCodeReviews_WithRepo(t *testing.T) {
	repo := &mockReviewRepo{
		reviews: []models.CodeReview{{ID: "r1", Title: "Review 1"}},
	}
	svc := NewService(repo)

	result, err := svc.ListCodeReviews(context.Background(), "t1", "proj-1", "")
	if err != nil {
		t.Fatalf("ListCodeReviews: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 review, got %d", len(result))
	}
	if result[0].Title != "Review 1" {
		t.Errorf("expected title 'Review 1', got %q", result[0].Title)
	}
}

func TestListCodeReviews_NilRepo(t *testing.T) {
	svc := NewService(nil)
	result, err := svc.ListCodeReviews(context.Background(), "t1", "proj-1", "")
	if err != nil {
		t.Fatalf("ListCodeReviews: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0 reviews, got %d", len(result))
	}
}

func TestGetCodeReview_WithRepo(t *testing.T) {
	repo := &mockReviewRepo{
		review: &models.CodeReview{ID: "r1", Title: "Review 1", Status: "approved"},
	}
	svc := NewService(repo)

	result, err := svc.GetCodeReview(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatalf("GetCodeReview: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Title != "Review 1" {
		t.Errorf("expected title 'Review 1', got %q", result.Title)
	}
}

func TestGetCodeReview_NilRepo(t *testing.T) {
	svc := NewService(nil)
	result, err := svc.GetCodeReview(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatalf("GetCodeReview: %v", err)
	}
	if result != nil {
		t.Error("expected nil result for nil repo")
	}
}

func TestCreateCodeReview_WithRepo(t *testing.T) {
	repo := &mockReviewRepo{}
	svc := NewService(repo)

	result, err := svc.CreateCodeReview(context.Background(), "t1", models.CreateCodeReviewRequest{
		ProjectID:    "proj-1",
		Title:        "New Review",
		SourceBranch: "feature/x",
		TargetBranch: "main",
		SourceCommit: "abc123",
		Reviewers:    []string{"user1"},
	})
	if err != nil {
		t.Fatalf("CreateCodeReview: %v", err)
	}
	if result.ID == "" {
		t.Error("expected non-empty ID")
	}
	if _, err := uuid.Parse(result.ID); err != nil {
		t.Errorf("expected valid UUID, got %q: %v", result.ID, err)
	}
	if result.Status != "pending" {
		t.Errorf("expected status 'pending', got %q", result.Status)
	}
	if result.TenantID != "t1" {
		t.Errorf("expected tenant 't1', got %q", result.TenantID)
	}
	if !repo.createCalled {
		t.Error("expected repo.CreateCodeReview to be called")
	}
}

func TestCreateCodeReview_NilRepo(t *testing.T) {
	svc := NewService(nil)

	result, err := svc.CreateCodeReview(context.Background(), "t1", models.CreateCodeReviewRequest{
		ProjectID:    "proj-1",
		Title:        "New Review",
		SourceBranch: "feature/x",
		TargetBranch: "main",
		SourceCommit: "abc123",
	})
	if err != nil {
		t.Fatalf("CreateCodeReview: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.ID == "" {
		t.Error("expected non-empty ID")
	}
}

func TestDeleteCodeReview_WithRepo(t *testing.T) {
	repo := &mockReviewRepo{}
	svc := NewService(repo)

	err := svc.DeleteCodeReview(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatalf("DeleteCodeReview: %v", err)
	}
	if !repo.deleteCalled {
		t.Error("expected repo.DeleteCodeReview to be called")
	}
}

func TestDeleteCodeReview_NilRepo(t *testing.T) {
	svc := NewService(nil)
	err := svc.DeleteCodeReview(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatalf("DeleteCodeReview: %v", err)
	}
}

func TestListComments_WithRepo(t *testing.T) {
	repo := &mockReviewRepo{
		comments: []models.CodeReviewComment{{ID: "c1", Content: "Good code"}},
	}
	svc := NewService(repo)

	result, err := svc.ListComments(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatalf("ListComments: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 comment, got %d", len(result))
	}
	if result[0].Content != "Good code" {
		t.Errorf("expected content 'Good code', got %q", result[0].Content)
	}
}

func TestListComments_NilRepo(t *testing.T) {
	svc := NewService(nil)
	result, err := svc.ListComments(context.Background(), "t1", "r1")
	if err != nil {
		t.Fatalf("ListComments: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0 comments, got %d", len(result))
	}
}

func TestCreateComment_WithRepo(t *testing.T) {
	repo := &mockReviewRepo{}
	svc := NewService(repo)

	line := 42
	result, err := svc.CreateComment(context.Background(), "t1", "r1", models.CreateCodeReviewCommentRequest{
		Content: "Looks good",
		File:    "main.go",
		Line:    &line,
	})
	if err != nil {
		t.Fatalf("CreateComment: %v", err)
	}
	if result.ID == "" {
		t.Error("expected non-empty ID")
	}
	if result.TenantID != "t1" {
		t.Errorf("expected tenant 't1', got %q", result.TenantID)
	}
	if result.ReviewID != "r1" {
		t.Errorf("expected review 'r1', got %q", result.ReviewID)
	}
	if result.File == nil || *result.File != "main.go" {
		t.Error("expected file 'main.go'")
	}
}

func TestCreateComment_NilRepo(t *testing.T) {
	svc := NewService(nil)
	result, err := svc.CreateComment(context.Background(), "t1", "r1", models.CreateCodeReviewCommentRequest{
		Content: "Test comment",
	})
	if err != nil {
		t.Fatalf("CreateComment: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Content != "Test comment" {
		t.Errorf("expected content 'Test comment', got %q", result.Content)
	}
}
