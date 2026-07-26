package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/inspection-svc-go/internal/models"
	"orion/inspection-svc-go/internal/repository"
)

type InspectionService struct {
	RuleRepo   *repository.RuleRepository
	ResultRepo *repository.ResultRepository
	TaskRepo   *repository.TaskRepository
	ReportRepo *repository.ReportRepository
}

func NewService(
	ruleRepo *repository.RuleRepository,
	resultRepo *repository.ResultRepository,
	taskRepo *repository.TaskRepository,
	reportRepo *repository.ReportRepository,
) *InspectionService {
	return &InspectionService{
		RuleRepo:   ruleRepo,
		ResultRepo: resultRepo,
		TaskRepo:   taskRepo,
		ReportRepo: reportRepo,
	}
}

// --- Rules ---

func (s *InspectionService) ListRules(ctx context.Context, tenantID string, target string, enabled *bool) ([]models.InspectionRule, error) {
	switch {
	case enabled != nil && target != "":
		return s.RuleRepo.ListByTenantAndTargetAndEnabled(ctx, tenantID, target, *enabled)
	case enabled != nil:
		return s.RuleRepo.ListByTenantAndEnabled(ctx, tenantID, *enabled)
	case target != "":
		return s.RuleRepo.ListByTenantAndTarget(ctx, tenantID, target)
	default:
		return s.RuleRepo.ListByTenant(ctx, tenantID)
	}
}

func (s *InspectionService) CreateRule(ctx context.Context, tenantID string, rule models.InspectionRule) (*models.InspectionRule, error) {
	rule.TenantID = tenantID
	if rule.ID == "" {
		rule.ID = fmt.Sprintf("rule_%d_%d", time.Now().UnixNano(), len(rule.RuleType))
	}
	rule.CreatedAt = time.Now().UTC()
	rule.UpdatedAt = time.Now().UTC()
	if err := s.RuleRepo.Create(ctx, &rule); err != nil {
		return nil, err
	}
	return &rule, nil
}

func (s *InspectionService) GetRule(ctx context.Context, tenantID, ruleID string) (*models.InspectionRule, error) {
	return s.RuleRepo.GetByTenantAndID(ctx, tenantID, ruleID)
}

func (s *InspectionService) UpdateRule(ctx context.Context, tenantID, ruleID string, data map[string]interface{}) (*models.InspectionRule, error) {
	r, err := s.RuleRepo.GetByTenantAndID(ctx, tenantID, ruleID)
	if err != nil {
		return nil, err
	}
	if v, ok := data["rule_name"]; ok {
		r.Name = fmt.Sprintf("%v", v)
	}
	if v, ok := data["rule_type"]; ok {
		r.RuleType = fmt.Sprintf("%v", v)
	}
	if v, ok := data["target"]; ok {
		r.Target = fmt.Sprintf("%v", v)
	}
	if v, ok := data["enabled"]; ok {
		if b, ok := v.(bool); ok {
			r.Enabled = b
		}
	}
	if v, ok := data["description"]; ok {
		r.Description = fmt.Sprintf("%v", v)
	}
	if v, ok := data["severity"]; ok {
		r.Severity = fmt.Sprintf("%v", v)
	}
	if v, ok := data["schedule"]; ok {
		r.Schedule = fmt.Sprintf("%v", v)
	}
	r.UpdatedAt = time.Now().UTC()
	if err := s.RuleRepo.Update(ctx, r); err != nil {
		return nil, err
	}
	return r, nil
}

func (s *InspectionService) DeleteRule(ctx context.Context, tenantID, ruleID string) error {
	return s.RuleRepo.Delete(ctx, tenantID, ruleID)
}

// --- Tasks ---

func (s *InspectionService) ListTasks(ctx context.Context, tenantID string, ruleID string, status string) ([]models.InspectionTask, error) {
	switch {
	case ruleID != "" && status != "":
		return s.TaskRepo.ListByTenantAndRuleAndStatus(ctx, tenantID, ruleID, status)
	case ruleID != "":
		return s.TaskRepo.ListByTenantAndRule(ctx, tenantID, ruleID)
	case status != "":
		return s.TaskRepo.ListByTenantAndStatus(ctx, tenantID, status)
	default:
		return s.TaskRepo.ListByTenant(ctx, tenantID)
	}
}

func (s *InspectionService) CreateTask(ctx context.Context, tenantID, ruleID string) (*models.InspectionTask, error) {
	task := &models.InspectionTask{
		ID:       fmt.Sprintf("task_%d", time.Now().UnixNano()),
		TenantID: tenantID,
		RuleID:   ruleID,
		Status:   "pending",
		CreatedAt: time.Now().UTC(),
	}
	if err := s.TaskRepo.Create(ctx, task); err != nil {
		return nil, err
	}
	return task, nil
}

func (s *InspectionService) GetTask(ctx context.Context, tenantID, taskID string) (*models.InspectionTask, error) {
	return s.TaskRepo.GetByTenantAndID(ctx, tenantID, taskID)
}

// --- Reports ---

func (s *InspectionService) ListReports(ctx context.Context, tenantID string) ([]models.InspectionReport, error) {
	return s.ReportRepo.ListByTenant(ctx, tenantID)
}

func (s *InspectionService) CreateReport(ctx context.Context, tenantID, title string, ruleIDs []string) (*models.InspectionReport, error) {
	var results []models.InspectionResult
	if len(ruleIDs) > 0 {
		for _, rid := range ruleIDs {
			rs, err := s.ResultRepo.ListByRuleAndTenant(ctx, rid, tenantID)
			if err != nil {
				continue
			}
			results = append(results, rs...)
		}
	} else {
		var err error
		results, err = s.ResultRepo.ListByTenant(ctx, tenantID)
		if err != nil {
			return nil, err
		}
	}

	var total, passed, failed int
	var issues []models.InspectionIssue
	for _, r := range results {
		status := strings.ToLower(r.Status)
		if status == "" {
			status = "unknown"
		}
		total++
		if status == "pass" {
			passed++
		} else {
			failed++
			issues = append(issues, models.InspectionIssue{
				RuleID: r.RuleID,
				Title:  "Inspection failed: " + r.RuleID,
			})
		}
	}

	score := 0.0
	if total > 0 {
		score = float64(passed) / float64(total) * 100.0
	}

	status := "passed"
	if failed > 0 {
		status = "failed"
	}

	report := models.InspectionReport{
		ID:          fmt.Sprintf("report_%d", time.Now().UnixNano()),
		TenantID:    tenantID,
		Title:       title,
		Summary:     models.JSONB{"total": total, "passed": passed, "failed": failed, "score": score, "status": status},
		GeneratedAt: time.Now().UTC(),
	}
	if err := s.ReportRepo.Create(ctx, &report); err != nil {
		return nil, err
	}
	return &report, nil
}

func (s *InspectionService) GetReport(ctx context.Context, tenantID, reportID string) (*models.InspectionReport, error) {
	return s.ReportRepo.GetByTenantAndID(ctx, tenantID, reportID)
}

// --- Results ---

func (s *InspectionService) ListResults(ctx context.Context, tenantID, ruleID string) ([]models.InspectionResult, error) {
	return s.ResultRepo.ListByRuleAndTenant(ctx, ruleID, tenantID)
}

func (s *InspectionService) GetResult(ctx context.Context, tenantID, resultID string) (*models.InspectionResult, error) {
	return s.ResultRepo.GetByTenantAndID(ctx, tenantID, resultID)
}

func (s *InspectionService) CreateResult(ctx context.Context, tenantID string, r models.InspectionResult) (*models.InspectionResult, error) {
	r.TenantID = tenantID
	if r.ID == "" {
		r.ID = fmt.Sprintf("result_%d", time.Now().UnixNano())
	}
	r.Status = "pending"
	r.ExecutedAt = time.Now().UTC()
	if err := s.ResultRepo.Create(ctx, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

// --- Health Score ---

func (s *InspectionService) GetHealthScore(ctx context.Context, tenantID string) (*models.HealthScore, error) {
	results, err := s.ResultRepo.ListByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	var total, passed, failed int
	var issues []models.InspectionIssue
	for _, r := range results {
		status := strings.ToLower(r.Status)
		if status == "" {
			status = "unknown"
		}
		total++
		if status == "pass" {
			passed++
		} else {
			_ = failed
		}
	}

	score := 0.0
	if total > 0 {
		score = float64(passed) / float64(total) * 100.0
	}

	return &models.HealthScore{
		Total:  total,
		Passed: passed,
		Failed: failed,
		Score:  score,
		Issues: issues,
	}, nil
}
