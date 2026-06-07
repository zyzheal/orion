package handler

import (
	"net/http"
	"strconv"

	"orion/dr-svc-go/internal/models"
	"orion/dr-svc-go/internal/service"

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
		plans.GET("", h.ListPlans)
		plans.GET("/count", h.CountPlans)
		plans.GET("/:id", h.GetPlan)
		plans.PUT("/:id", auth.RequirePermission("dr", "write"), h.UpdatePlan)
		plans.DELETE("/:id", auth.RequirePermission("dr", "delete"), h.DeletePlan)
		plans.POST("/:id/trigger-failover", auth.RequirePermission("dr", "execute"), h.TriggerFailover)
		plans.POST("/:id/test-failover", auth.RequirePermission("dr", "write"), h.TestFailover)
	}

	// Failover Tests
	tests := rg.Group("/failover-tests")
	{
		tests.GET("", h.ListFailoverTests)
		tests.GET("/:id", h.GetFailoverTest)
		tests.POST("/:id/complete", auth.RequirePermission("dr", "execute"), h.CompleteFailoverTest)
	}

	// Backup Configs
	backups := rg.Group("/backup-configs")
	{
		backups.POST("", auth.RequirePermission("dr", "write"), h.CreateBackupConfig)
		backups.GET("", h.ListBackupConfigs)
		backups.GET("/count", h.CountBackupConfigs)
		backups.GET("/:id", h.GetBackupConfig)
		backups.PUT("/:id", auth.RequirePermission("dr", "write"), h.UpdateBackupConfig)
		backups.DELETE("/:id", auth.RequirePermission("dr", "delete"), h.DeleteBackupConfig)
	}

	// RTO/RPO Status
	status := rg.Group("/status")
	{
		status.GET("/rto", h.GetRTOStatus)
		status.GET("/rpo", h.GetRPOStatus)
	}

	// DR Drills
	drills := rg.Group("/drills")
	{
		drills.POST("", auth.RequirePermission("dr", "write"), h.ScheduleDrill)
		drills.GET("", h.ListDrills)
	}

	// DR Policies
	policies := rg.Group("/policies")
	{
		policies.POST("", auth.RequirePermission("dr", "write"), h.CreatePolicy)
		policies.GET("", h.ListPolicies)
		policies.GET("/count", h.CountPolicies)
		policies.GET("/:id", h.GetPolicy)
		policies.PUT("/:id", auth.RequirePermission("dr", "write"), h.UpdatePolicy)
		policies.DELETE("/:id", auth.RequirePermission("dr", "delete"), h.DeletePolicy)
		policies.GET("/:id/can-failover", h.CanFailover)
		policies.GET("/:id/compliance", h.CheckPolicyCompliance)
		policies.GET("/cost-estimate", h.GetCostEstimate)
	}
}

// ─── DR Plan Handlers ────────────────────────────────────────────────────────

func (h *Handler) CreatePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDRPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	plan, err := h.svc.CreatePlan(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, plan)
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	count, _ := h.svc.CountPlans(c.Request.Context(), tenantID)
	c.JSON(http.StatusOK, gin.H{"data": items, "total": count})
}

func (h *Handler) GetPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	plan, err := h.svc.GetPlan(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, plan)
}

func (h *Handler) UpdatePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateDRPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	plan, err := h.svc.UpdatePlan(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, plan)
}

func (h *Handler) DeletePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeletePlan(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) CountPlans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountPlans(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ─── Failover Handlers ───────────────────────────────────────────────────────

func (h *Handler) TriggerFailover(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.TriggerFailoverRequest
	_ = c.ShouldBindJSON(&req) // body is optional

	result, err := h.svc.TriggerFailover(c.Request.Context(), tenantID, c.Param("id"), req.TriggeredBy)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *Handler) TestFailover(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.TestFailoverRequest
	_ = c.ShouldBindJSON(&req) // body is optional

	result, err := h.svc.TestFailover(c.Request.Context(), tenantID, c.Param("id"), req.TestName, req.TestedBy)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *Handler) ListFailoverTests(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var planID *string
	if pid := c.Query("plan_id"); pid != "" {
		planID = &pid
	}

	items, err := h.svc.ListFailoverTests(c.Request.Context(), tenantID, planID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetFailoverTest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	test, err := h.svc.GetFailoverTest(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, test)
}

func (h *Handler) CompleteFailoverTest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CompleteFailoverTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	test, err := h.svc.CompleteFailoverTest(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, test)
}

// ─── Backup Config Handlers ──────────────────────────────────────────────────

func (h *Handler) CreateBackupConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateBackupConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	bc, err := h.svc.CreateBackupConfig(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, bc)
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	count, _ := h.svc.CountBackupConfigs(c.Request.Context(), tenantID)
	c.JSON(http.StatusOK, gin.H{"data": items, "total": count})
}

func (h *Handler) GetBackupConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	bc, err := h.svc.GetBackupConfig(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, bc)
}

func (h *Handler) CountBackupConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountBackupConfigs(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) UpdateBackupConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateBackupConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	bc, err := h.svc.UpdateBackupConfig(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, bc)
}

func (h *Handler) DeleteBackupConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteBackupConfig(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ─── RTO/RPO Status Handlers ─────────────────────────────────────────────────

func (h *Handler) GetRTOStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.GetRTOStatus(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": results})
}

func (h *Handler) GetRPOStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.GetRPOStatus(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": results})
}

// ─── Drill Handlers ──────────────────────────────────────────────────────────

func (h *Handler) ScheduleDrill(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ScheduleDrillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	test, err := h.svc.ScheduleDrill(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, test)
}

func (h *Handler) ListDrills(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListDrills(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// ─── Policy Handlers ─────────────────────────────────────────────────────────

func (h *Handler) CreatePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	policy, err := h.svc.CreatePolicy(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, policy)
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	count, _ := h.svc.CountPolicies(c.Request.Context(), tenantID)
	c.JSON(http.StatusOK, gin.H{"data": items, "total": count})
}

func (h *Handler) GetPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policy, err := h.svc.GetPolicy(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, policy)
}

func (h *Handler) CountPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountPolicies(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) UpdatePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	policy, err := h.svc.UpdatePolicy(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, policy)
}

func (h *Handler) DeletePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeletePolicy(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) CanFailover(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	region := c.Query("region")
	if region == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "region query parameter is required"})
		return
	}

	policy, err := h.svc.GetPolicy(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	allowed := h.svc.CanFailover(policy, region)
	c.JSON(http.StatusOK, gin.H{"allowed": allowed, "policy_id": policy.ID, "region": region})
}

func (h *Handler) CheckPolicyCompliance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rtoStr := c.Query("actual_rto")
	rpoStr := c.Query("actual_rpo")

	if rtoStr == "" || rpoStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "actual_rto and actual_rpo query parameters are required"})
		return
	}

	actualRTO, err := strconv.Atoi(rtoStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid actual_rto"})
		return
	}
	actualRPO, err := strconv.Atoi(rpoStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid actual_rpo"})
		return
	}

	policy, err := h.svc.GetPolicy(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	compliant := h.svc.CheckCompliance(policy, actualRTO, actualRPO)
	c.JSON(http.StatusOK, gin.H{
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
	c.JSON(http.StatusOK, estimate)
}
