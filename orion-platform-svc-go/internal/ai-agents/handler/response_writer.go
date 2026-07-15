package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
)

// respondSuccess writes a canonical success envelope.
func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

// respondCreated writes a canonical 201-created envelope.
func respondCreated(c *gin.Context, data any) {
	errors.WriteCreated(c, data)
}

// respondNoContent writes a 204 No Content response.
func respondNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// respondBadRequest writes a canonical BAD_REQUEST error envelope.
func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

// respondNotFound writes a canonical NOT_FOUND error envelope.
func respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

// respondConflict writes a canonical CONFLICT error envelope.
func respondConflict(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrConflict, message, http.StatusConflict)
}

// respondUnauthorized writes a canonical UNAUTHORIZED error envelope.
func respondUnauthorized(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrUnauthorized, message, http.StatusUnauthorized)
}

// respondForbidden writes a canonical FORBIDDEN error envelope.
func respondForbidden(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrForbidden, message, http.StatusForbidden)
}

// respondInternalError writes a canonical INTERNAL_ERROR envelope.
func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}

// getPaginationParams extracts and validates page/limit query params.
// Defaults: page=1, limit=20, maxLimit=100.
func getPaginationParams(c *gin.Context) (int, int) {
	limitStr := c.Query("limit")
	offsetStr := c.Query("offset")

	limit := 20
	offset := 0

	if limitStr != "" {
		l, err := strconv.Atoi(limitStr)
		if err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	if offsetStr != "" {
		o, err := strconv.Atoi(offsetStr)
		if err == nil && o >= 0 {
			offset = o
		}
	}

	return offset, limit
}
