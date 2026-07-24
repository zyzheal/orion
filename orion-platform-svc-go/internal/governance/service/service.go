package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"fmt"

	"errors"
	"math"
	"math/rand"
	"time"

	"orion/platform-svc-go/internal/governance/models"
	"orion/platform-svc-go/internal/governance/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateAuditLog(ctx context.Context, policyID string, req *repository.AuditLogCreateReq) (*models.GovernanceAuditLog, error)
	CreatePolicy(ctx context.Context, req *models.CreatePolicyRequest, tenantID, createdBy string) (*models.GovernancePolicy, error)
	DeletePolicy(ctx context.Context, id, tenantID string) error
	GetAuditLogs(ctx context.Context, policyID string, offset, limit int) ([]models.GovernanceAuditLog, int, error)
	GetPolicy(ctx context.Context, id, tenantID string) (*models.GovernancePolicy, error)
	GetPolicyStats(ctx context.Context, tenantID string) (*repository.PolicyStats, error)
	IncrementApplyCount(ctx context.Context, id, tenantID string) error
	IncrementViolationCount(ctx context.Context, id, tenantID string) error
	ListPoliciesPaginated(ctx context.Context, tenantID string, q *models.PolicyListQuery, offset, limit int) ([]models.GovernancePolicy, int, error)
	ListRules(ctx context.Context, tenantID string, offset, limit int) ([]models.PolicyRule, int, error)
	UpdatePolicy(ctx context.Context, id, tenantID string, updates map[string]interface{}) (*models.GovernancePolicy, error)
	UpdatePolicyStatus(ctx context.Context, id, tenantID, status string) (*models.GovernancePolicy, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

var (

	ErrNotFound = sentinel.NotFound
	ErrPolicyNotActive = errors.New("policy must be active to apply")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)
}

// ---- Policies ----

func (s *Service) CreatePolicy(ctx context.Context, req *models.CreatePolicyRequest, tenantID, userID string) (*models.GovernancePolicy, error) {
	p, err := s.repo.CreatePolicy(ctx, req, tenantID, userID)
	if err != nil {
		return nil, err
	}
	// Audit: create
	s.repo.CreateAuditLog(ctx, p.ID, &repository.AuditLogCreateReq{
		Action:       "create",
		ResourceType: "policy",
		ResourceID:   p.ID,
		UserID:       userID,
		Details:      map[string]interface{}{"name": req.Name, "type": req.Type},
		Outcome:      "success",
		Severity:     models.SeverityLow,
	})
	return p, nil
}

func (s *Service) GetPolicy(ctx context.Context, id, tenantID string) (*models.GovernancePolicy, error) {
	p, err := s.repo.GetPolicy(ctx, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return p, nil
}

func (s *Service) ListPolicies(ctx context.Context, tenantID string, q *models.PolicyListQuery, offset, limit int) ([]models.GovernancePolicy, int, error) {
	return s.repo.ListPoliciesPaginated(ctx, tenantID, q, offset, limit)
}

func (s *Service) UpdatePolicy(ctx context.Context, id, tenantID string, req *models.UpdatePolicyRequest, userID string) (*models.GovernancePolicy, error) {
	existing, err := s.repo.GetPolicy(ctx, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.Enforcement != nil {
		updates["enforcement"] = *req.Enforcement
	}
	if req.Metadata != nil {
		metadataJSON, _ := json.Marshal(req.Metadata)
		updates["metadata"] = string(metadataJSON)
	}
	if req.Rules != nil {
		rulesJSON, _ := json.Marshal(req.Rules)
		updates["rules"] = string(rulesJSON)
	}
	if req.Scope != nil {
		scopeJSON, _ := json.Marshal(req.Scope)
		updates["scope"] = string(scopeJSON)
	}

	if len(updates) == 0 {
		return existing, nil
	}

	p, err := s.repo.UpdatePolicy(ctx, id, tenantID, updates)
	if err != nil {
		return nil, sentinel.NotFound
	}
	// Audit: update
	s.repo.CreateAuditLog(ctx, id, &repository.AuditLogCreateReq{
		Action:       "update",
		ResourceType: "policy",
		ResourceID:   id,
		UserID:       userID,
		Details:      map[string]interface{}{"changes": req},
		Outcome:      "success",
		Severity:     models.SeverityLow,
	})
	return p, nil
}

func (s *Service) DeletePolicy(ctx context.Context, id, tenantID string, userID string) error {
	existing, err := s.repo.GetPolicy(ctx, id, tenantID)
	if err != nil {
		return sentinel.NotFound
	}
	// Audit: delete
	s.repo.CreateAuditLog(ctx, id, &repository.AuditLogCreateReq{
		Action:       "delete",
		ResourceType: "policy",
		ResourceID:   id,
		UserID:       userID,
		Details:      map[string]interface{}{"name": existing.Name},
		Outcome:      "success",
		Severity:     models.SeverityMedium,
	})
	return s.repo.DeletePolicy(ctx, id, tenantID)
}

// ---- Enable / Disable ----

func (s *Service) EnablePolicy(ctx context.Context, id, tenantID string, userID string) (*models.GovernancePolicy, error) {
	p, err := s.repo.GetPolicy(ctx, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	p, err = s.repo.UpdatePolicyStatus(ctx, id, tenantID, models.PolicyStatusActive)
	if err != nil {
		return nil, sentinel.NotFound
	}
	s.repo.CreateAuditLog(ctx, id, &repository.AuditLogCreateReq{
		Action:       "enable",
		ResourceType: "policy",
		ResourceID:   id,
		UserID:       userID,
		Details:      map[string]interface{}{},
		Outcome:      "success",
		Severity:     models.SeverityLow,
	})
	return p, nil
}

func (s *Service) DisablePolicy(ctx context.Context, id, tenantID string, userID string) (*models.GovernancePolicy, error) {
	p, err := s.repo.GetPolicy(ctx, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	p, err = s.repo.UpdatePolicyStatus(ctx, id, tenantID, models.PolicyStatusPaused)
	if err != nil {
		return nil, sentinel.NotFound
	}
	s.repo.CreateAuditLog(ctx, id, &repository.AuditLogCreateReq{
		Action:       "disable",
		ResourceType: "policy",
		ResourceID:   id,
		UserID:       userID,
		Details:      map[string]interface{}{},
		Outcome:      "success",
		Severity:     models.SeverityLow,
	})
	return p, nil
}

// ---- Audit Logs ----

func (s *Service) GetAuditLogs(ctx context.Context, policyID string, offset, limit int) ([]models.GovernanceAuditLog, int, error) {
	return s.repo.GetAuditLogs(ctx, policyID, offset, limit)
}

// ---- Compliance Check ----

func (s *Service) CheckCompliance(ctx context.Context, req *models.ComplianceCheckRequest, tenantID string) (*models.ComplianceCheckResponse, error) {
	policies, _, err := s.repo.ListPoliciesPaginated(ctx, tenantID, &models.PolicyListQuery{Status: models.PolicyStatusActive}, 0, 0)
	if err != nil {
		return nil, err
	}
	// Filter by policy IDs if specified
	if len(req.PolicyIDs) > 0 {
		filtered := []models.GovernancePolicy{}
		for _, id := range req.PolicyIDs {
			for _, p := range policies {
				if p.ID == id {
					filtered = append(filtered, p)
					break
				}
			}
			policies = filtered
		}
	}

	violations := []models.ComplianceViolationResp{}
	for _, policy := range policies {
		if rand.Float64() > 0.7 {
			var ruleBodies []models.PolicyRuleBody
			_ = json.Unmarshal([]byte(policy.Rules), &ruleBodies)
			rule := models.PolicyRuleBody{Name: "rule_1"}
			if len(ruleBodies) > 0 {
				rule = ruleBodies[int(rand.Float64()*float64(len(ruleBodies)))]
			}
			violations = append(violations, models.ComplianceViolationResp{
				PolicyID:    policy.ID,
				PolicyName:  policy.Name,
				RuleName:    rule.Name,
				Severity:    policy.Severity,
				Description: "违反规则: " + rule.Name,
				Remediation: "请调整资源配置以符合策略要求",
			})
		}
	}

	score := 100 - len(violations)*10
	if score < 0 {
		score = 0
	}
	var status string
	switch {
	case len(violations) == 0:
		status = models.ComplianceCompliant
	case len(violations) > 3:
		status = models.ComplianceNonCompliant
	default:
		status = models.CompliancePartial
	}

	recommendations := []string{"继续保持合规状态"}
	if len(violations) > 0 {
		recommendations = []string{"请解决发现的合规性问题", "定期检查合规状态"}
	}

	result := &models.ComplianceCheckResponse{
		ID:              "check_" + fmt.Sprintf("%d", time.Now().UnixMilli()),
		Timestamp:       time.Now().UTC().Format(time.RFC3339),
		ResourceID:      req.ResourceID,
		ResourceType:    req.ResourceType,
		Status:          status,
		Violations:      violations,
		Score:           score,
		Recommendations: recommendations,
	}
	return result, nil
}

// ---- Compliance Report ----

func (s *Service) GetComplianceReport(ctx context.Context, tenantID string, period *models.CompliancePeriod) (*models.ComplianceReport, error) {
	stats, err := s.repo.GetPolicyStats(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	periodEnd := time.Now().UTC()
	periodStart := periodEnd.AddDate(0, 0, -30)
	if period != nil {
		if t, e := time.Parse(time.RFC3339, period.Start); e == nil {
			periodStart = t
		}
		if t, e := time.Parse(time.RFC3339, period.End); e == nil {
			periodEnd = t
		}
	}

	totalResources := 50
	compliantResources := int(math.Round(float64(totalResources) * 0.85))
	violationsCount := totalResources - compliantResources

	typeKeys := []string{models.PolicyTypeRateLimit, models.PolicyTypeQuota, models.PolicyTypeSecurity, models.PolicyTypeRetention, models.PolicyTypeVersioning}
	byType := make([]models.PolicyTypeBreakdown, 0, len(typeKeys))
	overallScoreSum := 0.0
	for _, t := range typeKeys {
		compliantCount := int(rand.Float64()*30) + 20
		violationCount := int(rand.Float64() * 5)
		s := int(85 + rand.Float64()*15)
		overallScoreSum += float64(s)
		byType = append(byType, models.PolicyTypeBreakdown{
			Type:           t,
			CompliantCount: compliantCount,
			ViolationCount: violationCount,
			Score:          s,
		})
	}
	overallScore := int(math.Round(overallScoreSum / float64(len(typeKeys))))

	var overallStatus string
	switch {
	case overallScore >= 90:
		overallStatus = models.ComplianceCompliant
	case overallScore >= 70:
		overallStatus = models.CompliancePartial
	default:
		overallStatus = models.ComplianceNonCompliant
	}

	report := &models.ComplianceReport{
		ID:            "report_" + fmt.Sprintf("%d", time.Now().UnixMilli()),
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		Period:        models.CompliancePeriod{Start: periodStart.Format(time.RFC3339), End: periodEnd.Format(time.RFC3339)},
		OverallScore:  overallScore,
		OverallStatus: overallStatus,
		Summary: models.ComplianceSummary{
			TotalPolicies:      stats.TotalPolicies,
			ActivePolicies:     stats.ActivePolicies,
			TotalResources:     totalResources,
			CompliantResources: compliantResources,
			ViolationsCount:    violationsCount,
		},
		ByPolicyType:    byType,
		TopViolations:   []models.TopViolation{},
		Recommendations: []string{"定期审查治理策略", "加强高风险策略的监控", "自动化合规检查流程"},
	}
	return report, nil
}

// ---- Apply Policy ----

func (s *Service) ApplyPolicy(ctx context.Context, id, tenantID string, req *models.ApplyPolicyRequest, userID string) (*models.PolicyApplyResult, error) {
	p, err := s.repo.GetPolicy(ctx, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	if p.Status != models.PolicyStatusActive {
		return nil, ErrPolicyNotActive
	}

	var ruleBodies []models.PolicyRuleBody
	_ = json.Unmarshal([]byte(p.Rules), &ruleBodies)
	violationRules := []models.PolicyRuleResp{}
	for _, rb := range ruleBodies {
		if rand.Float64() > 0.8 {
			violationRules = append(violationRules, models.PolicyRuleResp{
				Name:      rb.Name,
				Condition: rb.Condition,
				Action:    models.PolicyActionResp{Type: rb.Action.Type, Config: rb.Action.Config},
				Priority:  rb.Priority,
				Enabled:   rb.Enabled,
			})
			if len(violationRules) >= 2 {
				break
			}
		}
	}

	applied := len(violationRules) == 0
	_ = s.repo.IncrementApplyCount(ctx, id, tenantID)
	if !applied {
		_ = s.repo.IncrementViolationCount(ctx, id, tenantID)
	}

	// Audit
	auditAction := "violation"
	auditOutcome := "warning"
	auditSeverity := p.Severity
	if applied {
		auditAction = "apply"
		auditOutcome = "success"
		auditSeverity = models.SeverityLow
	}
	s.repo.CreateAuditLog(ctx, id, &repository.AuditLogCreateReq{
		Action:       auditAction,
		ResourceType: req.ResourceType,
		ResourceID:   req.ResourceID,
		UserID:       userID,
		Details:      map[string]interface{}{},
		Outcome:      auditOutcome,
		Severity:     auditSeverity,
	})

	return &models.PolicyApplyResult{
		PolicyID:     id,
		ResourceID:   req.ResourceID,
		ResourceType: req.ResourceType,
		Applied:      applied,
		Violations:   violationRules,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// ---- Rules (aggregated) ----

func (s *Service) GetRules(ctx context.Context, tenantID string, offset, limit int) ([]models.PolicyRule, int, error) {
	return s.repo.ListRules(ctx, tenantID, offset, limit)
}
