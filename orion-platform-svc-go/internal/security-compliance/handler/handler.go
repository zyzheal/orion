package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/security-compliance/models"
	"orion/platform-svc-go/internal/security-compliance/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all security-compliance endpoints under the given group.
// Mirrors /api/v1/compliance and /api/v1/audit routes from the TS source (18 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	compliance := rg.Group("/compliance")

	// --- Compliance Policies ---
	// GET /compliance/policies - List policies
	compliance.GET("/policies", auth.RequirePermission("security_compliance", "read"), h.ListPolicies)
	// POST /compliance/policies - Define compliance policy
	compliance.POST("/policies", auth.RequirePermission("security_compliance", "write"), h.DefinePolicy)

	// --- Compliance Evaluation ---
	// POST /compliance/evaluate - Evaluate compliance
	compliance.POST("/evaluate", auth.RequirePermission("security_compliance", "write"), h.EvaluateCompliance)

	// --- Compliance Report ---
	// GET /compliance/report/:policyId - Get compliance report
	compliance.GET("/report/:policyId", auth.RequirePermission("security_compliance", "read"), h.GetComplianceReport)

	// --- Compliance Score ---
	// GET /compliance/score - Get compliance score
	compliance.GET("/score", auth.RequirePermission("security_compliance", "read"), h.GetComplianceScore)

	// --- Compliance Remediation ---
	// POST /compliance/remediate - Auto-remediate compliance gaps
	compliance.POST("/remediate", auth.RequirePermission("security_compliance", "write"), h.AutoRemediateCompliance)

	// --- Compliance Frameworks ---
	// GET /compliance/frameworks - List supported frameworks
	compliance.GET("/frameworks", auth.RequirePermission("security_compliance", "read"), h.GetFrameworks)
	// GET /compliance/frameworks/:id - Get framework details
	compliance.GET("/frameworks/:id", auth.RequirePermission("security_compliance", "read"), h.GetFramework)

	// --- Evidence Collection ---
	// POST /compliance/evidence - Collect evidence
	compliance.POST("/evidence", auth.RequirePermission("security_compliance", "write"), h.CollectEvidence)
	// GET /compliance/evidence/:policyId - Get evidence for policy
	compliance.GET("/evidence/:policyId", auth.RequirePermission("security_compliance", "read"), h.GetEvidence)
	// POST /compliance/evidence/generate - Generate evidence collection
	compliance.POST("/evidence/generate", auth.RequirePermission("security_compliance", "write"), h.GenerateEvidenceCollection)

	// --- Gap Analysis ---
	// POST /compliance/gap-analysis - Perform gap analysis
	compliance.POST("/gap-analysis", auth.RequirePermission("security_compliance", "write"), h.PerformGapAnalysis)

	// --- Audit Plans ---
	audit := rg.Group("/audit")
	// GET /audit/plans - List audit plans
	audit.GET("/plans", auth.RequirePermission("security_compliance", "read"), h.ListAuditPlans)
	// POST /audit/plans - Create audit plan
	audit.POST("/plans", auth.RequirePermission("security_compliance", "write"), h.CreateAuditPlan)

	// --- Audit Execution ---
	// POST /audit/:id/execute - Execute audit
	audit.POST("/:id/execute", auth.RequirePermission("security_compliance", "write"), h.ExecuteAudit)

	// --- Audit Report ---
	// GET /audit/:id/report - Get audit report
	audit.GET("/:id/report", auth.RequirePermission("security_compliance", "read"), h.GetAuditReport)

	// --- Audit Findings ---
	// GET /audit/:id/findings - Get audit findings
	audit.GET("/:id/findings", auth.RequirePermission("security_compliance", "read"), h.GetAuditFindings)
	// POST /audit/findings/:id/close - Close finding
	audit.POST("/findings/:id/close", auth.RequirePermission("security_compliance", "delete"), h.CloseFinding)
}

// --- Compliance Policies ---

func (h *Handler) ListPolicies(c *gin.Context) {
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

func (h *Handler) DefinePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.DefinePolicy(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, policy)
}

// --- Compliance Evaluation ---

func (h *Handler) EvaluateCompliance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateComplianceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluateCompliance(c.Request.Context(), tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// --- Compliance Report ---

func (h *Handler) GetComplianceReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	report, err := h.svc.GetComplianceReport(c.Request.Context(), tenantID, policyID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, report)
}

// --- Compliance Score ---

func (h *Handler) GetComplianceScore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	score, err := h.svc.GetComplianceScore(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, score)
}

// --- Remediation ---

func (h *Handler) AutoRemediateCompliance(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RemediationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.AutoRemediateCompliance(c.Request.Context(), tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// --- Audit Plans ---

func (h *Handler) ListAuditPlans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	plans, err := h.svc.ListAuditPlans(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, plans)
}

func (h *Handler) CreateAuditPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	plan, err := h.svc.CreateAuditPlan(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, plan)
}

// --- Audit Execution ---

func (h *Handler) ExecuteAudit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	planID := c.Param("id")
	execution, err := h.svc.ExecuteAudit(c.Request.Context(), tenantID, planID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, execution)
}

// --- Audit Report ---

func (h *Handler) GetAuditReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	executionID := c.Param("id")
	report, err := h.svc.GetAuditReport(c.Request.Context(), tenantID, executionID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, report)
}

// --- Audit Findings ---

func (h *Handler) GetAuditFindings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	reportID := c.Param("id")
	findings, err := h.svc.GetAuditFindings(c.Request.Context(), tenantID, reportID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, findings)
}

func (h *Handler) CloseFinding(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	findingID := c.Param("id")
	var req models.CloseFindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.CloseFinding(c.Request.Context(), tenantID, findingID, req.Reason); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "finding closed"})
}

// --- Compliance Frameworks ---

func (h *Handler) GetFrameworks(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	list, err := h.svc.GetFrameworks(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, list)
}

func (h *Handler) GetFramework(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	fw, err := h.svc.GetFramework(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, fw)
}

// --- Evidence Collection ---

func (h *Handler) CollectEvidence(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CollectEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	collection, err := h.svc.CollectEvidence(c.Request.Context(), tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, collection)
}

func (h *Handler) GetEvidence(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	evidence, err := h.svc.GetEvidence(c.Request.Context(), tenantID, policyID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, evidence)
}

func (h *Handler) GenerateEvidenceCollection(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CollectEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	collection, err := h.svc.GenerateEvidenceCollection(c.Request.Context(), tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, collection)
}

// --- Gap Analysis ---

func (h *Handler) PerformGapAnalysis(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.GapAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.PerformGapAnalysis(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}
