package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/policy/models"
	"orion/platform-svc-go/internal/policy/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
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

	// --- Evaluation (Root) ---
	// Static paths must be registered before parameterized routes to avoid conflicts.
	// POST /policies/evaluate-policy - Evaluate policy against a resource
	f.POST("/evaluate-policy", auth.RequirePermission("policy", "execute"), h.EvaluatePolicyRoot)
	// GET /policies/evaluations - Get evaluation history
	f.GET("/evaluations", auth.RequirePermission("policy", "read"), h.ListRootEvaluations)
	// POST /policies/evaluate - Evaluate policy for a specific run
	f.POST("/evaluate", auth.RequirePermission("policy", "execute"), h.EvaluateRoot)
	// GET /policies/evaluations/runs - List evaluations
	f.GET("/evaluations/runs", auth.RequirePermission("policy", "read"), h.ListEvaluationsRuns)

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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	policies, err := h.svc.ListPolicies(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, policies)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreatePolicy(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetPolicy(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "policy not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdatePolicy(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeletePolicy(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "policy deleted"})
}

func (h *Handler) Toggle(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Toggle")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.TogglePolicy(ctx, tenantID, id, req.Enabled)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// --- Policy evaluation handlers ---

func (h *Handler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Evaluate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.EvaluatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Default policy_id to the :id param if not provided in body.
	if req.PolicyID == "" {
		req.PolicyID = c.Param("id")
	}
	result, err := h.svc.EvaluatePolicy(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ListEvaluations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListEvaluations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	evaluations, err := h.svc.GetEvaluationHistory(ctx, tenantID, id, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, evaluations)
}

// --- Root evaluation handlers ---

// EvaluatePolicyRoot handles POST /policies/evaluate-policy.
func (h *Handler) EvaluatePolicyRoot(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EvaluatePolicyRoot")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.EvaluatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluatePolicy(ctx, tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "policy not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// EvaluateRoot handles POST /policies/evaluate.
func (h *Handler) EvaluateRoot(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EvaluateRoot")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.EvaluatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluatePolicy(ctx, tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "policy not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ListRootEvaluations handles GET /policies/evaluations.
func (h *Handler) ListRootEvaluations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRootEvaluations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	evaluations, err := h.svc.ListEvaluations(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, evaluations)
}

// ListEvaluationsRuns handles GET /policies/evaluations/runs.
func (h *Handler) ListEvaluationsRuns(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListEvaluationsRuns")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	evaluations, err := h.svc.ListEvaluations(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, evaluations)
}

// --- Violation handlers ---

func (h *Handler) ListViolations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListViolations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	violations, err := h.svc.ListViolations(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, violations)
}

func (h *Handler) WaiveViolation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "WaiveViolation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	violationID := c.Param("violationId")
	var req models.WaiveViolationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.WaiveViolation(ctx, tenantID, violationID, req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "violation waived"})
}

func (h *Handler) ResolveViolation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ResolveViolation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	violationID := c.Param("violationId")
	var req models.ResolveViolationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.ResolveViolation(ctx, tenantID, violationID, req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "violation resolved"})
}

// --- Override handlers ---

func (h *Handler) ListOverrides(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListOverrides")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	overrides, err := h.svc.ListOverrides(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, overrides)
}

func (h *Handler) CreateOverride(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateOverride")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	overrideBy := c.GetString("user_id")
	var req models.CreateOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Default policy_id to the :id param if not provided in body.
	if req.PolicyID == "" {
		req.PolicyID = c.Param("id")
	}
	o, err := h.svc.CreateOverride(ctx, tenantID, req, overrideBy)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, o)
}

// --- Bundle handlers ---

func (h *Handler) ListBundles(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBundles")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	bundles, err := h.svc.ListBundles(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, bundles)
}

func (h *Handler) GetBundle(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBundle")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	b, err := h.svc.GetBundle(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, b)
}

func (h *Handler) SyncBundles(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SyncBundles")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.SyncBundlesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Default source_url if not provided.
	if req.SourceURL == "" {
		req.SourceURL = c.DefaultQuery("source_url", "")
	}
	result, err := h.svc.SyncBundles(ctx, tenantID, req.SourceURL)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Policy testing handler ---

func (h *Handler) TestPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TestPolicy")
	defer span.End()
	var req models.TestPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	results, err := h.svc.TestPolicy(ctx, req.Rego, req.TestCases)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"results": results})
}

// --- Exemption handlers ---

func (h *Handler) CreateExemption(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateExemption")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateExemptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.SubmitExemption(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) GetExemption(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExemption")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetExemption(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "exemption not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) ListExemptions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListExemptions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.ListExemptionsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.ListExemptions(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

func (h *Handler) ApproveExemption(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveExemption")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ReviewExemptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.Action = models.ExemptionActionApprove
	req.Reviewer = c.GetString("user_id")
	m, err := h.svc.ReviewExemption(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) RejectExemption(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RejectExemption")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ReviewExemptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.Action = models.ExemptionActionReject
	req.Reviewer = c.GetString("user_id")
	m, err := h.svc.ReviewExemption(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) RevokeExemption(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RevokeExemption")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.RevokeExemption(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}
