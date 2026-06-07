package service

import (
	"context"

	"orion/chatops-svc-go/internal/models"
	"orion/chatops-svc-go/internal/repository"

	"github.com/google/uuid"
)

// ConfigService manages user question and command configurations.
type ConfigService struct {
	repo *repository.Repository
}

func NewConfigService(repo *repository.Repository) *ConfigService {
	return &ConfigService{repo: repo}
}

// Question Config

func (s *ConfigService) GetQuestionConfigs(ctx context.Context, tenantID, userID string) ([]models.ChatOpsQuestionConfig, error) {
	return s.repo.GetQuestionConfigs(ctx, tenantID, userID)
}

func (s *ConfigService) UpsertQuestionConfig(ctx context.Context, tenantID, userID string, input models.QuestionConfigInput) (*models.ChatOpsQuestionConfig, error) {
	cfg := &models.ChatOpsQuestionConfig{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		UserID:      userID,
		Key:         input.Key,
		Icon:        input.Icon,
		Title:       input.Title,
		Description: input.Description,
		Question:    input.Question,
		Enabled:     true,
	}
	if input.Enabled != nil {
		cfg.Enabled = *input.Enabled
	}
	if err := s.repo.UpsertQuestionConfig(ctx, tenantID, userID, cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (s *ConfigService) DeleteQuestionConfig(ctx context.Context, tenantID, userID, key string) error {
	return s.repo.DeleteQuestionConfig(ctx, tenantID, userID, key)
}

// Command Config

func (s *ConfigService) GetCommandConfigs(ctx context.Context, tenantID, userID string) ([]models.ChatOpsCommandConfig, error) {
	return s.repo.GetCommandConfigs(ctx, tenantID, userID)
}

func (s *ConfigService) UpsertCommandConfig(ctx context.Context, tenantID, userID string, input models.CommandConfigInput) (*models.ChatOpsCommandConfig, error) {
	cfg := &models.ChatOpsCommandConfig{
		ID:      uuid.New().String(),
		TenantID: tenantID,
		UserID:  userID,
		Key:     input.Key,
		Label:   input.Label,
		Command: input.Command,
		Enabled: true,
	}
	if input.Enabled != nil {
		cfg.Enabled = *input.Enabled
	}
	if err := s.repo.UpsertCommandConfig(ctx, tenantID, userID, cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (s *ConfigService) DeleteCommandConfig(ctx context.Context, tenantID, userID, key string) error {
	return s.repo.DeleteCommandConfig(ctx, tenantID, userID, key)
}
