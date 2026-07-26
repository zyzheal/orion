package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/ai/aiagent/models"
	"orion/platform-svc-go/internal/ai/aiagent/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/ai-agents")
	{
		r.GET("/list", auth.RequirePermission("ai-agent", "read"), h.ListAgents)
		r.GET("/:id", auth.RequirePermission("ai-agent", "read"), h.GetAgent)
		r.GET("/:id/audit-logs", auth.RequirePermission("ai-agent", "read"), h.GetAuditLogs)
		r.POST("/:id/execute", auth.RequirePermission("ai-agent", "execute"), h.ExecuteAgent)
	}
}

func (h *Handler) ListAgents(c *gin.Context) {
	agents := h.svc.ListAgents()
	respondSuccess(c, agents)
}

func (h *Handler) GetAgent(c *gin.Context) {
	id := c.Param("id")
	agent, err := h.svc.GetAgent(id)
	if err != nil {
		respondNotFound(c, "Agent not found")
		return
	}
	respondSuccess(c, agent)
}

func (h *Handler) GetAuditLogs(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	// Verify agent exists
	if _, err := h.svc.GetAgent(id); err != nil {
		respondNotFound(c, "Agent not found")
		return
	}

	logs, err := h.svc.GetAuditLogs(c.Request.Context(), id, tenantID, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, logs)
}

func (h *Handler) ExecuteAgent(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req models.ExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.ExecuteAgent(c.Request.Context(), tenantID, id, req.Input)
	if err != nil {
		if err == service.ErrAgentNotFound {
			respondNotFound(c, "Agent not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}