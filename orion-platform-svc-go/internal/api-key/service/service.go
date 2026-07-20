package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/api-key/models"

	"github.com/google/uuid"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, key *models.APIKey) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.APIKey, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.APIKey, error)
}

// Service coordinates business logic for API key management.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service instance.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// sentinel.NotFound is returned when an API key cannot be located or the caller
// lacks permission to view it.

// CreateAPIKeyResponse includes the plaintext key returned once at creation.
type CreateAPIKeyResponse struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	PlaintextKey string     `json:"plaintext_key"` // plaintext, returned once only
	Scope        string     `json:"scope"`
	ExpiresAt    *time.Time `json:"expires_at"`
	CreatedAt    time.Time  `json:"created_at"`
}

// Create generates a new API key, hashes it, persists, and returns plaintext once.
func (s *Service) Create(ctx context.Context, tenantID, userID string, req *models.CreateKeyRequest) (*CreateAPIKeyResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}

	// Generate plaintext key
	plaintext := "ak_" + uuid.New().String()

	// Hash the key for storage
	hash := sha256.Sum256([]byte(plaintext))
	keyHash := hex.EncodeToString(hash[:])

	now := time.Now()
	key := &models.APIKey{
		ID:        uuid.New().String(),
		Name:      req.Name,
		KeyHash:   keyHash,
		Scope:     req.Scope,
		ExpiresAt: req.ExpiresAt,
		TenantID:  tenantID,
		UserID:    userID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.Create(ctx, key); err != nil {
		return nil, fmt.Errorf("failed to create API key: %w", err)
	}

	return &CreateAPIKeyResponse{
		ID:           key.ID,
		Name:         key.Name,
		PlaintextKey: plaintext,
		Scope:        key.Scope,
		ExpiresAt:    key.ExpiresAt,
		CreatedAt:    key.CreatedAt,
	}, nil
}

// List retrieves API keys for the given user (tenant-scoped).
func (s *Service) List(ctx context.Context, tenantID, userID string) ([]models.APIKey, error) {
	filter := &models.ListFilter{UserID: &userID}
	keys, err := s.repo.List(ctx, tenantID, filter, 0, 100)
	if err != nil {
		return nil, fmt.Errorf("failed to list API keys: %w", err)
	}
	return keys, nil
}

// Delete removes an API key by id (tenant-scoped).
func (s *Service) Delete(ctx context.Context, tenantID, userID, id string) error {
	// Verify ownership
	key, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if key.UserID != userID {
		return sentinel.NotFound
	}
	return s.repo.Delete(ctx, tenantID, id)
}
