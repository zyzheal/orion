package handler

import (
	"errors"
	"go.opentelemetry.io/otel"
	"strconv"

	"orion/platform-svc-go/internal/infrastructure/dr/models"
	"orion/platform-svc-go/internal/infrastructure/dr/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// maxPageSize caps page_size so one request cannot pull the whole table.
const maxPageSize = 100

// parsePagination turns the page and page_size query strings into the offset and
// limit the repository takes. Both list handlers used to discard the Atoi error,
// so page=abc meant page 0 and page_size=0 meant no LIMIT at all.
func (h *Handler) parsePagination(c *gin.Context) (offset, limit int, ok bool) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		respondBadRequest(c, "page must be an integer >= 1")
		return 0, 0, false
	}
	size, err := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if err != nil || size < 1 || size > maxPageSize {
		respondBadRequest(c, "page_size must be an integer between 1 and "+strconv.Itoa(maxPageSize))
		return 0, 0, false
	}
	return (page - 1) * size, size, true
}

// respondServiceError maps the service sentinels onto HTTP statuses. Collapsing
// every error into one status meant a malformed request, a missing row and a
// database outage all came back with the same code.
func respondServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidInput):
		respondBadRequest(c, err.Error())
	case errors.Is(err, service.ErrDRPlanNotFound),
		errors.Is(err, service.ErrFailoverTestNotFound),
		errors.Is(err, service.ErrBackupConfigNotFound),
		errors.Is(err, service.ErrPolicyNotFound):
		respondNotFound(c, err.Error())
	default:
		respondInternalError(c, err.Error())
	}
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
		policies.GET("/count", auth.RequirePermission("dr", "read"), h.CountPolicies)
		policies.GET("/:id/can-failover", auth.RequirePermission("dr", "read"), h.CanFailover)
		policies.GET("/:id/compliance", auth.RequirePermission("dr", "read"), h.CheckPolicyCompliance)
		policies.GET("/cost-estimate", auth.RequirePermission("dr", "read"), h.GetCostEstimate)
	}
}

// ─── DR Plan Handlers ────────────────────────────────────────────────────────

func (h *Handler) CreatePlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRCreatePlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDRPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	plan, err := h.svc.CreatePlan(ctx, tenantID, &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondCreated(c, plan)
}

func (h *Handler) ListPlans(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRListPlans")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	offset, limit, ok := h.parsePagination(c)
	if !ok {
		return
	}

	items, err := h.svc.ListPlans(ctx, tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	count, err := h.svc.CountPlans(ctx, tenantID)
	if err != nil {
		// A discarded count error answered total: 0 with a full data array,
		// which read as an empty store in a UI bound to total.
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": items, "total": count})
}

func (h *Handler) GetPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRGetPlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	plan, err := h.svc.GetPlan(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, plan)
}

func (h *Handler) UpdatePlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRUpdatePlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateDRPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	plan, err := h.svc.UpdatePlan(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, plan)
}

func (h *Handler) DeletePlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRDeletePlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeletePlan(ctx, tenantID, c.Param("id")); err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) CountPlans(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRCountPlans")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountPlans(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// ─── Failover Handlers ───────────────────────────────────────────────────────

func (h *Handler) TriggerFailover(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRTriggerFailover")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.TriggerFailoverRequest
	_ = c.ShouldBindJSON(&req) // body is optional

	result, err := h.svc.TriggerFailover(ctx, tenantID, c.Param("id"), req.TriggeredBy)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondCreated(c, result)
}

func (h *Handler) TestFailover(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRTestFailover")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.TestFailoverRequest
	_ = c.ShouldBindJSON(&req) // body is optional

	result, err := h.svc.TestFailover(ctx, tenantID, c.Param("id"), req.TestName, req.TestedBy)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondCreated(c, result)
}

func (h *Handler) ListFailoverTests(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRListFailoverTests")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var planID *string
	if pid := c.Query("plan_id"); pid != "" {
		planID = &pid
	}

	items, err := h.svc.ListFailoverTests(ctx, tenantID, planID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetFailoverTest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRGetFailoverTest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	test, err := h.svc.GetFailoverTest(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, test)
}

func (h *Handler) CompleteFailoverTest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRCompleteFailoverTest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CompleteFailoverTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	test, err := h.svc.CompleteFailoverTest(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, test)
}

// ─── Backup Config Handlers ──────────────────────────────────────────────────

func (h *Handler) CreateBackupConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRCreateBackupConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateBackupConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	bc, err := h.svc.CreateBackupConfig(ctx, tenantID, &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondCreated(c, bc)
}

func (h *Handler) ListBackupConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRListBackupConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	offset, limit, ok := h.parsePagination(c)
	if !ok {
		return
	}

	items, err := h.svc.ListBackupConfigs(ctx, tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	count, err := h.svc.CountBackupConfigs(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": items, "total": count})
}

func (h *Handler) GetBackupConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRGetBackupConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	bc, err := h.svc.GetBackupConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, bc)
}

func (h *Handler) CountBackupConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRCountBackupConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountBackupConfigs(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) UpdateBackupConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRUpdateBackupConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateBackupConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	bc, err := h.svc.UpdateBackupConfig(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, bc)
}

func (h *Handler) DeleteBackupConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRDeleteBackupConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteBackupConfig(ctx, tenantID, c.Param("id")); err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ─── RTO/RPO Status Handlers ─────────────────────────────────────────────────

func (h *Handler) GetRTOStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRGetRTOStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.GetRTOStatus(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, results)
}

func (h *Handler) GetRPOStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRGetRPOStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.GetRPOStatus(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, results)
}

// ─── Drill Handlers ──────────────────────────────────────────────────────────

func (h *Handler) ScheduleDrill(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRScheduleDrill")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.ScheduleDrillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	test, err := h.svc.ScheduleDrill(ctx, tenantID, &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondCreated(c, test)
}

func (h *Handler) ListDrills(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRListDrills")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListDrills(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ─── Policy Handlers ─────────────────────────────────────────────────────────

func (h *Handler) CreatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRCreatePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.CreatePolicy(ctx, tenantID, &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondCreated(c, policy)
}

func (h *Handler) ListPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRListPolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	offset, limit, ok := h.parsePagination(c)
	if !ok {
		return
	}

	items, err := h.svc.ListPolicies(ctx, tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	count, err := h.svc.CountPolicies(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": items, "total": count})
}

func (h *Handler) GetPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRGetPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	policy, err := h.svc.GetPolicy(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, policy)
}

func (h *Handler) CountPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRCountPolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountPolicies(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) UpdatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRUpdatePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.UpdatePolicy(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, policy)
}

func (h *Handler) DeletePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRDeletePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeletePolicy(ctx, tenantID, c.Param("id")); err != nil {
		respondServiceError(c, err)
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) CanFailover(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRCanFailover")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	region := c.Query("region")
	if region == "" {
		respondBadRequest(c, "region query parameter is required")
		return
	}

	policy, err := h.svc.GetPolicy(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondServiceError(c, err)
		return
	}

	allowed := h.svc.CanFailover(policy, region)
	respondSuccess(c, gin.H{"allowed": allowed, "policy_id": policy.ID, "region": region})
}

func (h *Handler) CheckPolicyCompliance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRCheckPolicyCompliance")
	defer span.End()
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

	policy, err := h.svc.GetPolicy(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondServiceError(c, err)
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
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraDRGetCostEstimate")
	defer span.End()
	strategy := c.DefaultQuery("strategy", "cold-standby")
	serviceCount, _ := strconv.Atoi(c.DefaultQuery("service_count", "1"))

	estimate := h.svc.GetFailoverCostEstimate(strategy, serviceCount)
	respondSuccess(c, estimate)
}
