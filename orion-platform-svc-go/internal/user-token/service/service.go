package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"math/rand"
	"time"

	"orion/platform-svc-go/internal/user-token/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID, userID string, name string, expiresAt *time.Time) (*models.Token, error)
	Delete(ctx context.Context, tenantID, id string) error
	ListByUserID(ctx context.Context, tenantID, userID string) ([]models.Token, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// GetTokens returns all tokens for a user.
func (s *Service) GetTokens(ctx context.Context, tenantID, userID string) ([]models.Token, error) {
	return s.repo.ListByUserID(ctx, tenantID, userID)
}

// CreateToken creates a new API token for a user.
func (s *Service) CreateToken(ctx context.Context, tenantID string, req models.CreateTokenRequest) (models.CreateTokenResponse, error) {
	var expiresAt *time.Time
	if req.ExpiresInDays != nil && *req.ExpiresInDays > 0 {
		t := time.Now().UTC().Add(time.Duration(*req.ExpiresInDays) * 24 * time.Hour)
		expiresAt = &t
	}
	_, err := s.repo.Create(ctx, tenantID, req.UserID, req.Name, expiresAt)
	if err != nil {
		return models.CreateTokenResponse{}, err
	}
	// Generate raw token (returned only once)
	rawToken := generateRawToken()
	return models.CreateTokenResponse{Token: rawToken}, nil
}

// DeleteToken deletes a token.
func (s *Service) DeleteToken(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func generateRawToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return "tok_" + formatBytes(b)
}

func formatBytes(b []byte) string {
	var s string
	for _, c := range b {
		s += formatByte(c)
	}
	return s
}

func formatByte(b byte) string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	return string(chars[int(b)%len(chars)])
}
