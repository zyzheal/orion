package handler

import (
	"net/http"
	"time"

	"orion/user-svc/internal/config"
	"orion/user-svc/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type Handler struct {
	db     *sqlx.DB
	rdb    *redis.Client
	logger *zap.Logger
	cfg    *config.Config
}

func New(db *sqlx.DB, rdb *redis.Client, logger *zap.Logger, cfg *config.Config) *Handler {
	return &Handler{db: db, rdb: rdb, logger: logger, cfg: cfg}
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func (h *Handler) error(c *gin.Context, code int, message string) {
	c.JSON(code, Response{Code: code, Message: message})
}

// === User CRUD ===

func (h *Handler) ListUsers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("page_size", "20")
	search := c.Query("search")

	query := `SELECT id, tenant_id, email, display_name, role, status, created_at FROM users
	          WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argCount := 1

	if search != "" {
		argCount++
		query += " AND (email LIKE $" + itoa(argCount) + " OR display_name LIKE $" + itoa(argCount) + ")"
		args = append(args, "%"+search+"%")
	}

	query += " ORDER BY created_at DESC"
	argCount++
	query += " LIMIT $" + itoa(argCount)
	args = append(args, atoi(pageSize))
	argCount++
	query += " OFFSET $" + itoa(argCount)
	args = append(args, (atoi(page)-1)*atoi(pageSize))

	var users []models.User
	err := h.db.Select(&users, query, args...)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, users)
}

func (h *Handler) GetUser(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var user models.User
	err := h.db.Get(&user, "SELECT id, tenant_id, email, display_name, role, status, created_at, updated_at FROM users WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		h.error(c, http.StatusNotFound, "user not found")
		return
	}

	// Get user's roles
	var roles []string
	_ = h.db.Select(&roles, `SELECT r.name FROM roles r
	                          JOIN user_roles ur ON r.id = ur.role_id
	                          WHERE ur.user_id = $1`, id)
	user.Roles = roles

	h.success(c, user)
}

func (h *Handler) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}

	_, err := h.db.Exec(
		"UPDATE users SET display_name = $1, role = $2, status = $3, updated_at = now() WHERE id = $4 AND tenant_id = $5",
		req.DisplayName, req.Role, req.Status, id, tenantID,
	)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "user updated"})
}

func (h *Handler) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	_, err := h.db.Exec("UPDATE users SET status = 'deleted', updated_at = now() WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
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
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}
	_, err := h.db.Exec("UPDATE users SET status = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3", req.Status, id, tenantID)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "status updated"})
}

// === Role CRUD ===

func (h *Handler) CreateRole(c *gin.Context) {
	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}

	var id string
	err := h.db.Get(&id,
		"INSERT INTO roles (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id",
		"00000000-0000-0000-0000-000000000000", req.Name, req.Description,
	)
	if err != nil {
		h.error(c, http.StatusConflict, "role already exists")
		return
	}
	h.success(c, gin.H{"id": id})
}

func (h *Handler) ListRoles(c *gin.Context) {
	var roles []models.Role
	err := h.db.Select(&roles, "SELECT * FROM roles ORDER BY created_at DESC")
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, roles)
}

func (h *Handler) GetRole(c *gin.Context) {
	id := c.Param("id")
	var role models.Role
	err := h.db.Get(&role, "SELECT * FROM roles WHERE id = $1", id)
	if err != nil {
		h.error(c, http.StatusNotFound, "role not found")
		return
	}
	h.success(c, role)
}

func (h *Handler) UpdateRole(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}
	_, err := h.db.Exec("UPDATE roles SET name = $1, description = $2, updated_at = now() WHERE id = $3", req.Name, req.Description, id)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "role updated"})
}

func (h *Handler) DeleteRole(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec("DELETE FROM roles WHERE id = $1", id)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "role deleted"})
}

// === Permission CRUD ===

func (h *Handler) CreatePermission(c *gin.Context) {
	var req models.CreatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}

	var id string
	err := h.db.Get(&id,
		"INSERT INTO permissions (resource, action, description) VALUES ($1, $2, $3) RETURNING id",
		req.Resource, req.Action, req.Description,
	)
	if err != nil {
		h.error(c, http.StatusConflict, "permission already exists")
		return
	}
	h.success(c, gin.H{"id": id})
}

func (h *Handler) ListPermissions(c *gin.Context) {
	var perms []models.Permission
	err := h.db.Select(&perms, "SELECT * FROM permissions ORDER BY resource, action")
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, perms)
}

func (h *Handler) UpdatePermission(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}
	_, err := h.db.Exec("UPDATE permissions SET resource = $1, action = $2, description = $3 WHERE id = $4", req.Resource, req.Action, req.Description, id)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "permission updated"})
}

func (h *Handler) DeletePermission(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec("DELETE FROM permissions WHERE id = $1", id)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
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
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}
	_, err := h.db.Exec("INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", req.RoleID, req.PermissionID)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
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
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}
	_, err := h.db.Exec("DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2", req.RoleID, req.PermissionID)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "permission removed"})
}

func (h *Handler) GetRolePermissions(c *gin.Context) {
	roleID := c.Param("role_id")
	var perms []models.Permission
	err := h.db.Select(&perms, `SELECT p.* FROM permissions p
	                             JOIN role_permissions rp ON p.id = rp.permission_id
	                             WHERE rp.role_id = $1`, roleID)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, perms)
}

func atoi(s string) int {
	var n int
	_, _ = fmt.Sscanf(s, "%d", &n)
	return n
}

func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}
