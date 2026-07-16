package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/mcp/models"
	"orion/platform-svc-go/internal/mcp/service"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/mcp")
	r.GET("/servers", auth.RequirePermission("mcp", "read"), h.ListServers)
	r.GET("/servers/:id", auth.RequirePermission("mcp", "read"), h.GetServer)
	r.POST("/servers", auth.RequirePermission("mcp", "write"), h.CreateServer)
	r.PUT("/servers/:id", auth.RequirePermission("mcp", "write"), h.UpdateServer)
	r.DELETE("/servers/:id", auth.RequirePermission("mcp", "delete"), h.DeleteServer)
r.GET("/tools", auth.RequirePermission("mcp", "read"), h.ListTools)
}

func (h *Handler) CreateServer(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	var req models.CreateMCPServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateServer(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) DeleteServer(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteServer(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) GetServer(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetServer(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
errors.WriteSuccess(c, result)
}

func (h *Handler) ListServers(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
q := models.ListMCPServersQuery{Limit: limit, Offset: offset}
result, err := h.svc.ListServers(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListTools(c *gin.Context) {
	ctx := c.Request.Context()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
q := models.ListMCPToolsQuery{Limit: limit, Offset: offset}
	result, err := h.svc.ListTools(ctx, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) UpdateServer(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateMCPServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.UpdateServer(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}
