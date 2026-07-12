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

// respondInternalError writes a canonical INTERNAL_ERROR envelope.
func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}

// respondConflict writes a canonical CONFLICT error envelope.
func respondConflict(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrConflict, message, http.StatusConflict)
}

// respondForbidden writes a canonical FORBIDDEN error envelope.
func respondForbidden(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrForbidden, message, http.StatusForbidden)
}
