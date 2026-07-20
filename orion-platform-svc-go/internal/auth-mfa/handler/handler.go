package handler

import (

        "orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
        "orion/platform-svc-go/internal/auth-mfa/models"
        "orion/platform-svc-go/internal/auth-mfa/service"

        "github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
	"go.opentelemetry.io/otel/trace"
	"orion/go-common/pkg/sentinel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/auth-mfa")

	// Device management
	f.POST("/devices", auth.RequirePermission("auth-mfa", "write"), h.CreateDevice)
	f.GET("/devices", auth.RequirePermission("auth-mfa", "read"), h.ListDevices)
	f.GET("/devices/:id", auth.RequirePermission("auth-mfa", "read"), h.GetDevice)
	f.PUT("/devices/:id/activate", auth.RequirePermission("auth-mfa", "write"), h.ActivateDevice)
	f.PUT("/devices/:id/disable", auth.RequirePermission("auth-mfa", "write"), h.DisableDevice)
	f.DELETE("/devices/:id", auth.RequirePermission("auth-mfa", "delete"), h.DeleteDevice)

	// Verification
	f.POST("/verify", h.VerifyCode)

	// Backup codes
	f.POST("/backup-codes", h.GenerateBackupCodes)
}

func (h *Handler) CreateDevice(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateDevice")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateMFADeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateDevice(ctx, tenantID, userID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) ListDevices(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDevices")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	devices, err := h.svc.ListDevices(ctx, tenantID, userID, nil)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, devices)
}

func (h *Handler) GetDevice(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDevice")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	device, err := h.svc.GetDevice(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "device not found", 404)
		return
	}
	middleware.RespondSuccess(c, device)
}

func (h *Handler) ActivateDevice(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ActivateDevice")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.ActivateDevice(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrNotFound, "device not found", 404)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "device activated"})
}

func (h *Handler) DisableDevice(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DisableDevice")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DisableDevice(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrNotFound, "device not found", 404)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "device disabled"})
}

func (h *Handler) DeleteDevice(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteDevice")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteDevice(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	if !deleted {
		errors.WriteError(c, errors.ErrNotFound, "device not found", 404)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "device deleted"})
}

func (h *Handler) VerifyCode(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VerifyCode")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.VerifyMFACodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "code is required", 400)
		return
	}
	valid, err := h.svc.VerifyCode(ctx, tenantID, userID, req.Code)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"valid": valid})
}

func (h *Handler) GenerateBackupCodes(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GenerateBackupCodes")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	codes, err := h.svc.GenerateBackupCodes(ctx, tenantID, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"codes": codes})
}
