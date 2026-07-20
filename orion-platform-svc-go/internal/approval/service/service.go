package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/approval/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateApprovalGate(ctx context.Context, m *models.ApprovalGate) error
	CreateApprovalHistory(ctx context.Context, m *models.ApprovalHistory) error
	CreateApprovalLevel(ctx context.Context, m *models.ApprovalLevel) error
	CreateApprovalRequest(ctx context.Context, m *models.ApprovalRequest) error
	CreateTemplate(ctx context.Context, m *models.ApprovalTemplate) error
	DeleteApprovalRequest(ctx context.Context, tenantID, id string) error
	GetApprovalRequest(ctx context.Context, tenantID, id string) (*models.ApprovalRequest, error)
	GetGateByStage(ctx context.Context, tenantID, runID, stageID string) (*models.ApprovalGate, error)
	GetStatistics(ctx context.Context, tenantID string) (models.ApprovalStatistics, error)
	GetTemplate(ctx context.Context, tenantID, id string) (*models.ApprovalTemplate, error)
	ListApprovalRequests(ctx context.Context, tenantID, approvalType, status string, limit, offset int) ([]models.ApprovalRequest, error)
	ListGatesByRun(ctx context.Context, tenantID, runID string) ([]models.ApprovalGate, error)
	ListHistoryByApproval(ctx context.Context, tenantID, approvalID string) ([]models.ApprovalHistory, error)
	ListMyPending(ctx context.Context, tenantID, userID string) ([]models.ApprovalRequest, error)
	ListPending(ctx context.Context, tenantID string) ([]models.ApprovalRequest, error)
	ListTemplates(ctx context.Context, tenantID string, limit, offset int) ([]models.ApprovalTemplate, error)
	UpdateApprovalRequest(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdateTemplate(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Approval requests ---

func (s *Service) CreateApprovalRequest(ctx context.Context, tenantID, userID, userName string, req models.CreateApprovalRequest) (*models.ApprovalRequest, error) {
	status := "pending"
	m := &models.ApprovalRequest{
		TenantID:     tenantID,
		Type:         req.Type,
		Status:       status,
		Title:        req.Title,
		Description:  req.Description,
		ReqByID:      userID,
		ReqByName:    userName,
		TemplateID:   req.TemplateID,
		CurrentLevel: 1,
		TotalLevels:  req.Levels,
	}
	if m.TotalLevels <= 0 {
		m.TotalLevels = 1
	}
	if err := s.repo.CreateApprovalRequest(ctx, m); err != nil {
		return nil, err
	}
	// Create approval levels
	for i := 1; i <= m.TotalLevels; i++ {
		_ = s.repo.CreateApprovalLevel(ctx, &models.ApprovalLevel{
			TenantID:   tenantID,
			ApprovalID: m.ID,
			Level:      i,
			Status:     "pending",
		})
	}
	return m, nil
}

func (s *Service) GetApprovalRequest(ctx context.Context, tenantID, id string) (*models.ApprovalRequest, error) {
	return s.repo.GetApprovalRequest(ctx, tenantID, id)
}

func (s *Service) ListApprovalRequests(ctx context.Context, tenantID, approvalType, status string, limit, offset int) ([]models.ApprovalRequest, error) {
	return s.repo.ListApprovalRequests(ctx, tenantID, approvalType, status, limit, offset)
}

func (s *Service) DeleteApprovalRequest(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteApprovalRequest(ctx, tenantID, id)
}

// --- Review actions ---

func (s *Service) ReviewApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, req models.ReviewApprovalRequest) error {
	approval, err := s.repo.GetApprovalRequest(ctx, tenantID, approvalID)
	if err != nil {
		return fmt.Errorf("approval not found: %w", err)
	}
	if approval.Status != "pending" {
		return errors.New("approval not pending")
	}

	switch req.Decision {
	case "approve":
		approval.Status = "approved"
	case "reject":
		approval.Status = "rejected"
	default:
		return errors.New("invalid decision")
	}
	_ = s.repo.UpdateApprovalRequest(ctx, tenantID, approvalID, map[string]interface{}{"status": approval.Status})

	// Record history
	_ = s.repo.CreateApprovalHistory(ctx, &models.ApprovalHistory{
		TenantID:   tenantID,
		ApprovalID: approvalID,
		Action:     req.Decision,
		ActorID:    userID,
		ActorName:  userName,
		Comment:    req.Comment,
	})
	return nil
}

func (s *Service) ApproveRequest(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) error {
	approval, err := s.repo.GetApprovalRequest(ctx, tenantID, approvalID)
	if err != nil {
		return fmt.Errorf("approval not found: %w", err)
	}
	if approval.Status != "pending" {
		return errors.New("approval not pending")
	}

	approval.CurrentLevel++
	if approval.CurrentLevel > approval.TotalLevels {
		approval.Status = "approved"
	}
	_ = s.repo.UpdateApprovalRequest(ctx, tenantID, approvalID, map[string]interface{}{
		"current_level": approval.CurrentLevel,
		"status":        approval.Status,
	})

	_ = s.repo.CreateApprovalHistory(ctx, &models.ApprovalHistory{
		TenantID:   tenantID,
		ApprovalID: approvalID,
		Action:     "approve",
		ActorID:    userID,
		ActorName:  userName,
		Comment:    comment,
	})
	return nil
}

func (s *Service) RejectRequest(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) error {
	approval, err := s.repo.GetApprovalRequest(ctx, tenantID, approvalID)
	if err != nil {
		return fmt.Errorf("approval not found: %w", err)
	}
	if approval.Status != "pending" {
		return errors.New("approval not pending")
	}

	approval.Status = "rejected"
	_ = s.repo.UpdateApprovalRequest(ctx, tenantID, approvalID, map[string]interface{}{"status": "rejected"})
	_ = s.repo.CreateApprovalHistory(ctx, &models.ApprovalHistory{
		TenantID:   tenantID,
		ApprovalID: approvalID,
		Action:     "reject",
		ActorID:    userID,
		ActorName:  userName,
		Comment:    comment,
	})
	return nil
}

func (s *Service) WithdrawApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) error {
	approval, err := s.repo.GetApprovalRequest(ctx, tenantID, approvalID)
	if err != nil {
		return fmt.Errorf("approval not found: %w", err)
	}
	if approval.Status != "pending" {
		return errors.New("approval not pending")
	}
	if approval.ReqByID != userID {
		return errors.New("only requester can withdraw")
	}

	approval.Status = "withdrawn"
	_ = s.repo.UpdateApprovalRequest(ctx, tenantID, approvalID, map[string]interface{}{"status": "withdrawn"})
	_ = s.repo.CreateApprovalHistory(ctx, &models.ApprovalHistory{
		TenantID:   tenantID,
		ApprovalID: approvalID,
		Action:     "withdraw",
		ActorID:    userID,
		ActorName:  userName,
		Comment:    comment,
	})
	return nil
}

func (s *Service) CancelApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) error {
	approval, err := s.repo.GetApprovalRequest(ctx, tenantID, approvalID)
	if err != nil {
		return fmt.Errorf("approval not found: %w", err)
	}
	if approval.Status != "pending" {
		return errors.New("approval not pending")
	}

	approval.Status = "cancelled"
	_ = s.repo.UpdateApprovalRequest(ctx, tenantID, approvalID, map[string]interface{}{"status": "cancelled"})
	_ = s.repo.CreateApprovalHistory(ctx, &models.ApprovalHistory{
		TenantID:   tenantID,
		ApprovalID: approvalID,
		Action:     "cancel",
		ActorID:    userID,
		ActorName:  userName,
		Comment:    comment,
	})
	return nil
}

func (s *Service) DelegateApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, req models.DelegateApprovalRequest) error {
	_ = s.repo.CreateApprovalHistory(ctx, &models.ApprovalHistory{
		TenantID:   tenantID,
		ApprovalID: approvalID,
		Action:     "delegate",
		ActorID:    userID,
		ActorName:  userName,
		Comment:    req.Comment,
	})
	return nil
}

func (s *Service) ReassignApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, req models.ReassignApprovalRequest) error {
	_ = s.repo.CreateApprovalHistory(ctx, &models.ApprovalHistory{
		TenantID:   tenantID,
		ApprovalID: approvalID,
		Action:     "reassign",
		ActorID:    userID,
		ActorName:  userName,
		Comment:    req.Comment,
	})
	return nil
}

// --- Agent AI analysis ---

func (s *Service) AgentAnalyze(ctx context.Context, tenantID, approvalID string) (*models.ApprovalRequest, error) {
	approval, err := s.repo.GetApprovalRequest(ctx, tenantID, approvalID)
	if err != nil {
		return nil, fmt.Errorf("approval not found: %w", err)
	}
	return approval, nil
}

// --- Statistics ---

func (s *Service) GetStatistics(ctx context.Context, tenantID string) (models.ApprovalStatistics, error) {
	return s.repo.GetStatistics(ctx, tenantID)
}

// GetTrend returns a 7-day trend of approvals.
func (s *Service) GetTrend(ctx context.Context, tenantID string) ([]models.ApprovalTrendEntry, error) {
	// TODO: query daily aggregates from DB.
	trend := make([]models.ApprovalTrendEntry, 7)
	for i := 0; i < 7; i++ {
		d := time.Now().UTC().AddDate(0, 0, -6+i).Format("2006-01-02")
		trend[i] = models.ApprovalTrendEntry{Date: d}
	}
	return trend, nil
}

// --- History ---

func (s *Service) GetHistory(ctx context.Context, tenantID, approvalID string) ([]models.ApprovalHistory, error) {
	return s.repo.ListHistoryByApproval(ctx, tenantID, approvalID)
}

// --- Pending ---

func (s *Service) GetPendingApprovals(ctx context.Context, tenantID string) ([]models.ApprovalRequest, error) {
	return s.repo.ListPending(ctx, tenantID)
}

func (s *Service) GetMyPendingApprovals(ctx context.Context, tenantID, userID string) ([]models.ApprovalRequest, error) {
	return s.repo.ListMyPending(ctx, tenantID, userID)
}

// --- Emergency approval ---

func (s *Service) RequestEmergencyApproval(ctx context.Context, tenantID, userID, userName string, req models.EmergencyApprovalRequest) (*models.ApprovalRequest, error) {
	m := &models.ApprovalRequest{
		TenantID:     tenantID,
		Type:         "emergency",
		Status:       "pending",
		Title:        req.Title,
		Description:  req.Description,
		ReqByID:      userID,
		ReqByName:    userName,
		CurrentLevel: 1,
		TotalLevels:  1,
	}
	if err := s.repo.CreateApprovalRequest(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// --- Templates ---

func (s *Service) CreateTemplate(ctx context.Context, tenantID string, req models.CreateTemplateRequest) (*models.ApprovalTemplate, error) {
	m := &models.ApprovalTemplate{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Levels:      req.Levels,
		IsActive:    true,
	}
	if err := s.repo.CreateTemplate(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetTemplates(ctx context.Context, tenantID string, limit, offset int) ([]models.ApprovalTemplate, error) {
	return s.repo.ListTemplates(ctx, tenantID, limit, offset)
}

func (s *Service) GetTemplate(ctx context.Context, tenantID, id string) (*models.ApprovalTemplate, error) {
	return s.repo.GetTemplate(ctx, tenantID, id)
}

func (s *Service) UpdateTemplate(ctx context.Context, tenantID, id string, req models.UpdateTemplateRequest) (*models.ApprovalTemplate, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Levels != nil {
		updates["levels"] = *req.Levels
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if len(updates) == 0 {
		return s.repo.GetTemplate(ctx, tenantID, id)
	}
	if err := s.repo.UpdateTemplate(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetTemplate(ctx, tenantID, id)
}

// --- Approval gates (pipeline) ---

func (s *Service) ListByRun(ctx context.Context, tenantID, runID string) ([]models.ApprovalGate, error) {
	return s.repo.ListGatesByRun(ctx, tenantID, runID)
}

func (s *Service) GetStatus(ctx context.Context, tenantID, runID, stageID string) (*models.ApprovalGate, error) {
	return s.repo.GetGateByStage(ctx, tenantID, runID, stageID)
}

func (s *Service) ApproveGate(ctx context.Context, tenantID, runID, stageID string, userID, userName, comment string) (*models.ApprovalGate, error) {
	gate, err := s.repo.GetGateByStage(ctx, tenantID, runID, stageID)
	if err != nil {
		return nil, fmt.Errorf("gate not found: %w", err)
	}
	if gate.Status != "pending" {
		return gate, nil
	}
	gate.Status = "approved"
	gate.ActorID = userID
	gate.ActorName = userName
	gate.Comment = comment
	gate.UpdatedAt = time.Now().UTC()
	_ = s.repo.CreateApprovalGate(ctx, gate)
	return gate, nil
}

func (s *Service) RejectGate(ctx context.Context, tenantID, runID, stageID string, userID, userName, comment string) (*models.ApprovalGate, error) {
	gate, err := s.repo.GetGateByStage(ctx, tenantID, runID, stageID)
	if err != nil {
		return nil, fmt.Errorf("gate not found: %w", err)
	}
	if gate.Status != "pending" {
		return gate, nil
	}
	gate.Status = "rejected"
	gate.ActorID = userID
	gate.ActorName = userName
	gate.Comment = comment
	gate.UpdatedAt = time.Now().UTC()
	_ = s.repo.CreateApprovalGate(ctx, gate)
	return gate, nil
}

// --- Errors ---

var (
	ErrNotFound = errors.New("not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

func ErrNotFoundApproval(id string) error {
	return fmt.Errorf("approval %q not found: %w", id, ErrNotFound)
}
