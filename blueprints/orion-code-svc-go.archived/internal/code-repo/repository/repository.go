package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/code-svc-go/internal/code-repo/models"
)

// CodeRepoRepository interface
type CodeRepoRepository interface {
	List(ctx context.Context, tenantID string) ([]models.CodeRepo, error)
	Create(ctx context.Context, name, url, provider, token, tenantID string) (*models.CodeRepo, error)
	Get(ctx context.Context, id string) (*models.CodeRepo, error)
	Update(ctx context.Context, id string, name, url, provider, token string) error
	Delete(ctx context.Context, id string) error
	ListBranches(ctx context.Context, repoID string) ([]models.Branch, error)
	ListCommits(ctx context.Context, repoID string, limit int) ([]models.Commit, error)
}

type codeRepoRepositoryImpl struct {
	DB *sql.DB
}

func NewCodeRepoRepository(db *sql.DB) CodeRepoRepository {
	return &codeRepoRepositoryImpl{DB: db}
}

func (r *codeRepoRepositoryImpl) List(ctx context.Context, tenantID string) ([]models.CodeRepo, error) {
	query := `SELECT id, name, url, provider, tenant_id, created_at, updated_at FROM code_repos`
	args := []interface{}{}
	argIdx := 1
	if tenantID != "" {
	query += fmt.Sprintf(" WHERE tenant_id = $%d", argIdx)
		args = append(args, tenantID)
		argIdx++
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list code repos: %w", err)
	}
	defer rows.Close()

	var repos []models.CodeRepo
	for rows.Next() {
		var c models.CodeRepo
		if err := rows.Scan(&c.ID, &c.Name, &c.URL, &c.Provider, &c.TenantID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan code repo: %w", err)
		}
		repos = append(repos, c)
	}
	return repos, nil
}

func (r *codeRepoRepositoryImpl) Create(ctx context.Context, name, url, provider, token, tenantID string) (*models.CodeRepo, error) {
	now := time.Now()
	var id int64
	err := r.DB.QueryRowContext(ctx, `
		INSERT INTO code_repos (name, url, provider, token, tenant_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`, name, url, provider, token, tenantID, now, now).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("create code repo: %w", err)
	}
	return &models.CodeRepo{
		ID:        id,
		Name:      name,
		URL:       url,
		Provider:  provider,
		TenantID:  tenantID,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (r *codeRepoRepositoryImpl) Get(ctx context.Context, id string) (*models.CodeRepo, error) {
	var c models.CodeRepo
	err := r.DB.QueryRowContext(ctx, `
		SELECT id, name, url, provider, tenant_id, created_at, updated_at
		FROM code_repos WHERE id = $1`, id).Scan(
		&c.ID, &c.Name, &c.URL, &c.Provider, &c.TenantID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("code repo not found: %s", id)
		}
		return nil, fmt.Errorf("get code repo: %w", err)
	}
	return &c, nil
}

func (r *codeRepoRepositoryImpl) Update(ctx context.Context, id string, name, url, provider, token string) error {
	now := time.Now()
	_, err := r.DB.ExecContext(ctx, `
		UPDATE code_repos SET name=$1, url=$2, provider=$3, token=$4, updated_at=$5
		WHERE id=$6`, name, url, provider, token, now, id)
	if err != nil {
		return fmt.Errorf("update code repo: %w", err)
	}
	return nil
}

func (r *codeRepoRepositoryImpl) Delete(ctx context.Context, id string) error {
	result, err := r.DB.ExecContext(ctx, `DELETE FROM code_repos WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete code repo: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("code repo not found: %s", id)
	}
	return nil
}

func (r *codeRepoRepositoryImpl) ListBranches(ctx context.Context, repoID string) ([]models.Branch, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT id, repo_id, name, is_default, created_at
		FROM code_repo_branches
		WHERE repo_id = $1
		ORDER BY name`, repoID)
	if err != nil {
		return nil, fmt.Errorf("list branches: %w", err)
	}
	defer rows.Close()

	var branches []models.Branch
	for rows.Next() {
		var b models.Branch
		if err := rows.Scan(&b.ID, &b.RepoID, &b.Name, &b.IsDefault, &b.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan branch: %w", err)
		}
		branches = append(branches, b)
	}
	return branches, nil
}

func (r *codeRepoRepositoryImpl) ListCommits(ctx context.Context, repoID string, limit int) ([]models.Commit, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.DB.QueryContext(ctx, `
		SELECT sha, message, author, branch, repo_id, authored_at
		FROM code_repo_commits
		WHERE repo_id = $1
		ORDER BY authored_at DESC
		LIMIT $2`, repoID, limit)
	if err != nil {
		return nil, fmt.Errorf("list commits: %w", err)
	}
	defer rows.Close()

	var commits []models.Commit
	for rows.Next() {
		var c models.Commit
		if err := rows.Scan(&c.SHA, &c.Message, &c.Author, &c.Branch, &c.RepoID, &c.AuthoredAt); err != nil {
			return nil, fmt.Errorf("scan commit: %w", err)
		}
		commits = append(commits, c)
	}
	return commits, nil
}

// Ensure interface compliance
var _ CodeRepoRepository = (*codeRepoRepositoryImpl)(nil)
