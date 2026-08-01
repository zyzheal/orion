package handler

import (
	"orion/platform-svc-go/internal/middleware"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai-agents/models"
	"orion/platform-svc-go/internal/ai-agents/repository"
	"orion/platform-svc-go/internal/ai-agents/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes AI agents endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all ai-agents endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/ai-agents")

	// GET /ai-agents - List agents
	f.GET("", auth.RequirePermission("ai-agents", "read"), h.List)
	// POST /ai-agents - Create a new agent
	f.POST("", auth.RequirePermission("ai-agents", "write"), h.Create)
	// GET /ai-agents/stats - Get agent statistics
	f.GET("/stats", auth.RequirePermission("ai-agents", "read"), h.GetStats)

	id := f.Group("/:id")
	{
		// GET /ai-agents/:id - Get agent detail
		id.GET("", auth.RequirePermission("ai-agents", "read"), h.Get)
		// PUT /ai-agents/:id - Update agent
		id.PUT("", auth.RequirePermission("ai-agents", "write"), h.Update)
		// DELETE /ai-agents/:id - Delete agent
		id.DELETE("", auth.RequirePermission("ai-agents", "delete"), h.Delete)
		// POST /ai-agents/:id/status - Update agent status
		id.POST("/status", auth.RequirePermission("ai-agents", "write"), h.UpdateStatus)
		// GET /ai-agents/:id/audit-logs - Get agent audit logs
		id.GET("/audit-logs", auth.RequirePermission("ai-agents", "read"), h.GetAuditLogs)
		// POST /ai-agents/:id/execute - Execute agent
		id.POST("/execute", auth.RequirePermission("ai-agents", "write"), h.Execute)
	}
}

// getTenantID extracts tenant_id from Gin context.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// getUserID extracts user_id from Gin context.
func (h *Handler) getUserID(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID == "" {
		return "system"
	}
	return userID
}

// --- List agents: GET /ai-agents ---

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)

	offset, limit := getPaginationParams(c)

	statusStr := c.Query("status")
	enabledStr := c.Query("enabled")
	sortStr := c.Query("sort")
	orderStr := c.Query("order")

	filter := &repository.ListFilter{
		Limit:  &limit,
		Offset: &offset,
	}
	if statusStr != "" {
		filter.Status = &statusStr
	}
	if enabledStr != "" {
		var enabled bool
		if enabledStr == "true" {
			enabled = true
		}
		filter.Enabled = &enabled
	}
	if sortStr != "" {
		filter.Sort = &sortStr
	}
	if orderStr != "" {
		filter.Order = &orderStr
	}

	agents, err := h.svc.ListAgents(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	total, err := h.svc.CountAgents(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	// Convert to AgentInfo for API response
	infoList := make([]models.AgentInfo, 0, len(agents))
	for i := range agents {
		info, err := h.svc.AgentToInfo(&agents[i])
		if err != nil {
			middleware.RespondInternalError(c, "failed to serialize agent info")
			return
		}
		infoList = append(infoList, *info)
	}

	middleware.RespondSuccess(c, gin.H{
		"data":   infoList,
		"total":  total,
		"offset": offset,
		"limit":  limit,
	})
}

// --- Create agent: POST /ai-agents ---

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)

	var req models.RegisterAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	agent, err := h.svc.RegisterAgent(ctx, tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	info, err := h.svc.AgentToInfo(agent)
	if err != nil {
		middleware.RespondInternalError(c, "failed to serialize agent info")
		return
	}
	middleware.RespondCreated(c, info)
}

// --- Get agent: GET /ai-agents/:id ---

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	agent, err := h.svc.GetAgent(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	info, err := h.svc.AgentToInfo(agent)
	if err != nil {
		middleware.RespondInternalError(c, "failed to serialize agent info")
		return
	}
	middleware.RespondSuccess(c, info)
}

// --- Update agent: PUT /ai-agents/:id ---

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	var req models.UpdateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	agent, err := h.svc.UpdateAgent(ctx, id, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	info, err := h.svc.AgentToInfo(agent)
	if err != nil {
		middleware.RespondInternalError(c, "failed to serialize agent info")
		return
	}
	middleware.RespondSuccess(c, info)
}

// --- Delete agent: DELETE /ai-agents/:id ---

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	deleted, err := h.svc.DeleteAgent(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	if !deleted {
		middleware.RespondNotFound(c, "Agent not found")
		return
	}
	middleware.RespondNoContent(c)
}

// --- Update status: POST /ai-agents/:id/status ---

func (h *Handler) UpdateStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateStatus")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	statusStr := c.PostForm("status")
	if statusStr == "" {
		middleware.RespondBadRequest(c, "status is required")
		return
	}
	status := models.AgentStatus(statusStr)
	switch status {
	case models.AgentStatusIdle, models.AgentStatusRunning, models.AgentStatusDisabled, models.AgentStatusError:
	default:
		middleware.RespondBadRequest(c, "invalid status: must be idle, running, disabled, or error")
		return
	}

	agent, err := h.svc.UpdateAgentStatus(ctx, id, tenantID, status)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	info, err := h.svc.AgentToInfo(agent)
	if err != nil {
		middleware.RespondInternalError(c, "failed to serialize agent info")
		return
	}
	middleware.RespondSuccess(c, info)
}

// --- Get audit logs: GET /ai-agents/:id/audit-logs ---

func (h *Handler) GetAuditLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditLogs")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	// Verify agent exists
	_, err := h.svc.GetAgent(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	limitStr := c.Query("limit")
	limit := 100
	if limitStr != "" {
		l, err := strconv.Atoi(limitStr)
		if err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	logs, err := h.svc.GetAuditLogs(ctx, id, tenantID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	respList := make([]models.AgentAuditLogResponse, 0, len(logs))
	for i := range logs {
		resp, err := h.svc.AgentAuditLogToResponse(&logs[i])
		if err != nil {
			middleware.RespondInternalError(c, "failed to serialize audit log")
			return
		}
		respList = append(respList, *resp)
	}

	middleware.RespondSuccess(c, gin.H{
		"data":  respList,
		"total": len(respList),
	})
}

// --- Execute agent: POST /ai-agents/:id/execute ---

// GetStats returns aggregated agent statistics.
func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := h.getTenantID(c)
	stats, err := h.svc.GetAgentStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) Execute(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Execute")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	var req models.ExecuteAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.ExecuteAgent(ctx, id, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, result)
}

func getPaginationParams(c *gin.Context) (offset, limit int) {
	offset = 0
	limit = 20
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v >= 1 {
			limit = v
			if limit > 100 {
				limit = 100
			}
		}
	}
	return
}
