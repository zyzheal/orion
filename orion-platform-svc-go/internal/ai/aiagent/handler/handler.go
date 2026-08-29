package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai/aiagent/models"
	"orion/platform-svc-go/internal/ai/aiagent/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
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
	}
}

func (h *Handler) ListAgents(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAIAgents")
	defer span.End()
	agents := h.svc.ListAgents()
	respondSuccess(c, agents)
}

func (h *Handler) GetAgent(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAgent")
	defer span.End()
	id := c.Param("id")
	agent, err := h.svc.GetAgent(id)
	if err != nil {
		respondNotFound(c, "Agent not found")
		return
	}
	respondSuccess(c, agent)
}

func (h *Handler) GetAuditLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditLogs")
	defer span.End()
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	// Verify agent exists
	if _, err := h.svc.GetAgent(id); err != nil {
		respondNotFound(c, "Agent not found")
		return
	}

	logs, err := h.svc.GetAuditLogs(ctx, id, tenantID, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, logs)
}

func (h *Handler) ExecuteAgent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteAgent")
	defer span.End()
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req models.ExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.ExecuteAgent(ctx, tenantID, id, req.Input)
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
