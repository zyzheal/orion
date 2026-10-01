package middleware

import (
	"encoding/json"
	"strings"

	"github.com/gin-gonic/gin"
)

// SubAppAuthConfig controls the sub-app auth header injection behavior.
type SubAppAuthConfig struct {
	// Prefixes are path prefixes to apply header injection (empty = all authenticated routes)
	Prefixes []string
	// IncludeFullContext adds X-Auth-Context JSON header for debugging
	IncludeFullContext bool
}

// SubAppAuth returns a Gin middleware that injects X-User-* headers
// for sub-applications to read instead of verifying JWT themselves.
//
// Injected headers:
//   - X-User-Id: user ID from JWT "sub" claim
//   - X-Username: email/username from JWT
//   - X-User-Roles: comma-separated roles
//   - X-User-Permissions: comma-separated permissions
//   - X-Tenant-Id: tenant ID
//   - X-Auth-Context: full auth context JSON (if IncludeFullContext=true)
//
// This middleware must run AFTER JWTAuth which sets user_id, tenant_id in context.
func SubAppAuth(cfg SubAppAuthConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if authenticated (JWTAuth sets user_id)
		userID, exists := c.Get("user_id")
		if !exists || userID == nil {
			c.Next()
			return
		}

		// If prefixes specified, only inject for matching paths
		if len(cfg.Prefixes) > 0 {
			path := c.Request.URL.Path
			matched := false
			for _, prefix := range cfg.Prefixes {
				if strings.HasPrefix(path, prefix) {
					matched = true
					break
				}
			}
			if !matched {
				c.Next()
				return
			}
		}

		// Inject user ID
		if uid, ok := userID.(string); ok && uid != "" {
			c.Request.Header.Set("X-User-Id", uid)
		}

		// Inject username/email if available
		if email, ok := c.Get("user_email"); ok {
			if e, ok := email.(string); ok && e != "" {
				c.Request.Header.Set("X-Username", e)
			}
		}

		// Inject roles if available
		if roles, ok := c.Get("user_roles"); ok {
			if r, ok := roles.([]interface{}); ok && len(r) > 0 {
				strRoles := make([]string, 0, len(r))
				for _, role := range r {
					if s, ok := role.(string); ok {
						strRoles = append(strRoles, s)
					}
				}
				c.Request.Header.Set("X-User-Roles", strings.Join(strRoles, ","))
			}
		}

		// Inject permissions if available
		if perms, ok := c.Get("user_permissions"); ok {
			if p, ok := perms.([]interface{}); ok && len(p) > 0 {
				strPerms := make([]string, 0, len(p))
				for _, perm := range p {
					if s, ok := perm.(string); ok {
						strPerms = append(strPerms, s)
					}
				}
				c.Request.Header.Set("X-User-Permissions", strings.Join(strPerms, ","))
			}
		}

		// Inject tenant ID
		if tenantID, ok := c.Get("tenant_id"); ok {
			if tid, ok := tenantID.(string); ok && tid != "" {
				c.Request.Header.Set("X-Tenant-Id", tid)
			}
		}

		// Optional: full auth context JSON
		if cfg.IncludeFullContext {
			ctx := map[string]interface{}{
				"userId": userID,
			}
			if email, ok := c.Get("user_email"); ok {
				ctx["email"] = email
			}
			if roles, ok := c.Get("user_roles"); ok {
				ctx["roles"] = roles
			}
			if perms, ok := c.Get("user_permissions"); ok {
				ctx["permissions"] = perms
			}
			if jsonData, err := json.Marshal(ctx); err == nil {
				c.Request.Header.Set("X-Auth-Context", string(jsonData))
			}
		}

		c.Next()
	}
}

// VerifySubAppUser extracts user context from X-User-* headers
// for sub-application backends that use header-based auth.
//
// Returns nil if no sub-app auth headers are present.
func VerifySubAppUser(c *gin.Context) *SubAppUser {
	userID := c.GetHeader("X-User-Id")
	if userID == "" {
		return nil
	}

	user := &SubAppUser{
		UserID:   userID,
		Username: c.GetHeader("X-Username"),
		TenantID: c.GetHeader("X-Tenant-Id"),
	}

	if roles := c.GetHeader("X-User-Roles"); roles != "" {
		user.Roles = strings.Split(roles, ",")
	}
	if perms := c.GetHeader("X-User-Permissions"); perms != "" {
		user.Permissions = strings.Split(perms, ",")
	}

	if user.Username == "" {
		user.Username = user.UserID
	}

	return user
}

// SubAppUser holds user info from sub-app auth headers.
type SubAppUser struct {
	UserID      string
	Username    string
	Roles       []string
	Permissions []string
	TenantID    string
}

// RequireSubAppAuth returns middleware that rejects requests without sub-app auth headers.
// For sub-applications that have migrated to header-based auth.
func RequireSubAppAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := VerifySubAppUser(c)
		if user == nil {
			c.AbortWithStatusJSON(401, gin.H{
				"code":    401,
				"error":   "UNAUTHORIZED",
				"message": "Missing sub-app authentication headers. Ensure request passes through Gateway.",
			})
			return
		}
		c.Set("subapp_user", user)
		c.Next()
	}
}

// RequireSubAppRole returns middleware that checks sub-app user has one of the required roles.
func RequireSubAppRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := VerifySubAppUser(c)
		if user == nil {
			c.AbortWithStatusJSON(401, gin.H{"code": 401, "error": "UNAUTHORIZED", "message": "Not authenticated"})
			return
		}

		hasRole := false
		for _, required := range roles {
			for _, userRole := range user.Roles {
				if userRole == required {
					hasRole = true
					break
				}
			}
			if hasRole {
				break
			}
		}

		if !hasRole {
			c.AbortWithStatusJSON(403, gin.H{
				"code":    403,
				"error":   "FORBIDDEN",
				"message": "Required roles: " + strings.Join(roles, ", "),
			})
			return
		}
		c.Next()
	}
}
