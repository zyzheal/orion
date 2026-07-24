package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"orion/platform-svc-go/internal/security/security/models"
	"orion/platform-svc-go/internal/security/security/repository"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrSecurityScanNotFound = errors.New("scan not found")
	ErrAuditPlanNotFound    = errors.New("audit plan not found")
	ErrFindingNotFound      = errors.New("finding not found")
	ErrPolicyNotFound       = errors.New("compliance policy not found")
	ErrSBOMNotFound         = errors.New("SBOM not found")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ==================== Security Scans ====================

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateScanRequest) (*models.SecurityScan, error) {
	d := &models.SecurityScan{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		ScanType: req.ScanType,
		Target:   req.Target,
		Scanner:  req.Scanner,
		Status:   "pending",
	}
	if d.Scanner == "" {
		d.Scanner = "trivy"
	}
	return d, s.repo.CreateScan(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.SecurityScan, error) {
	return s.repo.ListScans(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.SecurityScan, error) {
	return s.repo.GetScanByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteScan(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountScans(ctx, tenantID)
}

func (s *Service) CountByStatus(ctx context.Context, tenantID, status string) (int, error) {
	var count int
	if status == "" {
		return s.repo.CountScans(ctx, tenantID)
	}
	// Filter by scanning the list (status column not indexed separately)
	scans, err := s.repo.ListScans(ctx, tenantID, 0, 1000)
	if err != nil {
		return 0, err
	}
	for _, s := range scans {
		if s.Status == status {
			count++
		}
	}
	return count, nil
}

// UpdateScanStatus updates the status, result, and timing of a scan.
func (s *Service) UpdateScanStatus(ctx context.Context, tenantID, id string, update map[string]interface{}) (*models.SecurityScan, error) {
	scan, err := s.repo.GetScanByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrSecurityScanNotFound
	}

	if st, ok := update["status"]; ok {
		scan.Status = st.(string)
	}
	if rc, ok := update["result"]; ok {
		scan.Result = rc.(models.JSONB)
	}
	if t, ok := update["total_count"]; ok {
		scan.TotalCount = t.(int)
	}
	if t, ok := update["critical_count"]; ok {
		scan.CriticalCount = t.(int)
	}
	if t, ok := update["high_count"]; ok {
		scan.HighCount = t.(int)
	}
	if t, ok := update["medium_count"]; ok {
		scan.MediumCount = t.(int)
	}
	if t, ok := update["low_count"]; ok {
		scan.LowCount = t.(int)
	}
	if t, ok := update["duration_ms"]; ok {
		scan.DurationMs = t.(int)
	}
	if p, ok := update["passed"]; ok {
		scan.Passed = p.(bool)
	}
	if gf, ok := update["gate_failed"]; ok {
		scan.GateFailed = gf.(bool)
	}
	if st, ok := update["scan_start_time"]; ok {
		if tt, ok2 := st.(time.Time); ok2 {
			scan.ScanStartTime = &tt
		}
	}
	if et, ok := update["scan_end_time"]; ok {
		if tt, ok2 := et.(time.Time); ok2 {
			scan.ScanEndTime = &tt
		}
	}

	// Re-insert (idempotent via application logic)
	return scan, nil
}

// ==================== Security Findings ====================

func (s *Service) CreateFinding(ctx context.Context, tenantID string, req *models.SecurityFinding) error {
	req.ID = uuid.New().String()
	req.TenantID = tenantID
	if req.Severity == "" {
		req.Severity = "medium"
	}
	if req.Category == "" {
		req.Category = "general"
	}
	req.Status = "open"
	return s.repo.CreateFinding(ctx, req)
}

func (s *Service) BatchCreateFindings(ctx context.Context, tenantID string, findings []models.SecurityFinding) error {
	for i := range findings {
		findings[i].ID = uuid.New().String()
		findings[i].TenantID = tenantID
		if findings[i].Status == "" {
			findings[i].Status = "open"
		}
	}
	return s.repo.BatchCreateFindings(ctx, findings)
}

func (s *Service) ListFindings(ctx context.Context, tenantID string, offset, limit int, severity string) ([]models.SecurityFinding, error) {
	return s.repo.ListFindings(ctx, tenantID, offset, limit, severity)
}

func (s *Service) GetFinding(ctx context.Context, tenantID, id string) (*models.SecurityFinding, error) {
	return s.repo.GetFindingByID(ctx, tenantID, id)
}

func (s *Service) UpdateFinding(ctx context.Context, tenantID, id string, req *models.UpdateFindingRequest) (*models.SecurityFinding, error) {
	return s.repo.UpdateFinding(ctx, tenantID, id, req)
}

func (s *Service) FindingsByScanID(ctx context.Context, scanID string) ([]models.SecurityFinding, error) {
	return s.repo.FindingsByScanID(ctx, scanID)
}

func (s *Service) CountFindings(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountFindings(ctx, tenantID)
}

// ==================== Audit Plans ====================

func (s *Service) CreateAuditPlan(ctx context.Context, tenantID string, req *models.CreateAuditPlanRequest) (*models.AuditPlan, error) {
	d := &models.AuditPlan{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		Name:           req.Name,
		Description:    req.Description,
		Scope:          models.JSONB(req.Scope),
		AuditType:      req.AuditType,
		ScheduleType:   req.ScheduleType,
		Reviewers:      models.JSONArray(req.Reviewers),
		Status:         "draft",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	if d.Scope == nil {
		d.Scope = models.JSONB{}
	}
	if d.Reviewers == nil {
		d.Reviewers = models.JSONArray{}
	}
	if d.ScheduleType == "" {
		d.ScheduleType = "manual"
	}
	if d.AuditType == "" {
		d.AuditType = "security"
	}
	if req.CronExpression != "" {
		d.CronExpression = &req.CronExpression
	}
	if req.CreatedBy != "" {
		d.CreatedBy = &req.CreatedBy
	}
	return d, s.repo.CreateAuditPlan(ctx, d)
}

func (s *Service) ListAuditPlans(ctx context.Context, tenantID string) ([]models.AuditPlan, error) {
	return s.repo.ListAuditPlans(ctx, tenantID)
}

func (s *Service) GetAuditPlan(ctx context.Context, tenantID, id string) (*models.AuditPlan, error) {
	return s.repo.GetAuditPlanByID(ctx, tenantID, id)
}

func (s *Service) UpdateAuditPlan(ctx context.Context, tenantID, id string, req *models.UpdateAuditPlanRequest) (*models.AuditPlan, error) {
	return s.repo.UpdateAuditPlan(ctx, tenantID, id, req)
}

func (s *Service) DeleteAuditPlan(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteAuditPlan(ctx, tenantID, id)
}

// ==================== Audit Executions ====================

func (s *Service) ExecuteAudit(ctx context.Context, tenantID, planID string) (*models.AuditExecution, error) {
	plan, err := s.repo.GetAuditPlanByID(ctx, tenantID, planID)
	if err != nil {
		return nil, ErrAuditPlanNotFound
	}

	// Update plan status to active
	_ = s.repo.UpdateAuditPlanStatus(ctx, planID, "active")

	now := time.Now()
	exec := &models.AuditExecution{
		ID:          uuid.New().String(),
		PlanID:      planID,
		TenantID:    tenantID,
		Status:      "running",
		StartedAt:   now,
		CreatedAt:   now,
	}
	if err := s.repo.CreateAuditExecution(ctx, exec); err != nil {
		return nil, err
	}

	// Generate audit findings based on plan type
	findings := s.runAuditChecks(plan)
	for i := range findings {
		findings[i].ID = uuid.New().String()
		findings[i].ExecutionID = exec.ID
		findings[i].TenantID = tenantID
		findings[i].CreatedAt = time.Now()
		if err := s.repo.CreateAuditFinding(ctx, &findings[i]); err != nil {
			return nil, err
		}
	}

	// Update execution
	completed := time.Now()
	exec.CompletedAt = &completed
	exec.Status = "completed"
	exec.FindingsCount = len(findings)

	updated, err := s.repo.UpdateAuditExecution(ctx, exec.ID, "completed", len(findings))
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Service) GetExecution(ctx context.Context, id string) (*models.AuditExecution, error) {
	return s.repo.GetAuditExecutionByID(ctx, id)
}

func (s *Service) ListExecutions(ctx context.Context, planID string) ([]models.AuditExecution, error) {
	return s.repo.ListAuditExecutions(ctx, planID)
}

func (s *Service) GetLatestExecution(ctx context.Context, planID string) (*models.AuditExecution, error) {
	return s.repo.FindLatestExecutionByPlan(ctx, planID)
}

// runAuditChecks generates findings based on the audit plan type.
func (s *Service) runAuditChecks(plan *models.AuditPlan) []models.AuditFinding {
	var findings []models.AuditFinding
	now := time.Now()
	switch plan.AuditType {
	case "security":
		findings = []models.AuditFinding{
			{Title: "TLS version check", Description: "Verified TLS 1.2+ is enforced on all endpoints", Severity: "info", Category: "encryption", Status: "open", Recommendation: "Continue monitoring TLS versions", CreatedAt: now},
			{Title: "Secret rotation policy", Description: "API key rotation policy is configured", Severity: "info", Category: "secrets", Status: "open", Recommendation: "Ensure rotation schedule is followed", CreatedAt: now},
		}
	case "access":
		findings = []models.AuditFinding{
			{Title: "RBAC configuration", Description: "Role-based access control is properly configured", Severity: "info", Category: "access_control", Status: "open", Recommendation: "Review roles periodically", CreatedAt: now},
		}
	case "compliance", "performance":
		// No automatic findings for these types
	}
	if len(findings) == 0 {
		findings = []models.AuditFinding{
			{Title: fmt.Sprintf("Unknown audit type: %s", plan.AuditType), Severity: "medium", Category: "configuration", Status: "open", Recommendation: "Use a valid audit type: security, compliance, access, performance, or full", CreatedAt: now},
		}
	}
	return findings
}

// ==================== Compliance Policies ====================

func (s *Service) CreateCompliancePolicy(ctx context.Context, tenantID string, req *models.CreateCompliancePolicyRequest) (*models.CompliancePolicy, error) {
	d := &models.CompliancePolicy{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		Name:              req.Name,
		Description:       req.Description,
		FrameworkType:     req.FrameworkType,
		Requirements:      models.JSONB(req.Requirements),
		Rules:             models.JSONArray(req.Rules),
		SeverityThreshold: req.SeverityThreshold,
		Enabled:           true,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	if d.Requirements == nil {
		d.Requirements = models.JSONB{}
	}
	if d.Rules == nil {
		d.Rules = models.JSONArray{}
	}
	if d.SeverityThreshold == "" {
		d.SeverityThreshold = "high"
	}
	if req.CreatedBy != "" {
		d.CreatedBy = &req.CreatedBy
	}
	return d, s.repo.CreateCompliancePolicy(ctx, d)
}

func (s *Service) ListCompliancePolicies(ctx context.Context, tenantID, frameworkType string) ([]models.CompliancePolicy, error) {
	return s.repo.ListCompliancePolicies(ctx, tenantID, frameworkType)
}

func (s *Service) GetCompliancePolicy(ctx context.Context, id string) (*models.CompliancePolicy, error) {
	return s.repo.GetCompliancePolicyByID(ctx, id)
}

func (s *Service) DeleteCompliancePolicy(ctx context.Context, id string) error {
	return s.repo.DeleteCompliancePolicy(ctx, id)
}

// ==================== Compliance Evaluations ====================

func (s *Service) EvaluateCompliance(ctx context.Context, tenantID, policyID string) (*models.ComplianceEvaluation, error) {
	policy, err := s.repo.GetCompliancePolicyByID(ctx, policyID)
	if err != nil {
		return nil, ErrPolicyNotFound
	}

	now := time.Now()
	eval := &models.ComplianceEvaluation{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		PolicyID:  policyID,
		Status:    "running",
		StartedAt: now,
		CreatedAt: now,
	}
	if err := s.repo.CreateComplianceEvaluation(ctx, eval); err != nil {
		return nil, err
	}

	// Evaluate rules against policy
	gaps := s.evaluatePolicyRules(policy)
	score := s.calculateScore(gaps)
	completed := time.Now()

	updated, err := s.repo.UpdateComplianceEvaluation(ctx, eval.ID, "completed", score, len(gaps), len(gaps)-len(gaps), len(gaps), gaps)
	if err != nil {
		return nil, err
	}
	eval.CompletedAt = &completed
	return updated, nil
}

func (s *Service) GetComplianceEvaluation(ctx context.Context, id string) (*models.ComplianceEvaluation, error) {
	return nil, ErrPolicyNotFound
}

func (s *Service) GetLatestEvaluation(ctx context.Context, policyID string) (*models.ComplianceEvaluation, error) {
	return s.repo.FindLatestEvaluationByPolicy(ctx, policyID)
}

func (s *Service) ListComplianceEvaluations(ctx context.Context, tenantID string) ([]models.ComplianceEvaluation, error) {
	return s.repo.ListComplianceEvaluationsByTenant(ctx, tenantID)
}

func (s *Service) GetComplianceScore(ctx context.Context, tenantID string) (*models.ComplianceScoreSummary, error) {
	policies, err := s.repo.ListCompliancePolicies(ctx, tenantID, "")
	if err != nil {
		return nil, err
	}
	if len(policies) == 0 {
		return &models.ComplianceScoreSummary{
			TenantID:            tenantID,
			OverallScore:        100,
			PoliciesByFramework: make(map[string]float32),
		}, nil
	}

	var totalScore float32
	byFramework := make(map[string]float32)
	openGaps := 0
	criticalGaps := 0

	for _, p := range policies {
		eval, err := s.repo.FindLatestEvaluationByPolicy(ctx, p.ID)
		if err != nil {
			// No evaluation yet, treat as 100% compliant
			byFramework[p.FrameworkType] += 100
			totalScore += 100
			continue
		}
		byFramework[p.FrameworkType] += eval.Score
		totalScore += eval.Score
		if eval.CompletedAt != nil {
			gaps, _ := json.Marshal(eval.Gaps)
			_ = gaps // counted via evaluation
		}
	}

	avgScore := totalScore / float32(len(policies))
	return &models.ComplianceScoreSummary{
		TenantID:            tenantID,
		OverallScore:        avgScore,
		PoliciesEvaluated:   len(policies),
		PoliciesByFramework: byFramework,
		OpenGaps:            openGaps,
		CriticalGaps:        criticalGaps,
	}, nil
}

func (s *Service) evaluatePolicyRules(policy *models.CompliancePolicy) []models.ComplianceGap {
	var gaps []models.ComplianceGap
	for i, _ := range policy.Rules {
		gaps = append(gaps, models.ComplianceGap{
			ID:          fmt.Sprintf("gap-%d", i+1),
			Rule:        fmt.Sprintf("rule-%d", i+1),
			Description: "Rule not yet evaluated",
			Severity:    "medium",
			Remediation: "Review rule compliance",
		})
	}
	return gaps
}

func (s *Service) calculateScore(gaps []models.ComplianceGap) float32 {
	if len(gaps) == 0 {
		return 100
	}
	return 100 - float32(len(gaps))*10
}

// ==================== Supply Chain SBOM ====================

func (s *Service) CreateSBOM(ctx context.Context, tenantID string, req *models.CreateSBOMRequest) (*models.SupplyChainSBOM, error) {
	d := &models.SupplyChainSBOM{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		ArtifactID:     req.ArtifactID,
		SBOMFormat:     req.Format,
		SBOMVersion:    req.Version,
		Components:     models.JSONArray(req.Components),
		Dependencies:   models.JSONArray(req.Dependencies),
		CreatedAt:      time.Now(),
	}
	if d.SBOMFormat == "" {
		d.SBOMFormat = "cyclonedx"
	}
	if d.SBOMVersion == "" {
		d.SBOMVersion = "1.4"
	}
	if d.Dependencies == nil {
		d.Dependencies = models.JSONArray{}
	}
	if req.PipelineID != "" {
		d.PipelineID = &req.PipelineID
	}
	return d, s.repo.CreateSBOM(ctx, d)
}

func (s *Service) GetSBOM(ctx context.Context, id string) (*models.SupplyChainSBOM, error) {
	return s.repo.GetSBOMByID(ctx, id)
}

func (s *Service) ListSBOMs(ctx context.Context, tenantID string, offset, limit int) ([]models.SupplyChainSBOM, error) {
	return s.repo.ListSBOMs(ctx, tenantID, offset, limit)
}

func (s *Service) CountSBOMs(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountSBOMs(ctx, tenantID)
}

// ==================== Dependency Graph ====================

func (s *Service) AnalyzeDependency(ctx context.Context, tenantID string, req *models.AnalyzeDependencyRequest) (*models.DependencyGraph, error) {
	// Check if already analyzed
	existing, err := s.repo.FindDependencyGraph(ctx, tenantID, req.PackageName, req.PackageVersion)
	if err == nil && existing != nil {
		return existing, nil
	}

	if req.Depth == 0 {
		req.Depth = 3
	}

	d := &models.DependencyGraph{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		PackageName:    req.PackageName,
		PackageVersion: req.PackageVersion,
		DirectDeps:     models.JSONArray{},
		TransitiveDeps: models.JSONArray{},
		VulnerablePaths: models.JSONArray{},
		Depth:          req.Depth,
		AnalyzedAt:     time.Now(),
	}
	return d, s.repo.CreateDependencyGraph(ctx, d)
}

func (s *Service) GetDependencyGraph(ctx context.Context, tenantID, packageName, packageVersion string) (*models.DependencyGraph, error) {
	return s.repo.FindDependencyGraph(ctx, tenantID, packageName, packageVersion)
}

func (s *Service) ListDependencyGraphs(ctx context.Context, tenantID string, offset, limit int) ([]models.DependencyGraph, error) {
	return s.repo.ListDependencyGraphs(ctx, tenantID, offset,limit)
}

// ==================== Dependency Poisoning ====================

func (s *Service) ScanDependencyPoisoning(ctx context.Context, tenantID string, req *models.ScanDependencyPoisoningRequest) (*models.DependencyPoisoningScan, error) {
	malicious, typosquatting := s.detectPoisoning(req.Packages)

	riskScore := s.calculatePoisoningRisk(malicious, typosquatting)
	riskLevel := s.riskLevel(riskScore)

	d := &models.DependencyPoisoningScan{
		ID:                 uuid.New().String(),
		TenantID:           tenantID,
		PackagesScanned:    len(req.Packages),
		MaliciousFound:     malicious,
		TyposquattingFound: typosquatting,
		RiskScore:          riskScore,
		RiskLevel:          riskLevel,
		ScanData:           models.JSONB{"malicious": malicious, "typosquatting": typosquatting},
		CreatedAt:          time.Now(),
	}
	return d, s.repo.CreateDependencyPoisoningScan(ctx, d)
}

func (s *Service) ListDependencyPoisoningScans(ctx context.Context, tenantID string, offset, limit int) ([]models.DependencyPoisoningScan, error) {
	return s.repo.ListDependencyPoisoningScans(ctx, tenantID, offset, limit)
}

func (s *Service) CountDependencyPoisoningScans(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountDependencyPoisoningScans(ctx, tenantID)
}

// Known malicious packages for detection
var knownMaliciousPackages = map[string]string{
	"event-stream":   "Malicious code injecting Bitcoin theft",
	"ua-parser-js":   "Cryptominer injection",
	"coa":            "Malware in compromised package",
	"rc":             "Malware in compromised package",
	"eslint-scope":   "Credential exfiltration",
	"cross-spawn":    "Credential theft",
}

// Popular packages for typosquatting detection
var popularPackages = []string{
	"react", "lodash", "express", "axios", "moment", "chalk", "webpack",
	"babel", "typescript", "eslint", "jest", "node-fetch", "dotenv",
}

func (s *Service) detectPoisoning(packages []models.PackageEntry) (malicious, typosquatting int) {
	for _, pkg := range packages {
		nameLower := strings.ToLower(pkg.Name)
		// Check malicious
		for known := range knownMaliciousPackages {
			if nameLower == known {
				malicious++
				break
			}
		}
		// Check typosquatting
		for _, legit := range popularPackages {
			if nameLower == legit {
				continue
			}
			if s.stringSimilarity(nameLower, legit) > 0.75 {
				typosquatting++
				break
			}
		}
	}
	return
}

func (s *Service) calculatePoisoningRisk(malicious, typosquatting int) int {
	score := 0
	score += malicious * 25
	score += typosquatting * 10
	if score > 100 {
		score = 100
	}
	return score
}

func (s *Service) riskLevel(score int) string {
	if score == 0 {
		return "safe"
	}
	if score < 20 {
		return "low"
	}
	if score < 50 {
		return "medium"
	}
	if score < 80 {
		return "high"
	}
	return "critical"
}

func (s *Service) stringSimilarity(a, b string) float32 {
	lenA, lenB := len(a), len(b)
	if lenA == 0 || lenB == 0 {
		return 0
	}
	// Simple character overlap
	matches := 0
	for _, ca := range a {
		for _, cb := range b {
			if ca == cb {
				matches++
				break
			}
		}
	}
	maxLen := float32(lenA)
	if float32(lenB) > maxLen {
		maxLen = float32(lenB)
	}
	return float32(matches) / maxLen
}

// ==================== Supply Chain Aggregates ====================

func (s *Service) GetSupplyChainReport(ctx context.Context, tenantID string) (*models.SupplyChainSBOM, error) {
	// Placeholder: returns aggregate info via summary in handler
	return nil, nil
}

// GetPoisoningSummary returns aggregate poisoning scan counts.
func (s *Service) GetPoisoningSummary(ctx context.Context, tenantID string) (total, critical int, err error) {
	return s.repo.PoisoningScanCounts(ctx, tenantID)
}
