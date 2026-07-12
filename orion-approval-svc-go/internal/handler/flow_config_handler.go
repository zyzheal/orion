package handler

import (
	"context"

	"orion/approval-svc-go/internal/models"
	"orion/go-common/pkg/auth"

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
		flows.POST("", auth.RequirePermission("approval", "write"), h.CreateFlowConfig)
		flows.GET("", auth.RequirePermission("approval", "read"), h.ListFlowConfigs)
		flows.GET("/:id", auth.RequirePermission("approval", "read"), h.GetFlowConfig)
		flows.PUT("/:id", auth.RequirePermission("approval", "write"), h.UpdateFlowConfig)
		flows.DELETE("/:id", auth.RequirePermission("approval", "delete"), h.DeleteFlowConfig)
	}
	rg.POST("/approvals/flow-configs/match", auth.RequirePermission("approval", "write"), h.MatchFlow)
}

func (h *FlowConfigHandler) CreateFlowConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateFlowConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Name == "" {
		respondBadRequest(c, "name is required")
		return
	}
	if len(req.Nodes) == 0 {
		respondBadRequest(c, "nodes must not be empty")
		return
	}

	nodes := make([]models.FlowNode, len(req.Nodes))
	copy(nodes, req.Nodes)

	err := h.svc.CreateFlowConfig(c.Request.Context(), tenantID, req.Name, nodes, req.Enabled)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"message": "flow config created"})
}

func (h *FlowConfigHandler) ListFlowConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	configs, err := h.svc.ListFlowConfigs(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"data": configs, "total": len(configs)})
}

func (h *FlowConfigHandler) GetFlowConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	config, err := h.svc.GetFlowConfig(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if config == nil {
		respondNotFound(c, "flow config not found")
		return
	}
	respondSuccess(c, config)
}

func (h *FlowConfigHandler) UpdateFlowConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateFlowConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	config, err := h.svc.UpdateFlowConfig(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if config == nil {
		respondNotFound(c, "flow config not found")
		return
	}
	respondSuccess(c, config)
}

func (h *FlowConfigHandler) DeleteFlowConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteFlowConfig(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "flow config deleted"})
}

func (h *FlowConfigHandler) MatchFlow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.FlowMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.CapabilityID == "" {
		respondBadRequest(c, "capability_id is required")
		return
	}
	if req.Environment == "" {
		respondBadRequest(c, "environment is required")
		return
	}
	if req.RiskLevel < 1 || req.RiskLevel > 4 {
		respondBadRequest(c, "risk_level must be between 1 and 4")
		return
	}
	config, err := h.svc.MatchFlow(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if config == nil {
		respondNotFound(c, "no matching flow config found")
		return
	}
	respondSuccess(c, config)
}