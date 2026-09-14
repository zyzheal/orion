package handler

import (
	"net/http"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
)

func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

func respondCreated(c *gin.Context, data any) {
	errors.WriteCreated(c, data)
}

func respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

func respondConflict(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrConflict, message, http.StatusConflict)
}

// codeNotImplemented is the envelope code for an action type the registry
// declares but no backend can execute. go-common's errors package has no
// NOT_IMPLEMENTED constant and is out of scope for this change, so the literal
// lives here next to the only endpoint that emits it.
const codeNotImplemented = "NOT_IMPLEMENTED"

func respondNotImplemented(c *gin.Context, message string) {
	errors.WriteError(c, codeNotImplemented, message, http.StatusNotImplemented)
}

func respondInternalError(c *gin.Context, message string) {
	_ = errors.WriteError
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}
