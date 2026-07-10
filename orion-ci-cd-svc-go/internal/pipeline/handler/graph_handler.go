package handler

import (
	"net/http"

	"orion/ci-cd-svc-go/internal/pipeline/models"
	"orion/ci-cd-svc-go/internal/pipeline/service"
	"orion/go-common/pkg/auth"

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
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Query("pipeline_id")
	if pipelineID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pipeline_id is required"})
		return
	}

	graph, err := h.svc.BuildGraph(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, graph)
}

// ParseYAML parses a pipeline YAML definition into a structured model.
func (h *GraphHandler) ParseYAML(c *gin.Context) {
	var req struct {
		YAML string `json:"yaml" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "yaml field is required"})
		return
	}

	def, err := h.svc.ParseYAML(c.Request.Context(), req.YAML)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, def)
}

// ToYAML converts a pipeline definition to YAML string.
func (h *GraphHandler) ToYAML(c *gin.Context) {
	var def models.PipelineYAMLDef
	if err := c.ShouldBindJSON(&def); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	yamlStr, err := h.svc.ToYAML(c.Request.Context(), &def)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"yaml": yamlStr})
}

// ValidateYAML validates a pipeline YAML definition.
func (h *GraphHandler) ValidateYAML(c *gin.Context) {
	var req struct {
		YAML string `json:"yaml" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "yaml field is required"})
		return
	}

	result, err := h.svc.ValidateYAML(c.Request.Context(), req.YAML)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}