package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"orion/platform-svc-go/internal/security/models"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/security/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	BatchCreate(ctx context.Context, tenantID string, vulns []models.CreateVulnerabilityRequest) ([]models.Vulnerability, error)
	GetByCVEID(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error)
	GetByCVEIDAndPackage(ctx context.Context, tenantID, cveID, packageName string) (*models.Vulnerability, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Vulnerability, error)
	GetScanStats(ctx context.Context, tenantID string) (*models.VulnerabilityReport, error)
	List(ctx context.Context, tenantID string, opt models.ListVulnerabilitiesOptions) ([]models.Vulnerability, int, error)
	UpdateStatus(ctx context.Context, tenantID, id string, status models.VulnerabilityStatus) (*models.Vulnerability, error)
}

var (

	ErrInvalidInput      = errors.New("invalid input")
	ErrTrivyNotInstalled = errors.New("trivy is not installed or not found in PATH")
	ErrTrivyScanFailed   = errors.New("trivy scan failed")
)

// validRemediationActions defines the allowed remediation actions.
var validRemediationActions = map[models.VulnerabilityStatus]bool{
	models.VulnerabilityStatusRemediated:    true,
	models.VulnerabilityStatusIgnored:       true,
	models.VulnerabilityStatusFalsePositive: true,
}

// trivyResult represents the top-level Trivy JSON output structure.
type trivyResult struct {
	Results []trivyTargetResult `json:"Results"`
}

// trivyTargetResult represents a single target (e.g., a lockfile) in Trivy output.
type trivyTargetResult struct {
	Target          string           `json:"Target"`
	Vulnerabilities []trivyVulnEntry `json:"Vulnerabilities"`
}

// trivyVulnEntry represents a single vulnerability entry from Trivy.
type trivyVulnEntry struct {
	VulnerabilityID  string `json:"VulnerabilityID"`
	PkgName          string `json:"PkgName"`
	InstalledVersion string `json:"InstalledVersion"`
	FixedVersion     string `json:"FixedVersion"`
	Title            string `json:"Title"`
	Description      string `json:"Description"`
	Severity         string `json:"Severity"`
}

// severityMap maps Trivy severity strings to the internal model.
var severityMap = map[string]models.VulnerabilitySeverity{
	"CRITICAL": models.VulnerabilitySeverityCritical,
	"HIGH":     models.VulnerabilitySeverityHigh,
	"MEDIUM":   models.VulnerabilitySeverityMedium,
	"LOW":      models.VulnerabilitySeverityLow,
	"INFO":     models.VulnerabilitySeverityInfo,
}

// mapSeverity converts a Trivy severity string (e.g. "CRITICAL") to the internal model.
func mapSeverity(s string) models.VulnerabilitySeverity {
	if v, ok := severityMap[strings.ToUpper(s)]; ok {
		return v
	}
	return models.VulnerabilitySeverityInfo
}

// detectPackageManager attempts to infer the package manager from the project path.
// It checks for common lockfiles in the given directory.
func detectPackageManager(projectPath string) string {
	// In a real CI runner we would check for go.sum, package-lock.json, etc.
	// For now, detect by extension or common file presence.
	parts := strings.Split(projectPath, "/")
	if len(parts) > 0 {
		last := strings.ToLower(parts[len(parts)-1])
		if strings.Contains(last, "go") {
			return "go"
		}
		if strings.Contains(last, "npm") || strings.Contains(last, "node") || strings.Contains(last, "js") {
			return "npm"
		}
		if strings.Contains(last, "python") || strings.Contains(last, "py") || strings.Contains(last, "pip") {
			return "pip"
		}
	}
	return "unknown"
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
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
	if !errors.Is(err, sentinel.NotFound) {
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
		if errors.Is(err, sentinel.NotFound) {
			return nil, sentinel.NotFound
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
// It invokes the Trivy filesystem scanner, parses the JSON output, persists discovered
// vulnerabilities to the repository, and returns a ScanResult summary.
func (s *Service) ScanDependencies(ctx context.Context, tenantID, projectPath string) (*models.ScanResult, error) {
	if projectPath == "" {
		projectPath = "."
	}

	// Check if trivy is available
	trivyPath, err := exec.LookPath("trivy")
	if err != nil {
		return nil, fmt.Errorf("%w: cannot locate trivy binary", ErrTrivyNotInstalled)
	}

	// Execute: trivy filesystem --format json --severity CRITICAL,HIGH <projectPath>
	cmd := exec.CommandContext(ctx, trivyPath, "filesystem",
		"--format", "json",
		"--severity", "CRITICAL,HIGH",
		projectPath,
	)
	output, err := cmd.Output()
	if err != nil {
		// If there is stderr or exit code, include it for debugging
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			return nil, fmt.Errorf("%w: %s: %s", ErrTrivyScanFailed, strings.TrimSpace(string(exitErr.Stderr)), strings.TrimSpace(string(output)))
		}
		return nil, fmt.Errorf("%w: %v", ErrTrivyScanFailed, err)
	}

	// Parse Trivy JSON output
	var trivyOut trivyResult
	if err := json.Unmarshal(output, &trivyOut); err != nil {
		return nil, fmt.Errorf("failed to parse trivy JSON output: %w", err)
	}

	// Collect unique vulnerabilities to persist
	seen := make(map[string]bool) // key = "cveID:packageName"
	var createReqs []models.CreateVulnerabilityRequest
	totalDeps := 0

	for _, target := range trivyOut.Results {
		for _, tv := range target.Vulnerabilities {
			key := tv.VulnerabilityID + ":" + tv.PkgName
			if seen[key] {
				continue
			}
			seen[key] = true

			description := tv.Description
			if description == "" {
				description = tv.Title
			}

			createReqs = append(createReqs, models.CreateVulnerabilityRequest{
				CVEID:          tv.VulnerabilityID,
				PackageName:    tv.PkgName,
				PackageVersion: tv.InstalledVersion,
				Severity:       mapSeverity(tv.Severity),
				Description:    description,
				FixVersion:     tv.FixedVersion,
			})
		}
		// Each target is one lockfile / dependency manifest
		if len(target.Vulnerabilities) > 0 || target.Target != "" {
			totalDeps++
		}
	}

	// Persist discovered vulnerabilities to the repository
	persisted, err := s.repo.BatchCreate(ctx, tenantID, createReqs)
	if err != nil {
		return nil, fmt.Errorf("failed to persist scan results: %w", err)
	}

	// Build the response models
	vulnModels := make([]models.Vulnerability, len(persisted))
	for i, v := range persisted {
		vulnModels[i] = v
	}

	packageManager := detectPackageManager(projectPath)

	scanID := fmt.Sprintf("scan-%s-%d", uuid.New().String(), time.Now().UnixMilli())

	return &models.ScanResult{
		ScanID:               scanID,
		PackageManager:       packageManager,
		TotalDependencies:    totalDeps,
		VulnerabilitiesFound: len(vulnModels),
		Vulnerabilities:      vulnModels,
		ScannedAt:            time.Now().UTC(),
		Tool:                 "trivy",
	}, nil
}

// ScanImage scans a Docker image for vulnerabilities using Trivy.
// It parses the JSON output and persists discovered vulnerabilities.
func (s *Service) ScanImage(ctx context.Context, tenantID, imagePath string) (*models.ScanResult, error) {
	if imagePath == "" {
		return nil, ErrInvalidInput
	}

	trivyPath, err := exec.LookPath("trivy")
	if err != nil {
		return nil, fmt.Errorf("%w: cannot locate trivy binary", ErrTrivyNotInstalled)
	}

	// Execute: trivy image --format json --severity CRITICAL,HIGH <image>
	cmd := exec.CommandContext(ctx, trivyPath, "image",
		"--format", "json",
		"--severity", "CRITICAL,HIGH",
		imagePath,
	)
	output, err := cmd.Output()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			return nil, fmt.Errorf("%w: %s: %s", ErrTrivyScanFailed, strings.TrimSpace(string(exitErr.Stderr)), strings.TrimSpace(string(output)))
		}
		return nil, fmt.Errorf("%w: %v", ErrTrivyScanFailed, err)
	}

	var trivyOut trivyResult
	if err := json.Unmarshal(output, &trivyOut); err != nil {
		return nil, fmt.Errorf("failed to parse trivy JSON output: %w", err)
	}

	seen := make(map[string]bool)
	var createReqs []models.CreateVulnerabilityRequest

	for _, target := range trivyOut.Results {
		for _, tv := range target.Vulnerabilities {
			key := tv.VulnerabilityID + ":" + tv.PkgName
			if seen[key] {
				continue
			}
			seen[key] = true
			description := tv.Description
			if description == "" {
				description = tv.Title
			}
			createReqs = append(createReqs, models.CreateVulnerabilityRequest{
				CVEID:          tv.VulnerabilityID,
				PackageName:    tv.PkgName,
				PackageVersion: tv.InstalledVersion,
				Severity:       mapSeverity(tv.Severity),
				Description:    description,
				FixVersion:     tv.FixedVersion,
			})
		}
	}

	persisted, err := s.repo.BatchCreate(ctx, tenantID, createReqs)
	if err != nil {
		return nil, fmt.Errorf("failed to persist scan results: %w", err)
	}

	vulnModels := make([]models.Vulnerability, len(persisted))
	for i, v := range persisted {
		vulnModels[i] = v
	}

	scanID := fmt.Sprintf("scan-img-%s-%d", uuid.New().String(), time.Now().UnixMilli())
	return &models.ScanResult{
		ScanID:               scanID,
		PackageManager:       "docker",
		TotalDependencies:    len(trivyOut.Results),
		VulnerabilitiesFound: len(vulnModels),
		Vulnerabilities:      vulnModels,
		ScannedAt:            time.Now().UTC(),
		Tool:                 "trivy",
	}, nil
}
