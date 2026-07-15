package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/sso/models"
	"orion/platform-svc-go/internal/sso/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ListProviders returns all SSO providers for a tenant.
func (s *Service) ListProviders(ctx context.Context, tenantID string, q models.ListProvidersQuery) ([]models.SSOProvider, int, error) {
	items, err := s.repo.ListProviders(ctx, tenantID, q)
	if err != nil {
		return nil, 0, err
	}
	count, err := s.repo.CountProviders(ctx, tenantID, q)
	if err != nil {
		return items, 0, err
	}
	if items == nil {
		items = []models.SSOProvider{}
	}
	return items, count, nil
}

// GetProvider returns a single SSO provider.
func (s *Service) GetProvider(ctx context.Context, tenantID, id string) (*models.SSOProvider, error) {
	return s.repo.GetProvider(ctx, tenantID, id)
}

// CreateProvider creates a new SSO provider.
func (s *Service) CreateProvider(ctx context.Context, tenantID string, provider *models.SSOProvider) (*models.SSOProvider, error) {
	provider.TenantID = tenantID
	if err := s.repo.CreateProvider(ctx, provider); err != nil {
		return nil, err
	}
	return provider, nil
}

// UpdateProvider updates fields on an SSO provider.
func (s *Service) UpdateProvider(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return s.repo.UpdateProvider(ctx, tenantID, id, updates)
}

// InitiateLogin starts a new SSO login flow and returns the session.
func (s *Service) InitiateLogin(ctx context.Context, tenantID string, req *models.SSOLoginRequest) (*models.SSOSession, error) {
	sess := &models.SSOSession{
		TenantID:    tenantID,
		ProviderID:  req.ProviderID,
		RedirectURL: req.RedirectURL,
	}
	if err := s.repo.CreateSession(ctx, sess); err != nil {
		return nil, err
	}
	return sess, nil
}

// HandleCallback verifies a callback state and completes the session.
func (s *Service) HandleCallback(ctx context.Context, tenantID string, state string, userID string) (*models.SSOProvider, error) {
	sess, err := s.repo.GetSessionByState(ctx, tenantID, state)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if sess.ExpiresAt.Before(now) {
		return nil, repository.ErrNotFound
	}
	updates := map[string]interface{}{
		"user_id": userID,
		"status":  "completed",
	}
	if err := s.repo.UpdateSession(ctx, tenantID, sess.ID, updates); err != nil {
		return nil, err
	}
	return s.repo.GetProvider(ctx, tenantID, sess.ProviderID)
}
