package repository

import (
	"context"
	"orion/platform-svc-go/internal/code-repo/models"
)


// RepositoryInterface defines the data access contract for the code-repo module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	ListAdapters(ctx context.Context) ([]models.CodeRepoAdapter, error)
	ListRepositories(ctx context.Context, adapterID string) ([]models.CodeRepo, error)
	GetRepository(ctx context.Context, adapterID, repoID string) (*models.CodeRepo, error)
	ListBranches(ctx context.Context, adapterID, repoID string) ([]models.Branch, error)
	CreateBranch(ctx context.Context, adapterID, repoID, name string) error
	DeleteBranch(ctx context.Context, adapterID, repoID, name string) error
	ListPullRequests(ctx context.Context, adapterID, repoID string, state *string) ([]models.PullRequest, error)
	GetPullRequest(ctx context.Context, adapterID, repoID, prID string) (*models.PullRequest, error)
	CreatePullRequest(ctx context.Context, adapterID, repoID string, req models.CreatePullRequestRequest) (*models.PullRequest, error)
	UpdatePullRequest(ctx context.Context, adapterID, repoID, prID string, updates map[string]interface{}) (*models.PullRequest, error)
	MergePullRequest(ctx context.Context, adapterID, repoID, prID string) error
	ClosePullRequest(ctx context.Context, adapterID, repoID, prID string) error
	AddReview(ctx context.Context, adapterID, repoID, prID, userID, username, state, body string) (*models.Review, error)
	ListReviews(ctx context.Context, adapterID, repoID, prID string) ([]models.Review, error)
	AddComment(ctx context.Context, adapterID, repoID, prID, userID, username, body, path, commitSHA string, line int) (*models.Comment, error)
	ListComments(ctx context.Context, adapterID, repoID, prID string) ([]models.Comment, error)
	ListCommits(ctx context.Context, adapterID, repoID string, limit, offset int) ([]models.Commit, error)
	GetCommit(ctx context.Context, adapterID, repoID, sha string) (*models.Commit, error)
	GetFileDiff(ctx context.Context, adapterID, repoID, base, head, path string) ([]models.FileDiff, error)
	ListCodeOwners(ctx context.Context, repoID string) ([]models.CodeOwner, error)
	ListWebhookLogs(ctx context.Context, limit, offset int) ([]map[string]interface{}, error)
	UpsertWebhookSecret(ctx context.Context, repoID, secret string) (*models.WebhookSecret, error)
	GetWebhookSecret(ctx context.Context, repoID string) (*models.WebhookSecret, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
