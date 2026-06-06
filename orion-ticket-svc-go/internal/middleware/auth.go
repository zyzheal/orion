package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"orion-ticket-svc-go/internal/config"
)

type AuthMiddleware struct {
	cfg config.JWTConfig
}

func NewAuthMiddleware(cfg *config.Config) *AuthMiddleware {
	return &AuthMiddleware{cfg: cfg.JWT}
}

func (m *AuthMiddleware) Handle() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization"})
			return
		}

		tokenStr := strings.TrimPrefix(auth, "Bearer ")
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
			// Validate signing algorithm to prevent algorithm confusion attacks
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(m.cfg.Secret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}

		if sub, ok := claims["sub"].(string); ok {
			c.Set("user_id", sub)
		}
		if tid, ok := claims["tenant_id"].(string); ok {
			c.Set("tenant_id", tid)
		}

		c.Next()
	}
}

// TenantMiddleware extracts tenant_id from context or header
func TenantMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tid := c.GetString("tenant_id")
		if tid == "" {
			tid = c.GetHeader("X-Tenant-ID")
		}
		if tid == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing tenant_id"})
			return
		}
		c.Set("tenant_id", tid)
		c.Next()
	}
}
