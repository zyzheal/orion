package handler

import (
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
)

// respondSuccess writes a canonical success envelope.
func respondSuccess(c *gin.Context, data any) {
	middleware.RespondSuccess(c, data)
}

// respondCreated writes a canonical 201-created envelope.
func respondCreated(c *gin.Context, data any) {
	middleware.RespondCreated(c, data)
}

// respondNotFound writes a canonical NOT_FOUND error envelope.
func respondNotFound(c *gin.Context, message string) {
	middleware.RespondNotFound(c, message)
}

// respondBadRequest writes a canonical BAD_REQUEST error envelope.
func respondBadRequest(c *gin.Context, message string) {
	middleware.RespondBadRequest(c, message)
}

// respondConflict writes a canonical CONFLICT error envelope.
func respondConflict(c *gin.Context, message string) {
	middleware.RespondConflict(c, message)
}

// respondForbidden writes a canonical FORBIDDEN error envelope.
func respondForbidden(c *gin.Context, message string) {
	middleware.RespondForbidden(c, message)
}

// respondInternalError writes a canonical INTERNAL_ERROR envelope.
func respondInternalError(c *gin.Context, message string) {
	middleware.RespondInternalError(c, message)
}
