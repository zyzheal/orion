package middleware

import (
	"net/http"
	"strings"

	"orion/api-gateway/internal/service"

	"github.com/gin-gonic/gin"
)

// VersionMiddleware handles API version negotiation and deprecation warnings.
type VersionMiddleware struct {
	manager     *service.ApiVersionManager
	publicPaths []string
}

// NewVersionMiddleware creates a version middleware.
func NewVersionMiddleware(manager *service.ApiVersionManager) *VersionMiddleware {
	return &VersionMiddleware{
		manager: manager,
		publicPaths: []string{
			"/healthz", "/readyz", "/health", "/version",
			"/metrics", "/swagger", "/favicon.ico",
		},
	}
}

// Handler returns the Gin middleware.
func (m *VersionMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		// Skip public paths
		for _, p := range m.publicPaths {
			if strings.HasPrefix(path, p) {
				c.Next()
				return
			}
		}

		// Extract version from header
		headerVersion := c.GetHeader("X-API-Version")

		result, err := m.manager.NegotiateVersion(path, headerVersion)
		if err != nil {
			msg := err.Error()
			if strings.Contains(msg, "retired") {
				c.AbortWithStatusJSON(http.StatusGone, gin.H{
					"error":   "VERSION_RETIRED",
					"message": msg,
					"code":    "10601",
				})
				return
			}
			if strings.Contains(msg, "unable to determine") || strings.Contains(msg, "Unable to determine") {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error":   "VERSION_REQUIRED",
					"message": "API version is required. Please specify version via X-API-Version header or URL path.",
					"code":    "10602",
				})
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   "VERSION_ERROR",
				"message": "Failed to process API version",
				"code":    "10603",
			})
			return
		}

		// Set response headers
		headers := m.manager.GetVersionWarningHeaders(result)
		for k, v := range headers {
			c.Header(k, v)
		}

		c.Set("api_version", result.ResolvedVersion)
		c.Set("api_version_source", result.Source)
		c.Set("api_version_deprecated", result.IsDeprecated)

		c.Next()
	}
}

// RegisterVersionRoutes registers version info routes.
func RegisterVersionRoutes(r *gin.Engine, manager *service.ApiVersionManager) {
	r.GET("/api/version/info", func(c *gin.Context) {
		registry := manager.GetRegistry()
		c.JSON(http.StatusOK, gin.H{
			"currentVersion": registry.GetCurrentVersion().Version,
			"supportedVersions": registry.GetSupportedVersions(),
		})
	})

	r.GET("/api/version/deprecation", func(c *gin.Context) {
		registry := manager.GetRegistry()
		c.JSON(http.StatusOK, gin.H{
			"notices": registry.GetAllDeprecationNotices(),
		})
	})

	r.GET("/api/version/history", func(c *gin.Context) {
		registry := manager.GetRegistry()
		c.JSON(http.StatusOK, gin.H{
			"versions": registry.GetAllVersions(),
		})
	})
}
