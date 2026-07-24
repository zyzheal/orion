// Package middleware provides Orion-platform-specific Gin middleware and shared
// response helpers used by all handler packages.
package middleware

import (
	"net/http"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
)

// RespondSuccess writes a 200 JSON success response.
func RespondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

// RespondCreated writes a 201 JSON created response.
func RespondCreated(c *gin.Context, data any) {
	errors.WriteCreated(c, data)
}

// RespondNotFound writes a 404 JSON error response.
func RespondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

// RespondBadRequest writes a 400 JSON error response.
func RespondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

// RespondInternalError writes a 500 JSON error response.
func RespondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}

// RespondForbidden writes a 403 JSON error response.
func RespondForbidden(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrForbidden, message, http.StatusForbidden)
}

// RespondConflict writes a 409 JSON error response.
func RespondConflict(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrConflict, message, http.StatusConflict)
}

// RespondServiceUnavailable writes a 503 JSON error response.
func RespondServiceUnavailable(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrServiceUnavailable, message, http.StatusServiceUnavailable)
}

// RespondNoContent writes a 204 No Content response.
func RespondNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// RespondUnauthorized writes a 401 JSON error response.
func RespondUnauthorized(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrUnauthorized, message, http.StatusUnauthorized)
}

// RespondPaginated writes a paginated list response with data, offset, limit, and total.
func RespondPaginated(c *gin.Context, data any, offset, limit, total int) {
	RespondSuccess(c, gin.H{
		"data":   data,
		"offset": offset,
		"limit":  limit,
		"total":  total,
	})
}
