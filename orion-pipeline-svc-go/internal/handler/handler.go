package handler

import (
	"net/http"
	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/repository"
	"orion/pipeline-svc-go/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type Handler struct {
	svc    *service.PipelineService
	logger *zap.Logger
}

func New(db *sqlx.DB, logger *zap.Logger) *Handler {
	pipelineRepo := repository.NewPipelineRepository(db)
	runRepo := repository.NewRunRepository(db)
	stageRepo := repository.NewStageRepository(db)
	svc := service.NewPipelineService(pipelineRepo, runRepo, stageRepo)
	return &Handler{svc: svc, logger: logger}
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func (h *Handler) err(c *gin.Context, code int, message string) {
	c.JSON(code, Response{Code: code, Message: message})
}

func (h *Handler) tenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if header := c.GetHeader("X-Tenant-ID"); header != "" {
		tenantID = header
	}
	if tenantID == "" {
		tenantID = "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) paginated(c *gin.Context) (offset, limit int) {
	var p models.PaginatedRequest
	_ = c.ShouldBindQuery(&p)
	return p.Offset(), p.Limit()
}

// ListPipelines GET /api/v1/pipelines
func (h *Handler) ListPipelines(c *gin.Context) {
	tenantID := h.tenantID(c)
	offset, limit := h.paginated(c)

	pipelines, err := h.svc.List(c.Request.Context(), tenantID, offset, limit)
	if err != nil {
		h.logger.Error("failed to list pipelines", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, pipelines)
}

// CreatePipeline POST /api/v1/pipelines
func (h *Handler) CreatePipeline(c *gin.Context) {
	var req models.Pipeline
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	req.TenantID = h.tenantID(c)

	if err := h.svc.Create(c.Request.Context(), &req); err != nil {
		h.logger.Error("failed to create pipeline", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, req)
}

// GetPipeline GET /api/v1/pipelines/:id
func (h *Handler) GetPipeline(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	pipeline, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		h.err(c, http.StatusNotFound, "pipeline not found")
		return
	}
	h.success(c, pipeline)
}

// UpdatePipeline PUT /api/v1/pipelines/:id
func (h *Handler) UpdatePipeline(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	var req models.Pipeline
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	req.ID = id
	req.TenantID = tenantID

	if err := h.svc.Update(c.Request.Context(), &req); err != nil {
		h.logger.Error("failed to update pipeline", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, req)
}

// DeletePipeline DELETE /api/v1/pipelines/:id
func (h *Handler) DeletePipeline(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		h.logger.Error("failed to delete pipeline", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "pipeline deleted"})
}

// TriggerRun POST /api/v1/pipelines/:id/run
func (h *Handler) TriggerRun(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)
	triggerBy := c.GetString("user_id")

	run, err := h.svc.TriggerRun(c.Request.Context(), tenantID, id, "manual", triggerBy)
	if err != nil {
		h.err(c, http.StatusNotFound, "pipeline not found")
		return
	}
	h.success(c, run)
}

// ListRuns GET /api/v1/pipelines/:id/runs
func (h *Handler) ListRuns(c *gin.Context) {
	id := c.Param("id")
	offset, limit := h.paginated(c)

	runs, err := h.svc.ListRuns(c.Request.Context(), id, offset, limit)
	if err != nil {
		h.logger.Error("failed to list runs", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, runs)
}

// GetRun GET /api/v1/runs/:id
func (h *Handler) GetRun(c *gin.Context) {
	id := c.Param("id")

	run, err := h.svc.GetRunByID(c.Request.Context(), id)
	if err != nil {
		h.err(c, http.StatusNotFound, "run not found")
		return
	}
	h.success(c, run)
}

// GetStages GET /api/v1/runs/:id/stages
func (h *Handler) GetStages(c *gin.Context) {
	runID := c.Param("id")

	stages, err := h.svc.GetStages(c.Request.Context(), runID)
	if err != nil {
		h.err(c, http.StatusNotFound, "stages not found")
		return
	}
	h.success(c, stages)
}
