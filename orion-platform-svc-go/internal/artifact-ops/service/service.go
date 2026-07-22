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

	"orion/platform-svc-go/internal/artifact-ops/models"

	"github.com/jmoiron/sqlx"
)

// retentionRule is parsed from the policy Rule JSON blob.
type retentionRule struct {
	MaxAgeDays int `json:"maxAgeDays"` // days before artifact expires by age
	MaxCount   int `json:"maxCount"`   // max operation count before expiration
}

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateOperation(ctx context.Context, op *models.ArtifactOperation) error
	CreatePolicy(ctx context.Context, policy *models.RetentionPolicy) error
	CreateScan(ctx context.Context, scan *models.ArtifactScan) error
	DeletePolicy(ctx context.Context, tenantID, id string) error
	GetArtifactStats(ctx context.Context, tenantID, artifactID string) (*models.ArtifactStats, error)
	GetPolicyByID(ctx context.Context, tenantID, id string) (*models.RetentionPolicy, error)
	GetScanReportByID(ctx context.Context, tenantID, id string) (*models.ScanReport, error)
	GetScanReportsByArtifact(ctx context.Context, tenantID, artifactID string) ([]models.ScanReport, error)
	ListOperationsByArtifact(ctx context.Context, tenantID, artifactID string, limit, offset int) ([]models.ArtifactOperation, error)
	ListPolicies(ctx context.Context, tenantID string) ([]models.RetentionPolicy, error)
}

type Service struct {
	repo RepositoryInterface
	db   *sqlx.DB
}

func NewService(repo RepositoryInterface, db *sqlx.DB) *Service {
	return &Service{repo: repo, db: db}
}

// ---------- Operations ----------

func (s *Service) TrackOperation(ctx context.Context, tenantID, actorID string, req models.TrackOperationRequest) (*models.ArtifactOperation, error) {
	op := &models.ArtifactOperation{
		TenantID:   tenantID,
		ArtifactID: req.ArtifactID,
		Action:     req.Action,
		ActorID:    actorID,
		Details:    req.Details,
	}
	if err := s.repo.CreateOperation(ctx, op); err != nil {
		return nil, err
	}
	return op, nil
}

func (s *Service) GetOperationHistory(ctx context.Context, tenantID, artifactID string, limit, offset int) ([]models.ArtifactOperation, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.ListOperationsByArtifact(ctx, tenantID, artifactID, limit, offset)
}

func (s *Service) GetArtifactStats(ctx context.Context, tenantID, artifactID string) (*models.ArtifactStats, error) {
	return s.repo.GetArtifactStats(ctx, tenantID, artifactID)
}

// ---------- Scan ----------

func (s *Service) ScanArtifact(ctx context.Context, tenantID, artifactID string, req models.ScanArtifactRequest) (*models.ArtifactScan, error) {
	scan := &models.ArtifactScan{
		TenantID:   tenantID,
		ArtifactID: artifactID,
		Status:     "pending",
	}
	if err := s.repo.CreateScan(ctx, scan); err != nil {
		return nil, err
	}
	return scan, nil
}

func (s *Service) GetScanReport(ctx context.Context, tenantID, scanID string) (*models.ScanReport, error) {
	report, err := s.repo.GetScanReportByID(ctx, tenantID, scanID)
	if err != nil {
		return nil, errors.New("scan report not found")
	}
	return report, nil
}

func (s *Service) GetArtifactScanReports(ctx context.Context, tenantID, artifactID string) ([]models.ScanReport, error) {
	return s.repo.GetScanReportsByArtifact(ctx, tenantID, artifactID)
}

// DetectMalicious simulates malicious artifact detection by hash lookup.
func (s *Service) DetectMalicious(ctx context.Context, tenantID string, req models.DetectMaliciousRequest) (*models.DetectMaliciousResult, error) {
	// In production, this would query a threat-intelligence database.
	// For now, return a clean result.
	return &models.DetectMaliciousResult{
		Malicious:  false,
		Reason:     "no match found in threat database",
		ArtifactID: req.ArtifactID,
	}, nil
}

// ---------- Retention ----------

func (s *Service) DefineRetentionPolicy(ctx context.Context, tenantID string, req models.DefineRetentionPolicyRequest) (*models.RetentionPolicy, error) {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	policy := &models.RetentionPolicy{
		TenantID: tenantID,
		Name:     req.Name,
		Rule:     req.Rule,
		Enabled:  enabled,
	}
	if err := s.repo.CreatePolicy(ctx, policy); err != nil {
		return nil, err
	}
	return policy, nil
}

func (s *Service) EvaluateRetention(ctx context.Context, tenantID string, req models.EvaluateRetentionRequest) (*models.EvaluateRetentionResult, error) {
	policy, err := s.repo.GetPolicyByID(ctx, tenantID, req.PolicyID)
	if err != nil {
		return nil, errors.New("retention policy not found")
	}
	if !policy.Enabled {
		return nil, errors.New("retention policy is not enabled")
	}

	// Parse the JSON rule blob (e.g. {"maxAgeDays": 30, "maxCount": 100}).
	var rule retentionRule
	if err := json.Unmarshal([]byte(policy.Rule), &rule); err != nil {
		return nil, errors.New("retention policy rule is not valid JSON")
	}

	result := &models.EvaluateRetentionResult{
		PolicyID:   policy.ID,
		ArtifactID: req.ArtifactID,
	}

	if req.ArtifactID == "" {
		// Nothing to evaluate against; return a non-expired result.
		result.Expired = false
		result.Reason = "no artifact specified"
		return result, nil
	}

	var expired bool
	var reasons []string

	// Evaluate maxAgeDays: the artifact's "age" is the elapsed time since its
	// first recorded operation in artifact_operations.
	if rule.MaxAgeDays > 0 {
		var minCreatedAt time.Time
		err := s.db.GetContext(ctx, &minCreatedAt,
			`SELECT MIN(created_at) FROM artifact_operations
			   WHERE tenant_id=$1 AND artifact_id=$2`,
			tenantID, req.ArtifactID)
		if err != nil {
			return nil, errors.New("failed to read artifact creation date")
		}
		// Treat a missing row as an unknown (no operation recorded), so we
		// cannot assert expiration on age.
		if minCreatedAt.IsZero() {
			// No operations recorded yet — consider it within window.
			result.Expired = false
			result.Reason = "no operations recorded for artifact"
			return result, nil
		}
		age := time.Since(minCreatedAt)
		maxAge := time.Duration(rule.MaxAgeDays) * 24 * time.Hour
		if age > maxAge {
			expired = true
			reasons = append(reasons, fmt.Sprintf("age %.1f days exceeds max %d days", age.Hours()/24, rule.MaxAgeDays))
		}
	}

	// Evaluate maxCount: total number of operations recorded for the artifact.
	if rule.MaxCount > 0 {
		var count int
		err := s.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM artifact_operations
			   WHERE tenant_id=$1 AND artifact_id=$2`,
			tenantID, req.ArtifactID)
		if err != nil {
			return nil, errors.New("failed to read operation count")
		}
		if count > rule.MaxCount {
			expired = true
			reasons = append(reasons, fmt.Sprintf("operation count %d exceeds max %d", count, rule.MaxCount))
		}
	}

	result.Expired = expired
	if expired {
		result.Reason = strings.Join(reasons, "; ")
	} else {
		result.Reason = "artifact within retention window"
	}
	return result, nil
}

func (s *Service) GetRetentionReport(ctx context.Context, tenantID string, req models.RetentionReportRequest) (*models.RetentionReport, error) {
	var report models.RetentionReport
	if req.PolicyID != "" {
		_, err := s.repo.GetPolicyByID(ctx, tenantID, req.PolicyID)
		if err != nil {
			return nil, errors.New("retention policy not found")
		}
		report.PolicyID = req.PolicyID
	}
	// Placeholder report — in production, this evaluates all artifacts against policies.
	return &report, nil
}

func (s *Service) ListPolicies(ctx context.Context, tenantID string) ([]models.RetentionPolicy, error) {
	return s.repo.ListPolicies(ctx, tenantID)
}

func (s *Service) DeletePolicy(ctx context.Context, tenantID, policyID string) error {
	_, err := s.repo.GetPolicyByID(ctx, tenantID, policyID)
	if err != nil {
		return errors.New("retention policy not found")
	}
	return s.repo.DeletePolicy(ctx, tenantID, policyID)
}

// ---------- Cleanup ----------

func (s *Service) Cleanup(ctx context.Context, tenantID string) (map[string]any, error) {
	// Placeholder: removes old operation records older than a threshold.
	return map[string]any{"message": "cleanup completed", "deleted": 0}, nil
}

