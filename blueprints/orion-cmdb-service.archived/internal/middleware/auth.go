package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AuthContext holds authenticated user information in gin context
const (
	CtxTenantID = "tenant_id"
	CtxUserID   = "user_id"
	CtxUsername = "username"
)

// JWTSecret returns the JWT secret from environment, defaulting to a development value
func JWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// Default development secret — MUST be overridden in production
		secret = "orion-dev-jwt-secret-change-in-production"
	}
	return []byte(secret)
}

// AuthMiddleware validates JWT tokens and extracts tenant/user context.
// Returns 401 for missing/invalid tokens, populates CtxTenantID and CtxUserID on success.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenStr == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format, expected Bearer <token>"})
			c.Abort()
			return
		}

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return JWTSecret(), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
			c.Abort()
			return
		}

		// Extract tenant ID — fail-closed: reject if missing
		tenantID, ok := claims["tenant_id"]
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing tenant context in token"})
			c.Abort()
			return
		}

		// tenant_id may be float64 from JSON decoding
		var tid int64
		switch v := tenantID.(type) {
		case float64:
			tid = int64(v)
		case string:
			// Parse string tenant ID
			var parsed int64
			for _, c := range v {
				if c >= '0' && c <= '9' {
					parsed = parsed*10 + int64(c-'0')
				}
			}
			tid = parsed
		case int64:
			tid = v
		default:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid tenant_id type in token"})
			c.Abort()
			return
		}

		if tid == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid tenant context"})
			c.Abort()
			return
		}

		c.Set(CtxTenantID, tid)

		// Extract user info (best-effort, not required for tenant isolation)
		if userID, ok := claims["user_id"]; ok {
			if uid, ok := userID.(string); ok {
				c.Set(CtxUserID, uid)
			}
		}
		if username, ok := claims["username"]; ok {
			if un, ok := username.(string); ok {
				c.Set(CtxUsername, un)
			}
		}

		c.Next()
	}
}

// RequireTenantID returns 401 if tenant context is not set.
// Use this on routes where AuthMiddleware may not have run.
func RequireTenantID() gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, ok := c.Get(CtxTenantID); !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// GetTenantID safely retrieves tenant ID from context.
// Returns 0 and false if not present or wrong type.
func GetTenantID(c *gin.Context) (int64, bool) {
	t, ok := c.Get(CtxTenantID)
	if !ok {
		return 0, false
	}
	tid, ok := t.(int64)
	return tid, ok
}

// GetUserID safely retrieves user ID from context.
func GetUserID(c *gin.Context) (string, bool) {
	u, ok := c.Get(CtxUserID)
	if !ok {
		return "", false
	}
	uid, ok := u.(string)
	return uid, ok
}
