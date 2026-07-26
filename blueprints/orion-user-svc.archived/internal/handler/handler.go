package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/database"
	"orion/user-svc/internal/config"
	"orion/user-svc/internal/models"
	"orion/user-svc/internal/repository"
	"orion/user-svc/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// Handler handles HTTP requests for the user service.
type Handler struct {
	userRepo    *repository.UserRepository
	roleRepo    *repository.RoleRepository
	permRepo    *repository.PermissionRepository
	userSvc     *service.UserService
	rbacSvc     *service.RBACService
	rdb         *redis.Client
	logger      *zap.Logger
	cfg         *config.Config
}

// New creates a new Handler with full service layer.
func New(db *database.DB, rdb *redis.Client, logger *zap.Logger, cfg *config.Config) *Handler {
	userRepo := repository.NewUserRepository(db)
	roleRepo := repository.NewRoleRepository(db)
	permRepo := repository.NewPermissionRepository(db)

	return &Handler{
		userRepo: userRepo,
		roleRepo: roleRepo,
		permRepo: permRepo,
		userSvc:  service.NewUserService(userRepo),
		rbacSvc:  service.NewRBACService(userRepo, roleRepo, permRepo),
		rdb:      rdb,
		logger:   logger,
		cfg:      cfg,
	}
}

// Response is the standard API response envelope.
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func (h *Handler) err(c *gin.Context, code int, message string) {
	c.JSON(code, Response{Code: code, Message: message})
}

// === User CRUD ===

func (h *Handler) ListUsers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	search := c.Query("search")

	ctx := c.Request.Context()
	users, err := h.userSvc.ListUsers(ctx, tenantID, search, page, pageSize)
	if err != nil {
		h.logger.Error("failed to list users", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, users)
}

func (h *Handler) GetUser(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	user, err := h.userSvc.GetUser(ctx, id, tenantID)
	if err != nil {
		switch err {
		case service.ErrUserNotFound:
			h.err(c, http.StatusNotFound, "user not found")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	// Get user's roles
	roles, err := h.userSvc.GetUserRoles(ctx, id)
	if err != nil {
		h.logger.Warn("failed to get user roles", zap.Error(err))
	}

	type UserWithRoles struct {
		models.User
		Roles []models.Role `json:"roles,omitempty"`
	}

	result := UserWithRoles{User: *user, Roles: roles}
	h.success(c, result)
}

func (h *Handler) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	if err := h.userSvc.UpdateUser(ctx, id, tenantID, req); err != nil {
		switch err {
		case service.ErrUserNotFound:
			h.err(c, http.StatusNotFound, "user not found")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"message": "user updated"})
}

func (h *Handler) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	if err := h.userSvc.DeleteUser(ctx, id, tenantID); err != nil {
		switch err {
		case service.ErrUserNotFound:
			h.err(c, http.StatusNotFound, "user not found")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"message": "user deleted"})
}

func (h *Handler) UpdateUserStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	var req struct {
		Status string `json:"status" binding:"required,oneof=active suspended deleted"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request")
		return
	}

	ctx := c.Request.Context()
	if err := h.userSvc.UpdateUserStatus(ctx, id, tenantID, req.Status); err != nil {
		switch err {
		case service.ErrUserNotFound:
			h.err(c, http.StatusNotFound, "user not found")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"message": "status updated"})
}

// === Role CRUD ===

func (h *Handler) CreateRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	role, err := h.rbacSvc.CreateRole(ctx, req, tenantID)
	if err != nil {
		h.logger.Error("failed to create role", zap.Error(err))
		h.err(c, http.StatusConflict, "role already exists")
		return
	}

	h.success(c, gin.H{"id": role.ID, "name": role.Name})
}

func (h *Handler) ListRoles(c *gin.Context) {
	ctx := c.Request.Context()
	roles, err := h.rbacSvc.ListRoles(ctx)
	if err != nil {
		h.logger.Error("failed to list roles", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, roles)
}

func (h *Handler) GetRole(c *gin.Context) {
	id := c.Param("id")

	ctx := c.Request.Context()
	role, err := h.rbacSvc.GetRole(ctx, id)
	if err != nil {
		switch err {
		case service.ErrRoleNotFound:
			h.err(c, http.StatusNotFound, "role not found")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, role)
}

func (h *Handler) UpdateRole(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	if err := h.rbacSvc.UpdateRole(ctx, id, req); err != nil {
		switch err {
		case service.ErrRoleNotFound:
			h.err(c, http.StatusNotFound, "role not found")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"message": "role updated"})
}

func (h *Handler) DeleteRole(c *gin.Context) {
	id := c.Param("id")

	ctx := c.Request.Context()
	if err := h.rbacSvc.DeleteRole(ctx, id); err != nil {
		switch err {
		case service.ErrRoleNotFound:
			h.err(c, http.StatusNotFound, "role not found")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"message": "role deleted"})
}

// === Permission CRUD ===

func (h *Handler) CreatePermission(c *gin.Context) {
	var req models.CreatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	perm, err := h.rbacSvc.CreatePermission(ctx, req)
	if err != nil {
		h.logger.Error("failed to create permission", zap.Error(err))
		h.err(c, http.StatusConflict, "permission already exists")
		return
	}

	h.success(c, gin.H{"id": perm.ID, "resource": perm.Resource, "action": perm.Action})
}

func (h *Handler) ListPermissions(c *gin.Context) {
	ctx := c.Request.Context()
	perms, err := h.rbacSvc.ListPermissions(ctx)
	if err != nil {
		h.logger.Error("failed to list permissions", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, perms)
}

func (h *Handler) UpdatePermission(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	if err := h.rbacSvc.UpdatePermission(ctx, id, req); err != nil {
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"message": "permission updated"})
}

func (h *Handler) DeletePermission(c *gin.Context) {
	id := c.Param("id")

	ctx := c.Request.Context()
	if err := h.rbacSvc.DeletePermission(ctx, id); err != nil {
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"message": "permission deleted"})
}

// === Role-Permission Assignment ===

func (h *Handler) AssignPermissionToRole(c *gin.Context) {
	var req struct {
		RoleID       string `json:"role_id" binding:"required"`
		PermissionID string `json:"permission_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	if err := h.rbacSvc.AssignPermissionToRole(ctx, req.RoleID, req.PermissionID); err != nil {
		h.logger.Error("failed to assign permission to role", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"message": "permission assigned"})
}

func (h *Handler) RemovePermissionFromRole(c *gin.Context) {
	var req struct {
		RoleID       string `json:"role_id" binding:"required"`
		PermissionID string `json:"permission_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	if err := h.rbacSvc.RemovePermissionFromRole(ctx, req.RoleID, req.PermissionID); err != nil {
		h.logger.Error("failed to remove permission from role", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"message": "permission removed"})
}

func (h *Handler) GetRolePermissions(c *gin.Context) {
	roleID := c.Param("role_id")

	ctx := c.Request.Context()
	perms, err := h.rbacSvc.GetRolePermissions(ctx, roleID)
	if err != nil {
		h.logger.Error("failed to get role permissions", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, perms)
}
