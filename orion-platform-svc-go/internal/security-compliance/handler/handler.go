package handler

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/security-compliance/models"
	"orion/platform-svc-go/internal/security-compliance/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// tenantKey is the exact context key that orion-go-common/pkg/auth's JWT
// middleware writes (c.Set("tenant_id", …)). Nothing in the platform copies it
// into camelCase, so reading "tenantId" would have failed silently and every
// query here is "WHERE tenant_id = $1" — a missing key searched the empty
// string bucket instead of answering 401.
const tenantKey = "tenant_id"

// defaultListLimit is shared by the policy, plan and finding list endpoints.
const defaultListLimit = 50

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
	ListFindings(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditFinding, error)
	GetLastEvaluation(ctx context.Context, tenantID, policyID string) (*models.ComplianceEvaluationResult, error)
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

	// --- Frontend compatibility bridge (ComplianceScan page) ---
	// The frontend calls /compliance/baselines and /compliance/findings; these
	// are compatibility routes over the policy and audit-finding model with
	// field-name translation. They read and write tenant data, so they carry the
	// same permission guard as the routes they alias — before this they were the
	// only four endpoints in the module without one.
	compliance.GET("/baselines", auth.RequirePermission("security_compliance", "read"), h.ListBaselines)
	compliance.POST("/baselines", auth.RequirePermission("security_compliance", "write"), h.CreateBaseline)
	compliance.GET("/findings", auth.RequirePermission("security_compliance", "read"), h.ListFindings)
	compliance.POST("/baselines/:id/scan", auth.RequirePermission("security_compliance", "write"), h.ScanBaseline)

	audit := rg.Group("/audit")
	audit.GET("/plans", auth.RequirePermission("security_compliance", "read"), h.ListAuditPlans)
	audit.POST("/plans", auth.RequirePermission("security_compliance", "write"), h.CreateAuditPlan)
	audit.POST("/:id/execute", auth.RequirePermission("security_compliance", "write"), h.ExecuteAudit)
	audit.GET("/:id/report", auth.RequirePermission("security_compliance", "read"), h.GetAuditReport)
	audit.GET("/:id/findings", auth.RequirePermission("security_compliance", "read"), h.GetAuditFindings)
	audit.POST("/findings/:id/close", auth.RequirePermission("security_compliance", "delete"), h.CloseFinding)
}

// requireTenant returns the caller's tenant id or fails closed. Every query in
// this module is tenant-scoped, so an empty tenant is a predicate that matches
// nothing and a wrong answer costs more than the one round trip a 401 costs.
func (h *Handler) requireTenant(c *gin.Context) (string, bool) {
	tenantID := c.GetString(tenantKey)
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return "", false
	}
	return tenantID, true
}

// listParams resolves limit and offset. offset is primary; page is accepted as
// a 1-based alias only when offset is absent.
func listParams(c *gin.Context) (limit, offset int) {
	limit = defaultListLimit
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	offset = 0
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
		return limit, offset
	}
	if v := c.Query("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 1 {
			offset = (n - 1) * limit
		}
	}
	return limit, offset
}

// fail maps a service error to its status code.
func fail(c *gin.Context, err error, notFound string) {
	if service.IsNotFound(err) {
		middleware.RespondNotFound(c, notFound)
		return
	}
	if errors.Is(err, sentinel.BadRequest) {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondInternalError(c, err.Error())
}

// --- Compliance Policies ---

func (h *Handler) ListPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPolicies")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	limit, offset := listParams(c)
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
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
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
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	var req models.EvaluateComplianceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluateCompliance(ctx, tenantID, req)
	if err != nil {
		fail(c, err, "policy not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Compliance Report ---

func (h *Handler) GetComplianceReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetComplianceReport")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	report, err := h.svc.GetComplianceReport(ctx, tenantID, c.Param("policyId"))
	if err != nil {
		fail(c, err, "report not found")
		return
	}
	middleware.RespondSuccess(c, report)
}

// --- Compliance Score ---

func (h *Handler) GetComplianceScore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetComplianceScore")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
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
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	var req models.RemediationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.AutoRemediateCompliance(ctx, tenantID, req)
	if err != nil {
		fail(c, err, "policy not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Audit Plans ---

func (h *Handler) ListAuditPlans(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAuditPlans")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	limit, offset := listParams(c)
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
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
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
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	execution, err := h.svc.ExecuteAudit(ctx, tenantID, c.Param("id"))
	if err != nil {
		fail(c, err, "audit plan not found")
		return
	}
	middleware.RespondSuccess(c, execution)
}

// --- Audit Report ---

func (h *Handler) GetAuditReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditReport")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	report, err := h.svc.GetAuditReport(ctx, tenantID, c.Param("id"))
	if err != nil {
		fail(c, err, "audit report not found")
		return
	}
	middleware.RespondSuccess(c, report)
}

// --- Audit Findings ---

func (h *Handler) GetAuditFindings(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditFindings")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	findings, err := h.svc.GetAuditFindings(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, findings)
}

func (h *Handler) CloseFinding(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CloseFinding")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	var req models.CloseFindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.CloseFinding(ctx, tenantID, c.Param("id"), req.Reason); err != nil {
		fail(c, err, "finding not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "finding closed"})
}

// --- Compliance Frameworks ---

func (h *Handler) GetFrameworks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetFrameworks")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
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
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	fw, err := h.svc.GetFramework(ctx, tenantID, c.Param("id"))
	if err != nil {
		fail(c, err, "framework not found")
		return
	}
	middleware.RespondSuccess(c, fw)
}

// --- Evidence Collection ---

func (h *Handler) CollectEvidence(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CollectEvidence")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	var req models.CollectEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	collection, err := h.svc.CollectEvidence(ctx, tenantID, req)
	if err != nil {
		fail(c, err, "policy not found")
		return
	}
	middleware.RespondSuccess(c, collection)
}

func (h *Handler) GetEvidence(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEvidence")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	evidence, err := h.svc.GetEvidence(ctx, tenantID, c.Param("policyId"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, evidence)
}

func (h *Handler) GenerateEvidenceCollection(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GenerateEvidenceCollection")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	var req models.CollectEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	collection, err := h.svc.GenerateEvidenceCollection(ctx, tenantID, req)
	if err != nil {
		fail(c, err, "policy not found")
		return
	}
	middleware.RespondSuccess(c, collection)
}

// --- Gap Analysis ---

func (h *Handler) PerformGapAnalysis(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PerformGapAnalysis")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	var req models.GapAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.PerformGapAnalysis(ctx, tenantID, req)
	if err != nil {
		fail(c, err, "framework not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

// ================================================================
// Frontend compatibility bridge — ComplianceScan page
// Maps /compliance/baselines ↔ compliance policies
// Maps /compliance/findings ↔ audit_findings
// ================================================================

// Baseline is the frontend-facing compliance baseline shape.
type Baseline struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Framework string  `json:"framework"`
	Rules     int     `json:"rules"`
	LastScan  string  `json:"lastScan,omitempty"`
	PassRate  float64 `json:"passRate"`
}

// ListBaselines returns the tenant's compliance policies as baselines. Rules is
// the length of the policy's rule set and passRate / lastScan come from its most
// recent evaluation, so a tenant with no data gets an empty list instead of the
// six hard-coded demo baselines the previous version answered with on every
// error and every empty result.
func (h *Handler) ListBaselines(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBaselines")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	limit, offset := listParams(c)
	policies, err := h.svc.ListPolicies(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	baselines := make([]Baseline, 0, len(policies))
	for _, p := range policies {
		b := Baseline{ID: p.ID, Name: p.Name, Framework: p.Framework, Rules: countRules(p.Rules)}
		eval, err := h.svc.GetLastEvaluation(ctx, tenantID, p.ID)
		if err != nil {
			middleware.RespondInternalError(c, err.Error())
			return
		}
		// eval is nil when the policy was never measured. Its passRate stays 0
		// and lastScan stays absent rather than being filled with a guess.
		if eval != nil {
			b.PassRate = eval.Score
			b.LastScan = eval.EvaluatedAt.UTC().Format(time.RFC3339)
		}
		baselines = append(baselines, b)
	}
	middleware.RespondSuccess(c, baselines)
}

// countRules counts the entries of a policy's rules column. The column is free
// form JSON — an array of ids, an array of rule objects, or an object with a
// controls array — and the UI sums this number across baselines to show a rule
// total. The old handler answered 50 for every policy whether or not it had any
// rules, so the total was always invented.
func countRules(rules string) int {
	if strings.TrimSpace(rules) == "" {
		return 0
	}
	var asList []any
	if err := json.Unmarshal([]byte(rules), &asList); err == nil {
		return len(asList)
	}
	var asObject map[string]any
	if err := json.Unmarshal([]byte(rules), &asObject); err == nil {
		if v, ok := asObject["controls"]; ok {
			if ctrl, ok := v.([]any); ok {
				return len(ctrl)
			}
		}
		return len(asObject)
	}
	return 0
}

// CreateBaselineRequest is the frontend-facing baseline creation request.
type CreateBaselineRequest struct {
	Name        string `json:"name" binding:"required"`
	Framework   string `json:"framework" binding:"required"`
	Description string `json:"description,omitempty"`
}

// CreateBaseline stores the tenant's policy and reports its real control count.
// The previous version returned a fabricated id and a hard-coded 50 rules
// without persisting anything, so the baseline vanished on the next page load
// and its rule count was never the number of controls it claimed to carry.
func (h *Handler) CreateBaseline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateBaseline")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	var req CreateBaselineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	controlIDs := service.FrameworkControlIDs(req.Framework)
	rulesJSON, err := json.Marshal(controlIDs)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	policy, err := h.svc.DefinePolicy(ctx, tenantID, models.CreatePolicyRequest{
		Name:      req.Name,
		Framework: req.Framework,
		Rules:     string(rulesJSON),
	})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, Baseline{
		ID:        policy.ID,
		Name:      policy.Name,
		Framework: policy.Framework,
		Rules:     len(controlIDs),
	})
}

// ScanBaseline evaluates the policy behind a baseline. It reports the scan
// outcome separately from the compliance verdict, and an evaluation failure
// returns a 4xx/5xx instead of a body that claims status "completed" while
// carrying the error text in its failures array.
func (h *Handler) ScanBaseline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ScanBaseline")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	policyID := strings.TrimSpace(c.Param("id"))
	if policyID == "" {
		middleware.RespondBadRequest(c, "baseline id is required")
		return
	}
	result, err := h.svc.EvaluateCompliance(ctx, tenantID, models.EvaluateComplianceRequest{PolicyID: policyID})
	if err != nil {
		fail(c, err, "baseline not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"status":      "completed",
		"baselineId":  policyID,
		"verdict":     result.Status,
		"score":       result.Score,
		"failures":    result.Failures,
		"warnings":    result.Warnings,
		"evaluatedAt": result.EvaluatedAt.UTC().Format(time.RFC3339),
	})
}

// --- Compliance Findings (bridge) ---

// Finding is the frontend-facing compliance finding shape.
type Finding struct {
	ID          string `json:"id"`
	Rule        string `json:"rule"`
	Target      string `json:"target"`
	Level       string `json:"level"`
	Status      string `json:"status"`
	Description string `json:"description"`
	DetectedAt  string `json:"detectedAt"`
}

// ListFindings returns the tenant's audit findings. The previous version ignored
// the request entirely and answered with eight demo findings, so every tenant —
// and a request with no tenant at all — saw the same fictional data.
func (h *Handler) ListFindings(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListFindings")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	limit, offset := listParams(c)
	findings, err := h.svc.ListFindings(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	out := make([]Finding, 0, len(findings))
	for _, f := range findings {
		out = append(out, Finding{
			ID:          f.ID,
			Rule:        f.Title,
			Target:      f.Target,
			Level:       findingLevel(f.Severity),
			Status:      findingStatus(f.Status),
			Description: f.Description,
			DetectedAt:  f.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	middleware.RespondSuccess(c, out)
}

// findingLevel maps a finding severity onto the frontend's level vocabulary.
// The unknown value falls back to "info", which is the only level the frontend
// renders without a severity colour, so an unexpected severity stays visible.
func findingLevel(severity string) string {
	switch strings.ToLower(severity) {
	case "critical", "high", "medium", "low":
		return strings.ToLower(severity)
	default:
		return "info"
	}
}

// findingStatus maps the audit lifecycle onto the frontend's scan lifecycle:
// open work is pending, in-flight work is running, and closed work is done.
func findingStatus(status string) string {
	switch strings.ToLower(status) {
	case "open":
		return "pending"
	case "in_progress":
		return "running"
	case "closed":
		return "completed"
	default:
		return "pending"
	}
}
