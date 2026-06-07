package handler

import (
	"net/http"

	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

type RBACHandler struct {
	svc *service.RBACService
}

func NewRBACHandler(svc *service.RBACService) *RBACHandler {
	return &RBACHandler{svc: svc}
}

func (h *RBACHandler) Grant(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.GrantAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.Grant(c.Request.Context(), tenantID, pipelineID, req.UserID, req.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "granted"})
}

func (h *RBACHandler) Revoke(c *gin.Context) {
	pipelineID := c.Param("pipelineId")
	userID := c.Param("userId")

	if err := h.svc.Revoke(c.Request.Context(), pipelineID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "revoked"})
}

func (h *RBACHandler) List(c *gin.Context) {
	pipelineID := c.Param("pipelineId")

	entries, err := h.svc.List(c.Request.Context(), pipelineID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": entries})
}

func (h *RBACHandler) Check(c *gin.Context) {
	pipelineID := c.Param("pipelineId")
	userID := c.Query("user_id")
	role := c.Query("role")

	if userID == "" || role == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id and role are required"})
		return
	}

	hasAccess, err := h.svc.Check(c.Request.Context(), pipelineID, userID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"has_access": hasAccess})
}

func (h *RBACHandler) GetUserRole(c *gin.Context) {
	pipelineID := c.Param("pipelineId")
	userID := c.Param("userId")

	role, err := h.svc.GetUserRole(c.Request.Context(), pipelineID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"role": role})
}

func (h *RBACHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rbac := rg.Group("/pipelines/:pipelineId/rbac")
	{
		rbac.POST("", h.Grant)
		rbac.GET("", h.List)
		rbac.GET("/check", h.Check)
		rbac.GET("/:userId", h.GetUserRole)
		rbac.DELETE("/:userId", h.Revoke)
	}
}
