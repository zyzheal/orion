package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// JSONArray is a PostgreSQL JSONB-compatible slice type.
type JSONArray []interface{}

func (a JSONArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

func (a *JSONArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// ==================== Code Repository ====================

// CodeRepository represents a registered code repository.
type CodeRepository struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	Name         string    `db:"name" json:"name"`
	FullName     string    `db:"full_name" json:"full_name,omitempty"`
	RepoURL      string    `db:"repo_url" json:"repo_url"`
	RepoType     string    `db:"repo_type" json:"repo_type"`
	DefaultBranch string   `db:"default_branch" json:"default_branch"`
	IsPrivate    bool      `db:"is_private" json:"is_private"`
	Description  string    `db:"description" json:"description,omitempty"`
	Branch       string    `db:"branch" json:"branch"`
	CommitHash   string    `db:"commit_hash" json:"commit_hash,omitempty"`
	Language     string    `db:"language" json:"language,omitempty"`
	LinesOfCode  int       `db:"lines_of_code" json:"lines_of_code,omitempty"`
	Metadata     JSONB     `db:"metadata" json:"metadata,omitempty"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

type CreateCodeRepositoryRequest struct {
	Name     string `json:"name" binding:"required"`
	RepoURL  string `json:"repo_url" binding:"required"`
	Branch   string `json:"branch" binding:"required"`
	RepoType string `json:"repo_type"`
}

type UpdateCodeRepositoryRequest struct {
	Name         string `json:"name"`
	Branch       string `json:"branch"`
	CommitHash   string `json:"commit_hash"`
	Language     string `json:"language"`
	LinesOfCode  int    `json:"lines_of_code"`
	Description  string `json:"description"`
}

type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// ==================== Webhook ====================

// WebhookSecret stores the verification secret for a repository webhook.
type WebhookSecret struct {
	ID        string    `db:"id" json:"id"`
	RepoID    string    `db:"repo_id" json:"repo_id"`
	Secret    string    `db:"secret" json:"secret"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// WebhookEventLog records each processed webhook event.
type WebhookEventLog struct {
	ID        string    `db:"id" json:"id"`
	EventType string    `db:"event_type" json:"event_type"`
	RepoType  string    `db:"repo_type" json:"repo_type"`
	RepoName  string    `db:"repo_name" json:"repo_name"`
	EventID   string    `db:"event_id" json:"event_id,omitempty"`
	Success   bool      `db:"success" json:"success"`
	Error     string    `db:"error" json:"error,omitempty"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// WebhookProcessRequest is the inbound webhook payload from any Git provider.
type WebhookProcessRequest struct {
	EventType    string                 `json:"event_type"`
	RepoType     string                 `json:"repo_type"`
	RepositoryID string                 `json:"repository_id"`
	Repository   string                 `json:"repository_name"`
	RepositoryURL string               `json:"repository_url"`
	Sender       string                 `json:"sender"`
	Timestamp    time.Time              `json:"timestamp"`
	Payload      map[string]interface{} `json:"payload"`
}

type WebhookProcessResult struct {
	Success   bool   `json:"success"`
	Message   string `json:"message,omitempty"`
	EventID   string `json:"event_id,omitempty"`
	EventType string `json:"event_type,omitempty"`
	Error     string `json:"error,omitempty"`
}

// ==================== Branch Policy ====================

// ApprovalRule defines a single approval requirement within a branch policy.
type ApprovalRule struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	RequiredApprovals  int      `json:"required_approvals"`
	Approvers          []string `json:"approvers"`
	AllowAuthorApproval bool    `json:"allow_author_approval"`
	RequiredRoles      []string `json:"required_roles,omitempty"`
}

// BranchPolicy defines branch protection rules for a repository.
type BranchPolicy struct {
	ID                 string       `db:"id" json:"id"`
	TenantID           string       `db:"tenant_id" json:"tenant_id"`
	RepoID             string       `db:"repo_id" json:"repo_id"`
	BranchPattern      string       `db:"branch_pattern" json:"branch_pattern"`
	PreventForcePush   bool         `db:"prevent_force_push" json:"prevent_force_push"`
	PreventDeletion    bool         `db:"prevent_deletion" json:"prevent_deletion"`
	MergeStrategy      string       `db:"merge_strategy" json:"merge_strategy"`
	ApprovalRules      JSONArray    `db:"approval_rules" json:"approval_rules"`
	RequiredChecks     JSONArray    `db:"required_checks" json:"required_checks"`
	RequireCodeOwners  bool         `db:"require_code_owners" json:"require_code_owners"`
	LinearHistory      bool         `db:"linear_history" json:"linear_history"`
	AllowAdminOverride bool         `db:"allow_admin_override" json:"allow_admin_override"`
	CreatedAt          time.Time    `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time    `db:"updated_at" json:"updated_at"`
}

type CreateBranchPolicyRequest struct {
	RepoID             string         `json:"repo_id" binding:"required"`
	BranchPattern      string         `json:"branch_pattern" binding:"required"`
	PreventForcePush   *bool          `json:"prevent_force_push"`
	PreventDeletion    *bool          `json:"prevent_deletion"`
	MergeStrategy      string         `json:"merge_strategy"`
	ApprovalRules      []ApprovalRule `json:"approval_rules"`
	RequiredChecks     []string       `json:"required_checks"`
	RequireCodeOwners  *bool          `json:"require_code_owners"`
	LinearHistory      *bool          `json:"linear_history"`
	AllowAdminOverride *bool          `json:"allow_admin_override"`
}

type UpdateBranchPolicyRequest struct {
	PreventForcePush   *bool          `json:"prevent_force_push"`
	PreventDeletion    *bool          `json:"prevent_deletion"`
	MergeStrategy      string         `json:"merge_strategy"`
	ApprovalRules      []ApprovalRule `json:"approval_rules"`
	RequiredChecks     []string       `json:"required_checks"`
	RequireCodeOwners  *bool          `json:"require_code_owners"`
	LinearHistory      *bool          `json:"linear_history"`
	AllowAdminOverride *bool          `json:"allow_admin_override"`
}

// MergeCheckResult is the result of checking if a PR can merge against policy.
type MergeCheckResult struct {
	CanMerge bool              `json:"can_merge"`
	Policy   *BranchPolicy     `json:"policy,omitempty"`
	Blocks   []MergeCheckBlock `json:"blocks"`
	Warnings []string          `json:"warnings"`
}

// MergeCheckBlock represents a single blocking rule preventing a merge.
type MergeCheckBlock struct {
	Rule     string `json:"rule"`
	Reason   string `json:"reason"`
	Severity string `json:"severity"`
}

// PullRequestMergeCheckRequest is the input for a mergeability check.
type PullRequestMergeCheckRequest struct {
	SourceBranch string                       `json:"source_branch" binding:"required"`
	TargetBranch string                       `json:"target_branch" binding:"required"`
	Author       string                       `json:"author"`
	Approvals    map[string]int               `json:"approvals"`
	CheckResults map[string]string            `json:"check_results"`
	CodeOwnersApproved bool                   `json:"code_owners_approved"`
	IsAdmin      bool                         `json:"is_admin"`
}

// ==================== Code Ownership ====================

// OwnershipRule maps a file pattern to a list of owners.
type OwnershipRule struct {
	Pattern  string   `json:"pattern"`
	Owners   []string `json:"owners"`
	Line     int      `json:"line,omitempty"`
	IsGlobal bool     `json:"is_global,omitempty"`
}

// CodeOwnership is a persisted CODEOWNERS file for a repository.
type CodeOwnership struct {
	ID         string          `db:"id" json:"id"`
	TenantID   string          `db:"tenant_id" json:"tenant_id"`
	RepoID     string          `db:"repo_id" json:"repo_id"`
	FilePath   string          `db:"file_path" json:"file_path"`
	Rules      JSONArray       `db:"rules" json:"rules"`
	RawContent string          `db:"raw_content" json:"raw_content"`
	CreatedAt  time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time       `db:"updated_at" json:"updated_at"`
}

type RegisterCodeOwnershipRequest struct {
	RawContent string `json:"raw_content" binding:"required"`
	FilePath   string `json:"file_path"`
}

// OwnerRecommendation maps a file to its recommended reviewers.
type OwnerRecommendation struct {
	FilePath       string   `json:"file_path"`
	Owners         []string `json:"owners"`
	MatchedPattern string   `json:"matched_pattern"`
}

// ==================== Commit Status ====================

// CommitStatus tracks a CI/CD status check on a specific commit.
type CommitStatus struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	RepositoryID string    `db:"repository_id" json:"repository_id"`
	CommitSHA    string    `db:"commit_sha" json:"commit_sha"`
	State        string    `db:"state" json:"state"`
	TargetURL    string    `db:"target_url" json:"target_url,omitempty"`
	Description  string    `db:"description" json:"description,omitempty"`
	Context      string    `db:"context" json:"context"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

type CreateCommitStatusRequest struct {
	CommitSHA   string `json:"commit_sha" binding:"required"`
	State       string `json:"state" binding:"required"`
	TargetURL   string `json:"target_url"`
	Description string `json:"description"`
	Context     string `json:"context" binding:"required"`
}

// CommitReadiness is the result of checking whether all statuses pass.
type CommitReadiness struct {
	Ready          bool           `json:"ready"`
	Statuses       []CommitStatus `json:"statuses"`
	FailedContexts []string       `json:"failed_contexts"`
}

// ==================== Code Branches ====================

// CodeBranch represents a cached branch from a Git provider.
type CodeBranch struct {
	ID        string    `db:"id" json:"id"`
	RepoID    string    `db:"repo_id" json:"repo_id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	IsDefault bool      `db:"is_default" json:"is_default"`
	CommitSHA string    `db:"commit_sha" json:"commit_sha,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// SyncBranchesRequest is the request to sync branches from a Git provider.
type SyncBranchesRequest struct {
	Branches []SyncBranchItem `json:"branches" binding:"required"`
}

type SyncBranchItem struct {
	Name      string `json:"name"`
	CommitSHA string `json:"commit_sha"`
	IsDefault bool   `json:"is_default"`
}

// ==================== Code Commits ====================

// CodeCommit represents a single git commit.
type CodeCommit struct {
	ID           string    `db:"id" json:"id"`
	RepoID       string    `db:"repo_id" json:"repo_id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	SHA          string    `db:"sha" json:"sha"`
	Message      string    `db:"message" json:"message,omitempty"`
	AuthorName   string    `db:"author_name" json:"author_name,omitempty"`
	AuthorEmail  string    `db:"author_email" json:"author_email,omitempty"`
	CommittedAt  time.Time `db:"committed_at" json:"committed_at,omitempty"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// SyncCommitsRequest is the request to sync commits from a Git provider.
type SyncCommitsRequest struct {
	Commits []SyncCommitItem `json:"commits" binding:"required"`
}

type SyncCommitItem struct {
	SHA          string    `json:"sha"`
	Message      string    `json:"message"`
	AuthorName   string    `json:"author_name"`
	AuthorEmail  string    `json:"author_email"`
	CommittedAt  time.Time `json:"committed_at"`
}

// ==================== Code Pull Requests ====================

// CodePullRequest represents a pull request / merge request.
type CodePullRequest struct {
	ID           string    `db:"id" json:"id"`
	RepoID       string    `db:"repo_id" json:"repo_id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	Number       int       `db:"number" json:"number"`
	Title        string    `db:"title" json:"title"`
	Description  string    `db:"description" json:"description,omitempty"`
	SourceBranch string    `db:"source_branch" json:"source_branch,omitempty"`
	TargetBranch string    `db:"target_branch" json:"target_branch,omitempty"`
	State        string    `db:"state" json:"state"`
	Author       string    `db:"author" json:"author,omitempty"`
	CommitSHA    string    `db:"commit_sha" json:"commit_sha,omitempty"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

// SyncPullRequestsRequest is the request to sync pull requests from a Git provider.
type SyncPullRequestsRequest struct {
	PullRequests []SyncPRItem `json:"pull_requests" binding:"required"`
}

type SyncPRItem struct {
	Number       int    `json:"number"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	SourceBranch string `json:"source_branch"`
	TargetBranch string `json:"target_branch"`
	State        string `json:"state"`
	Author       string `json:"author"`
	CommitSHA    string `json:"commit_sha"`
}

// ==================== Code Reviews ====================

// CodeReview represents a code review on a pull request.
type CodeReview struct {
	ID        string    `db:"id" json:"id"`
	PRID      string    `db:"pr_id" json:"pr_id"`
	RepoID    string    `db:"repo_id" json:"repo_id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Reviewer  string    `db:"reviewer" json:"reviewer"`
	State     string    `db:"state" json:"state"`
	Content   string    `db:"content" json:"content,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type CreateReviewRequest struct {
	PRID     string `json:"pr_id" binding:"required"`
	RepoID   string `json:"repo_id" binding:"required"`
	Reviewer string `json:"reviewer" binding:"required"`
	State    string `json:"state" binding:"required"`
	Content  string `json:"content"`
}

type ReviewApproveRequest struct {
	Content string `json:"content"`
}

// ==================== Code Builds ====================

// CodeBuild represents a CI/CD build for a repository.
type CodeBuild struct {
	ID          string     `db:"id" json:"id"`
	RepoID      string     `db:"repo_id" json:"repo_id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	CommitSHA   string     `db:"commit_sha" json:"commit_sha,omitempty"`
	Branch      string     `db:"branch" json:"branch,omitempty"`
	Status      string     `db:"status" json:"status"`
	TriggeredBy string     `db:"triggered_by" json:"triggered_by,omitempty"`
	StartedAt   *time.Time `db:"started_at" json:"started_at,omitempty"`
	FinishedAt  *time.Time `db:"finished_at" json:"finished_at,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateBuildRequest struct {
	RepoID    string `json:"repo_id" binding:"required"`
	CommitSHA string `json:"commit_sha"`
	Branch    string `json:"branch"`
	Status    string `json:"status"`
}
