package handler

import (
	"net/http"
	"strconv"

	"orion/ai-svc-go/internal/aiagent/models"
	"orion/ai-svc-go/internal/aiagent/service"
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
	c.JSON(http.StatusOK, gin.H{"success": true, "data": agents})
}

func (h *Handler) GetAgent(c *gin.Context) {
	id := c.Param("id")
	agent, err := h.svc.GetAgent(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Agent not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": agent})
}

func (h *Handler) GetAuditLogs(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	// Verify agent exists
	if _, err := h.svc.GetAgent(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Agent not found"})
		return
	}

	logs, err := h.svc.GetAuditLogs(c.Request.Context(), id, tenantID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": logs})
}

func (h *Handler) ExecuteAgent(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req models.ExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	result, err := h.svc.ExecuteAgent(c.Request.Context(), tenantID, id, req.Input)
	if err != nil {
		if err == service.ErrAgentNotFound {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Agent not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}