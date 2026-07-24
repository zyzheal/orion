package handler

import (
	"net/http"
	"strconv"

	"orion/platform-svc-go/internal/identity/tenant/models"
	"orion/platform-svc-go/internal/identity/tenant/repository"
	"orion/platform-svc-go/internal/identity/tenant/service"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	tenantSvc     *service.TenantService
	quotaSvc      *service.QuotaService
	isolationSvc  *service.TenantIsolationService
	repo          *repository.TenantRepository
	log           *zap.Logger
}

func New(
	tenantSvc *service.TenantService,
	quotaSvc *service.QuotaService,
	isolationSvc *service.TenantIsolationService,
	repo *repository.TenantRepository,
	log *zap.Logger,
) *Handler {
	return &Handler{
		tenantSvc:     tenantSvc,
		quotaSvc:      quotaSvc,
		isolationSvc:  isolationSvc,
		repo:          repo,
		log:           log,
	}
}

// CreateTenant handles POST /api/v1/tenant
func (h *Handler) CreateTenant(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		DisplayName string `json:"display_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "invalid request body: " + err.Error())
		return
	}

	t, err := h.tenantSvc.CreateTenant(c.Request.Context(), req.Name, req.DisplayName)
	if err != nil {
		h.log.Error("create tenant failed", zap.Error(err))
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, t)
}

// ListTenants handles GET /api/v1/tenant
func (h *Handler) ListTenants(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")

	tenants, total, err := h.tenantSvc.ListTenants(c.Request.Context(), page, limit, status)
	if err != nil {
		h.log.Error("list tenants failed", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}

	respondSuccess(c, gin.H{
		"data":  tenants,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetTenant handles GET /api/v1/tenant/:id
func (h *Handler) GetTenant(c *gin.Context) {
	id := c.Param("id")
	t, err := h.tenantSvc.GetTenant(c.Request.Context(), id)
	if err != nil {
		h.log.Error("get tenant failed", zap.Error(err))
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, t)
}

// UpdateTenant handles PUT /api/v1/tenant/:id
func (h *Handler) UpdateTenant(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Name        *string `json:"name"`
		DisplayName *string `json:"display_name"`
		Status      *string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "invalid request body: " + err.Error())
		return
	}

	updates := map[string]any{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	t, err := h.tenantSvc.UpdateTenant(c.Request.Context(), id, updates)
	if err != nil {
		h.log.Error("update tenant failed", zap.Error(err))
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, t)
}

// DeleteTenant handles DELETE /api/v1/tenant/:id
func (h *Handler) DeleteTenant(c *gin.Context) {
	id := c.Param("id")
	if err := h.tenantSvc.DeleteTenant(c.Request.Context(), id); err != nil {
		h.log.Error("delete tenant failed", zap.Error(err))
		respondBadRequest(c, err.Error())
		return
	}
	c.Status(http.StatusOK)
}

// GetQuota handles GET /api/v1/tenant/:id/quota
func (h *Handler) GetQuota(c *gin.Context) {
	id := c.Param("id")
	tenantID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		respondBadRequest(c, "invalid tenant ID")
		return
	}

	quota, err := h.quotaSvc.GetQuota(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Error("get quota failed", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}

	// Include usage report
	usage, _ := h.quotaSvc.GetUsageReport(c.Request.Context(), tenantID)

	respondSuccess(c, gin.H{
		"quota": quota,
		"usage": usage,
	})
}

// UpdateQuota handles PUT /api/v1/tenant/:id/quota
func (h *Handler) UpdateQuota(c *gin.Context) {
	id := c.Param("id")
	tenantID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		respondBadRequest(c, "invalid tenant ID")
		return
	}

	var req struct {
		MaxPipelines              *int64 `json:"max_pipelines"`
		MaxPipelineRunsPerDay     *int64 `json:"max_pipeline_runs_per_day"`
		MaxConcurrentRuns         *int64 `json:"max_concurrent_runs"`
		MaxTasksPerPipeline       *int64 `json:"max_tasks_per_pipeline"`
		MaxRunners                *int64 `json:"max_runners"`
		MaxCpuCores               *int64 `json:"max_cpu_cores"`
		MaxMemoryGb               *int64 `json:"max_memory_gb"`
		MaxStorageGb              *int64 `json:"max_storage_gb"`
		MaxNamespaces             *int64 `json:"max_namespaces"`
		ApiRateLimit              *int64 `json:"api_rate_limit"`
		ApiRateLimitWindowSeconds *int64 `json:"api_rate_limit_window_seconds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "invalid request body: " + err.Error())
		return
	}

	// Load existing quota and merge
	quota, _ := h.quotaSvc.GetQuota(c.Request.Context(), tenantID)
	if quota == nil {
		quota = &service.TenantQuota{TenantID: tenantID}
	}

	if req.MaxPipelines != nil {
		quota.MaxPipelines = *req.MaxPipelines
	}
	if req.MaxPipelineRunsPerDay != nil {
		quota.MaxPipelineRunsPerDay = *req.MaxPipelineRunsPerDay
	}
	if req.MaxConcurrentRuns != nil {
		quota.MaxConcurrentRuns = *req.MaxConcurrentRuns
	}
	if req.MaxTasksPerPipeline != nil {
		quota.MaxTasksPerPipeline = *req.MaxTasksPerPipeline
	}
	if req.MaxRunners != nil {
		quota.MaxRunners = *req.MaxRunners
	}
	if req.MaxCpuCores != nil {
		quota.MaxCpuCores = *req.MaxCpuCores
	}
	if req.MaxMemoryGb != nil {
		quota.MaxMemoryGb = *req.MaxMemoryGb
	}
	if req.MaxStorageGb != nil {
		quota.MaxStorageGb = *req.MaxStorageGb
	}
	if req.MaxNamespaces != nil {
		quota.MaxNamespaces = *req.MaxNamespaces
	}
	if req.ApiRateLimit != nil {
		quota.ApiRateLimit = *req.ApiRateLimit
	}
	if req.ApiRateLimitWindowSeconds != nil {
		quota.ApiRateLimitWindowSeconds = *req.ApiRateLimitWindowSeconds
	}

	if err := h.quotaSvc.SetQuota(c.Request.Context(), quota); err != nil {
		h.log.Error("update quota failed", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}

	respondSuccess(c, quota)
}

// GetNamespaces handles GET /api/v1/tenant/:id/namespaces
func (h *Handler) GetNamespaces(c *gin.Context) {
	id := c.Param("id")
	tenantID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		respondBadRequest(c, "invalid tenant ID")
		return
	}

	namespaces, err := h.repo.ListNamespacesByTenant(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Error("list namespaces failed", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}

	respondSuccess(c, namespaces)
}

// AllocateNamespace handles POST /api/v1/tenant/:id/namespaces/allocate
func (h *Handler) AllocateNamespace(c *gin.Context) {
	id := c.Param("id")
	tenantID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		respondBadRequest(c, "invalid tenant ID")
		return
	}

	var req struct {
		Purpose string            `json:"purpose"`
		Labels  map[string]string `json:"labels"`
	}
	_ = c.ShouldBindJSON(&req)

	if req.Labels == nil {
		req.Labels = make(map[string]string)
	}
	req.Labels["orion.io/tenant"] = id

	// Validate tenant access
	if !h.isolationSvc.ValidateResourceAccess(tenantID, tenantID) {
		respondForbidden(c, "tenant access denied")
		return
	}

	ctx := c.Request.Context()
	currentCount, err := h.repo.CountNamespacesByTenant(ctx, tenantID)
	if err != nil {
		h.log.Error("count namespaces failed", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}
	maxPerTenant := 10
	if currentCount >= maxPerTenant {
		respondBadRequest(c, "tenant has reached maximum namespace allocation")
		return
	}

	available, err := h.repo.FindAvailableNamespace(ctx)
	if err != nil {
		h.log.Error("find available namespace failed", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}
	if available == nil {
		respondBadRequest(c, "no available namespaces in pool")
		return
	}

	allocated, err := h.repo.AllocateNamespace(ctx, available.ID, tenantID, req.Purpose, req.Labels)
	if err != nil {
		h.log.Error("allocate namespace failed", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}

	respondSuccess(c, allocated)
}

// ReleaseNamespace handles DELETE /api/v1/tenant/:id/namespaces/:namespace_name
func (h *Handler) ReleaseNamespace(c *gin.Context) {
	namespaceName := c.Param("namespace_name")

	ns, err := h.repo.FindNamespaceByName(c.Request.Context(), namespaceName)
	if err != nil {
		h.log.Error("find namespace failed", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}
	if ns == nil {
		respondNotFound(c, "namespace not found")
		return
	}

	if ns.Status == "reserved" {
		respondBadRequest(c, "cannot release reserved namespace")
		return
	}
	if ns.Status == "available" {
		respondBadRequest(c, "namespace is already available")
		return
	}

	released, err := h.repo.ReleaseNamespace(c.Request.Context(), ns.ID)
	if err != nil {
		h.log.Error("release namespace failed", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}

	respondSuccess(c, released)
}

// GetPoolStatus handles GET /api/v1/tenant/pool/status
func (h *Handler) GetPoolStatus(c *gin.Context) {
	ctx := c.Request.Context()

	available, _ := h.repo.CountNamespacesByStatus(ctx, "available")
	allocated, _ := h.repo.CountNamespacesByStatus(ctx, "allocated")
	reserved, _ := h.repo.CountNamespacesByStatus(ctx, "reserved")

	respondSuccess(c, gin.H{
		"total":     100,
		"available": available,
		"allocated": allocated,
		"reserved":  reserved,
	})
}

// GetTenantNamespacesList handles GET /api/v1/tenant/namespaces (admin: list all)
func (h *Handler) GetTenantNamespacesList(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID, _ := strconv.ParseInt(c.Query("tenant_id"), 10, 64)

	var namespaces []models.TenantNamespace
	var err error

	if tenantID > 0 {
		namespaces, err = h.repo.ListNamespacesByTenant(ctx, tenantID)
	} else {
		err = h.repo.DB().SelectContext(ctx, &namespaces, "SELECT * FROM namespace_allocations")
	}
	if err != nil {
		respondInternalError(c, "internal error")
		return
	}

	respondSuccess(c, namespaces)
}

// GetRLSStatus handles GET /api/v1/tenant/rls/status/:table
func (h *Handler) GetRLSStatus(c *gin.Context) {
	table := c.Param("table")
	respondSuccess(c, gin.H{
			"table_name":    table,
			"rls_supported": true,
			"session_var":   "app.current_tenant_id",
		})
}

// SetTenantSessionVariable handles POST /api/v1/tenant/session/variable
func (h *Handler) SetTenantSessionVariable(c *gin.Context) {
	var req struct {
		TenantID int64 `json:"tenant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "tenant_id is required")
		return
	}

	db := h.repo.DB().DB.DB
	if err := h.repo.SetTenantSessionVariable(c.Request.Context(), db, req.TenantID); err != nil {
		h.log.Error("set session variable failed", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}

	respondSuccess(c, gin.H{
		"variable_name": "app.current_tenant_id",
		"value":         req.TenantID,
		"success":       true,
	})
}
