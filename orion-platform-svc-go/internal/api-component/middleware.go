// Package apicomponent provides built-in middleware for the API Component system.

package apicomponent

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Request Validation
// ---------------------------------------------------------------------------

// ValidateRequestBody returns middleware that validates the request body
// by binding it to the given struct type.
func ValidateRequestBody(model interface{}) MiddlewareFunc {
	return func(c *gin.Context) {
		if err := c.ShouldBindJSON(model); err != nil {
			WriteBadRequest(c, "invalid request body: "+err.Error())
			c.Abort()
			return
		}
		c.Next()
	}
}

// ValidateRequiredParams returns middleware that checks for required path/query params.
func ValidateRequiredParams(params ...string) MiddlewareFunc {
	return func(c *gin.Context) {
		for _, p := range params {
			if c.Param(p) == "" {
				WriteBadRequest(c, "missing required path parameter: "+p)
				c.Abort()
				return
			}
		}
		c.Next()
	}
}

// ValidateContentType returns middleware that enforces a specific Content-Type.
func ValidateContentType(contentType string) MiddlewareFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength <= 0 {
			c.Next()
			return
		}
		ct := c.GetHeader("Content-Type")
		if !hasContentType(ct, contentType) {
			WriteError(c, "unsupported_media_type",
				"the Content-Type must be "+contentType, 415)
			c.Abort()
			return
		}
		c.Next()
	}
}

func hasContentType(header, expected string) bool {
	idx := header
	for pos := 0; pos < len(header); pos++ {
		if header[pos] == ';' {
			idx = header[:pos]
			break
		}
	}
	return stringsEqual(trimSpace(idx), trimSpace(expected))
}

func trimSpace(s string) string {
	for len(s) > 0 && s[0] == ' ' {
		s = s[1:]
	}
	for len(s) > 0 && s[len(s)-1] == ' ' {
		s = s[:len(s)-1]
	}
	return s
}

func stringsEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		c1 := a[i]
		c2 := b[i]
		if c1 >= 'A' && c1 <= 'Z' {
			c1 += 'a' - 'A'
		}
		if c2 >= 'A' && c2 <= 'Z' {
			c2 += 'a' - 'A'
		}
		if c1 != c2 {
			return false
		}
	}
	return true
}

// ---------------------------------------------------------------------------
// Response Serialization
// ---------------------------------------------------------------------------

// ResponseJSONMiddleware returns middleware that sets Content-Type to application/json.
func ResponseJSONMiddleware() MiddlewareFunc {
	return func(c *gin.Context) {
		c.Header("Content-Type", "application/json")
		c.Next()
	}
}

// ResponseWithMeta adds metadata to the response context.
func ResponseWithMeta(key string, value interface{}) MiddlewareFunc {
	return func(c *gin.Context) {
		c.Set(key, value)
		c.Next()
	}
}

// ---------------------------------------------------------------------------
// Timeout Middleware
// ---------------------------------------------------------------------------

// TimeoutMiddleware applies a per-request timeout.
func TimeoutMiddleware(timeout time.Duration) MiddlewareFunc {
	return func(c *gin.Context) {
		done := make(chan struct{}, 1)
		panicChan := make(chan interface{}, 1)

		go func() {
			defer func() {
				if r := recover(); r != nil {
					panicChan <- r
				}
				done <- struct{}{}
			}()
			c.Next()
		}()

		select {
		case <-c.Request.Context().Done():
			WriteError(c, "request_cancelled",
				"request was cancelled by the client", http.StatusRequestTimeout)
			c.Abort()
			return
		case <-time.After(timeout):
			WriteError(c, "timeout",
				"the request timed out", http.StatusGatewayTimeout)
			c.Abort()
			return
		case <-done:
			c.Status(http.StatusOK)
		case r := <-panicChan:
			panic(r)
		}
	}
}

// ---------------------------------------------------------------------------
// CORS Middleware
// ---------------------------------------------------------------------------

// CORSMiddleware returns a middleware that sets CORS headers.
func CORSMiddleware(cors CORSConfig) MiddlewareFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", cors.Origins)
		c.Header("Access-Control-Allow-Methods", cors.Methods)
		c.Header("Access-Control-Allow-Headers", cors.Headers)
		c.Header("Access-Control-Expose-Headers", cors.ExposeHeaders)
		if cors.Credentials {
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		if c.Request.Method == "OPTIONS" {
			c.Status(http.StatusNoContent)
			c.Abort()
			return
		}
		c.Next()
	}
}

// CORSConfig configures the CORS middleware.
type CORSConfig struct {
	Origins       string
	Methods       string
	Headers       string
	ExposeHeaders string
	Credentials   bool
	MaxAge        int
}

// ---------------------------------------------------------------------------
// Request ID Middleware
// ---------------------------------------------------------------------------

// RequestIDMiddleware generates and attaches a unique request ID to each request.
func RequestIDMiddleware() MiddlewareFunc {
	return func(c *gin.Context) {
		rid := c.GetHeader("X-Request-ID")
		if rid == "" {
			rid = generateRequestID()
		}
		c.Set("request_id", rid)
		c.Header("X-Request-ID", rid)
		c.Next()
	}
}

func generateRequestID() string {
	return "req-" + time.Now().UTC().Format("20060102150405")
}

// ---------------------------------------------------------------------------
// Error Handler Middleware
// ---------------------------------------------------------------------------

// ErrorHandlerMiddleware catches panics from handlers and converts them to
// 500 JSON error responses.
func ErrorHandlerMiddleware() MiddlewareFunc {
	return func(c *gin.Context) {
		defer func() {
			if recover() != nil {
				WriteInternalServerError(c, "an unexpected error occurred")
				c.AbortWithStatus(http.StatusInternalServerError)
			}
		}()
		c.Next()
	}
}
