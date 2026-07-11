package handler

import (
	"context"
	"net/http"

	"orion/approval-svc-go/internal/models"

	"github.com/gin-gonic/gin"
)

// AgentHandler provides HTTP handlers for approval AI agent operations.
type AgentHandler struct {
	svc AgentService
}

// AgentService defines the service interface for agent operations.
type AgentService interface {
	AnalyzeRisk(ctx context.Context, t string, req *models.RiskAnalysisRequest) (*models.RiskAnalysisResult, error)
	SuggestApprover(ctx context.Context, t string, req *models.ApproverSuggestionRequest) (*models.ApproverSuggestionResult, error)
	EvaluateDecision(ctx context.Context, t string, req *models.EvaluationRequest) (*models.EvaluationResult, error)
}

func NewAgentHandler(svc AgentService) *AgentHandler {
	return &AgentHandler{svc: svc}
}

// RegisterRoutes registers agent routes.
func (h *AgentHandler) RegisterRoutes(rg *gin.RouterGroup) {
	agents := rg.Group("/approvals/agent")
	{
		agents.POST("/analyze", h.AnalyzeRisk)
		agents.POST("/suggest-approver", h.SuggestApprover)
		agents.POST("/evaluate", h.EvaluateDecision)
	}
}

func (h *AgentHandler) AnalyzeRisk(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RiskAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.AnalyzeRisk(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *AgentHandler) SuggestApprover(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ApproverSuggestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.SuggestApprover(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *AgentHandler) EvaluateDecision(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.EvaluationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.EvaluateDecision(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
