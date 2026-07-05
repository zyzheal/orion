package service

import (
	"time"

	"orion/auth-svc/internal/repository"
	"orion/go-common/pkg/database"
)

// Services holds all service instances.
type Services struct {
	Auth     *AuthService
	JWT      *JWTService
	Password *PasswordService
}

func New(db *database.DB, jwtSecret string, jwtExpiry, refreshExpiry time.Duration) *Services {
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	blacklistRepo := repository.NewBlacklistRepository(db)

	return &Services{
		Auth:     NewAuthService(userRepo, sessionRepo, blacklistRepo),
		JWT:      NewJWTService(jwtSecret, jwtExpiry, refreshExpiry),
		Password: NewPasswordService(),
	}
}
