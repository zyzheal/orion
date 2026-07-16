package handler

import (

        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/auth-mfa/models"
        "orion/platform-svc-go/internal/auth-mfa/service"

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
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateMFADeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateDevice(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.JSON(201, result)
}

func (h *Handler) ListDevices(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	devices, err := h.svc.ListDevices(c.Request.Context(), tenantID, userID, nil)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, devices)
}

func (h *Handler) GetDevice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	device, err := h.svc.GetDevice(c.Request.Context(), tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "device not found", 404)
		return
	}
	c.JSON(200, device)
}

func (h *Handler) ActivateDevice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.ActivateDevice(c.Request.Context(), tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrNotFound, "device not found", 404)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "device activated"})
}

func (h *Handler) DisableDevice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DisableDevice(c.Request.Context(), tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrNotFound, "device not found", 404)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "device disabled"})
}

func (h *Handler) DeleteDevice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteDevice(c.Request.Context(), tenantID, id)
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
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.VerifyMFACodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "code is required", 400)
		return
	}
	valid, err := h.svc.VerifyCode(c.Request.Context(), tenantID, userID, req.Code)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.JSON(200, gin.H{"valid": valid})
}

func (h *Handler) GenerateBackupCodes(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	codes, err := h.svc.GenerateBackupCodes(c.Request.Context(), tenantID, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.JSON(200, gin.H{"codes": codes})
}
