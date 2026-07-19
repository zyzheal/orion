package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/ai-security/models"

	"github.com/gin-gonic/gin"
)

// BLUEPRINT STATUS: Core CRUD operations are implemented via repository.
// Vulnerability scanning (ScanVulnerabilities, CheckVulnerability) is a
// service-layer orchestrator over the repository's FindVulnerabilities /
// CheckVulnerability calls, with structured error handling and degraded-mode
// responses. Security-specific functions (ListPolicies, BlockAccess, GetRiskScore)
// are stubs awaiting the AI security engine (prompt injection / PII / content safety).

// Repo is the subset of repository.Repository consumed by Service.
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

// ---- AI Security-specific functions (placeholder - requires AI security engine integration) ----

// ListPolicies returns security policies for the tenant.
// TODO: Implement with actual policy storage and evaluation engine.
func (s *Service) ListPolicies(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

// GetAuditLog returns security audit log entries.
// TODO: Implement with actual audit log storage and query.
func (s *Service) GetAuditLog(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

// BlockAccess blocks access for a given target.
// TODO: Implement with actual access control integration.
func (s *Service) BlockAccess(ctx context.Context, tenantID, target string) (gin.H, error) {
	return gin.H{"message": "access blocked (placeholder)", "target": target}, nil
}

// GetRiskScore returns the risk score for a resource.
// TODO: Implement with actual risk scoring engine (prompt injection, PII, content safety).
func (s *Service) GetRiskScore(ctx context.Context, tenantID, id string) (gin.H, error) {
	return gin.H{"score": 0, "id": id, "status": "placeholder"}, nil
}
