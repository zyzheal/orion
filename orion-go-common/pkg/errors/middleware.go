// Package errors provides a canonical API response envelope for all Orion Go
// microservices, replacing the per-handler inconsistency where some handlers
// used gin.H{"error": ...}, others used gin.H{"code": int, "message": ...},
// and the incident service used a custom struct {Code int, Message string, Data any}.
//
// The canonical shape mirrors the Node.js platform-service envelope:
//
//	{"success": true, "data": ..., "error": "", "code": "", "details": null,
//	 "requestId": "", "timestamp": "..."}
//
// Services should not change their existing handlers immediately — the per-
// service response_writer.go files provide additive helpers that can be adopted
// incrementally.
package errors

import (
	"net/http"
	"runtime/debug"
	"time"

	"orion/go-common/pkg/middleware"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ErrorRecovery is a gin recovery middleware that catches panics and returns
// a structured ResponseEnvelope instead of the raw gin.H used by the old
// middleware.Recovery. It also integrates with RequestID middleware so the
// requestId field is populated in the error envelope.
func ErrorRecovery(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				requestID := middleware.GetRequestID(c)
				stack := string(debug.Stack())
				logger.Error("panic recovered",
					zap.Any("error", r),
					zap.String("method", c.Request.Method),
					zap.String("path", c.Request.URL.Path),
					zap.String("request_id", requestID),
					zap.String("stack", stack),
				)

				envelope := ResponseEnvelope{
					Success:   false,
					Error:     "internal server error",
					Code:      ErrInternal,
					RequestID: requestID,
					Timestamp: time.Now(),
				}

				c.AbortWithStatusJSON(http.StatusInternalServerError, envelope)
			}
		}()
		c.Next()
	}
}
