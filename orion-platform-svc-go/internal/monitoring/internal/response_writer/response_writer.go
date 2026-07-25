package response_writer

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
)

// Respond writes a JSON response with the given status code and data.
func Respond(c *gin.Context, status int, data any) {
	c.JSON(status, gin.H{"success": true, "data": data})
}

// RespondSuccess writes a canonical success envelope.
func RespondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

// RespondCreated writes a canonical 201-created envelope.
func RespondCreated(c *gin.Context, data any) {
	errors.WriteCreated(c, data)
}

// RespondNotFound writes a canonical NOT_FOUND error envelope.
func RespondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

// RespondBadRequest writes a canonical BAD_REQUEST error envelope.
func RespondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

// RespondConflict writes a canonical CONFLICT error envelope.
func RespondConflict(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrConflict, message, http.StatusConflict)
}

// RespondForbidden writes a canonical FORBIDDEN error envelope.
func RespondForbidden(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrForbidden, message, http.StatusForbidden)
}

// RespondInternalError writes a canonical INTERNAL_ERROR envelope.
func RespondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}
