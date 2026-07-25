package handler

import (
	"net/http"
	"strconv"

	"orion/platform-svc-go/internal/config/internal/config/models"
	"orion/platform-svc-go/internal/config/internal/config/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all config management routes.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	c := rg.Group("/configs")

	// CRUD
	c.POST("", auth.RequirePermission("config", "write"), h.Create)
	c.GET("", h.List)
	c.GET("/count", h.Count)
	c.GET("/:id", h.GetByID)
	c.PUT("/:id", auth.RequirePermission("config", "write"), h.Update)
	c.DELETE("/:id", auth.RequirePermission("config", "delete"), h.Delete)

	// Key-based operations
	c.GET("/key/:key", h.GetByKey)
	c.POST("/set", auth.RequirePermission("config", "write"), h.SetConfig)

	// Version history
	c.GET("/:id/history", h.GetConfigHistory)
	c.GET("/key/:key/history", h.GetConfigHistoryByKey)

	// Rollback
	c.POST("/:id/rollback", auth.RequirePermission("config", "execute"), h.Rollback)

	// Diff
	c.POST("/diff/environments", auth.RequirePermission("config", "write"), h.DiffEnvironments)
	c.GET("/:id/diff/versions", h.DiffVersions)

	// Export / Import
	c.GET("/export", h.Export)
	c.POST("/import", auth.RequirePermission("config", "execute"), h.Import)

	// Validation
	c.POST("/validate", auth.RequirePermission("config", "write"), h.Validate)

	// Clone
	c.POST("/:id/clone", auth.RequirePermission("config", "write"), h.Clone)
}

// ==================== CRUD ====================

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.List(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": items})
}

func (h *Handler) GetByID(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "config not found")
		return
	}
		respondSuccess(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body struct {
		Value string `json:"value" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), body.Value)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
		respondSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// ==================== Key-based Operations ====================

// GetByKey retrieves a config by key with optional environment filter.
func (h *Handler) GetByKey(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	key := c.Param("key")
	env := c.Query("environment")

	item, err := h.svc.GetByKey(c.Request.Context(), tenantID, key, env)
	if err != nil {
		respondNotFound(c, "config not found")
		return
	}
		respondSuccess(c, item)
}

// SetConfig creates or updates a config by key (upsert).
func (h *Handler) SetConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.SetConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.SetConfig(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
		respondSuccess(c, item)
}

// ==================== Version History ====================

// GetConfigHistory returns version history for a config by ID.
func (h *Handler) GetConfigHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	versions, err := h.svc.GetConfigHistory(c.Request.Context(), tenantID, c.Param("id"), limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": versions})
}

// GetConfigHistoryByKey returns version history for a config by key.
func (h *Handler) GetConfigHistoryByKey(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	key := c.Param("key")
	env := c.Query("environment")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	versions, err := h.svc.GetConfigHistoryByKey(c.Request.Context(), tenantID, key, env, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": versions})
}

// ==================== Rollback ====================

// Rollback reverts a config to a target version.
func (h *Handler) Rollback(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.RollbackConfig(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrConfigNotFound || err == service.ErrVersionNotFound {
			status = http.StatusNotFound
		} else if err == service.ErrInvalidVersion {
			status = http.StatusBadRequest
		}
		respondError(c, status, err)
		return
	}
	respondSuccess(c, result)
}

// ==================== Diff ====================

// DiffEnvironments compares configs between two environments.
func (h *Handler) DiffEnvironments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.DiffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	report, err := h.svc.DiffEnvironments(c.Request.Context(), tenantID, req.SourceEnv, req.TargetEnv)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, report)
}

// DiffVersions compares two specific versions of a config.
func (h *Handler) DiffVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	fromVer, _ := strconv.Atoi(c.Query("from_version"))
	toVer, _ := strconv.Atoi(c.Query("to_version"))

	report, err := h.svc.DiffVersions(c.Request.Context(), tenantID, c.Param("id"), fromVer, toVer)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, report)
}

// ==================== Export / Import ====================

// Export exports configs as JSON, optionally filtered by environment.
func (h *Handler) Export(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")

	data, err := h.svc.ExportConfigs(c.Request.Context(), tenantID, env)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
		respondSuccess(c, data)
}

// Import bulk-imports config items.
func (h *Handler) Import(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ImportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	created, skipped, errs := h.svc.ImportConfigs(c.Request.Context(), tenantID, req.Items, req.ChangedBy)
	respondSuccess(c, gin.H{
		"created": created,
		"skipped": skipped,
		"errors":  errs,
	})
}

// ==================== Validation ====================

// Validate checks a config value for common issues.
func (h *Handler) Validate(c *gin.Context) {
	var body struct {
		Key         string `json:"key" binding:"required"`
		Value       string `json:"value"`
		Environment string `json:"environment"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result := h.svc.ValidateConfig(c.Request.Context(), body.Key, body.Value, body.Environment)
	respondSuccess(c, result)
}

// ==================== Clone ====================

// Clone copies a config to a different environment.
func (h *Handler) Clone(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body struct {
		TargetEnv string `json:"target_environment" binding:"required"`
		ChangedBy string `json:"changed_by"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.CloneConfig(c.Request.Context(), tenantID, c.Param("id"), body.TargetEnv, body.ChangedBy)
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrConfigNotFound {
			status = http.StatusNotFound
		} else if err == service.ErrAlreadyExists {
			status = http.StatusConflict
		}
		respondError(c, status, err)
		return
	}
	respondCreated(c, item)
}
