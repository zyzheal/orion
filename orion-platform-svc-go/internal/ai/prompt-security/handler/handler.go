package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai/prompt-security/models"
	"orion/platform-svc-go/internal/ai/prompt-security/service"
	"orion/platform-svc-go/internal/middleware"
)

type PromptSecurityHandler struct {
	svc *service.PromptSecurityService
}

func NewPromptSecurityHandler(svc *service.PromptSecurityService) *PromptSecurityHandler {
	return &PromptSecurityHandler{svc: svc}
}

func (h *PromptSecurityHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers prompt-security routes.
func (h *PromptSecurityHandler) RegisterRoutes(rg *gin.RouterGroup) {
	sec := rg.Group("/prompt-security")
	sec.POST("/scan", auth.RequirePermission("ai", "read"), h.Scan)
	sec.POST("/check", auth.RequirePermission("ai", "read"), h.Check)
	sec.GET("/config", auth.RequirePermission("ai", "read"), h.GetConfig)
	sec.PUT("/config", auth.RequirePermission("ai", "write"), h.UpdateConfig)
}

// Scan scans a prompt for security issues.
func (h *PromptSecurityHandler) Scan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIPromptSecScan")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.ScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	resp, err := h.svc.Scan(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	// If scan found issues, return 400 with findings
	if !resp.Scan.IsSafe {
		middleware.RespondBadRequest(c, "prompt contains security issues")
		return
	}

	middleware.RespondSuccess(c, resp.Scan)
}

// Check performs prompt-injection detection on the provided prompt.
func (h *PromptSecurityHandler) Check(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIPromptSecCheck")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	result := h.svc.CheckPrompt(ctx, tenantID, req.Prompt)
	resp := &models.CheckResponse{Result: *result}

	middleware.RespondSuccess(c, resp)
}

// GetConfig returns the current security config.
func (h *PromptSecurityHandler) GetConfig(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIPromptSecGetConfig")
	defer span.End()
	resp := h.svc.GetConfig()
	middleware.RespondSuccess(c, resp.Config)
}

// UpdateConfig updates the security config.
func (h *PromptSecurityHandler) UpdateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AIPromptSecUpdateConfig")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	config := h.svc.UpdateConfig(ctx, tenantID, updates)
	middleware.RespondSuccess(c, config)
}
