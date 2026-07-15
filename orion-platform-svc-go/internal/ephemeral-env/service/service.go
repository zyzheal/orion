package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/ephemeral-env/models"
	"orion/platform-svc-go/internal/ephemeral-env/repository"
)

var ErrNotFound = errors.New("ephemeral env not found")

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateEnv(ctx context.Context, tenantID string, req models.CreateEphemeralEnvRequest) (*models.EphemeralEnv, error) {
	if req.TTLSeconds <= 0 {
		req.TTLSeconds = 3600
	}
	env := &models.EphemeralEnv{
		TenantID:        tenantID,
		EnvironmentName: req.EnvironmentName,
		TTLSeconds:      req.TTLSeconds,
		Status:          "active",
	}
	if err := s.repo.CreateEnv(ctx, env); err != nil {
		return nil, err
	}
	return env, nil
}

func (s *Service) GetEnv(ctx context.Context, tenantID, id string) (*models.EphemeralEnv, error) {
	return s.repo.GetEnv(ctx, tenantID, id)
}

func (s *Service) ListEnvs(ctx context.Context, tenantID string, limit, offset int) (*models.ListEnvsResponse, error) {
	envs, err := s.repo.ListEnvs(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	_, err = s.repo.CountEnvs(ctx, tenantID)
	if envs == nil {
		envs = []models.EphemeralEnv{}
	}
	return &models.ListEnvsResponse{Envs: envs}, nil
}

func (s *Service) ExtendTTL(ctx context.Context, tenantID, id string, req models.ExtendTTLRequest) (*models.EphemeralEnv, error) {
	if req.TTLSeconds <= 0 {
		req.TTLSeconds = 3600
	}
	updates := map[string]interface{}{
		"ttl_seconds": req.TTLSeconds,
	}
	if err := s.repo.UpdateEnv(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetEnv(ctx, tenantID, id)
}

func (s *Service) DeleteEnv(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteEnv(ctx, tenantID, id)
}

func (s *Service) GetLogs(ctx context.Context, tenantID, envID string, limit int) ([]models.EnvLog, error) {
	return s.repo.GetEnvLogs(ctx, tenantID, envID, limit)
}

func (s *Service) DestroyEnv(ctx context.Context, tenantID, id string) (*models.EphemeralEnv, error) {
	updates := map[string]interface{}{
		"status": "destroyed",
	}
	if err := s.repo.UpdateEnv(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	_ = s.repo.CreateEnvLog(ctx, &models.EnvLog{
		EnvID:     id,
		Level:     "info",
		Message:   "Environment destroyed",
		CreatedAt: time.Now().UTC(),
	})
	return s.repo.GetEnv(ctx, tenantID, id)
}
