package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"orion/go-common/pkg/auth"
)

// Auth validates JWT tokens using go-common auth middleware.
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
