package handler

import (
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// errors is a local alias exposing the project-wide response helpers under the
// name used throughout this handler.  These are thin wrappers around the
// canonical middleware package so existing generated code does not need changes.
type errorsAlias struct{}

var errors = errorsAlias{}

func (errorsAlias) WriteSuccessBadRequest(c *gin.Context, message string) {
	middleware.RespondBadRequest(c, message)
}

func (errorsAlias) WriteSuccessInternalError(c *gin.Context, message string) {
	middleware.RespondInternalError(c, message)
}

func (errorsAlias) WriteSuccessNotFound(c *gin.Context, message string) {
	middleware.RespondNotFound(c, message)
}

func (errorsAlias) WriteSuccessCreated(c *gin.Context, data any) {
	middleware.RespondCreated(c, data)
}

func (errorsAlias) WriteSuccess(c *gin.Context, status int, data any) {
	c.JSON(status, gin.H{"code": status, "data": data, "message": "ok"})
}

func (errorsAlias) RespondBadRequest(c *gin.Context, message string) {
	middleware.RespondBadRequest(c, message)
}

func (errorsAlias) RespondInternalError(c *gin.Context, message string) {
	middleware.RespondInternalError(c, message)
}

func (errorsAlias) RespondNotFound(c *gin.Context, message string) {
	middleware.RespondNotFound(c, message)
}
