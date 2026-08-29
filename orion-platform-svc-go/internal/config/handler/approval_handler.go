package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/config/models"
	"orion/platform-svc-go/internal/config/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
)

// ApprovalHandler handles config approval endpoints.
type ApprovalHandler struct {
	svc *service.ApprovalService
}

// NewApprovalHandler creates a new ApprovalHandler.
func NewApprovalHandler(svc *service.ApprovalService) *ApprovalHandler {
	return &ApprovalHandler{svc: svc}
}

func (h *ApprovalHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	approval, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, approval)
}

func (h *ApprovalHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	a, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "approval not found")
		return
	}
	middleware.RespondSuccess(c, a)
}

func (h *ApprovalHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	approvals, err := h.svc.List(ctx, tenantID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": approvals, "count": len(approvals)})
}

func (h *ApprovalHandler) Review(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ReviewApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.Review(ctx, tenantID, id, req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "approval reviewed"})
}

func (h *ApprovalHandler) Apply(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigApply")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Apply(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "approval applied"})
}

// RegisterRoutes registers approval routes.
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
