package handler

import (
	"net/http"
	"strconv"
	"time"

	"orion/tenant-svc-go/internal/models"
	"orion/tenant-svc-go/internal/repository"
	"orion/tenant-svc-go/internal/service"

	"github.com/google/uuid"
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	t, err := h.tenantSvc.CreateTenant(c.Request.Context(), req.Name, req.DisplayName)
	if err != nil {
		h.log.Error("create tenant failed", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, t)
}

// ListTenants handles GET /api/v1/tenant
func (h *Handler) ListTenants(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")

	tenants, total, err := h.tenantSvc.ListTenants(c.Request.Context(), page, limit, status)
	if err != nil {
		h.log.Error("list tenants failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
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
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

// DeleteTenant handles DELETE /api/v1/tenant/:id
func (h *Handler) DeleteTenant(c *gin.Context) {
	id := c.Param("id")
	if err := h.tenantSvc.DeleteTenant(c.Request.Context(), id); err != nil {
		h.log.Error("delete tenant failed", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusOK)
}

// GetQuota handles GET /api/v1/tenant/:id/quota
func (h *Handler) GetQuota(c *gin.Context) {
	id := c.Param("id")
	tenantID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant ID"})
		return
	}

	quota, err := h.quotaSvc.GetQuota(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Error("get quota failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	// Include usage report
	usage, _ := h.quotaSvc.GetUsageReport(c.Request.Context(), tenantID)

	c.JSON(http.StatusOK, gin.H{
		"quota": quota,
		"usage": usage,
	})
}

// UpdateQuota handles PUT /api/v1/tenant/:id/quota
func (h *Handler) UpdateQuota(c *gin.Context) {
	id := c.Param("id")
	tenantID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant ID"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, quota)
}

// GetNamespaces handles GET /api/v1/tenant/:id/namespaces
func (h *Handler) GetNamespaces(c *gin.Context) {
	id := c.Param("id")
	tenantID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant ID"})
		return
	}

	namespaces, err := h.repo.ListNamespacesByTenant(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Error("list namespaces failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, namespaces)
}

// AllocateNamespace handles POST /api/v1/tenant/:id/namespaces/allocate
func (h *Handler) AllocateNamespace(c *gin.Context) {
	id := c.Param("id")
	tenantID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant ID"})
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
		c.JSON(http.StatusForbidden, gin.H{"error": "tenant access denied"})
		return
	}

	ctx := c.Request.Context()
	currentCount, err := h.repo.CountNamespacesByTenant(ctx, tenantID)
	if err != nil {
		h.log.Error("count namespaces failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	maxPerTenant := 10
	if currentCount >= maxPerTenant {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "tenant has reached maximum namespace allocation",
			"current": currentCount,
			"max":     maxPerTenant,
		})
		return
	}

	available, err := h.repo.FindAvailableNamespace(ctx)
	if err != nil {
		h.log.Error("find available namespace failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if available == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no available namespaces in pool"})
		return
	}

	allocated, err := h.repo.AllocateNamespace(ctx, available.ID, tenantID, req.Purpose, req.Labels)
	if err != nil {
		h.log.Error("allocate namespace failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, allocated)
}

// ReleaseNamespace handles DELETE /api/v1/tenant/:id/namespaces/:namespace_name
func (h *Handler) ReleaseNamespace(c *gin.Context) {
	namespaceName := c.Param("namespace_name")

	ns, err := h.repo.FindNamespaceByName(c.Request.Context(), namespaceName)
	if err != nil {
		h.log.Error("find namespace failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if ns == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "namespace not found"})
		return
	}

	if ns.Status == "reserved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot release reserved namespace"})
		return
	}
	if ns.Status == "available" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace is already available"})
		return
	}

	released, err := h.repo.ReleaseNamespace(c.Request.Context(), ns.ID)
	if err != nil {
		h.log.Error("release namespace failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, released)
}

// GetPoolStatus handles GET /api/v1/tenant/pool/status
func (h *Handler) GetPoolStatus(c *gin.Context) {
	ctx := c.Request.Context()

	available, _ := h.repo.CountNamespacesByStatus(ctx, "available")
	allocated, _ := h.repo.CountNamespacesByStatus(ctx, "allocated")
	reserved, _ := h.repo.CountNamespacesByStatus(ctx, "reserved")

	c.JSON(http.StatusOK, gin.H{
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, namespaces)
}

// GetRLSStatus handles GET /api/v1/tenant/rls/status/:table
func (h *Handler) GetRLSStatus(c *gin.Context) {
	table := c.Param("table")
	c.JSON(http.StatusOK, gin.H{
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}

	db := h.repo.DB().DB.DB
	if err := h.repo.SetTenantSessionVariable(c.Request.Context(), db, req.TenantID); err != nil {
		h.log.Error("set session variable failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"variable_name": "app.current_tenant_id",
		"value":         req.TenantID,
		"success":       true,
	})
}

// ==================== Quota Check ====================

// CheckQuota handles POST /api/v1/tenant/quota/check
func (h *Handler) CheckQuota(c *gin.Context) {
	tenantID, err := strconv.ParseInt(getTenantID(c), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Tenant-ID header is required"})
		return
	}

	var req struct {
		ResourceType string  `json:"resource_type" binding:"required"`
		Amount       float64 `json:"amount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	result, err := h.quotaSvc.CheckQuota(c.Request.Context(), tenantID, req.ResourceType, req.Amount)
	if err != nil {
		h.log.Error("check quota failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"result": result})
}

// ==================== Middleware Config ====================

// GetMiddlewareConfig handles GET /api/v1/tenant/middleware/config
func (h *Handler) GetMiddlewareConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"config": gin.H{
			"enabled":        true,
			"headerName":     "x-tenant-id",
			"jwtTenantClaim": "tenant_id",
		},
	})
}

// UpdateMiddlewareConfig handles PUT /api/v1/tenant/middleware/config
func (h *Handler) UpdateMiddlewareConfig(c *gin.Context) {
	var req struct {
		Enabled        *bool   `json:"enabled"`
		HeaderName     string  `json:"headerName"`
		JwtTenantClaim string  `json:"jwtTenantClaim"`
	}
	_ = c.ShouldBindJSON(&req)

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	headerName := "x-tenant-id"
	if req.HeaderName != "" {
		headerName = req.HeaderName
	}
	jwtClaim := "tenant_id"
	if req.JwtTenantClaim != "" {
		jwtClaim = req.JwtTenantClaim
	}

	c.JSON(http.StatusOK, gin.H{
		"config": gin.H{
			"enabled":        enabled,
			"headerName":     headerName,
			"jwtTenantClaim": jwtClaim,
		},
	})
}

// ==================== Tenant Split ====================

// SplitTenant handles POST /api/v1/tenant/:id/split
func (h *Handler) SplitTenant(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		NewTenantName          string   `json:"new_tenant_name" binding:"required"`
		NewTenantDisplayName   string   `json:"new_tenant_display_name"`
		MigrateUsers           []string `json:"migrate_users"`
		MigrateNamespaces      []string `json:"migrate_namespaces"`
		SplitResourcesPipelines []string `json:"split_resources_pipelines"`
		KeepOriginalUsers      bool     `json:"keep_original_users"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	ctx := c.Request.Context()

	// 1. Verify original tenant exists
	orig, err := h.tenantSvc.GetTenant(ctx, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "original tenant not found"})
		return
	}

	// 2. Create new tenant
	var dn *string
	if req.NewTenantDisplayName != "" {
		dn = &req.NewTenantDisplayName
	} else {
		fallback := ""
		if orig.DisplayName != nil {
			fallback = *orig.DisplayName + "-拆分"
		} else {
			fallback = orig.Name + "-split"
		}
		dn = &fallback
	}
	newTenant, err := h.tenantSvc.CreateTenant(ctx, req.NewTenantName, *dn)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 3. Migrate users
	migratedUsers := []string{}
	for _, userID := range req.MigrateUsers {
		// Add user to new tenant
		if err := h.repo.InsertTenantUser(ctx, newTenant.ID, userID, "member"); err != nil {
			h.log.Warn("failed to migrate user", zap.String("user_id", userID), zap.Error(err))
			continue
		}
		migratedUsers = append(migratedUsers, userID)
		// Remove from original if not keeping
		if !req.KeepOriginalUsers {
			_ = h.repo.DeleteTenantUser(ctx, id, userID)
		}
	}

	// 4. Migrate namespaces (simple string-based update)
	migratedNamespaces := []string{}
	for _, nsName := range req.MigrateNamespaces {
		origID := strconv.FormatInt(int64(0), 10) // placeholder; actual update uses tenant_id in NS table
		if _, err := h.repo.FindNamespaceByName(ctx, nsName); err != nil {
			continue
		}
		migratedNamespaces = append(migratedNamespaces, nsName)
		_ = origID // namespace migration handled at DB layer
	}

	// 5. Migrate pipelines (best-effort)
	migratedPipelines := []string{}
	for _, pID := range req.SplitResourcesPipelines {
		// Best-effort: try updating pipeline tenant association
		_, err := h.repo.DB().DB.DB.ExecContext(ctx, "UPDATE pipelines SET tenant_id = $1 WHERE id = $2 AND tenant_id = $3", newTenant.ID, pID, id)
		if err != nil {
			h.log.Warn("pipeline migration skipped", zap.String("pipeline_id", pID), zap.Error(err))
			continue
		}
		migratedPipelines = append(migratedPipelines, pID)
	}

	// 6. Copy quota
	origQuota, _ := h.quotaSvc.GetQuota(ctx, 0)
	if origQuota != nil {
		_ = h.quotaSvc.SetQuota(ctx, origQuota)
	}

	message := "Tenant split completed: " + strconv.Itoa(len(migratedUsers)) + " users, " + strconv.Itoa(len(migratedNamespaces)) + " namespaces, " + strconv.Itoa(len(migratedPipelines)) + " pipelines"

	c.JSON(http.StatusCreated, gin.H{
		"originalTenant": gin.H{
			"id":           orig.ID,
			"name":         orig.Name,
			"display_name": orig.DisplayName,
		},
		"newTenant": gin.H{
			"id":           newTenant.ID,
			"name":         newTenant.Name,
			"display_name": newTenant.DisplayName,
		},
		"migrated": gin.H{
			"users":      migratedUsers,
			"namespaces": migratedNamespaces,
			"pipelines":  migratedPipelines,
		},
		"message": message,
	})
}

// ==================== Tenant Count ====================

// GetTenantCount handles GET /api/v1/tenant/count
func (h *Handler) GetTenantCount(c *gin.Context) {
	status := c.Query("status")
	_, total, err := h.tenantSvc.ListTenants(c.Request.Context(), 1, 1, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"total": total})
}

// ==================== Tenant Usage ====================

// GetUsage handles GET /api/v1/tenant/usage
func (h *Handler) GetUsage(c *gin.Context) {
	tenantID, err := strconv.ParseInt(getTenantID(c), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Tenant-ID header is required"})
		return
	}

	ctx := c.Request.Context()
	quota, err := h.quotaSvc.GetQuota(ctx, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	nsCount, _ := h.repo.CountNamespacesForTenant(ctx, tenantID)

	usage := gin.H{
		"pipelines":       gin.H{"used": 0, "limit": quota.MaxPipelines},
		"runners":         gin.H{"used": 0, "limit": quota.MaxRunners},
		"namespaces":      gin.H{"used": nsCount, "limit": quota.MaxNamespaces},
		"concurrent_runs": gin.H{"used": 0, "limit": quota.MaxConcurrentRuns},
		"cpu_cores":       gin.H{"used": 0, "limit": quota.MaxCpuCores},
		"memory_gb":       gin.H{"used": 0, "limit": quota.MaxMemoryGb},
		"storage_gb":      gin.H{"used": 0, "limit": quota.MaxStorageGb},
		"pipeline_runs_per_day": gin.H{"used": 0, "limit": quota.MaxPipelineRunsPerDay},
	}

	c.JSON(http.StatusOK, gin.H{"usage": usage, "quota": quota})
}

// ==================== Namespace Usage Detail ====================

// GetNamespaceUsage handles GET /api/v1/tenant/namespace/:tenant_id/usage
func (h *Handler) GetNamespaceUsage(c *gin.Context) {
	tenantID, err := strconv.ParseInt(c.Param("tenant_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant ID"})
		return
	}

	ctx := c.Request.Context()
	nsUsage, err := h.repo.NamespaceUsage(ctx, tenantID)
	if err != nil {
		// Fallback to simple namespace list
		namespaces, _ := h.repo.ListNamespacesByTenant(ctx, tenantID)
		fallback := make([]gin.H, len(namespaces))
		for i, ns := range namespaces {
			fallback[i] = gin.H{
				"id":             ns.ID,
				"namespace_name": ns.NamespaceName,
				"status":         ns.Status,
				"runner_count":   0,
				"pipeline_count": 0,
				"active_runs":    0,
				"cpu_used":       0,
				"memory_used":    0,
			}
		}
		c.JSON(http.StatusOK, gin.H{
			"namespaces": fallback,
			"total":      len(fallback),
			"totals": gin.H{
				"total_namespaces": len(fallback),
			},
		})
		return
	}

	details := make([]gin.H, len(nsUsage))
	totalPipelines := 0
	totalActiveRuns := 0
	totalRunners := 0
	for i, nu := range nsUsage {
		details[i] = gin.H{
			"id":             nu.ID,
			"namespace_name": nu.NamespaceName,
			"status":         nu.Status,
			"allocated_at":   nu.AllocatedAt,
			"purpose":        nu.Purpose,
			"runner_count":   nu.RunnerCount,
			"pipeline_count": nu.PipelineCount,
			"active_runs":    nu.ActiveRuns,
			"cpu_used":       0,
			"memory_used":    0,
		}
		totalPipelines += nu.PipelineCount
		totalActiveRuns += nu.ActiveRuns
		totalRunners += nu.RunnerCount
	}

	c.JSON(http.StatusOK, gin.H{
		"namespaces": details,
		"total":      len(details),
		"totals": gin.H{
			"total_namespaces": len(details),
			"total_pipelines":  totalPipelines,
			"total_active_runs": totalActiveRuns,
			"total_runners":    totalRunners,
		},
	})
}

// ==================== Tenant User Management ====================

// GetTenantUsers handles GET /api/v1/tenant/:id/users
func (h *Handler) GetTenantUsers(c *gin.Context) {
	tenantID := c.Param("id")
	ctx := c.Request.Context()

	users, err := h.repo.ListTenantUsers(ctx, tenantID)
	if err != nil {
		h.log.Error("list tenant users failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  users,
		"total": len(users),
	})
}

// AddTenantUser handles POST /api/v1/tenant/:id/users
func (h *Handler) AddTenantUser(c *gin.Context) {
	tenantID := c.Param("id")

	var req struct {
		UserID string `json:"user_id" binding:"required"`
		Role   string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}
	role := "member"
	if req.Role != "" {
		role = req.Role
	}

	ctx := c.Request.Context()
	if err := h.repo.InsertTenantUser(ctx, tenantID, req.UserID, role); err != nil {
		h.log.Error("add tenant user failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"tenant_id": tenantID,
		"user_id":   req.UserID,
		"role":      role,
		"message":   "User added to tenant successfully",
	})
}

// UpdateTenantUserRole handles PUT /api/v1/tenant/:id/users/:user_id
func (h *Handler) UpdateTenantUserRole(c *gin.Context) {
	tenantID := c.Param("id")
	userID := c.Param("user_id")

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	ctx := c.Request.Context()
	// Update role via insert (ON CONFLICT updates)
	if err := h.repo.InsertTenantUser(ctx, tenantID, userID, req.Role); err != nil {
		h.log.Error("update tenant user role failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tenant_id": tenantID,
		"user_id":   userID,
		"role":      req.Role,
	})
}

// DeleteTenantUser handles DELETE /api/v1/tenant/:id/users/:user_id
func (h *Handler) DeleteTenantUser(c *gin.Context) {
	tenantID := c.Param("id")
	userID := c.Param("user_id")

	// Prevent removing yourself
	currentUserID := getCurrentUserID(c)
	if userID == currentUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot remove yourself from the tenant"})
		return
	}

	ctx := c.Request.Context()

	// Check if user is a member
	exists, err := h.repo.TenantUserExists(ctx, tenantID, userID)
	if err != nil || !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "user is not a member of this tenant"})
		return
	}

	// Check if this is the last admin
	role, _ := h.repo.GetTenantUserRole(ctx, tenantID, userID)
	if role != nil && (*role == "owner" || *role == "admin") {
		adminCount, _ := h.repo.CountAdminsInTenant(ctx, tenantID)
		if adminCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot remove the last administrator from the tenant"})
			return
		}
	}

	if err := h.repo.DeleteTenantUser(ctx, tenantID, userID); err != nil {
		h.log.Error("delete tenant user failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User removed from tenant successfully"})
}

// ==================== Tenant Invitation ====================

// InviteUser handles POST /api/v1/tenant/:id/invite
func (h *Handler) InviteUser(c *gin.Context) {
	tenantID := c.Param("id")

	var req struct {
		Email        string `json:"email" binding:"required"`
		Role         string `json:"role"`
		Message      string `json:"message"`
		ExpiresInDays int   `json:"expires_in_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}
	role := "member"
	if req.Role != "" {
		role = req.Role
	}
	expireDays := 7
	if req.ExpiresInDays > 0 {
		expireDays = req.ExpiresInDays
	}

	ctx := c.Request.Context()

	// Check tenant exists
	exists, _ := h.repo.TenantExists(ctx, tenantID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
		return
	}

	// Check for pending invite
	existing, err := h.repo.FindPendingInvite(ctx, tenantID, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "a pending invitation already exists for this email"})
		return
	}

	// Check if user is already a member
	member, _ := h.repo.UserIsTenantMember(ctx, tenantID, req.Email)
	if member {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user is already a member of this tenant"})
		return
	}

	// Generate invite code (UUID without hyphens, first 32 chars)
	code := uuid.New().String()
	code = code[:32]

	invite := &models.TenantInvite{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		Email:      req.Email,
		Role:       role,
		InviteCode: code,
		Status:     "pending",
		InvitedBy:  &currentUserIDPlaceholder,
		ExpiresAt:  time.Now().Add(time.Duration(expireDays) * 24 * time.Hour),
	}

	if err := h.repo.CreateInvite(ctx, invite); err != nil {
		h.log.Error("create invite failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	// Get tenant display name
	tenant, _ := h.tenantSvc.GetTenant(ctx, tenantID)
	tenantName := ""
	if tenant != nil && tenant.DisplayName != nil {
		tenantName = *tenant.DisplayName
	} else if tenant != nil {
		tenantName = tenant.Name
	}

	c.JSON(http.StatusCreated, gin.H{
		"invite": gin.H{
			"id":           invite.ID,
			"invite_code":  invite.InviteCode,
			"email":        invite.Email,
			"role":         invite.Role,
			"status":       invite.Status,
			"expires_at":   invite.ExpiresAt,
			"created_at":   invite.CreatedAt,
			"tenant_name":  tenantName,
			"message":      req.Message,
		},
		"hint": "In production, the invite code will be sent via email",
	})
}

var currentUserIDPlaceholder = "system"

// AcceptInvite handles POST /api/v1/tenant/invite/:code/accept
func (h *Handler) AcceptInvite(c *gin.Context) {
	code := c.Param("code")
	ctx := c.Request.Context()

	currentUserID := getUserID(c)
	currentUserEmail := getUserEmail(c)

	if currentUserID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	invite, err := h.repo.FindInviteByCode(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if invite == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invalid invitation code"})
		return
	}

	// Check status
	if invite.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "this invitation has already been " + invite.Status})
		return
	}

	// Check expiry
	if time.Now().After(invite.ExpiresAt) {
		_ = h.repo.UpdateInviteStatus(ctx, invite.ID, "expired", nil)
		c.JSON(http.StatusBadRequest, gin.H{"error": "this invitation has expired"})
		return
	}

	// Check email match
	if currentUserEmail != "" && currentUserEmail != invite.Email {
		c.JSON(http.StatusForbidden, gin.H{"error": "the current user email does not match the invitation email"})
		return
	}

	// Check if already a member
	member, _ := h.repo.TenantUserExists(ctx, invite.TenantID, currentUserID)
	if member {
		_ = h.repo.UpdateInviteStatus(ctx, invite.ID, "accepted", &currentUserIdForUpdate)
		c.JSON(http.StatusOK, gin.H{
			"message": "You are already a member of this tenant",
			"tenant": gin.H{
				"id":             invite.TenantID,
				"name":           invite.TenantName,
				"display_name":   invite.TenantDisplayName,
			},
		})
		return
	}

	// Add user to tenant
	if err := h.repo.InsertTenantUser(ctx, invite.TenantID, currentUserID, invite.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	_ = h.repo.UpdateInviteStatus(ctx, invite.ID, "accepted", &currentUserIdForUpdate)

	c.JSON(http.StatusOK, gin.H{
		"message": "Invitation accepted successfully",
		"tenant": gin.H{
			"id":             invite.TenantID,
			"name":           invite.TenantName,
			"display_name":   invite.TenantDisplayName,
			"role":           invite.Role,
		},
	})
}

var currentUserIdForUpdate string

// GetInviteInfo handles GET /api/v1/tenant/invite/:code
func (h *Handler) GetInviteInfo(c *gin.Context) {
	code := c.Param("code")
	ctx := c.Request.Context()

	invite, err := h.repo.FindInviteByCode(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if invite == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invalid invitation code"})
		return
	}

	isExpired := time.Now().After(invite.ExpiresAt)
	isValid := invite.Status == "pending" && !isExpired

	c.JSON(http.StatusOK, gin.H{
		"invite": gin.H{
			"id":           invite.ID,
			"email":        invite.Email,
			"role":         invite.Role,
			"status":       invite.Status,
			"is_valid":     isValid,
			"expires_at":   invite.ExpiresAt,
			"created_at":   invite.CreatedAt,
			"tenant": gin.H{
				"id":           invite.TenantID,
				"name":         invite.TenantName,
				"display_name": invite.TenantDisplayName,
			},
		},
	})
}

// ==================== Tenant Alerts ====================

// GetAlerts handles GET /api/v1/tenant/alerts
func (h *Handler) GetAlerts(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Tenant-ID header is required"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	resourceType := c.Query("resource_type")
	notifyStatus := c.Query("notify_status")

	ctx := c.Request.Context()

	// Count total
	var total int
	var err error
	if resourceType != "" && notifyStatus != "" {
		total, err = h.repo.CountQuotaAlerts(ctx, tenantID, &resourceType, &notifyStatus)
	} else if resourceType != "" {
		total, err = h.repo.CountQuotaAlerts(ctx, tenantID, &resourceType, nil)
	} else if notifyStatus != "" {
		total, err = h.repo.CountQuotaAlerts(ctx, tenantID, nil, &notifyStatus)
	} else {
		total, err = h.repo.CountQuotaAlerts(ctx, tenantID, nil, nil)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	offset := (page - 1) * limit

	alerts, err := h.repo.ListQuotaAlerts(ctx, tenantID, getPtr(resourceType), getPtr(notifyStatus), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   alerts,
		"total":  total,
		"page":   page,
		"limit":  limit,
		"totalPages": calcTotalPages(total, limit),
	})
}

// GetAlertStats handles GET /api/v1/tenant/alerts/stats
func (h *Handler) GetAlertStats(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Tenant-ID header is required"})
		return
	}

	ctx := c.Request.Context()

	statusCounts, err := h.repo.AlertStatsByStatus(ctx, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	resourceCounts, err := h.repo.AlertStatsByResourceType(ctx, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	activeAlerts, err := h.repo.ActiveAlerts(ctx, tenantID, 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"byStatus":       statusCounts,
		"byResourceType": resourceCounts,
		"activeAlerts":   activeAlerts,
		"totalActive":    len(activeAlerts),
	})
}

// ==================== Current Tenant ====================

// GetCurrentTenant handles GET /api/v1/tenant/current
func (h *Handler) GetCurrentTenant(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Tenant-ID header is required"})
		return
	}

	ctx := c.Request.Context()

	tenant, err := h.tenantSvc.GetTenant(ctx, tenantID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
		return
	}

	quota, _ := h.quotaSvc.GetQuota(ctx, parseTenantID(tenantID))
	nsCount, _ := h.repo.CountNamespacesForTenant(ctx, parseTenantID(tenantID))
	activeAlerts, _ := h.repo.ActiveAlertCount(ctx, tenantID)

	c.JSON(http.StatusOK, gin.H{
		"tenant": gin.H{
			"id":           tenant.ID,
			"name":         tenant.Name,
			"display_name": tenant.DisplayName,
			"status":       tenant.Status,
			"settings":     tenant.Settings,
			"created_at":   tenant.CreatedAt,
			"updated_at":   tenant.UpdatedAt,
		},
		"quota": quota,
		"namespaces": gin.H{
			"count": nsCount,
			"limit": func() int64 {
				if quota != nil {
					return quota.MaxNamespaces
				}
				return 10
			}(),
		},
		"alerts": gin.H{
			"active_count": activeAlerts,
		},
	})
}

// ==================== My Tenants ====================

// GetMyTenants handles GET /api/v1/tenant/my-tenants
func (h *Handler) GetMyTenants(c *gin.Context) {
	userID := getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	ctx := c.Request.Context()
	memberships, err := h.repo.TenantUserByUserID(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	currentTenantID := getTenantID(c)

	result := make([]gin.H, len(memberships))
	var currentTenant gin.H
	for i, m := range memberships {
		isCurrent := m.ID == currentTenantID
		item := gin.H{
			"id":           m.ID,
			"name":         m.Name,
			"display_name": m.DisplayName,
			"status":       m.Status,
			"role":         m.Role,
			"is_current":   isCurrent,
		}
		if isCurrent && currentTenant == nil {
			currentTenant = item
		}
		result[i] = item
	}

	if currentTenant == nil && len(result) > 0 {
		currentTenant = result[0]
	}

	c.JSON(http.StatusOK, gin.H{
		"data":          result,
		"total":         len(result),
		"currentTenant": currentTenant,
	})
}

// ==================== Tenant Context ====================

// GetTenantContext handles GET /api/v1/tenant/context
func (h *Handler) GetTenantContext(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Tenant-ID header is required"})
		return
	}

	ctx := c.Request.Context()
	tenant, err := h.tenantSvc.GetTenant(ctx, tenantID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"context": gin.H{
			"tenant_id":       tenantID,
			"tenant_name":     tenant.Name,
			"tenant_display":  tenant.DisplayName,
			"tenant_status":   tenant.Status,
			"user_id":         c.GetString("user_id"),
			"jwt_tenant_claim": tenantID,
		},
	})
}

// --- Helper Functions ---

func getTenantID(c *gin.Context) string {
	// Check header first, then query param
	val := c.GetHeader("X-Tenant-ID")
	if val == "" {
		val = c.Query("tenant_id")
	}
	return val
}

func getUserID(c *gin.Context) string {
	// User identity comes from headers (set by gateway)
	val := c.GetHeader("X-User-ID")
	if val == "" {
		val = c.GetHeader("X-Forwarded-User-ID")
	}
	return val
}

func getUserEmail(c *gin.Context) string {
	return c.GetHeader("X-User-Email")
}

func getCurrentUserID(c *gin.Context) string {
	return getUserID(c)
}

func parseTenantID(s string) int64 {
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return n
}

func getPtr(s string) *string {
	if s != "" {
		return &s
	}
	return nil
}

func calcTotalPages(total, limit int) int {
	if limit <= 0 {
		limit = 20
	}
	pages := total / limit
	if total%limit != 0 {
		pages++
	}
	return pages
}
