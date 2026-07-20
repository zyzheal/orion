package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/code-repo/models"

	"orion/platform-svc-go/internal/code-repo/repository"

	"github.com/jmoiron/sqlx"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AddComment(ctx context.Context, adapterID, repoID, prID, userID, username, body, path, commitSHA string, line int) (*models.Comment, error)
	AddReview(ctx context.Context, adapterID, repoID, prID, userID, username, state, body string) (*models.Review, error)
	ClosePullRequest(ctx context.Context, adapterID, repoID, prID string) error
	CreateBranch(ctx context.Context, adapterID, repoID, name string) error
	CreatePullRequest(ctx context.Context, adapterID, repoID string, req models.CreatePullRequestRequest) (*models.PullRequest, error)
	DeleteBranch(ctx context.Context, adapterID, repoID, name string) error
	GetCommit(ctx context.Context, adapterID, repoID, sha string) (*models.Commit, error)
	GetFileDiff(ctx context.Context, adapterID, repoID, base, head, path string) ([]models.FileDiff, error)
	GetPullRequest(ctx context.Context, adapterID, repoID, prID string) (*models.PullRequest, error)
	GetRepository(ctx context.Context, adapterID, repoID string) (*models.CodeRepo, error)
	GetWebhookSecret(ctx context.Context, repoID string) (*models.WebhookSecret, error)
	ListAdapters(ctx context.Context) ([]models.CodeRepoAdapter, error)
	ListBranches(ctx context.Context, adapterID, repoID string) ([]models.Branch, error)
	ListCodeOwners(ctx context.Context, repoID string) ([]models.CodeOwner, error)
	ListComments(ctx context.Context, adapterID, repoID, prID string) ([]models.Comment, error)
	ListCommits(ctx context.Context, adapterID, repoID string, limit, offset int) ([]models.Commit, error)
	ListPullRequests(ctx context.Context, adapterID, repoID string, state *string) ([]models.PullRequest, error)
	ListRepositories(ctx context.Context, adapterID string) ([]models.CodeRepo, error)
	ListReviews(ctx context.Context, adapterID, repoID, prID string) ([]models.Review, error)
	ListWebhookLogs(ctx context.Context, limit, offset int) ([]map[string]interface{}, error)
	MergePullRequest(ctx context.Context, adapterID, repoID, prID string) error
	UpdatePullRequest(ctx context.Context, adapterID, repoID, prID string, updates map[string]interface{}) (*models.PullRequest, error)
	UpsertWebhookSecret(ctx context.Context, repoID, secret string) (*models.WebhookSecret, error)
}

type Service struct {
	repo RepositoryInterface
	db   *sqlx.DB
}

func NewService(repo RepositoryInterface, db *sqlx.DB) *Service {
	return &Service{repo: repo, db: db}
}

// --- Adapters ---

// ListAdapters returns all configured adapters.
func (s *Service) ListAdapters(ctx context.Context) ([]models.CodeRepoAdapter, error) {
	return s.repo.ListAdapters(ctx)
}

// --- Repositories ---

// ListRepositories returns all repos for an adapter.
func (s *Service) ListRepositories(ctx context.Context, adapterID string) ([]models.CodeRepo, error) {
	return s.repo.ListRepositories(ctx, adapterID)
}

// GetRepository returns a single repo.
func (s *Service) GetRepository(ctx context.Context, adapterID, repoID string) (*models.CodeRepo, error) {
	return s.repo.GetRepository(ctx, adapterID, repoID)
}

// --- Branches ---

// ListBranches returns all branches for a repo.
func (s *Service) ListBranches(ctx context.Context, adapterID, repoID string) ([]models.Branch, error) {
	return s.repo.ListBranches(ctx, adapterID, repoID)
}

// CreateBranch creates a new branch.
func (s *Service) CreateBranch(ctx context.Context, adapterID, repoID string, req models.CreateBranchRequest) error {
	if req.Name == "" {
		return errors.New("branch name is required")
	}
	return s.repo.CreateBranch(ctx, adapterID, repoID, req.Name)
}

// DeleteBranch deletes a branch.
func (s *Service) DeleteBranch(ctx context.Context, adapterID, repoID, branchName string) error {
	return s.repo.DeleteBranch(ctx, adapterID, repoID, branchName)
}

// --- Pull Requests ---

// ListPullRequests returns PRs for a repo.
func (s *Service) ListPullRequests(ctx context.Context, adapterID, repoID, state string) ([]models.PullRequest, error) {
	var statePtr *string
	if state != "" {
		statePtr = &state
	}
	return s.repo.ListPullRequests(ctx, adapterID, repoID, statePtr)
}

// GetPullRequest returns a single PR.
func (s *Service) GetPullRequest(ctx context.Context, adapterID, repoID, prID string) (*models.PullRequest, error) {
	return s.repo.GetPullRequest(ctx, adapterID, repoID, prID)
}

// CreatePullRequest creates a new PR.
func (s *Service) CreatePullRequest(ctx context.Context, adapterID, repoID string, req models.CreatePullRequestRequest) (*models.PullRequest, error) {
	return s.repo.CreatePullRequest(ctx, adapterID, repoID, req)
}

// UpdatePullRequest updates a PR's fields.
func (s *Service) UpdatePullRequest(ctx context.Context, adapterID, repoID, prID string, req models.UpdatePullRequestRequest) (*models.PullRequest, error) {
	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Body != nil {
		updates["body"] = *req.Body
	}
	if req.State != nil {
		updates["state"] = *req.State
	}
	if len(req.Assignees) > 0 {
		updates["assignees"] = fmt.Sprintf("%v", req.Assignees)
	}
	return s.repo.UpdatePullRequest(ctx, adapterID, repoID, prID, updates)
}

// MergePullRequest marks a PR as merged.
func (s *Service) MergePullRequest(ctx context.Context, adapterID, repoID, prID string) error {
	return s.repo.MergePullRequest(ctx, adapterID, repoID, prID)
}

// ClosePullRequest marks a PR as closed.
func (s *Service) ClosePullRequest(ctx context.Context, adapterID, repoID, prID string) error {
	return s.repo.ClosePullRequest(ctx, adapterID, repoID, prID)
}

// --- Reviews ---

// AddReview adds a review to a PR.
func (s *Service) AddReview(ctx context.Context, adapterID, repoID, prID string, userID, username string, req models.CreateReviewRequest) (*models.Review, error) {
	return s.repo.AddReview(ctx, adapterID, repoID, prID, userID, username, req.State, req.Body)
}

// ListReviews lists reviews for a PR.
func (s *Service) ListReviews(ctx context.Context, adapterID, repoID, prID string) ([]models.Review, error) {
	return s.repo.ListReviews(ctx, adapterID, repoID, prID)
}

// --- Comments ---

// AddComment adds a comment to a PR.
func (s *Service) AddComment(ctx context.Context, adapterID, repoID, prID string, userID, username string, req models.CreateCommentRequest) (*models.Comment, error) {
	return s.repo.AddComment(ctx, adapterID, repoID, prID, userID, username, req.Body, req.Path, req.CommitSHA, req.Line)
}

// ListComments lists comments for a PR.
func (s *Service) ListComments(ctx context.Context, adapterID, repoID, prID string) ([]models.Comment, error) {
	return s.repo.ListComments(ctx, adapterID, repoID, prID)
}

// --- Commits ---

// ListCommits returns commits with pagination.
func (s *Service) ListCommits(ctx context.Context, adapterID, repoID string, limit, offset int) ([]models.Commit, error) {
	return s.repo.ListCommits(ctx, adapterID, repoID, limit, offset)
}

// GetCommit returns a single commit.
func (s *Service) GetCommit(ctx context.Context, adapterID, repoID, sha string) (*models.Commit, error) {
	return s.repo.GetCommit(ctx, adapterID, repoID, sha)
}

// --- File Diff ---

// GetFileDiff returns file diffs between refs.
func (s *Service) GetFileDiff(ctx context.Context, adapterID, repoID string, base, head, path string) ([]models.FileDiff, error) {
	return s.repo.GetFileDiff(ctx, adapterID, repoID, base, head, path)
}

// --- Code Owners ---

// ListCodeOwners returns CODEOWNERS entries.
func (s *Service) ListCodeOwners(ctx context.Context, repoID string) ([]models.CodeOwner, error) {
	return s.repo.ListCodeOwners(ctx, repoID)
}

// --- Webhooks ---

// ListWebhookLogs returns webhook delivery logs.
func (s *Service) ListWebhookLogs(ctx context.Context, limit, offset int) ([]map[string]interface{}, error) {
	return s.repo.ListWebhookLogs(ctx, limit, offset)
}

// --- Webhook Secrets ---

// SetWebhookSecret upserts the secret for a repo.
func (s *Service) SetWebhookSecret(ctx context.Context, repoID, secret string) (*models.WebhookSecretResponse, error) {
	if secret == "" {
		return nil, errors.New("secret is required")
	}
	sv, err := s.repo.UpsertWebhookSecret(ctx, repoID, secret)
	if err != nil {
		return nil, fmt.Errorf("failed to set webhook secret: %w", err)
	}
	return repository.WebhookSecretMaskedResponse(sv), nil
}

// GetWebhookSecret returns the masked secret for a repo.
func (s *Service) GetWebhookSecret(ctx context.Context, repoID string) (*models.WebhookSecretResponse, error) {
	sv, err := s.repo.GetWebhookSecret(ctx, repoID)
	if err != nil {
		if repository.IsNotFound(err) {
			return nil, ErrNotFoundSecret
		}
		return nil, err
	}
	return repository.WebhookSecretMaskedResponse(sv), nil
}

// RotateWebhookSecret generates or upserts a new secret.
func (s *Service) RotateWebhookSecret(ctx context.Context, repoID, providedSecret string) (*models.WebhookSecretResponse, error) {
	secret := providedSecret
	if secret == "" {
		secret = fmt.Sprintf("whsec_%d_%s", time.Now().UnixMilli(), randomHex(16))
	}
	sv, err := s.repo.UpsertWebhookSecret(ctx, repoID, secret)
	if err != nil {
		return nil, fmt.Errorf("failed to rotate webhook secret: %w", err)
	}
	resp := repository.WebhookSecretMaskedResponse(sv)
	resp.RotatedAt = &sv.UpdatedAt
	return resp, nil
}

// --- Errors ---

var (
	ErrNotFoundSecret = errors.New("webhook secret not found")
	ErrInvalidBranch  = errors.New("invalid branch")
	ErrInvalidPR      = errors.New("invalid pull request")
	ErrInvalidRef     = errors.New("invalid ref")
	ErrInvalidSecret  = errors.New("invalid secret")
	ErrNotImplemented = errors.New("not implemented")
	ErrInvalidRepo    = errors.New("invalid repository")
)

// IsNotFound returns true if the error indicates a resource was not found.
// ErrNotImplementedMsg creates a not-implemented error.
func ErrNotImplementedMsg(action string) error {
	return fmt.Errorf("%s: %w", action, ErrNotImplemented)
}

// randomHex generates a lowercase hex string of n bytes using crypto/rand.
func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// unused sentinel — sqlx.DB is used for potential direct queries
var _ = sqlx.NewDb
