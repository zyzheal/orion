package models

import "time"

// CodeRepoAdapter represents a source control adapter (GitHub, GitLab, etc.).
type CodeRepoAdapter struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Type      string    `json:"type" db:"type"`     // github, gitlab, bitbucket
	Status    string    `json:"status" db:"status"` // active, inactive
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// CodeRepo represents a repository linked through an adapter.
type CodeRepo struct {
	AdapterID     string    `json:"adapter_id" db:"adapter_id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	RepoID        string    `json:"repo_id" db:"repo_id"`
	Name          string    `json:"name" db:"name"`
	FullName      string    `json:"full_name" db:"full_name"`
	URL           string    `json:"url" db:"url"`
	IsPrivate     bool      `json:"is_private" db:"is_private"`
	DefaultBranch string    `json:"default_branch" db:"default_branch"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// Branch represents a git branch.
type Branch struct {
	TenantID    string `json:"tenant_id" db:"tenant_id"`
	Name        string `json:"name" db:"name"`
	Default     bool   `json:"default" db:"default"`
	CommitSHA   string `json:"commit_sha" db:"commit_sha"`
	LastUpdated string `json:"last_updated" db:"last_updated"`
}

type CreateBranchRequest struct {
	SourceBranch string `json:"source_branch" binding:"required"`
	Name         string `json:"name" binding:"required"`
}

// PullRequest represents a merge request / pull request.
type PullRequest struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Title     string    `json:"title" db:"title"`
	Body      string    `json:"body" db:"body"`
	State     string    `json:"state" db:"state"` // open, closed, merged
	Source    string    `json:"source_branch" db:"source_branch"`
	Target    string    `json:"target_branch" db:"target_branch"`
	Creator   string    `json:"creator" db:"creator"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
	Assignees []string  `json:"assignees" db:"assignees"`
}

type CreatePullRequestRequest struct {
	Title        string   `json:"title" binding:"required"`
	Body         string   `json:"body"`
	SourceBranch string   `json:"source_branch" binding:"required"`
	TargetBranch string   `json:"target_branch" binding:"required"`
	Assignees    []string `json:"assignees"`
}

type UpdatePullRequestRequest struct {
	Title     *string  `json:"title"`
	Body      *string  `json:"body"`
	State     *string  `json:"state"`
	Assignees []string `json:"assignees"`
	RepoID    string   `json:"repo_id"`
}

// MergeOptions controls how a PR is merged.
type MergeOptions struct {
	MergeMethod string `json:"merge_method"` // merge, squash, rebase
	Message     string `json:"message"`
}

// Review represents a PR review.
type Review struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	PRID      string    `json:"pr_id" db:"pr_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Username  string    `json:"username" db:"username"`
	State     string    `json:"state" db:"state"` // APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED
	Body      string    `json:"body" db:"body"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateReviewRequest struct {
	State string `json:"state" binding:"required"`
	Body  string `json:"body"`
}

// Comment represents a PR comment (global or line-level).
type Comment struct {
	ID        string    `json:"id" db:"id"`
	PRID      string    `json:"pr_id" db:"pr_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Username  string    `json:"username" db:"username"`
	Body      string    `json:"body" db:"body"`
	Path      string    `json:"path" db:"path"` // for line comments
	Line      int       `json:"line" db:"line"` // for line comments
	CommitSHA string    `json:"commit_sha" db:"commit_sha"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateCommentRequest struct {
	Body      string `json:"body" binding:"required"`
	Path      string `json:"path"`
	Line      int    `json:"line"`
	CommitSHA string `json:"commit_sha"`
}

// Commit represents a git commit.
type Commit struct {
	SHA       string    `json:"sha" db:"sha"`
	Message   string    `json:"message" db:"message"`
	Author    string    `json:"author" db:"author"`
	Committer string    `json:"committer" db:"committer"`
	Date      time.Time `json:"date" db:"date"`
	URL       string    `json:"url" db:"url"`
	Parents   []string  `json:"parents" db:"parents"`
	Added     []string  `json:"added" db:"added"`
	Modified  []string  `json:"modified" db:"modified"`
	Removed   []string  `json:"removed" db:"removed"`
}

// FileDiff represents a file-level diff.
type FileDiff struct {
	Filename    string `json:"filename"`
	Status      string `json:"status"` // A, M, D, R
	OldFilename string `json:"old_filename"`
	Patch       string `json:"patch"`
}

type GetFileDiffQuery struct {
	Base string `json:"base"` // base ref/commit
	Head string `json:"head"` // head ref/commit
	Path string `json:"path"` // optional file path filter
}

// WebhookSecret holds a secret used for webhook signature verification.
type WebhookSecret struct {
	ID        int       `json:"id" db:"id"`
	RepoID    string    `json:"repo_id" db:"repo_id"`
	Secret    string    `json:"-" db:"secret"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// WebhookSecretResponse is the masked form returned to clients.
type WebhookSecretResponse struct {
	ID        int        `json:"id"`
	RepoID    string     `json:"repo_id"`
	Secret    string     `json:"secret"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	RotatedAt *time.Time `json:"rotated_at,omitempty"`
}

type SetWebhookSecretRequest struct {
	Secret string `json:"secret" binding:"required"`
}

// CodeOwner represents a CODEOWNERS entry.
type CodeOwner struct {
	Pattern string   `json:"pattern"`
	Owners  []string `json:"owners"`
}

// Query helper for pagination.
type ListQuery struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}
