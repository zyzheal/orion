package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/canary-analysis/models"
	"orion/platform-svc-go/internal/canary-analysis/service"

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

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/canary-analyses")
	f.GET("", auth.RequirePermission("canary_analysis", "read"), h.List)
	f.POST("", auth.RequirePermission("canary_analysis", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("canary_analysis", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("canary_analysis", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("canary_analysis", "delete"), h.Delete)

	// Business endpoints
	f.POST("/force-promote", auth.RequirePermission("canary_analysis", "execute"), h.ForcePromote)
	f.POST("/force-rollback", auth.RequirePermission("canary_analysis", "execute"), h.ForceRollback)
	f.POST("/models/retrain", auth.RequirePermission("canary_analysis", "execute"), h.RetrainModel)
	f.GET("/metrics/discover", auth.RequirePermission("canary_analysis", "read"), h.DiscoverMetrics)
	f.GET("/runs/:runID/metrics", auth.RequirePermission("canary_analysis", "read"), h.GetRunMetrics)
	f.GET("/runs/:runID/ml-results", auth.RequirePermission("canary_analysis", "read"), h.GetMLResults)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)
	entities, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{Data: entities, Total: len(entities), Page: 1, PageSize: len(entities)})
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Create(ctx, &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, entity)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Get(ctx, id, tenantID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entity)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Update(ctx, id, tenantID, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entity)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) ForcePromote(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ForcePromote")
	defer span.End()
	var req models.ForcePromoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.ForcePromote(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ForceRollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ForceRollback")
	defer span.End()
	var req models.ForceRollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.ForceRollback(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) RetrainModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RetrainModel")
	defer span.End()
	var req models.RetrainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.RetrainModel(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DiscoverMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DiscoverMetrics")
	defer span.End()
	query := c.Query("query")
	tenantID := h.getTenantID(c)
	result, err := h.svc.DiscoverMetrics(ctx, tenantID, query)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetRunMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRunMetrics")
	defer span.End()
	runID := c.Param("runID")
	tenantID := h.getTenantID(c)
	result, err := h.svc.GetRunMetrics(ctx, tenantID, runID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetMLResults(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMLResults")
	defer span.End()
	runID := c.Param("runID")
	tenantID := h.getTenantID(c)
	result, err := h.svc.GetMLResults(ctx, tenantID, runID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
