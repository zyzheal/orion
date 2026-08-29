package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/config/internal/config/models"
	"orion/platform-svc-go/internal/config/internal/config/service"

	"github.com/gin-gonic/gin"
)

type ApprovalHandler struct {
	svc *service.ApprovalService
}

func NewApprovalHandler(svc *service.ApprovalService) *ApprovalHandler {
	return &ApprovalHandler{svc: svc}
}

func (h *ApprovalHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	approval, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, approval)
}

func (h *ApprovalHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approval, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "approval not found")
		return
	}
	respondSuccess(c, approval)
}

func (h *ApprovalHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	items, err := h.svc.List(ctx, tenantID, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": items})
}

func (h *ApprovalHandler) Review(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.ReviewApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.Review(ctx, tenantID, c.Param("id"), req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "reviewed"})
}

func (h *ApprovalHandler) Apply(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigApply")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Apply(ctx, tenantID, c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "applied"})
}

func (h *ApprovalHandler) RegisterRoutes(rg *gin.RouterGroup) {
	a := rg.Group("/approvals")
	{
		a.POST("", h.Create)
		a.GET("", h.List)
		a.GET("/:id", h.Get)
		a.POST("/:id/review", h.Review)
		a.POST("/:id/apply", h.Apply)
	}
}
