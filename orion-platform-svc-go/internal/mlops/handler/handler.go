package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/mlops/models"
	"orion/platform-svc-go/internal/mlops/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/mlops")

	// Model registry CRUD
	r.GET("", auth.RequirePermission("mlops", "read"), h.ListModels)
	r.GET("/:id", auth.RequirePermission("mlops", "read"), h.GetModel)
	r.POST("", auth.RequirePermission("mlops", "write"), h.RegisterModel)
	r.PUT("/:id", auth.RequirePermission("mlops", "write"), h.UpdateModel)
	r.DELETE("/:id", auth.RequirePermission("mlops", "delete"), h.DeleteModel)

	// Training / Evaluation / Deployment
	r.POST("/:id/train", auth.RequirePermission("mlops", "write"), h.Train)
	r.POST("/:id/evaluate", auth.RequirePermission("mlops", "write"), h.Evaluate)
	r.PUT("/:id/deploy", auth.RequirePermission("mlops", "write"), h.Deploy)
	r.PUT("/:id/rollback", auth.RequirePermission("mlops", "write"), h.Rollback)
	r.GET("/:id/metrics", auth.RequirePermission("mlops", "read"), h.GetMetrics)

	// Experiments / Artifacts
	r.GET("/:id/experiments", auth.RequirePermission("mlops", "read"), h.ListExperiments)
	r.GET("/:id/artifacts", auth.RequirePermission("mlops", "read"), h.ListArtifacts)

	// Pipelines
	r.GET("/pipelines", auth.RequirePermission("mlops", "read"), h.ListPipelines)
}

// ==================== Model Registry ====================

func (h *Handler) ListModels(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListModels")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	data, err := h.svc.ListModels(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) GetModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetModel(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) RegisterModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.RegisterModel(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) UpdateModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	updates := map[string]interface{}{"name": req.Name}
	if req.Framework != "" {
		updates["framework"] = req.Framework
	}
	if req.Version != "" {
		updates["version"] = req.Version
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Metadata != nil {
		updates["metadata"] = req.Metadata
	}
	result, err := h.svc.UpdateModel(ctx, tenantID, c.Param("id"), updates)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) DeleteModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteModel(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "model archived"})
}

// ==================== Training / Evaluation / Deployment ====================

func (h *Handler) Train(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Train")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.TrainingJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.Train(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Evaluate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.Evaluate(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) Deploy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Deploy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.Deploy(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) Rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Rollback")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.Rollback(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetMetrics(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"metrics": result})
}

// ==================== Experiments / Artifacts ====================

func (h *Handler) ListExperiments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListExperiments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	data, err := h.svc.ListExperiments(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) ListArtifacts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListArtifacts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	data, err := h.svc.ListArtifacts(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

// ==================== Pipelines ====================

func (h *Handler) ListPipelines(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPipelines")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	data, err := h.svc.ListPipelines(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}