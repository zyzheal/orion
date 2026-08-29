package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/governance/policy/models"
	"orion/platform-svc-go/internal/governance/policy/service"

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
	r := rg.Group("/policies")
	r.POST("", h.Create)
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.PUT("/:id", h.Update)
	r.DELETE("/:id", h.Delete)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreatePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(ctx, tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeletePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}
