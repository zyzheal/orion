package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/code-embedding/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Save(ctx context.Context, e *models.CodeEmbedding) error {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	e.CreatedAt = time.Now().UTC()
	e.UpdatedAt = time.Now().UTC()
	vecJSON, err := json.Marshal(e.Vector)
	if err != nil {
		return err
	}
	_, err = r.db.NamedExecContext(ctx,
		`INSERT INTO code_embeddings (id, tenant_id, repo_id, file_path, language, content, vector, model, created_at, updated_at)
		 VALUES (:id, :tenant_id, :repo_id, :file_path, :language, :content, :vector, :model, :created_at, :updated_at)`,
		map[string]interface{}{
			"id":         e.ID,
			"tenant_id":  e.TenantID,
			"repo_id":    e.RepoID,
			"file_path":  e.FilePath,
			"language":   e.Language,
			"content":    e.Content,
			"vector":     string(vecJSON),
			"model":      e.Model,
			"created_at": e.CreatedAt,
			"updated_at": e.UpdatedAt,
		})
	return err
}

func (r *Repository) Get(ctx context.Context, id string) (*models.CodeEmbedding, error) {
	var e models.CodeEmbedding
	err := r.db.GetContext(ctx, &e,
		`SELECT id, tenant_id, repo_id, file_path, language, content, vector, model, created_at, updated_at
		 FROM code_embeddings WHERE id=$1`, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *Repository) ListByRepo(ctx context.Context, tenantID, repoID string, offset, limit int) ([]*models.CodeEmbedding, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.CodeEmbedding
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, repo_id, file_path, language, content, vector, model, created_at, updated_at
		 FROM code_embeddings WHERE tenant_id=$1 AND repo_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, repoID, limit, offset)
	if err != nil {
		return nil, err
	}
	result := make([]*models.CodeEmbedding, 0, len(items))
	for i := range items {
		result = append(result, &items[i])
	}
	return result, nil
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM code_embeddings WHERE id=$1`, id)
	return err
}

func (r *Repository) SearchSimilar(ctx context.Context, tenantID, repoID string, vector []float64, topK int, language string) ([]*models.CodeEmbedding, error) {
	if topK <= 0 {
		topK = 10
	}
	limit := topK * 5
	var items []models.CodeEmbedding
	var err error
	if repoID != "" && language != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, repo_id, file_path, language, content, vector, model, created_at, updated_at
			 FROM code_embeddings WHERE tenant_id=$1 AND repo_id=$2 AND language=$3 ORDER BY created_at DESC LIMIT $4`,
			tenantID, repoID, language, limit)
	} else if repoID != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, repo_id, file_path, language, content, vector, model, created_at, updated_at
			 FROM code_embeddings WHERE tenant_id=$1 AND repo_id=$2 ORDER BY created_at DESC LIMIT $3`,
			tenantID, repoID, limit)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, repo_id, file_path, language, content, vector, model, created_at, updated_at
			 FROM code_embeddings WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2`,
			tenantID, limit)
	}
	if err != nil {
		return nil, err
	}
	result := make([]*models.CodeEmbedding, 0, len(items))
	for i := range items {
		result = append(result, &items[i])
	}
	return result, nil
}

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.EmbedStats, error) {
	var s models.EmbedStats
	r.db.GetContext(ctx, &s.TotalEmbeddings,
		`SELECT COUNT(*) FROM code_embeddings WHERE tenant_id=$1`, tenantID)
	var repos int
	r.db.GetContext(ctx, &repos,
		`SELECT COUNT(DISTINCT repo_id) FROM code_embeddings WHERE tenant_id=$1`, tenantID)
	s.TotalRepos = repos
	return &s, nil
}

func (r *Repository) CountByRepo(ctx context.Context, tenantID, repoID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM code_embeddings WHERE tenant_id=$1 AND repo_id=$2`, tenantID, repoID)
	return count, err
}
