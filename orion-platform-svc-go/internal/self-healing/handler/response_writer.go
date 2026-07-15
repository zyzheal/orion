package handler

import "github.com/gin-gonic/gin"

func respondSuccess(c *gin.Context, data any) {
	c.JSON(200, gin.H{"code": 200, "success": true, "data": data})
}

func respondCreated(c *gin.Context, data any) {
	c.JSON(201, gin.H{"code": 201, "success": true, "data": data})
}

func respondNoContent(c *gin.Context) {
	c.Status(204)
}

func respondBadRequest(c *gin.Context, message string) {
	c.JSON(400, gin.H{
		"code":    400,
		"success": false,
		"error": gin.H{
			"code":    "bad_request",
			"message": message,
		},
	})
}

func respondNotFound(c *gin.Context, message string) {
	c.JSON(404, gin.H{
		"code":    404,
		"success": false,
		"error": gin.H{
			"code":    "not_found",
			"message": message,
		},
	})
}

func respondInternalError(c *gin.Context, message string) {
	c.JSON(500, gin.H{
		"code":    500,
		"success": false,
		"error": gin.H{
			"code":    "internal_error",
			"message": message,
		},
	})
}
