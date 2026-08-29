package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/identity/auth/permission"

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AuthListPermissions")
	defer span.End()
	tenantID := c.DefaultQuery("tenant_id", "")
	resource := c.DefaultQuery("resource", "")

	if tenantID == "" {
		h.respondBadRequest(c, "tenant_id is required")
		return
	}

	perms, err := h.svc.List(ctx, tenantID, resource)
	if err != nil {
		h.log.Error("failed to list permissions", zap.Error(err))
		h.respondInternalError(c, "internal error")
		return
	}

	h.respondSuccess(c, gin.H{"permissions": perms,
		"total": len(perms)})
}

// GetPermission handles GET /permissions/:id.
func (h *PermissionHandler) GetPermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AuthGetPermission")
	defer span.End()
	id := c.Param("id")
	p, err := h.svc.Get(ctx, id)
	if err != nil {
		h.respondNotFound(c, err.Error())
		return
	}
	if p == nil {
		h.respondNotFound(c, "permission not found")
		return
	}

	h.respondSuccess(c, p)
}

// CreatePermission handles POST /permissions.
func (h *PermissionHandler) CreatePermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AuthCreatePermission")
	defer span.End()
	var req struct {
		TenantID    string `json:"tenant_id" binding:"required"`
		Resource    string `json:"resource" binding:"required"`
		Action      string `json:"action" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondBadRequest(c, err.Error())
		return
	}

	p, err := h.svc.Create(ctx, req.TenantID, req.Resource, req.Action, req.Description)
	if err != nil {
		if pe, ok := err.(*permission.PermissionError); ok {
			h.respondBadRequest(c, pe.Error())
			return
		}
		h.log.Error("failed to create permission", zap.Error(err))
		h.respondInternalError(c, "internal error")
		return
	}

	h.respondCreated(c, p)
}

// UpdatePermission handles PUT /permissions/:id.
func (h *PermissionHandler) UpdatePermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AuthUpdatePermission")
	defer span.End()
	id := c.Param("id")
	var req struct {
		Description string `json:"description"`
		Enabled     *bool  `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondBadRequest(c, err.Error())
		return
	}

	p, err := h.svc.Update(ctx, id, req.Description, req.Enabled)
	if err != nil {
		h.respondNotFound(c, err.Error())
		return
	}

	h.respondSuccess(c, p)
}

// DeletePermission handles DELETE /permissions/:id.
func (h *PermissionHandler) DeletePermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AuthDeletePermission")
	defer span.End()
	id := c.Param("id")
	if err := h.svc.Delete(ctx, id); err != nil {
		h.respondNotFound(c, err.Error())
		return
	}

	h.respondSuccess(c, gin.H{"message": "permission deleted"})
}

// AssignPermissionToUser handles POST /users/:userId/permissions.
func (h *PermissionHandler) AssignPermissionToUser(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AuthAssignPermissionToUser")
	defer span.End()
	userID := c.Param("userId")
	var req struct {
		TenantID     string `json:"tenant_id" binding:"required"`
		PermissionID string `json:"permission_id" binding:"required"`
		RoleID       string `json:"role_id"`
		GrantedBy    string `json:"granted_by"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondBadRequest(c, err.Error())
		return
	}
	if req.GrantedBy == "" {
		req.GrantedBy = "admin"
	}

	if err := h.svc.AssignPermission(ctx, req.TenantID, userID, req.RoleID, req.PermissionID, req.GrantedBy); err != nil {
		h.log.Error("failed to assign permission", zap.Error(err))
		h.respondInternalError(c, "internal error")
		return
	}

	h.respondSuccess(c, gin.H{"message": "permission assigned",
		"user_id":       userID,
		"permission_id": req.PermissionID})
}

// CheckPermission handles POST /permissions/check.
func (h *PermissionHandler) CheckPermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AuthCheckPermission")
	defer span.End()
	var req struct {
		TenantID string `json:"tenant_id" binding:"required"`
		UserID   string `json:"user_id" binding:"required"`
		Resource string `json:"resource" binding:"required"`
		Action   string `json:"action" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondBadRequest(c, err.Error())
		return
	}

	granted, err := h.svc.CheckPermission(ctx, req.TenantID, req.UserID, req.Resource, req.Action)
	if err != nil {
		h.log.Error("failed to check permission", zap.Error(err))
		h.respondInternalError(c, "internal error")
		return
	}

	h.respondSuccess(c, gin.H{
		"granted":  granted,
		"resource": req.Resource,
		"action":   req.Action,
	})
}
