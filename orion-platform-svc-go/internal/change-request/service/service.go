package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/change-request/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateExecution(ctx context.Context, execution *models.ExecutionStep) error
	CreateRequest(ctx context.Context, req *models.ChangeRequest) error
	DeleteRequest(ctx context.Context, id string, tenantID string) (bool, error)
	GetApproval(ctx context.Context, approvalID string, requestID string, tenantID string) (*models.ChangeApproval, error)
	GetApprovalChain(ctx context.Context, requestID string, tenantID string) ([]models.ChangeApproval, error)
	GetExecutionProgress(ctx context.Context, requestID string, tenantID string) ([]models.ExecutionStep, error)
	GetRequestByID(ctx context.Context, id string, tenantID string) (*models.ChangeRequest, error)
	ListRequests(ctx context.Context, tenantID string, filters *models.ListChangeRequestRequest) ([]models.ChangeRequest, error)
	UpdateApprovalDecision(ctx context.Context, approvalID string, tenantID string, decision string, comments *string) (*models.ChangeApproval, error)
	UpdateExecutionStep(ctx context.Context, stepID string, tenantID string, status string, result map[string]any, startedAt *time.Time, completedAt *time.Time) (*models.ExecutionStep, error)
	UpdateRequest(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ChangeRequest, error)
	UpdateRequestStatus(ctx context.Context, id string, tenantID string, status string) (*models.ChangeRequest, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Change Requests ---

func (s *Service) ListRequests(ctx context.Context, tenantID string, filters *models.ListChangeRequestRequest) ([]models.ChangeRequest, int, error) {
	reqs, err := s.repo.ListRequests(ctx, tenantID, filters)
	if err != nil {
		return nil, 0, err
	}
	if reqs == nil {
		reqs = []models.ChangeRequest{}
	}
	return reqs, len(reqs), nil
}

func (s *Service) GetRequest(ctx context.Context, id string, tenantID string) (*models.ChangeRequest, error) {
	req, err := s.repo.GetRequestByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRequestNotFound
		}
		return nil, err
	}
	return req, nil
}

func (s *Service) CreateRequest(ctx context.Context, req *models.CreateChangeRequestRequest, tenantID string) (*models.ChangeRequest, error) {
	cr := &models.ChangeRequest{
		TenantID: tenantID,
		Title:    req.Title,
		Type:     req.ChangeType,
		Status:   "draft",
	}
	if req.Description != nil {
		cr.Description = req.Description
	}
	if req.RiskLevel != nil {
		cr.RiskLevel = req.RiskLevel
	}
	if req.ImpactScope != nil {
		cr.ImpactScope = req.ImpactScope
	}
	if req.RollbackPlan != nil {
		cr.RollbackPlan = req.RollbackPlan
	}
	if req.ScheduledStart != nil {
		cr.ScheduledStart = req.ScheduledStart
	}
	if req.ScheduledEnd != nil {
		cr.ScheduledEnd = req.ScheduledEnd
	}
	if req.CreatedBy != nil {
		cr.CreatedBy = req.CreatedBy
	}
	if err := s.repo.CreateRequest(ctx, cr); err != nil {
		return nil, err
	}
	return s.repo.GetRequestByID(ctx, cr.ID, tenantID)
}

func (s *Service) UpdateRequest(ctx context.Context, id string, tenantID string, req *models.UpdateChangeRequestRequest) (*models.ChangeRequest, error) {
	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.RiskLevel != nil {
		updates["risk_level"] = *req.RiskLevel
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.ImpactScope != nil {
		updates["impact_scope"] = *req.ImpactScope
	}
	if req.RollbackPlan != nil {
		updates["rollback_plan"] = *req.RollbackPlan
	}
	if req.ScheduledStart != nil {
		updates["scheduled_start"] = *req.ScheduledStart
	}
	if req.ScheduledEnd != nil {
		updates["scheduled_end"] = *req.ScheduledEnd
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	cr, err := s.repo.UpdateRequest(ctx, id, tenantID, updates)
	if err != nil {
		if err == sentinel.NotFound {
			return nil, ErrRequestNotFound
		}
		return nil, err
	}
	return cr, nil
}

func (s *Service) DeleteRequest(ctx context.Context, id string, tenantID string) (bool, error) {
	// Only allow deletion of draft requests
	cr, err := s.repo.GetRequestByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, ErrRequestNotFound
		}
		return false, err
	}
	if cr.Status != "draft" {
		return false, ErrStateConflict
	}
	return s.repo.DeleteRequest(ctx, id, tenantID)
}

// --- Approval Chain ---

func (s *Service) SubmitForApproval(ctx context.Context, id string, tenantID string) (*models.ChangeRequest, error) {
	cr, err := s.repo.GetRequestByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRequestNotFound
		}
		return nil, err
	}
	if cr.Status != "draft" {
		return nil, ErrStateConflict
	}
	return s.repo.UpdateRequestStatus(ctx, id, tenantID, "submitted")
}

func (s *Service) GetApprovalChain(ctx context.Context, requestID string, tenantID string) ([]models.ChangeApproval, error) {
	// Ensure the request exists and belongs to the tenant
	_, err := s.repo.GetRequestByID(ctx, requestID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRequestNotFound
		}
		return nil, err
	}
	approvals, err := s.repo.GetApprovalChain(ctx, requestID, tenantID)
	if err != nil {
		return nil, err
	}
	if approvals == nil {
		approvals = []models.ChangeApproval{}
	}
	return approvals, nil
}

func (s *Service) ApproveRequest(ctx context.Context, requestID string, approvalID string, tenantID string, approverID string, comments *string) (*models.ChangeApproval, error) {
	// Validate request exists
	_, err := s.repo.GetRequestByID(ctx, requestID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRequestNotFound
		}
		return nil, err
	}
	// Validate approval exists and is still pending
	approval, err := s.repo.GetApproval(ctx, approvalID, requestID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrApprovalNotFound
		}
		return nil, err
	}
	if approval.Decision != "pending" {
		return nil, ErrStateConflict
	}
	return s.repo.UpdateApprovalDecision(ctx, approvalID, tenantID, "approved", comments)
}

func (s *Service) RejectRequest(ctx context.Context, requestID string, approvalID string, tenantID string, approverID string, comments *string) (*models.ChangeApproval, error) {
	_, err := s.repo.GetRequestByID(ctx, requestID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRequestNotFound
		}
		return nil, err
	}
	approval, err := s.repo.GetApproval(ctx, approvalID, requestID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrApprovalNotFound
		}
		return nil, err
	}
	if approval.Decision != "pending" {
		return nil, ErrStateConflict
	}
	return s.repo.UpdateApprovalDecision(ctx, approvalID, tenantID, "rejected", comments)
}

// --- Execution Management ---

func (s *Service) StartExecution(ctx context.Context, requestID string, tenantID string, steps []models.CreateExecutionStepRequest) ([]models.ExecutionStep, error) {
	cr, err := s.repo.GetRequestByID(ctx, requestID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRequestNotFound
		}
		return nil, err
	}
	if cr.Status != "submitted" {
		return nil, ErrStateConflict
	}

	now := time.Now().UTC()
	result := make([]models.ExecutionStep, 0, len(steps))
	for _ = range steps {
		execution := &models.ExecutionStep{
			RequestID: requestID,
			Status:    "pending",
		}
		if err := s.repo.CreateExecution(ctx, execution); err != nil {
			return nil, err
		}
		execution.StartedAt = &now
		result = append(result, *execution)
	}

	// Update change request status to executing
	_, _ = s.repo.UpdateRequestStatus(ctx, requestID, tenantID, "executing")

	return result, nil
}

func (s *Service) GetExecutionProgress(ctx context.Context, requestID string, tenantID string) (*models.ExecutionProgress, error) {
	_, err := s.repo.GetRequestByID(ctx, requestID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRequestNotFound
		}
		return nil, err
	}
	steps, err := s.repo.GetExecutionProgress(ctx, requestID, tenantID)
	if err != nil {
		return nil, err
	}
	if steps == nil {
		steps = []models.ExecutionStep{}
	}
	return &models.ExecutionProgress{Steps: steps}, nil
}

func (s *Service) UpdateExecutionStep(ctx context.Context, stepID string, tenantID string, status string, result map[string]any, startedAt *time.Time, completedAt *time.Time) (*models.ExecutionStep, error) {
	return s.repo.UpdateExecutionStep(ctx, stepID, tenantID, status, result, startedAt, completedAt)
}

// --- Errors ---

var (
	ErrRequestNotFound  = errors.New("change request not found")
	ErrApprovalNotFound = errors.New("approval not found")
	ErrStateConflict    = errors.New("state conflict")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrRequestNotFound) || errors.Is(err, ErrApprovalNotFound)
}

func IsStateConflict(err error) bool {
	return errors.Is(err, ErrStateConflict)
}
