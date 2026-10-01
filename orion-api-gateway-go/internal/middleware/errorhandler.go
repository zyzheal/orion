package middleware

import (
	"net/http"
	"runtime/debug"

	"orion/api-gateway/internal/errors"

	"github.com/gin-gonic/gin"
)

// ErrorHandler returns a Gin middleware that recovers from panics and
// formats errors in the standard Orion error response format.
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Get stack trace
				stack := string(debug.Stack())

				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error":     "InternalError",
					"message":   "Internal server error",
					"code":      errors.CodeConfigInvalid,
					"requestId": c.GetString("request_id"),
					"timestamp": c.GetString("request_time"),
					"details":   map[string]interface{}{"stack": stack},
				})
				return
			}
		}()

		c.Next()

		// Check for errors registered by handlers
		if len(c.Errors) > 0 {
			lastErr := c.Errors.Last()
			if appErr, ok := lastErr.Err.(*errors.AppError); ok {
				c.JSON(appErr.StatusCode, gin.H{
					"error":     appErr.Category,
					"message":   appErr.Message,
					"code":      appErr.Code,
					"requestId": c.GetString("request_id"),
					"timestamp": appErr.Timestamp,
					"details":   appErr.Details,
				})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":     "InternalError",
				"message":   lastErr.Error(),
				"code":      errors.CodeConfigInvalid,
				"requestId": c.GetString("request_id"),
			})
		}
	}
}

// NotFoundHandler handles 404 responses in standard format.
func NotFoundHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error":     "NotFoundError",
			"message":   "Resource not found",
			"code":      errors.CodeResourceNotFound,
			"requestId": c.GetString("request_id"),
			"timestamp": c.GetString("request_time"),
		})
	}
}

// MethodNotAllowedHandler handles 405 responses in standard format.
func MethodNotAllowedHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, gin.H{
			"error":     "MethodNotAllowed",
			"message":   "HTTP method not allowed",
			"code":      errors.CodeMethodNotAllowed,
			"requestId": c.GetString("request_id"),
		})
	}
}
