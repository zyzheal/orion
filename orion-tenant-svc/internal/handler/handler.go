package handler

import (
	"net/http"
	"strconv"

	"orion/tenant-svc/internal/config"
	"orion/tenant-svc/internal/models"
	"orion/tenant-svc/internal/repository"
	"orion/tenant-svc/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// Handler handles HTTP requests for the tenant service.
type Handler struct {
	repo    *repository.TenantRepository
	svc     *service.TenantService
	logger  *zap.Logger
	cfg     *config.Config
}

// New creates a new Handler.
func New(db *sqlx.DB, logger *zap.Logger, cfg *config.Config) *Handler {
	repo := repository.NewTenantRepository(db)
	return &Handler{
		repo:   repo,
		svc:    service.NewTenantService(repo),
		logger: logger,
		cfg:    cfg,
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

func (h *Handler) CreateTenant(c *gin.Context) {
	var req models.CreateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	tenant, err := h.svc.Create(ctx, req)
	if err != nil {
		switch err {
		case service.ErrTenantExists:
			h.err(c, http.StatusConflict, "tenant name already exists")
		default:
			h.logger.Error("failed to create tenant", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"id": tenant.ID, "name": tenant.Name})
}

func (h *Handler) ListTenants(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	ctx := c.Request.Context()
	tenants, err := h.svc.List(ctx, page, pageSize)
	if err != nil {
		h.logger.Error("failed to list tenants", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, tenants)
}

func (h *Handler) GetTenant(c *gin.Context) {
	id := c.Param("id")

	ctx := c.Request.Context()
	tenant, err := h.svc.GetByID(ctx, id)
	if err != nil {
		switch err {
		case service.ErrTenantNotFound:
			h.err(c, http.StatusNotFound, "tenant not found")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, tenant)
}

func (h *Handler) UpdateTenant(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request")
		return
	}

	ctx := c.Request.Context()
	if err := h.svc.Update(ctx, id, req); err != nil {
		switch err {
		case service.ErrTenantNotFound:
			h.err(c, http.StatusNotFound, "tenant not found")
		default:
			h.logger.Error("failed to update tenant", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"message": "tenant updated"})
}

func (h *Handler) DeleteTenant(c *gin.Context) {
	id := c.Param("id")

	ctx := c.Request.Context()
	if err := h.svc.Delete(ctx, id); err != nil {
		switch err {
		case service.ErrTenantNotFound:
			h.err(c, http.StatusNotFound, "tenant not found")
		default:
			h.logger.Error("failed to delete tenant", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
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
		h.err(c, http.StatusBadRequest, "invalid request")
		return
	}

	ctx := c.Request.Context()
	if err := h.svc.UpdateStatus(ctx, id, req.Status); err != nil {
		switch err {
		case service.ErrTenantNotFound:
			h.err(c, http.StatusNotFound, "tenant not found")
		case service.ErrInvalidStatus:
			h.err(c, http.StatusBadRequest, "invalid status")
		default:
			h.logger.Error("failed to update tenant status", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"message": "status updated"})
}

func (h *Handler) GetMyTenant(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	tenant, err := h.svc.GetByID(ctx, tenantID)
	if err != nil {
		switch err {
		case service.ErrTenantNotFound:
			h.err(c, http.StatusNotFound, "tenant not found")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, tenant)
}

func (h *Handler) UpdateTenantSettings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request")
		return
	}

	ctx := c.Request.Context()
	if err := h.svc.UpdateSettings(ctx, tenantID, req.DisplayName); err != nil {
		switch err {
		case service.ErrTenantNotFound:
			h.err(c, http.StatusNotFound, "tenant not found")
		default:
			h.logger.Error("failed to update tenant settings", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"message": "settings updated"})
}

func (h *Handler) GetQuota(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	ctx := c.Request.Context()
	tenant, err := h.svc.GetByID(ctx, tenantID)
	if err != nil {
		switch err {
		case service.ErrTenantNotFound:
			h.err(c, http.StatusNotFound, "tenant not found")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	// In production, query the user count from orion_user database
	// For now return the tenant quota
	h.success(c, gin.H{
		"users_used":      0,
		"users_quota":     tenant.QuotaUsers,
		"storage_used_mb": 0,
		"storage_quota_mb": tenant.QuotaStorageMB,
	})
}
