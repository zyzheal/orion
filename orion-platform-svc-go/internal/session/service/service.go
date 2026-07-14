package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/session/models"
	"orion/platform-svc-go/internal/session/repository"

	"github.com/google/uuid"
)

var (
	ErrSessionNotFound = errors.New("session not found")
	ErrSessionExpired  = errors.New("session has expired")
	ErrInvalidToken    = errors.New("invalid session token")
)

// Service implements the session management business logic.
type Service struct {
	repo    *repository.Repository
	timeout time.Duration
}

// NewService creates a new Service instance.
func NewService(repo *repository.Repository, timeout time.Duration) *Service {
	return &Service{repo: repo, timeout: timeout}
}

// Create creates a new session for a user.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateSessionRequest) (*models.Session, error) {
	now := time.Now()
	session := &models.Session{
		ID:           uuid.New().String(),
		UserID:       req.UserID,
		Token:        req.Token,
		DeviceInfo:   req.DeviceInfo,
		IP:           req.IP,
		LastActiveAt: now,
		ExpiresAt:    now.Add(s.timeout),
		TenantID:     tenantID,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.Create(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}
	return session, nil
}

// GetByID retrieves a session by id.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Session, error) {
	session, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrSessionNotFound
	}
	return session, nil
}

// List retrieves sessions for a user with pagination.
func (s *Service) List(ctx context.Context, tenantID, userID string, offset, limit int) ([]models.Session, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.List(ctx, tenantID, &userID, offset, limit)
}

// Verify validates a session token and returns the session details if valid.
func (s *Service) Verify(ctx context.Context, tenantID, token string) (*models.VerifySessionResponse, error) {
	session, err := s.repo.GetByToken(ctx, tenantID, token)
	if err != nil {
		return nil, ErrInvalidToken
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, ErrSessionExpired
	}

	if err := s.repo.UpdateLastActive(ctx, session.ID, session.TenantID, time.Now()); err != nil {
		return nil, fmt.Errorf("failed to update session last active: %w", err)
	}

	return &models.VerifySessionResponse{
		Valid:      true,
		SessionID:  session.ID,
		UserID:     session.UserID,
		DeviceInfo: session.DeviceInfo,
		IP:         session.IP,
		ExpiresAt:  session.ExpiresAt,
	}, nil
}

// Logout removes a specific session.
func (s *Service) Logout(ctx context.Context, tenantID, sessionID string) error {
	return s.repo.Delete(ctx, tenantID, sessionID)
}

// LogoutAll removes all sessions for the current user within the tenant.
func (s *Service) LogoutAll(ctx context.Context, tenantID, userID string) (int64, error) {
	return s.repo.DeleteByUserID(ctx, tenantID, userID)
}

// CleanupExpired removes all expired sessions for a tenant.
func (s *Service) CleanupExpired(ctx context.Context, tenantID string) (int64, error) {
	return s.repo.DeleteExpired(ctx, tenantID, time.Now())
}
