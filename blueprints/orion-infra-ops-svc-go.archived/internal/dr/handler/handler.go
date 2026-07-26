package handler

import (
	"strconv"

	"orion/infra-ops-svc-go/internal/dr/models"
	"orion/infra-ops-svc-go/internal/dr/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// DR Plans
	plans := rg.Group("/plans")
	{
		plans.POST("", auth.RequirePermission("dr", "write"), h.CreatePlan)
		plans.GET("", auth.RequirePermission("dr", "read"), h.ListPlans)
		plans.GET("/count", auth.RequirePermission("dr", "read"), h.CountPlans)
		plans.GET("/:id", auth.RequirePermission("dr", "read"), h.GetPlan)
		plans.PUT("/:id", auth.RequirePermission("dr", "write"), h.UpdatePlan)
		plans.DELETE("/:id", auth.RequirePermission("dr", "delete"), h.DeletePlan)
		plans.POST("/:id/trigger-failover", auth.RequirePermission("dr", "execute"), h.TriggerFailover)
		plans.POST("/:id/test-failover", auth.RequirePermission("dr", "write"), h.TestFailover)
	}

	// Failover Tests
	tests := rg.Group("/failover-tests")
	{
		tests.GET("", auth.RequirePermission("dr", "read"), h.ListFailoverTests)
		tests.GET("/:id", auth.RequirePermission("dr", "read"), h.GetFailoverTest)
		tests.POST("/:id/complete", auth.RequirePermission("dr", "execute"), h.CompleteFailoverTest)
	}

	// Backup Configs
	backups := rg.Group("/backup-configs")
	{
		backups.POST("", auth.RequirePermission("dr", "write"), h.CreateBackupConfig)
		backups.GET("", auth.RequirePermission("dr", "read"), h.ListBackupConfigs)
		backups.GET("/count", auth.RequirePermission("dr", "read"), h.CountBackupConfigs)
		backups.GET("/:id", auth.RequirePermission("dr", "read"), h.GetBackupConfig)
		backups.PUT("/:id", auth.RequirePermission("dr", "write"), h.UpdateBackupConfig)
		backups.DELETE("/:id", auth.RequirePermission("dr", "delete"), h.DeleteBackupConfig)
	}

	// RTO/RPO Status
	status := rg.Group("/status")
	{
		status.GET("/rto", auth.RequirePermission("dr", "read"), h.GetRTOStatus)
		status.GET("/rpo", auth.RequirePermission("dr", "read"), h.GetRPOStatus)
	}

	// DR Drills
	drills := rg.Group("/drills")
	{
		drills.POST("", auth.RequirePermission("dr", "write"), h.ScheduleDrill)
		drills.GET("", auth.RequirePermission("dr", "read"), h.ListDrills)
	}

	// DR Policies
	policies := rg.Group("/policies")
	{
		policies.POST("", auth.RequirePermission("dr", "write"), h.CreatePolicy)
		policies.GET("", auth.RequirePermission("dr", "read"), h.ListPolicies)
		policies.GET("/count", auth.RequirePermission("dr", "read"), h.CountPolicies)
		policies.GET("/:id", auth.RequirePermission("dr", "read"), h.GetPolicy)
		policies.PUT("/:id", auth.RequirePermission("dr", "write"), h.UpdatePolicy)
		policies.DELETE("/:id", auth.RequirePermission("dr", "delete"), h.DeletePolicy)
		policies.GET("/:id/can-failover", auth.RequirePermission("dr", "read"), h.CanFailover)
		policies.GET("/:id/compliance", auth.RequirePermission("dr", "read"), h.CheckPolicyCompliance)
		policies.GET("/cost-estimate", auth.RequirePermission("dr", "read"), h.GetCostEstimate)
	}
}

// ─── DR Plan Handlers ────────────────────────────────────────────────────────

func (h *Handler) CreatePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDRPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	plan, err := h.svc.CreatePlan(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, plan)
}

func (h *Handler) ListPlans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * ps
	if offset < 0 {
		offset = 0
	}

	items, err := h.svc.ListPlans(c.Request.Context(), tenantID, offset, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	count, _ := h.svc.CountPlans(c.Request.Context(), tenantID)
	respondSuccess(c, gin.H{"data": items, "total": count})
}

func (h *Handler) GetPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	plan, err := h.svc.GetPlan(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, plan)
}

func (h *Handler) UpdatePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateDRPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	plan, err := h.svc.UpdatePlan(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, plan)
}

func (h *Handler) DeletePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeletePlan(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) CountPlans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountPlans(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// ─── Failover Handlers ───────────────────────────────────────────────────────

func (h *Handler) TriggerFailover(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.TriggerFailoverRequest
	_ = c.ShouldBindJSON(&req) // body is optional

	result, err := h.svc.TriggerFailover(c.Request.Context(), tenantID, c.Param("id"), req.TriggeredBy)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) TestFailover(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.TestFailoverRequest
	_ = c.ShouldBindJSON(&req) // body is optional

	result, err := h.svc.TestFailover(c.Request.Context(), tenantID, c.Param("id"), req.TestName, req.TestedBy)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) ListFailoverTests(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var planID *string
	if pid := c.Query("plan_id"); pid != "" {
		planID = &pid
	}

	items, err := h.svc.ListFailoverTests(c.Request.Context(), tenantID, planID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetFailoverTest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	test, err := h.svc.GetFailoverTest(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, test)
}

func (h *Handler) CompleteFailoverTest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CompleteFailoverTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	test, err := h.svc.CompleteFailoverTest(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, test)
}

// ─── Backup Config Handlers ──────────────────────────────────────────────────

func (h *Handler) CreateBackupConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBackupConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	bc, err := h.svc.CreateBackupConfig(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, bc)
}

func (h *Handler) ListBackupConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * ps
	if offset < 0 {
		offset = 0
	}

	items, err := h.svc.ListBackupConfigs(c.Request.Context(), tenantID, offset, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	count, _ := h.svc.CountBackupConfigs(c.Request.Context(), tenantID)
	respondSuccess(c, gin.H{"data": items, "total": count})
}

func (h *Handler) GetBackupConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	bc, err := h.svc.GetBackupConfig(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, bc)
}

func (h *Handler) CountBackupConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountBackupConfigs(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) UpdateBackupConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateBackupConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	bc, err := h.svc.UpdateBackupConfig(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, bc)
}

func (h *Handler) DeleteBackupConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteBackupConfig(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ─── RTO/RPO Status Handlers ─────────────────────────────────────────────────

func (h *Handler) GetRTOStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.GetRTOStatus(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, results)
}

func (h *Handler) GetRPOStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.GetRPOStatus(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, results)
}

// ─── Drill Handlers ──────────────────────────────────────────────────────────

func (h *Handler) ScheduleDrill(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ScheduleDrillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	test, err := h.svc.ScheduleDrill(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, test)
}

func (h *Handler) ListDrills(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListDrills(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ─── Policy Handlers ─────────────────────────────────────────────────────────

func (h *Handler) CreatePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.CreatePolicy(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, policy)
}

func (h *Handler) ListPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * ps
	if offset < 0 {
		offset = 0
	}

	items, err := h.svc.ListPolicies(c.Request.Context(), tenantID, offset, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	count, _ := h.svc.CountPolicies(c.Request.Context(), tenantID)
	respondSuccess(c, gin.H{"data": items, "total": count})
}

func (h *Handler) GetPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policy, err := h.svc.GetPolicy(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, policy)
}

func (h *Handler) CountPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountPolicies(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) UpdatePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.UpdatePolicy(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, policy)
}

func (h *Handler) DeletePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeletePolicy(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) CanFailover(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	region := c.Query("region")
	if region == "" {
		respondBadRequest(c, "region query parameter is required")
		return
	}

	policy, err := h.svc.GetPolicy(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}

	allowed := h.svc.CanFailover(policy, region)
	respondSuccess(c, gin.H{"allowed": allowed, "policy_id": policy.ID, "region": region})
}

func (h *Handler) CheckPolicyCompliance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rtoStr := c.Query("actual_rto")
	rpoStr := c.Query("actual_rpo")

	if rtoStr == "" || rpoStr == "" {
		respondBadRequest(c, "actual_rto and actual_rpo query parameters are required")
		return
	}

	actualRTO, err := strconv.Atoi(rtoStr)
	if err != nil {
		respondBadRequest(c, "invalid actual_rto")
		return
	}
	actualRPO, err := strconv.Atoi(rpoStr)
	if err != nil {
		respondBadRequest(c, "invalid actual_rpo")
		return
	}

	policy, err := h.svc.GetPolicy(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}

	compliant := h.svc.CheckCompliance(policy, actualRTO, actualRPO)
	respondSuccess(c, gin.H{
		"compliant":  compliant,
		"policy_id":  policy.ID,
		"actual_rto": actualRTO,
		"actual_rpo": actualRPO,
	})
}

func (h *Handler) GetCostEstimate(c *gin.Context) {
	strategy := c.DefaultQuery("strategy", "cold-standby")
	serviceCount, _ := strconv.Atoi(c.DefaultQuery("service_count", "1"))

	estimate := h.svc.GetFailoverCostEstimate(strategy, serviceCount)
	respondSuccess(c, estimate)
}