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

// respondNoContent writes a 204 No Content response.
func respondNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
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
