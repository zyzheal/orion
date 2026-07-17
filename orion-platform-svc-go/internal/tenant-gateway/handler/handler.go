package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/tenant-gateway/models"
	"orion/platform-svc-go/internal/tenant-gateway/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all tenant management endpoints under the given group.
// Mirrors 10 endpoints from /api/v1/tenants TS source.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/tenants")

	// POST /tenants - 创建租户
	f.POST("", auth.RequirePermission("tenant", "write"), h.Create)
	// GET /tenants - 查询租户列表
	f.GET("", auth.RequirePermission("tenant", "read"), h.List)
	// GET /tenants/:id - 查询租户详情
	f.GET("/:id", auth.RequirePermission("tenant", "read"), h.Get)
	// PUT /tenants/:id - 更新租户
	f.PUT("/:id", auth.RequirePermission("tenant", "write"), h.Update)
	// DELETE /tenants/:id - 删除租户（软删除）
	f.DELETE("/:id", auth.RequirePermission("tenant", "delete"), h.Delete)
	// POST /tenants/:id/suspend - 暂停租户
	f.POST("/:id/suspend", auth.RequirePermission("tenant", "write"), h.Suspend)
	// POST /tenants/:id/activate - 激活租户
	f.POST("/:id/activate", auth.RequirePermission("tenant", "write"), h.Activate)
	// GET /tenants/:id/quota - 查询租户配额状态
	f.GET("/:id/quota", auth.RequirePermission("tenant", "read"), h.GetQuotaStatus)
	// POST /tenants/:id/quota - 调整租户配额
	f.POST("/:id/quota", auth.RequirePermission("tenant", "write"), h.AdjustQuota)
}

// --- Core CRUD ---

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		h.handleCreateErr(c, err)
		return
	}
	middleware.RespondCreated(c, t)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	t, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "tenant not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	q := models.ListQuery{
		Limit:  parseQueryInt(c, "limit", 100),
		Offset: parseQueryInt(c, "offset", 0),
	}
	if s := c.Query("status"); s != "" {
		q.Status = ptrStatus(models.TenantStatus(s))
	}
	if t := c.Query("tier"); t != "" {
		q.Tier = ptrTier(models.TenantTier(t))
	}
	if p := c.Query("namespace_pool_id"); p != "" {
		q.NamespacePoolID = ptrStr(p)
	}
	result, err := h.svc.List(c.Request.Context(), tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		h.handleUpdateErr(c, err)
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "tenant not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, nil) // c)
}

// --- Lifecycle ---

func (h *Handler) Suspend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	t, err := h.svc.Suspend(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "tenant not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) Activate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	t, err := h.svc.Activate(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "tenant not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// --- Quota ---

func (h *Handler) GetQuotaStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	status, err := h.svc.GetQuotaStatus(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "tenant not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

func (h *Handler) AdjustQuota(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.QuotaAdjustmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.AdjustQuota(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "tenant not found")
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// --- Error helpers ---

func (h *Handler) handleCreateErr(c *gin.Context, err error) {
	if service.IsAlreadyExists(err) {
		middleware.RespondConflict(c, err.Error())
		return
	}
	middleware.RespondInternalError(c, err.Error())
}

func (h *Handler) handleUpdateErr(c *gin.Context, err error) {
	if service.IsNotFound(err) {
		middleware.RespondNotFound(c, "tenant not found")
		return
	}
	if service.IsAlreadyExists(err) {
		middleware.RespondConflict(c, err.Error())
		return
	}
	middleware.RespondInternalError(c, err.Error())
}

// --- Query helpers ---

func parseQueryInt(c *gin.Context, key string, fallback int) int {
	if v := c.Query(key); v != "" {
		n, _ := strconv.Atoi(v)
		if n >= 0 {
			return n
		}
	}
	return fallback
}

func ptrStatus(v models.TenantStatus) *models.TenantStatus {
	return &v
}

func ptrTier(v models.TenantTier) *models.TenantTier {
	return &v
}

func ptrStr(v string) *string {
	return &v
}
