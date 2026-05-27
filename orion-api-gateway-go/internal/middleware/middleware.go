package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// hashToken computes SHA256 hash of the token for blacklist lookup.
// Matches the TokenBlacklistService.hashToken implementation in platform-service.
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

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
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Tenant-ID, X-Request-ID")
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

func JWTAuth(rdb *redis.Client, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// Allow unauthenticated for health/public endpoints
			c.Next()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "invalid authorization format"})
			return
		}

		// Check token blacklist (use SHA256 hash, matching platform-service)
		tokenHash := hashToken(tokenString)
		blocked, err := rdb.Exists(c.Request.Context(), "token:blacklist:"+tokenHash).Result()
		if err == nil && blocked > 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "error": "TOKEN_REVOKED", "message": "token revoked"})
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
			if tid, exists := claims["tenant_id"]; exists {
				c.Set("tenant_id", tid)
			}
		}

		c.Next()
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
