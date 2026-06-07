package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORSConfig holds CORS configuration.
type CORSConfig struct {
	// AllowedOrigins is a list of allowed origins (e.g., ["https://orion.company.com"]).
	// Use ["*"] only for development.
	AllowedOrigins []string
	// AllowedMethods defaults to standard methods if empty.
	AllowedMethods []string
	// AllowedHeaders defaults to standard headers if empty.
	AllowedHeaders []string
	// AllowCredentials sets Access-Control-Allow-Credentials.
	AllowCredentials bool
}

// DefaultCORSConfig returns a restrictive CORS config for production use.
func DefaultCORSConfig(allowedOrigins []string) CORSConfig {
	return CORSConfig{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Tenant-ID", "X-Request-ID"},
		AllowCredentials: true,
	}
}

// DevCORSConfig returns a permissive CORS config for development.
func DevCORSConfig() CORSConfig {
	return CORSConfig{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Tenant-ID", "X-Request-ID"},
		AllowCredentials: false,
	}
}

// CORS returns a gin.HandlerFunc that handles CORS with origin validation.
// Unlike the naive "Allow-Origin: *" approach, this validates the request Origin
// against the allowed list and only echoes back matching origins.
func CORS(cfg CORSConfig) gin.HandlerFunc {
	methods := strings.Join(cfg.AllowedMethods, ", ")
	headers := strings.Join(cfg.AllowedHeaders, ", ")

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		if origin == "" {
			c.Next()
			return
		}

		allowed := false
		for _, o := range cfg.AllowedOrigins {
			if o == "*" || o == origin {
				allowed = true
				break
			}
		}

		if !allowed {
			c.Next()
			return
		}

		// Echo back the specific origin (not "*") when credentials are used
		if cfg.AllowCredentials && len(cfg.AllowedOrigins) == 1 && cfg.AllowedOrigins[0] == "*" {
			c.Header("Access-Control-Allow-Origin", "*")
		} else {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", methods)
		c.Header("Access-Control-Allow-Headers", headers)

		if cfg.AllowCredentials {
			c.Header("Access-Control-Allow-Credentials", "true")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
