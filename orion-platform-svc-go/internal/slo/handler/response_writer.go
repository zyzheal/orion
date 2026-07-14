package handler

import "github.com/gin-gonic/gin"

func respondSuccess(c *gin.Context, data any) {
	c.JSON(200, gin.H{"success": true, "data": data})
}

func respondCreated(c *gin.Context, data any) {
	c.JSON(201, gin.H{"success": true, "data": data})
}

func respondNotFound(c *gin.Context, message string) {
	c.JSON(404, gin.H{"success": false, "error": message})
}

func respondBadRequest(c *gin.Context, message string) {
	c.JSON(400, gin.H{"success": false, "error": message})
}

func respondInternalError(c *gin.Context, message string) {
	c.JSON(500, gin.H{"success": false, "error": message})
}
