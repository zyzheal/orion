package handler

import (
	"errors"
	"strconv"

	"orion/platform-svc-go/internal/approval/models"
	"orion/platform-svc-go/internal/approval/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for approval operations.
type Handler struct {
	svc *service.ApprovalService
}

func NewHandler(svc *service.ApprovalService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers approval routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	approvals := rg.Group("/approvals")
	{
		approvals.POST("", auth.RequirePermission("approval", "write"), h.CreateApproval)
		approvals.GET("", h.ListApprovals)
		approvals.GET("/count", h.Count)
		approvals.GET("/:id", h.GetApproval)
		approvals.POST("/:id/approve", auth.RequirePermission("approval", "execute"), h.Approve)
		approvals.POST("/:id/reject", auth.RequirePermission("approval", "execute"), h.Reject)
		approvals.POST("/:id/cancel", auth.RequirePermission("approval", "execute"), h.Cancel)
		approvals.GET("/:id/steps", h.GetSteps)
		approvals.DELETE("/:id", auth.RequirePermission("approval", "delete"), h.Delete)
	}
}

// mapError maps service-layer errors to appropriate HTTP status codes.
func mapError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrApprovalNotFound):
		respondNotFound(c, err.Error())
	case errors.Is(err, service.ErrStepNotFound):
		respondNotFound(c, err.Error())
	case errors.Is(err, service.ErrInvalidStatus):
		respondConflict(c, err.Error())
	case errors.Is(err, service.ErrAlreadyActed):
		respondConflict(c, err.Error())
	case errors.Is(err, service.ErrNotAuthorized):
		respondForbidden(c, err.Error())
	default:
		respondInternalError(c, err.Error())
	}
}

func (h *Handler) CreateApproval(c *gin.Context) {
	var approval models.Approval
	if err := c.ShouldBindJSON(&approval); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	approval.TenantID = c.GetString("tenant_id")
	if err := h.svc.Create(c.Request.Context(), &approval); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, approval)
}

func (h *Handler) GetApproval(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	approval, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		mapError(c, err)
		return
	}

	respondSuccess(c, approval)
}

func (h *Handler) ListApprovals(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	approvals, err := h.svc.List(c.Request.Context(), tenantID, offset, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, approvals)
}

func (h *Handler) Approve(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		ApproverID string  `json:"approver_id" binding:"required"`
		Comment    *string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.Approve(c.Request.Context(), tenantID, id, req.ApproverID, req.Comment)
	if err != nil {
		mapError(c, err)
		return
	}

	respondSuccess(c, result)
}

func (h *Handler) Reject(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		ApproverID string  `json:"approver_id" binding:"required"`
		Comment    *string `json:"comment" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.Reject(c.Request.Context(), tenantID, id, req.ApproverID, req.Comment)
	if err != nil {
		mapError(c, err)
		return
	}

	respondSuccess(c, result)
}

func (h *Handler) Cancel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.Cancel(c.Request.Context(), tenantID, id); err != nil {
		mapError(c, err)
		return
	}

	respondSuccess(c, gin.H{"message": "canceled"})
}

func (h *Handler) GetSteps(c *gin.Context) {
	id := c.Param("id")

	steps, err := h.svc.GetSteps(c.Request.Context(), id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, steps)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		mapError(c, err)
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}
