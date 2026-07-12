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

func respondForbidden(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrForbidden, message, http.StatusForbidden)
}

func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}
