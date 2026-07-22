package handler

import (
	"context"

	"orion/platform-svc-go/internal/workflow-dependency/models"
	"orion/platform-svc-go/internal/workflow-dependency/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"orion/go-common/pkg/auth"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	GetGraph(ctx context.Context, tenantID string) (*models.DependencyGraph, error)
	CheckDefinition(ctx context.Context, definitionID, tenantID string) (*models.DependencyCheck, error)
	GetVisualization(ctx context.Context, tenantID string) (*models.VisualizationData, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/workflow-dependencies")

	f.GET("/graph", auth.RequirePermission("workflow-dependency", "read"), h.GetGraph)
	f.GET("/check/:definitionId", auth.RequirePermission("workflow-dependency", "read"), h.CheckDefinition)
	f.GET("/visualization", auth.RequirePermission("workflow-dependency", "read"), h.GetVisualization)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

func (h *Handler) GetGraph(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGraph")
	defer span.End()
	graph, err := h.svc.GetGraph(ctx, h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, graph)
}

func (h *Handler) CheckDefinition(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckDefinition")
	defer span.End()
	definitionID := c.Param("definitionId")
	result, err := h.svc.CheckDefinition(ctx, definitionID, h.getTenantID(c))
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetVisualization")
	defer span.End()
	data, err := h.svc.GetVisualization(ctx, h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, data)
}
