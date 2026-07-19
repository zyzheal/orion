package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/permission-audit/models"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	ListAuditLogs(ctx context.Context, tenantID string, filter *models.AuditLogFilter) ([]models.PermissionAuditLog, int, error)
	LogPermission(ctx context.Context, tenantID string, req *models.CreateAuditLogRequest, clientIP, userAgent string) (*models.PermissionAuditLog, error)
	GetAuditLog(ctx context.Context, tenantID, id string) (*models.PermissionAuditLog, error)
	DeleteAuditLog(ctx context.Context, tenantID, id string) (bool, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
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
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result, "total": total})
}

func (h *Handler) LogPermission(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.LogPermission(c.Request.Context(), tenantID, &req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetAuditLog(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetAuditLog(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "audit log not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteAuditLog(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteAuditLog(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "audit log not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "audit log deleted"})
}
