package handler

import (
	"net/http"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
)

// respondBadRequest writes a canonical BAD_REQUEST error envelope.
func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

// respondSuccess writes a canonical success envelope for pipeline responses.
func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

// respondCreated writes a canonical 201-created envelope for pipeline responses.
func respondCreated(c *gin.Context, data any) {
	errors.WriteCreated(c, data)
}

// respondNotFound writes a canonical NOT_FOUND error envelope.
func respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

// respondConflict writes a canonical CONFLICT error envelope.
func respondConflict(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrConflict, message, http.StatusConflict)
}

// respondInternalError writes a canonical INTERNAL_ERROR envelope with optional details.
func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}

// respondValidation writes a canonical VALIDATION_ERROR envelope with field details.
func respondValidation(c *gin.Context, message string, details map[string]any) {
	errors.WriteErrorWithDetails(c, errors.ErrValidation, message, http.StatusBadRequest, details)
}
