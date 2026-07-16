package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/terminal-audit/models"
	"orion/platform-svc-go/internal/terminal-audit/service"

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
	r := rg.Group("/terminal-audit")
	r.GET("", auth.RequirePermission("terminal-audit", "read"), h.ListAudits)
	r.GET("/:id", auth.RequirePermission("terminal-audit", "read"), h.GetAudit)
	r.DELETE("/batch", auth.RequirePermission("terminal-audit", "delete"), h.DeleteBatch)
r.PUT("/search", auth.RequirePermission("terminal-audit", "read"), h.SearchAudits)
	r.GET("/stats", auth.RequirePermission("terminal-audit", "read"), h.GetStats)
}

func (h *Handler) DeleteBatch(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	var ids []string
	if err := c.ShouldBindJSON(&ids); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.DeleteBatch(ctx, tenantID, ids)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"deleted": result})
}

func (h *Handler) GetAudit(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetAudit(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetStats(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListAudits(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
q := models.AuditQuery{Limit: limit, Offset: offset}
	result, err := h.svc.ListAudits(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) SearchAudits(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
q := models.AuditQuery{Limit: limit, Offset: offset}
	result, err := h.svc.SearchAudits(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}
