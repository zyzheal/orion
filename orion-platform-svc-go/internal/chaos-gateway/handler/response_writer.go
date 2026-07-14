package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// respondSuccess sends a 200 response with data.
func respondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{
		"ok":   true,
		"data": data,
	})
}

// respondCreated sends a 201 response with data.
func respondCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{
		"ok":   true,
		"data": data,
	})
}

// respondNoContent sends a 204 response with no body.
func respondNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// respondBadRequest sends a 400 response with error message.
func respondBadRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, gin.H{
		"ok":    false,
		"error": gin.H{
			"code":    http.StatusBadRequest,
			"type":    "BadRequest",
			"message": msg,
		},
	})
}

// respondNotFound sends a 404 response with error message.
func respondNotFound(c *gin.Context, msg string) {
	c.JSON(http.StatusNotFound, gin.H{
		"ok":    false,
		"error": gin.H{
			"code":    http.StatusNotFound,
			"type":    "NotFound",
			"message": msg,
		},
	})
}

// respondConflict sends a 409 response with error message.
func respondConflict(c *gin.Context, msg string) {
	c.JSON(http.StatusConflict, gin.H{
		"ok":    false,
		"error": gin.H{
			"code":    http.StatusConflict,
			"type":    "Conflict",
			"message": msg,
		},
	})
}

// respondInternalError sends a 500 response with error message.
func respondInternalError(c *gin.Context, msg string) {
	c.JSON(http.StatusInternalServerError, gin.H{
		"ok":    false,
		"error": gin.H{
			"code":    http.StatusInternalServerError,
			"type":    "InternalError",
			"message": msg,
		},
	})
}

// respondPaginated sends a paginated list response.
func respondPaginated(c *gin.Context, data interface{}, offset, limit, total int) {
	respondSuccess(c, gin.H{
		"data":   data,
		"offset": offset,
		"limit":  limit,
		"total":  total,
	})
}
