package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/governance/governance/models"
	"orion/platform-svc-go/internal/governance/governance/service"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/policies")
	r.POST("", auth.RequirePermission("governance", "write"), h.Create)
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.DELETE("/:id", auth.RequirePermission("governance", "delete"), h.Delete)
	r.GET("/count", h.Count)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateGovernancePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListGovernancePolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.List(ctx, tenantID, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGovernancePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteGovernancePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CountGovernancePolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"count": count})
}
