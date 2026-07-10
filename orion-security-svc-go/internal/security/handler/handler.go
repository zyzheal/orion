package handler

import (
	"net/http"
	"strconv"
	"orion/security-svc-go/internal/security/models"
	"orion/security-svc-go/internal/security/service"
	"orion/go-common/pkg/auth"

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
	tenantID := c.GetString("tenant_id")
	var req models.CreateScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *Handler) ListScans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.List(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetScan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) DeleteScan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) ScanCount(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ---- Security Findings ----

func (h *Handler) CreateFinding(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.SecurityFinding
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.CreateFinding(c.Request.Context(), tenantID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "finding created"})
}

func (h *Handler) ListFindings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	severity := c.Query("severity")
	items, err := h.svc.ListFindings(c.Request.Context(), tenantID, (page-1)*ps, ps, severity)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetFinding(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetFinding(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) UpdateFinding(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateFindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.UpdateFinding(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) FindingsByScanID(c *gin.Context) {
	items, err := h.svc.FindingsByScanID(c.Request.Context(), c.Param("scan_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) FindingCount(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountFindings(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ---- Audit Plans ----

func (h *Handler) CreateAuditPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.CreateAuditPlan(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *Handler) ListAuditPlans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListAuditPlans(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetAuditPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetAuditPlan(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) UpdateAuditPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateAuditPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.UpdateAuditPlan(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) DeleteAuditPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteAuditPlan(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ---- Audit Executions ----

func (h *Handler) ExecuteAudit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.ExecuteAudit(c.Request.Context(), tenantID, c.Param("plan_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) ListExecutions(c *gin.Context) {
	items, err := h.svc.ListExecutions(c.Request.Context(), c.Param("plan_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetExecution(c *gin.Context) {
	d, err := h.svc.GetExecution(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

// ---- Compliance Policies ----

func (h *Handler) CreateCompliancePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateCompliancePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.CreateCompliancePolicy(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *Handler) ListCompliancePolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ft := c.Query("framework_type")
	items, err := h.svc.ListCompliancePolicies(c.Request.Context(), tenantID, ft)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetCompliancePolicy(c *gin.Context) {
	d, err := h.svc.GetCompliancePolicy(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) DeleteCompliancePolicy(c *gin.Context) {
	if err := h.svc.DeleteCompliancePolicy(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ---- Compliance Evaluations ----

func (h *Handler) EvaluateCompliance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.EvaluateCompliance(c.Request.Context(), tenantID, c.Param("policy_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) GetLatestEvaluation(c *gin.Context) {
	d, err := h.svc.GetLatestEvaluation(c.Request.Context(), c.Param("policy_id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) GetComplianceEvaluation(c *gin.Context) {
	_, err := h.svc.GetComplianceEvaluation(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	// Fallback to latest evaluation for simplicity
	d, err := h.svc.GetLatestEvaluation(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) GetComplianceScore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	s, err := h.svc.GetComplianceScore(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

// ---- SBOM ----

func (h *Handler) CreateSBOM(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSBOMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.CreateSBOM(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *Handler) ListSBOMs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListSBOMs(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetSBOM(c *gin.Context) {
	d, err := h.svc.GetSBOM(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) SBOMCount(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountSBOMs(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ---- Dependency Analysis ----

func (h *Handler) AnalyzeDependency(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.AnalyzeDependencyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.AnalyzeDependency(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *Handler) GetDependencyGraph(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetDependencyGraph(c.Request.Context(), tenantID, c.Param("package_name"), c.Param("package_version"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) ListDependencyGraphs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListDependencyGraphs(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// ---- Dependency Poisoning ----

func (h *Handler) ScanPoisoning(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ScanDependencyPoisoningRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.ScanDependencyPoisoning(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *Handler) ListPoisoningScans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListDependencyPoisoningScans(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) PoisoningCount(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountDependencyPoisoningScans(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}
