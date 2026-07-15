package handler

import (
	"net/http"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
)

// getTenantID extracts tenant_id from Gin context with a fallback zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// getUserID extracts user_id from Gin context.
func (h *Handler) getUserID(c *gin.Context) string {
	return c.GetString("user_id")
}

// respondSuccess writes a canonical SUCCESS envelope.
func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

// respondBadRequest writes a canonical BAD_REQUEST error envelope.
func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

// respondInternalError writes a canonical INTERNAL_ERROR envelope (with fixed message).
func respondInternalError(c *gin.Context, _ string) {
	errors.WriteError(c, errors.ErrInternal, "internal server error", http.StatusInternalServerError)
}

// respondNotFound writes a canonical NOT_FOUND error envelope.
func respondNotFound(c *gin.Context) {
	errors.WriteError(c, errors.ErrNotFound, "resource not found", http.StatusNotFound)
}
