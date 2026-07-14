package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/auth-enhanced/models"
	"orion/platform-svc-go/internal/auth-enhanced/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateKey(ctx context.Context, tenantID string, req *models.CreateAuthKeyRequest) (*models.AuthKey, error) {
	algorithm := "HS256"
	if req.Algorithm == "RS256" {
		algorithm = "RS256"
	}
	key := &models.AuthKey{
		TenantID:  tenantID,
		KeyID:     "key-" + time.Now().UTC().Format("20060102-150405"),
		Algorithm: algorithm,
		Status:    "active",
	}
	if err := s.repo.CreateKey(ctx, key); err != nil {
		return nil, err
	}
	return key, nil
}

func (s *Service) GetKey(ctx context.Context, tenantID, id string) (*models.AuthKey, error) {
	return s.repo.GetKeyByID(ctx, tenantID, id)
}

func (s *Service) ListKeys(ctx context.Context, tenantID string, status *string) ([]models.AuthKey, error) {
	return s.repo.ListKeys(ctx, tenantID, status)
}

func (s *Service) DeactivateKey(ctx context.Context, tenantID, id string) error {
	return s.repo.UpdateKeyStatus(ctx, tenantID, id, "deprecated")
}

func (s *Service) DeleteKey(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteKey(ctx, tenantID, id)
}

func (s *Service) BlacklistToken(ctx context.Context, tenantID string, req *models.CreateBlacklistRequest, expiresAt time.Time) (*models.AuthTokenBlacklist, error) {
	if req.TokenID == "" {
		return nil, errors.New("tokenId is required")
	}
	bl := &models.AuthTokenBlacklist{
		TenantID:  tenantID,
		TokenID:   req.TokenID,
		ExpiresAt: expiresAt,
		Reason:    req.Reason,
	}
	if err := s.repo.CreateBlacklist(ctx, bl); err != nil {
		return nil, err
	}
	return bl, nil
}

func (s *Service) CheckToken(ctx context.Context, tenantID, tokenID string) (bool, error) {
	return s.repo.IsBlacklisted(ctx, tenantID, tokenID)
}

func (s *Service) ListBlacklist(ctx context.Context, tenantID string) ([]models.AuthTokenBlacklist, error) {
	return s.repo.ListBlacklist(ctx, tenantID)
}

func (s *Service) DeleteBlacklist(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteBlacklist(ctx, tenantID, id)
}
