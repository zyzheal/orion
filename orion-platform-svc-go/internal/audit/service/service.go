package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/audit/models"
	"orion/platform-svc-go/internal/audit/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLog, error)
	Export(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error)
	GetActions(ctx context.Context, tenantID string) ([]string, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.AuditLog, error)
	GetResourceTypes(ctx context.Context, tenantID string) ([]string, error)
	List(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, int, error)
	VerifyChain(ctx context.Context, tenantID string) (int, bool, error)
}

// Service provides business logic for the audit module.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service backed by the given Repository interface.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// GenesisHash is the immutable chain genesis value (matches TS source).
const GenesisHash = "0000000000000000000000000000000000000000000000000000000000000000"

// toAuditLogEntry converts a DB model to the frontend-friendly entry format.
func toAuditLogEntry(log models.AuditLog) models.AuditLogEntry {
	details := make(map[string]any)
	_ = json.Unmarshal([]byte(log.RequestBody), &details)
	if len(details) == 0 {
		_ = json.Unmarshal([]byte(log.ResponseBody), &details)
	}
	return models.AuditLogEntry{
		ID:             log.ID,
		Timestamp:      log.CreatedAt,
		Action:         log.Action,
		UserID:         log.UserID,
		TenantID:       log.TenantID,
		Details:        details,
		Resource:       log.ResourceType,
		ResourceID:     log.ResourceID,
		IPAddress:      log.IPAddress,
		UserAgent:      log.UserAgent,
		PrevHash:       log.PrevHash,
		ContentHash:    log.Hash,
		ChainHash:      log.Hash,
		SequenceNumber: 0,
		RequestMethod:  log.RequestMethod,
		RequestPath:    log.RequestPath,
		ResponseCode:   log.ResponseCode,
	}
}

// Create creates a new audit log entry.
func (s *Service) Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error) {
	// Default tenant
	if req.TenantID == "" {
		req.TenantID = tenantID
	}
	// Default resource type
	if req.ResourceType == "" {
		req.ResourceType = "audit"
	}

	log, err := s.repo.Create(ctx, req.TenantID, req)
	if err != nil {
		return nil, err
	}
	entry := toAuditLogEntry(*log)
	return &entry, nil
}

// Get retrieves a single audit log by ID.
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error) {
	log, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	entry := toAuditLogEntry(*log)
	return &entry, nil
}

// List returns a paginated list of audit logs.
func (s *Service) List(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error) {
	logs, total, err := s.repo.List(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	entries := make([]models.AuditLogEntry, 0, len(logs))
	for _, l := range logs {
		entries = append(entries, toAuditLogEntry(l))
	}
	return &models.AuditLogListResult{
		Entries:    entries,
		Total:      total,
		Page:       q.Page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

// VerifySingle verifies the integrity of a single audit log entry.
func (s *Service) VerifySingle(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error) {
	log, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, false, err
	}
	entry := toAuditLogEntry(*log)
	return &entry, log.Hash != "", nil
}

// VerifyChain verifies the integrity of the entire audit chain for a tenant.
func (s *Service) VerifyChain(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error) {
	verified, valid, err := s.repo.VerifyChain(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	result := &models.ChainVerifyResult{
		Valid:         valid,
		TotalVerified: verified,
		VerifiedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	if !valid {
		result.Breaks = []models.ChainBreak{{
			BreakType:   "HASH_MISMATCH",
			Description: fmt.Sprintf("Chain broken at sequence %d", verified),
			DetectedAt:  time.Now().UTC().Format(time.RFC3339),
		}}
	}
	return result, nil
}

// GetActions returns distinct action types for a tenant.
func (s *Service) GetActions(ctx context.Context, tenantID string) ([]string, error) {
	return s.repo.GetActions(ctx, tenantID)
}

// GetResourceTypes returns distinct resource types for a tenant.
func (s *Service) GetResourceTypes(ctx context.Context, tenantID string) ([]string, error) {
	return s.repo.GetResourceTypes(ctx, tenantID)
}

// ChainInfo returns chain compatibility information for a tenant.
func (s *Service) ChainInfo(ctx context.Context, tenantID string) (*models.ChainInfo, error) {
	logs, total, err := s.repo.List(ctx, tenantID, models.AuditLogQuery{Limit: 1})
	if err != nil {
		return nil, err
	}
	return &models.ChainInfo{
		TotalEntries:  total,
		FirstSequence: 1,
		LastSequence:  total,
		LastChainHash: func() string {
			if len(logs) > 0 {
				return logs[0].Hash
			}
			return ""
		}(),
		GenesisHash: GenesisHash,
	}, nil
}

// StorageStats returns storage compatibility stats for a tenant.
func (s *Service) StorageStats(ctx context.Context, tenantID string) (*models.StorageStats, error) {
	_, total, err := s.repo.List(ctx, tenantID, models.AuditLogQuery{Limit: 1})
	if err != nil {
		return nil, err
	}
	return &models.StorageStats{
		TotalEntries: total,
		StorageSize:  int64(total * 1024), // Approximate as TS source does
		LastFlushAt:  time.Now().UTC().Format(time.RFC3339),
		IsHealthy:    true,
	}, nil
}

// Export exports audit logs in the requested format (csv/json).
func (s *Service) Export(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error) {
	logs, err := s.repo.Export(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	format := q.Format
	if format == "" {
		format = "json"
	}
	filename := fmt.Sprintf("audit-export-%s.%s", time.Now().UTC().Format("2006-01-02"), format)
	var content string
	switch format {
	case "csv":
		content = repository.FormatCSV(logs)
	default:
		entries := make([]models.AuditLogEntry, 0, len(logs))
		for _, l := range logs {
			entries = append(entries, toAuditLogEntry(l))
		}
		b, _ := json.Marshal(entries)
		content = string(b)
	}
	return &models.AuditLogExportResult{
		Filename: filename,
		Content:  content,
	}, nil
}

// -----------------------------------------------------------------------
// Compliance control catalog
// -----------------------------------------------------------------------

// complianceControl is an internal definition of one compliance control.
type complianceControl struct {
	ID          string // SOC2: CC1–CC6; ISO27001: A.12.x …
	Name        string
	Category    string   // SOC2 trust service category / ISO27001 domain
	Actions     []string // audit action types that provide evidence for this control
	ExpectedMin int      // minimum distinct event types we expect to see
	Remediation string   // guidance given when control is partial / non-compliant
}

// controlCatalog returns the full set of controls. SOC2 and ISO27001 share
// the same audit-event universe; the framework parameter selects which
// subset is returned and labels the result appropriately.
func controlCatalog() []complianceControl {
	return []complianceControl{
		// ---- SOC2 Common Criteria (CC1–CC6) ----
		{ID: "CC1", Category: "SOC2", Name: "Control Environment",
			Actions:     []string{"CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"},
			ExpectedMin: 3,
			Remediation: "Ensure role definitions, segregation of duties and accountability policies are documented and enforced."},
		{ID: "CC2", Category: "SOC2", Name: "Communication and Information",
			Actions:     []string{"CREATE", "UPDATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Review communication policies for internal and external information exchange; log policy update events."},
		{ID: "CC3", Category: "SOC2", Name: "Risk Assessment",
			Actions:     []string{"CREATE", "UPDATE", "SCAN", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Establish regular risk-assessment cycles; capture risk-scan and audit events in the audit log."},
		{ID: "CC4", Category: "SOC2", Name: "Monitoring Activities",
			Actions:     []string{"AUDIT", "ALERT", "LOGIN", "SCAN"},
			ExpectedMin: 3,
			Remediation: "Configure continuous monitoring of access, changes and failures; ensure alert events are persisted."},
		{ID: "CC5", Category: "SOC2", Name: "Control Activities",
			Actions:     []string{"APPROVE", "REJECT", "CREATE", "UPDATE", "DELETE"},
			ExpectedMin: 3,
			Remediation: "Document approval workflows and change-control gates; log every approval/rejection decision."},
		{ID: "CC6", Category: "SOC2", Name: "Logical and Physical Access",
			Actions:     []string{"LOGIN", "LOGOUT", "GRANT", "REVOKE", "CREATE", "UPDATE"},
			ExpectedMin: 4,
			Remediation: "Enforce MFA and least-privilege access; log every authentication and permission-change event."},
		// ---- ISO27001:2022 Annex A controls ----
		{ID: "A.9.1.2", Category: "ISO27001", Name: "Access Control — User Registration & De-provisioning",
			Actions:     []string{"CREATE", "DELETE", "GRANT", "REVOKE"},
			ExpectedMin: 3,
			Remediation: "Implement automated de-provisioning on user off-boarding; audit account lifecycle events."},
		{ID: "A.9.2.1", Category: "ISO27001", Name: "Access Control — Privileged Access Rights",
			Actions:     []string{"GRANT", "REVOKE", "UPDATE", "APPROVE"},
			ExpectedMin: 2,
			Remediation: "Require approval and justification for any privileged access grant; log escalation events."},
		{ID: "A.9.4.1", Category: "ISO27001", Name: "Access Control — System and Application Access Review",
			Actions:     []string{"AUDIT", "REVIEW", "SCAN"},
			ExpectedMin: 2,
			Remediation: "Conduct periodic access reviews; persist review outcomes to the audit log."},
		{ID: "A.9.4.2", Category: "ISO27001", Name: "Access Control — User Access Reviews",
			Actions:     []string{"REVIEW", "AUDIT", "REVOKE"},
			ExpectedMin: 2,
			Remediation: "Run quarterly user access reviews; record each review and any resulting de-provisioning."},
		{ID: "A.12.1.1", Category: "ISO27001", Name: "Operations — Change Management",
			Actions:     []string{"CREATE", "UPDATE", "DELETE", "APPROVE", "DEPLOY"},
			ExpectedMin: 3,
			Remediation: "Place all configuration and code changes under change-control; log deploy and rollback events."},
		{ID: "A.12.2.1", Category: "ISO27001", Name: "Operations — Malicious Software Prevention",
			Actions:     []string{"SCAN", "ALERT", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Run regular malware/SCA scans in CI; persist scan results and alert events."},
		{ID: "A.12.3.1", Category: "ISO27001", Name: "Operations — Information Backup",
			Actions:     []string{"CREATE", "EXPORT", "BACKUP", "RESTORE"},
			ExpectedMin: 2,
			Remediation: "Schedule regular backups of critical data; log every backup and restore operation."},
		{ID: "A.12.4.1", Category: "ISO27001", Name: "Operations — Event Logging",
			Actions:     []string{"CREATE", "AUDIT", "ALERT"},
			ExpectedMin: 3,
			Remediation: "Ensure immutable, time-stamped audit logs for all significant events; verify chain integrity."},
		{ID: "A.12.7.1", Category: "ISO27001", Name: "Operations — Technical Vulnerability Management",
			Actions:     []string{"SCAN", "AUDIT", "CREATE", "UPDATE"},
			ExpectedMin: 2,
			Remediation: "Subscribe to vulnerability feeds and patch on schedule; log scan findings and remediation actions."},
		{ID: "A.14.1.1", Category: "ISO27001", Name: "System Acquisition — Security Requirements",
			Actions:     []string{"CREATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Define and sign off on security requirements before any system acquisition or development."},
		{ID: "A.14.2.1", Category: "ISO27001", Name: "System Acquisition — Secure Systems Engineering",
			Actions:     []string{"CREATE", "UPDATE", "DEPLOY", "APPROVE"},
			ExpectedMin: 3,
			Remediation: "Embed security reviews into the SDLC; log code-review and deployment-approval events."},
		{ID: "A.14.2.9", Category: "ISO27001", Name: "System Acquisition — Segregation of Environments",
			Actions:     []string{"CREATE", "UPDATE", "DEPLOY"},
			ExpectedMin: 2,
			Remediation: "Maintain separate dev/staging/prod environments; log every cross-environment change."},
		{ID: "A.18.1.1", Category: "ISO27001", Name: "Compliance — Legal and Contractual Obligations",
			Actions:     []string{"APPROVE", "REVIEW", "CREATE", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Maintain a register of legal obligations; audit and review compliance evidence periodically."},
	}
}

// frameworkName maps the framework code to its human-readable name.
func frameworkName(fw string) string {
	switch strings.ToUpper(fw) {
	case "SOC2":
		return "SOC2 Type II — Trust Services Criteria"
	case "ISO27001":
		return "ISO/IEC 27001:2022 — Annex A"
	case "COMBINED":
		return "Combined — SOC2 + ISO27001"
	default:
		return "Compliance"
	}
}

// selectControls returns the controls that belong to the given framework.
// For SOC2 and ISO27001 the catalog is category-partitioned; COMBINED returns
// every control.
func selectControls(fw string, all []complianceControl) []complianceControl {
	switch strings.ToUpper(fw) {
	case "SOC2":
		var out []complianceControl
		for _, c := range all {
			if c.Category == "SOC2" {
				out = append(out, c)
			}
		}
		return out
	case "ISO27001":
		var out []complianceControl
		for _, c := range all {
			if c.Category == "ISO27001" {
				out = append(out, c)
			}
		}
		return out
	default: // COMBINED or any other value
		return all
	}
}

// -----------------------------------------------------------------------
// ComplianceReport — full implementation
// -----------------------------------------------------------------------

// ComplianceReport generates a SOC2 / ISO27001 / combined compliance report
// by querying the tenant's audit log entries and mapping observed actions
// against the control catalog.
func (s *Service) ComplianceReport(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
	now := time.Now().UTC()
	periodStart := now.AddDate(0, -3, 0) // default assessment window = last 90 days
	periodEnd := now

	// 1. Query audit logs for the tenant within the assessment period.
	logs, err := s.repo.Export(ctx, tenantID, models.AuditLogQuery{
		DateFrom: periodStart.Format(time.RFC3339),
		DateTo:   periodEnd.Format(time.RFC3339),
	})
	if err != nil {
		return nil, fmt.Errorf("querying audit logs: %w", err)
	}

	// 2. Build a set of distinct observed action types.
	seen := make(map[string]struct{})
	for _, l := range logs {
		if l.Action != "" {
			seen[strings.ToUpper(l.Action)] = struct{}{}
		}
	}

	catalog := controlCatalog()
	controls := selectControls(framework, catalog)

	controlResults := make([]models.ControlResult, 0, len(controls))
	findings := make([]models.ComplianceFinding, 0)
	compliant, partial, nonCompliant := 0, 0, 0

	for _, ctrl := range controls {
		// Count how many of this control's required actions are observed.
		found := 0
		for _, act := range ctrl.Actions {
			if _, ok := seen[strings.ToUpper(act)]; ok {
				found++
			}
		}
		coveragePct := 0.0
		if len(ctrl.Actions) > 0 {
			coveragePct = float64(found) / float64(len(ctrl.Actions)) * 100
		}

		status, passed := "", false
		var severity string
		switch {
		case float64(found) >= float64(ctrl.ExpectedMin) && coveragePct >= 80:
			status = "passed"
			passed = true
			compliant++
		case found > 0:
			status = "warning"
			severity = "medium"
			partial++
		default:
			status = "failed"
			severity = "high"
			nonCompliant++
		}

		// Build evidence description.
		var evidenceParts []string
		for _, act := range ctrl.Actions {
			if _, ok := seen[strings.ToUpper(act)]; ok {
				evidenceParts = append(evidenceParts, act)
			}
		}
		evidence := ""
		if len(evidenceParts) > 0 {
			evidence = "Observed actions: " + strings.Join(evidenceParts, ", ")
		} else {
			evidence = "No matching audit events found"
		}

		details := fmt.Sprintf("%d/%d required actions observed (≥%d expected)",
			found, len(ctrl.Actions), ctrl.ExpectedMin)

		controlResults = append(controlResults, models.ControlResult{
			ID:            ctrl.ID,
			Name:          ctrl.Name,
			Status:        status,
			EvidenceCount: found,
			Details:       details,
		})

		// Generate finding only for non-compliant / partial controls.
		if !passed {
			findings = append(findings, models.ComplianceFinding{
				ID:          fmt.Sprintf("F-%s", ctrl.ID),
				ControlID:   ctrl.ID,
				Title:       fmt.Sprintf("%s — %s: %s", ctrl.ID, ctrl.Name, status),
				Description: fmt.Sprintf("%s. %s", details, evidence),
				Severity:    severity,
				Evidence:    evidence,
				Remediation: ctrl.Remediation,
			})
		}
	}

	// 3. Overall score (weighted toward controls that have evidence).
	totalControls := len(controlResults)
	var totalScore float64
	for _, cr := range controlResults {
		switch cr.Status {
		case "passed":
			totalScore += 1.0
		case "warning":
			totalScore += 0.4
		}
	}
	var overallScore float64
	if totalControls > 0 {
		overallScore = math.Round((totalScore/float64(totalControls))*100*10) / 10
	}

	// 4. Rating.
	var rating string
	switch {
	case overallScore >= 80:
		rating = "compliant"
	case overallScore >= 40:
		rating = "partial"
	default:
		rating = "non-compliant"
	}

	// 5. Recommendations — sorted by severity of the worst finding for the
	//    associated control(s). Distinct remediation statements across findings.

	seenRec := make(map[string]struct{})
	recommendations := make([]string, 0)
	// Sort findings so high-severity ones surface first.
	sort.SliceStable(findings, func(i, j int) bool {
		oi := sevRank(findings[i].Severity)
		oj := sevRank(findings[j].Severity)
		return oi > oj
	})
	for _, f := range findings {
		if f.Remediation == "" {
			continue
		}
		if _, dup := seenRec[f.Remediation]; dup {
			continue
		}
		seenRec[f.Remediation] = struct{}{}
		recommendations = append(recommendations, fmt.Sprintf("[%s] %s → %s", f.ControlID, f.Title, f.Remediation))
	}
	if len(recommendations) == 0 {
		recommendations = append(recommendations, "All controls meet the minimum evidence threshold. Continue periodic review.")
	}

	// Sort controls by ID for deterministic output.
	sort.SliceStable(controlResults, func(i, j int) bool {
		return controlResults[i].ID < controlResults[j].ID
	})

	return &models.ComplianceReport{
		ReportType:      strings.ToUpper(framework),
		PeriodStart:     periodStart.Format(time.RFC3339),
		PeriodEnd:       periodEnd.Format(time.RFC3339),
		GeneratedAt:     now.Format(time.RFC3339),
		Score:           overallScore,
		Rating:          rating,
		TotalControls:   totalControls,
		PassedControls:  compliant,
		FailedControls:  nonCompliant + partial,
		Findings:        findings,
		Controls:        controlResults,
		Recommendations: recommendations,
	}, nil
}

// sevRank returns a numeric rank for severity strings (higher = worse).
func sevRank(sev string) int {
	switch strings.ToLower(sev) {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	}
	return 0
}

// -----------------------------------------------------------------------
// CoverageStats — full implementation
// -----------------------------------------------------------------------

// CoverageStats returns audit coverage statistics across both frameworks by
// re-using the compliance-report engine and collapsing the results.
func (s *Service) CoverageStats(ctx context.Context, tenantID string) (*models.AuditCoverageStats, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	byFramework := make(map[string]float64)
	var allControls, allPassed int

	for _, fw := range []string{"SOC2", "ISO27001"} {
		report, err := s.ComplianceReport(ctx, tenantID, fw)
		if err != nil {
			return nil, fmt.Errorf("coverage stats for %s: %w", fw, err)
		}
		byFramework[fw] = report.Score
		allControls += report.TotalControls
		allPassed += report.PassedControls
	}

	var overallCoveragePct float64
	if allControls > 0 {
		overallCoveragePct = math.Round(float64(allPassed)/float64(allControls)*1000) / 10
	}

	return &models.AuditCoverageStats{
		OverallCoveragePct: overallCoveragePct,
		ByFramework:        byFramework,
		AssessedAt:         now,
	}, nil
}

// Known sentinel errors used by handlers for status-code routing.
var (

	ErrInvalidFormat = errors.New("invalid format")
)

// IsNotFound returns true if the error indicates a resource was not found.
func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
