package handler

import (
	"net/http"
	"strings"

	"orion/notification-svc-go/internal/notification/models"
	"orion/notification-svc-go/internal/notification/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PolicyHandler exposes HTTP endpoints for notification policy management.
type PolicyHandler struct {
	policySvc *service.PolicyService
}

// NewPolicyHandler creates a new PolicyHandler.
func NewPolicyHandler(policySvc *service.PolicyService) *PolicyHandler {
	return &PolicyHandler{policySvc: policySvc}
}

// RegisterRoutes mounts all policy/workflow endpoints onto the given router group.
func (h *PolicyHandler) RegisterRoutes(rg *gin.RouterGroup) {
	policies := rg.Group("/notification-policies")
	policies.Use(auth.RequirePermission("notification", "write"))
	{
		policies.POST("", h.CreatePolicy)
		policies.GET("", h.ListPolicies)
		policies.GET("/:id", h.GetPolicy)
		policies.PUT("/:id", h.UpdatePolicy)
		policies.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.DeletePolicy)
		policies.POST("/evaluate", h.EvaluatePolicies)
	}

	workflows := rg.Group("/notification-policies/workflows")
	workflows.Use(auth.RequirePermission("notification", "write"))
	{
		workflows.POST("", h.CreateWorkflow)
		workflows.GET("", h.ListWorkflows)
		workflows.GET("/:id", h.GetWorkflow)
		workflows.PUT("/:id", h.UpdateWorkflow)
		workflows.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.DeleteWorkflow)
	}
}

// ==================== Policy Handlers ====================

// CreatePolicy handles POST /policies - create a new notification policy.
func (h *PolicyHandler) CreatePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Sanitize: trim whitespace from name
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	policy, err := h.policySvc.CreatePolicy(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": policy})
}

// GetPolicy handles GET /policies/:id - get a single policy.
func (h *PolicyHandler) GetPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policy, err := h.policySvc.GetPolicy(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "policy not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": policy})
}

// ListPolicies handles GET /policies - list all policies for a tenant.
func (h *PolicyHandler) ListPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policies, err := h.policySvc.ListPolicies(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": policies})
}

// UpdatePolicy handles PUT /policies/:id - update a policy.
func (h *PolicyHandler) UpdatePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	policy, err := h.policySvc.UpdatePolicy(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		if err == service.ErrPolicyNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "policy not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": policy})
}

// DeletePolicy handles DELETE /policies/:id - delete a policy.
func (h *PolicyHandler) DeletePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.policySvc.DeletePolicy(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		if err == service.ErrPolicyNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "policy not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// EvaluatePolicies handles POST /notification-policies/evaluate - evaluate an event against policies.
func (h *PolicyHandler) EvaluatePolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req struct {
		Event map[string]interface{} `json:"event" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	matched, err := h.policySvc.EvaluatePolicies(c.Request.Context(), tenantID, req.Event)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, matched)
}

// ==================== Workflow Handlers ====================

// CreateWorkflow handles POST /workflows - create a new notification workflow.
func (h *PolicyHandler) CreateWorkflow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.CreateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Sanitize: trim whitespace from name
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	// Validate steps
	if len(req.Steps) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one step is required"})
		return
	}

	// Auto-assign order if missing
	for i := range req.Steps {
		if req.Steps[i].Order == 0 {
			req.Steps[i].Order = i + 1
		}
		if req.Steps[i].ID == "" {
			req.Steps[i].ID = generateStepID()
		}
	}

	workflow, err := h.policySvc.CreateWorkflow(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		if err == service.ErrPolicyNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "policy not found: " + req.PolicyID})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": workflow})
}

// GetWorkflow handles GET /workflows/:id - get a single workflow.
func (h *PolicyHandler) GetWorkflow(c *gin.Context) {
	workflow, err := h.policySvc.GetWorkflow(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": workflow})
}

// ListWorkflows handles GET /workflows - list workflows, optionally filtered by policyId.
func (h *PolicyHandler) ListWorkflows(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Query("policy_id")

	workflows, err := h.policySvc.ListWorkflows(c.Request.Context(), tenantID, policyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": workflows})
}

// UpdateWorkflow handles PUT /workflows/:id - update a workflow.
func (h *PolicyHandler) UpdateWorkflow(c *gin.Context) {
	var req models.UpdateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workflow, err := h.policySvc.UpdateWorkflow(c.Request.Context(), c.Param("id"), &req)
	if err != nil {
		if err == service.ErrWorkflowNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": workflow})
}

// DeleteWorkflow handles DELETE /workflows/:id - delete a workflow.
func (h *PolicyHandler) DeleteWorkflow(c *gin.Context) {
	if err := h.policySvc.DeleteWorkflow(c.Request.Context(), c.Param("id")); err != nil {
		if err == service.ErrWorkflowNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ==================== Helpers ====================

func generateStepID() string {
	return "step-" + strings.ReplaceAll(uuid.New().String(), "-", "")[:12]
}
