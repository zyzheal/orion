package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/identity/user/config"
	"orion/platform-svc-go/internal/identity/user/models"
	"orion/platform-svc-go/internal/identity/user/repository"
	"orion/platform-svc-go/internal/identity/user/service"
)

// Handler handles HTTP requests for the user service.
type Handler struct {
	userRepo *repository.UserRepository
	roleRepo *repository.RoleRepository
	permRepo *repository.PermissionRepository
	userSvc  *service.UserService
	rbacSvc  *service.RBACService
	rdb      *redis.Client
	logger   *zap.Logger
	cfg      *config.Config
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
	respondSuccess(c, data)
}

func (h *Handler) err(c *gin.Context, code int, message string) {
	respondInternalError(c, message)
}

// === User CRUD ===

func (h *Handler) ListUsers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserListUsers")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	search := c.Query("search")

	users, err := h.userSvc.ListUsers(ctx, tenantID, search, page, pageSize)
	if err != nil {
		h.logger.Error("failed to list users", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, users)
}

func (h *Handler) GetUser(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserGetUser")
	defer span.End()
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserUpdateUser")
	defer span.End()
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserDeleteUser")
	defer span.End()
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserUpdateUserStatus")
	defer span.End()
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	var req struct {
		Status string `json:"status" binding:"required,oneof=active suspended deleted"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request")
		return
	}

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserCreateRole")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	role, err := h.rbacSvc.CreateRole(ctx, req, tenantID)
	if err != nil {
		h.logger.Error("failed to create role", zap.Error(err))
		h.err(c, http.StatusConflict, "role already exists")
		return
	}

	h.success(c, gin.H{"id": role.ID, "name": role.Name})
}

func (h *Handler) ListRoles(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserListRoles")
	defer span.End()
	roles, err := h.rbacSvc.ListRoles(ctx)
	if err != nil {
		h.logger.Error("failed to list roles", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, roles)
}

func (h *Handler) GetRole(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserGetRole")
	defer span.End()
	id := c.Param("id")

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserUpdateRole")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserDeleteRole")
	defer span.End()
	id := c.Param("id")

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserCreatePermission")
	defer span.End()
	var req models.CreatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	perm, err := h.rbacSvc.CreatePermission(ctx, req)
	if err != nil {
		h.logger.Error("failed to create permission", zap.Error(err))
		h.err(c, http.StatusConflict, "permission already exists")
		return
	}

	h.success(c, gin.H{"id": perm.ID, "resource": perm.Resource, "action": perm.Action})
}

func (h *Handler) ListPermissions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserListPermissions")
	defer span.End()
	perms, err := h.rbacSvc.ListPermissions(ctx)
	if err != nil {
		h.logger.Error("failed to list permissions", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, perms)
}

func (h *Handler) UpdatePermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserUpdatePermission")
	defer span.End()
	id := c.Param("id")
	var req models.UpdatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	if err := h.rbacSvc.UpdatePermission(ctx, id, req); err != nil {
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"message": "permission updated"})
}

func (h *Handler) DeletePermission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserDeletePermission")
	defer span.End()
	id := c.Param("id")

	if err := h.rbacSvc.DeletePermission(ctx, id); err != nil {
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"message": "permission deleted"})
}

// === Role-Permission Assignment ===

func (h *Handler) AssignPermissionToRole(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserAssignPermissionToRole")
	defer span.End()
	var req struct {
		RoleID       string `json:"role_id" binding:"required"`
		PermissionID string `json:"permission_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	if err := h.rbacSvc.AssignPermissionToRole(ctx, req.RoleID, req.PermissionID); err != nil {
		h.logger.Error("failed to assign permission to role", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"message": "permission assigned"})
}

func (h *Handler) RemovePermissionFromRole(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserRemovePermissionFromRole")
	defer span.End()
	var req struct {
		RoleID       string `json:"role_id" binding:"required"`
		PermissionID string `json:"permission_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	if err := h.rbacSvc.RemovePermissionFromRole(ctx, req.RoleID, req.PermissionID); err != nil {
		h.logger.Error("failed to remove permission from role", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"message": "permission removed"})
}

func (h *Handler) GetRolePermissions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IdentityUserGetRolePermissions")
	defer span.End()
	roleID := c.Param("role_id")

	perms, err := h.rbacSvc.GetRolePermissions(ctx, roleID)
	if err != nil {
		h.logger.Error("failed to get role permissions", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, perms)
}
