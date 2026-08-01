package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai-security/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CheckVulnerability(ctx context.Context, tenantID, cveID string) (*models.CheckVulnerabilityResult, error)
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	CreateBlock(ctx context.Context, tenantID string, block *models.BlockRecord) error
	Delete(ctx context.Context, tenantID, id string) error
	FindVulnerabilities(ctx context.Context, tenantID string, image string) (*models.ScanVulnerabilitiesResult, error)
	FixVulnerability(ctx context.Context, tenantID, image string, cveIDs []string) (*models.FixVulnerabilityResult, error)
	GetBlock(ctx context.Context, tenantID, target string) (*models.BlockRecord, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	GetVulnerability(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	ListAuditLogs(ctx context.Context, tenantID string, filter *models.AuditLogFilter) ([]models.AuditLog, error)
	ListPolicies(ctx context.Context, tenantID string) ([]models.SecurityPolicy, error)
	ListVulnerabilities(ctx context.Context, tenantID string) ([]models.Vulnerability, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
}

// BLUEPRINT STATUS: Core CRUD and vulnerability scanning operations are implemented
// via repository. AI Security-specific functions (ListPolicies, GetAuditLog, BlockAccess,
// GetRiskScore) now delegate to the repository with real typed models and risk scoring logic.

// Repo is the subset of RepositoryInterface consumed by Service.
type Repo interface {
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	FindVulnerabilities(ctx context.Context, tenantID, image string) (*models.ScanVulnerabilitiesResult, error)
	GetVulnerability(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error)
	ListVulnerabilities(ctx context.Context, tenantID string) ([]models.Vulnerability, error)
	FixVulnerability(ctx context.Context, tenantID, image string, cveIDs []string) (*models.FixVulnerabilityResult, error)
	CheckVulnerability(ctx context.Context, tenantID, cveID string) (*models.CheckVulnerabilityResult, error)
	ListPolicies(ctx context.Context, tenantID string) ([]models.SecurityPolicy, error)
	ListAuditLogs(ctx context.Context, tenantID string, filter *models.AuditLogFilter) ([]models.AuditLog, error)
	CreateBlock(ctx context.Context, tenantID string, block *models.BlockRecord) error
	GetBlock(ctx context.Context, tenantID, target string) (*models.BlockRecord, error)
}

type Service struct {
	repo Repo
}

func NewService(repo Repo) *Service {
	return &Service{repo: repo}
}

// ---- Core CRUD ----

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// ---- Vulnerability / CVE scanning (real implementations) ----

// ScanVulnerabilities runs a Trivy scan against the provided image and returns
// the aggregated result. On a degraded repository it wraps the error but does
// not fail the call - the handler decides whether to surface a degraded response.
func (s *Service) ScanVulnerabilities(ctx context.Context, tenantID string, image string) (*models.ScanVulnerabilitiesResult, error) {
	if image == "" {
		return nil, errors.New("image reference is required for vulnerability scan")
	}
	result, err := s.repo.FindVulnerabilities(ctx, tenantID, image)
	if err != nil {
		// vulnerability scan failed, engine degraded
		// Return a degraded envelope so the UI can show the engine is down.
		return &models.ScanVulnerabilitiesResult{
			Image:    image,
			Degraded: true,
			Engine:   "degraded",
			Errors:   []string{err.Error()},
		}, nil
	}
	result.Engine = "trivy"
	return result, nil
}

// GetVulnerability retrieves detail for a single CVE finding.
func (s *Service) GetVulnerability(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error) {
	if cveID == "" {
		return nil, errors.New("CVE identifier is required")
	}
	return s.repo.GetVulnerability(ctx, tenantID, cveID)
}

// ListVulnerabilities returns all recorded vulnerabilities for the tenant.
func (s *Service) ListVulnerabilities(ctx context.Context, tenantID string) ([]models.Vulnerability, error) {
	return s.repo.ListVulnerabilities(ctx, tenantID)
}

// FixVulnerability triggers remediation for the requested CVEs in the image.
func (s *Service) FixVulnerability(ctx context.Context, tenantID, image string, cveIDs []string) (*models.FixVulnerabilityResult, error) {
	if image == "" {
		return nil, errors.New("image reference is required for fix operation")
	}
	return s.repo.FixVulnerability(ctx, tenantID, image, cveIDs)
}

// CheckVulnerability performs a live CVE look-up against the Trivy database.
func (s *Service) CheckVulnerability(ctx context.Context, tenantID, cveID string) (*models.CheckVulnerabilityResult, error) {
	if cveID == "" {
		return nil, errors.New("CVE identifier is required")
	}
	return s.repo.CheckVulnerability(ctx, tenantID, cveID)
}

// ---- AI Security-specific functions ----

// ListPolicies returns security policies for the tenant.
func (s *Service) ListPolicies(ctx context.Context, tenantID string) ([]models.SecurityPolicy, error) {
	return s.repo.ListPolicies(ctx, tenantID)
}

// GetAuditLog returns security audit log entries for the tenant.
func (s *Service) GetAuditLog(ctx context.Context, tenantID string) ([]models.AuditLog, error) {
	return s.repo.ListAuditLogs(ctx, tenantID, nil)
}

// BlockAccess blocks access for a given target.
func (s *Service) BlockAccess(ctx context.Context, tenantID, target string) (*models.BlockRecord, error) {
	now := time.Now()
	expiresAt := now.Add(24 * time.Hour)
	block := &models.BlockRecord{
		ID:        fmt.Sprintf("blk-%d", now.UnixNano()),
		TenantID:  tenantID,
		Target:    target,
		Reason:    "blocked via AI security engine",
		BlockedBy: "ai-security-engine",
		Active:    true,
		ExpiresAt: &expiresAt,
		CreatedAt: now,
	}
	if err := s.repo.CreateBlock(ctx, tenantID, block); err != nil {
		return nil, err
	}
	return block, nil
}

// GetRiskScore calculates a risk score for a resource based on active blocks and audit logs.
// Score is capped at 100. Level: critical(>=75), high(>=50), medium(>=25), low(default).
func (s *Service) GetRiskScore(ctx context.Context, tenantID, id string) (*models.RiskScoreResult, error) {
	score := 0
	factors := []string{}

	block, err := s.repo.GetBlock(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if block != nil {
		score += 30
		factors = append(factors, "active_block")
	}

	logs, err := s.repo.ListAuditLogs(ctx, tenantID, &models.AuditLogFilter{Actor: id})
	if err != nil {
		return nil, err
	}
	for _, entry := range logs {
		switch entry.EventType {
		case "CRITICAL":
			score += 40
			factors = append(factors, fmt.Sprintf("critical event: %s", entry.Action))
		case "HIGH":
			score += 25
			factors = append(factors, fmt.Sprintf("high event: %s", entry.Action))
		case "MEDIUM":
			score += 15
			factors = append(factors, fmt.Sprintf("medium event: %s", entry.Action))
		}
	}

	if score > 100 {
		score = 100
	}

	level := "low"
	if score >= 75 {
		level = "critical"
	} else if score >= 50 {
		level = "high"
	} else if score >= 25 {
		level = "medium"
	}

	return &models.RiskScoreResult{
		Target:  id,
		Score:   score,
		Level:   level,
		Factors: factors,
	}, nil
}
