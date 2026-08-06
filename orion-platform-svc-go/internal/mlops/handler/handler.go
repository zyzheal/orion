package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/mlops/models"
	"orion/platform-svc-go/internal/mlops/service"
	"orion/platform-svc-go/internal/shared/crud"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	*crud.CRUDHandler
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	crudH := crud.NewCRUDHandler(svc, crud.WithResource("mlops"), crud.WithPrefix("/mlops"), crud.WithListQueryPaging())
	return &Handler{CRUDHandler: crudH, svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/mlops")
	// Canonical CRUD routes via shared handler.
	r.GET("", auth.RequirePermission("mlops", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("mlops", "read"), h.Get)
	r.POST("", auth.RequirePermission("mlops", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("mlops", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("mlops", "delete"), h.Delete)
	// Domain-specific MLOps endpoints.
	r.POST("/:id/train", auth.RequirePermission("mlops", "write"), h.Train)
	r.POST("/:id/evaluate", auth.RequirePermission("mlops", "write"), h.Evaluate)
	r.PUT("/:id/deploy", auth.RequirePermission("mlops", "write"), h.Deploy)
	r.PUT("/:id/rollback", auth.RequirePermission("mlops", "write"), h.Rollback)
	r.GET("/:id/metrics", auth.RequirePermission("mlops", "read"), h.GetMetrics)
	r.GET("/:id/experiments", auth.RequirePermission("mlops", "read"), h.ListExperiments)
	r.GET("/:id/artifacts", auth.RequirePermission("mlops", "read"), h.ListArtifacts)
	r.GET("/models", auth.RequirePermission("mlops", "read"), h.ListModels)
	r.POST("/models", auth.RequirePermission("mlops", "write"), h.RegisterModel)
	r.DELETE("/models/:id", auth.RequirePermission("mlops", "delete"), h.DeregisterModel)
	r.GET("/pipelines", auth.RequirePermission("mlops", "read"), h.ListPipelines)
}

func (h *Handler) Train(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Train")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Train(ctx, tenantID, c.Param("id"))
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
	result, err := h.svc.Evaluate(ctx, tenantID, c.Param("id"))
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
	result, err := h.svc.Deploy(ctx, tenantID, c.Param("id"))
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
	_ = c.GetString("tenant_id")
	result, err := h.svc.Rollback(ctx, tenantID, c.Param("id"))
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
	_ = c
	errors.WriteSuccess(c, gin.H{"metrics": result})
}

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

func (h *Handler) RegisterModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRequest
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

func (h *Handler) DeregisterModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeregisterModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	err := h.svc.DeregisterModel(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "model deregistered"})
}

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
