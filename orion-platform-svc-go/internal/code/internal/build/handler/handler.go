package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"net/http"
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
	middleware.RespondCreated(c, gin.H{"message": "success"})
}

func (h *BuildHandler) GetBuild(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuild")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"message": "success"})
}

func (h *BuildHandler) GetBuildLogs(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuildLogs")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"message": "success"})
}

func (h *BuildHandler) CancelBuild(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CancelBuild")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"message": "success"})
}

func (h *BuildHandler) ListBuilds(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuilds")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"message": "success"})
}
