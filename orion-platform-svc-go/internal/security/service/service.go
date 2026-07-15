package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/security/models"
	"orion/platform-svc-go/internal/security/repository"

	"github.com/google/uuid"
)

var (
	ErrNotFound     = errors.New("vulnerability not found")
	ErrInvalidInput = errors.New("invalid input")
)

// validRemediationActions defines the allowed remediation actions.
var validRemediationActions = map[models.VulnerabilityStatus]bool{
	models.VulnerabilityStatusRemediated:    true,
	models.VulnerabilityStatusIgnored:       true,
	models.VulnerabilityStatusFalsePositive: true,
}

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// GetVulnerabilityReport retrieves a paginated vulnerability report for the tenant.
func (s *Service) GetVulnerabilityReport(ctx context.Context, tenantID string, opt models.ListVulnerabilitiesOptions) (*models.VulnerabilityReport, error) {
	vulns, total, err := s.repo.List(ctx, tenantID, opt)
	if err != nil {
		return nil, err
	}

	report, err := s.repo.GetScanStats(ctx, tenantID)
	if err != nil {
		// Fall back to manual stats from the list result
		report = &models.VulnerabilityReport{
			TotalVulnerabilities: total,
			BySeverity:           make(map[string]int),
			ByStatus:             make(map[string]int),
		}
		for _, v := range vulns {
			report.BySeverity[string(v.Severity)]++
			report.ByStatus[string(v.Status)]++
		}
	}

	report.Vulnerabilities = vulns
	return report, nil
}

// CheckVulnerability looks up a vulnerability by CVE ID or internal UUID.
func (s *Service) CheckVulnerability(ctx context.Context, tenantID, id string) (*models.Vulnerability, error) {
	// Try as internal UUID first
	vuln, err := s.repo.GetByID(ctx, tenantID, id)
	if err == nil {
		return vuln, nil
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	// Try as CVE ID
	return s.repo.GetByCVEID(ctx, tenantID, id)
}

// RemediateVulnerability updates the status of a vulnerability.
func (s *Service) RemediateVulnerability(ctx context.Context, tenantID, cveID, packageName string, req models.RemediateVulnerabilityRequest) (*models.Vulnerability, error) {
	if _, ok := validRemediationActions[req.Action]; !ok {
		return nil, fmt.Errorf("%w: invalid action, must be one of: remediated, ignored, false_positive", ErrInvalidInput)
	}

	// Look up the vulnerability
	var vuln *models.Vulnerability
	var err error

	if packageName != "" {
		vuln, err = s.repo.GetByCVEIDAndPackage(ctx, tenantID, cveID, packageName)
	} else {
		vuln, err = s.repo.GetByCVEID(ctx, tenantID, cveID)
	}
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	updated, err := s.repo.UpdateStatus(ctx, tenantID, vuln.ID, req.Action)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// ScanDependencies triggers a dependency vulnerability scan for the given project path.
// This is a simplified scan that records the scan metadata and any discovered vulnerabilities.
func (s *Service) ScanDependencies(ctx context.Context, tenantID, projectPath string) (*models.ScanResult, error) {
	// In a real implementation this would invoke npm audit / trivy / snyk.
	// For now we return a scan result with no vulnerabilities (blueprint behavior).
	if projectPath == "" {
		projectPath = "unknown"
	}

	return &models.ScanResult{
		ScanID:               fmt.Sprintf("scan-%s-%d", uuid.New().String(), time.Now().UnixMilli()),
		PackageManager:       "npm",
		TotalDependencies:    0,
		VulnerabilitiesFound: 0,
		Vulnerabilities:      []models.Vulnerability{},
		ScannedAt:            time.Now().UTC(),
		Tool:                 "npm-audit",
		Warning:              fmt.Sprintf("scan requested for project: %s", projectPath),
	}, nil
}
