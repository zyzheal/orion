package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/plugin/models"
	"orion/platform-svc-go/internal/plugin/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes wires up every endpoint the TS plugin-routes.ts defines
// under the /api/v1 plugins group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// /api/v1/plugins/<routes>
	r := rg.Group("/plugins")

	// Core CRUD (existing)
	r.POST("", auth.RequirePermission("plugin", "write"), h.Create)
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.DELETE("/:id", auth.RequirePermission("plugin", "delete"), h.Delete)
	r.PATCH("/:id", auth.RequirePermission("plugin", "write"), h.Update)
	r.GET("/count", h.Count)

	// Plugin management actions
	r.POST("/:pluginId/install", auth.RequirePermission("plugin", "write"), h.Install)
	r.POST("/:pluginId/enable", auth.RequirePermission("plugin", "write"), h.Enable)
	r.POST("/:pluginId/disable", auth.RequirePermission("plugin", "write"), h.Disable)

	// Audit (note: /:runId/timeline and /:runId/debug/* must come AFTER
	// /:pluginId/<action> so the explicit :pluginId routes match first;
	// we split on action suffixes rather than the id).
	r.GET("/audit", h.Audit)
	r.GET("/audit/:taskId/trail", h.AuditTrail)

	// Execution timeline + debug (uses :runId param).
	r.GET("/:runId/timeline", h.Timeline)
	r.POST("/:runId/debug/pause", auth.RequirePermission("plugin", "manage"), h.DebugPause)
	r.POST("/:runId/debug/resume", auth.RequirePermission("plugin", "manage"), h.DebugResume)
	r.POST("/:runId/debug/step", auth.RequirePermission("plugin", "manage"), h.DebugStep)
	r.GET("/:runId/debug/state", h.DebugState)

	// AI diagnosis
	r.POST("/ai-diagnose", auth.RequirePermission("plugin", "execute"), h.AIDiagnose)

	// Quotas
	r.PUT("/quotas/:pluginId", auth.RequirePermission("plugin", "write"), h.UpsertPluginQuota)
	r.GET("/quotas/:pluginId", h.PluginQuota)
	r.DELETE("/quotas/:pluginId", auth.RequirePermission("plugin", "delete"), h.DeletePluginQuota)

	// Security events
	r.POST("/security-events", auth.RequirePermission("plugin", "write"), h.CreateSecurityEvent)
	r.GET("/security-events", h.ListSecurityEvents)
}

// ===========================================================================
// CRUD (existing handlers)
// ===========================================================================

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePluginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.List(ctx, tenantID, (page-1)*ps, ps)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	d, err := h.svc.GetByID(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Count")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

// ===========================================================================
// Plugin management
// ===========================================================================

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdatePluginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	updated, err := h.svc.Update(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, updated)
}

func (h *Handler) Install(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Install")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pluginID := c.Param("pluginId")
	var body struct {
		Version string       `json:"version"`
		Config  models.JSONB `json:"config"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		// Empty body is acceptable; use defaults.
	}
	if body.Version == "" {
		body.Version = "latest"
	}
	p, err := h.svc.Install(ctx, tenantID, pluginID, body.Version, body.Config)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"pluginId": pluginID, "action": "install", "version": body.Version, "plugin": p})
}

func (h *Handler) Enable(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Enable")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pluginID := c.Param("pluginId")
	p, err := h.svc.Enable(ctx, tenantID, pluginID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"pluginId": pluginID, "action": "enable", "status": "active", "plugin": p})
}

func (h *Handler) Disable(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Disable")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pluginID := c.Param("pluginId")
	p, err := h.svc.Disable(ctx, tenantID, pluginID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"pluginId": pluginID, "action": "disable", "status": "inactive", "plugin": p})
}

// ===========================================================================
// Audit
// ===========================================================================

func (h *Handler) Audit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Audit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pluginID := c.Query("plugin_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	logs, err := h.svc.ListAuditEntries(ctx, tenantID, pluginID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"logs": logs, "tenantId": tenantID, "limit": limit})
}

func (h *Handler) AuditTrail(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AuditTrail")
	defer span.End()
	taskID := c.Param("taskId")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	logs, err := h.svc.AuditTrail(ctx, taskID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"taskId": taskID, "logs": logs})
}

// ===========================================================================
// Execution timeline + debug
// ===========================================================================

func (h *Handler) Timeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Timeline")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	execution, err := h.svc.GetExecutionByTaskID(ctx, tenantID, runID)
	if err != nil {
		middleware.RespondNotFound(c, "execution not found for run: "+runID)
		return
	}
	middleware.RespondSuccess(c, gin.H{"runId": runID, "execution": execution})
}

func (h *Handler) DebugPause(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DebugPause")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	state := h.svc.Pause(ctx, tenantID, runID)
	middleware.RespondSuccess(c, gin.H{"runId": runID, "status": "paused", "debugState": state})
}

func (h *Handler) DebugResume(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DebugResume")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	h.svc.Resume(ctx, tenantID, runID)
	middleware.RespondSuccess(c, gin.H{"runId": runID, "status": "resumed"})
}

func (h *Handler) DebugStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DebugStep")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	rnID := c.Param("runId")
	state := h.svc.Step(ctx, tenantID, rnID)
	middleware.RespondSuccess(c, gin.H{"runId": rnID, "status": "stepping", "debugState": state})
}

func (h *Handler) DebugState(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DebugState")
	defer span.End()
	runID := c.Param("runId")
	state := h.svc.GetDebugState(runID)
	if state == nil {
		middleware.RespondNotFound(c, "no debug state for run: "+runID)
		return
	}
	middleware.RespondSuccess(c, state)
}

// ===========================================================================
// AI Diagnosis
// ===========================================================================

func (h *Handler) AIDiagnose(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIDiagnose")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body struct {
		Context service.DiagnoseRequest `json:"context" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, "Missing required context fields: taskId, pluginId, errorMessage")
		return
	}
	if body.Context.TaskID == "" || body.Context.PluginID == "" || body.Context.ErrorMessage == "" {
		middleware.RespondBadRequest(c, "Missing required context fields: taskId, pluginId, errorMessage")
		return
	}
	result, err := h.svc.Diagnose(ctx, tenantID, &body.Context)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ===========================================================================
// Quotas
// ===========================================================================

func (h *Handler) UpsertPluginQuota(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpsertPluginQuota")
	defer span.End()
	pluginID := c.Param("pluginId")
	var req models.ResourceQuota
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpsertPluginQuota(ctx, pluginID, &req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "quota upserted", "pluginId": pluginID})
}

func (h *Handler) PluginQuota(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PluginQuota")
	defer span.End()
	pluginID := c.Param("pluginId")
	q, err := h.svc.GetPluginQuota(ctx, pluginID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, q)
}

func (h *Handler) DeletePluginQuota(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeletePluginQuota")
	defer span.End()
	pluginID := c.Param("pluginId")
	if err := h.svc.DeletePluginQuota(ctx, pluginID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "quota deleted", "pluginId": pluginID})
}

// ===========================================================================
// Security Events
// ===========================================================================

func (h *Handler) CreateSecurityEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSecurityEvent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var ev models.SecurityEvent
	if err := c.ShouldBindJSON(&ev); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ev.ID = "" // will be generated by repository
	ev.TenantID = tenantID
	if err := h.svc.CreateSecurityEvent(ctx, &ev); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "security event created"})
}

func (h *Handler) ListSecurityEvents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSecurityEvents")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	f := &models.SecurityEventFilter{
		TenantID: tenantID,
		PluginID: c.Query("plugin_id"),
		TaskID:   c.Query("task_id"),
		Type:     c.Query("type"),
		Severity: c.Query("severity"),
		Limit:    100,
	}
	if l, _ := strconv.Atoi(c.DefaultQuery("limit", "100")); l > 0 {
		f.Limit = l
	}
	events, err := h.svc.ListSecurityEvents(ctx, f)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, events)
}
