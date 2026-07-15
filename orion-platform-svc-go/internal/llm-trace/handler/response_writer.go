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
