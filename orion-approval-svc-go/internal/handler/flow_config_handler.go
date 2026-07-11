package handler

import (
	"context"
	"net/http"

	"orion/approval-svc-go/internal/models"

	"github.com/gin-gonic/gin"
)

// FlowConfigHandler provides HTTP handlers for approval flow configuration.
type FlowConfigHandler struct {
	svc FlowConfigService
}

// FlowConfigService defines the service interface for flow config operations.
type FlowConfigService interface {
	CreateFlowConfig(ctx context.Context, tenantID string, name string, nodes []models.FlowNode, enabled bool) error
	ListFlowConfigs(ctx context.Context, tenantID string) ([]models.FlowConfig, error)
	GetFlowConfig(ctx context.Context, tenantID string, id string) (*models.FlowConfig, error)
	UpdateFlowConfig(ctx context.Context, tenantID string, id string, updates *models.UpdateFlowConfigRequest) (*models.FlowConfig, error)
	DeleteFlowConfig(ctx context.Context, tenantID string, id string) error
	MatchFlow(ctx context.Context, tenantID string, req *models.FlowMatchRequest) (*models.FlowConfig, error)
}

func NewFlowConfigHandler(svc FlowConfigService) *FlowConfigHandler {
	return &FlowConfigHandler{svc: svc}
}

// RegisterRoutes registers flow config routes.
func (h *FlowConfigHandler) RegisterRoutes(rg *gin.RouterGroup) {
	flows := rg.Group("/approvals/flow-configs")
	{
		flows.POST("", h.CreateFlowConfig)
		flows.GET("", h.ListFlowConfigs)
		flows.GET("/:id", h.GetFlowConfig)
		flows.PUT("/:id", h.UpdateFlowConfig)
		flows.DELETE("/:id", h.DeleteFlowConfig)
	}
	rg.POST("/approvals/flow-configs/match", h.MatchFlow)
}

func (h *FlowConfigHandler) CreateFlowConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateFlowConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if len(req.Nodes) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nodes must not be empty"})
		return
	}

	nodes := make([]models.FlowNode, len(req.Nodes))
	copy(nodes, req.Nodes)

	err := h.svc.CreateFlowConfig(c.Request.Context(), tenantID, req.Name, nodes, req.Enabled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "flow config created"})
}

func (h *FlowConfigHandler) ListFlowConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configs, err := h.svc.ListFlowConfigs(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": configs, "total": len(configs)})
}

func (h *FlowConfigHandler) GetFlowConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	config, err := h.svc.GetFlowConfig(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if config == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "flow config not found"})
		return
	}
	c.JSON(http.StatusOK, config)
}

func (h *FlowConfigHandler) UpdateFlowConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateFlowConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	config, err := h.svc.UpdateFlowConfig(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if config == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "flow config not found"})
		return
	}
	c.JSON(http.StatusOK, config)
}

func (h *FlowConfigHandler) DeleteFlowConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteFlowConfig(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "flow config deleted"})
}

func (h *FlowConfigHandler) MatchFlow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.FlowMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.CapabilityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "capability_id is required"})
		return
	}
	if req.Environment == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "environment is required"})
		return
	}
	if req.RiskLevel < 1 || req.RiskLevel > 4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "risk_level must be between 1 and 4"})
		return
	}
	config, err := h.svc.MatchFlow(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if config == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no matching flow config found"})
		return
	}
	c.JSON(http.StatusOK, config)
}
