package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all ChatOps endpoints under the given group.
// Mirrors /api/v1/chatops routes from the TS source (~75 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	c := rg.Group("/chatops")

	// ---- Commands ----
	// GET /commands - List available ChatOps commands
	c.GET("/commands", auth.RequirePermission("chatops", "read"), h.ListCommands)
	// GET /commands/:name/help - Get help for a specific command
	c.GET("/commands/:name/help", auth.RequirePermission("chatops", "read"), h.GetCommandHelp)

	// ---- Execution ----
	// POST /execute - Execute a ChatOps command
	c.POST("/execute", auth.RequirePermission("chatops", "write"), h.ExecuteCommand)
	// GET /status/:commandId - Get execution status
	c.GET("/status/:commandId", auth.RequirePermission("chatops", "read"), h.GetExecutionStatus)
	// GET /executions - List command executions
	c.GET("/executions", auth.RequirePermission("chatops", "read"), h.ListExecutions)

	// ---- Webhook Message ----
	// POST /message - Receive webhook message from IM platform
	c.POST("/message", auth.RequirePermission("chatops", "write"), h.ReceiveMessage)

	// ---- Recommendations ----
	// POST /recommendations - Get AI-powered command recommendations
	c.POST("/recommendations", auth.RequirePermission("chatops", "write"), h.GetRecommendations)

	// ---- Knowledge Recommendations ----
	// GET /knowledge - Get knowledge base recommendations
	c.GET("/knowledge", auth.RequirePermission("chatops", "read"), h.GetKnowledgeRecommendations)

	// ---- Sessions / Messages ----
	// GET /sessions/:id/messages - Get messages for a session
	c.GET("/sessions/:id/messages", auth.RequirePermission("chatops", "read"), h.GetSessionMessages)

	// ---- SSE Stream ----
	// GET /stream/recommendations - SSE stream for real-time recommendations
	c.GET("/stream/recommendations", auth.RequirePermission("chatops", "read"), h.StreamRecommendations)

	// ---- Notification Preferences ----
	// GET /settings/notification-preferences
	c.GET("/settings/notification-preferences", auth.RequirePermission("chatops", "read"), h.GetNotificationPreferences)
	// PUT /settings/notification-preferences
	c.PUT("/settings/notification-preferences", auth.RequirePermission("chatops", "write"), h.UpdateNotificationPreferences)

	// ---- DND Settings ----
	// GET /settings/dnd
	c.GET("/settings/dnd", auth.RequirePermission("chatops", "read"), h.GetDNDSettings)
	// PUT /settings/dnd
	c.PUT("/settings/dnd", auth.RequirePermission("chatops", "write"), h.UpdateDNDSettings)
	// PATCH /settings/dnd/toggle
	c.PATCH("/settings/dnd/toggle", auth.RequirePermission("chatops", "write"), h.ToggleDND)

	// ---- Platform Config ----
	// GET /settings/platforms
	c.GET("/settings/platforms", auth.RequirePermission("chatops", "read"), h.GetPlatformConfigs)
	// PUT /settings/platforms
	c.PUT("/settings/platforms", auth.RequirePermission("chatops", "write"), h.UpdatePlatformConfigs)

	// ---- Alert States ----
	// GET /alerts/states
	c.GET("/alerts/states", auth.RequirePermission("chatops", "read"), h.GetAlertStates)
	// POST /alerts/:id/read - Mark alert as read
	c.POST("/alerts/:id/read", auth.RequirePermission("chatops", "write"), h.MarkAlertRead)
	// POST /alerts/:id/acknowledge - Acknowledge alert
	c.POST("/alerts/:id/acknowledge", auth.RequirePermission("chatops", "write"), h.MarkAlertAcknowledged)
	// POST /alerts/:id/dismiss - Dismiss alert
	c.POST("/alerts/:id/dismiss", auth.RequirePermission("chatops", "write"), h.MarkAlertDismissed)

	// ---- Dashboard Stats ----
	// GET /dashboard/stats
	c.GET("/dashboard/stats", auth.RequirePermission("chatops", "read"), h.GetDashboardStats)

	// ---- Health Check ----
	// GET /health - ChatOps service health check
	c.GET("/health", h.HealthCheck)

	// ---- Audit ----
	// GET /audit/logs
	c.GET("/audit/logs", auth.RequirePermission("chatops", "read"), h.GetAuditLogs)
	// GET /audit/stats
	c.GET("/audit/stats", auth.RequirePermission("chatops", "read"), h.GetAuditStats)
	// POST /audit/export
	c.POST("/audit/export", auth.RequirePermission("chatops", "write"), h.ExportAuditLogs)

	// ---- Permission Check ----
	// GET /permissions/allowed-commands
	c.GET("/permissions/allowed-commands", h.GetAllowedCommands)

	// ---- Admin: Capability Mappings ----
	// GET /admin/capability-mappings
	c.GET("/admin/capability-mappings", auth.RequirePermission("chatops", "admin"), h.GetAllCapabilityMappings)
	// POST /admin/capability-mappings
	c.POST("/admin/capability-mappings", auth.RequirePermission("chatops", "admin"), h.CreateCapabilityMapping)
	// PUT /admin/capability-mappings/:id
	c.PUT("/admin/capability-mappings/:id", auth.RequirePermission("chatops", "admin"), h.UpdateCapabilityMapping)
	// DELETE /admin/capability-mappings/:id
	c.DELETE("/admin/capability-mappings/:id", auth.RequirePermission("chatops", "admin"), h.DeleteCapabilityMapping)

	// ---- Admin: Approval Configs ----
	// GET /admin/approval-configs
	c.GET("/admin/approval-configs", auth.RequirePermission("chatops", "admin"), h.GetAllApprovalConfigs)
	// PUT /admin/approval-configs
	c.PUT("/admin/approval-configs", auth.RequirePermission("chatops", "admin"), h.UpdateApprovalConfigs)
	// GET /admin/approval-configs/:capability
	c.GET("/admin/approval-configs/:capability", auth.RequirePermission("chatops", "admin"), h.GetApprovalConfigByCapability)
	// PUT /admin/approval-configs/:capability
	c.PUT("/admin/approval-configs/:capability", auth.RequirePermission("chatops", "admin"), h.UpdateApprovalConfig)

	// ---- Admin: Approvers ----
	// GET /admin/approvers
	c.GET("/admin/approvers", auth.RequirePermission("chatops", "admin"), h.GetApprovers)
	// GET /admin/approvers/schedule
	c.GET("/admin/approvers/schedule", auth.RequirePermission("chatops", "admin"), h.GetApproverSchedule)
	// PUT /admin/approvers/schedule
	c.PUT("/admin/approvers/schedule", auth.RequirePermission("chatops", "admin"), h.UpdateApproverSchedule)

	// ---- Admin: Global Approval Config ----
	// GET /admin/approval-global-config
	c.GET("/admin/approval-global-config", auth.RequirePermission("chatops", "admin"), h.GetGlobalApprovalConfig)
	// PUT /admin/approval-global-config
	c.PUT("/admin/approval-global-config", auth.RequirePermission("chatops", "admin"), h.UpdateGlobalApprovalConfig)

	// ---- Admin: Roles ----
	// GET /admin/roles
	c.GET("/admin/roles", auth.RequirePermission("chatops", "admin"), h.GetAllRoles)
	// POST /admin/roles
	c.POST("/admin/roles", auth.RequirePermission("chatops", "admin"), h.CreateRole)
	// PUT /admin/roles/:id
	c.PUT("/admin/roles/:id", auth.RequirePermission("chatops", "admin"), h.UpdateRole)
	// DELETE /admin/roles/:id
	c.DELETE("/admin/roles/:id", auth.RequirePermission("chatops", "admin"), h.DeleteRole)

	// ---- Admin: Command Permissions ----
	// GET /admin/command-permissions
	c.GET("/admin/command-permissions", auth.RequirePermission("chatops", "admin"), h.GetAllCommandPermissions)
	// POST /admin/command-permissions
	c.POST("/admin/command-permissions", auth.RequirePermission("chatops", "admin"), h.CreateCommandPermission)
	// PUT /admin/command-permissions/:id
	c.PUT("/admin/command-permissions/:id", auth.RequirePermission("chatops", "admin"), h.UpdateCommandPermission)
	// DELETE /admin/command-permissions/:id
	c.DELETE("/admin/command-permissions/:id", auth.RequirePermission("chatops", "admin"), h.DeleteCommandPermission)

	// ---- Admin: Environment Permissions ----
	// GET /admin/environment-permissions
	c.GET("/admin/environment-permissions", auth.RequirePermission("chatops", "admin"), h.GetAllEnvironmentPermissions)
	// POST /admin/environment-permissions
	c.POST("/admin/environment-permissions", auth.RequirePermission("chatops", "admin"), h.CreateEnvironmentPermission)
	// PUT /admin/environment-permissions/:id
	c.PUT("/admin/environment-permissions/:id", auth.RequirePermission("chatops", "admin"), h.UpdateEnvironmentPermission)
	// DELETE /admin/environment-permissions/:id
	c.DELETE("/admin/environment-permissions/:id", auth.RequirePermission("chatops", "admin"), h.DeleteEnvironmentPermission)

	// ---- Admin: Command Versions ----
	// GET /admin/command-versions
	c.GET("/admin/command-versions", auth.RequirePermission("chatops", "admin"), h.GetAllCommandVersions)
	// GET /admin/command-versions/:commandId
	c.GET("/admin/command-versions/:commandId", auth.RequirePermission("chatops", "admin"), h.GetVersionsByCommand)
	// POST /admin/command-versions
	c.POST("/admin/command-versions", auth.RequirePermission("chatops", "admin"), h.CreateCommandVersion)
	// POST /admin/command-versions/:commandId/rollback/:version
	c.POST("/admin/command-versions/:commandId/rollback/:version", auth.RequirePermission("chatops", "admin"), h.RollbackCommandVersion)
	// POST /admin/command-versions/:versionId/tags
	c.POST("/admin/command-versions/:versionId/tags", auth.RequirePermission("chatops", "admin"), h.AddVersionTag)
	// DELETE /admin/command-versions/:versionId/tags/:tagName
	c.DELETE("/admin/command-versions/:versionId/tags/:tagName", auth.RequirePermission("chatops", "admin"), h.RemoveVersionTag)
	// DELETE /admin/command-versions/:id
	c.DELETE("/admin/command-versions/:id", auth.RequirePermission("chatops", "admin"), h.DeleteCommandVersion)

	// ---- Admin: Rate Limits ----
	// GET /admin/rate-limits
	c.GET("/admin/rate-limits", auth.RequirePermission("chatops", "admin"), h.GetAllRateLimits)
	// POST /admin/rate-limits
	c.POST("/admin/rate-limits", auth.RequirePermission("chatops", "admin"), h.CreateRateLimit)
	// PUT /admin/rate-limits/:id
	c.PUT("/admin/rate-limits/:id", auth.RequirePermission("chatops", "admin"), h.UpdateRateLimit)
	// DELETE /admin/rate-limits/:id
	c.DELETE("/admin/rate-limits/:id", auth.RequirePermission("chatops", "admin"), h.DeleteRateLimit)

	// ---- Admin: Webhooks ----
	// GET /admin/webhooks
	c.GET("/admin/webhooks", auth.RequirePermission("chatops", "admin"), h.GetAllWebhooks)
	// POST /admin/webhooks
	c.POST("/admin/webhooks", auth.RequirePermission("chatops", "admin"), h.CreateWebhook)
	// PUT /admin/webhooks/:id
	c.PUT("/admin/webhooks/:id", auth.RequirePermission("chatops", "admin"), h.UpdateWebhook)
	// DELETE /admin/webhooks/:id
	c.DELETE("/admin/webhooks/:id", auth.RequirePermission("chatops", "admin"), h.DeleteWebhook)
	// POST /admin/webhooks/:id/test
	c.POST("/admin/webhooks/:id/test", auth.RequirePermission("chatops", "admin"), h.TestWebhook)
	// GET /admin/webhooks/:id/logs
	c.GET("/admin/webhooks/:id/logs", auth.RequirePermission("chatops", "admin"), h.GetWebhookLogs)

	// ---- Chat Config ----
	// GET /settings/questions
	c.GET("/settings/questions", auth.RequirePermission("chatops", "read"), h.GetQuestionConfigs)
	// PUT /settings/questions
	c.PUT("/settings/questions", auth.RequirePermission("chatops", "write"), h.UpdateQuestionConfigs)
	// GET /settings/commands
	c.GET("/settings/commands", auth.RequirePermission("chatops", "read"), h.GetCommandConfigs)
	// PUT /settings/commands
	c.PUT("/settings/commands", auth.RequirePermission("chatops", "write"), h.UpdateCommandConfigs)
}

// ---- Commands ----

func (h *Handler) ListCommands(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	permissionLevel := c.Query("permissionLevel")
	name := c.Query("name")
	var plPtr *string
	if permissionLevel != "" {
		plPtr = &permissionLevel
	}
	var namePtr *string
	if name != "" {
		namePtr = &name
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("perPage", "50"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	cmds, err := h.svc.ListCommands(c.Request.Context(), tenantID, plPtr, namePtr, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"commands": cmds})
}

func (h *Handler) GetCommandHelp(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	cmd, err := h.svc.GetCommandHelp(c.Request.Context(), tenantID, name)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "command not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cmd)
}

// ---- Execution ----

func (h *Handler) ExecuteCommand(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.ExecuteCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ex, err := h.svc.ExecuteCommand(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ex)
}

func (h *Handler) GetExecutionStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	commandID := c.Param("commandId")
	ex, err := h.svc.GetExecutionStatus(c.Request.Context(), tenantID, commandID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "execution not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ex)
}

func (h *Handler) ListExecutions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	commandID := c.Query("commandId")
	userID := c.Query("userId")
	status := c.Query("status")
	var cID *string
	if commandID != "" {
		cID = &commandID
	}
	var uID *string
	if userID != "" {
		uID = &userID
	}
	var s *string
	if status != "" {
		s = &status
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("perPage", "50"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	execs, err := h.svc.ListExecutions(c.Request.Context(), tenantID, cID, uID, s, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"executions": execs})
}

// ---- Webhook Message ----

func (h *Handler) ReceiveMessage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.ReceiveMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ReceiveMessage(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// ---- Recommendations ----

func (h *Handler) GetRecommendations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.GetRecommendationsRequest
	c.ShouldBindJSON(&req)
	currentPage := req.Context.CurrentPage
	resourceID := req.Context.ResourceID
	recommendations, err := h.svc.GetRecommendations(c.Request.Context(), tenantID, userID, currentPage, resourceID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"recommendations": recommendations})
}

// ---- Knowledge Recommendations ----

func (h *Handler) GetKnowledgeRecommendations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	context := c.DefaultQuery("context", "general")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	recs, err := h.svc.GetKnowledgeRecommendations(c.Request.Context(), tenantID, context, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"recommendations": recs})
}

// ---- Sessions / Messages ----

func (h *Handler) GetSessionMessages(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	sessionID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	cursor := c.Query("cursor")
	var cursorPtr *string
	if cursor != "" {
		cursorPtr = &cursor
	}
	messages, err := h.svc.GetSessionMessages(c.Request.Context(), tenantID, sessionID, limit, cursorPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"messages": messages})
}

// ---- SSE Stream ----

func (h *Handler) StreamRecommendations(c *gin.Context) {
	// Basic placeholder: return empty recommendations stream
	middleware.RespondSuccess(c, gin.H{"stream": "connected", "recommendations": []string{}})
}

// ---- Notification Preferences ----

func (h *Handler) GetNotificationPreferences(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	pref, err := h.svc.GetNotificationPreference(c.Request.Context(), tenantID, userID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondSuccess(c, gin.H{})
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pref)
}

func (h *Handler) UpdateNotificationPreferences(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.UpdateNotificationPreferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	pref, err := h.svc.UpdateNotificationPreference(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, pref)
}

// ---- DND Settings ----

func (h *Handler) GetDNDSettings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	settings, err := h.svc.GetDNDSettings(c.Request.Context(), tenantID, userID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondSuccess(c, &models.DNDSettings{})
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, settings)
}

func (h *Handler) UpdateDNDSettings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.UpdateDNDRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	settings, err := h.svc.UpdateDNDSettings(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, settings)
}

func (h *Handler) ToggleDND(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.ToggleDNDRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	settings, err := h.svc.ToggleDND(c.Request.Context(), tenantID, userID, req.Enabled)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, settings)
}

// ---- Platform Configs ----

func (h *Handler) GetPlatformConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	configs, err := h.svc.GetPlatformConfigs(c.Request.Context(), tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"platforms": configs})
}

func (h *Handler) UpdatePlatformConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.UpdatePlatformConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	configs, err := h.svc.UpdatePlatformConfigs(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"platforms": configs})
}

// ---- Alert States ----

func (h *Handler) GetAlertStates(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	alerts, err := h.svc.GetAlertStates(c.Request.Context(), tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"alerts": alerts})
}

func (h *Handler) MarkAlertRead(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	alertID := c.Param("id")
	if err := h.svc.MarkAlertRead(c.Request.Context(), tenantID, userID, alertID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) MarkAlertAcknowledged(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	alertID := c.Param("id")
	if err := h.svc.MarkAlertAcknowledged(c.Request.Context(), tenantID, userID, alertID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) MarkAlertDismissed(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	alertID := c.Param("id")
	if err := h.svc.MarkAlertDismissed(c.Request.Context(), tenantID, userID, alertID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Dashboard Stats ----

func (h *Handler) GetDashboardStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.DashboardStatsRequest
	req.Range = c.Query("range")
	req.StartDate = c.Query("startDate")
	req.EndDate = c.Query("endDate")
	stats, err := h.svc.GetDashboardStats(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// ---- Health Check ----

func (h *Handler) HealthCheck(c *gin.Context) {
	result, err := h.svc.HealthCheck(c.Request.Context())
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---- Audit ----

func (h *Handler) GetAuditLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var q models.AuditLogQuery
	if u := c.Query("user_id"); u != "" {
		q.UserID = &u
	}
	if a := c.Query("action"); a != "" {
		q.Action = &a
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			q.Limit = &v
		}
	}
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil {
			q.Offset = &v
		}
	}
	logs, err := h.svc.ListAuditLogs(c.Request.Context(), tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"logs": logs})
}

func (h *Handler) GetAuditStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetAuditStats(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) ExportAuditLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var q models.AuditLogQuery
	if u := c.Query("user_id"); u != "" {
		q.UserID = &u
	}
	result, err := h.svc.ExportAuditLogs(c.Request.Context(), tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---- Permission Check ----

func (h *Handler) GetAllowedCommands(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if userID == "" {
	middleware.RespondForbidden(c, "user not authenticated")
		return
	}
	commands, err := h.svc.GetUserAllowedCommands(c.Request.Context(), tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"commands": commands})
}

// ---- Admin: Capability Mappings ----

func (h *Handler) GetAllCapabilityMappings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	environment := c.Query("environment")
	var envPtr *string
	if environment != "" {
		envPtr = &environment
	}
	mappings, err := h.svc.GetAllCapabilityMappings(c.Request.Context(), tenantID, envPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": mappings})
}

func (h *Handler) CreateCapabilityMapping(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCapabilityMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.CommandID == "" || req.CapabilityID == "" {
		middleware.RespondBadRequest(c, "command_id and capability_id are required")
		return
	}
	mapping, err := h.svc.CreateCapabilityMapping(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": mapping})
}

func (h *Handler) UpdateCapabilityMapping(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateCapabilityMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	mapping, err := h.svc.UpdateCapabilityMapping(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "mapping not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": mapping})
}

func (h *Handler) DeleteCapabilityMapping(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_id := c.Param("id")
	if err := h.svc.DeleteCapabilityMapping(c.Request.Context(), tenantID, _id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "mapping not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Approval Configs ----

func (h *Handler) GetAllApprovalConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configs, err := h.svc.GetAllApprovalConfigs(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": configs})
}

func (h *Handler) UpdateApprovalConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var configs []models.ApprovalConfigInput
	if err := c.ShouldBindJSON(&configs); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req := models.UpdateApprovalConfigsRequest{Configs: configs}
	result, err := h.svc.UpdateApprovalConfigs(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result})
}

func (h *Handler) GetApprovalConfigByCapability(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	capability := c.Param("capability")
	config, err := h.svc.GetApprovalConfigByCapability(c.Request.Context(), tenantID, capability)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "approval config not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": config})
}

func (h *Handler) UpdateApprovalConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	capability := c.Param("capability")
	var req models.UpdateApprovalConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	config, err := h.svc.UpdateApprovalConfig(c.Request.Context(), tenantID, capability, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "approval config not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": config})
}

// ---- Admin: Approvers ----

func (h *Handler) GetApprovers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	approvers, err := h.svc.GetApprovers(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": approvers})
}

func (h *Handler) GetApproverSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	schedule, err := h.svc.GetApproverSchedule(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": schedule})
}

func (h *Handler) UpdateApproverSchedule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var schedule []models.ApproverScheduleInput
	if err := c.ShouldBindJSON(&schedule); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	modelSchedule := make([]models.ApproverSchedule, len(schedule))
	for i, s := range schedule {
		modelSchedule[i] = models.ApproverSchedule{
			UserID:    s.UserID,
			StartTime: s.StartTime,
			EndTime:   s.EndTime,
		}
	}
	if err := h.svc.UpdateApproverSchedule(c.Request.Context(), tenantID, modelSchedule); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Global Approval Config ----

func (h *Handler) GetGlobalApprovalConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	config, err := h.svc.GetGlobalApprovalConfig(c.Request.Context(), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondSuccess(c, &models.GlobalApprovalConfig{})
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": config})
}

func (h *Handler) UpdateGlobalApprovalConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateGlobalApprovalConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	config := &models.GlobalApprovalConfig{
		Enabled: req.Enabled,
		Mode:    req.Mode,
	}
	if err := h.svc.UpdateGlobalApprovalConfig(c.Request.Context(), tenantID, config); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Roles ----

func (h *Handler) GetAllRoles(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	roles, err := h.svc.GetAllRoles(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": roles})
}

func (h *Handler) CreateRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Name == "" {
		middleware.RespondBadRequest(c, "name is required")
		return
	}
	role, err := h.svc.CreateRole(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": role})
}

func (h *Handler) UpdateRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	role, err := h.svc.UpdateRole(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "role not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": role})
}

func (h *Handler) DeleteRole(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteRole(c.Request.Context(), tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "role not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Command Permissions ----

func (h *Handler) GetAllCommandPermissions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	perms, err := h.svc.GetAllCommandPermissions(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": perms})
}

func (h *Handler) CreateCommandPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCommandPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Command == "" || req.Capability == "" {
		middleware.RespondBadRequest(c, "command and capability are required")
		return
	}
	perm, err := h.svc.CreateCommandPermission(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": perm})
}

func (h *Handler) UpdateCommandPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateCommandPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	perm, err := h.svc.UpdateCommandPermission(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "command permission not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": perm})
}

func (h *Handler) DeleteCommandPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteCommandPermission(c.Request.Context(), tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "command permission not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Environment Permissions ----

func (h *Handler) GetAllEnvironmentPermissions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	perms, err := h.svc.GetAllEnvironmentPermissions(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": perms})
}

func (h *Handler) CreateEnvironmentPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateEnvironmentPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Environment == "" {
		middleware.RespondBadRequest(c, "environment is required")
		return
	}
	perm, err := h.svc.CreateEnvironmentPermission(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": perm})
}

func (h *Handler) UpdateEnvironmentPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateEnvironmentPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	perm, err := h.svc.UpdateEnvironmentPermission(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "environment permission not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": perm})
}

func (h *Handler) DeleteEnvironmentPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_id := c.Param("id")
	if err := h.svc.DeleteEnvironmentPermission(c.Request.Context(), tenantID, _id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "environment permission not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Command Versions ----

func (h *Handler) GetAllCommandVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	perPage, _ := strconv.Atoi(c.DefaultQuery("perPage", "20"))
	result, err := h.svc.GetAllCommandVersions(c.Request.Context(), tenantID, 1, perPage)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Versions, "total": result.Total})
}

func (h *Handler) GetVersionsByCommand(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	commandID := c.Param("commandId")
	versions, err := h.svc.GetVersionsByCommand(c.Request.Context(), tenantID, commandID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": versions})
}

func (h *Handler) CreateCommandVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCommandVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.CommandID == "" || req.CommandText == "" {
		middleware.RespondBadRequest(c, "command_id and command_text are required")
		return
	}
	req.CreatedBy = c.GetString("user_id")
	version, err := h.svc.CreateCommandVersion(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": version})
}

func (h *Handler) RollbackCommandVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	commandID := c.Param("commandId")
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid version")
		return
	}
	// Get all versions and find the target
	versions, err := h.svc.GetVersionsByCommand(c.Request.Context(), tenantID, commandID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if version <= 0 || version > len(versions) {
		middleware.RespondNotFound(c, "version not found")
		return
	}
	target := versions[version-1]
	// Create a new version from the rollback target
	req := models.CreateCommandVersionRequest{
		CommandID:   target.CommandID,
		CommandText: target.CommandText,
		Description: "rollback from version " + strconv.Itoa(version),
		Changelog:   "rollback to version " + strconv.Itoa(version),
		CreatedBy:   c.GetString("user_id"),
	}
	newVersion, err := h.svc.CreateCommandVersion(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": newVersion})
}

func (h *Handler) AddVersionTag(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	versionID := c.Param("versionId")
	var req models.AddTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.TagName == "" {
		middleware.RespondBadRequest(c, "tag_name is required")
		return
	}
	if err := h.svc.AddTag(c.Request.Context(), tenantID, versionID, req.TagName, c.GetString("user_id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) RemoveVersionTag(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	versionID := c.Param("versionId")
	tagName := c.Param("tagName")
	if err := h.svc.RemoveTag(c.Request.Context(), tenantID, versionID, tagName); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) DeleteCommandVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteCommandVersion(c.Request.Context(), tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "version not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Rate Limits ----

func (h *Handler) GetAllRateLimits(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limits, err := h.svc.GetAllRateLimits(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": limits})
}

func (h *Handler) CreateRateLimit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRateLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.TargetType == "" || req.LimitType == "" || req.LimitCount <= 0 || req.WindowSeconds <= 0 {
		middleware.RespondBadRequest(c, "target_type, limit_type, limit_count, window_seconds are required")
		return
	}
	lim, err := h.svc.CreateRateLimit(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": lim})
}

func (h *Handler) UpdateRateLimit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	lim, err := h.svc.UpdateRateLimit(c.Request.Context(), tenantID, id, body)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "rate limit not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": lim})
}

func (h *Handler) DeleteRateLimit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_id := c.Param("id")
	if err := h.svc.DeleteRateLimit(c.Request.Context(), tenantID, _id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "rate limit not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Webhooks ----

func (h *Handler) GetAllWebhooks(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	webhooks, err := h.svc.GetAllWebhooks(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": webhooks})
}

func (h *Handler) CreateWebhook(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Name == "" || req.URL == "" || len(req.Events) == 0 {
		middleware.RespondBadRequest(c, "name, url, events are required")
		return
	}
	req.CreatedBy = c.GetString("user_id")
	webhook, err := h.svc.CreateWebhook(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": webhook})
}

func (h *Handler) UpdateWebhook(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	webhook, err := h.svc.UpdateWebhook(c.Request.Context(), tenantID, id, body)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": webhook})
}

func (h *Handler) DeleteWebhook(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_id := c.Param("id")
	if err := h.svc.DeleteWebhook(c.Request.Context(), tenantID, _id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) TestWebhook(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.TestWebhook(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": result.Success, "data": result})
}

func (h *Handler) GetWebhookLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	logs, err := h.svc.GetWebhookLogs(c.Request.Context(), tenantID, id, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": logs})
}

// ---- Chat Config ----

func (h *Handler) GetQuestionConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	configs, err := h.svc.GetQuestionConfigs(c.Request.Context(), tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": configs})
}

func (h *Handler) UpdateQuestionConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var body struct {
		QuestionConfigs []models.QuestionConfigInput `json:"question_configs"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req := models.UpdateQuestionConfigsRequest{QuestionConfigs: body.QuestionConfigs}
	configs, err := h.svc.UpdateQuestionConfigs(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": configs})
}

func (h *Handler) GetCommandConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	configs, err := h.svc.GetCommandConfigs(c.Request.Context(), tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": configs})
}

func (h *Handler) UpdateCommandConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var body struct {
		CommandConfigs []models.CommandConfigInput `json:"command_configs"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req := models.UpdateCommandConfigsRequest{CommandConfigs: body.CommandConfigs}
	updated, err := h.svc.UpdateCommandConfigs(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": updated})
}
