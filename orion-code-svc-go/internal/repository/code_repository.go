package repository

import (
	"context"
	"strconv"

	"orion/code-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// Repository is the PostgreSQL data access layer for all code-svc entities.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Code Repositories ====================

// Create inserts a new code repository record.
func (r *Repository) Create(ctx context.Context, d *models.CodeRepository) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO code_repositories
			(id, tenant_id, name, full_name, repo_url, repo_type, default_branch,
			 is_private, description, branch, commit_hash, language, lines_of_code, metadata)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		d.ID, d.TenantID, d.Name, d.FullName, d.RepoURL, d.RepoType, d.DefaultBranch,
		d.IsPrivate, d.Description, d.Branch, d.CommitHash, d.Language, d.LinesOfCode, d.Metadata,
	)
	return err
}

// List returns a paginated slice of code repositories for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.CodeRepository, error) {
	var items []models.CodeRepository
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, full_name, repo_url, repo_type, default_branch,
		        is_private, description, branch, commit_hash, language, lines_of_code,
		        metadata, created_at, updated_at
		   FROM code_repositories
		  WHERE tenant_id = $1
		  ORDER BY created_at DESC
		  OFFSET $2 LIMIT $3`,
		tenantID, offset, limit,
	)
	return items, err
}

// GetByID fetches a single code repository by ID and tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.CodeRepository, error) {
	var d models.CodeRepository
	err := r.db.GetContext(ctx, &d,
		`SELECT id, tenant_id, name, full_name, repo_url, repo_type, default_branch,
		        is_private, description, branch, commit_hash, language, lines_of_code,
		        metadata, created_at, updated_at
		   FROM code_repositories
		  WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Update modifies an existing code repository.
func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.UpdateCodeRepositoryRequest) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE code_repositories
		    SET name = COALESCE(NULLIF($3, ''), name),
		        branch = COALESCE(NULLIF($4, ''), branch),
		        commit_hash = COALESCE(NULLIF($5, ''), commit_hash),
		        language = COALESCE(NULLIF($6, ''), language),
		        lines_of_code = $7,
		        description = COALESCE(NULLIF($8, ''), description),
		        updated_at = NOW()
		  WHERE id = $1 AND tenant_id = $2`,
		id, tenantID, req.Name, req.Branch, req.CommitHash, req.Language, req.LinesOfCode, req.Description,
	)
	return err
}

// Delete removes a code repository by ID and tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM code_repositories WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	return err
}

// Count returns the total number of repositories for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM code_repositories WHERE tenant_id = $1`,
		tenantID,
	)
	return count, err
}

// ==================== Webhook Secrets ====================

// UpsertWebhookSecret inserts or updates a webhook secret for a repository.
func (r *Repository) UpsertWebhookSecret(ctx context.Context, tenantID, repoID, secret string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO webhook_secrets (id, repo_id, secret, tenant_id, created_at, updated_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
		 ON CONFLICT (repo_id) DO UPDATE SET secret = $2, updated_at = NOW()`,
		repoID, secret, tenantID,
	)
	return err
}

// GetWebhookSecret fetches the webhook secret for a repository.
func (r *Repository) GetWebhookSecret(ctx context.Context, repoID string) (*models.WebhookSecret, error) {
	var ws models.WebhookSecret
	err := r.db.GetContext(ctx, &ws,
		`SELECT id, repo_id, secret, tenant_id, created_at, updated_at
		   FROM webhook_secrets
		  WHERE repo_id = $1`,
		repoID,
	)
	if err != nil {
		return nil, err
	}
	return &ws, nil
}

// ==================== Webhook Event Logs ====================

// CreateWebhookEventLog inserts a webhook event log entry.
func (r *Repository) CreateWebhookEventLog(ctx context.Context, log *models.WebhookEventLog) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO webhook_event_logs
			(id, event_type, repo_type, repo_name, event_id, success, error, tenant_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		log.ID, log.EventType, log.RepoType, log.RepoName, log.EventID, log.Success, log.Error, log.TenantID,
	)
	return err
}

// ListWebhookEventLogs returns filtered, paginated webhook event logs.
func (r *Repository) ListWebhookEventLogs(ctx context.Context, tenantID, eventType, repoType string, limit int) ([]models.WebhookEventLog, error) {
	query := `SELECT id, event_type, repo_type, repo_name, event_id, success, error, tenant_id, created_at
	            FROM webhook_event_logs
	           WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if eventType != "" {
		query += ` AND event_type = $` + itoa(argIdx)
		args = append(args, eventType)
		argIdx++
	}
	if repoType != "" {
		query += ` AND repo_type = $` + itoa(argIdx)
		args = append(args, repoType)
		argIdx++
	}

	query += ` ORDER BY created_at DESC LIMIT $` + itoa(argIdx)
	args = append(args, limit)

	var items []models.WebhookEventLog
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ==================== Branch Policies ====================

// CreateBranchPolicy inserts a new branch protection policy.
func (r *Repository) CreateBranchPolicy(ctx context.Context, p *models.BranchPolicy) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO branch_policies
			(id, tenant_id, repo_id, branch_pattern, prevent_force_push, prevent_deletion,
			 merge_strategy, approval_rules, required_checks, require_code_owners,
			 linear_history, allow_admin_override)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		p.ID, p.TenantID, p.RepoID, p.BranchPattern, p.PreventForcePush, p.PreventDeletion,
		p.MergeStrategy, p.ApprovalRules, p.RequiredChecks, p.RequireCodeOwners,
		p.LinearHistory, p.AllowAdminOverride,
	)
	return err
}

// GetBranchPolicyByID fetches a branch policy by primary key.
func (r *Repository) GetBranchPolicyByID(ctx context.Context, id string) (*models.BranchPolicy, error) {
	var p models.BranchPolicy
	err := r.db.GetContext(ctx, &p,
		`SELECT id, tenant_id, repo_id, branch_pattern, prevent_force_push, prevent_deletion,
		        merge_strategy, approval_rules, required_checks, require_code_owners,
		        linear_history, allow_admin_override, created_at, updated_at
		   FROM branch_policies
		  WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ListBranchPoliciesByRepo returns all branch policies for a repository.
func (r *Repository) ListBranchPoliciesByRepo(ctx context.Context, tenantID, repoID string) ([]models.BranchPolicy, error) {
	var items []models.BranchPolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, repo_id, branch_pattern, prevent_force_push, prevent_deletion,
		        merge_strategy, approval_rules, required_checks, require_code_owners,
		        linear_history, allow_admin_override, created_at, updated_at
		   FROM branch_policies
		  WHERE tenant_id = $1 AND repo_id = $2
		  ORDER BY branch_pattern`,
		tenantID, repoID,
	)
	return items, err
}

// ListAllBranchPolicies returns all branch policies for a tenant.
func (r *Repository) ListAllBranchPolicies(ctx context.Context, tenantID string) ([]models.BranchPolicy, error) {
	var items []models.BranchPolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, repo_id, branch_pattern, prevent_force_push, prevent_deletion,
		        merge_strategy, approval_rules, required_checks, require_code_owners,
		        linear_history, allow_admin_override, created_at, updated_at
		   FROM branch_policies
		  WHERE tenant_id = $1
		  ORDER BY repo_id, branch_pattern`,
		tenantID,
	)
	return items, err
}

// UpdateBranchPolicy modifies an existing branch policy.
func (r *Repository) UpdateBranchPolicy(ctx context.Context, id string, req *models.UpdateBranchPolicyRequest, approvalRulesJSON, requiredChecksJSON models.JSONArray) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE branch_policies
		    SET prevent_force_push = COALESCE($2, prevent_force_push),
		        prevent_deletion = COALESCE($3, prevent_deletion),
		        merge_strategy = COALESCE(NULLIF($4, ''), merge_strategy),
		        approval_rules = COALESCE($5, approval_rules),
		        required_checks = COALESCE($6, required_checks),
		        require_code_owners = COALESCE($7, require_code_owners),
		        linear_history = COALESCE($8, linear_history),
		        allow_admin_override = COALESCE($9, allow_admin_override),
		        updated_at = NOW()
		  WHERE id = $1`,
		id, req.PreventForcePush, req.PreventDeletion, req.MergeStrategy,
		approvalRulesJSON, requiredChecksJSON,
		req.RequireCodeOwners, req.LinearHistory, req.AllowAdminOverride,
	)
	return err
}

// DeleteBranchPolicy removes a branch policy by ID.
func (r *Repository) DeleteBranchPolicy(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM branch_policies WHERE id = $1`,
		id,
	)
	return err
}

// ==================== Code Ownership ====================

// UpsertCodeOwnership inserts or updates the CODEOWNERS file for a repository.
func (r *Repository) UpsertCodeOwnership(ctx context.Context, co *models.CodeOwnership) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO code_ownership (id, tenant_id, repo_id, file_path, rules, raw_content, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW())
		 ON CONFLICT (repo_id) DO UPDATE SET
		    file_path = $4, rules = $5, raw_content = $6, updated_at = NOW()`,
		co.ID, co.TenantID, co.RepoID, co.FilePath, co.Rules, co.RawContent,
	)
	return err
}

// GetCodeOwnership fetches the CODEOWNERS record for a repository.
func (r *Repository) GetCodeOwnership(ctx context.Context, repoID string) (*models.CodeOwnership, error) {
	var co models.CodeOwnership
	err := r.db.GetContext(ctx, &co,
		`SELECT id, tenant_id, repo_id, file_path, rules, raw_content, created_at, updated_at
		   FROM code_ownership
		  WHERE repo_id = $1`,
		repoID,
	)
	if err != nil {
		return nil, err
	}
	return &co, nil
}

// DeleteCodeOwnership removes the CODEOWNERS record for a repository.
func (r *Repository) DeleteCodeOwnership(ctx context.Context, repoID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM code_ownership WHERE repo_id = $1`,
		repoID,
	)
	return err
}

// ==================== Commit Statuses ====================

// CreateCommitStatus inserts a new commit status record.
func (r *Repository) CreateCommitStatus(ctx context.Context, cs *models.CommitStatus) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO commit_statuses
			(id, tenant_id, repository_id, commit_sha, state, target_url, description, context)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		cs.ID, cs.TenantID, cs.RepositoryID, cs.CommitSHA, cs.State, cs.TargetURL, cs.Description, cs.Context,
	)
	return err
}

// ListCommitStatuses fetches all statuses for a given commit, optionally filtered by context.
func (r *Repository) ListCommitStatuses(ctx context.Context, tenantID, repoID, commitSHA, contextFilter string) ([]models.CommitStatus, error) {
	query := `SELECT id, tenant_id, repository_id, commit_sha, state, target_url, description, context, created_at, updated_at
	            FROM commit_statuses
	           WHERE tenant_id = $1 AND repository_id = $2 AND commit_sha = $3`
	args := []interface{}{tenantID, repoID, commitSHA}

	if contextFilter != "" {
		query += ` AND context = $4`
		args = append(args, contextFilter)
	}

	query += ` ORDER BY created_at ASC`

	var items []models.CommitStatus
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// UpdateCommitStatus modifies the state of an existing commit status.
func (r *Repository) UpdateCommitStatus(ctx context.Context, tenantID, repoID, commitSHA, contextName, state, description string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE commit_statuses
		    SET state = $5, description = $6, updated_at = NOW()
		  WHERE tenant_id = $1 AND repository_id = $2 AND commit_sha = $3 AND context = $4`,
		tenantID, repoID, commitSHA, contextName, state, description,
	)
	return err
}

// DeleteCommitStatus removes a specific commit status by context.
func (r *Repository) DeleteCommitStatus(ctx context.Context, tenantID, repoID, commitSHA, contextName string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM commit_statuses
		  WHERE tenant_id = $1 AND repository_id = $2 AND commit_sha = $3 AND context = $4`,
		tenantID, repoID, commitSHA, contextName,
	)
	return err
}

// BatchCreateCommitStatuses inserts multiple commit statuses in a single transaction.
func (r *Repository) BatchCreateCommitStatuses(ctx context.Context, statuses []models.CommitStatus) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO commit_statuses
			(id, tenant_id, repository_id, commit_sha, state, target_url, description, context)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 ON CONFLICT DO NOTHING`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, cs := range statuses {
		if _, err := stmt.ExecContext(ctx,
			cs.ID, cs.TenantID, cs.RepositoryID, cs.CommitSHA, cs.State, cs.TargetURL, cs.Description, cs.Context,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// ==================== Helpers ====================

// itoa converts an integer to its string representation for SQL parameter placeholders.
func itoa(n int) string {
	return strconv.Itoa(n)
}
