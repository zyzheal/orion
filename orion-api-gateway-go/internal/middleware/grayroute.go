package middleware

import (
	"strings"

	"orion/api-gateway/internal/service"

	"github.com/gin-gonic/gin"
)

var graySkipPaths = []string{
	"/healthz", "/readyz", "/health", "/metrics",
	"/version", "/swagger", "/favicon.ico", "/ws",
}

// GrayRoute returns a Gin middleware that resolves gray-release routing.
func GrayRoute(gr *service.GrayReleaseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		url := c.Request.URL.Path

		if isGraySkipPath(url) {
			c.Next()
			return
		}

		if !gr.IsEnabled() {
			c.Next()
			return
		}

		tenantID := c.GetString("tenant_id")
		override := c.GetHeader("X-Gray-Release-Override")

		result := gr.GetTarget(url, tenantID, override)
		c.Set("gray_release_target", result.Target)
		c.Set("gray_release_target_id", result.TargetID)
		c.Set("gray_release_source", result.Source)

		c.Header("X-Gray-Release-Source", result.Source)
		c.Header("X-Gray-Release-Target", result.TargetID)

		c.Next()
	}
}

func isGraySkipPath(url string) bool {
	for _, p := range graySkipPaths {
		if strings.HasPrefix(url, p) {
			return true
		}
	}
	return false
}
