package handler

import (
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/security/models"
	"orion/platform-svc-go/internal/security/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all security service routes under a gin RouterGroup.
// Expected base: /api/v1
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// ---- Security scans ----
	r := rg.Group("/scans")
	r.POST("", auth.RequirePermission("security", "write"), h.CreateScan)
	r.GET("", h.ListScans)
	r.GET("/count", h.ScanCount)
	r.DELETE("/:id", auth.RequirePermission("security", "delete"), h.DeleteScan)
	r.GET("/:id", h.GetScan)

	// ---- Security findings ----
	f := rg.Group("/findings")
	f.POST("", auth.RequirePermission("security", "write"), h.CreateFinding)
	f.GET("", h.ListFindings)
	f.GET("/count", h.FindingCount)
	f.GET("/scan/:scan_id", h.FindingsByScanID)
	f.GET("/:id", h.GetFinding)
	f.PATCH("/:id", auth.RequirePermission("security", "write"), h.UpdateFinding)

	// ---- Audit plans ----
	ap := rg.Group("/audit/plans")
	ap.POST("", auth.RequirePermission("security", "write"), h.CreateAuditPlan)
	ap.GET("", h.ListAuditPlans)
	ap.GET("/:id", h.GetAuditPlan)
	ap.PUT("/:id", auth.RequirePermission("security", "write"), h.UpdateAuditPlan)
	ap.DELETE("/:id", auth.RequirePermission("security", "delete"), h.DeleteAuditPlan)

	// ---- Audit executions ----
	ae := rg.Group("/audit/executions")
	ae.POST("/plan/:plan_id", auth.RequirePermission("security", "write"), h.ExecuteAudit)
	ae.GET("/plan/:plan_id", h.ListExecutions)
	ae.GET("/:id", h.GetExecution)

	// ---- Compliance policies ----
	cp := rg.Group("/compliance/policies")
	cp.POST("", auth.RequirePermission("security", "write"), h.CreateCompliancePolicy)
	cp.GET("", h.ListCompliancePolicies)
	cp.GET("/:id", h.GetCompliancePolicy)
	cp.DELETE("/:id", auth.RequirePermission("security", "delete"), h.DeleteCompliancePolicy)

	// ---- Compliance evaluations ----
	ce := rg.Group("/compliance/evaluations")
	ce.POST("/policy/:policy_id", auth.RequirePermission("security", "write"), h.EvaluateCompliance)
	ce.GET("/policy/:policy_id/latest", h.GetLatestEvaluation)
	ce.GET("/:id", h.GetComplianceEvaluation)
	ce.GET("/score", h.GetComplianceScore)

	// ---- SBOM ----
	sb := rg.Group("/sbom")
	sb.POST("", auth.RequirePermission("security", "write"), h.CreateSBOM)
	sb.GET("", h.ListSBOMs)
	sb.GET("/count", h.SBOMCount)
	sb.GET("/:id", h.GetSBOM)

	// ---- Dependency analysis ----
	dp := rg.Group("/dependency")
	dp.POST("/analyze", auth.RequirePermission("security", "write"), h.AnalyzeDependency)
	dp.GET("/:package_name/:package_version", h.GetDependencyGraph)
	dp.GET("/list", h.ListDependencyGraphs)

	// ---- Dependency poisoning ----
	dpo := rg.Group("/poisoning")
	dpo.POST("/scan", auth.RequirePermission("security", "write"), h.ScanPoisoning)
	dpo.GET("", h.ListPoisoningScans)
	dpo.GET("/count", h.PoisoningCount)
}

// ---- Security Scans ----

func (h *Handler) CreateScan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterCreateScan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) ListScans(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterListScans")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.List(ctx, tenantID, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetScan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterGetScan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) DeleteScan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterDeleteScan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

func (h *Handler) ScanCount(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterScanCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"count": count})
}

// ---- Security Findings ----

func (h *Handler) CreateFinding(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterCreateFinding")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.SecurityFinding
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.CreateFinding(ctx, tenantID, &req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"message": "finding created"})
}

func (h *Handler) ListFindings(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterListFindings")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	severity := c.Query("severity")
	items, err := h.svc.ListFindings(ctx, tenantID, (page-1)*ps, ps, severity)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetFinding(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterGetFinding")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetFinding(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) UpdateFinding(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterUpdateFinding")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateFindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.UpdateFinding(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) FindingsByScanID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterFindingsByScanID")
	defer span.End()
	items, err := h.svc.FindingsByScanID(ctx, c.Param("scan_id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) FindingCount(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterFindingCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountFindings(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"count": count})
}

// ---- Audit Plans ----

func (h *Handler) CreateAuditPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterCreateAuditPlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateAuditPlan(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) ListAuditPlans(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterListAuditPlans")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListAuditPlans(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetAuditPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterGetAuditPlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetAuditPlan(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) UpdateAuditPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterUpdateAuditPlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateAuditPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.UpdateAuditPlan(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) DeleteAuditPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterDeleteAuditPlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteAuditPlan(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

// ---- Audit Executions ----

func (h *Handler) ExecuteAudit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterExecuteAudit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.ExecuteAudit(ctx, tenantID, c.Param("plan_id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) ListExecutions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterListExecutions")
	defer span.End()
	items, err := h.svc.ListExecutions(ctx, c.Param("plan_id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetExecution(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterGetExecution")
	defer span.End()
	d, err := h.svc.GetExecution(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

// ---- Compliance Policies ----

func (h *Handler) CreateCompliancePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterCreateCompliancePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateCompliancePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateCompliancePolicy(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) ListCompliancePolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterListCompliancePolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ft := c.Query("framework_type")
	items, err := h.svc.ListCompliancePolicies(ctx, tenantID, ft)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetCompliancePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterGetCompliancePolicy")
	defer span.End()
	d, err := h.svc.GetCompliancePolicy(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) DeleteCompliancePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterDeleteCompliancePolicy")
	defer span.End()
	if err := h.svc.DeleteCompliancePolicy(ctx, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

// ---- Compliance Evaluations ----

func (h *Handler) EvaluateCompliance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterEvaluateCompliance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.EvaluateCompliance(ctx, tenantID, c.Param("policy_id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) GetLatestEvaluation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterGetLatestEvaluation")
	defer span.End()
	d, err := h.svc.GetLatestEvaluation(ctx, c.Param("policy_id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) GetComplianceEvaluation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterGetComplianceEvaluation")
	defer span.End()
	_, err := h.svc.GetComplianceEvaluation(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	// Fallback to latest evaluation for simplicity
	d, err := h.svc.GetLatestEvaluation(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) GetComplianceScore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterGetComplianceScore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	s, err := h.svc.GetComplianceScore(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, s)
}

// ---- SBOM ----

func (h *Handler) CreateSBOM(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterCreateSBOM")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSBOMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateSBOM(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) ListSBOMs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterListSBOMs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListSBOMs(ctx, tenantID, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetSBOM(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterGetSBOM")
	defer span.End()
	d, err := h.svc.GetSBOM(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) SBOMCount(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterSBOMCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountSBOMs(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"count": count})
}

// ---- Dependency Analysis ----

func (h *Handler) AnalyzeDependency(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterAnalyzeDependency")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.AnalyzeDependencyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.AnalyzeDependency(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) GetDependencyGraph(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterGetDependencyGraph")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetDependencyGraph(ctx, tenantID, c.Param("package_name"), c.Param("package_version"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) ListDependencyGraphs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterListDependencyGraphs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListDependencyGraphs(ctx, tenantID, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ---- Dependency Poisoning ----

func (h *Handler) ScanPoisoning(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterScanPoisoning")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.ScanDependencyPoisoningRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.ScanDependencyPoisoning(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) ListPoisoningScans(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterListPoisoningScans")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListDependencyPoisoningScans(ctx, tenantID, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) PoisoningCount(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityCenterPoisoningCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountDependencyPoisoningScans(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"count": count})
}
