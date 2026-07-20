package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/security-compliance/models"
	"orion/platform-svc-go/internal/security-compliance/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.CompliancePolicy, error)
	DefinePolicy(ctx context.Context, tenantID string, req models.CreatePolicyRequest) (*models.CompliancePolicy, error)
	EvaluateCompliance(ctx context.Context, tenantID string, req models.EvaluateComplianceRequest) (*models.ComplianceEvaluationResult, error)
	GetComplianceReport(ctx context.Context, tenantID, policyID string) (*models.ComplianceReport, error)
	GetComplianceScore(ctx context.Context, tenantID string) (*models.ComplianceScore, error)
	AutoRemediateCompliance(ctx context.Context, tenantID string, req models.RemediationRequest) (*models.RemediationResult, error)
	GetFrameworks(ctx context.Context, tenantID string) (*models.FrameworkList, error)
	GetFramework(ctx context.Context, tenantID, id string) (*models.ComplianceFramework, error)
	CollectEvidence(ctx context.Context, tenantID string, req models.CollectEvidenceRequest) (*models.EvidenceCollection, error)
	GetEvidence(ctx context.Context, tenantID, policyID string) ([]models.Evidence, error)
	GenerateEvidenceCollection(ctx context.Context, tenantID string, req models.CollectEvidenceRequest) (*models.EvidenceCollection, error)
	PerformGapAnalysis(ctx context.Context, tenantID string, req models.GapAnalysisRequest) (*models.GapAnalysisResult, error)
	ListAuditPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditPlan, error)
	CreateAuditPlan(ctx context.Context, tenantID string, req models.CreateAuditPlanRequest) (*models.AuditPlan, error)
	ExecuteAudit(ctx context.Context, tenantID, planID string) (*models.AuditExecution, error)
	GetAuditReport(ctx context.Context, tenantID, executionID string) (*models.AuditReport, error)
	GetAuditFindings(ctx context.Context, tenantID, reportID string) ([]models.AuditFinding, error)
	CloseFinding(ctx context.Context, tenantID, findingID string, reason string) error
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all security-compliance endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	compliance := rg.Group("/compliance")

	compliance.GET("/policies", auth.RequirePermission("security_compliance", "read"), h.ListPolicies)
	compliance.POST("/policies", auth.RequirePermission("security_compliance", "write"), h.DefinePolicy)
	compliance.POST("/evaluate", auth.RequirePermission("security_compliance", "write"), h.EvaluateCompliance)
	compliance.GET("/report/:policyId", auth.RequirePermission("security_compliance", "read"), h.GetComplianceReport)
	compliance.GET("/score", auth.RequirePermission("security_compliance", "read"), h.GetComplianceScore)
	compliance.POST("/remediate", auth.RequirePermission("security_compliance", "write"), h.AutoRemediateCompliance)
	compliance.GET("/frameworks", auth.RequirePermission("security_compliance", "read"), h.GetFrameworks)
	compliance.GET("/frameworks/:id", auth.RequirePermission("security_compliance", "read"), h.GetFramework)
	compliance.POST("/evidence", auth.RequirePermission("security_compliance", "write"), h.CollectEvidence)
	compliance.GET("/evidence/:policyId", auth.RequirePermission("security_compliance", "read"), h.GetEvidence)
	compliance.POST("/evidence/generate", auth.RequirePermission("security_compliance", "write"), h.GenerateEvidenceCollection)
	compliance.POST("/gap-analysis", auth.RequirePermission("security_compliance", "write"), h.PerformGapAnalysis)

	audit := rg.Group("/audit")
	audit.GET("/plans", auth.RequirePermission("security_compliance", "read"), h.ListAuditPlans)
	audit.POST("/plans", auth.RequirePermission("security_compliance", "write"), h.CreateAuditPlan)
	audit.POST("/:id/execute", auth.RequirePermission("security_compliance", "write"), h.ExecuteAudit)
	audit.GET("/:id/report", auth.RequirePermission("security_compliance", "read"), h.GetAuditReport)
	audit.GET("/:id/findings", auth.RequirePermission("security_compliance", "read"), h.GetAuditFindings)
	audit.POST("/findings/:id/close", auth.RequirePermission("security_compliance", "delete"), h.CloseFinding)
}

// --- Compliance Policies ---

func (h *Handler) ListPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPolicies")
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

func (h *Handler) DefinePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DefinePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.DefinePolicy(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, policy)
}

// --- Compliance Evaluation ---

func (h *Handler) EvaluateCompliance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EvaluateCompliance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateComplianceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluateCompliance(ctx, tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Compliance Report ---

func (h *Handler) GetComplianceReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetComplianceReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	report, err := h.svc.GetComplianceReport(ctx, tenantID, policyID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// --- Compliance Score ---

func (h *Handler) GetComplianceScore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetComplianceScore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	score, err := h.svc.GetComplianceScore(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, score)
}

// --- Remediation ---

func (h *Handler) AutoRemediateCompliance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AutoRemediateCompliance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.RemediationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.AutoRemediateCompliance(ctx, tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Audit Plans ---

func (h *Handler) ListAuditPlans(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAuditPlans")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	plans, err := h.svc.ListAuditPlans(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, plans)
}

func (h *Handler) CreateAuditPlan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAuditPlan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	plan, err := h.svc.CreateAuditPlan(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, plan)
}

// --- Audit Execution ---

func (h *Handler) ExecuteAudit(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteAudit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	planID := c.Param("id")
	execution, err := h.svc.ExecuteAudit(ctx, tenantID, planID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, execution)
}

// --- Audit Report ---

func (h *Handler) GetAuditReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	executionID := c.Param("id")
	report, err := h.svc.GetAuditReport(ctx, tenantID, executionID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// --- Audit Findings ---

func (h *Handler) GetAuditFindings(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditFindings")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	reportID := c.Param("id")
	findings, err := h.svc.GetAuditFindings(ctx, tenantID, reportID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, findings)
}

func (h *Handler) CloseFinding(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CloseFinding")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	findingID := c.Param("id")
	var req models.CloseFindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.CloseFinding(ctx, tenantID, findingID, req.Reason); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "finding closed"})
}

// --- Compliance Frameworks ---

func (h *Handler) GetFrameworks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetFrameworks")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	list, err := h.svc.GetFrameworks(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, list)
}

func (h *Handler) GetFramework(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetFramework")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	fw, err := h.svc.GetFramework(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, fw)
}

// --- Evidence Collection ---

func (h *Handler) CollectEvidence(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CollectEvidence")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CollectEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	collection, err := h.svc.CollectEvidence(ctx, tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, collection)
}

func (h *Handler) GetEvidence(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEvidence")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	evidence, err := h.svc.GetEvidence(ctx, tenantID, policyID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, evidence)
}

func (h *Handler) GenerateEvidenceCollection(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GenerateEvidenceCollection")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CollectEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	collection, err := h.svc.GenerateEvidenceCollection(ctx, tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, collection)
}

// --- Gap Analysis ---

func (h *Handler) PerformGapAnalysis(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PerformGapAnalysis")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.GapAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.PerformGapAnalysis(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
