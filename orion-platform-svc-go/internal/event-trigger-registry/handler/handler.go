package handler

import (
    "net/http"

    "orion/go-common/pkg/auth"
    "orion/go-common/pkg/errors"
    "orion/platform-svc-go/internal/event-trigger-registry/models"
    "orion/platform-svc-go/internal/event-trigger-registry/service"

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
    r := rg.Group("/event-trigger-registry")
    r.GET("", auth.RequirePermission("event-trigger-registry", "read"), h.ListTriggers)
    r.GET("/:id", auth.RequirePermission("event-trigger-registry", "read"), h.GetTrigger)
    r.POST("", auth.RequirePermission("event-trigger-registry", "write"), h.CreateTrigger)
    r.PUT("/:id", auth.RequirePermission("event-trigger-registry", "write"), h.UpdateTrigger)
    r.DELETE("/:id", auth.RequirePermission("event-trigger-registry", "delete"), h.DeleteTrigger)
}

func (h *Handler) ListTriggers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTriggers")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    triggers, err := h.svc.ListTriggers(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": triggers, "total": len(triggers)})
}

func (h *Handler) GetTrigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTrigger")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    trigger, err := h.svc.GetTrigger(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrNotFound, "trigger not found", http.StatusNotFound)
        return
    }
    errors.WriteSuccess(c, trigger)
}

func (h *Handler) CreateTrigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTrigger")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    var req models.CreateTriggerRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    trigger, err := h.svc.CreateTrigger(ctx, tenantID, req)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, trigger)
}

func (h *Handler) UpdateTrigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateTrigger")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    var req models.CreateTriggerRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    trigger, err := h.svc.UpdateTrigger(ctx, tenantID, c.Param("id"), req)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, trigger)
}

func (h *Handler) DeleteTrigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteTrigger")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    err := h.svc.DeleteTrigger(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, nil)
}
