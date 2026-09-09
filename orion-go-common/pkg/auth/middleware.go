// Package auth provides shared JWT authentication and authorization middleware for Orion Go services.
package auth

import (
	"context"
	"crypto/rsa"
	"fmt"
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
	// AnonymousTracker, when non-nil, is called by OptionalAuth on every
	// request it could not authenticate. Strict Auth ignores this field.
	//
	// Why: the PERM-8 stage 2 migration (switch /api/v1 from OptionalAuth to
	// strict Auth) will 401 every client that has been calling without a
	// token. To plan that switchover safely we need to know which callers are
	// anonymous today — the answer is not in the token log because OptionalAuth
	// by design never emits one. Wire this field to a rate-limited logger, a
	// Prometheus counter, or a sampling sink; nil disables tracking entirely
	// (default for backwards compatibility).
	AnonymousTracker AnonymousTracker
}

// AnonymousTracker is the optional hook OptionalAuth invokes when it could
// not authenticate a request. The reason is a stable enum-like string so
// consumers can bucket without parsing log text. Track MUST NOT block or
// return an error — OptionalAuth never surfaces it; the contract is fire-and-
// forget. If the tracker wants to rate-limit, dedupe, or sample, do it in the
// tracker.
type AnonymousTracker interface {
	// Track fires once per anonymous request. Path is the request URL path
	// (already normalised by Gin), Method is the HTTP verb, and Reason is
	// one of:
	//
	//   - "no-authorization-header"   the request carried no Authorization
	//   - "non-bearer-auth-header"    header did not start with "Bearer "
	//   - "token-blacklisted"         Redis flagged the token as revoked
	//   - "token-parse-error"         ParseClaims returned an error
	Track(c *gin.Context, method, path, reason string)
}

// Claims is the identity extracted from a verified JWT. It is the single
// structure both Auth and OptionalAuth populate from, so the two middlewares
// cannot disagree about what a token means.
type Claims struct {
	UserID   string
	TenantID string
	Role     string
	Roles    []string
	Status   string
}

// Parse failure reasons. Auth maps them back onto its original 401 messages so
// strict callers observe no change after the ParseClaims extraction.
var (
	ErrTokenInvalid    = fmt.Errorf("invalid or expired token")
	ErrTokenBadClaims  = fmt.Errorf("invalid token claims")
	ErrTokenMissingSub = fmt.Errorf("token missing user ID")
)

// jwtKeyfunc builds the verification keyfunc from cfg. The algorithm allowlist
// is derived from which keys are configured, which is what keeps alg-confusion
// attacks out: with neither key set, no method is allowed.
func jwtKeyfunc(cfg AuthConfig) jwt.Keyfunc {
	return func(token *jwt.Token) (interface{}, error) {
		allowedMethods := []string{}
		if cfg.JWTSecret != "" {
			allowedMethods = append(allowedMethods, "HS256")
		}
		if cfg.JWTPublicKey != nil {
			allowedMethods = append(allowedMethods, "RS256")
		}

		method := token.Method.Alg()
		for _, m := range allowedMethods {
			if m == method {
				return keyForMethod(token.Method, cfg)
			}
		}
		return nil, jwt.ErrSignatureInvalid
	}
}

// keyForMethod returns the signing key for an already-allowlisted method.
func keyForMethod(method jwt.SigningMethod, cfg AuthConfig) (interface{}, error) {
	switch method.(type) {
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
}

// ParseClaims verifies tokenString against cfg and extracts the identity claims.
//
// tenant_id is deliberately NOT required here: Auth enforces it itself, while
// OptionalAuth must still be able to identify a token that omits it (setting
// tenant_id only when present). The blacklist is not consulted here either — it
// is a request-scoped concern (it needs the request context) owned by each
// middleware.
func ParseClaims(tokenString string, cfg AuthConfig) (*Claims, error) {
	token, err := jwt.Parse(tokenString, jwtKeyfunc(cfg), jwt.WithExpirationRequired())
	if err != nil || !token.Valid {
		return nil, ErrTokenInvalid
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrTokenBadClaims
	}

	userID, _ := claims["sub"].(string)
	if userID == "" {
		return nil, ErrTokenMissingSub
	}

	tenantID, _ := claims["tenant_id"].(string)
	role, _ := claims["role"].(string)

	// Multi-role support: "roles" array claim (preferred) or fallback to single "role"
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
	if len(roles) == 0 && role != "" {
		roles = []string{role}
	}

	// Absent status claim means an active account, not a disabled one.
	status, _ := claims["status"].(string)
	if status == "" {
		status = "active"
	}

	return &Claims{UserID: userID, TenantID: tenantID, Role: role, Roles: roles, Status: status}, nil
}

// applyClaims writes the identity into both the gin context and the request
// context. Auth and OptionalAuth share it so downstream readers of either
// ContextKey* or c.Get(...) see the same values.
func applyClaims(c *gin.Context, claims *Claims) {
	c.Set("user_id", claims.UserID)
	c.Set("tenant_id", claims.TenantID)
	c.Set("role", claims.Role)
	c.Set("roles", claims.Roles)
	c.Set("user_status", claims.Status)

	ctx := context.WithValue(c.Request.Context(), ContextKeyUserID, claims.UserID)
	ctx = context.WithValue(ctx, ContextKeyTenantID, claims.TenantID)
	ctx = context.WithValue(ctx, ContextKeyRole, claims.Role)
	ctx = context.WithValue(ctx, ContextKeyRoles, claims.Roles)
	c.Request = c.Request.WithContext(ctx)
}

// OptionalAuth is the non-blocking twin of Auth. Callers that present a valid,
// unrevoked token get user_id / tenant_id / role / roles in the context, so
// auth.RequirePermission guards become real authorisation for them. Everyone
// else continues anonymously.
//
// It never aborts, never 401s and never 403s, which makes it safe to switch on
// without a client migration: a request that succeeded before still succeeds,
// and a guarded request can only change from 403 to 200 — never from 200 to 401.
// Missing or malformed headers are treated as anonymous rather than rejected,
// so a token typo degrades to "no access to guarded routes" instead of a hard
// failure. Strict enforcement is Auth, not this.
func OptionalAuth(cfg AuthConfig) gin.HandlerFunc {
	skipPaths := make(map[string]bool)
	for _, p := range cfg.SkipPaths {
		skipPaths[p] = true
	}

	// track is a small closure so we don't have to thread cfg into a method.
	// nil-safe: returns immediately when no tracker is configured.
	track := func(c *gin.Context, reason string) {
		if cfg.AnonymousTracker == nil {
			return
		}
		cfg.AnonymousTracker.Track(c, c.Request.Method, c.Request.URL.Path, reason)
	}

	return func(c *gin.Context) {
		if skipPaths[c.Request.URL.Path] {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if strings.TrimSpace(authHeader) == "" {
			track(c, "no-authorization-header")
			c.Next()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			track(c, "non-bearer-auth-header")
			c.Next()
			return
		}

		if cfg.RedisClient != nil {
			blocked, err := cfg.RedisClient.Exists(c.Request.Context(), "token:blacklist:"+tokenString).Result()
			if err == nil && blocked > 0 {
				track(c, "token-blacklisted")
				c.Next()
				return
			}
		}

		claims, err := ParseClaims(tokenString, cfg)
		if err != nil {
			track(c, "token-parse-error")
			c.Next()
			return
		}

		applyClaims(c, claims)
		c.Next()
	}
}

// Auth is the strict authentication middleware. It returns 401 for a missing
// or malformed Authorization header, a revoked token, a token that fails
// verification, a token without a sub or tenant_id claim.
//
// Verification is delegated to ParseClaims, shared with OptionalAuth, so the two
// cannot drift apart in how they read a token. Only two things are strict-mode
// only: aborting on every failure instead of degrading to anonymous, and
// requiring tenant_id.
//
// The accepted algorithms are restricted to HS256 / RS256 and derived from
// which keys are configured, which is what prevents algorithm confusion.
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
		claims, err := ParseClaims(tokenString, cfg)
		if err != nil {
			// ParseClaims collapses the verification failures; restore the
			// original per-cause messages here so existing clients see no change.
			msg := "invalid or expired token"
			switch err {
			case ErrTokenBadClaims:
				msg = "invalid token claims"
			case ErrTokenMissingSub:
				msg = "token missing user ID"
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, errors.NewErrorEnvelope(c, errors.ErrUnauthorized, msg, nil))
			return
		}

		// tenant_id is required only in strict mode: the platform authenticates
		// per-tenant resources off it, while OptionalAuth works without one.
		if claims.TenantID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errors.NewErrorEnvelope(c, errors.ErrUnauthorized, "token missing tenant ID", nil))
			return
		}

		applyClaims(c, claims)
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
//
// The fallback also applies when "roles" is present but empty, so a caller that
// only sets "role" is never silently downgraded to "no role assigned".
func GetRoles(c *gin.Context) []string {
	v, _ := c.Get("roles")
	if roles, ok := v.([]string); ok && len(roles) > 0 {
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

// hasRole reports whether any role the caller holds equals required. RequireRole
// and RequireAnyRole delegate here so they honour the "roles" array the same way
// RequirePermission honours it (anyRoleHasPermission in permission.go), instead
// of silently ignoring every role after the first.
func hasRole(c *gin.Context, required string) bool {
	for _, role := range GetRoles(c) {
		if role == required {
			return true
		}
	}
	return false
}

// RequireRole returns middleware that requires the user to hold the specified role.
// Holds means "present in any of the caller's roles", not "equal to the primary one".
func RequireRole(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !hasRole(c, requiredRole) {
			c.AbortWithStatusJSON(http.StatusForbidden, errors.NewErrorEnvelope(c, errors.ErrForbidden, "insufficient permissions", nil))
			return
		}
		c.Next()
	}
}

// RequireAnyRole returns middleware that requires the user to hold one of the specified roles.
func RequireAnyRole(roles ...string) gin.HandlerFunc {
	roleSet := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleSet[r] = true
	}
	return func(c *gin.Context) {
		for _, role := range GetRoles(c) {
			if roleSet[role] {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, errors.NewErrorEnvelope(c, errors.ErrForbidden, "insufficient permissions", nil))
	}
}
