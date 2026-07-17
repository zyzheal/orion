package handler

import (
	"orion/platform-svc-go/internal/workflow-dependency/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/workflow-dependencies")

	f.GET("/graph", h.GetGraph)
	f.GET("/check/:definitionId", h.CheckDefinition)
	f.GET("/visualization", h.GetVisualization)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) GetGraph(c *gin.Context) {
	graph, err := h.svc.GetGraph(c.Request.Context())
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, graph)
}

func (h *Handler) CheckDefinition(c *gin.Context) {
	definitionID := c.Param("definitionId")
	result, err := h.svc.CheckDefinition(c.Request.Context(), definitionID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetVisualization(c *gin.Context) {
	data, err := h.svc.GetVisualization(c.Request.Context())
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, data)
}
