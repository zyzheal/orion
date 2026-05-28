package middleware

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// ==================== Token Blacklist Cache ====================

type blacklistCache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
	ttl     time.Duration
}

type cacheEntry struct {
	revoked   bool
	checkedAt time.Time
}

func newBlacklistCache(ttl time.Duration) *blacklistCache {
	c := &blacklistCache{
		entries: make(map[string]cacheEntry),
		ttl:     ttl,
	}
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			c.cleanup()
		}
	}()
	return c
}

func (c *blacklistCache) get(tokenHash string) (bool, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	entry, exists := c.entries[tokenHash]
	if !exists || time.Since(entry.checkedAt) > c.ttl {
		return false, false
	}
	return entry.revoked, true
}

func (c *blacklistCache) set(tokenHash string, revoked bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[tokenHash] = cacheEntry{revoked: revoked, checkedAt: time.Now()}
}

func (c *blacklistCache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	for k, v := range c.entries {
		if now.Sub(v.checkedAt) > c.ttl {
			delete(c.entries, k)
		}
	}
}

// extractToken tries: Bearer, X-API-Key, ?token= query param.
func extractToken(c *gin.Context) string {
	if auth := c.GetHeader("Authorization"); auth != "" && strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	if apiKey := c.GetHeader("X-API-Key"); apiKey != "" {
		return apiKey
	}
	return c.Query("token")
}

// ==================== Hash ====================

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// ==================== Core Middleware ====================

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := generateID()
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

func StructuredLogger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		c.Next()
		latency := time.Since(start)
		statusCode := c.Writer.Status()
		logger.Info("request",
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.Int("status", statusCode),
			zap.Duration("latency", latency),
			zap.String("request_id", c.GetString("request_id")),
			zap.String("tenant_id", c.GetString("tenant_id")),
		)
	}
}

func CORS(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if len(allowedOrigins) == 1 && allowedOrigins[0] == "*" {
			c.Header("Access-Control-Allow-Origin", "*")
		} else if contains(allowedOrigins, origin) {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Tenant-ID, X-Request-ID, X-API-Key")
		c.Header("Access-Control-Expose-Headers", "X-Request-ID")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func TenantPropagation() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}
		c.Set("tenant_id", tenantID)
		c.Next()
	}
}

// JWTAuth returns a Gin middleware that authenticates requests via JWT.
// Supports: Bearer token, X-API-Key header, ?token= query param.
// Checks token blacklist in Redis with local cache (30s TTL, fail-open).
func JWTAuth(rdb *redis.Client, jwtSecret string) gin.HandlerFunc {
	cache := newBlacklistCache(30 * time.Second)
	publicPaths := []string{
		"/health", "/healthz", "/readyz", "/metrics",
		"/api/v1/auth/login", "/api/v1/auth/register",
	}

	return func(c *gin.Context) {
		path := c.Request.URL.Path
		for _, pp := range publicPaths {
			if strings.HasPrefix(path, pp) {
				c.Next()
				return
			}
		}

		tokenString := extractToken(c)
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code": 401, "error": "UNAUTHORIZED", "message": "Authentication required",
			})
			return
		}

		// Blacklist check with local cache
		tokenHash := hashToken(tokenString)
		if revoked, found := cache.get(tokenHash); found && revoked {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code": 401, "error": "TOKEN_REVOKED", "message": "token revoked",
			})
			return
		}
		if _, found := cache.get(tokenHash); !found {
			blocked, err := rdb.Exists(c.Request.Context(), "token:blacklist:"+tokenHash).Result()
			revoked := err == nil && blocked > 0
			cache.set(tokenHash, revoked)
			if revoked {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"code": 401, "error": "TOKEN_REVOKED", "message": "token revoked",
				})
				return
			}
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code": 401, "error": "UNAUTHORIZED", "message": "invalid or expired token",
			})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_id", claims["sub"])
			if email, exists := claims["email"]; exists {
				c.Set("user_email", email)
			}
			if roles, exists := claims["roles"]; exists {
				c.Set("user_roles", roles)
			}
			if perms, exists := claims["permissions"]; exists {
				c.Set("user_permissions", perms)
			}
			if tid, exists := claims["tenant_id"]; exists {
				c.Set("tenant_id", tid)
			}
		}

		c.Next()
	}
}

// RequireRoles checks if the user has one of the required roles.
func RequireRoles(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRoles, exists := c.Get("user_roles")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 403, "error": "FORBIDDEN", "message": "Insufficient permissions"})
			return
		}
		roleList, ok := userRoles.([]interface{})
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 403, "error": "FORBIDDEN", "message": "Insufficient permissions"})
			return
		}
		for _, required := range roles {
			for _, userRole := range roleList {
				if s, ok := userRole.(string); ok && s == required {
					c.Next()
					return
				}
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 403, "error": "FORBIDDEN", "message": "Insufficient permissions"})
	}
}

// RequirePermissions checks if the user has one of the required permissions.
func RequirePermissions(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userPerms, exists := c.Get("user_permissions")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 403, "error": "FORBIDDEN", "message": "Insufficient permissions"})
			return
		}
		permList, ok := userPerms.([]interface{})
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 403, "error": "FORBIDDEN", "message": "Insufficient permissions"})
			return
		}
		for _, required := range permissions {
			for _, userPerm := range permList {
				if s, ok := userPerm.(string); ok && s == required {
					c.Next()
					return
				}
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 403, "error": "FORBIDDEN", "message": "Insufficient permissions"})
	}
}

// RateLimiter implements a simple token bucket rate limiter using Redis.
func RateLimiter(rdb *redis.Client, rps int) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := "ratelimit:" + c.ClientIP()
		count, err := rdb.Incr(c.Request.Context(), key).Result()
		if err == nil {
			if count == 1 {
				rdb.Expire(c.Request.Context(), key, time.Second)
			}
			if int(count) > rps {
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"code": 429, "message": "rate limit exceeded"})
				return
			}
		}
		c.Next()
	}
}

func MetricsHandler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

func NewRedisClient(redisURL string) *redis.Client {
	opts, _ := redis.ParseURL(redisURL)
	return redis.NewClient(opts)
}

func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
