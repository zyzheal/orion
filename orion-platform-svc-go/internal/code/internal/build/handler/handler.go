package handler

import (
	"fmt"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/code/internal/build/service"
	"orion/platform-svc-go/internal/middleware"
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
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartBuild")
	defer span.End()
	var req struct {
		RepoID string `json:"repo_id"`
		Branch string `json:"branch"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid request body"})
		return
	}
	result, err := h.Service.StartBuild(c.Request.Context(), req.RepoID, req.Branch)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *BuildHandler) GetBuild(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuild")
	defer span.End()
	id := c.Param("id")
	result, err := h.Service.GetBuild(c.Request.Context(), id)
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *BuildHandler) GetBuildLogs(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuildLogs")
	defer span.End()
	id := c.Param("id")
	result, err := h.Service.GetBuild(c.Request.Context(), id)
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	logs := ""
	if m, ok := result.(map[string]interface{}); ok {
		if v, ok := m["logs"]; ok {
			logs = fmt.Sprintf("%v", v)
		}
	}
	middleware.RespondSuccess(c, gin.H{"id": id, "logs": logs})
}

func (h *BuildHandler) CancelBuild(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CancelBuild")
	defer span.End()
	id := c.Param("id")
	if err := h.Service.CancelBuild(c.Request.Context(), id); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "build cancelled"})
}

func (h *BuildHandler) ListBuilds(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuilds")
	defer span.End()
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	result, err := h.Service.ListBuilds(c.Request.Context(), page, size)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	middleware.RespondSuccess(c, result)
}
