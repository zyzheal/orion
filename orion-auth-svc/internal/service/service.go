package service

import (
	"time"

	"orion/auth-svc/internal/repository"

	"github.com/jmoiron/sqlx"
)

// Services holds all service instances.
type Services struct {
	Auth     *AuthService
	JWT      *JWTService
	Password *PasswordService
}

func New(db *sqlx.DB, jwtSecret string, jwtExpiry, refreshExpiry time.Duration) *Services {
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	blacklistRepo := repository.NewBlacklistRepository(db)

	return &Services{
		Auth:     NewAuthService(userRepo, sessionRepo, blacklistRepo),
		JWT:      NewJWTService(jwtSecret, jwtExpiry, refreshExpiry),
		Password: NewPasswordService(),
	}
}
