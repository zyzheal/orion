package handler

import (
	"net/http"

	"orion/platform-svc-go/internal/code/build/service"

	"github.com/gin-gonic/gin"
)

// BuildHandler handles build-related HTTP endpoints.
type BuildHandler struct {
	Service service.BuildService
}

// NewBuildHandler creates a new BuildHandler.
func NewBuildHandler(svc service.BuildService) *BuildHandler {
	return &BuildHandler{Service: svc}
}

// RegisterRoutes registers all build endpoints under the given group.
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
