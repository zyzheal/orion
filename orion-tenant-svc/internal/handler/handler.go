package handler

import (
	"net/http"
	"time"

	"orion/tenant-svc/internal/config"
	"orion/tenant-svc/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type Handler struct {
	db     *sqlx.DB
	logger *zap.Logger
	cfg    *config.Config
}

func New(db *sqlx.DB, logger *zap.Logger, cfg *config.Config) *Handler {
	return &Handler{db: db, logger: logger, cfg: cfg}
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

func (h *Handler) CreateTenant(c *gin.Context) {
	var req models.CreateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	var id string
	err := h.db.Get(&id,
		"INSERT INTO tenants (name, display_name, status, quota_users, quota_storage_mb) VALUES ($1, $2, $3, $4, $5) RETURNING id",
		req.Name, req.DisplayName, "active", req.QuotaUsers, req.QuotaStorageMB,
	)
	if err != nil {
		h.logger.Error("failed to create tenant", zap.Error(err))
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"id": id})
}

func (h *Handler) ListTenants(c *gin.Context) {
	var tenants []models.Tenant
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("page_size", "20")

	err := h.db.Select(&tenants,
		"SELECT id, name, display_name, status, quota_users, quota_storage_mb, created_at FROM tenants ORDER BY created_at DESC LIMIT $1 OFFSET $2",
		pageSize, (atoi(page)-1)*atoi(pageSize),
	)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, tenants)
}

func (h *Handler) GetTenant(c *gin.Context) {
	id := c.Param("id")
	var tenant models.Tenant
	err := h.db.Get(&tenant, "SELECT * FROM tenants WHERE id = $1", id)
	if err != nil {
		h.error(c, http.StatusNotFound, "tenant not found")
		return
	}
	h.success(c, tenant)
}

func (h *Handler) UpdateTenant(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}

	_, err := h.db.Exec(
		"UPDATE tenants SET display_name = $1, status = $2, updated_at = now() WHERE id = $3",
		req.DisplayName, req.Status, id,
	)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "tenant updated"})
}

func (h *Handler) DeleteTenant(c *gin.Context) {
	id := c.Param("id")
	_, err := h.db.Exec("UPDATE tenants SET status = 'deleted', updated_at = now() WHERE id = $1", id)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "tenant deleted"})
}

func (h *Handler) UpdateTenantStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status string `json:"status" binding:"required,oneof=active suspended deleted"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}
	_, err := h.db.Exec("UPDATE tenants SET status = $1, updated_at = now() WHERE id = $2", req.Status, id)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "status updated"})
}

func (h *Handler) GetMyTenant(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var tenant models.Tenant
	err := h.db.Get(&tenant, "SELECT * FROM tenants WHERE id = $1", tenantID)
	if err != nil {
		h.error(c, http.StatusNotFound, "tenant not found")
		return
	}
	h.success(c, tenant)
}

func (h *Handler) UpdateTenantSettings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}
	_, err := h.db.Exec(
		"UPDATE tenants SET display_name = $1, updated_at = now() WHERE id = $2",
		req.DisplayName, tenantID,
	)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "settings updated"})
}

func (h *Handler) GetQuota(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var tenant models.Tenant
	err := h.db.Get(&tenant, "SELECT quota_users, quota_storage_mb FROM tenants WHERE id = $1", tenantID)
	if err != nil {
		h.error(c, http.StatusNotFound, "tenant not found")
		return
	}

	var userCount int
	_ = h.db.Get(&userCount, "SELECT COUNT(*) FROM users WHERE tenant_id = $1", tenantID)

	h.success(c, gin.H{
		"users_used":      userCount,
		"users_quota":     tenant.QuotaUsers,
		"storage_used_mb": 0,
		"storage_quota_mb": tenant.QuotaStorageMB,
	})
}

func atoi(s string) int {
	var n int
	_, _ = fmt.Sscanf(s, "%d", &n)
	return n
}
