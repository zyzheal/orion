package service

import (
	"context"
	"errors"
	"time"

	"orion/auth-svc/internal/models"
	"orion/auth-svc/internal/repository"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAccountDisabled    = errors.New("account is disabled")
	ErrTokenRevoked       = errors.New("token has been revoked")
	ErrEmailExists        = errors.New("email already registered")
	ErrUserNotFound       = errors.New("user not found")
)

// AuthService handles authentication business logic.
type AuthService struct {
	users      *repository.UserRepository
	sessions   *repository.SessionRepository
	blacklist  *repository.BlacklistRepository
}

func NewAuthService(users *repository.UserRepository, sessions *repository.SessionRepository, blacklist *repository.BlacklistRepository) *AuthService {
	return &AuthService{
		users:     users,
		sessions:  sessions,
		blacklist: blacklist,
	}
}

// Login authenticates a user with email/username and password, scoped to a tenant.
func (s *AuthService) Login(ctx context.Context, tenantID, emailOrUsername, password string) (*models.User, error) {
	user, err := s.users.GetByEmailOrUsername(ctx, tenantID, emailOrUsername)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := ComparePassword(user.PasswordHash, password); err != nil {
		return nil, ErrInvalidCredentials
	}

	if user.Status != "active" {
		return nil, ErrAccountDisabled
	}

	return user, nil
}

// Register creates a new user account.
func (s *AuthService) Register(ctx context.Context, req models.RegisterRequest, passwordService *PasswordService) (*models.User, error) {
	exists, err := s.users.EmailExists(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrEmailExists
	}

	hashedPassword, err := passwordService.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		TenantID:     req.TenantID,
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hashedPassword,
		Role:         "user",
		Status:       "active",
	}

	if user.TenantID == "" {
		user.TenantID = "00000000-0000-0000-0000-000000000000"
	}

	if err := s.users.Create(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// Logout invalidates a user session and blacklists the token.
func (s *AuthService) Logout(ctx context.Context, userID, tokenJTI string, expiresAt time.Time) error {
	// Add token to blacklist
	entry := &models.TokenBlacklist{
		TokenJTI:  tokenJTI,
		TokenType: "access",
		ExpiresAt: expiresAt,
	}
	if err := s.blacklist.Create(ctx, entry); err != nil {
		return err
	}

	// Delete all user sessions
	return s.sessions.DeleteByUserID(ctx, userID)
}

// IsTokenBlacklisted checks if a token has been revoked.
func (s *AuthService) IsTokenBlacklisted(ctx context.Context, jti string) (bool, error) {
	return s.blacklist.IsBlacklisted(ctx, jti)
}

// ChangePassword updates a user's password after verifying the old one.
func (s *AuthService) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string, passwordService *PasswordService) error {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return ErrUserNotFound
	}

	if err := ComparePassword(user.PasswordHash, oldPassword); err != nil {
		return ErrInvalidCredentials
	}

	hashedPassword, err := passwordService.HashPassword(newPassword)
	if err != nil {
		return err
	}

	return s.users.UpdatePassword(ctx, userID, hashedPassword)
}

// GetSessions returns active sessions for a user.
func (s *AuthService) GetSessions(ctx context.Context, userID string) ([]models.Session, error) {
	return s.sessions.GetByUserID(ctx, userID)
}

// RevokeSession deletes a specific session.
func (s *AuthService) RevokeSession(ctx context.Context, sessionID string) error {
	return s.sessions.Delete(ctx, sessionID)
}

// ComparePassword is a convenience wrapper.
func ComparePassword(hashedPassword, password string) error {
	_, err := CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err
}
