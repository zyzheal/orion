package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
)

// CreateSuspend creates a new suspension.
func (h *Handler) CreateSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSuspend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSuspendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	s, err := h.svc.CreateSuspend(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, s)
}

// ActivateSuspend activates a pending suspension.
func (h *Handler) ActivateSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ActivateSuspend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	s, err := h.svc.ActivateSuspend(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, s)
}

// EndSuspend ends a suspension.
func (h *Handler) EndSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EndSuspend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	s, err := h.svc.EndSuspend(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, s)
}

// CancelSuspend cancels a pending suspension.
func (h *Handler) CancelSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CancelSuspend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	s, err := h.svc.CancelSuspend(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, s)
}

// ListSuspensions lists all suspensions for the tenant.
func (h *Handler) ListSuspensions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSuspensions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	suspensions, err := h.svc.ListSuspensions(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, suspensions)
}

// GetSuspend retrieves a suspension by id.
func (h *Handler) GetSuspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSuspend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	s, err := h.svc.GetSuspend(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, s)
}

// GetEngineerSuspensions lists suspensions for a specific engineer.
func (h *Handler) GetEngineerSuspensions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEngineerSuspensions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	suspensions, err := h.svc.GetEngineerSuspensions(ctx, tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, suspensions)
}

// GetEngineerSuspendImpact returns the impact of suspensions on an engineer.
func (h *Handler) GetEngineerSuspendImpact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEngineerSuspendImpact")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	impact, err := h.svc.GetEngineerSuspendImpact(ctx, tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, impact)
}
