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
	ListArtifactIDs(ctx context.Context, tenantID string) ([]string, error)
	ListOperationsByArtifact(ctx context.Context, tenantID, artifactID string, limit, offset int) ([]models.ArtifactOperation, error)
	ListPolicies(ctx context.Context, tenantID string) ([]models.RetentionPolicy, error)
	DeleteOperationsByArtifact(ctx context.Context, tenantID, artifactID string) (int64, error)
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

// DetectMalicious reports whether the artifact has been flagged as malicious
// by a scan the tenant already ran. The verdict comes from the status the
// scanner recorded in artifact_scan_reports: clean, warning or malicious.
//
// With no scan report on record there is no evidence either way, so Checked
// is false and callers must not read the false Malicious as a clean bill of
// health. req.Hash is bound but unused: no threat-intelligence or
// hash-allowlist table exists in this service, and pretending to look one up
// would answer "clean" for every artifact ever hashed.
func (s *Service) DetectMalicious(ctx context.Context, tenantID string, req models.DetectMaliciousRequest) (*models.DetectMaliciousResult, error) {
	reports, err := s.repo.GetScanReportsByArtifact(ctx, tenantID, req.ArtifactID)
	if err != nil {
		return nil, fmt.Errorf("read scan reports: %w", err)
	}
	if len(reports) == 0 {
		return &models.DetectMaliciousResult{
			Malicious:  false,
			Checked:    false,
			Reason:     "no scan reports on record for this artifact — verdict unknown",
			ArtifactID: req.ArtifactID,
		}, nil
	}

	malicious := 0
	for _, r := range reports {
		if strings.EqualFold(strings.TrimSpace(r.Status), "malicious") {
			malicious++
		}
	}
	res := &models.DetectMaliciousResult{
		Malicious:      malicious > 0,
		Checked:        true,
		ReportsChecked: len(reports),
		ArtifactID:     req.ArtifactID,
	}
	if malicious > 0 {
		res.Reason = fmt.Sprintf("%d of %d scan reports flag status=malicious", malicious, len(reports))
	} else {
		res.Reason = fmt.Sprintf("no malicious scan report among %d reports on record", len(reports))
	}
	return res, nil
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
	p, err := s.loadRule(ctx, tenantID, req.PolicyID)
	if err != nil {
		return nil, err
	}
	result := &models.EvaluateRetentionResult{
		PolicyID:   p.policy.ID,
		ArtifactID: req.ArtifactID,
	}
	expired, reason, err := s.evaluateArtifactRetention(ctx, tenantID, req.ArtifactID, p.rule)
	if err != nil {
		return nil, err
	}
	result.Expired = expired
	result.Reason = reason
	return result, nil
}

// parsedPolicy pairs a retention policy with its rule decoded from the JSON
// blob. Decoding is done once at load time so the evaluation paths share a
// single definition of what a rule means.
type parsedPolicy struct {
	policy *models.RetentionPolicy
	rule   retentionRule
}

// loadRule fetches one policy by ID and parses its rule JSON. Only an enabled
// policy addressed explicitly by ID is accepted; GetRetentionReport falls back
// to enabledRules when the caller did not name one.
func (s *Service) loadRule(ctx context.Context, tenantID, policyID string) (parsedPolicy, error) {
	pol, err := s.repo.GetPolicyByID(ctx, tenantID, policyID)
	if err != nil {
		return parsedPolicy{}, errors.New("retention policy not found")
	}
	if !pol.Enabled {
		return parsedPolicy{}, errors.New("retention policy is not enabled")
	}
	var rule retentionRule
	if err := json.Unmarshal([]byte(pol.Rule), &rule); err != nil {
		return parsedPolicy{}, errors.New("retention policy rule is not valid JSON")
	}
	return parsedPolicy{policy: pol, rule: rule}, nil
}

// enabledRules returns every enabled policy of the tenant with its rule
// parsed. A rule that is not valid JSON is a configuration error and is
// returned as one rather than skipped: silently dropping it would let a
// mistyped rule switch enforcement off.
func (s *Service) enabledRules(ctx context.Context, tenantID string) ([]parsedPolicy, error) {
	policies, err := s.repo.ListPolicies(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list retention policies: %w", err)
	}
	var out []parsedPolicy
	for i := range policies {
		if !policies[i].Enabled {
			continue
		}
		var rule retentionRule
		if err := json.Unmarshal([]byte(policies[i].Rule), &rule); err != nil {
			return nil, fmt.Errorf("retention policy %q rule is not valid JSON", policies[i].ID)
		}
		out = append(out, parsedPolicy{policy: &policies[i], rule: rule})
	}
	return out, nil
}

// evaluateArtifactRetention decides whether one artifact is outside its
// retention window under rule, returning the verdict and a human-readable
// reason. EvaluateRetention calls it for a single artifact and
// GetRetentionReport / Cleanup call it for every artifact of a tenant, so the
// two endpoints cannot drift apart in what "expired" means.
func (s *Service) evaluateArtifactRetention(ctx context.Context, tenantID, artifactID string, rule retentionRule) (bool, string, error) {
	if artifactID == "" {
		// Nothing to evaluate against; not expired rather than an error.
		return false, "no artifact specified", nil
	}

	var expired bool
	var reasons []string

	// Evaluate maxAgeDays: the artifact's age is the elapsed time since its
	// first recorded operation in artifact_operations.
	if rule.MaxAgeDays > 0 {
		// MIN without GROUP BY always returns one row, and for an artifact
		// with no operation it is NULL. Scanning that into a time.Time
		// errors instead of yielding the zero time, which is why the nil
		// check here is against a pointer rather than IsZero.
		var minCreatedAt *time.Time
		if err := s.db.GetContext(ctx, &minCreatedAt,
			`SELECT MIN(created_at) FROM artifact_operations
			   WHERE tenant_id=$1 AND artifact_id=$2`,
			tenantID, artifactID); err != nil {
			return false, "", fmt.Errorf("read artifact creation date: %w", err)
		}
		if minCreatedAt == nil {
			// No operation recorded, so the artifact's age is unknown and
			// expiration on age cannot be asserted.
			return false, "no operations recorded for artifact", nil
		}
		age := time.Since(*minCreatedAt)
		if age > time.Duration(rule.MaxAgeDays)*24*time.Hour {
			expired = true
			reasons = append(reasons, fmt.Sprintf("age %.1f days exceeds max %d days", age.Hours()/24, rule.MaxAgeDays))
		}
	}

	// Evaluate maxCount: total number of operations recorded for the artifact.
	if rule.MaxCount > 0 {
		var count int
		if err := s.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM artifact_operations
			   WHERE tenant_id=$1 AND artifact_id=$2`,
			tenantID, artifactID); err != nil {
			return false, "", fmt.Errorf("read operation count: %w", err)
		}
		if count > rule.MaxCount {
			expired = true
			reasons = append(reasons, fmt.Sprintf("operation count %d exceeds max %d", count, rule.MaxCount))
		}
	}

	if expired {
		return true, strings.Join(reasons, "; "), nil
	}
	return false, "artifact within retention window", nil
}

// GetRetentionReport counts how many of the tenant's artifacts fall outside
// their retention window. With a PolicyID the artifacts are judged against that
// one policy; without it, against every enabled policy, and an artifact counts
// as expired when any of them expires it. TotalChecked == Expired + Active.
func (s *Service) GetRetentionReport(ctx context.Context, tenantID string, req models.RetentionReportRequest) (*models.RetentionReport, error) {
	var rules []parsedPolicy
	if req.PolicyID != "" {
		p, err := s.loadRule(ctx, tenantID, req.PolicyID)
		if err != nil {
			return nil, err
		}
		rules = []parsedPolicy{p}
	} else {
		var err error
		rules, err = s.enabledRules(ctx, tenantID)
		if err != nil {
			return nil, err
		}
	}

	if len(rules) == 0 {
		// Nothing to judge the artifacts against, so nothing is checked.
		// Returning TotalChecked 0 keeps TotalChecked == Expired + Active
		// true; the alternative would report artifacts as checked with no
		// verdict recorded for any of them.
		return &models.RetentionReport{
			PolicyID:         req.PolicyID,
			PoliciesApplied:  0,
			TotalChecked:     0,
			ExpiredArtifacts: []string{},
			Message:          "no enabled retention policy — nothing evaluated",
		}, nil
	}

	ids, err := s.repo.ListArtifactIDs(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list artifacts: %w", err)
	}

	report := &models.RetentionReport{
		PolicyID:         req.PolicyID,
		PoliciesApplied:  len(rules),
		TotalChecked:     len(ids),
		ExpiredArtifacts: []string{},
	}

	for _, id := range ids {
		expired, err := s.anyRuleExpires(ctx, tenantID, id, rules)
		if err != nil {
			return nil, err
		}
		if expired {
			report.Expired++
			report.ExpiredArtifacts = append(report.ExpiredArtifacts, id)
		} else {
			report.Active++
		}
	}
	return report, nil
}

// anyRuleExpires reports whether any of rules expires artifactID. Judging one
// artifact against several enabled policies must be fail-closed: one policy
// expiring it is enough.
func (s *Service) anyRuleExpires(ctx context.Context, tenantID, artifactID string, rules []parsedPolicy) (bool, error) {
	for _, p := range rules {
		expired, _, err := s.evaluateArtifactRetention(ctx, tenantID, artifactID, p.rule)
		if err != nil {
			return false, err
		}
		if expired {
			return true, nil
		}
	}
	return false, nil
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

// Cleanup removes the operation records of artifacts that have expired under an
// enabled retention policy. The threshold is never a fixed constant: it is the
// age and count limits the tenant actually configured, and no rows are touched
// when no enabled policy exists. deleted reports RowsAffected so the number in
// the response is what the database says it removed, not an assumption.
func (s *Service) Cleanup(ctx context.Context, tenantID string) (map[string]any, error) {
	rules, err := s.enabledRules(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if len(rules) == 0 {
		return map[string]any{
			"message":          "no enabled retention policy — nothing eligible for cleanup",
			"deleted":          int64(0),
			"policies_checked": 0,
			"artifacts":        []string{},
		}, nil
	}

	ids, err := s.repo.ListArtifactIDs(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list artifacts: %w", err)
	}

	var deleted int64
	removed := []string{}
	for _, id := range ids {
		expired, err := s.anyRuleExpires(ctx, tenantID, id, rules)
		if err != nil {
			return nil, err
		}
		if !expired {
			continue
		}
		n, err := s.repo.DeleteOperationsByArtifact(ctx, tenantID, id)
		if err != nil {
			return nil, fmt.Errorf("delete operation records for %s: %w", id, err)
		}
		deleted += n
		removed = append(removed, id)
	}
	return map[string]any{
		"message":          fmt.Sprintf("removed operation records for %d retention-expired artifact(s)", len(removed)),
		"deleted":          deleted,
		"policies_checked": len(rules),
		"artifacts":        removed,
	}, nil
}
