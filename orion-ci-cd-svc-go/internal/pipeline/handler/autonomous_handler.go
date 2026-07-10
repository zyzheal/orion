package handler

import (
	"net/http"

	"orion/ci-cd-svc-go/internal/pipeline/models"
	"orion/ci-cd-svc-go/internal/pipeline/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// AutonomousHandler provides HTTP handlers for autonomous pipeline features.
type AutonomousHandler struct {
	svc *service.AutonomousService
}

func NewAutonomousHandler(svc *service.AutonomousService) *AutonomousHandler {
	return &AutonomousHandler{svc: svc}
}

// RegisterRoutes registers autonomous pipeline routes.
func (h *AutonomousHandler) RegisterRoutes(rg *gin.RouterGroup) {
	autonomous := rg.Group("/autonomous")
	{
		// Error Classification
		autonomous.POST("/error-classification", auth.RequirePermission("pipeline", "write"), h.CreateErrorClassification)
		autonomous.GET("/error-classification", h.ListErrorClassification)

		// Adaptive Timeout
		autonomous.POST("/adaptive-timeout", auth.RequirePermission("pipeline", "write"), h.SetAdaptiveTimeout)
		autonomous.GET("/adaptive-timeout", h.GetAdaptiveTimeout)

		// Auto Retry
		autonomous.POST("/auto-retry", auth.RequirePermission("pipeline", "write"), h.SetAutoRetry)
		autonomous.GET("/auto-retry", h.GetAutoRetry)

		// Self Healing
		autonomous.POST("/self-healing", auth.RequirePermission("pipeline", "execute"), h.ExecuteSelfHealing)
		autonomous.GET("/self-healing/status", h.GetSelfHealingStatus)
	}
}

// ==================== Error Classification ====================

func (h *AutonomousHandler) CreateErrorClassification(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.ErrorClassificationRule
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule, err := h.svc.CreateErrorClassificationRule(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

func (h *AutonomousHandler) ListErrorClassification(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Query("pipeline_id")

	rules, err := h.svc.ListErrorClassificationRules(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rules})
}

// ==================== Adaptive Timeout ====================

func (h *AutonomousHandler) SetAdaptiveTimeout(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.AdaptiveTimeoutConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config, err := h.svc.SetAdaptiveTimeout(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, config)
}

func (h *AutonomousHandler) GetAdaptiveTimeout(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Query("pipeline_id")

	if pipelineID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pipeline_id is required"})
		return
	}

	config, err := h.svc.GetAdaptiveTimeout(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, config)
}

// ==================== Auto Retry ====================

func (h *AutonomousHandler) SetAutoRetry(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.AutoRetryStrategy
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	strategy, err := h.svc.SetAutoRetryStrategy(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, strategy)
}

func (h *AutonomousHandler) GetAutoRetry(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Query("pipeline_id")

	if pipelineID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pipeline_id is required"})
		return
	}

	strategy, err := h.svc.GetAutoRetryStrategy(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, strategy)
}

// ==================== Self Healing ====================

func (h *AutonomousHandler) ExecuteSelfHealing(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.SelfHealingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status, err := h.svc.ExecuteSelfHealing(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

func (h *AutonomousHandler) GetSelfHealingStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	runID := c.Query("run_id")

	if runID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "run_id is required"})
		return
	}

	statuses, err := h.svc.GetSelfHealingStatus(c.Request.Context(), tenantID, runID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": statuses})
}