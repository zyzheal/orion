package middleware

import (
	"context"

	"github.com/orion-platform/orion-knowledge/domain"
)

type APITokenRepository interface {
	GetByTokenWithCache(ctx context.Context, token string) (*domain.APIToken, error)
}
