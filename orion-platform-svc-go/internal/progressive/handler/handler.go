package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/progressive/models"
	"orion/platform-svc-go/internal/progressive/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
)

// Handler provides HTTP handlers for the progressive deployment module.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler backed by the given Service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all progressive deployment endpoints under /progressive.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/progressive")

	// CRUD
	r.GET("", auth.RequirePermission("progressive", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("progressive", "read"), h.Get)
	r.POST("", auth.RequirePermission("progressive", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("progressive", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("progressive", "write"), h.Delete)

	// Rollout lifecycle
	r.POST("/:id/start", auth.RequirePermission("progressive", "write"), h.Start)
	r.POST("/:id/stages/:stage/complete", auth.RequirePermission("progressive", "write"), h.CompleteStage)
	r.POST("/:id/pause", auth.RequirePermission("progressive", "write"), h.Pause)
	r.POST("/:id/resume", auth.RequirePermission("progressive", "write"), h.Resume)
	r.POST("/:id/rollback", auth.RequirePermission("progressive", "write"), h.Rollback)

	// Stages & progress
	r.GET("/:id/stages", auth.RequirePermission("progressive", "read"), h.ListStages)
	r.GET("/:id/progress", auth.RequirePermission("progressive", "read"), h.GetProgress)
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	items, total, err := h.svc.List(ctx, tenantID)
	if err != nil {
		writeInternalError(c, err.Error())
		return
	}
	writeSuccess(c, models.DeploymentListResult{Items: items, Total: total})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	d, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			writeNotFound(c, "deployment not found")
			return
		}
		writeInternalError(c, err.Error())
		return
	}
	writeSuccess(c, d)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateProgressiveDeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeBadRequest(c, err.Error())
		return
	}

	d, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		handleServiceError(c, err)
		return
	}
	writeCreated(c, d)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdateProgressiveDeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeBadRequest(c, err.Error())
		return
	}

	d, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		handleServiceError(c, err)
		return
	}
	writeSuccess(c, d)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	err := h.svc.Delete(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			writeNotFound(c, "deployment not found")
			return
		}
		if service.IsBadRequest(err) {
			writeBadRequest(c, err.Error())
			return
		}
		writeInternalError(c, err.Error())
		return
	}
	writeSuccess(c, gin.H{"message": "deployment deleted"})
}

// ---------------------------------------------------------------------------
// Rollout lifecycle
// ---------------------------------------------------------------------------

func (h *Handler) Start(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Start")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	d, err := h.svc.StartRollout(ctx, tenantID, id)
	if err != nil {
		handleServiceError(c, err)
		return
	}
	writeSuccess(c, d)
}

func (h *Handler) CompleteStage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompleteStage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	deploymentID := c.Param("id")
	stageStr := c.Param("stage")

	stageNumber, err := strconv.Atoi(stageStr)
	if err != nil {
		writeBadRequest(c, "stage must be an integer")
		return
	}

	var req models.CompleteStageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeBadRequest(c, err.Error())
		return
	}

	d, err := h.svc.CompleteStage(ctx, tenantID, deploymentID, stageNumber,
		req.HealthOK, req.ErrorRate, req.Metrics)
	if err != nil {
		handleServiceError(c, err)
		return
	}
	writeSuccess(c, d)
}

func (h *Handler) Pause(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Pause")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	d, err := h.svc.Pause(ctx, tenantID, id)
	if err != nil {
		handleServiceError(c, err)
		return
	}
	writeSuccess(c, d)
}

func (h *Handler) Resume(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Resume")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	d, err := h.svc.Resume(ctx, tenantID, id)
	if err != nil {
		handleServiceError(c, err)
		return
	}
	writeSuccess(c, d)
}

func (h *Handler) Rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Rollback")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeBadRequest(c, err.Error())
		return
	}
	if req.Reason == "" {
		req.Reason = "manual rollback"
	}

	d, err := h.svc.Rollback(ctx, tenantID, id, req.Reason)
	if err != nil {
		handleServiceError(c, err)
		return
	}
	writeSuccess(c, d)
}

// ---------------------------------------------------------------------------
// Stages & progress
// ---------------------------------------------------------------------------

func (h *Handler) ListStages(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListStages")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	deploymentID := c.Param("id")

	stages, err := h.svc.GetStages(ctx, tenantID, deploymentID)
	if err != nil {
		if service.IsNotFound(err) {
			writeNotFound(c, "deployment not found")
			return
		}
		writeInternalError(c, err.Error())
		return
	}
	writeSuccess(c, gin.H{"data": stages, "total": len(stages)})
}

func (h *Handler) GetProgress(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetProgress")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	deploymentID := c.Param("id")

	progress, err := h.svc.GetProgress(ctx, tenantID, deploymentID)
	if err != nil {
		if service.IsNotFound(err) {
			writeNotFound(c, "deployment not found")
			return
		}
		writeInternalError(c, err.Error())
		return
	}
	writeSuccess(c, progress)
}

// ---------------------------------------------------------------------------
// Error handling helpers
// ---------------------------------------------------------------------------

func handleServiceError(c *gin.Context, err error) {
	if service.IsNotFound(err) {
		writeNotFound(c, "deployment not found")
	} else if service.IsBadRequest(err) {
		writeBadRequest(c, err.Error())
	} else {
		writeInternalError(c, err.Error())
	}
}

func writeSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

func writeCreated(c *gin.Context, data any) {
	// WriteCreated signature may not exist; fall back to WriteSuccess with 201
	errors.WriteCreated(c, data)
}

func writeNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

func writeBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

func writeInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}
