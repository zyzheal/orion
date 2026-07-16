package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/ai-review/models"
	"orion/platform-svc-go/internal/ai-review/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
r := rg.Group("/ai-review")
	r.GET("", auth.RequirePermission("ai-review", "read"), h.ListReviews)
	r.GET("/:id", auth.RequirePermission("ai-review", "read"), h.GetReview)
	r.POST("", auth.RequirePermission("ai-review", "write"), h.CreateReview)
	r.PUT("/:id/approve", auth.RequirePermission("ai-review", "write"), h.ApproveReview)
	r.PUT("/:id/reject", auth.RequirePermission("ai-review", "write"), h.RejectReview)
}

func (h *Handler) ApproveReview(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.Approve(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) CreateReview(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	var req models.CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) GetReview(c *gin.Context) {
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

func (h *Handler) ListReviews(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")
	q := models.ListReviewsQuery{Status: status, Limit: limit, Offset: offset}
	result, err := h.svc.List(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) RejectReview(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.Reject(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}
