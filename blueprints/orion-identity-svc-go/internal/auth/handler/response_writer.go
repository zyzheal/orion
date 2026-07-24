package handler

import (
	"net/http"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
)

// ------ *Handler methods ------

// RespondSuccess writes a canonical success envelope for auth responses.
func (h *Handler) respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

// RespondCreated writes a canonical 201-created envelope for user creation.
func (h *Handler) respondCreated(c *gin.Context, data any) {
	errors.WriteCreated(c, data)
}

// RespondNotFound writes a canonical NOT_FOUND error envelope.
func (h *Handler) respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

// RespondUnauthorized writes a canonical UNAUTHORIZED envelope (login/token failures).
func (h *Handler) respondUnauthorized(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrUnauthorized, message, http.StatusUnauthorized)
}

// RespondForbidden writes a canonical FORBIDDEN error envelope.
func (h *Handler) respondForbidden(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrForbidden, message, http.StatusForbidden)
}

// RespondBadRequest writes a canonical BAD_REQUEST error envelope.
func (h *Handler) respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

// RespondInternalError writes a canonical INTERNAL_ERROR envelope.
func (h *Handler) respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}

// ------ *PermissionHandler methods ------

func (h *PermissionHandler) respondSuccess(c *gin.Context, data any)        { errors.WriteSuccess(c, data) }
func (h *PermissionHandler) respondCreated(c *gin.Context, data any)        { errors.WriteCreated(c, data) }
func (h *PermissionHandler) respondNotFound(c *gin.Context, msg string)     { errors.WriteError(c, errors.ErrNotFound, msg, http.StatusNotFound) }
func (h *PermissionHandler) respondBadRequest(c *gin.Context, msg string)   { errors.WriteError(c, errors.ErrBadRequest, msg, http.StatusBadRequest) }
func (h *PermissionHandler) respondInternalError(c *gin.Context, msg string) { errors.WriteError(c, errors.ErrInternal, msg, http.StatusInternalServerError) }

// ------ *MFAHandler methods ------

func (h *MFAHandler) respondSuccess(c *gin.Context, data any)              { errors.WriteSuccess(c, data) }
func (h *MFAHandler) respondBadRequest(c *gin.Context, msg string)         { errors.WriteError(c, errors.ErrBadRequest, msg, http.StatusBadRequest) }
func (h *MFAHandler) respondUnauthorized(c *gin.Context, msg string)       { errors.WriteError(c, errors.ErrUnauthorized, msg, http.StatusUnauthorized) }
func (h *MFAHandler) respondForbidden(c *gin.Context, msg string)          { errors.WriteError(c, errors.ErrForbidden, msg, http.StatusForbidden) }
func (h *MFAHandler) respondInternalError(c *gin.Context, msg string)      { errors.WriteError(c, errors.ErrInternal, msg, http.StatusInternalServerError) }

// ------ *KeyRotationHandler methods ------

func (h *KeyRotationHandler) respondSuccess(c *gin.Context, data any)              { errors.WriteSuccess(c, data) }
func (h *KeyRotationHandler) respondCreated(c *gin.Context, data any)              { errors.WriteCreated(c, data) }
func (h *KeyRotationHandler) respondInternalError(c *gin.Context, msg string)      { errors.WriteError(c, errors.ErrInternal, msg, http.StatusInternalServerError) }

// ------ *LoginAttemptHandler methods ------

func (h *LoginAttemptHandler) respondSuccess(c *gin.Context, data any)             { errors.WriteSuccess(c, data) }
func (h *LoginAttemptHandler) respondBadRequest(c *gin.Context, msg string)        { errors.WriteError(c, errors.ErrBadRequest, msg, http.StatusBadRequest) }
func (h *LoginAttemptHandler) respondForbidden(c *gin.Context, msg string)         { errors.WriteError(c, errors.ErrForbidden, msg, http.StatusForbidden) }
func (h *LoginAttemptHandler) respondInternalError(c *gin.Context, msg string)     { errors.WriteError(c, errors.ErrInternal, msg, http.StatusInternalServerError) }
func (h *LoginAttemptHandler) respondTooManyRequests(c *gin.Context, data map[string]any)   { c.JSON(http.StatusTooManyRequests, errors.NewErrorEnvelope(c, "", "", data)) }
