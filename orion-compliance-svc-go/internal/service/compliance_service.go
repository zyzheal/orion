package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"orion/compliance-svc-go/internal/models"
	"orion/compliance-svc-go/internal/repository"
)

var (
	ErrReportNotFound    = errors.New("compliance report not found")
	ErrScheduleNotFound  = errors.New("compliance schedule not found")
	ErrInvalidStatus     = errors.New("invalid report status")
)

// ComplianceService provides business logic for compliance reports and schedules.
type ComplianceService struct {
	reportRepo   *repository.ComplianceReportRepository
	scheduleRepo *repository.ComplianceScheduleRepository
}

// NewComplianceService creates a new ComplianceService with the given repositories.
func NewComplianceService(
	reportRepo *repository.ComplianceReportRepository,
	scheduleRepo *repository.ComplianceScheduleRepository,
) *ComplianceService {
	return &ComplianceService{
		reportRepo:   reportRepo,
		scheduleRepo: scheduleRepo,
	}
}

// ==================== Helpers ====================

// randomStr generates a random hex string of n bytes (2n hex characters).
func randomStr(n int) string {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes)
}

// generateReportID creates a unique report ID.
func generateReportID() string {
	return fmt.Sprintf("rpt-%d-%s", time.Now().UnixNano(), randomStr(7))
}

// generateScheduleID creates a unique schedule ID.
func generateScheduleID() string {
	return fmt.Sprintf("sched-%d-%s", time.Now().UnixNano(), randomStr(7))
}

// ==================== Supported Frameworks ====================

// GetSupportedFrameworks returns the built-in list of supported compliance frameworks.
func (s *ComplianceService) GetSupportedFrameworks() []models.ComplianceFrameworkInfo {
	return []models.ComplianceFrameworkInfo{
		{
			ID:            "soc2",
			Name:          "SOC 2 Type II",
			Description:   "Service Organization Control 2 - Trust Services Criteria for security, availability, processing integrity, confidentiality, and privacy",
			Version:       "2022",
			Categories:    []string{"security", "availability", "processing_integrity", "confidentiality", "privacy"},
			TotalControls: 64,
			URL:           "https://www.aicpa.org/soc2",
		},
		{
			ID:            "iso27001",
			Name:          "ISO 27001",
			Description:   "Information security management systems - Requirements for establishing, implementing, maintaining, and continually improving an ISMS",
			Version:       "2022",
			Categories:    []string{"organizational", "people", "physical", "technological"},
			TotalControls: 93,
			URL:           "https://www.iso.org/iso-27001-information-security.html",
		},
		{
			ID:            "gdpr",
			Name:          "GDPR",
			Description:   "General Data Protection Regulation - EU data protection and privacy regulation",
			Version:       "2018",
			Categories:    []string{"lawfulness", "transparency", "data_subject_rights", "data_protection", "breach_notification"},
			TotalControls: 42,
			URL:           "https://gdpr.eu",
		},
		{
			ID:            "hipaa",
			Name:          "HIPAA",
			Description:   "Health Insurance Portability and Accountability Act - Protected health information security",
			Version:       "2013",
			Categories:    []string{"administrative", "physical", "technical", "organizational"},
			TotalControls: 76,
			URL:           "https://www.hhs.gov/hipaa/index.html",
		},
		{
			ID:            "pci-dss",
			Name:          "PCI DSS",
			Description:   "Payment Card Industry Data Security Standard - Cardholder data protection",
			Version:       "4.0",
			Categories:    []string{"network_security", "data_protection", "vulnerability_management", "access_control", "monitoring"},
			TotalControls: 280,
			URL:           "https://www.pcisecuritystandards.org",
		},
		{
			ID:            "nist-csf",
			Name:          "NIST Cybersecurity Framework",
			Description:   "Identify, Protect, Detect, Respond, Recover - Framework for improving critical infrastructure cybersecurity",
			Version:       "2.0",
			Categories:    []string{"govern", "identify", "protect", "detect", "respond", "recover"},
			TotalControls: 108,
			URL:           "https://www.nist.gov/cyberframework",
		},
	}
}

// GetFramework retrieves a single framework by ID.
func (s *ComplianceService) GetFramework(frameworkID string) *models.ComplianceFrameworkInfo {
	frameworks := s.GetSupportedFrameworks()
	for _, fw := range frameworks {
		if fw.ID == frameworkID {
			return &fw
		}
	}
	return nil
}

// ==================== Report CRUD ====================

// CreateReport creates a new compliance report.
func (s *ComplianceService) CreateReport(ctx context.Context, tenantID, name, description, framework, triggeredBy, scheduleID string) (*models.ComplianceReport, error) {
	report := &models.ComplianceReport{
		ID:          generateReportID(),
		TenantID:    tenantID,
		Name:        name,
		Description: strPtr(description),
		Framework:   framework,
		Status:      models.ReportStatusDraft,
		TriggeredBy: triggeredBy,
		Findings:    []byte("[]"),
	}
	if scheduleID != "" {
		report.ScheduleID = &scheduleID
	}

	if err := s.reportRepo.Create(ctx, report); err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	// Parse findings JSON for response
	if len(report.Findings) > 0 {
		var findings []models.ComplianceFinding
		if err := json.Unmarshal(report.Findings, &findings); err == nil {
			report.Findings = findingsToJSONB(findings)
		}
	}

	return report, nil
}

// GetReport retrieves a compliance report by ID.
func (s *ComplianceService) GetReport(ctx context.Context, id string) (*models.ComplianceReport, error) {
	report, err := s.reportRepo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get report: %w", err)
	}
	if report == nil {
		return nil, ErrReportNotFound
	}

	// Parse findings JSON
	if len(report.Findings) > 0 {
		var findings []models.ComplianceFinding
		if err := json.Unmarshal(report.Findings, &findings); err == nil {
			report.Findings = findingsToJSONB(findings)
		}
	}

	return report, nil
}

// ListReports retrieves all reports for a tenant, optionally filtered by framework.
func (s *ComplianceService) ListReports(ctx context.Context, tenantID, framework string, offset, limit int) ([]models.ComplianceReport, error) {
	if framework != "" {
		reports, err := s.reportRepo.FindByFramework(ctx, tenantID, framework)
		if err != nil {
			return nil, fmt.Errorf("failed to list reports by framework: %w", err)
		}
		return s.parseFindings(reports), nil
	}

	reports, err := s.reportRepo.FindByTenant(ctx, tenantID, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list reports: %w", err)
	}
	return s.parseFindings(reports), nil
}

// UpdateReport updates a compliance report by ID.
func (s *ComplianceService) UpdateReport(ctx context.Context, id string, input *models.UpdateReportInput) (*models.ComplianceReport, error) {
	existing, err := s.reportRepo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to find report for update: %w", err)
	}
	if existing == nil {
		return nil, ErrReportNotFound
	}

	updates := make(map[string]interface{})

	if input.Name != nil {
		updates["name"] = *input.Name
	}
	if input.Description != nil {
		updates["description"] = input.Description
	}
	if input.Status != nil {
		status := models.ReportStatus(*input.Status)
		if !isValidReportStatus(status) {
			return nil, ErrInvalidStatus
		}
		updates["status"] = status
		now := time.Now()
		if status == models.ReportStatusRunning && existing.StartedAt == nil {
			updates["started_at"] = &now
		}
		if status == models.ReportStatusCompleted || status == models.ReportStatusFailed {
			updates["completed_at"] = &now
		}
	}
	if input.Score != nil {
		updates["score"] = input.Score
	}
	if input.Findings != nil {
		findingsBytes, err := json.Marshal(input.Findings)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal findings: %w", err)
		}
		updates["findings"] = findingsBytes
	}

	report, err := s.reportRepo.Update(ctx, id, updates)
	if err != nil {
		return nil, fmt.Errorf("failed to update report: %w", err)
	}

	// Parse findings JSON for response
	if len(report.Findings) > 0 {
		var findings []models.ComplianceFinding
		if err := json.Unmarshal(report.Findings, &findings); err == nil {
			report.Findings = findingsToJSONB(findings)
		}
	}

	return report, nil
}

// DeleteReport deletes a compliance report by ID.
func (s *ComplianceService) DeleteReport(ctx context.Context, id string) error {
	existing, err := s.reportRepo.FindByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to find report for deletion: %w", err)
	}
	if existing == nil {
		return ErrReportNotFound
	}
	if err := s.reportRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete report: %w", err)
	}
	return nil
}

// StartReport transitions a report to running status.
func (s *ComplianceService) StartReport(ctx context.Context, id string) (*models.ComplianceReport, error) {
	return s.UpdateReport(ctx, id, &models.UpdateReportInput{
		Status: strPtrStatus(string(models.ReportStatusRunning)),
	})
}

// CompleteReport marks a report as completed with score and findings.
func (s *ComplianceService) CompleteReport(ctx context.Context, id string, score float64, findings []models.ComplianceFinding) (*models.ComplianceReport, error) {
	findingsBytes, err := json.Marshal(findings)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal findings: %w", err)
	}

	report, err := s.reportRepo.Update(ctx, id, map[string]interface{}{
		"status":   models.ReportStatusCompleted,
		"score":    &score,
		"findings": findingsBytes,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to complete report: %w", err)
	}

	report.Findings = findingsToJSONB(findings)
	return report, nil
}

// FailReport marks a report as failed.
func (s *ComplianceService) FailReport(ctx context.Context, id string) (*models.ComplianceReport, error) {
	return s.UpdateReport(ctx, id, &models.UpdateReportInput{
		Status: strPtrStatus(string(models.ReportStatusFailed)),
	})
}

// ==================== Schedule CRUD ====================

// CreateSchedule creates a new compliance schedule.
func (s *ComplianceService) CreateSchedule(ctx context.Context, tenantID, name, framework, cronExpression string, enabled bool, createdBy string) (*models.ComplianceSchedule, error) {
	schedule := &models.ComplianceSchedule{
		ID:             generateScheduleID(),
		TenantID:       tenantID,
		Name:           name,
		Framework:      framework,
		CronExpression: cronExpression,
		Enabled:        enabled,
		CreatedBy:      strPtr(createdBy),
	}

	if err := s.scheduleRepo.Create(ctx, schedule); err != nil {
		return nil, fmt.Errorf("failed to create schedule: %w", err)
	}

	return schedule, nil
}

// GetSchedule retrieves a schedule by ID.
func (s *ComplianceService) GetSchedule(ctx context.Context, id string) (*models.ComplianceSchedule, error) {
	schedule, err := s.scheduleRepo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get schedule: %w", err)
	}
	if schedule == nil {
		return nil, ErrScheduleNotFound
	}
	return schedule, nil
}

// ListSchedules retrieves all schedules for a tenant.
func (s *ComplianceService) ListSchedules(ctx context.Context, tenantID string, offset, limit int) ([]models.ComplianceSchedule, error) {
	schedules, err := s.scheduleRepo.FindByTenant(ctx, tenantID, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list schedules: %w", err)
	}
	return schedules, nil
}

// UpdateSchedule updates a schedule by ID.
func (s *ComplianceService) UpdateSchedule(ctx context.Context, id string, input *models.UpdateScheduleInput) (*models.ComplianceSchedule, error) {
	existing, err := s.scheduleRepo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to find schedule for update: %w", err)
	}
	if existing == nil {
		return nil, ErrScheduleNotFound
	}

	updates := make(map[string]interface{})
	if input.Name != nil {
		updates["name"] = *input.Name
	}
	if input.Framework != nil {
		updates["framework"] = *input.Framework
	}
	if input.CronExpression != nil {
		updates["cron_expression"] = *input.CronExpression
	}
	if input.Enabled != nil {
		updates["enabled"] = *input.Enabled
	}

	schedule, err := s.scheduleRepo.Update(ctx, id, updates)
	if err != nil {
		return nil, fmt.Errorf("failed to update schedule: %w", err)
	}
	return schedule, nil
}

// DeleteSchedule deletes a schedule and all its associated reports.
func (s *ComplianceService) DeleteSchedule(ctx context.Context, id string) error {
	existing, err := s.scheduleRepo.FindByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to find schedule for deletion: %w", err)
	}
	if existing == nil {
		return ErrScheduleNotFound
	}

	// Delete all reports associated with this schedule
	reports, err := s.reportRepo.FindByScheduleID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to find reports for schedule: %w", err)
	}
	for _, report := range reports {
		if err := s.reportRepo.Delete(ctx, report.ID); err != nil {
			return fmt.Errorf("failed to delete report %s: %w", report.ID, err)
		}
	}

	if err := s.scheduleRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete schedule: %w", err)
	}
	return nil
}

// ListEnabledSchedules retrieves all enabled schedules for a tenant.
func (s *ComplianceService) ListEnabledSchedules(ctx context.Context, tenantID string) ([]models.ComplianceSchedule, error) {
	schedules, err := s.scheduleRepo.FindEnabled(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to list enabled schedules: %w", err)
	}
	return schedules, nil
}

// ==================== Private Helpers ====================

// isValidReportStatus checks if a status value is valid.
func isValidReportStatus(status models.ReportStatus) bool {
	switch status {
	case models.ReportStatusDraft, models.ReportStatusRunning, models.ReportStatusCompleted, models.ReportStatusFailed:
		return true
	}
	return false
}

// findingsToJSONB converts a findings slice to JSONB bytes.
func findingsToJSONB(findings []models.ComplianceFinding) models.JSONB {
	data, _ := json.Marshal(findings)
	return models.JSONB(data)
}

// strPtr returns a pointer to the given string.
func strPtr(s string) *string {
	return &s
}

// strPtrStatus returns a pointer to a ReportStatus created from a string.
func strPtrStatus(s string) *models.ReportStatus {
	status := models.ReportStatus(s)
	return &status
}

// parseFindings parses JSONB findings for each report in the slice.
func (s *ComplianceService) parseFindings(reports []models.ComplianceReport) []models.ComplianceReport {
	for i := range reports {
		if len(reports[i].Findings) > 0 {
			var findings []models.ComplianceFinding
			if err := json.Unmarshal(reports[i].Findings, &findings); err == nil {
				reports[i].Findings = findingsToJSONB(findings)
			}
		}
	}
	return reports
}

// ComputeOverallScore calculates an overall compliance score from a slice of findings.
func ComputeOverallScore(findings []models.ComplianceFinding) float64 {
	if len(findings) == 0 {
		return 0.0
	}

	// Count findings by severity
	severityWeights := map[models.FindingSeverity]float64{
		models.FindingSeverityCritical: 1.0,
		models.FindingSeverityHigh:     0.75,
		models.FindingSeverityMedium:   0.5,
		models.FindingSeverityLow:      0.25,
		models.FindingSeverityInfo:     0.0,
	}

	totalWeight := 0.0
	for _, f := range findings {
		if f.Status == models.FindingStatusFail {
			totalWeight += severityWeights[f.Severity]
		}
	}

	maxPossibleWeight := float64(len(findings))
	score := 100.0 - (totalWeight / maxPossibleWeight * 100.0)
	return math.Round(score*100) / 100
}

// SortFindingsBySeverity sorts findings by severity (critical first).
func SortFindingsBySeverity(findings []models.ComplianceFinding) {
	severityOrder := map[models.FindingSeverity]int{
		models.FindingSeverityCritical: 0,
		models.FindingSeverityHigh:     1,
		models.FindingSeverityMedium:   2,
		models.FindingSeverityLow:      3,
		models.FindingSeverityInfo:     4,
	}

	sort.Slice(findings, func(i, j int) bool {
		return severityOrder[findings[i].Severity] < severityOrder[findings[j].Severity]
	})
}
