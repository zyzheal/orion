package handler

import (
	"go.opentelemetry.io/otel"
	"strconv"

	"orion/platform-svc-go/internal/ci-cd/pipeline/models"
	"orion/platform-svc-go/internal/ci-cd/pipeline/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// BatchHandler provides HTTP handlers for phase group and batch run operations.
type BatchHandler struct {
	svc *service.BatchService
}

func NewBatchHandler(svc *service.BatchService) *BatchHandler {
	return &BatchHandler{svc: svc}
}

// RegisterRoutes registers phase group and batch run routes on the given router group.
func (h *BatchHandler) RegisterRoutes(rg *gin.RouterGroup) {
	// Phase Groups — CRUD + execution
	phaseGroups := rg.Group("/phase-groups")
	{
		phaseGroups.POST("", auth.RequirePermission("pipeline", "write"), h.CreatePhaseGroup)
		phaseGroups.GET("", h.ListPhaseGroups)
		phaseGroups.GET("/:id", h.GetPhaseGroup)
		phaseGroups.PUT("/:id", auth.RequirePermission("pipeline", "write"), h.UpdatePhaseGroup)
		phaseGroups.DELETE("/:id", auth.RequirePermission("pipeline", "delete"), h.DeletePhaseGroup)
		phaseGroups.POST("/:id/start", auth.RequirePermission("pipeline", "execute"), h.StartPhaseGroup)
		phaseGroups.POST("/:id/stop", auth.RequirePermission("pipeline", "execute"), h.StopPhaseGroup)
		phaseGroups.GET("/:id/status", h.GetPhaseGroupStatus)
		phaseGroups.GET("/:id/runs", h.ListPhaseGroupRuns)
	}

	// Batch Runs
	batchRuns := rg.Group("/batch-runs")
	{
		batchRuns.POST("", auth.RequirePermission("pipeline", "write"), h.CreateBatchRun)
		batchRuns.GET("", h.ListBatchRuns)
		batchRuns.POST("/:id/start", auth.RequirePermission("pipeline", "execute"), h.StartBatchRun)
		batchRuns.POST("/:id/stop", auth.RequirePermission("pipeline", "execute"), h.StopBatchRun)
	}
}

// ==================== Phase Group Handlers ====================

// CreatePhaseGroup creates a new phase group.
func (h *BatchHandler) CreatePhaseGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchCreatePhaseGroup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.CreatePhaseGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	pg, err := h.svc.CreatePhaseGroup(ctx, tenantID, req, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, pg)
}

// ListPhaseGroups lists phase groups for the tenant.
func (h *BatchHandler) ListPhaseGroups(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchListPhaseGroups")
	defer span.End()
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

	groups, err := h.svc.ListPhaseGroups(ctx, tenantID, offset, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, groups)
}

// GetPhaseGroup returns a phase group by ID.
func (h *BatchHandler) GetPhaseGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchGetPhaseGroup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	pg, err := h.svc.GetPhaseGroup(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, "phase group not found")
		return
	}

	respondSuccess(c, pg)
}

// UpdatePhaseGroup updates a phase group.
func (h *BatchHandler) UpdatePhaseGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchUpdatePhaseGroup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdatePhaseGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	pg, err := h.svc.UpdatePhaseGroup(ctx, tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, pg)
}

// DeletePhaseGroup deletes a phase group.
func (h *BatchHandler) DeletePhaseGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchDeletePhaseGroup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DeletePhaseGroup(ctx, tenantID, id); err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "deleted"})
}

// StartPhaseGroup starts a phase group execution.
func (h *BatchHandler) StartPhaseGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchStartPhaseGroup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	run, err := h.svc.StartPhaseGroup(ctx, tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, run)
}

// StopPhaseGroup stops a running phase group execution.
func (h *BatchHandler) StopPhaseGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchStopPhaseGroup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	run, err := h.svc.StopPhaseGroup(ctx, tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, run)
}

// GetPhaseGroupStatus returns the latest run status for a phase group.
func (h *BatchHandler) GetPhaseGroupStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchGetPhaseGroupStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	run, err := h.svc.GetPhaseGroupStatus(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, "no status found")
		return
	}

	respondSuccess(c, run)
}

// ListPhaseGroupRuns lists execution records for a phase group.
func (h *BatchHandler) ListPhaseGroupRuns(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchListPhaseGroupRuns")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	groupID := c.Param("id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	runs, err := h.svc.ListPhaseGroupRuns(ctx, tenantID, groupID, offset, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, runs)
}

// ==================== Batch Run Handlers ====================

// CreateBatchRun creates a new batch run.
func (h *BatchHandler) CreateBatchRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchCreateBatchRun")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateBatchRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.CreateBatchRun(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, run)
}

// ListBatchRuns lists batch runs for the tenant.
func (h *BatchHandler) ListBatchRuns(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchListBatchRuns")
	defer span.End()
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

	runs, err := h.svc.ListBatchRuns(ctx, tenantID, offset, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, runs)
}

// StartBatchRun starts a batch run execution.
func (h *BatchHandler) StartBatchRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchStartBatchRun")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("id")

	run, err := h.svc.StartBatchRun(ctx, tenantID, runID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, run)
}

// StopBatchRun stops a running batch run.
func (h *BatchHandler) StopBatchRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineBatchStopBatchRun")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("id")

	run, err := h.svc.StopBatchRun(ctx, tenantID, runID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, run)
}
