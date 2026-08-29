package handler

import (
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ci-cd/pipeline/models"
	"orion/platform-svc-go/internal/ci-cd/pipeline/service"

	"github.com/gin-gonic/gin"
)

// GraphHandler provides HTTP handlers for pipeline graph and YAML conversion operations.
type GraphHandler struct {
	svc *service.GraphService
}

func NewGraphHandler(svc *service.GraphService) *GraphHandler {
	return &GraphHandler{svc: svc}
}

func (h *GraphHandler) RegisterRoutes(rg *gin.RouterGroup) {
	graph := rg.Group("/pipeline-graph")
	{
		graph.GET("", h.BuildGraph)
		graph.POST("/parse-yaml", auth.RequirePermission("pipeline", "read"), h.ParseYAML)
		graph.POST("/to-yaml", auth.RequirePermission("pipeline", "write"), h.ToYAML)
		graph.POST("/validate", auth.RequirePermission("pipeline", "write"), h.ValidateYAML)
	}
}

// BuildGraph constructs a dependency graph from a pipeline.
func (h *GraphHandler) BuildGraph(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBuildGraph")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Query("pipeline_id")
	if pipelineID == "" {
		respondBadRequest(c, "pipeline_id is required")
		return
	}

	graph, err := h.svc.BuildGraph(ctx, tenantID, pipelineID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, graph)
}

// ParseYAML parses a pipeline YAML definition into a structured model.
func (h *GraphHandler) ParseYAML(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineParseYAML")
	defer span.End()
	var req struct {
		YAML string `json:"yaml" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "yaml field is required")
		return
	}

	def, err := h.svc.ParseYAML(ctx, req.YAML)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	respondSuccess(c, def)
}

// ToYAML converts a pipeline definition to YAML string.
func (h *GraphHandler) ToYAML(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineToYAML")
	defer span.End()
	var def models.PipelineYAMLDef
	if err := c.ShouldBindJSON(&def); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	yamlStr, err := h.svc.ToYAML(ctx, &def)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"yaml": yamlStr})
}

// ValidateYAML validates a pipeline YAML definition.
func (h *GraphHandler) ValidateYAML(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineValidateYAML")
	defer span.End()
	var req struct {
		YAML string `json:"yaml" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "yaml field is required")
		return
	}

	result, err := h.svc.ValidateYAML(ctx, req.YAML)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, result)
}
