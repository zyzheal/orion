package handler

import (
	"net/http"
	"strconv"

	"orion/approval-svc-go/internal/models"
	"orion/approval-svc-go/internal/service"

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
		approvals.POST("", h.CreateApproval)
		approvals.GET("", h.ListApprovals)
		approvals.GET("/:id", h.GetApproval)
		approvals.POST("/:id/approve", h.Approve)
		approvals.POST("/:id/reject", h.Reject)
		approvals.POST("/:id/cancel", h.Cancel)
		approvals.GET("/:id/steps", h.GetSteps)
	}
}

func (h *Handler) CreateApproval(c *gin.Context) {
	var approval models.Approval
	if err := c.ShouldBindJSON(&approval); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	approval.TenantID = c.GetString("tenant_id")
	if err := h.svc.Create(c.Request.Context(), &approval); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, approval)
}

func (h *Handler) GetApproval(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	approval, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "approval not found"})
		return
	}

	c.JSON(http.StatusOK, approval)
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": approvals})
}

func (h *Handler) Approve(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		StepID  string  `json:"step_id" binding:"required"`
		Comment *string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.Approve(c.Request.Context(), tenantID, id, req.StepID, req.Comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "approved"})
}

func (h *Handler) Reject(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		StepID  string  `json:"step_id" binding:"required"`
		Comment *string `json:"comment" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.Reject(c.Request.Context(), tenantID, id, req.StepID, req.Comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "rejected"})
}

func (h *Handler) Cancel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.Cancel(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "canceled"})
}

func (h *Handler) GetSteps(c *gin.Context) {
	id := c.Param("id")

	steps, err := h.svc.GetSteps(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": steps})
}
