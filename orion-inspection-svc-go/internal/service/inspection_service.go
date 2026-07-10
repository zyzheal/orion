package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"orion/inspection-svc-go/internal/models"
	"orion/inspection-svc-go/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrRuleNotFound   = errors.New("inspection rule not found")
	ErrResultNotFound = errors.New("inspection result not found")
	ErrTaskNotFound   = errors.New("inspection task not found")
	ErrReportNotFound = errors.New("inspection report not found")
)

type Service struct {
	ruleRepo   *repository.RuleRepository
	resultRepo *repository.ResultRepository
	taskRepo   *repository.TaskRepository
	reportRepo *repository.ReportRepository
}

func NewService(
	ruleRepo *repository.RuleRepository,
	resultRepo *repository.ResultRepository,
	taskRepo *repository.TaskRepository,
	reportRepo *repository.ReportRepository,
) *Service {
	return &Service{
		ruleRepo:   ruleRepo,
		resultRepo: resultRepo,
		taskRepo:   taskRepo,
		reportRepo: reportRepo,
	}
}

// --- Rule operations ---

func (s *Service) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.InspectionRule, error) {
	now := time.Now()
	rule := &models.InspectionRule{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		RuleType:    req.RuleType,
		Target:      req.Target,
		Condition:   req.Condition,
		Severity:    req.Severity,
		Enabled:     true,
		Schedule:    req.Schedule,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if rule.Severity == "" {
		rule.Severity = "medium"
	}
	if err := s.ruleRepo.Create(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *Service) ListRules(ctx context.Context, tenantID string, offset, limit int) ([]models.InspectionRule, error) {
	return s.ruleRepo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetRule(ctx context.Context, tenantID, id string) (*models.InspectionRule, error) {
	return s.ruleRepo.GetByID(ctx, tenantID, id)
}

func (s *Service) UpdateRule(ctx context.Context, tenantID, id string, req *models.CreateRuleRequest) (*models.InspectionRule, error) {
	rule, err := s.ruleRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrRuleNotFound
	}
	rule.Name = req.Name
	rule.Description = req.Description
	rule.RuleType = req.RuleType
	rule.Target = req.Target
	rule.Condition = req.Condition
	rule.Severity = req.Severity
	rule.Schedule = req.Schedule
	if err := s.ruleRepo.Update(ctx, rule); err != nil {
		return nil, err
	}
	return s.ruleRepo.GetByID(ctx, tenantID, id)
}

func (s *Service) DeleteRule(ctx context.Context, tenantID, id string) error {
	return s.ruleRepo.Delete(ctx, tenantID, id)
}

// --- Task operations ---

// CreateTask runs a single inspection rule and returns the completed task.
func (s *Service) CreateTask(ctx context.Context, tenantID, ruleID string) (*models.InspectionTask, error) {
	now := time.Now()

	taskID := uuid.New().String()
	task := &models.InspectionTask{
		ID:        taskID,
		TenantID:  tenantID,
		RuleID:    ruleID,
		Status:    "pending",
		CreatedAt: now,
	}
	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, err
	}

	if err := s.taskRepo.UpdateStatus(ctx, taskID, "running", "", nil); err != nil {
		return nil, err
	}

	rule, err := s.ruleRepo.GetByID(ctx, tenantID, ruleID)
	if err != nil {
		_ = s.taskRepo.UpdateStatus(ctx, taskID, "failed", "", nil)
		return nil, ErrRuleNotFound
	}

	_, passed, message := s.evaluateCondition(rule)

	resultID := uuid.New().String()
	status := "passed"
	if !passed {
		status = "failed"
	}
	result := &models.InspectionResult{
		ID:         resultID,
		TenantID:   tenantID,
		RuleID:     ruleID,
		RuleName:   rule.Name,
		Status:     status,
		Target:     rule.Target,
		Details:    models.JSONB{},
		Remediation: message,
		ExecutedAt: time.Now(),
	}
	if err := s.resultRepo.Create(ctx, result); err != nil {
		return nil, err
	}

	completedAt := time.Now()
	if err := s.taskRepo.UpdateStatus(ctx, taskID, "completed", resultID, &completedAt); err != nil {
		return nil, err
	}

	return s.taskRepo.GetByID(ctx, taskID)
}

func (s *Service) ListTasks(ctx context.Context, tenantID, ruleID, status string, offset, limit int) ([]models.InspectionTask, error) {
	return s.taskRepo.List(ctx, tenantID, ruleID, status, offset, limit)
}

func (s *Service) GetTask(ctx context.Context, id string) (*models.InspectionTask, error) {
	return s.taskRepo.GetByID(ctx, id)
}

// --- Report operations ---

func (s *Service) GenerateReport(ctx context.Context, tenantID string, req *models.CreateReportRequest) (*models.InspectionReport, error) {
	title := req.Title
	if title == "" {
		title = "自动巡检报告"
	}

	var targetRules []models.InspectionRule
	var err error
	if len(req.RuleIds) > 0 {
		targetRules, err = s.ruleRepo.ListByIDs(ctx, tenantID, req.RuleIds)
	} else {
		targetRules, err = s.ruleRepo.ListEnabled(ctx, tenantID)
	}
	if err != nil {
		return nil, err
	}

	total := len(targetRules)
	passed := 0
	failed := 0
	for _, rule := range targetRules {
		task, taskErr := s.CreateTask(ctx, tenantID, rule.ID)
		if taskErr != nil {
			failed++
			continue
		}
		if task != nil && task.ResultID != "" {
			res, resErr := s.resultRepo.GetByID(ctx, task.ResultID)
			if resErr == nil && res != nil && res.Status == "passed" {
				passed++
			} else {
				failed++
			}
		}
	}

	score := 0
	if total > 0 {
		score = int(math.Round(float64(passed) / float64(total) * 100))
	}

	summary := models.ReportSummary{
		Total:   total,
		Passed:  passed,
		Failed:  failed,
		Warning: 0,
		Score:   score,
	}

	report := &models.InspectionReport{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Title:       title,
		Summary:     models.JSONB{"total": summary.Total, "passed": summary.Passed, "failed": summary.Failed, "warning": summary.Warning, "score": summary.Score},
		GeneratedAt: time.Now(),
	}
	if err := s.reportRepo.Create(ctx, report); err != nil {
		return nil, err
	}
	return s.reportRepo.GetByID(ctx, report.ID)
}

func (s *Service) ListReports(ctx context.Context, tenantID string, offset, limit int) ([]models.InspectionReport, error) {
	return s.reportRepo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetReport(ctx context.Context, id string) (*models.InspectionReport, error) {
	return s.reportRepo.GetByID(ctx, id)
}

// --- Health Score ---

func (s *Service) GetHealthScore(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	recentTasks, err := s.taskRepo.FindRecentCompleted(ctx, tenantID, 100)
	if err != nil {
		return nil, err
	}

	total := len(recentTasks)
	if total == 0 {
		return map[string]interface{}{
			"score":   100,
			"details": map[string]interface{}{},
		}, nil
	}

	type tc struct {
		Passed int
		Total  int
	}
	ts := make(map[string]*tc)
	totalPassed := 0

	for _, t := range recentTasks {
		rule, err := s.ruleRepo.GetByID(ctx, tenantID, t.RuleID)
		if err != nil {
			continue
		}
		target := rule.Target
		if ts[target] == nil {
			ts[target] = &tc{}
		}
		ts[target].Total++

		if t.ResultID != "" {
			res, err := s.resultRepo.GetByID(ctx, t.ResultID)
			if err == nil && res != nil && res.Status == "passed" {
				ts[target].Passed++
			}
		}
	}

	for _, v := range ts {
		totalPassed += v.Passed
	}

	score := int(math.Round(float64(totalPassed) / float64(total) * 100))
	details := make(map[string]int)
	for target, counts := range ts {
		t := target
		if counts.Total > 0 {
			details[t] = int(math.Round(float64(counts.Passed) / float64(counts.Total) * 100))
		} else {
			details[t] = 100
		}
	}

	return map[string]interface{}{
		"score":   score,
		"details": details,
	}, nil
}

// --- Rule counting ---

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.ruleRepo.Count(ctx, tenantID)
}

func (s *Service) ListResults(ctx context.Context, tenantID string, offset, limit int) ([]models.InspectionResult, error) {
	return s.resultRepo.List(ctx, tenantID, offset, limit)
}

func (s *Service) ListResultsByRule(ctx context.Context, tenantID, ruleID string, offset, limit int) ([]models.InspectionResult, error) {
	return s.resultRepo.ListByRule(ctx, tenantID, ruleID, offset, limit)
}

// --- Helpers ---

func (s *Service) evaluateCondition(rule *models.InspectionRule) (float64, bool, string) {
	actualValue := 65.0 // simulated baseline metric

	condition := rule.Condition
	var threshold float64
	if val, ok := condition["threshold"]; ok {
		if num, ok := val.(float64); ok {
			threshold = num
		} else if str, ok := val.(string); ok {
			fmt.Sscanf(str, "%f", &threshold)
		}
	} else {
		switch rule.Severity {
		case "low":
			threshold = 90
		case "medium":
			threshold = 75
		case "high":
			threshold = 60
		case "critical":
			threshold = 50
		}
	}

	var passed bool
	var message string
	op, _ := condition["operator"].(string)
	if op == "" {
		op = "lt"
	}

	switch op {
	case "gt":
		passed = actualValue > threshold
	case "lt":
		passed = actualValue < threshold
	case "eq":
		passed = math.Abs(actualValue-threshold) < 0.01
	case "gte":
		passed = actualValue >= threshold
	case "lte":
		passed = actualValue <= threshold
	default:
		passed = actualValue >= threshold
	}

	if !passed {
		message = fmt.Sprintf("检查失败: 实际值 %.2f 超出阈值 %.2f", actualValue, threshold)
	}

	return actualValue, passed, message
}
