package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/code-repo/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Adapters ---

// ListAdapters returns all configured source control adapters.
func (r *Repository) ListAdapters(ctx context.Context) ([]models.CodeRepoAdapter, error) {
	var items []models.CodeRepoAdapter
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, name, type, status, created_at FROM code_repo_adapters ORDER BY name`)
	return items, err
}

// --- Repositories ---

// ListRepositories returns all repos for a given adapter.
func (r *Repository) ListRepositories(ctx context.Context, adapterID string) ([]models.CodeRepo, error) {
	var items []models.CodeRepo
	err := r.db.SelectContext(ctx, &items,
		`SELECT adapter_id, repo_id, name, full_name, url, is_private, default_branch, created_at
		 FROM code_repo_repos WHERE adapter_id=$1 ORDER BY name`,
		adapterID)
	return items, err
}

// GetRepository returns a single repo.
func (r *Repository) GetRepository(ctx context.Context, adapterID, repoID string) (*models.CodeRepo, error) {
	var m models.CodeRepo
	err := r.db.GetContext(ctx, &m,
		`SELECT adapter_id, repo_id, name, full_name, url, is_private, default_branch, created_at
		 FROM code_repo_repos WHERE adapter_id=$1 AND repo_id=$2`,
		adapterID, repoID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// --- Branches ---

// ListBranches returns all branches for a repo.
func (r *Repository) ListBranches(ctx context.Context, adapterID, repoID string) ([]models.Branch, error) {
	var items []models.Branch
	err := r.db.SelectContext(ctx, &items,
		`SELECT name, default, commit_sha, last_updated
		 FROM code_repo_branches WHERE adapter_id=$1 AND repo_id=$2 ORDER BY name`,
		adapterID, repoID)
	return items, err
}

// CreateBranch inserts a new branch record.
func (r *Repository) CreateBranch(ctx context.Context, adapterID, repoID, name string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO code_repo_branches (adapter_id, repo_id, name, commit_sha, default, last_updated)
		 VALUES ($1, $2, $3, '', false, NOW())
		 ON CONFLICT (adapter_id, repo_id, name) DO NOTHING`,
		adapterID, repoID, name)
	return err
}

// DeleteBranch removes a branch record.
func (r *Repository) DeleteBranch(ctx context.Context, adapterID, repoID, name string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM code_repo_branches WHERE adapter_id=$1 AND repo_id=$2 AND name=$3`,
		adapterID, repoID, name)
	return err
}

// --- Pull Requests ---

// ListPullRequests returns PRs for a repo, optionally filtered by state.
func (r *Repository) ListPullRequests(ctx context.Context, adapterID, repoID string, state *string) ([]models.PullRequest, error) {
	var items []models.PullRequest
	if state != nil && *state != "" {
		err := r.db.SelectContext(ctx, &items,
			`SELECT pr_id, title, body, state, source_branch, target_branch, creator,
			   created_at, updated_at, assignees
			 FROM code_repo_pull_requests
			 WHERE adapter_id=$1 AND repo_id=$2 AND state=$3
			 ORDER BY updated_at DESC`,
			adapterID, repoID, *state)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT pr_id, title, body, state, source_branch, target_branch, creator,
		   created_at, updated_at, assignees
		 FROM code_repo_pull_requests
		 WHERE adapter_id=$1 AND repo_id=$2
		 ORDER BY updated_at DESC`,
		adapterID, repoID)
	return items, err
}

// GetPullRequest returns a single PR by ID.
func (r *Repository) GetPullRequest(ctx context.Context, adapterID, repoID, prID string) (*models.PullRequest, error) {
	var m models.PullRequest
	err := r.db.GetContext(ctx, &m,
		`SELECT pr_id, title, body, state, source_branch, target_branch, creator,
		   created_at, updated_at, assignees
		 FROM code_repo_pull_requests
		 WHERE adapter_id=$1 AND repo_id=$2 AND pr_id=$3`,
		adapterID, repoID, prID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// CreatePullRequest inserts a new PR and returns it.
func (r *Repository) CreatePullRequest(ctx context.Context, adapterID, repoID string, req models.CreatePullRequestRequest) (*models.PullRequest, error) {
	prID := uuid.New().String()
	var assigneesJSON string
	if len(req.Assignees) > 0 {
		b, err := json.Marshal(req.Assignees)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal assignees: %w", err)
		}
		assigneesJSON = string(b)
	}
	var m models.PullRequest
	err := r.db.GetContext(ctx, &m,
		`SELECT pr_id, title, body, state, source_branch, target_branch, creator,
		   created_at, updated_at, assignees
		 FROM (INSERT INTO code_repo_pull_requests
			(adapter_id, repo_id, pr_id, title, body, state, source_branch, target_branch, creator, created_at, updated_at, assignees)
			 VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, '', NOW(), NOW(), $8)
			RETURNING pr_id, title, body, state, source_branch, target_branch, creator, created_at, updated_at, assignees) AS t`,
		adapterID, repoID, prID, req.Title, req.Body, req.SourceBranch, req.TargetBranch, assigneesJSON)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// UpdatePullRequest updates fields on an existing PR.
func (r *Repository) UpdatePullRequest(ctx context.Context, adapterID, repoID, prID string, updates map[string]interface{}) (*models.PullRequest, error) {
	updates["updated_at"] = time.Now().UTC()
	setParts := []string{}
	args := []interface{}{}
	idx := 1
	for k, v := range updates {
		if v == nil {
			continue
		}
		switch val := v.(type) {
		case string:
			setParts = append(setParts, fmt.Sprintf("%s=$%d", k, idx))
			args = append(args, val)
			idx++
		case *string:
			if val != nil {
				setParts = append(setParts, fmt.Sprintf("%s=$%d", k, idx))
				args = append(args, *val)
				// Use a different parameter index to avoid collision
				idx++
			}
		case bool:
			setParts = append(setParts, fmt.Sprintf("%s=$%d", k, idx))
			args = append(args, val)
			idx++
		case time.Time:
			setParts = append(setParts, fmt.Sprintf("%s=$%d", k, idx))
			args = append(args, val)
			idx++
		}
	}
	if len(setParts) == 0 {
		return r.GetPullRequest(ctx, adapterID, repoID, prID)
	}
	args = append(args, adapterID, repoID, prID)
	whereIdx := idx
	nextIdx := idx + 1
	lastIdx := idx + 2
	query := fmt.Sprintf(`UPDATE code_repo_pull_requests SET %s WHERE adapter_id=$%d AND repo_id=$%d AND pr_id=$%d`,
		strings.Join(setParts, ", "), whereIdx, nextIdx, lastIdx)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetPullRequest(ctx, adapterID, repoID, prID)
}

// MergePullRequest marks a PR as merged.
func (r *Repository) MergePullRequest(ctx context.Context, adapterID, repoID, prID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE code_repo_pull_requests SET state='merged', updated_at=NOW()
		 WHERE adapter_id=$1 AND repo_id=$2 AND pr_id=$3`,
		adapterID, repoID, prID)
	return err
}

// ClosePullRequest marks a PR as closed.
func (r *Repository) ClosePullRequest(ctx context.Context, adapterID, repoID, prID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE code_repo_pull_requests SET state='closed', updated_at=NOW()
		 WHERE adapter_id=$1 AND repo_id=$2 AND pr_id=$3`,
		adapterID, repoID, prID)
	return err
}

// --- Reviews ---

// AddReview inserts a new review on a PR.
func (r *Repository) AddReview(ctx context.Context, adapterID, repoID, prID, userID, username, state, body string) (*models.Review, error) {
	var m models.Review
	now := time.Now().UTC()
	err := r.db.GetContext(ctx, &m,
		`SELECT id, pr_id, user_id, username, state, body, created_at
		 FROM (INSERT INTO code_repo_reviews
			(adapter_id, repo_id, pr_id, user_id, username, state, body, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id, pr_id, user_id, username, state, body, created_at) AS t`,
		adapterID, repoID, prID, userID, username, state, body, now)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ListReviews returns all reviews for a PR.
func (r *Repository) ListReviews(ctx context.Context, adapterID, repoID, prID string) ([]models.Review, error) {
	var items []models.Review
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, pr_id, user_id, username, state, body, created_at
		 FROM code_repo_reviews
		 WHERE adapter_id=$1 AND repo_id=$2 AND pr_id=$3
		 ORDER BY created_at ASC`,
		adapterID, repoID, prID)
	return items, err
}

// --- Comments ---

// AddComment inserts a new comment on a PR.
func (r *Repository) AddComment(ctx context.Context, adapterID, repoID, prID, userID, username, body, path, commitSHA string, line int) (*models.Comment, error) {
	var m models.Comment
	now := time.Now().UTC()
	err := r.db.GetContext(ctx, &m,
		`SELECT id, pr_id, user_id, username, body, path, line, commit_sha, created_at
		 FROM (INSERT INTO code_repo_comments
			(adapter_id, repo_id, pr_id, user_id, username, body, path, line, commit_sha, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			RETURNING id, pr_id, user_id, username, body, path, line, commit_sha, created_at) AS t`,
		adapterID, repoID, prID, userID, username, body, path, line, commitSHA, now)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ListComments returns all comments for a PR.
func (r *Repository) ListComments(ctx context.Context, adapterID, repoID, prID string) ([]models.Comment, error) {
	var items []models.Comment
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, pr_id, user_id, username, body, path, line, commit_sha, created_at
		 FROM code_repo_comments
		 WHERE adapter_id=$1 AND repo_id=$2 AND pr_id=$3
		 ORDER BY created_at ASC`,
		adapterID, repoID, prID)
	return items, err
}

// --- Commits ---

// ListCommits returns commits for a repo with pagination.
func (r *Repository) ListCommits(ctx context.Context, adapterID, repoID string, limit, offset int) ([]models.Commit, error) {
	if limit <= 0 {
		limit = 20
	}
	var items []models.Commit
	err := r.db.SelectContext(ctx, &items,
		`SELECT sha, message, author, committer, date, url, parents, added, modified, removed
		 FROM code_repo_commits
		 WHERE adapter_id=$1 AND repo_id=$2
		 ORDER BY date DESC
		 LIMIT $3 OFFSET $4`,
		adapterID, repoID, limit, offset)
	return items, err
}

// GetCommit returns a single commit by SHA.
func (r *Repository) GetCommit(ctx context.Context, adapterID, repoID, sha string) (*models.Commit, error) {
	var m models.Commit
	err := r.db.GetContext(ctx, &m,
		`SELECT sha, message, author, committer, date, url, parents, added, modified, removed
		 FROM code_repo_commits
		 WHERE adapter_id=$1 AND repo_id=$2 AND sha=$3`,
		adapterID, repoID, sha)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// --- File Diff ---

// GetFileDiff returns the file-level diff between two refs.
func (r *Repository) GetFileDiff(ctx context.Context, adapterID, repoID, base, head, path string) ([]models.FileDiff, error) {
	var items []models.FileDiff
	if path != "" {
		err := r.db.SelectContext(ctx, &items,
			`SELECT filename, status, old_filename, patch
			 FROM code_repo_diffs
			 WHERE adapter_id=$1 AND repo_id=$2 AND base=$3 AND head=$4 AND filename=$5`,
			adapterID, repoID, base, head, path)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT filename, status, old_filename, patch
		 FROM code_repo_diffs
		 WHERE adapter_id=$1 AND repo_id=$2 AND base=$3 AND head=$4`,
		adapterID, repoID, base, head)
	return items, err
}

// --- Code Owners ---

// ListCodeOwners returns CODEOWNERS entries for a repo.
func (r *Repository) ListCodeOwners(ctx context.Context, repoID string) ([]models.CodeOwner, error) {
	// TODO: query code_repo_codeowners table.
	return []models.CodeOwner{}, nil
}

// --- Webhook logs ---

// ListWebhookLogs returns webhook delivery logs.
func (r *Repository) ListWebhookLogs(ctx context.Context, limit, offset int) ([]map[string]interface{}, error) {
	// TODO: query webhook delivery logs.
	return []map[string]interface{}{}, nil
}

// --- Webhook Secrets ---

// UpsertWebhookSecret inserts or updates the secret for a repo.
func (r *Repository) UpsertWebhookSecret(ctx context.Context, repoID, secret string) (*models.WebhookSecret, error) {
	now := time.Now().UTC()
	var db models.WebhookSecret
	err := r.db.GetContext(ctx, &db,
		`SELECT id, repo_id, secret, created_at, updated_at
		 FROM (INSERT INTO code_repo_webhook_secrets (repo_id, secret, created_at, updated_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (repo_id) DO UPDATE SET secret=$2, updated_at=$4
			 RETURNING id, repo_id, secret, created_at, updated_at) AS t`,
		repoID, secret, now, now)
	if err != nil {
		return nil, err
	}
	return &db, nil
}

// GetWebhookSecret returns the secret for a repo.
func (r *Repository) GetWebhookSecret(ctx context.Context, repoID string) (*models.WebhookSecret, error) {
	var db models.WebhookSecret
	err := r.db.GetContext(ctx, &db,
		`SELECT id, repo_id, secret, created_at, updated_at
		 FROM code_repo_webhook_secrets WHERE repo_id=$1`,
		repoID)
	if err != nil {
		return nil, err
	}
	return &db, nil
}

// maskSecret masks a secret for safe display.
func maskSecret(secret string) string {
	if len(secret) >= 8 {
		return secret[:4] + "****" + secret[len(secret)-4:]
	}
	if len(secret) >= 2 {
		return secret[:2] + "****"
	}
	if len(secret) >= 1 {
		return secret[:1] + "****"
	}
	return "****"
}

// WebhookSecretMaskedResponse creates the masked response for a secret.
func WebhookSecretMaskedResponse(s *models.WebhookSecret) *models.WebhookSecretResponse {
	return &models.WebhookSecretResponse{
		ID:        s.ID,
		RepoID:    s.RepoID,
		Secret:    maskSecret(s.Secret),
		CreatedAt: s.CreatedAt,
		UpdatedAt: s.UpdatedAt,
	}
}

// --- Errors ---

var (
	ErrNotFound = errors.New("not found")
)

// IsNotFound returns true if err indicates a resource was not found.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}
