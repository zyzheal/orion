package dr

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Respond writes a success envelope with the given status and data.
func Respond(c *gin.Context, httpStatus int, data interface{}) {
	c.JSON(httpStatus, gin.H{"code": 0, "message": "success", "data": data})
}

// RespondCreated writes a 201-created envelope.
func RespondCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "created", "data": data})
}

// RespondBadRequest writes a 400 error envelope.
func RespondBadRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": msg})
}

// RespondNotFound writes a 404 error envelope.
func RespondNotFound(c *gin.Context, msg string) {
	c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": msg})
}

// RespondInternalError writes a 500 error envelope.
func RespondInternalError(c *gin.Context, msg string) {
	c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": msg})
}
