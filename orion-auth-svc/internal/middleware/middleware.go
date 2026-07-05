package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

// Auth validates JWT tokens and checks Redis token blacklist.
// This is auth-svc-specific middleware (the auth service itself validates tokens).
func Auth(rdb *redis.Client, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "missing authorization"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		blocked, err := rdb.Exists(c.Request.Context(), "token:blacklist:"+tokenString).Result()
		if err == nil && blocked > 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "token revoked"})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "invalid or expired token"})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_id", claims["sub"])
			c.Set("tenant_id", claims["tenant_id"])
			c.Set("role", claims["role"])
		}
		c.Next()
	}
}

// RequireRole checks that the authenticated user has the required role.
func RequireRole(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists || role != requiredRole {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 403, "message": "insufficient permissions"})
			return
		}
		c.Next()
	}
}
