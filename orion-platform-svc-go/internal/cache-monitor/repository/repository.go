package repository

import (
	"context"

	"orion/platform-svc-go/internal/cache-monitor/models"
)

type Repository struct{}

func NewRepository() *Repository { return &Repository{} }

func (r *Repository) SaveMetrics(ctx context.Context, m *models.CacheMetrics) error { return nil }
func (r *Repository) GetMetrics(ctx context.Context, name string) (*models.CacheMetrics, error) { return nil, nil }
func (r *Repository) ListMetrics(ctx context.Context) ([]*models.CacheMetrics, error) { return nil, nil }
func (r *Repository) SaveConfig(ctx context.Context, cfg *models.CacheConfig) error { return nil }
func (r *Repository) GetConfig(ctx context.Context, name string) (*models.CacheConfig, error) { return nil, nil }
func (r *Repository) DeleteConfig(ctx context.Context, name string) error { return nil }
