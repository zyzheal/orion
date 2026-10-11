// Package handler 暴露 G3 notification-adapter 内部端点。
//
// 注意：本包端点仅供内部运维使用，不进入对外 OpenAPI 版本。
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"

	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/notification-adapter"
)

// Handler 暴露 notification-adapter 内部端点。
type Handler struct {
	adapter *adapter.Adapter
}

func NewHandler(a *adapter.Adapter) *Handler {
	return &Handler{adapter: a}
}

// RegisterRoutes 挂载路由。
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/notification-adapter/status", h.Status)
	rg.POST("/notification-adapter/deliver", h.Deliver)
}

// Status GET /api/v1/notification-adapter/status
func (h *Handler) Status(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "NotificationAdapter.Status")
	defer span.End()

	snap := h.adapter.Status()
	c.JSON(http.StatusOK, gin.H{"data": snap})
}

// Deliver POST /api/v1/notification-adapter/deliver
func (h *Handler) Deliver(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "NotificationAdapter.Deliver")
	defer span.End()

	var req adapter.SendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	if req.TenantID == "" {
		req.TenantID = c.GetString("tenant_id")
	}
	if req.UserID == "" {
		req.UserID = c.GetString("user_id")
	}

	resp, err := h.adapter.Send(ctx, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": resp})
}
