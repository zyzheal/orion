// Package auth provides shared JWT authentication and authorization middleware for Orion Go services.
package auth

import (
	"context"
	"crypto/rsa"
	"net/http"
	"strings"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

// contextKey is a private type for context keys in this package.
type contextKey string

const (
	// ContextKeyUserID is the context key for the authenticated user ID.
	ContextKeyUserID contextKey = "user_id"
	// ContextKeyTenantID is the context key for the tenant ID.
	ContextKeyTenantID contextKey = "tenant_id"
	// ContextKeyRole is the context key for the user's primary role.
	ContextKeyRole contextKey = "role"
	// ContextKeyRoles is the context key for the user's roles array.
	ContextKeyRoles contextKey = "roles"
)

// AuthConfig holds configuration for the Auth middleware.
type AuthConfig struct {
	// JWTSecret is the HS256 secret key for verifying JWT tokens.
	JWTSecret string
	// JWTPublicKey is the RSA public key for RS256 token verification. Optional.
	// If set, RS256 tokens are accepted alongside HS256 (if JWTSecret is also set).
	JWTPublicKey *rsa.PublicKey
	// RedisClient is the Redis client for token blacklist checks. Optional.
	RedisClient *redis.Client
	// SkipPaths are paths that should skip authentication (e.g., /healthz).
	SkipPaths []string
}

// Auth returns a gin.HandlerFunc that validates JWT tokens.
// It extracts user_id, tenant_id, and role from JWT claims and sets them in the gin.Context.
// The JWT algorithm is restricted to HS256 to prevent algorithm confusion attacks.
func Auth(cfg AuthConfig) gin.HandlerFunc {
	skipPaths := make(map[string]bool)
	for _, p := range cfg.SkipPaths {
		skipPaths[p] = true
	}

	return func(c *gin.Context) {
		if skipPaths[c.Request.URL.Path] {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errors.NewErrorEnvelope(c, errors.ErrUnauthorized, "missing authorization header", nil))
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errors.NewErrorEnvelope(c, errors.ErrUnauthorized, "invalid authorization format, expected Bearer token", nil))
			return
		}

		// Check token blacklist in Redis
		if cfg.RedisClient != nil {
			blocked, err := cfg.RedisClient.Exists(c.Request.Context(), "token:blacklist:"+tokenString).Result()
			if err == nil && blocked > 0 {
				c.AbortWithStatusJSON(http.StatusUnauthorized, errors.NewErrorEnvelope(c, errors.ErrUnauthorized, "token has been revoked", nil))
				return
			}
		}

		// Parse and validate JWT with algorithm restriction
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Build allowed methods list based on configured keys
			allowedMethods := []string{}
			if cfg.JWTSecret != "" {
				allowedMethods = append(allowedMethods, "HS256")
			}
			if cfg.JWTPublicKey != nil {
				allowedMethods = append(allowedMethods, "RS256")
			}

			// Check algorithm allowlist
			method := token.Method.Alg()
			allowed := false
			for _, m := range allowedMethods {
				if m == method {
					allowed = true
					break
				}
			}
			if !allowed {
				return nil, jwt.ErrSignatureInvalid
			}

			// Return key based on algorithm
			switch token.Method.(type) {
			case *jwt.SigningMethodHMAC:
				if cfg.JWTSecret == "" {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(cfg.JWTSecret), nil
			case *jwt.SigningMethodRSA:
				if cfg.JWTPublicKey == nil {
					return nil, jwt.ErrSignatureInvalid
				}
				return cfg.JWTPublicKey, nil
			default:
				return nil, jwt.ErrSignatureInvalid
			}
		},
			jwt.WithExpirationRequired(),
		)
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errors.NewErrorEnvelope(c, errors.ErrUnauthorized, "invalid or expired token", nil))
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errors.NewErrorEnvelope(c, errors.ErrUnauthorized, "invalid token claims", nil))
			return
		}

		// Extract and validate required claims
		userID, _ := claims["sub"].(string)
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errors.NewErrorEnvelope(c, errors.ErrUnauthorized, "token missing user ID", nil))
			return
		}

		tenantID, _ := claims["tenant_id"].(string)
		if tenantID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errors.NewErrorEnvelope(c, errors.ErrUnauthorized, "token missing tenant ID", nil))
			return
		}

		role, _ := claims["role"].(string)

		// Parse multi-role support: "roles" array claim (preferred) or fallback to single "role"
		var roles []string
		if rolesRaw, ok := claims["roles"]; ok {
			if rolesArr, ok := rolesRaw.([]interface{}); ok {
				for _, r := range rolesArr {
					if s, ok := r.(string); ok && s != "" {
						roles = append(roles, s)
					}
				}
			}
		}
		// Fallback: single role claim
		if len(roles) == 0 && role != "" {
			roles = []string{role}
		}

		// Extract user status claim (for disabled/suspended account detection)
		userStatus, _ := claims["status"].(string)
		if userStatus == "" {
			userStatus = "active"
		}

		// Set values in gin context
		c.Set("user_id", userID)
		c.Set("tenant_id", tenantID)
		c.Set("role", role)
		c.Set("roles", roles)
		c.Set("user_status", userStatus)

		// Also set in request context for downstream use
		ctx := context.WithValue(c.Request.Context(), ContextKeyUserID, userID)
		ctx = context.WithValue(ctx, ContextKeyTenantID, tenantID)
		ctx = context.WithValue(ctx, ContextKeyRole, role)
		ctx = context.WithValue(ctx, ContextKeyRoles, roles)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// GetUserID extracts the user ID from the gin context (set by Auth middleware).
func GetUserID(c *gin.Context) string {
	v, _ := c.Get("user_id")
	s, _ := v.(string)
	return s
}

// GetTenantID extracts the tenant ID from the gin context (set by Auth middleware).
func GetTenantID(c *gin.Context) string {
	v, _ := c.Get("tenant_id")
	s, _ := v.(string)
	return s
}

// GetRole extracts the primary role from the gin context (set by Auth middleware).
func GetRole(c *gin.Context) string {
	v, _ := c.Get("role")
	s, _ := v.(string)
	return s
}

// GetRoles extracts all roles from the gin context (set by Auth middleware).
// Supports JWT claims with "roles" array or single "role" string.
func GetRoles(c *gin.Context) []string {
	v, _ := c.Get("roles")
	if roles, ok := v.([]string); ok {
		return roles
	}
	// Fallback to single role
	role := GetRole(c)
	if role != "" {
		return []string{role}
	}
	return nil
}

// GetStatus extracts the user account status from the gin context (set by Auth middleware).
// Returns "active" if not set.
func GetStatus(c *gin.Context) string {
	v, exists := c.Get("user_status")
	if !exists {
		return "active"
	}
	s, _ := v.(string)
	if s == "" {
		return "active"
	}
	return s
}

// RequireRole returns middleware that requires the user to have the specified role.
func RequireRole(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := GetRole(c)
		if role != requiredRole {
			c.AbortWithStatusJSON(http.StatusForbidden, errors.NewErrorEnvelope(c, errors.ErrForbidden, "insufficient permissions", nil))
			return
		}
		c.Next()
	}
}

// RequireAnyRole returns middleware that requires the user to have one of the specified roles.
func RequireAnyRole(roles ...string) gin.HandlerFunc {
	roleSet := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleSet[r] = true
	}
	return func(c *gin.Context) {
		role := GetRole(c)
		if !roleSet[role] {
			c.AbortWithStatusJSON(http.StatusForbidden, errors.NewErrorEnvelope(c, errors.ErrForbidden, "insufficient permissions", nil))
			return
		}
		c.Next()
	}
}
