package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-execution-control/models"
	"orion/platform-svc-go/internal/pipeline-execution-control/service"

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
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// --- Handlers ---

func (h *Handler) Pause(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Pause")
	defer span.End()
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	var req models.PauseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.Pause(ctx, runID, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline run not found")
			return
		}
		if err == service.ErrInvalidStatus {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, run)
}

func (h *Handler) Resume(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Resume")
	defer span.End()
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	var req models.ResumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.Resume(ctx, runID, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline run not found")
			return
		}
		if err == service.ErrInvalidStatus {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, run)
}

func (h *Handler) Abort(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Abort")
	defer span.End()
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	var req models.AbortRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.Abort(ctx, runID, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline run not found")
			return
		}
		if err == service.ErrInvalidStatus {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, run)
}

func (h *Handler) Retry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Retry")
	defer span.End()
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	var req models.RetryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.Retry(ctx, runID, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline run not found")
			return
		}
		if err == service.ErrInvalidStatus {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, run)
}

func (h *Handler) Restart(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Restart")
	defer span.End()
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	var req models.RestartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.Restart(ctx, runID, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline run not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, run)
}

func (h *Handler) GetCheckpoints(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCheckpoints")
	defer span.End()
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	cps, total, err := h.svc.GetCheckpoints(ctx, runID, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.CheckpointListResponse{
		Data:  cps,
		Total: total,
	})
}

func (h *Handler) GetControlLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetControlLogs")
	defer span.End()
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)

	logs, total, err := h.svc.GetPauseResumeLogs(ctx, runID, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.ControlLogListResponse{
		Data:  logs,
		Total: total,
	})
}
