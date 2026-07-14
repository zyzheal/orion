package handler

import (
	"net/http"
        "strconv"

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

func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}

func parseInt(s string, fallback int) (int, error) {
	n, err := strconv.Atoi(s)
	if err != nil {
		return fallback, err
	}
	return n, nil
}
