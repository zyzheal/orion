package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/policy/models"
	"orion/platform-svc-go/internal/policy/service"

	"github.com/gin-gonic/gin"
)

// Handler handles HTTP requests for the policy module.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new policy handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all policy endpoints under the given group.
// Mirrors /api/v1/policies routes from the TS source (27 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/policies")

	// --- Core CRUD ---
	// GET /policies - 列出策略
	f.GET("", auth.RequirePermission("policy", "read"), h.List)
	// POST /policies - 创建策略
	f.POST("", auth.RequirePermission("policy", "write"), h.Create)
	// GET /policies/:id - 获取策略详情
	f.GET("/:id", auth.RequirePermission("policy", "read"), h.Get)
	// PUT /policies/:id - 更新策略
	f.PUT("/:id", auth.RequirePermission("policy", "write"), h.Update)
	// DELETE /policies/:id - 删除策略
	f.DELETE("/:id", auth.RequirePermission("policy", "delete"), h.Delete)
	// PATCH /policies/:id/toggle - 启用/禁用策略
	f.PATCH("/:id/toggle", auth.RequirePermission("policy", "write"), h.Toggle)

	// --- Policy evaluation ---
	// POST /policies/:id/evaluate - 执行策略评估
	f.POST("/:id/evaluate", auth.RequirePermission("policy", "read"), h.Evaluate)
	// GET /policies/:id/evaluations - 获取策略评估历史
	f.GET("/:id/evaluations", auth.RequirePermission("policy", "read"), h.ListEvaluations)

	// --- Violations ---
	// GET /policies/:id/violations - 获取策略违规列表
	f.GET("/:id/violations", auth.RequirePermission("policy", "read"), h.ListViolations)
	// POST /policies/:id/violations/:violationId/waive - 豁免违规
	f.POST("/:id/violations/:violationId/waive", auth.RequirePermission("policy", "write"), h.WaiveViolation)
	// POST /policies/:id/violations/:violationId/resolve - 解决违规
	f.POST("/:id/violations/:violationId/resolve", auth.RequirePermission("policy", "write"), h.ResolveViolation)

	// --- Overrides ---
	// GET /policies/:id/overrides - 获取策略覆盖列表
	f.GET("/:id/overrides", auth.RequirePermission("policy", "read"), h.ListOverrides)
	// POST /policies/:id/overrides - 创建策略覆盖
	f.POST("/:id/overrides", auth.RequirePermission("policy", "write"), h.CreateOverride)

	// --- Bundles ---
	// GET /policies/bundles - 获取策略包列表
	f.GET("/bundles", auth.RequirePermission("policy", "read"), h.ListBundles)
	// GET /policies/bundles/:id - 获取策略包详情
	f.GET("/bundles/:id", auth.RequirePermission("policy", "read"), h.GetBundle)
	// POST /policies/bundles/sync - 同步策略包
	f.POST("/bundles/sync", auth.RequirePermission("policy", "write"), h.SyncBundles)

	// --- Policy testing ---
	// POST /policies/test - 测试策略（Rego）
	f.POST("/test", auth.RequirePermission("policy", "write"), h.TestPolicy)

	// --- Exemptions ---
	// POST /policies/exemptions - 创建豁免
	rg.POST("/policies/exemptions", auth.RequirePermission("policy", "write"), h.CreateExemption)
	// GET /policies/exemptions - 获取豁免列表
	rg.GET("/policies/exemptions", auth.RequirePermission("policy", "read"), h.ListExemptions)
	// GET /policies/exemptions/:id - 获取豁免详情
	f.GET("/exemptions/:id", auth.RequirePermission("policy", "read"), h.GetExemption)
	// POST /policies/exemptions/:id/approve - 审批豁免
	f.POST("/exemptions/:id/approve", auth.RequirePermission("policy", "write"), h.ApproveExemption)
	// POST /policies/exemptions/:id/reject - 拒绝豁免
	f.POST("/exemptions/:id/reject", auth.RequirePermission("policy", "write"), h.RejectExemption)
	// POST /policies/exemptions/:id/revoke - 撤销豁免
	f.POST("/exemptions/:id/revoke", auth.RequirePermission("policy", "delete"), h.RevokeExemption)
}

// --- Core CRUD handlers ---

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	policies, err := h.svc.ListPolicies(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, policies)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreatePolicy(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetPolicy(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "policy not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdatePolicy(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeletePolicy(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "policy deleted"})
}

func (h *Handler) Toggle(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.TogglePolicy(c.Request.Context(), tenantID, id, req.Enabled)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

// --- Policy evaluation handlers ---

func (h *Handler) Evaluate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.EvaluatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	// Default policy_id to the :id param if not provided in body.
	if req.PolicyID == "" {
		req.PolicyID = c.Param("id")
	}
	result, err := h.svc.EvaluatePolicy(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) ListEvaluations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	evaluations, err := h.svc.GetEvaluationHistory(c.Request.Context(), tenantID, id, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, evaluations)
}

// --- Violation handlers ---

func (h *Handler) ListViolations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	violations, err := h.svc.ListViolations(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, violations)
}

func (h *Handler) WaiveViolation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	violationID := c.Param("violationId")
	var req models.WaiveViolationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.WaiveViolation(c.Request.Context(), tenantID, violationID, req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "violation waived"})
}

func (h *Handler) ResolveViolation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	violationID := c.Param("violationId")
	var req models.ResolveViolationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.ResolveViolation(c.Request.Context(), tenantID, violationID, req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "violation resolved"})
}

// --- Override handlers ---

func (h *Handler) ListOverrides(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	overrides, err := h.svc.ListOverrides(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, overrides)
}

func (h *Handler) CreateOverride(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	overrideBy := c.GetString("user_id")
	var req models.CreateOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	// Default policy_id to the :id param if not provided in body.
	if req.PolicyID == "" {
		req.PolicyID = c.Param("id")
	}
	o, err := h.svc.CreateOverride(c.Request.Context(), tenantID, req, overrideBy)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, o)
}

// --- Bundle handlers ---

func (h *Handler) ListBundles(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	bundles, err := h.svc.ListBundles(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, bundles)
}

func (h *Handler) GetBundle(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	b, err := h.svc.GetBundle(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, b)
}

func (h *Handler) SyncBundles(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.SyncBundlesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	// Default source_url if not provided.
	if req.SourceURL == "" {
		req.SourceURL = c.DefaultQuery("source_url", "")
	}
	result, err := h.svc.SyncBundles(c.Request.Context(), tenantID, req.SourceURL)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// --- Policy testing handler ---

func (h *Handler) TestPolicy(c *gin.Context) {
	var req models.TestPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	results, err := h.svc.TestPolicy(c.Request.Context(), req.Rego, req.TestCases)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"results": results})
}

// --- Exemption handlers ---

func (h *Handler) CreateExemption(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateExemptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.SubmitExemption(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) GetExemption(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetExemption(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "exemption not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) ListExemptions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ListExemptionsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.ListExemptions(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

func (h *Handler) ApproveExemption(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ReviewExemptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	req.Action = models.ExemptionActionApprove
	req.Reviewer = c.GetString("user_id")
	m, err := h.svc.ReviewExemption(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) RejectExemption(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ReviewExemptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	req.Action = models.ExemptionActionReject
	req.Reviewer = c.GetString("user_id")
	m, err := h.svc.ReviewExemption(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) RevokeExemption(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.RevokeExemption(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}
