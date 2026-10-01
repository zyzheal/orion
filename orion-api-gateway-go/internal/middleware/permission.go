package middleware

import (
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"orion/api-gateway/internal/abac"
	"orion/api-gateway/internal/rbac"
	"orion/api-gateway/internal/service"

	"github.com/gin-gonic/gin"
)

// PermissionConfig defines the RBAC/ABAC requirements for a route.
type PermissionConfig struct {
	Permissions  []string
	Roles        []string
	ResourceType string
	ActionType   string
	EnableABAC   bool
}

// APIPermissionMap maps route patterns to permission configs.
var apiPermissionMap = map[string]PermissionConfig{
	"GET /api/v1/pipelines":          {Permissions: []string{"pipeline:read"}, ResourceType: "pipeline", ActionType: "read", EnableABAC: true},
	"POST /api/v1/pipelines":         {Permissions: []string{"pipeline:create"}, ResourceType: "pipeline", ActionType: "create", EnableABAC: true},
	"PUT /api/v1/pipelines/:id":      {Permissions: []string{"pipeline:update"}, ResourceType: "pipeline", ActionType: "update", EnableABAC: true},
	"DELETE /api/v1/pipelines/:id":   {Permissions: []string{"pipeline:delete"}, ResourceType: "pipeline", ActionType: "delete", EnableABAC: true},
	"POST /api/v1/pipelines/:id/trigger": {Permissions: []string{"pipeline:trigger"}, ResourceType: "pipeline", ActionType: "trigger", EnableABAC: true},
	"GET /api/v1/deployments":        {Permissions: []string{"deployment:read"}, ResourceType: "deployment", ActionType: "read", EnableABAC: true},
	"POST /api/v1/deployments":       {Permissions: []string{"deployment:create"}, ResourceType: "deployment", ActionType: "create", EnableABAC: true},
	"PUT /api/v1/deployments/:id":    {Permissions: []string{"deployment:update"}, ResourceType: "deployment", ActionType: "update", EnableABAC: true},
	"DELETE /api/v1/deployments/:id": {Permissions: []string{"deployment:delete"}, ResourceType: "deployment", ActionType: "delete", EnableABAC: true},
	"POST /api/v1/deployments/:id/rollback": {Permissions: []string{"deployment:rollback"}, ResourceType: "deployment", ActionType: "rollback", EnableABAC: true},
	"GET /api/v1/cmdb":               {Permissions: []string{"cmdb:read"}, ResourceType: "cmdb", ActionType: "read", EnableABAC: true},
	"POST /api/v1/cmdb":              {Permissions: []string{"cmdb:create"}, ResourceType: "cmdb", ActionType: "create", EnableABAC: true},
	"PUT /api/v1/cmdb/:id":           {Permissions: []string{"cmdb:update"}, ResourceType: "cmdb", ActionType: "update", EnableABAC: true},
	"DELETE /api/v1/cmdb/:id":        {Permissions: []string{"cmdb:delete"}, ResourceType: "cmdb", ActionType: "delete", EnableABAC: true},
	"GET /api/v1/tenants":            {Roles: []string{"admin"}, ResourceType: "tenant", ActionType: "read", EnableABAC: true},
	"POST /api/v1/tenants":           {Roles: []string{"admin"}, Permissions: []string{"tenant:create"}, ResourceType: "tenant", ActionType: "create", EnableABAC: true},
	"PUT /api/v1/tenants/:id":        {Roles: []string{"admin"}, Permissions: []string{"tenant:update"}, ResourceType: "tenant", ActionType: "update", EnableABAC: true},
	"DELETE /api/v1/tenants/:id":     {Roles: []string{"admin"}, Permissions: []string{"tenant:delete"}, ResourceType: "tenant", ActionType: "delete", EnableABAC: true},
	"GET /api/v1/users":              {Permissions: []string{"user:read"}, ResourceType: "user", ActionType: "read", EnableABAC: true},
	"PUT /api/v1/users/:id":          {Permissions: []string{"user:write"}, ResourceType: "user", ActionType: "update", EnableABAC: true},
	"DELETE /api/v1/users/:id":       {Roles: []string{"admin"}, Permissions: []string{"user:delete"}, ResourceType: "user", ActionType: "delete", EnableABAC: true},
	"GET /api/v1/artifacts":          {Permissions: []string{"artifact:read"}, ResourceType: "artifact", ActionType: "read", EnableABAC: true},
	"POST /api/v1/artifacts":         {Permissions: []string{"artifact:upload"}, ResourceType: "artifact", ActionType: "upload", EnableABAC: true},
	"DELETE /api/v1/artifacts/:id":   {Permissions: []string{"artifact:delete"}, ResourceType: "artifact", ActionType: "delete", EnableABAC: true},
	"GET /api/v1/alerts":            {Permissions: []string{"alert:read"}, ResourceType: "alert", ActionType: "read", EnableABAC: true},
	"POST /api/v1/alerts/:id/acknowledge": {Permissions: []string{"alert:acknowledge"}, ResourceType: "alert", ActionType: "acknowledge", EnableABAC: true},
	"POST /api/v1/alerts/:id/resolve": {Permissions: []string{"alert:resolve"}, ResourceType: "alert", ActionType: "resolve", EnableABAC: true},
	"GET /api/v1/logs":               {Permissions: []string{"log:read"}, ResourceType: "log", ActionType: "read", EnableABAC: true},
	"GET /api/v1/monitoring":         {Permissions: []string{"monitoring:read"}, ResourceType: "monitoring", ActionType: "read", EnableABAC: true},
}

var bypassPaths = []string{
	"/healthz", "/readyz", "/health", "/version", "/metrics",
	"/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh",
	"/swagger", "/favicon.ico",
}

// PermissionMiddleware checks RBAC and ABAC permissions for API routes.
type PermissionMiddleware struct {
	rbacSvc *rbac.Service
	abacEngine *abac.Engine
	patterns []patternEntry
	mu       sync.RWMutex
}

type patternEntry struct {
	method   string
	regex    *regexp.Regexp
	config   PermissionConfig
	rawKey   string
}

// NewPermissionMiddleware creates a permission middleware.
func NewPermissionMiddleware(rbacSvc *rbac.Service, abacEngine *abac.Engine) *PermissionMiddleware {
	pm := &PermissionMiddleware{
		rbacSvc:    rbacSvc,
		abacEngine: abacEngine,
	}
	pm.initPatterns()
	return pm
}

func (pm *PermissionMiddleware) initPatterns() {
	for key, cfg := range apiPermissionMap {
		parts := strings.SplitN(key, " ", 2)
		if len(parts) != 2 {
			continue
		}
		method := parts[0]
		pattern := parts[1]
		// Convert :id to [^/]+
		regexStr := strings.ReplaceAll(pattern, "/:", "/[^/]+")
		regexStr = "^" + regexStr + "$"
		re, err := regexp.Compile(regexStr)
		if err != nil {
			continue
		}
		pm.patterns = append(pm.patterns, patternEntry{
			method: method,
			regex:  re,
			config: cfg,
			rawKey: key,
		})
	}
}

func (pm *PermissionMiddleware) shouldBypass(url string) bool {
	for _, p := range bypassPaths {
		if strings.HasPrefix(url, p) {
			return true
		}
	}
	return false
}

func (pm *PermissionMiddleware) matchRouteConfig(method, url string) *PermissionConfig {
	for _, entry := range pm.patterns {
		if entry.method != method {
			continue
		}
		if entry.regex.MatchString(url) {
			cfg := entry.config
			return &cfg
		}
	}
	return nil
}

// Handler returns a Gin middleware that checks permissions.
func (pm *PermissionMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		url := c.Request.URL.Path
		method := c.Request.Method

		if pm.shouldBypass(url) {
			c.Next()
			return
		}

		cfg := pm.matchRouteConfig(method, url)

		if cfg == nil {
			// No permission config for this route — just require auth
			userID, exists := c.Get("user_id")
			if !exists || userID == nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": "UNAUTHORIZED", "message": "Authentication required",
				})
				return
			}
			c.Next()
			return
		}

		userID, exists := c.Get("user_id")
		if !exists || userID == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "UNAUTHORIZED", "message": "Authentication required",
			})
			return
		}

		uid, _ := userID.(string)

		// RBAC check
		if len(cfg.Permissions) > 0 {
			if !pm.rbacSvc.HasAllPermissions(uid, cfg.Permissions) {
				missing := []string{}
				for _, p := range cfg.Permissions {
					if !pm.rbacSvc.HasPermission(uid, p) {
						missing = append(missing, p)
					}
				}
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error":   "FORBIDDEN",
					"message": "Missing permissions: " + strings.Join(missing, ", "),
					"code":    "20501",
					"details": map[string]interface{}{"missingPermissions": missing},
				})
				return
			}
		}

		if len(cfg.Roles) > 0 {
			hasRole := false
			for _, r := range cfg.Roles {
				if pm.rbacSvc.HasRole(uid, r) {
					hasRole = true
					break
				}
			}
			if !hasRole {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error":   "FORBIDDEN",
					"message": "Missing required roles",
					"code":    "20501",
					"details": map[string]interface{}{"missingRoles": cfg.Roles},
				})
				return
			}
		}

		// ABAC check
		if cfg.EnableABAC && pm.abacEngine != nil {
			ctx := pm.buildAbacContext(c, cfg.ResourceType, cfg.ActionType)
			result := pm.abacEngine.Evaluate(ctx)
			if result.Denied {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error":   "FORBIDDEN",
					"message": result.DenialReason,
					"code":    "20501",
					"details": map[string]interface{}{"abacDenied": true},
				})
				return
			}
		}

		c.Next()
	}
}

func (pm *PermissionMiddleware) buildAbacContext(c *gin.Context, resourceType, actionType string) abac.Context {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(string)
	tenantID := c.GetString("tenant_id")
	roles := []string{}
	if r, exists := c.Get("user_roles"); exists {
		if rl, ok := r.([]interface{}); ok {
			for _, role := range rl {
				if s, ok := role.(string); ok {
					roles = append(roles, s)
				}
			}
		}
	}
	role := ""
	if len(roles) > 0 {
		role = roles[0]
	}

	networkType := "external"
	ip := c.ClientIP()
	if strings.HasPrefix(ip, "10.") || strings.HasPrefix(ip, "192.168.") || strings.HasPrefix(ip, "172.16.") {
		networkType = "internal"
	}

	impact := "low"
	switch c.Request.Method {
	case "DELETE":
		impact = "critical"
	case "POST", "PUT":
		impact = "high"
	}
	if actionType == "execute" || actionType == "trigger" {
		impact = "medium"
	}

	return abac.Context{
		User: abac.UserAttrs{
			ID:       uid,
			Role:     role,
			TenantID: tenantID,
			Attributes: map[string]interface{}{
				"roles":    roles,
				"tenantId": tenantID,
			},
		},
		Resource: abac.ResourceAttrs{
			Type:      resourceType,
			TenantID:  tenantID,
			Attributes: map[string]interface{}{},
		},
		Environment: abac.EnvAttrs{
			Time:      time.Now(),
			IP:        ip,
			UserAgent: c.GetHeader("User-Agent"),
			Network:   networkType,
		},
		Action: abac.ActionAttrs{
			Type:   actionType,
			Impact: impact,
		},
	}
}

// SetGrayRelease is a placeholder for future integration.
func (pm *PermissionMiddleware) SetGrayRelease(gr *service.GrayReleaseService) {
	// Will be used when gray release is wired into permission checks
}
