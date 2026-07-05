package handler

import (
	"net/http"

	"orion/config-mgmt-svc-go/internal/models"
	"orion/config-mgmt-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

type ApprovalHandler struct {
	svc *service.ApprovalService
}

func NewApprovalHandler(svc *service.ApprovalService) *ApprovalHandler {
	return &ApprovalHandler{svc: svc}
}

func (h *ApprovalHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	approval, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, approval)
}

func (h *ApprovalHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	approval, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "approval not found"})
		return
	}
	c.JSON(http.StatusOK, approval)
}

func (h *ApprovalHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	items, err := h.svc.List(c.Request.Context(), tenantID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *ApprovalHandler) Review(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ReviewApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.Review(c.Request.Context(), tenantID, c.Param("id"), req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "reviewed"})
}

func (h *ApprovalHandler) Apply(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Apply(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "applied"})
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
