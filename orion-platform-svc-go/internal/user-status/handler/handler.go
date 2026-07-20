package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/user-status/models"
	"orion/platform-svc-go/internal/user-status/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/sentinel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/user-status")
	r.GET("/me", auth.RequirePermission("user-status", "read"), h.GetMyStatus)
	r.GET("/:id", auth.RequirePermission("user-status", "read"), h.GetStatus)
	r.PUT("/me", auth.RequirePermission("user-status", "write"), h.SetMyStatus)
	r.GET("/online", auth.RequirePermission("user-status", "read"), h.ListOnline)
}

func (h *Handler) GetMyStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMyStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	s, err := h.svc.GetStatus(ctx, tenantID, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "status not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, s)
}

func (h *Handler) GetStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	s, err := h.svc.GetStatus(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "status not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, s)
}

func (h *Handler) SetMyStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SetMyStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.SetStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	s, err := h.svc.SetStatus(ctx, tenantID, userID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, s)
}

func (h *Handler) ListOnline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListOnline")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	statuses, err := h.svc.ListByStatus(ctx, tenantID, "online")
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": statuses, "total": len(statuses)})
}
