package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

// ---- Commands ----

func (h *Handler) ListCommands(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCommands")
	defer span.End()
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
	cmds, err := h.svc.ListCommands(ctx, tenantID, plPtr, namePtr, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"commands": cmds})
}

func (h *Handler) GetCommandHelp(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCommandHelp")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	cmd, err := h.svc.GetCommandHelp(ctx, tenantID, name)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteCommand")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.ExecuteCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ex, err := h.svc.ExecuteCommand(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ex)
}

func (h *Handler) GetExecutionStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExecutionStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	commandID := c.Param("commandId")
	ex, err := h.svc.GetExecutionStatus(ctx, tenantID, commandID)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListExecutions")
	defer span.End()
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
	execs, err := h.svc.ListExecutions(ctx, tenantID, cID, uID, s, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"executions": execs})
}

// ---- Webhook Message ----

func (h *Handler) ReceiveMessage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ReceiveMessage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.ReceiveMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ReceiveMessage(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// ---- Recommendations ----

func (h *Handler) GetRecommendations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRecommendations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.GetRecommendationsRequest
	c.ShouldBindJSON(&req)
	currentPage := req.Context.CurrentPage
	resourceID := req.Context.ResourceID
	recommendations, err := h.svc.GetRecommendations(ctx, tenantID, userID, currentPage, resourceID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"recommendations": recommendations})
}

// ---- Knowledge Recommendations ----

func (h *Handler) GetKnowledgeRecommendations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetKnowledgeRecommendations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	context := c.DefaultQuery("context", "general")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	recs, err := h.svc.GetKnowledgeRecommendations(ctx, tenantID, context, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"recommendations": recs})
}

// ---- Sessions / Messages ----

func (h *Handler) GetSessionMessages(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSessionMessages")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	sessionID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	cursor := c.Query("cursor")
	var cursorPtr *string
	if cursor != "" {
		cursorPtr = &cursor
	}
	messages, err := h.svc.GetSessionMessages(ctx, tenantID, sessionID, limit, cursorPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"messages": messages})
}

// ---- SSE Stream ----

func (h *Handler) StreamRecommendations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StreamRecommendations")
	defer span.End()
	// Basic placeholder: return empty recommendations stream
	middleware.RespondSuccess(c, gin.H{"stream": "connected", "recommendations": []string{}})
}

// ---- Notification Preferences ----

func (h *Handler) GetNotificationPreferences(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetNotificationPreferences")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	pref, err := h.svc.GetNotificationPreference(ctx, tenantID, userID)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateNotificationPreferences")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.UpdateNotificationPreferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	pref, err := h.svc.UpdateNotificationPreference(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, pref)
}

// ---- DND Settings ----

func (h *Handler) GetDNDSettings(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDNDSettings")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	settings, err := h.svc.GetDNDSettings(ctx, tenantID, userID)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateDNDSettings")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.UpdateDNDRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	settings, err := h.svc.UpdateDNDSettings(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, settings)
}

func (h *Handler) ToggleDND(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ToggleDND")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.ToggleDNDRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	settings, err := h.svc.ToggleDND(ctx, tenantID, userID, req.Enabled)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, settings)
}

// ---- Platform Configs ----

func (h *Handler) GetPlatformConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPlatformConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	configs, err := h.svc.GetPlatformConfigs(ctx, tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"platforms": configs})
}

func (h *Handler) UpdatePlatformConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePlatformConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.UpdatePlatformConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	configs, err := h.svc.UpdatePlatformConfigs(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"platforms": configs})
}

// ---- Alert States ----

func (h *Handler) GetAlertStates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAlertStates")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	alerts, err := h.svc.GetAlertStates(ctx, tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"alerts": alerts})
}

func (h *Handler) MarkAlertRead(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MarkAlertRead")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	alertID := c.Param("id")
	if err := h.svc.MarkAlertRead(ctx, tenantID, userID, alertID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) MarkAlertAcknowledged(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MarkAlertAcknowledged")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	alertID := c.Param("id")
	if err := h.svc.MarkAlertAcknowledged(ctx, tenantID, userID, alertID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

func (h *Handler) MarkAlertDismissed(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MarkAlertDismissed")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	alertID := c.Param("id")
	if err := h.svc.MarkAlertDismissed(ctx, tenantID, userID, alertID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Dashboard Stats ----

func (h *Handler) GetDashboardStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDashboardStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.DashboardStatsRequest
	req.Range = c.Query("range")
	req.StartDate = c.Query("startDate")
	req.EndDate = c.Query("endDate")
	stats, err := h.svc.GetDashboardStats(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// ---- Health Check ----

func (h *Handler) HealthCheck(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "HealthCheck")
	defer span.End()
	result, err := h.svc.HealthCheck(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---- Audit ----

func (h *Handler) GetAuditLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditLogs")
	defer span.End()
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
	logs, err := h.svc.ListAuditLogs(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"logs": logs})
}

func (h *Handler) GetAuditStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetAuditStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) ExportAuditLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExportAuditLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var q models.AuditLogQuery
	if u := c.Query("user_id"); u != "" {
		q.UserID = &u
	}
	result, err := h.svc.ExportAuditLogs(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---- Permission Check ----

func (h *Handler) GetAllowedCommands(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllowedCommands")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if userID == "" {
	middleware.RespondForbidden(c, "user not authenticated")
		return
	}
	commands, err := h.svc.GetUserAllowedCommands(ctx, tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"commands": commands})
}

