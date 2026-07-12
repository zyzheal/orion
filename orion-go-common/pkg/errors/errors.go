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
	"time"

	"orion/go-common/pkg/middleware"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Error code constants (align with Node.js OrionError code strings)
// ---------------------------------------------------------------------------

const (
	ErrBadRequest          = "BAD_REQUEST"
	ErrUnauthorized        = "UNAUTHORIZED"
	ErrForbidden           = "FORBIDDEN"
	ErrNotFound            = "NOT_FOUND"
	ErrConflict            = "CONFLICT"
	ErrValidation          = "VALIDATION_ERROR"
	ErrInternal            = "INTERNAL_ERROR"
	ErrServiceUnavailable  = "SERVICE_UNAVAILABLE"
	ErrTimeout             = "TIMEOUT"
)

// ---------------------------------------------------------------------------
// ResponseEnvelope — canonical API response envelope
// ---------------------------------------------------------------------------

// ResponseEnvelope is the single canonical shape every Go service endpoint
// will return. Success and error responses share one envelope so callers
// (API gateway, frontend, other services) never need to branch on schema.
type ResponseEnvelope struct {
	Success   bool             `json:"success"`
	Data      any              `json:"data,omitempty"`
	Error     string           `json:"error,omitempty"`
	Code      string           `json:"code,omitempty"`
	Details   map[string]any   `json:"details,omitempty"`
	RequestID string           `json:"requestId,omitempty"`
	Timestamp time.Time        `json:"timestamp"`
}

// NewSuccessEnvelope builds a success envelope. Automatically populates
// requestID (if present in the gin context) and the current timestamp.
func NewSuccessEnvelope(c *gin.Context, data any) ResponseEnvelope {
	return ResponseEnvelope{
		Success:   true,
		Data:      data,
		Timestamp: time.Now(),
		RequestID: middleware.GetRequestID(c),
	}
}

// NewErrorEnvelope builds an error envelope. Automatically populates
// requestID (if present in the gin context) and the current timestamp.
// code should be one of the Err* constants above.
func NewErrorEnvelope(c *gin.Context, code, message string, details map[string]any) ResponseEnvelope {
	return ResponseEnvelope{
		Success:   false,
		Error:     message,
		Code:      code,
		Details:   details,
		Timestamp: time.Now(),
		RequestID: middleware.GetRequestID(c),
	}
}

// ---------------------------------------------------------------------------
// WriteJSON — serialise an envelope with the correct HTTP status code
// ---------------------------------------------------------------------------

// statusFromEnvelope returns the HTTP status code for the given envelope.
// In production each service passes the explicit status to WriteJSON so this
// is only used as a fallback.
func statusFromEnvelope(envelope ResponseEnvelope) int {
	if envelope.Success {
		return http.StatusOK
	}
	switch envelope.Code {
	case ErrBadRequest:
		return http.StatusBadRequest
	case ErrUnauthorized:
		return http.StatusUnauthorized
	case ErrForbidden:
		return http.StatusForbidden
	case ErrNotFound:
		return http.StatusNotFound
	case ErrConflict:
		return http.StatusConflict
	}
	return http.StatusInternalServerError
}

// WriteJSON writes the envelope as JSON, using the provided HTTP status code.
// This is the primary helper: every error/success path eventually calls it.
func WriteJSON(c *gin.Context, envelope ResponseEnvelope, status int) {
	if status == 0 {
		status = statusFromEnvelope(envelope)
	}
	c.JSON(status, envelope)
}

// WriteSuccess is a convenience for the common success path.
func WriteSuccess(c *gin.Context, data any) {
	WriteJSON(c, NewSuccessEnvelope(c, data), http.StatusOK)
}

// WriteCreated is a convenience for the common POST-201 path.
func WriteCreated(c *gin.Context, data any) {
	WriteJSON(c, NewSuccessEnvelope(c, data), http.StatusCreated)
}

// WriteError is a convenience for the common error path.
func WriteError(c *gin.Context, code, message string, status int) {
	WriteJSON(c, NewErrorEnvelope(c, code, message, nil), status)
}

// WriteErrorWithDetails is like WriteError but includes structured details.
func WriteErrorWithDetails(c *gin.Context, code, message string, status int, details map[string]any) {
	WriteJSON(c, NewErrorEnvelope(c, code, message, details), status)
}

// ---------------------------------------------------------------------------
// ErrorEnveloper — optional interface services implement for typed errors
// ---------------------------------------------------------------------------

// ErrorEnveloper allows business-layer errors to carry their own envelope.
// Services that want automatic envelope generation should return errors
// implementing this interface.
type ErrorEnveloper interface {
	error
	ErrorEnvelope() ResponseEnvelope
}

// EnvelopeFromError extracts a ResponseEnvelope from an ErrorEnveloper error,
// or returns nil if the error does not implement the interface.
func EnvelopeFromError(err error) *ResponseEnvelope {
	if ee, ok := err.(ErrorEnveloper); ok {
		env := ee.ErrorEnvelope()
		return &env
	}
	return nil
}
