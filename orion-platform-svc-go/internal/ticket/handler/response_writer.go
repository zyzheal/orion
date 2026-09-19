package handler

import (
	"net/http"

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

// respondNotFound writes a canonical NOT_FOUND error envelope.
func respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

// respondBadRequest writes a canonical BAD_REQUEST error envelope.
func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

// respondConflict writes a canonical CONFLICT error envelope.
func respondConflict(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrConflict, message, http.StatusConflict)
}

// respondForbidden writes a canonical FORBIDDEN error envelope.
func respondForbidden(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrForbidden, message, http.StatusForbidden)
}

// respondInternalError writes a canonical INTERNAL_ERROR envelope.
func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}

// tenantFrom reads the caller's tenant id from the auth middleware and refuses
// to serve a request that reached the handler without one. A missing tenant is
// a rejection, not an empty filter: sla_records carries no tenant column of its
// own, so an empty tenantID would make every scoped query return nothing rather
// than the right rows, and the unscoped queries it replaced would have returned
// every tenant's rows.
func tenantFrom(c *gin.Context) (string, bool) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondForbidden(c, "tenant_id is required")
		return "", false
	}
	return tenantID, true
}
