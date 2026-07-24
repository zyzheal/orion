package handler

import (
	"orion/go-common/pkg/errors"
	"net/http"

	"orion/ci-cd-svc-go/internal/pipeline/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// ControlHandler provides HTTP handlers for pipeline execution control.
type ControlHandler struct {
	svc *service.ControlService
}

func NewControlHandler(svc *service.ControlService) *ControlHandler {
	return &ControlHandler{svc: svc}
}

// RegisterRoutes registers execution control routes.
func (h *ControlHandler) RegisterRoutes(rg *gin.RouterGroup) {
	control := rg.Group("/pipelines/:pipelineId/runs/:runId")
	control.Use(auth.RequirePermission("pipeline", "execute"))
	{
		control.POST("/pause", h.PauseRun)
		control.POST("/resume", h.ResumeRun)
		control.POST("/abort", h.AbortRun)
		control.POST("/retry", h.RetryRun)
		control.POST("/restart", h.RestartRun)
		control.GET("/checkpoints", h.ListCheckpoints)
		control.GET("/control-logs", h.ListControlLogs)
	}
}

// ==================== Execution Control ====================

func (h *ControlHandler) PauseRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	pipelineID := c.Param("pipelineId")
	runID := c.Param("runId")

	if err := h.svc.PauseRun(c.Request.Context(), tenantID, pipelineID, runID, userID); err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "run is not in a pauseable state" {
			status = http.StatusConflict
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), status)
		return
	}

	respondSuccess(c, gin.H{"message": "paused"})
}

func (h *ControlHandler) ResumeRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	pipelineID := c.Param("pipelineId")
	runID := c.Param("runId")

	if err := h.svc.ResumeRun(c.Request.Context(), tenantID, pipelineID, runID, userID); err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "run is not in a resumable state" {
			status = http.StatusConflict
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), status)
		return
	}

	respondSuccess(c, gin.H{"message": "resumed"})
}

func (h *ControlHandler) AbortRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	pipelineID := c.Param("pipelineId")
	runID := c.Param("runId")

	if err := h.svc.AbortRun(c.Request.Context(), tenantID, pipelineID, runID, userID); err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "run is not in an aborteable state" {
			status = http.StatusConflict
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), status)
		return
	}

	respondSuccess(c, gin.H{"message": "aborted"})
}

func (h *ControlHandler) RetryRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	pipelineID := c.Param("pipelineId")
	runID := c.Param("runId")

	run, err := h.svc.RetryRun(c.Request.Context(), tenantID, pipelineID, runID, userID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrRunNotFound || err == service.ErrPipelineNotFound {
			status = http.StatusNotFound
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), status)
		return
	}

	respondSuccess(c, gin.H{"message": "retry initiated", "run": run})
}

func (h *ControlHandler) RestartRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	pipelineID := c.Param("pipelineId")
	runID := c.Param("runId")

	run, err := h.svc.RestartRun(c.Request.Context(), tenantID, pipelineID, runID, userID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrRunNotFound || err == service.ErrPipelineNotFound {
			status = http.StatusNotFound
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), status)
		return
	}

	respondSuccess(c, gin.H{"message": "restart initiated", "run": run})
}

func (h *ControlHandler) ListCheckpoints(c *gin.Context) {
	runID := c.Param("runId")

	checkpoints, err := h.svc.ListCheckpoints(c.Request.Context(), runID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, checkpoints)
}

func (h *ControlHandler) ListControlLogs(c *gin.Context) {
	runID := c.Param("runId")

	logs, err := h.svc.ListControlLogs(c.Request.Context(), runID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, logs)
}