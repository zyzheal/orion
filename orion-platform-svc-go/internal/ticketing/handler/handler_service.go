package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
)

// StartService starts the ticketing service for the tenant.
func (h *Handler) StartService(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartService")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.StartService(ctx, tenantID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "ticketing service started"})
}

// StopService stops the ticketing service for the tenant.
func (h *Handler) StopService(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StopService")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.StopService(ctx, tenantID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "ticketing service stopped"})
}

// HealthCheck returns the health status of the ticketing service for the tenant.
func (h *Handler) HealthCheck(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "HealthCheck")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	active, err := h.svc.HealthCheck(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"healthy": active})
}
