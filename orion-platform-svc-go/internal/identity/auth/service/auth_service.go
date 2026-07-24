package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/identity/auth/model"
	"orion/platform-svc-go/internal/identity/auth/repository"
	"go.uber.org/zap"
)

type AuthService struct {
	repo *repository.AuthRepository
	log  *zap.Logger
}

func NewAuthService(repo *repository.AuthRepository, log *zap.Logger) *AuthService {
	return &AuthService{repo: repo, log: log}
}

func (s *AuthService) GetUser(ctx context.Context, id string) (*model.User, error) {
	return s.repo.FindUserByID(ctx, id)
}

func (s *AuthService) GetUserByUsername(ctx context.Context, username string) (*model.User, error) {
	return s.repo.FindUserByUsername(ctx, "", username)
}

func (s *AuthService) CreateUser(ctx context.Context, u *model.User) error {
	u.CreatedAt = time.Now()
	u.UpdatedAt = time.Now()
	return s.repo.CreateUser(ctx, u)
}

func (s *AuthService) UpdateUser(ctx context.Context, u *model.User) error {
	u.UpdatedAt = time.Now()
	return s.repo.UpdateUser(ctx, u)
}

func (s *AuthService) RecordLoginAttempt(ctx context.Context, a *model.LoginAttempt) error {
	a.CreatedAt = time.Now()
	return s.repo.RecordLoginAttempt(ctx, a)
}

func (s *AuthService) GetPermissions(ctx context.Context, tenantID string) ([]model.Permission, error) {
	return s.repo.ListPermissions(ctx, tenantID)
}

func (s *AuthService) Audit(ctx context.Context, log *model.AuditLog) error {
	log.CreatedAt = time.Now()
	return s.repo.InsertAuditLog(ctx, log)
}

func (s *AuthService) SaveRefreshToken(ctx context.Context, t *model.RefreshToken) error {
	return s.repo.SaveRefreshToken(ctx, t)
}

func (s *AuthService) FindValidRefreshToken(ctx context.Context, userID, tokenHash string) (*model.RefreshToken, error) {
	return s.repo.FindValidRefreshToken(ctx, userID, tokenHash)
}

func (s *AuthService) RevokeRefreshToken(ctx context.Context, id string) error {
	return s.repo.RevokeRefreshToken(ctx, id)
}

func (s *AuthService) FindValidRefreshTokenByHash(ctx context.Context, tokenHash string) (*model.RefreshToken, error) {
	return s.repo.FindRefreshTokenByHash(ctx, tokenHash)
}

var ErrInvalidCredentials = errors.New("invalid credentials")
