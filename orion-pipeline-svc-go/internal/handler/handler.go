package handler

import (
	"net/http"
	"strconv"

	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for pipeline operations.
type Handler struct {
	svc *service.PipelineService
}

func NewHandler(svc *service.PipelineService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers pipeline routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	pipelines := rg.Group("/pipelines")
	{
		pipelines.POST("", h.CreatePipeline)
		pipelines.GET("", h.ListPipelines)
		pipelines.GET("/:id", h.GetPipeline)
		pipelines.POST("/:id/runs", h.TriggerRun)
	}

	runs := rg.Group("/runs")
	{
		runs.GET("/:id", h.GetRun)
		runs.GET("/:id/stages", h.GetRunStages)
	}
}

func (h *Handler) CreatePipeline(c *gin.Context) {
	var pipeline models.Pipeline
	if err := c.ShouldBindJSON(&pipeline); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pipeline.TenantID = c.GetString("tenant_id")
	if err := h.svc.Create(c.Request.Context(), &pipeline); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, pipeline)
}

func (h *Handler) GetPipeline(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	pipeline, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "pipeline not found"})
		return
	}

	c.JSON(http.StatusOK, pipeline)
}

func (h *Handler) ListPipelines(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	pipelines, err := h.svc.List(c.Request.Context(), tenantID, offset, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": pipelines})
}

func (h *Handler) TriggerRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	triggeredBy := c.GetString("user_id")
	pipelineID := c.Param("id")

	var req struct {
		TriggerType string `json:"trigger_type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.TriggerType = "manual"
	}
	if req.TriggerType == "" {
		req.TriggerType = "manual"
	}

	run, err := h.svc.TriggerRun(c.Request.Context(), tenantID, pipelineID, req.TriggerType, triggeredBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, run)
}

func (h *Handler) GetRun(c *gin.Context) {
	id := c.Param("id")

	run, err := h.svc.GetRunByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}

	c.JSON(http.StatusOK, run)
}

func (h *Handler) GetRunStages(c *gin.Context) {
	runID := c.Param("id")

	stages, err := h.svc.GetStages(c.Request.Context(), runID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": stages})
}
