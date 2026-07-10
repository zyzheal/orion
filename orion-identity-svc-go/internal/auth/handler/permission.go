package handler

import (
	"net/http"

	"orion/identity-svc-go/internal/auth/permission"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// PermissionHandler handles permission CRUD, assignment, and check routes.
type PermissionHandler struct {
	svc *permission.Service
	log *zap.Logger
}

func NewPermissionHandler(svc *permission.Service, log *zap.Logger) *PermissionHandler {
	return &PermissionHandler{svc: svc, log: log}
}

// ListPermissions handles GET /permissions.
func (h *PermissionHandler) ListPermissions(c *gin.Context) {
	tenantID := c.DefaultQuery("tenant_id", "")
	resource := c.DefaultQuery("resource", "")

	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}

	perms, err := h.svc.List(c.Request.Context(), tenantID, resource)
	if err != nil {
		h.log.Error("failed to list permissions", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"permissions": perms,
		"total": len(perms),
	})
}

// GetPermission handles GET /permissions/:id.
func (h *PermissionHandler) GetPermission(c *gin.Context) {
	id := c.Param("id")
	p, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "permission not found"})
		return
	}

	c.JSON(http.StatusOK, p)
}

// CreatePermission handles POST /permissions.
func (h *PermissionHandler) CreatePermission(c *gin.Context) {
	var req struct {
		TenantID    string `json:"tenant_id" binding:"required"`
		Resource    string `json:"resource" binding:"required"`
		Action      string `json:"action" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	p, err := h.svc.Create(c.Request.Context(), req.TenantID, req.Resource, req.Action, req.Description)
	if err != nil {
		if pe, ok := err.(*permission.PermissionError); ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": pe.Error()})
			return
		}
		h.log.Error("failed to create permission", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusCreated, p)
}

// UpdatePermission handles PUT /permissions/:id.
func (h *PermissionHandler) UpdatePermission(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Description string `json:"description"`
		Enabled     *bool  `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	p, err := h.svc.Update(c.Request.Context(), id, req.Description, req.Enabled)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, p)
}

// DeletePermission handles DELETE /permissions/:id.
func (h *PermissionHandler) DeletePermission(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "permission deleted"})
}

// AssignPermissionToUser handles POST /users/:userId/permissions.
func (h *PermissionHandler) AssignPermissionToUser(c *gin.Context) {
	userID := c.Param("userId")
	var req struct {
		TenantID     string `json:"tenant_id" binding:"required"`
		PermissionID string `json:"permission_id" binding:"required"`
		RoleID       string `json:"role_id"`
		GrantedBy    string `json:"granted_by"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.GrantedBy == "" {
		req.GrantedBy = "admin"
	}

	if err := h.svc.AssignPermission(c.Request.Context(), req.TenantID, userID, req.RoleID, req.PermissionID, req.GrantedBy); err != nil {
		h.log.Error("failed to assign permission", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "permission assigned",
		"user_id":   userID,
		"permission_id": req.PermissionID,
	})
}

// CheckPermission handles POST /permissions/check.
func (h *PermissionHandler) CheckPermission(c *gin.Context) {
	var req struct {
		TenantID string `json:"tenant_id" binding:"required"`
		UserID   string `json:"user_id" binding:"required"`
		Resource string `json:"resource" binding:"required"`
		Action   string `json:"action" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	granted, err := h.svc.CheckPermission(c.Request.Context(), req.TenantID, req.UserID, req.Resource, req.Action)
	if err != nil {
		h.log.Error("failed to check permission", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"granted":  granted,
		"resource": req.Resource,
		"action":   req.Action,
	})
}
