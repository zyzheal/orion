package repository

import (
	"context"

	"orion/platform-svc-go/internal/code-embedding/models"
)

type Repository struct{}

func NewRepository() *Repository { return &Repository{} }

func (r *Repository) Save(ctx context.Context, e *models.CodeEmbedding) error { return nil }
func (r *Repository) Get(ctx context.Context, id string) (*models.CodeEmbedding, error) { return nil, nil }
func (r *Repository) ListByRepo(ctx context.Context, tenantID, repoID string, offset, limit int) ([]*models.CodeEmbedding, error) { return nil, nil }
func (r *Repository) Delete(ctx context.Context, id string) error { return nil }
func (r *Repository) SearchSimilar(ctx context.Context, vector []float32, topK int) ([]*models.CodeEmbedding, error) { return nil, nil }
