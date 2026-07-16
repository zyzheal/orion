package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/ai-decision/models"
	"orion/platform-svc-go/internal/ai-decision/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
r := rg.Group("/ai-decision")
	r.GET("", auth.RequirePermission("ai-decision", "read"), h.ListDecisions)
	r.GET("/:id", auth.RequirePermission("ai-decision", "read"), h.GetDecision)
	r.POST("", auth.RequirePermission("ai-decision", "write"), h.MakeDecision)
	r.PUT("/:id/override", auth.RequirePermission("ai-decision", "write"), h.OverrideDecision)
	r.GET("/stats", auth.RequirePermission("ai-decision", "read"), h.GetDecisionStats)
}

func (h *Handler) GetDecision(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetDecisionStats(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
result, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListDecisions(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")
q := models.ListDecisionsQuery{Status: status, Limit: limit, Offset: offset}
	result, err := h.svc.List(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) MakeDecision(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	var req models.MakeDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.MakeDecision(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) OverrideDecision(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.OverrideDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.OverrideDecision(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}
