package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/security-compliance/models"
)

// RepositoryInterface defines the repository methods used by the service.
// The service does not import the repository package, so this list is what keeps
// the two sides in step: cmd/server wires *repository.Repository here, and a
// method added to this interface that the repository lacks fails that compile.
type RepositoryInterface interface {
	CloseFinding(ctx context.Context, tenantID, id string, reason string) error
	CollectEvidence(ctx context.Context, evidence *models.Evidence) error
	CreateAuditExecution(ctx context.Context, exec *models.AuditExecution) error
	CreateAuditPlan(ctx context.Context, plan *models.AuditPlan) error
	CreateAuditReport(ctx context.Context, report *models.AuditReport) error
	CreateFinding(ctx context.Context, f *models.AuditFinding) error
	CreatePolicy(ctx context.Context, p *models.CompliancePolicy) error
	CreateReport(ctx context.Context, report *models.ComplianceReport) error
	GetAuditFindings(ctx context.Context, tenantID, reportID string) ([]models.AuditFinding, error)
	GetAuditPlan(ctx context.Context, tenantID, id string) (*models.AuditPlan, error)
	GetAuditReport(ctx context.Context, tenantID, executionID string) (*models.AuditReport, error)
	GetEvidence(ctx context.Context, tenantID, policyID string) ([]models.Evidence, error)
	GetFramework(ctx context.Context, tenantID, id string) (*models.ComplianceFramework, error)
	GetLatestScore(ctx context.Context, tenantID string) (*models.ComplianceScore, error)
	GetPolicy(ctx context.Context, tenantID, id string) (*models.CompliancePolicy, error)
	GetReportByPolicy(ctx context.Context, tenantID, policyID string) (*models.ComplianceReport, error)
	InsertEvaluation(ctx context.Context, tenantID string, result *models.ComplianceEvaluationResult) error
	InsertGapAnalysis(ctx context.Context, tenantID string, result *models.GapAnalysisResult) error
	LatestEvaluationByPolicy(ctx context.Context, tenantID, policyID string) (*models.ComplianceEvaluationResult, error)
	ListAuditPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditPlan, error)
	ListFindings(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditFinding, error)
	ListFrameworks(ctx context.Context, tenantID string) ([]models.ComplianceFramework, error)
	ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.CompliancePolicy, error)
	UpdateAuditExecution(ctx context.Context, tenantID, id string, status, result string, endedAt *time.Time) error
	UpsertScore(ctx context.Context, tenantID string, score *models.ComplianceScore) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Compliance Policies ---

func (s *Service) DefinePolicy(ctx context.Context, tenantID string, req models.CreatePolicyRequest) (*models.CompliancePolicy, error) {
	p := &models.CompliancePolicy{
		TenantID:  tenantID,
		Name:      req.Name,
		Framework: req.Framework,
		Rules:     req.Rules,
	}
	if err := s.repo.CreatePolicy(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.CompliancePolicy, error) {
	return s.repo.ListPolicies(ctx, tenantID, limit, offset)
}

func (s *Service) GetPolicy(ctx context.Context, tenantID, id string) (*models.CompliancePolicy, error) {
	return s.repo.GetPolicy(ctx, tenantID, id)
}

// --- Compliance Evaluation ---

func (s *Service) EvaluateCompliance(ctx context.Context, tenantID string, req models.EvaluateComplianceRequest) (*models.ComplianceEvaluationResult, error) {
	policy, err := s.GetPolicy(ctx, tenantID, req.PolicyID)
	if err != nil {
		if IsNotFound(err) {
			return nil, fmt.Errorf("policy %q: %w", req.PolicyID, ErrPolicyNotExists)
		}
		return nil, err
	}

	// Resolve the target list to evaluate.
	targets := req.Targets
	if len(targets) == 0 {
		targets = defaultTargets
	}

	// Resolve the framework: use the request framework, then the framework
	// encoded in the policy, then default to SOC2.
	fw := resolveFramework(strings.ToLower(firstNonEmpty(req.Framework, policy.Framework)))

	// Evaluate every target against every control in the framework.
	var failures, warnings []string
	var totalScore float64
	var evaluatedRules int

	for _, target := range targets {
		score, targetFailures, targetWarnings := evaluateTargetAgainstRules(target, fw.controls)
		failures = append(failures, targetFailures...)
		warnings = append(warnings, targetWarnings...)

		// Count how many rules this target actually hit so we can average the
		// scores rather than dividing by the full rule set (which would
		// double-count cross-cutting rules).
		ruleCount := 0
		for _, r := range fw.controls {
			if isRuleApplicableToTarget(r, target) {
				ruleCount++
			}
		}
		evaluatedRules += ruleCount
		if ruleCount > 0 {
			totalScore += score
		}
	}

	// Derive overall score and status.
	var score float64
	var status string
	if evaluatedRules > 0 {
		score = totalScore / float64(evaluatedRules)
	}
	switch {
	case len(failures) == 0 && score >= 80:
		status = "compliant"
	case len(failures) > 0:
		status = "non_compliant"
	default:
		status = "partial"
	}

	result := &models.ComplianceEvaluationResult{
		PolicyID:    req.PolicyID,
		Status:      status,
		Score:       score,
		Failures:    failures,
		Warnings:    warnings,
		EvaluatedAt: time.Now().UTC(),
	}

	if err := s.repo.InsertEvaluation(ctx, tenantID, result); err != nil {
		return nil, err
	}

	// Persist the report and the tenant score as well. Without them
	// GET /compliance/report/:policyId could never stop returning 404 and
	// GET /compliance/score always answered with an invented "stable" tenant.
	if err := s.persistReportAndScore(ctx, tenantID, policy, result); err != nil {
		return nil, err
	}
	return result, nil
}

// persistReportAndScore writes the two aggregates an evaluation feeds: one
// compliance report per policy and the tenant's rolled-up score with a trend
// relative to the previous overall score.
func (s *Service) persistReportAndScore(ctx context.Context, tenantID string, policy *models.CompliancePolicy, result *models.ComplianceEvaluationResult) error {
	report := &models.ComplianceReport{
		TenantID:    tenantID,
		PolicyID:    policy.ID,
		Name:        policy.Name,
		Description: fmt.Sprintf("Evaluation of %s against %s", policy.Name, policy.Framework),
		Framework:   policy.Framework,
		TriggeredBy: "evaluate",
		Status:      result.Status,
		Score:       result.Score,
		Failures:    joinEvaluation(result.Failures, result.Warnings),
	}
	if err := s.repo.CreateReport(ctx, report); err != nil {
		return err
	}

	prev, err := s.repo.GetLatestScore(ctx, tenantID)
	if err != nil && !IsNotFound(err) {
		return err
	}
	trend := "new"
	if prev != nil {
		switch {
		case result.Score > prev.OverallScore:
			trend = "improving"
		case result.Score < prev.OverallScore:
			trend = "declining"
		default:
			trend = "stable"
		}
	}
	return s.repo.UpsertScore(ctx, tenantID, &models.ComplianceScore{
		OverallScore: result.Score,
		CategoryScores: map[string]float64{
			result.Status: result.Score,
		},
		Trend:       trend,
		LastUpdated: result.EvaluatedAt,
	})
}

// firstNonEmpty returns the first argument that is not the empty string.
func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// joinEvaluation renders the report's failures column: hard failures first, then
// the partial-implementation warnings that an evaluation always produces.
func joinEvaluation(failures, warnings []string) string {
	if len(failures) == 0 && len(warnings) == 0 {
		return ""
	}
	b, err := json.Marshal(append(append([]string{}, failures...), warnings...))
	if err != nil {
		return ""
	}
	return string(b)
}

// --- Compliance Report ---

func (s *Service) GetComplianceReport(ctx context.Context, tenantID, policyID string) (*models.ComplianceReport, error) {
	report, err := s.repo.GetReportByPolicy(ctx, tenantID, policyID)
	if err != nil {
		if IsNotFound(err) {
			// Create a default report if none exists
			return nil, fmt.Errorf("report for policy %q not found: %w", policyID, sentinel.NotFound)
		}
		return nil, err
	}
	return report, nil
}

// --- Compliance Score ---

func (s *Service) GetComplianceScore(ctx context.Context, tenantID string) (*models.ComplianceScore, error) {
	score, err := s.repo.GetLatestScore(ctx, tenantID)
	if err != nil && !IsNotFound(err) {
		return nil, err
	}
	if score == nil {
		// "new", not "stable": the tenant has no recorded evaluation yet, so any
		// trend would be an invention. The frontend renders whatever it receives
		// and a caller comparing two tenants should be able to tell the
		// never-measured one apart. The nil check covers both the not-found error
		// and a repository that answers (nil, nil) — which is the default the
		// generated mock_repository.go returns, and a nil pointer here used to
		// crash the route.
		return &models.ComplianceScore{
			OverallScore:   0,
			CategoryScores: make(map[string]float64),
			Trend:          "new",
			LastUpdated:    time.Now().UTC(),
		}, nil
	}
	if score.CategoryScores == nil {
		score.CategoryScores = make(map[string]float64)
	}
	return score, nil
}

// --- Remediation ---

func (s *Service) AutoRemediateCompliance(ctx context.Context, tenantID string, req models.RemediationRequest) (*models.RemediationResult, error) {
	if _, err := s.GetPolicy(ctx, tenantID, req.PolicyID); err != nil {
		if IsNotFound(err) {
			return nil, fmt.Errorf("policy %q: %w", req.PolicyID, ErrPolicyNotExists)
		}
		return nil, err
	}

	if len(req.Actions) == 0 {
		// No explicit actions requested — evaluate the policy first to
		// determine which remediation actions to apply.
		evaluateReq := models.EvaluateComplianceRequest{PolicyID: req.PolicyID}
		evalResult, err := s.EvaluateCompliance(ctx, tenantID, evaluateReq)
		if err != nil {
			return nil, fmt.Errorf("auto-evaluation failed: %w", err)
		}
		req.Actions = evalResult.Failures
	}

	outcomes := make([]actionOutcome, 0, len(req.Actions))
	for _, action := range req.Actions {
		outcome := classifyRemediationAction(action)
		outcomes = append(outcomes, outcome)
	}

	// Collapse the outcomes into the response shape.
	rem := &models.RemediationResult{
		Applied:  make([]string, 0),
		Skipped:  make([]string, 0),
		Failures: make([]string, 0),
	}
	for _, o := range outcomes {
		switch o.status {
		case "applied":
			rem.Applied = append(rem.Applied, fmt.Sprintf("%s (%s)", o.action, o.reason))
		case "skipped":
			rem.Skipped = append(rem.Skipped, fmt.Sprintf("%s (%s)", o.action, o.reason))
		default:
			rem.Failures = append(rem.Failures, fmt.Sprintf("%s (%s)", o.action, o.reason))
		}
	}

	return rem, nil
}

// classifyRemediationAction categorises one remediation action attempt.
func classifyRemediationAction(action string) actionOutcome {
	// Try to match the action string to a known control ID in the registry.
	for ctrlID, suggestion := range remediationRegistry {
		if action == ctrlID || action == ctrlID+".1" {
			return actionOutcome{
				action: action,
				status: "applied",
				reason: suggestion,
			}
		}
	}
	// If the action is a free-text description rather than a control ID,
	// record it as skipped so the operator can triage manually.
	return actionOutcome{
		action: action,
		status: "skipped",
		reason: "no matching auto-remediation handler; manual review required",
	}
}

// --- Audit Plans ---

func (s *Service) CreateAuditPlan(ctx context.Context, tenantID string, req models.CreateAuditPlanRequest) (*models.AuditPlan, error) {
	plan := &models.AuditPlan{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Schedule:    req.Schedule,
	}
	if err := s.repo.CreateAuditPlan(ctx, plan); err != nil {
		return nil, err
	}
	return plan, nil
}

func (s *Service) ListAuditPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditPlan, error) {
	return s.repo.ListAuditPlans(ctx, tenantID, limit, offset)
}

// --- Audit Execution ---

// ExecuteAudit runs the plan: one evaluation per policy in the tenant, a
// findings row per in-scope control, and an execution row that reports what
// actually happened.
//
// The previous version called ListAuditPlans and threw the result away, so a
// caller-supplied plan id was never validated and any id produced a
// "completed" execution with a zero-finding report. It also never evaluated
// anything, which is why the audit endpoints existed but no audit ever produced
// data.
func (s *Service) ExecuteAudit(ctx context.Context, tenantID, planID string) (*models.AuditExecution, error) {
	plan, err := s.repo.GetAuditPlan(ctx, tenantID, planID)
	if err != nil {
		if IsNotFound(err) {
			return nil, fmt.Errorf("plan %q: %w", planID, ErrPlanNotExists)
		}
		return nil, err
	}

	exec := &models.AuditExecution{
		PlanID:   plan.ID,
		TenantID: tenantID,
		Status:   "running",
		Result:   "{}",
	}
	if err := s.repo.CreateAuditExecution(ctx, exec); err != nil {
		return nil, err
	}
	// markExec writes the terminal state onto the execution row. Without it an
	// error halfway through the flow leaves a "running" row behind, which reads
	// as an audit that is still in progress rather than one that died.
	markExec := func(status string) {
		now := time.Now().UTC()
		summary, _ := json.Marshal(map[string]string{"status": status, "plan": plan.Name})
		_ = s.repo.UpdateAuditExecution(ctx, tenantID, exec.ID, status, string(summary), &now)
	}

	policies, err := s.repo.ListPolicies(ctx, tenantID, 1000, 0)
	if err != nil {
		markExec("failed")
		return nil, err
	}

	var (
		allFindings  []models.AuditFinding
		evalWarnings []string
	)
	for _, p := range policies {
		res, err := s.EvaluateCompliance(ctx, tenantID, models.EvaluateComplianceRequest{
			PolicyID:  p.ID,
			Framework: p.Framework,
		})
		if err != nil {
			markExec("failed")
			return nil, fmt.Errorf("evaluate policy %q: %w", p.ID, err)
		}
		if len(res.Warnings) > 0 {
			evalWarnings = append(evalWarnings, fmt.Sprintf("%s: %d open controls", p.Name, len(res.Warnings)))
		}
		findings := auditFindings(resolveFramework(p.Framework), defaultTargets)
		for i := range findings {
			findings[i].TenantID = tenantID
		}
		allFindings = append(allFindings, findings...)
	}

	summary, err := json.Marshal(map[string]any{
		"plan":      plan.Name,
		"policies":  len(policies),
		"findings":  len(allFindings),
		"warnings":  len(evalWarnings),
		"completed": true,
	})
	if err != nil {
		markExec("failed")
		return nil, err
	}

	// The report id is generated up front so findings can reference it, but the
	// row is only persisted after every finding write succeeds: a finding that
	// fails mid-way used to leave an orphan audit_reports row with no findings
	// behind it.
	report := &models.AuditReport{
		ID:            uuid.New().String(),
		ExecutionID:   exec.ID,
		TenantID:      tenantID,
		Summary:       string(summary),
		FindingsCount: len(allFindings),
	}
	for i := range allFindings {
		f := allFindings[i]
		f.ReportID = report.ID
		if err := s.repo.CreateFinding(ctx, &f); err != nil {
			markExec("failed")
			return nil, fmt.Errorf("create finding %q: %w", f.Title, err)
		}
	}
	if err := s.repo.CreateAuditReport(ctx, report); err != nil {
		markExec("failed")
		return nil, err
	}

	now := time.Now().UTC()
	if err := s.repo.UpdateAuditExecution(ctx, tenantID, exec.ID, "completed", string(summary), &now); err != nil {
		return nil, err
	}
	exec.Status = "completed"
	exec.Result = string(summary)
	exec.EndedAt = &now
	return exec, nil
}

// auditFindings derives one finding per framework control that applies to at
// least one target. evaluateTargetAgainstRules marks every applicable control
// "partial" with an empty failures slice, so ComplianceEvaluationResult.Failures
// is always nil and cannot be the finding source — the control catalog is.
func auditFindings(fw frameworkDefinition, targets []string) []models.AuditFinding {
	var out []models.AuditFinding
	for _, r := range fw.controls {
		var matched []string
		for _, target := range targets {
			if isRuleApplicableToTarget(r, target) {
				matched = append(matched, target)
			}
		}
		if len(matched) == 0 {
			continue
		}
		severity := "low"
		if r.verdict == "not_implemented" {
			severity = "high"
		}
		desc := ""
		if len(r.warnings) > 0 {
			desc = r.warnings[0]
		}
		out = append(out, models.AuditFinding{
			Target:      strings.Join(matched, ","),
			Severity:    severity,
			Title:       r.controlID + " " + r.controlName,
			Description: desc,
			Status:      "open",
		})
	}
	return out
}

// resolveFramework maps a caller-supplied name onto its built-in control
// catalog. The empty name and unknown names both resolve to SOC2, so an
// evaluation of a policy that never named a framework scores against real
// controls instead of an empty set.
func resolveFramework(name string) frameworkDefinition {
	if name == "" {
		name = "soc2"
	}
	if fw, ok := builtInFrameworks[strings.ToLower(name)]; ok {
		return fw
	}
	return builtInFrameworks["soc2"]
}

// --- Audit Report ---

func (s *Service) GetAuditReport(ctx context.Context, tenantID, executionID string) (*models.AuditReport, error) {
	report, err := s.repo.GetAuditReport(ctx, tenantID, executionID)
	if err != nil {
		if IsNotFound(err) {
			return nil, fmt.Errorf("audit report for execution %q not found: %w", executionID, sentinel.NotFound)
		}
		return nil, err
	}
	return report, nil
}

// --- Audit Findings ---

func (s *Service) GetAuditFindings(ctx context.Context, tenantID, reportID string) ([]models.AuditFinding, error) {
	return s.repo.GetAuditFindings(ctx, tenantID, reportID)
}

// ListFindings returns the tenant's findings across every report. It is the
// backend for the compliance scan view; before it existed that view answered
// with eight hard-coded demo findings on every request.
func (s *Service) ListFindings(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditFinding, error) {
	return s.repo.ListFindings(ctx, tenantID, limit, offset)
}

// GetLastEvaluation returns the most recent evaluation of one policy, or
// (nil, nil) when the policy has never been evaluated. The handler needs the
// empty case to be distinguishable from an error, because a tenant with one
// unmeasured policy should see a baseline row with no last scan rather than a
// 500.
func (s *Service) GetLastEvaluation(ctx context.Context, tenantID, policyID string) (*models.ComplianceEvaluationResult, error) {
	result, err := s.repo.LatestEvaluationByPolicy(ctx, tenantID, policyID)
	if err != nil {
		if IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return result, nil
}

// FrameworkControlIDs lists the control ids a framework ships with, so a policy
// created from that framework carries a rule set whose length matches what the
// UI will show as its rule count.
func FrameworkControlIDs(framework string) []string {
	fw := resolveFramework(framework)
	ids := make([]string, 0, len(fw.controls))
	for _, c := range fw.controls {
		ids = append(ids, c.controlID)
	}
	return ids
}

func (s *Service) CloseFinding(ctx context.Context, tenantID, findingID string, reason string) error {
	if err := s.repo.CloseFinding(ctx, tenantID, findingID, reason); err != nil {
		return err
	}
	return nil
}

// --- Compliance Frameworks ---

func (s *Service) GetFrameworks(ctx context.Context, tenantID string) (*models.FrameworkList, error) {
	frameworks, err := s.repo.ListFrameworks(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.FrameworkList{Frameworks: frameworks}, nil
}

func (s *Service) GetFramework(ctx context.Context, tenantID, id string) (*models.ComplianceFramework, error) {
	f, err := s.repo.GetFramework(ctx, tenantID, id)
	if err != nil {
		if IsNotFound(err) {
			return nil, fmt.Errorf("framework %q not found: %w", id, sentinel.NotFound)
		}
		return nil, err
	}
	return f, nil
}

// --- Evidence Collection ---

func (s *Service) CollectEvidence(ctx context.Context, tenantID string, req models.CollectEvidenceRequest) (*models.EvidenceCollection, error) {
	if _, err := s.GetPolicy(ctx, tenantID, req.PolicyID); err != nil {
		if IsNotFound(err) {
			return nil, fmt.Errorf("policy %q: %w", req.PolicyID, ErrPolicyNotExists)
		}
		return nil, err
	}
	sources := req.Sources
	if len(sources) == 0 {
		sources = []string{"default"}
	}
	evidence := make([]models.Evidence, 0, len(sources))
	for _, src := range sources {
		e := &models.Evidence{
			TenantID: tenantID,
			PolicyID: req.PolicyID,
			Source:   src,
		}
		if err := s.repo.CollectEvidence(ctx, e); err != nil {
			continue
		}
		evidence = append(evidence, *e)
	}
	return &models.EvidenceCollection{Evidence: evidence, Count: len(evidence)}, nil
}

func (s *Service) GetEvidence(ctx context.Context, tenantID, policyID string) ([]models.Evidence, error) {
	return s.repo.GetEvidence(ctx, tenantID, policyID)
}

// --- Generate Evidence Collection ---

func (s *Service) GenerateEvidenceCollection(ctx context.Context, tenantID string, req models.CollectEvidenceRequest) (*models.EvidenceCollection, error) {
	return s.CollectEvidence(ctx, tenantID, req)
}

// --- Gap Analysis ---

func (s *Service) PerformGapAnalysis(ctx context.Context, tenantID string, req models.GapAnalysisRequest) (*models.GapAnalysisResult, error) {
	// Both are caller errors, so both are sentinel.BadRequest. As plain errors
	// they surfaced as 500s, which told the operator the platform was broken
	// when the request was.
	if req.Framework == "" {
		return nil, fmt.Errorf("gap analysis: framework is required: %w", sentinel.BadRequest)
	}
	name := strings.ToLower(req.Framework)
	if _, ok := builtInFrameworks[name]; !ok {
		return nil, fmt.Errorf("unknown framework %q (supported: %s): %w", req.Framework, strings.Join(builtInFrameworkNames(), ", "), sentinel.BadRequest)
	}
	fw := resolveFramework(name)

	targets := req.Targets
	if len(targets) == 0 {
		targets = defaultTargets
	}

	// For each control in the framework, determine compliance status by
	// checking whether any of the requested targets map to it.
	var (
		implemented    int
		partial        int
		notImplemented int
	)
	gaps := make([]models.GapAnalysisItem, 0, len(fw.controls))

	for _, ctrl := range fw.controls {
		appliesToAnyTarget := false
		var recommendation string
		verdict := ctrl.verdict // baseline verdict from the framework definition

		for _, target := range targets {
			if isRuleApplicableToTarget(ctrl, target) {
				appliesToAnyTarget = true
				break
			}
		}

		// If none of the targets map to this control, treat it as
		// not_implemented and suggest scoping.
		if !appliesToAnyTarget {
			verdict = "not_implemented"
			recommendation = fmt.Sprintf("scope %q control to an appropriate target subsystem", ctrl.controlName)
		} else if verdict == "not_implemented" {
			recommendation = fmt.Sprintf("implement %s control for the selected targets", ctrl.controlName)
		} else if verdict == "partial" {
			// Partial means the control is defined but evidence is missing.
			recommendation = fmt.Sprintf("collect evidence for %s control", ctrl.controlName)
		} else {
			recommendation = "control satisfied"
		}

		switch verdict {
		case "implemented":
			implemented++
		case "partial":
			partial++
		case "not_implemented":
			notImplemented++
		}

		gaps = append(gaps, models.GapAnalysisItem{
			ControlID:      ctrl.controlID,
			ControlName:    ctrl.controlName,
			Compliance:     verdict,
			Recommendation: recommendation,
		})
	}

	result := &models.GapAnalysisResult{
		Framework:      fw.name,
		TotalControls:  len(fw.controls),
		Implemented:    implemented,
		Partial:        partial,
		NotImplemented: notImplemented,
		Gaps:           gaps,
	}

	if err := s.repo.InsertGapAnalysis(ctx, tenantID, result); err != nil {
		return nil, err
	}
	return result, nil
}

// --- Errors ---

// Both wrap sentinel.NotFound so a caller can match the specific sentinel
// (errors.Is(err, ErrPlanNotExists)) or the generic one (IsNotFound(err)) —
// as plain errors.New they matched neither and every 404 branch downstream was
// dead.
var (
	ErrPolicyNotExists = fmt.Errorf("policy does not exist: %w", sentinel.NotFound)
	ErrPlanNotExists   = fmt.Errorf("audit plan does not exist: %w", sentinel.NotFound)
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
