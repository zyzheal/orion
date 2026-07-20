package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/disaster-recovery/models"
	"orion/platform-svc-go/internal/disaster-recovery/service"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/disaster-recovery")
	r.GET("/plans", auth.RequirePermission("disaster-recovery", "read"), h.ListPlans)
	r.GET("/plans/:id", auth.RequirePermission("disaster-recovery", "read"), h.GetPlan)
	r.POST("/plans", auth.RequirePermission("disaster-recovery", "write"), h.CreatePlan)
	r.PUT("/plans/:id", auth.RequirePermission("disaster-recovery", "write"), h.UpdatePlan)
	r.POST("/plans/:id/run", auth.RequirePermission("disaster-recovery", "write"), h.RunPlan)
	r.GET("/plans/:id/runs", auth.RequirePermission("disaster-recovery", "read"), h.ListRuns)
}

func (h *Handler) CreatePlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreatePlan")
	defer span.End()
	ctx := ctx
	tenantID := c.GetString("tenant_id")
	var req models.CreateDisasterPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreatePlan(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) GetPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPlan")
	defer span.End()
	ctx := ctx
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetPlan(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListPlans(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPlans")
	defer span.End()
	ctx := ctx
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	result, err := h.svc.ListPlans(ctx, tenantID, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) UpdatePlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePlan")
	defer span.End()
	ctx := ctx
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateDisasterPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.UpdatePlan(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) RunPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunPlan")
	defer span.End()
	ctx := ctx
	tenantID := c.GetString("tenant_id")
	planID := c.Param("id")
	result, err := h.svc.RunPlan(ctx, tenantID, planID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListRuns(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRuns")
	defer span.End()
	ctx := ctx
	tenantID := c.GetString("tenant_id")
	planID := c.Param("id")
	result, err := h.svc.ListRuns(ctx, tenantID, planID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}
