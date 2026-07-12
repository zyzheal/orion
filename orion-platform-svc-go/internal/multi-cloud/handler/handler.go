package handler

import (
	"strconv"
	"strings"
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/multi-cloud/models"
	"orion/platform-svc-go/internal/multi-cloud/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all multi-cloud endpoints under the given group.
// Mirrors /api/v1/multi-cloud routes from the TS source (23 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/multi-cloud")

	// --- Cloud Account Management ---
	// POST /providers - 添加云服务商
	f.POST("/providers", auth.RequirePermission("multi_cloud", "write"), h.AddProvider)
	// GET /providers - 云服务商列表
	f.GET("/providers", auth.RequirePermission("multi_cloud", "read"), h.ListProviders)
	// PUT /providers/:id - 更新云服务商
	f.PUT("/providers/:id", auth.RequirePermission("multi_cloud", "write"), h.UpdateProvider)
	// DELETE /providers/:id - 删除云服务商
	f.DELETE("/providers/:id", auth.RequirePermission("multi_cloud", "delete"), h.DeleteProvider)
	// GET /providers/:id - 获取云服务商详情
	f.GET("/providers/:id", auth.RequirePermission("multi_cloud", "read"), h.GetProvider)

	// --- Resource Inventory ---
	// GET /resources - 统一资源列表
	f.GET("/resources", auth.RequirePermission("multi_cloud", "read"), h.ListResources)
	// GET /resources/:provider/:id - 资源详情
	f.GET("/resources/:provider/:id", auth.RequirePermission("multi_cloud", "read"), h.GetResource)
	// POST /resources/sync - 资源同步
	f.POST("/resources/sync", auth.RequirePermission("multi_cloud", "write"), h.SyncResources)

	// --- Cost Management ---
	// GET /costs - 多云成本
	f.GET("/costs", auth.RequirePermission("multi_cloud", "read"), h.GetCosts)
	// GET /costs/:provider - 单云成本
	f.GET("/costs/:provider", auth.RequirePermission("multi_cloud", "read"), h.GetProviderCost)
	// POST /costs/compare - 跨云成本对比
	f.POST("/costs/compare", auth.RequirePermission("multi_cloud", "read"), h.CompareCosts)

	// --- Optimization Recommendations ---
	// GET /recommendations - 优化建议
	f.GET("/recommendations", auth.RequirePermission("multi_cloud", "read"), h.GetRecommendations)

	// --- Health Check ---
	// GET /health - 资源健康状态
	f.GET("/health", auth.RequirePermission("multi_cloud", "read"), h.GetHealth)

	// --- Resource Statistics ---
	// GET /statistics - 资源统计概览
	f.GET("/statistics", auth.RequirePermission("multi_cloud", "read"), h.GetStatistics)

	// --- Resource Sync ---
	// POST /sync/:accountId - 触发资源同步
	f.POST("/sync/:accountId", auth.RequirePermission("multi_cloud", "write"), h.TriggerSync)

	// --- Compliance Check ---
	// POST /compliance/check - 执行合规检查
	f.POST("/compliance/check", auth.RequirePermission("multi_cloud", "read"), h.RunComplianceCheck)
	// GET /compliance/rules - 获取合规规则列表
	f.GET("/compliance/rules", auth.RequirePermission("multi_cloud", "read"), h.GetComplianceRules)

	// --- Resource Scheduling ---
	// POST /scheduling/policies - 创建调度策略
	f.POST("/scheduling/policies", auth.RequirePermission("multi_cloud", "write"), h.CreateSchedulingPolicy)
	// GET /scheduling/policies - 获取调度策略列表
	f.GET("/scheduling/policies", auth.RequirePermission("multi_cloud", "read"), h.ListSchedulingPolicies)
	// POST /scheduling/schedule - 资源调度决策
	f.POST("/scheduling/schedule", auth.RequirePermission("multi_cloud", "write"), h.ScheduleResource)
	// GET /scheduling/history - 调度历史
	f.GET("/scheduling/history", auth.RequirePermission("multi_cloud", "read"), h.GetSchedulingHistory)

	// --- Cross-Cloud Migration ---
	// POST /migration/plan - 创建迁移计划
	f.POST("/migration/plan", auth.RequirePermission("multi_cloud", "write"), h.CreateMigrationPlan)
	// POST /migration/:planId/execute - 执行迁移
	f.POST("/migration/:planId/execute", auth.RequirePermission("multi_cloud", "write"), h.ExecuteMigration)
}

// --- Cloud Account handlers ---

func (h *Handler) AddProvider(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.CloudAccountInput
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	account, err := h.svc.AddCloudAccount(c.Request.Context(), tenantID, body)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, account)
}

func (h *Handler) ListProviders(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	accounts, err := h.svc.ListCloudAccounts(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	// Filter by query params
	if provider := c.Query("provider"); provider != "" {
		filtered := make([]models.CloudAccount, 0, len(accounts))
		for _, a := range accounts {
			if a.CredentialType == provider {
				filtered = append(filtered, a)
			}
		}
		accounts = filtered
	}
	if status := c.Query("status"); status != "" {
		filtered := make([]models.CloudAccount, 0, len(accounts))
		for _, a := range accounts {
			if a.Status == status {
				filtered = append(filtered, a)
			}
		}
		accounts = filtered
	}
	respondSuccess(c, accounts)
}

func (h *Handler) UpdateProvider(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body models.UpdateCloudAccountInput
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	account, err := h.svc.UpdateCloudAccount(c.Request.Context(), tenantID, id, body)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, account)
}

func (h *Handler) DeleteProvider(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.RemoveCloudAccount(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "cloud account not found")
		return
	}
	respondSuccess(c, gin.H{"message": "Cloud account deleted"})
}

func (h *Handler) GetProvider(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	account, err := h.svc.GetProvider(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, account)
}

// --- Resource Inventory handlers ---

func (h *Handler) ListResources(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	accountID := c.Query("accountId")
	resources, err := h.svc.GetResourceInventory(c.Request.Context(), tenantID, accountID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	// Filter by query params
	if rtype := c.Query("type"); rtype != "" {
		filtered := make([]models.CloudResource, 0, len(resources))
		for _, r := range resources {
			if r.ResourceType == rtype {
				filtered = append(filtered, r)
			}
		}
		resources = filtered
	}
	if region := c.Query("region"); region != "" {
		filtered := make([]models.CloudResource, 0, len(resources))
		for _, r := range resources {
			if r.Region == region {
				rl := append(filtered, r) // avoid modifying filtered
				_ = rl
				filtered = rl
			}
		}
		resources = filtered
	}
	respondSuccess(c, resources)
}

func (h *Handler) GetResource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	provider := c.Param("provider")
	id := c.Param("id")
	resources, err := h.svc.GetResourceInventory(c.Request.Context(), tenantID, "")
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	for _, r := range resources {
		if r.ResourceType == provider && r.ResourceID == id {
			respondSuccess(c, r)
			return
		}
	}
	respondNotFound(c, "resource not found")
}

func (h *Handler) SyncResources(c *gin.Context) {
	var body struct {
		AccountID string `json:"accountId"`
		Provider  string `json:"provider"`
	}
	c.ShouldBindJSON(&body)
	result, err := h.svc.SyncResources(c.Request.Context(), "", body.AccountID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	result.Provider = body.Provider
	respondSuccess(c, result)
}

// --- Cost Management handlers ---

func (h *Handler) GetCosts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetCloudStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

func (h *Handler) GetProviderCost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	provider := c.Param("provider")
	breakdown, err := h.svc.GetProviderCost(c.Request.Context(), tenantID, provider)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, breakdown)
}

func (h *Handler) CompareCosts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.CostCompareInput
	c.ShouldBindJSON(&body)
	comparisons, err := h.svc.CompareCloudCosts(c.Request.Context(), tenantID, body)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, comparisons)
}

// --- Recommendations handlers ---

func (h *Handler) GetRecommendations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	recommendations, err := h.svc.GetRecommendations(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, recommendations)
}

// --- Health Check handlers ---

func (h *Handler) GetHealth(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status, err := h.svc.GetHealthStatus(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, status)
}

// --- Resource Statistics handlers ---

func (h *Handler) GetStatistics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetResourceStatistics(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

// --- Resource Sync handlers ---

func (h *Handler) TriggerSync(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	accountID := c.Param("accountId")
	result, err := h.svc.SyncResources(c.Request.Context(), tenantID, accountID)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// --- Compliance handlers ---

func (h *Handler) RunComplianceCheck(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.ComplianceCheckInput
	c.ShouldBindJSON(&body)
	report, err := h.svc.RunComplianceCheck(c.Request.Context(), tenantID, body.Categories)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, report)
}

func (h *Handler) GetComplianceRules(c *gin.Context) {
	rules := h.svc.GetComplianceRules()
	respondSuccess(c, rules)
}

// --- Scheduling handlers ---

func (h *Handler) CreateSchedulingPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.SchedulingPolicyInput
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.CreateSchedulingPolicy(c.Request.Context(), tenantID, body)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, policy)
}

func (h *Handler) ListSchedulingPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policies, err := h.svc.ListSchedulingPolicies(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, policies)
}

func (h *Handler) ScheduleResource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.ScheduleResourceInput
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	decision, err := h.svc.ScheduleResource(c.Request.Context(), tenantID, body)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, decision)
}

func (h *Handler) GetSchedulingHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	history, err := h.svc.GetSchedulingHistory(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, history)
}

// --- Migration handlers ---

func (h *Handler) CreateMigrationPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body models.MigrationPlanInput
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	plan, err := h.svc.CreateMigrationPlan(c.Request.Context(), tenantID, body)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, plan)
}

func (h *Handler) ExecuteMigration(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	planID := c.Param("planId")
	result, err := h.svc.ExecuteMigration(c.Request.Context(), tenantID, planID)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// --- Helpers ---

func splitQuery(roles string) []string {
	if roles == "" {
		return nil
	}
	result := make([]string, 0)
	for _, r := range strings.FieldsFunc(roles, splitComma) {
		result = append(result, r)
	}
	return result
}

func splitComma(c rune) bool {
	return c == ','
}

func stringPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}

func floatPtr(f float64) *float64 {
	return &f
}

func timePtr(t time.Time) *time.Time {
	return &t
}

func parseBool(b bool) *bool {
	return &b
}

// Unused but kept for compatibility
var (
	_ = strconv.Atoi
	_ = stringPtr
	_ = intPtr
	_ = floatPtr
	_ = timePtr
	_ = parseBool
)
