package middleware

import (
	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"

	"github.com/redis/go-redis/v9"
)

// Auth validates JWT tokens using go-common auth middleware.
// Supports Redis token blacklist, roles array extraction, and user_status check.
func Auth(rdb *redis.Client, jwtSecret string) gin.HandlerFunc {
	return auth.Auth(auth.AuthConfig{
		JWTSecret:   jwtSecret,
		RedisClient: rdb,
	})
}

// RequireRole checks that the authenticated user has the required role.
func RequireRole(requiredRole string) gin.HandlerFunc {
	return auth.RequireRole(requiredRole)
}
