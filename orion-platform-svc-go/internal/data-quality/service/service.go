package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"orion/platform-svc-go/internal/data-quality/models"
	"orion/platform-svc-go/internal/data-quality/repository"
)

var (
	ErrNotFound = errors.New("not found")
	ErrBadRequest = errors.New("bad request")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || errors.Is(err, repository.ErrNotFound)
}

func IsBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

// --- Rules ---

func (s *Service) ListRules(ctx context.Context, tenantID string, filter *models.RuleFilter) ([]models.Rule, error) {
	return s.repo.ListRules(ctx, tenantID, filter)
}

func (s *Service) GetRule(ctx context.Context, tenantID, id string) (*models.Rule, error) {
	rule, err := s.repo.GetRuleByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return rule, nil
}

func (s *Service) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.Rule, error) {
	if req == nil || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.RuleType) == "" {
		return nil, ErrBadRequest
	}
	severity := "medium"
	if req.Severity != "" {
		severity = req.Severity
	}
	if severity != "low" && severity != "medium" && severity != "high" && severity != "critical" {
		return nil, ErrBadRequest
	}
	rule := &models.Rule{
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		TargetTable:  req.TargetTable,
		TargetColumn: req.TargetColumn,
		RuleType:     req.RuleType,
		Expression:   req.Expression,
		Threshold:    req.Threshold,
		Severity:     severity,
		Status:       "active",
	}
	if err := s.repo.CreateRule(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *Service) UpdateRule(ctx context.Context, tenantID, id string, req *models.UpdateRuleRequest) (*models.Rule, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	updates := make(map[string]interface{})
	if req.Name != nil && *req.Name != "" {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.TargetTable != nil {
		updates["target_table"] = *req.TargetTable
	}
	if req.TargetColumn != nil {
		updates["target_column"] = *req.TargetColumn
	}
	if req.RuleType != nil && *req.RuleType != "" {
		updates["rule_type"] = *req.RuleType
	}
	if req.Expression != nil {
		updates["expression"] = *req.Expression
	}
	if req.Threshold != nil {
		updates["threshold"] = *req.Threshold
	}
	if req.Severity != nil {
		severity := *req.Severity
		if severity != "low" && severity != "medium" && severity != "high" && severity != "critical" {
			return nil, ErrBadRequest
		}
		updates["severity"] = severity
	}
	if req.Status != nil {
		status := *req.Status
		if status != "active" && status != "disabled" {
			return nil, ErrBadRequest
		}
		updates["status"] = status
	}
	updated, err := s.repo.UpdateRule(ctx, tenantID, id, updates)
	if err != nil {
		return nil, ErrNotFound
	}
	return updated, nil
}

func (s *Service) DeleteRule(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteRule(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

// --- Scan Results ---

func (s *Service) CreateScanResult(ctx context.Context, tenantID string, req *models.CreateScanResultRequest) (*models.ScanResult, error) {
	if req == nil || req.RuleID == "" || req.ScanDate == "" || req.TotalRecords <= 0 {
		return nil, ErrBadRequest
	}
	_, err := s.GetRule(ctx, tenantID, req.RuleID)
	if err != nil {
		return nil, ErrNotFound
	}
	failed := req.FailedRecords
	passed := req.PassedRecords
	if failed == 0 && passed == 0 {
		failed = 0
		passed = req.TotalRecords
	}
	passRate := 0.0
	if req.TotalRecords > 0 {
		passRate = float64(passed) / float64(req.TotalRecords) * 100
	}
	status := "completed"
	if req.Status != "" {
		status = req.Status
	}
	result := &models.ScanResult{
		TenantID:      tenantID,
		RuleID:        req.RuleID,
		ScanDate:      req.ScanDate,
		TotalRecords:  req.TotalRecords,
		PassedRecords: passed,
		FailedRecords: failed,
		PassRate:      &passRate,
		Status:        status,
		Errors:        req.Errors,
	}
	if err := s.repo.CreateScanResult(ctx, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *Service) ListScanResults(ctx context.Context, tenantID, ruleID string, status *string) ([]models.ScanResult, error) {
	return s.repo.ListScanResults(ctx, tenantID, ruleID, status)
}

// --- Alerts ---

func (s *Service) ListAlerts(ctx context.Context, tenantID string, status *string) ([]models.Alert, error) {
	return s.repo.ListAlerts(ctx, tenantID, status)
}

func (s *Service) GetAlert(ctx context.Context, tenantID, id string) (*models.Alert, error) {
	alert, err := s.repo.GetAlertByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return alert, nil
}

func (s *Service) CreateAlert(ctx context.Context, tenantID string, req *models.CreateAlertRequest) (*models.Alert, error) {
	if req == nil || req.RuleID == "" || req.ScanResultID == "" || req.Severity == "" {
		return nil, ErrBadRequest
	}
	_, err := s.GetRule(ctx, tenantID, req.RuleID)
	if err != nil {
		return nil, ErrNotFound
	}
	alert := &models.Alert{
		TenantID:     tenantID,
		RuleID:       req.RuleID,
		ScanResultID: req.ScanResultID,
		Message:      req.Message,
		Severity:     req.Severity,
		Status:       "open",
	}
	if err := s.repo.CreateAlert(ctx, alert); err != nil {
		return nil, err
	}
	return alert, nil
}

func (s *Service) UpdateAlert(ctx context.Context, tenantID, id string, req *models.UpdateAlertRequest) (*models.Alert, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	updates := make(map[string]interface{})
	if req.Status != nil {
		status := *req.Status
		if status != "open" && status != "acknowledged" && status != "resolved" {
			return nil, ErrBadRequest
		}
		updates["status"] = status
		if status == "resolved" {
			now := time.Now().UTC()
			updates["resolved_at"] = now
		}
	}
	if req.ResolvedBy != nil {
		updates["resolved_by"] = *req.ResolvedBy
	}
	updated, err := s.repo.UpdateAlert(ctx, tenantID, id, updates)
	if err != nil {
		return nil, ErrNotFound
	}
	return updated, nil
}

func (s *Service) DeleteAlert(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteAlert(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

// --- Stats ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.QualityStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}
