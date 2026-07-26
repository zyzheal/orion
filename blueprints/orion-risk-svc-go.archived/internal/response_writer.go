package internal

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Respond(c *gin.Context, httpStatus int, data interface{}) {
	c.JSON(httpStatus, gin.H{"code": 0, "message": "success", "data": data})
}

func RespondCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": data})
}

func RespondBadRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": msg})
}

func RespondNotFound(c *gin.Context, msg string) {
	c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": msg})
}

func RespondInternalError(c *gin.Context, msg string) {
	c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": msg})
}
