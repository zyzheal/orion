package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-execution-control/models"
	"orion/platform-svc-go/internal/pipeline-execution-control/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all pipeline execution control endpoints.
// Mounts under /pipelines/runs to match the TS source route conventions.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/pipelines/runs")

	// POST /pipelines/runs/:runId/pause
	f.POST("/:runId/pause", auth.RequirePermission("pipeline", "execute"), h.Pause)
	// POST /pipelines/runs/:runId/resume
	f.POST("/:runId/resume", auth.RequirePermission("pipeline", "execute"), h.Resume)
	// POST /pipelines/runs/:runId/abort
	f.POST("/:runId/abort", auth.RequirePermission("pipeline", "execute"), h.Abort)
	// POST /pipelines/runs/:runId/retry
	f.POST("/:runId/retry", auth.RequirePermission("pipeline", "execute"), h.Retry)
	// POST /pipelines/runs/:runId/restart
	f.POST("/:runId/restart", auth.RequirePermission("pipeline", "execute"), h.Restart)
	// GET /pipelines/runs/:runId/checkpoints
	f.GET("/:runId/checkpoints", auth.RequirePermission("pipeline", "read"), h.GetCheckpoints)
	// GET /pipelines/runs/:runId/control-logs
	f.GET("/:runId/control-logs", auth.RequirePermission("pipeline", "read"), h.GetControlLogs)
}

// getTenantID extracts tenant_id from the Gin context.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// --- Handlers ---

func (h *Handler) Pause(c *gin.Context) {
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	var req models.PauseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.Pause(c.Request.Context(), runID, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "pipeline run not found")
			return
		}
		if err == service.ErrInvalidStatus {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, run)
}

func (h *Handler) Resume(c *gin.Context) {
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	var req models.ResumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.Resume(c.Request.Context(), runID, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "pipeline run not found")
			return
		}
		if err == service.ErrInvalidStatus {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, run)
}

func (h *Handler) Abort(c *gin.Context) {
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	var req models.AbortRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.Abort(c.Request.Context(), runID, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "pipeline run not found")
			return
		}
		if err == service.ErrInvalidStatus {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, run)
}

func (h *Handler) Retry(c *gin.Context) {
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	var req models.RetryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.Retry(c.Request.Context(), runID, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "pipeline run not found")
			return
		}
		if err == service.ErrInvalidStatus {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, run)
}

func (h *Handler) Restart(c *gin.Context) {
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	var req models.RestartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.Restart(c.Request.Context(), runID, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "pipeline run not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, run)
}

func (h *Handler) GetCheckpoints(c *gin.Context) {
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	cps, total, err := h.svc.GetCheckpoints(c.Request.Context(), runID, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.CheckpointListResponse{
		Data:  cps,
		Total: total,
	})
}

func (h *Handler) GetControlLogs(c *gin.Context) {
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	logs, total, err := h.svc.GetPauseResumeLogs(c.Request.Context(), runID, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.ControlLogListResponse{
		Data:  logs,
		Total: total,
	})
}