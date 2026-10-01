package middleware

import (
	"strings"

	"orion/api-gateway/internal/service"

	"github.com/gin-gonic/gin"
)

// TokenExchange returns a Gin middleware that swaps the Authorization header
// for a service-specific token before proxying.
func TokenExchange(te *service.TokenExchangeService) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		token, err := te.GetServiceToken(c.Request.Context(), path)
		if err != nil {
			c.Header("X-Token-Exchange-Failed", "true")
			c.Next()
			return
		}
		if token != "" {
			c.Request.Header.Set("Authorization", "Bearer "+token)
		}

		c.Next()
	}
}

// IsTokenExchangePath checks if a path has a token exchange rule.
func IsTokenExchangePath(te *service.TokenExchangeService, path string) bool {
	for _, prefix := range te.GetPrefixes() {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}
