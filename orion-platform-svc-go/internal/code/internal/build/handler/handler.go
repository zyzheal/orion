package handler

import (
	"net/http"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/code/internal/build/service"
)

type BuildHandler struct {
	Service service.BuildService
}

func NewBuildHandler(svc service.BuildService) *BuildHandler {
	return &BuildHandler{Service: svc}
}

func (h *BuildHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/builds", h.StartBuild)
	rg.GET("/builds/:id", h.GetBuild)
	rg.GET("/builds/:id/logs", h.GetBuildLogs)
	rg.POST("/builds/:id/cancel", h.CancelBuild)
	rg.GET("/builds", h.ListBuilds)
}

func (h *BuildHandler) StartBuild(c *gin.Context) {
	c.JSON(http.StatusCreated, gin.H{"code": 0, "message": "success"})
}

func (h *BuildHandler) GetBuild(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *BuildHandler) GetBuildLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *BuildHandler) CancelBuild(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}

func (h *BuildHandler) ListBuilds(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "success"})
}
