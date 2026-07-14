package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/permission-audit/models"
	"orion/platform-svc-go/internal/permission-audit/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/permission-audit")

	f.GET("", auth.RequirePermission("permission-audit", "read"), h.ListAuditLogs)
	f.POST("", auth.RequirePermission("permission-audit", "write"), h.LogPermission)
	f.GET("/:id", auth.RequirePermission("permission-audit", "read"), h.GetAuditLog)
	f.DELETE("/:id", auth.RequirePermission("permission-audit", "delete"), h.DeleteAuditLog)
}

func (h *Handler) ListAuditLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	filter := &models.AuditLogFilter{Limit: 20}
	if l := c.Query("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if u := c.Query("userId"); u != "" {
		filter.UserID = &u
	}
	if a := c.Query("action"); a != "" {
		filter.Action = &a
	}
	if r := c.Query("resource"); r != "" {
		filter.Resource = &r
	}
	if rs := c.Query("result"); rs != "" {
		filter.Result = &rs
	}

	result, total, err := h.svc.ListAuditLogs(c.Request.Context(), tenantID, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result, "total": total})
}

func (h *Handler) LogPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.LogPermission(c.Request.Context(), tenantID, &req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) GetAuditLog(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetAuditLog(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "audit log not found")
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) DeleteAuditLog(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteAuditLog(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "audit log not found")
		return
	}
	respondSuccess(c, gin.H{"message": "audit log deleted"})
}
