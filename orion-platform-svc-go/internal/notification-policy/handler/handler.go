package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/notification-policy/models"
	"orion/platform-svc-go/internal/notification-policy/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all notification-policy endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/notification-policies")

	// --- Policies ---
	// GET /notification-policies - List notification policies
	f.GET("", auth.RequirePermission("notification-policy", "read"), h.ListPolicies)
	// POST /notification-policies - Create notification policy
	f.POST("", auth.RequirePermission("notification-policy", "write"), h.CreatePolicy)
	// GET /notification-policies/count - Count notification policies
	f.GET("/count", auth.RequirePermission("notification-policy", "read"), h.CountPolicies)
	// GET /notification-policies/evaluate - Evaluate notification policies
	f.POST("/evaluate", auth.RequirePermission("notification-policy", "read"), h.EvaluatePolicies)
	// GET /notification-policies/:id - Get notification policy by ID
	f.GET("/:id", auth.RequirePermission("notification-policy", "read"), h.GetPolicy)
	// PUT /notification-policies/:id - Update notification policy
	f.PUT("/:id", auth.RequirePermission("notification-policy", "write"), h.UpdatePolicy)
	// DELETE /notification-policies/:id - Delete notification policy
	f.DELETE("/:id", auth.RequirePermission("notification-policy", "delete"), h.DeletePolicy)

	// --- Workflows ---
	// GET /notification-policies/:policyId/workflows - List workflows for a policy
	f.GET("/:policyId/workflows", auth.RequirePermission("notification-policy", "read"), h.ListWorkflows)
	// POST /notification-policies/:policyId/workflows - Create workflow for a policy
	f.POST("/:policyId/workflows", auth.RequirePermission("notification-policy", "write"), h.CreateWorkflow)
	// GET /notification-policies/:policyId/workflows/:id - Get workflow by ID
	f.GET("/:policyId/workflows/:id", auth.RequirePermission("notification-policy", "read"), h.GetWorkflow)
	// PUT /notification-policies/:policyId/workflows/:id - Update workflow
	f.PUT("/:policyId/workflows/:id", auth.RequirePermission("notification-policy", "write"), h.UpdateWorkflow)
	// DELETE /notification-policies/:policyId/workflows/:id - Delete workflow
	f.DELETE("/:policyId/workflows/:id", auth.RequirePermission("notification-policy", "delete"), h.DeleteWorkflow)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// getUserID extracts user_id from Gin context.
func (h *Handler) getUserID(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return userID
}

// getPagination extracts page and pageSize from query parameters.
func (h *Handler) getPagination(c *gin.Context) (int, int) {
	page := 1
	pageSize := 20
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if ps := c.Query("pageSize"); ps != "" {
		if v, err := strconv.Atoi(ps); err == nil && v > 0 {
			pageSize = v
		}
	}
	return page, pageSize
}

// --- Policy handlers ---

func (h *Handler) ListPolicies(c *gin.Context) {
	tenantID := h.getTenantID(c)
	page, pageSize := h.getPagination(c)

	filter := &models.ListFilter{}
	if enabledStr := c.Query("enabled"); enabledStr != "" {
		enabled := enabledStr == "true"
		filter.Enabled = &enabled
	}
	if priorityStr := c.Query("priority"); priorityStr != "" {
		if v, err := strconv.Atoi(priorityStr); err == nil {
			filter.Priority = &v
		}
	}

	policies, total, err := h.svc.List(c.Request.Context(), tenantID, filter, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     policies,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

func (h *Handler) GetPolicy(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	policy, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification policy not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, policy)
}

func (h *Handler) CreatePolicy(c *gin.Context) {
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	policy, err := h.svc.Create(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, policy)
}

func (h *Handler) UpdatePolicy(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	policy, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification policy not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, policy)
}

func (h *Handler) DeletePolicy(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "notification policy not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "notification policy deleted"})
}

func (h *Handler) CountPolicies(c *gin.Context) {
	tenantID := h.getTenantID(c)
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

func (h *Handler) EvaluatePolicies(c *gin.Context) {
	var req models.EvaluateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	results, err := h.svc.Evaluate(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, results)
}

// --- Workflow handlers ---

func (h *Handler) ListWorkflows(c *gin.Context) {
	policyID := c.Param("policyId")
	tenantID := h.getTenantID(c)
	page, pageSize := h.getPagination(c)

	workflows, total, err := h.svc.ListWorkflows(c.Request.Context(), tenantID, policyID, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     workflows,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

func (h *Handler) GetWorkflow(c *gin.Context) {
	policyID := c.Param("policyId")
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	workflow, err := h.svc.GetWorkflow(c.Request.Context(), tenantID, policyID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification policy workflow not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, workflow)
}

func (h *Handler) CreateWorkflow(c *gin.Context) {
	policyID := c.Param("policyId")
	var req models.CreateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.PolicyID = policyID
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	workflow, err := h.svc.CreateWorkflow(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, workflow)
}

func (h *Handler) UpdateWorkflow(c *gin.Context) {
	policyID := c.Param("policyId")
	id := c.Param("id")
	var req models.UpdateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	workflow, err := h.svc.UpdateWorkflow(c.Request.Context(), tenantID, policyID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification policy workflow not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, workflow)
}

func (h *Handler) DeleteWorkflow(c *gin.Context) {
	policyID := c.Param("policyId")
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteWorkflow(c.Request.Context(), tenantID, policyID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "notification policy workflow not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "notification policy workflow deleted"})
}
