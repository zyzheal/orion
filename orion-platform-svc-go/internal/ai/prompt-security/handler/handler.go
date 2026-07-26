package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ai/prompt-security/models"
	"orion/platform-svc-go/internal/ai/prompt-security/service"
	"orion/go-common/pkg/auth"
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
	sec.GET("/config", auth.RequirePermission("ai", "read"), h.GetConfig)
	sec.PUT("/config", auth.RequirePermission("ai", "write"), h.UpdateConfig)
}

// Scan scans a prompt for security issues.
func (h *PromptSecurityHandler) Scan(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.ScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	resp, err := h.svc.Scan(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}

	// If scan found issues, return 400 with findings
	if !resp.Scan.IsSafe {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "prompt contains security issues",
			"data":    resp.Scan,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": resp.Scan})
}

// GetConfig returns the current security config.
func (h *PromptSecurityHandler) GetConfig(c *gin.Context) {
	resp := h.svc.GetConfig()
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": resp.Config})
}

// UpdateConfig updates the security config.
func (h *PromptSecurityHandler) UpdateConfig(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	config := h.svc.UpdateConfig(c.Request.Context(), tenantID, updates)
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": config})
}
