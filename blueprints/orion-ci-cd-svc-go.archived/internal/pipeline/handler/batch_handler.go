package handler

import (
	"strconv"

	"orion/ci-cd-svc-go/internal/pipeline/models"
	"orion/ci-cd-svc-go/internal/pipeline/service"

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
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.CreatePhaseGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	pg, err := h.svc.CreatePhaseGroup(c.Request.Context(), tenantID, req, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, pg)
}

// ListPhaseGroups lists phase groups for the tenant.
func (h *BatchHandler) ListPhaseGroups(c *gin.Context) {
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

	groups, err := h.svc.ListPhaseGroups(c.Request.Context(), tenantID, offset, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, groups)
}

// GetPhaseGroup returns a phase group by ID.
func (h *BatchHandler) GetPhaseGroup(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	pg, err := h.svc.GetPhaseGroup(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "phase group not found")
		return
	}

	respondSuccess(c, pg)
}

// UpdatePhaseGroup updates a phase group.
func (h *BatchHandler) UpdatePhaseGroup(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdatePhaseGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	pg, err := h.svc.UpdatePhaseGroup(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, pg)
}

// DeletePhaseGroup deletes a phase group.
func (h *BatchHandler) DeletePhaseGroup(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DeletePhaseGroup(c.Request.Context(), tenantID, id); err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "deleted"})
}

// StartPhaseGroup starts a phase group execution.
func (h *BatchHandler) StartPhaseGroup(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	run, err := h.svc.StartPhaseGroup(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, run)
}

// StopPhaseGroup stops a running phase group execution.
func (h *BatchHandler) StopPhaseGroup(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	run, err := h.svc.StopPhaseGroup(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, run)
}

// GetPhaseGroupStatus returns the latest run status for a phase group.
func (h *BatchHandler) GetPhaseGroupStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	run, err := h.svc.GetPhaseGroupStatus(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "no status found")
		return
	}

	respondSuccess(c, run)
}

// ListPhaseGroupRuns lists execution records for a phase group.
func (h *BatchHandler) ListPhaseGroupRuns(c *gin.Context) {
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

	runs, err := h.svc.ListPhaseGroupRuns(c.Request.Context(), tenantID, groupID, offset, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, runs)
}

// ==================== Batch Run Handlers ====================

// CreateBatchRun creates a new batch run.
func (h *BatchHandler) CreateBatchRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.CreateBatchRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.CreateBatchRun(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, run)
}

// ListBatchRuns lists batch runs for the tenant.
func (h *BatchHandler) ListBatchRuns(c *gin.Context) {
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

	runs, err := h.svc.ListBatchRuns(c.Request.Context(), tenantID, offset, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, runs)
}

// StartBatchRun starts a batch run execution.
func (h *BatchHandler) StartBatchRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	runID := c.Param("id")

	run, err := h.svc.StartBatchRun(c.Request.Context(), tenantID, runID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, run)
}

// StopBatchRun stops a running batch run.
func (h *BatchHandler) StopBatchRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	runID := c.Param("id")

	run, err := h.svc.StopBatchRun(c.Request.Context(), tenantID, runID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, run)
}