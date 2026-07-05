package handler

import (
	"net/http"

	"orion/approval-svc-go/internal/models"

	"github.com/gin-gonic/gin"
)

// SubmitApproval handles multi-level approval submission.
func (h *Handler) SubmitApproval(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.SubmitApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.SubmitApproval(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, result)
}

// GetPendingForUser returns pending approvals for a specific user.
func (h *Handler) GetPendingForUser(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Param("userId")
	results, err := h.svc.GetPendingForUser(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": results, "count": len(results)})
}

// GetStats returns aggregate approval statistics.
func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// GetByResource returns approvals for a specific resource.
func (h *Handler) GetByResource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	resourceType := c.Query("resource_type")
	resourceID := c.Query("resource_id")
	results, err := h.svc.GetByResource(c.Request.Context(), tenantID, resourceType, resourceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": results})
}

// GetWithSteps returns an approval with its workflow steps.
func (h *Handler) GetWithSteps(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetWithSteps(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		mapError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

// RegisterExtendedRoutes adds the new routes to the existing router group.
func (h *Handler) RegisterExtendedRoutes(rg *gin.RouterGroup) {
	approvals := rg.Group("/approvals")
	{
		approvals.POST("/submit", h.SubmitApproval)
		approvals.GET("/stats", h.GetStats)
		approvals.GET("/by-resource", h.GetByResource)
		approvals.GET("/pending/:userId", h.GetPendingForUser)
		approvals.GET("/:id/full", h.GetWithSteps)
	}
}
