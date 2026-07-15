package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func respondSuccess(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{
		"code":    http.StatusOK,
		"success": true,
		"data":    data,
	})
}

func respondCreated(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, gin.H{
		"code":    http.StatusCreated,
		"success": true,
		"data":    data,
	})
}

func respondNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

func respondBadRequest(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, gin.H{
		"code":    http.StatusBadRequest,
		"success": false,
		"error": gin.H{
			"code":    "bad_request",
			"message": message,
		},
	})
}

func respondNotFound(c *gin.Context, message string) {
	c.JSON(http.StatusNotFound, gin.H{
		"code":    http.StatusNotFound,
		"success": false,
		"error": gin.H{
			"code":    "not_found",
			"message": message,
		},
	})
}

func respondInternalError(c *gin.Context, message string) {
	c.JSON(http.StatusInternalServerError, gin.H{
		"code":    http.StatusInternalServerError,
		"success": false,
		"error": gin.H{
			"code":    "internal_error",
			"message": message,
		},
	})
}
