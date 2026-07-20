package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-graph/models"
	"orion/platform-svc-go/internal/pipeline-graph/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all pipeline-graph endpoints under the given group.
// Mirrors /api/v1/pipelines/graph routes from the TS source (4 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/pipelines")

	// GET /pipelines/:id/graph - Build graph from saved pipeline
	f.GET("/:id/graph", auth.RequirePermission("pipeline", "read"), h.GetGraph)

	// POST /pipelines/parse-yaml - Parse YAML to JSON graph
	f.POST("/parse-yaml", auth.RequirePermission("pipeline", "write"), h.ParseYaml)

	// POST /pipelines/to-yaml - Convert JSON graph to YAML
	f.POST("/to-yaml", auth.RequirePermission("pipeline", "write"), h.ToYaml)

	// POST /pipelines/validate - Validate YAML pipeline spec
	f.POST("/validate", auth.RequirePermission("pipeline", "write"), h.Validate)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// GetGraph handles GET /pipelines/:id/graph.
func (h *Handler) GetGraph(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGraph")
	defer span.End()
	id := c.Param("id")

	pipeline, err := h.svc.GetPipeline(ctx, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	graph, err := h.svc.BuildGraph(id, pipeline.YamlContent)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, models.GraphResponse{
		PipelineID:   id,
		PipelineName: pipeline.Name,
		Graph:        *graph,
	})
}

// ParseYaml handles POST /pipelines/parse-yaml.
func (h *Handler) ParseYaml(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ParseYaml")
	defer span.End()
	var req models.YamlParseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	resp, err := h.svc.YamlToJson(req.YamlDefinition)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, resp)
}

// ToYaml handles POST /pipelines/to-yaml.
func (h *Handler) ToYaml(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ToYaml")
	defer span.End()
	var req models.YamlToJsonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	resp, err := h.svc.JsonToYaml(req.Graph)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, resp)
}

// Validate handles POST /pipelines/validate.
func (h *Handler) Validate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Validate")
	defer span.End()
	var req models.ValidateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	resp, err := h.svc.Validate(req.YamlDefinition)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, resp)
}
