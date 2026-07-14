package handler

import (
	"net/http"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Canonical response helpers
// ---------------------------------------------------------------------------

func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

func respondCreated(c *gin.Context, data any) {
	errors.WriteCreated(c, data)
}

func respondNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

func respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}

func respondConflict(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrConflict, message, http.StatusConflict)
}

// respondPaginated writes a paginated response envelope with data/total/offset/limit.
func respondPaginated(c *gin.Context, data any, offset, limit, total int) {
	errors.WriteSuccess(c, gin.H{
		"data":   data,
		"total":  total,
		"offset": offset,
		"limit":  limit,
	})
}
