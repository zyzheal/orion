package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/ai-agent/models"
	"orion/platform-svc-go/internal/ai-agent/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/ai-agent")
	r.GET("", auth.RequirePermission("ai-agent", "read"), h.ListAgents)
	r.GET("/:id", auth.RequirePermission("ai-agent", "read"), h.GetAgent)
	r.POST("", auth.RequirePermission("ai-agent", "write"), h.CreateAgent)
	r.PUT("/:id", auth.RequirePermission("ai-agent", "write"), h.UpdateAgent)
	r.DELETE("/:id", auth.RequirePermission("ai-agent", "delete"), h.DeleteAgent)
	r.POST("/:id/run", auth.RequirePermission("ai-agent", "write"), h.RunAgent)
	r.GET("/:id/runs", auth.RequirePermission("ai-agent", "read"), h.ListRuns)
}

func (h *Handler) CreateAgent(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) DeleteAgent(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) GetAgent(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
id := c.Param("id")
	result, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListAgents(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")
	q := models.ListAgentsQuery{Status: status, Limit: limit, Offset: offset}
	result, err := h.svc.List(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListRuns(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	agentID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	result, err := h.svc.ListRuns(ctx, tenantID, agentID, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) RunAgent(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	agentID := c.Param("id")
	var req models.RunAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Run(ctx, tenantID, agentID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) UpdateAgent(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}
