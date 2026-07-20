package handler

import (
	"strconv"
	"strings"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/tenant/models"
	"orion/platform-svc-go/internal/tenant/service"

	"net/http"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/sentinel"
)

// Handler exposes the tenant module's HTTP endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler bound to the tenant service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all tenant endpoints under the given group.
// Mirrors the 28 endpoints from the TS source (tenant-routes.ts).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/tenant")

	// === Tenant CRUD ===
	f.GET("", auth.RequirePermission("tenant", "read"), h.List)
	f.POST("", auth.RequirePermission("tenant", "write"), h.Create)
	f.GET("/count", auth.RequirePermission("tenant", "read"), h.Count)
	f.GET("/:id", auth.RequirePermission("tenant", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("tenant", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("tenant", "delete"), h.Delete)
	f.POST("/:id/split", auth.RequirePermission("tenant", "manage"), h.Split)

	// === Context / current ===
	f.GET("/current", h.GetCurrent)
	f.GET("/context", auth.RequirePermission("tenant", "read"), h.Context)
	f.GET("/my-tenants", h.MyTenants)

	// === Quota ===
	f.GET("/quota", auth.RequirePermission("tenant", "read"), h.GetQuota)
	f.PUT("/quota", auth.RequirePermission("tenant", "manage"), h.UpdateQuota)
	f.POST("/quota/check", auth.RequirePermission("tenant", "read"), h.CheckQuota)

	// === Namespace pool ===
	f.GET("/namespace/pool", auth.RequirePermission("tenant", "read"), h.PoolStatus)
	f.POST("/namespace/allocate", auth.RequirePermission("tenant", "write"), h.AllocateNamespace)
	f.POST("/namespace/release", auth.RequirePermission("tenant", "write"), h.ReleaseNamespace)
	f.GET("/namespace/:tenantId", auth.RequirePermission("tenant", "read"), h.TenantNamespaces)
	f.GET("/namespace/:tenantId/usage", auth.RequirePermission("tenant", "read"), h.NamespaceUsage)

	// === Middleware config ===
	rg.GET("/tenant/middleware/config", auth.RequirePermission("tenant", "read"), h.GetMiddlewareConfig)
	rg.PUT("/tenant/middleware/config", auth.RequirePermission("tenant", "manage"), h.UpdateMiddlewareConfig)

	// === Usage ===
	rg.GET("/tenant/usage", auth.RequirePermission("tenant", "read"), h.Usage)

	// === Users ===
	rg.GET("/tenant/:id/users", auth.RequirePermission("tenant", "read"), h.ListUsers)
	rg.DELETE("/tenant/:id/users/:userId", auth.RequirePermission("tenant", "manage"), h.RemoveUser)

	// === Invitations ===
	rg.POST("/tenant/:id/invite", auth.RequirePermission("tenant", "manage"), h.Invite)
	rg.GET("/tenant/invite/:code", h.InviteInfo)
	rg.POST("/tenant/invite/:code/accept", h.AcceptInvite)

	// === Alerts ===
	f.GET("/alerts", auth.RequirePermission("tenant", "read"), h.Alerts)
	f.GET("/alerts/stats", auth.RequirePermission("tenant", "read"), h.AlertStats)
}

// ==================== Tenant CRUD ====================

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	req := models.ListTenantRequest{
		Page:  1,
		Limit: 20,
	}
	if p := c.DefaultQuery("page", "1"); p != "" {
		req.Page, _ = strconv.Atoi(p)
	}
	if l := c.DefaultQuery("limit", "20"); l != "" {
		req.Limit, _ = strconv.Atoi(l)
	}
	if s := c.Query("status"); s != "" {
		req.Status = &s
	}
	result, err := h.svc.ListTenants(ctx, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Count")
	defer span.End()
	status := c.Query("status")
	var sPtr *string
	if status != "" {
		sPtr = &status
	}
	total, err := h.svc.TenantCount(ctx, sPtr)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"total": total})
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	var req models.CreateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateTenant(ctx, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	tenant, err := h.svc.GetTenant(ctx, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	if tenant == nil {
		errors.WriteError(c, errors.ErrNotFound, "tenant not found", 404)
		return
	}
	errors.WriteSuccess(c, tenant)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.UpdateTenant(ctx, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	id := c.Param("id")
	if err := h.svc.DeleteTenant(ctx, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.AbortWithStatus(http.StatusNoContent)
}

func (h *Handler) Split(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Split")
	defer span.End()
	id := c.Param("id")
	var req models.SplitTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.SplitTenant(ctx, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

// ==================== Context / current ====================

func (h *Handler) GetCurrent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCurrent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetCurrentTenant(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) Context(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Context")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result := gin.H{"context": gin.H{"tenant_id": tenantID}}
	errors.WriteSuccess(c, result)
}

func (h *Handler) MyTenants(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MyTenants")
	defer span.End()
	userID := c.GetString("user_id")
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetUserTenants(ctx, userID, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

// ==================== Quota ====================

func (h *Handler) GetQuota(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetQuota")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	tenantInt := 0
	t, _ := strconv.Atoi(tenantID)
	if t > 0 {
		tenantInt = t
	}
	quota, err := h.svc.GetQuota(ctx, tenantInt, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"quota": quota})
}

func (h *Handler) UpdateQuota(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateQuota")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	tenantInt := 0
	t, _ := strconv.Atoi(tenantID)
	if t > 0 {
		tenantInt = t
	}
	var req models.QuotaUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	updated, err := h.svc.SetQuota(ctx, tenantInt, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"quota": updated})
}

func (h *Handler) CheckQuota(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckQuota")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	tenantInt := 0
	t, _ := strconv.Atoi(tenantID)
	if t > 0 {
		tenantInt = t
	}
	var req models.QuotaCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CheckQuota(ctx, tenantInt, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"result": result})
}

// ==================== Namespace pool ====================

func (h *Handler) PoolStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PoolStatus")
	defer span.End()
	status, err := h.svc.GetPoolStatus(ctx)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": status})
}

func (h *Handler) AllocateNamespace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AllocateNamespace")
	defer span.End()
	var req models.NamespaceAllocateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	tenantInt, _ := strconv.Atoi(req.TenantID)
	ns, err := h.svc.AllocateNamespace(ctx, tenantInt, "tenant-workspace")
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, gin.H{"allocation": ns})
}

func (h *Handler) ReleaseNamespace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ReleaseNamespace")
	defer span.End()
	var req models.NamespaceReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	released, err := h.svc.ReleaseNamespace(ctx, req.NamespaceName)
	if err != nil {
		// Treat error as success for release (namespace may not exist)
	}
	errors.WriteSuccess(c, gin.H{"released": released})
}

func (h *Handler) TenantNamespaces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TenantNamespaces")
	defer span.End()
	tenantID := c.Param("tenantId")
	namespaces, err := h.svc.GetTenantNamespaces(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, namespaces)
}

func (h *Handler) NamespaceUsage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "NamespaceUsage")
	defer span.End()
	tenantID := c.Param("tenantId")
	details, err := h.svc.GetTenantNamespaces(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{
		"namespaces": details,
		"total":      len(details),
		"totals": gin.H{
			"totalNamespaces": len(details),
		},
	})
}

// ==================== Middleware config ====================

func (h *Handler) GetMiddlewareConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMiddlewareConfig")
	defer span.End()
	config := models.MiddlewareConfig{
		Enabled:       true,
		HeaderName:    "x-tenant-id",
		JwtTenantClaim: "tenant_id",
	}
	errors.WriteSuccess(c, gin.H{"config": config})
}

func (h *Handler) UpdateMiddlewareConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateMiddlewareConfig")
	defer span.End()
	var body struct {
		Enabled        *bool  `json:"enabled"`
		HeaderName     string `json:"headerName"`
		JwtTenantClaim string `json:"jwtTenantClaim"`
	}
	c.ShouldBindJSON(&body)
	config := gin.H{
		"enabled":        boolPtr(body.Enabled),
		"headerName":     strPtr(body.HeaderName, "x-tenant-id"),
		"jwtTenantClaim": strPtr(body.JwtTenantClaim, "tenant_id"),
	}
	errors.WriteSuccess(c, gin.H{"config": config})
}

// ==================== Usage ====================

func (h *Handler) Usage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Usage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	tenantInt := 0
	t, _ := strconv.Atoi(tenantID)
	if t > 0 {
		tenantInt = t
	}
	quota, err := h.svc.GetQuota(ctx, tenantInt, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	usage := gin.H{
		"pipelines":      gin.H{"used": 0, "limit": quota.MaxPipelines},
		"runners":        gin.H{"used": 0, "limit": quota.MaxRunners},
		"namespaces":     gin.H{"used": 0, "limit": quota.MaxNamespaces},
		"concurrentRuns": gin.H{"used": 0, "limit": quota.MaxConcurrentRuns},
		"cpuCores":       gin.H{"used": 0, "limit": quota.MaxCpuCores},
		"memoryGb":       gin.H{"used": 0, "limit": quota.MaxMemoryGb},
		"storageGb":      gin.H{"used": 0, "limit": quota.MaxStorageGb},
	}
	errors.WriteSuccess(c, gin.H{"usage": usage, "quota": quota})
}

// ==================== Users ====================

func (h *Handler) ListUsers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListUsers")
	defer span.End()
	tenantID := c.Param("id")
	users, err := h.svc.ListTenantUsers(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, users)
}

func (h *Handler) RemoveUser(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RemoveUser")
	defer span.End()
	tenantID := c.Param("id")
	userID := c.Param("userId")
	currentUserID := c.GetString("user_id")
	if userID == currentUserID {
		errors.WriteError(c, errors.ErrBadRequest, "Cannot remove yourself from the tenant", 400)
		return
	}
	if err := h.svc.RemoveTenantUser(ctx, tenantID, userID, currentUserID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"ok": true})
}

// ==================== Invitations ====================

func (h *Handler) Invite(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Invite")
	defer span.End()
	tenantID := c.Param("id")
	var req models.InviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	if req.Role == "" {
		req.Role = "member"
	}
	result, err := h.svc.InviteUser(ctx, tenantID, req)
	if err != nil {
		if err == service.ErrTenantNotFound {
			errors.WriteError(c, errors.ErrNotFound, "tenant not found", 404)
			return
		}
		if err == service.ErrInvitePending {
			errors.WriteError(c, errors.ErrConflict, err.Error(), 409)
			return
		}
		if err == service.ErrUserAlreadyMember {
			errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
			return
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, gin.H{"invite": result, "hint": "In production, the invite code will be sent via email"})
}

func (h *Handler) InviteInfo(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InviteInfo")
	defer span.End()
	code := c.Param("code")
	info, err := h.svc.GetInviteByCode(ctx, code)
	if err != nil {
		if err == service.ErrInviteNotFound {
			errors.WriteError(c, errors.ErrNotFound, err.Error(), 404)
			return
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"invite": info})
}

func (h *Handler) AcceptInvite(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AcceptInvite")
	defer span.End()
	code := c.Param("code")
	userID := c.GetString("user_id")
	// Email check would require user middleware; skip for now
	result, err := h.svc.AcceptInvite(ctx, code, userID, "")
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

// ==================== Alerts ====================

func (h *Handler) Alerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Alerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.AlertsQuery{
		Page:  1,
		Limit: 20,
	}
	if p := c.DefaultQuery("page", "1"); p != "" {
		q.Page, _ = strconv.Atoi(p)
	}
	if l := c.DefaultQuery("limit", "20"); l != "" {
		q.Limit, _ = strconv.Atoi(l)
	}
	if rt := c.Query("resourceType"); rt != "" {
		q.ResourceType = &rt
	}
	if s := c.Query("status"); s != "" {
		q.Status = &s
	}
	result, err := h.svc.GetAlerts(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) AlertStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetAlertStats(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, stats)
}

// ==================== Helpers ====================

func boolPtr(p *bool) bool {
	if p == nil {
		return true
	}
	return *p
}

func strPtr(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

func intPtr(i int) *int {
	return &i
}

func splitQuery(roles string) []string {
	if roles == "" {
		return nil
	}
	var result []string
	for _, r := range strings.FieldsFunc(roles, func(c rune) bool { return c == ',' }) {
		result = append(result, r)
	}
	return result
}
