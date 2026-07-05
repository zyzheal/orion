package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"orion/go-common/pkg/auth"
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

// TenantID extracts tenant ID from header or JWT claims, defaulting to "default".
func TenantID() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			if tid, exists := c.Get("tenant_id"); exists {
				tenantID = tid.(string)
			}
		}
		if tenantID == "" {
			tenantID = "default"
		}
		c.Set("tenant_id", tenantID)
		c.Next()
	}
}
