package service

import (
	"context"
	"errors"
	"fmt"
	"log"

	"orion/platform-svc-go/internal/workflow/approval/models"
	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/workflow/approval/repository"

	"github.com/jmoiron/sqlx"
)

var (
	ErrApprovalNotFound = errors.New("approval not found")
	ErrStepNotFound     = errors.New("approval step not found")
	ErrInvalidStatus    = errors.New("invalid status transition")
	ErrAlreadyActed     = errors.New("step already acted upon")
	ErrNotAuthorized    = errors.New("not authorized for this approval")
)

type ApprovalService struct {
	repo          *repository.ApprovalRepository
	notificationSvc *NotificationService
}

func NewApprovalService(repo *repository.ApprovalRepository, notificationSvc *NotificationService) *ApprovalService {
	return &ApprovalService{repo: repo, notificationSvc: notificationSvc}
}

// Create creates a simple approval with default settings.
func (s *ApprovalService) Create(ctx context.Context, a *models.Approval) error {
	if a.Status == "" {
		a.Status = models.ApprovalPending
	}
	if a.TotalSteps <= 0 {
		a.TotalSteps = 1
	}
	if a.RequiredApprovals <= 0 {
		a.RequiredApprovals = 1
	}
	return s.repo.Create(ctx, a)
}

// SubmitApproval creates a multi-level approval with approver steps.
// Ported from Node.js MultiLevelApprovalService.submitApprovalRequest.
func (s *ApprovalService) SubmitApproval(ctx context.Context, tenantID string, req *models.SubmitApprovalRequest) (*models.ApprovalWithSteps, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.SubmitApproval")
	defer span.End()

	if len(req.Levels) == 0 {
		return nil, fmt.Errorf("at least one approval level is required")
	}

	mode := req.Mode
	if mode == "" {
		mode = models.ModeSerial
	}

	// Calculate total steps and required approvals across all levels
	totalSteps := 0
	requiredApprovals := 0
	levelConfigs := make(models.LevelConfigs, 0, len(req.Levels))
	for _, level := range req.Levels {
		totalSteps += len(level.ApproverIDs)
		requiredApprovals += level.RequiredApprovals
		levelConfigs = append(levelConfigs, models.LevelConfig{
			Level:             level.LevelIndex,
			RequiredApprovals: level.RequiredApprovals,
		})
	}

	approval := &models.Approval{
		TenantID:          tenantID,
		ResourceType:      req.ResourceType,
		ResourceID:        req.ResourceID,
		Title:             &req.Title,
		Status:            models.ApprovalPending,
		RequestedBy:       &req.RequestedBy,
		CurrentStep:       0,
		TotalSteps:        totalSteps,
		RequiredApprovals: requiredApprovals,
		LevelConfigs:      levelConfigs,
	}

	if err := s.repo.Create(ctx, approval); err != nil {
		return nil, fmt.Errorf("failed to create approval: %w", err)
	}

	// Create steps for each level
	steps := make([]models.ApprovalStep, 0, totalSteps)
	stepIndex := 0
	for _, level := range req.Levels {
		for _, approverID := range level.ApproverIDs {
			stepStatus := models.StepPending
			// In serial mode, only the first level is active; others wait
			if mode == models.ModeSerial && level.LevelIndex > 0 {
				stepStatus = models.StepWaiting
			}

			step := &models.ApprovalStep{
				ApprovalID: approval.ID,
				StepIndex:  stepIndex,
				Level:      level.LevelIndex,
				ApproverID: &approverID,
				Status:     stepStatus,
			}
			if err := s.repo.CreateStep(ctx, step); err != nil {
				return nil, fmt.Errorf("failed to create step %d: %w", stepIndex, err)
			}
			steps = append(steps, *step)
			stepIndex++
		}
	}

	log.Printf("[approval] submitted multi-level approval %s for tenant %s with %d steps (mode=%s)",
		approval.ID, tenantID, totalSteps, mode)

	// Notify approvers
	if s.notificationSvc != nil {
		if err := s.notificationSvc.NotifyApprovalCreated(ctx, approval, steps); err != nil {
			log.Printf("[approval] warning: failed to send creation notification: %v", err)
		}
	}

	return &models.ApprovalWithSteps{
		Approval: approval,
		Steps:    steps,
	}, nil
}

// Approve approves a step in an approval workflow.
// Ported from Node.js ApprovalService.approve + MultiLevelApprovalService.review.
// Wrapped in a transaction with SELECT FOR UPDATE to prevent race conditions.
func (s *ApprovalService) Approve(ctx context.Context, tenantID, approvalID, approverID string, comment *string) (*models.ApprovalWithSteps, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.Approve")
	defer span.End()

	var result *models.ApprovalWithSteps

	err := s.repo.RunInTx(ctx, func(tx *sqlx.Tx) error {
		// Lock the approval row to prevent concurrent modifications
		approval, err := s.repo.GetByIDForUpdate(ctx, tx, tenantID, approvalID)
		if err != nil {
			return ErrApprovalNotFound
		}
		if approval.Status != models.ApprovalPending {
			return ErrInvalidStatus
		}

		// Find the step for this approver
		step, err := s.repo.FindStepByApprovalAndApproverTx(ctx, tx, approvalID, approverID)
		if err != nil {
			return ErrNotAuthorized
		}

		// Already approved - idempotent return
		if step.Status == models.StepApproved {
			steps, _ := s.repo.GetStepsByApprovalIDTx(ctx, tx, approvalID)
			result = &models.ApprovalWithSteps{Approval: approval, Steps: steps}
			return nil
		}

		// Cannot approve if waiting for a previous level
		if step.Status == models.StepWaiting {
			return fmt.Errorf("step is waiting for previous level to complete")
		}

		if step.Status != models.StepPending {
			return ErrAlreadyActed
		}

		// Update the step to approved
		if err := s.repo.UpdateStepStatusTx(ctx, tx, step.ID, models.StepApproved, comment); err != nil {
			return fmt.Errorf("failed to update step: %w", err)
		}

		// Advance the approval's current step counter
		if err := s.repo.AdvanceStepTx(ctx, tx, approvalID); err != nil {
			return fmt.Errorf("failed to advance step: %w", err)
		}

		// Check per-level completion
		updatedSteps, err := s.repo.GetStepsByApprovalIDTx(ctx, tx, approvalID)
		if err != nil {
			return err
		}

		// Check if the current level is complete
		currentLevel := step.Level
		currentLevelApproved := 0
		for _, s := range updatedSteps {
			if s.Level == currentLevel && s.Status == models.StepApproved {
				currentLevelApproved++
			}
		}

		// Get the required approvals for the current level
		currentLevelRequired := 1
		if approval.LevelConfigs != nil {
			for _, lc := range approval.LevelConfigs {
				if lc.Level == currentLevel {
					currentLevelRequired = lc.RequiredApprovals
					break
				}
			}
		}

		// If current level is complete, activate next level or mark as approved
		if currentLevelApproved >= currentLevelRequired {
			// Check if all levels are complete
			allComplete := s.areAllLevelsComplete(updatedSteps, approval.LevelConfigs)
			if allComplete {
				if err := s.repo.UpdateStatusTx(ctx, tx, tenantID, approvalID, models.ApprovalApproved); err != nil {
					return fmt.Errorf("failed to finalize approval: %w", err)
				}
			} else {
				// Activate waiting steps for the next level
				if err := s.repo.ActivateWaitingStepsTx(ctx, tx, approvalID); err != nil {
					return err
				}
			}
		}

		// Fetch updated state
		updatedApproval, _ := s.repo.GetByID(ctx, tenantID, approvalID)
		finalSteps, _ := s.repo.GetStepsByApprovalID(ctx, approvalID)
		result = &models.ApprovalWithSteps{Approval: updatedApproval, Steps: finalSteps}

		// Send notifications
		if s.notificationSvc != nil {
			_ = s.notificationSvc.NotifyStepApproved(ctx, updatedApproval, step)
			if updatedApproval.Status == models.ApprovalApproved {
				_ = s.notificationSvc.NotifyApprovalApproved(ctx, updatedApproval)
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}
	return result, nil
}

// Reject rejects a step, which rejects the entire approval.
// Ported from Node.js ApprovalService.reject + MultiLevelApprovalService.review.
// Wrapped in a transaction with SELECT FOR UPDATE to prevent race conditions.
func (s *ApprovalService) Reject(ctx context.Context, tenantID, approvalID, approverID string, comment *string) (*models.ApprovalWithSteps, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.Reject")
	defer span.End()

	var result *models.ApprovalWithSteps

	err := s.repo.RunInTx(ctx, func(tx *sqlx.Tx) error {
		// Lock the approval row to prevent concurrent modifications
		approval, err := s.repo.GetByIDForUpdate(ctx, tx, tenantID, approvalID)
		if err != nil {
			return ErrApprovalNotFound
		}
		if approval.Status != models.ApprovalPending {
			return ErrInvalidStatus
		}

		// Find the step for this approver
		step, err := s.repo.FindStepByApprovalAndApproverTx(ctx, tx, approvalID, approverID)
		if err != nil {
			return ErrNotAuthorized
		}

		if step.Status == models.StepWaiting {
			return fmt.Errorf("step is waiting for previous level to complete")
		}

		if step.Status != models.StepPending {
			return ErrAlreadyActed
		}

		// Update the step to rejected
		if err := s.repo.UpdateStepStatusTx(ctx, tx, step.ID, models.StepRejected, comment); err != nil {
			return fmt.Errorf("failed to update step: %w", err)
		}

		// Any rejection rejects the entire approval
		if err := s.repo.UpdateStatusTx(ctx, tx, tenantID, approvalID, models.ApprovalRejected); err != nil {
			return fmt.Errorf("failed to reject approval: %w", err)
		}

		updatedApproval, _ := s.repo.GetByID(ctx, tenantID, approvalID)
		finalSteps, _ := s.repo.GetStepsByApprovalID(ctx, approvalID)
		result = &models.ApprovalWithSteps{Approval: updatedApproval, Steps: finalSteps}

		// Send rejection notification
		if s.notificationSvc != nil {
			rejectedBy := approverID
			commentStr := ""
			if comment != nil {
				commentStr = *comment
			}
			_ = s.notificationSvc.NotifyApprovalRejected(ctx, updatedApproval, rejectedBy, commentStr)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}
	return result, nil
}

// Cancel cancels a pending approval.
func (s *ApprovalService) Cancel(ctx context.Context, tenantID, id string) error {
	approval, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return ErrApprovalNotFound
	}
	if approval.Status != models.ApprovalPending {
		return ErrInvalidStatus
	}
	return s.repo.UpdateStatus(ctx, tenantID, id, models.ApprovalCanceled)
}

// GetByID returns an approval by tenant and ID.
func (s *ApprovalService) GetByID(ctx context.Context, tenantID, id string) (*models.Approval, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// GetWithSteps returns an approval with its workflow steps.
func (s *ApprovalService) GetWithSteps(ctx context.Context, tenantID, id string) (*models.ApprovalWithSteps, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.GetWithSteps")
	defer span.End()

	approval, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrApprovalNotFound
	}
	steps, err := s.repo.GetStepsByApprovalID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &models.ApprovalWithSteps{Approval: approval, Steps: steps}, nil
}

// GetByResource returns approvals matching a resource type and ID.
func (s *ApprovalService) GetByResource(ctx context.Context, tenantID, resourceType, resourceID string) ([]models.Approval, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.GetByResource")
	defer span.End()
	return s.repo.FindByResource(ctx, tenantID, resourceType, resourceID)
}

// GetPendingForUser returns pending approvals where the user has an actionable step.
// Ported from Node.js MultiLevelApprovalService.getPendingApprovals.
func (s *ApprovalService) GetPendingForUser(ctx context.Context, tenantID, userID string) ([]models.ApprovalWithSteps, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.GetPendingForUser")
	defer span.End()

	approvals, err := s.repo.FindPendingByUser(ctx, tenantID, userID)
	if err != nil {
		return nil, err
	}

	results := make([]models.ApprovalWithSteps, 0, len(approvals))
	for i := range approvals {
		steps, err := s.repo.GetStepsByApprovalID(ctx, approvals[i].ID)
		if err != nil {
			continue
		}
		results = append(results, models.ApprovalWithSteps{
			Approval: &approvals[i],
			Steps:    steps,
		})
	}
	return results, nil
}

// GetStats returns aggregate approval statistics for a tenant.
func (s *ApprovalService) GetStats(ctx context.Context, tenantID string) (*models.ApprovalStats, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.GetStats")
	defer span.End()
	return s.repo.GetStats(ctx, tenantID)
}

// List returns paginated approvals for a tenant.
func (s *ApprovalService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Approval, error) {
	return s.repo.ListByTenant(ctx, tenantID, offset, limit)
}

// GetSteps returns the steps for an approval.
func (s *ApprovalService) GetSteps(ctx context.Context, approvalID string) ([]models.ApprovalStep, error) {
	return s.repo.GetStepsByApprovalID(ctx, approvalID)
}

// Delete removes an approval by tenant and ID.
func (s *ApprovalService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Count returns the total count of approvals for a tenant.
func (s *ApprovalService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ========== Private Helpers ==========

// areAllLevelsComplete checks if every level in the approval has met its required_approvals.
func (s *ApprovalService) areAllLevelsComplete(steps []models.ApprovalStep, levelConfigs models.LevelConfigs) bool {
	if levelConfigs == nil || len(levelConfigs) == 0 {
		// No level config means single-level; count all approved steps
		approved := 0
		for _, step := range steps {
			if step.Status == models.StepApproved {
				approved++
			}
		}
		return approved >= len(steps)
	}

	// Count approved steps per level
	approvedByLevel := make(map[int]int)
	for _, step := range steps {
		if step.Status == models.StepApproved {
			approvedByLevel[step.Level]++
		}
	}

	// Check each level's requirement
	for _, lc := range levelConfigs {
		if approvedByLevel[lc.Level] < lc.RequiredApprovals {
			return false
		}
	}
	return true
}

// ========== Additional Service Methods ==========

// Review provides a unified approve/reject action.
func (s *ApprovalService) Review(ctx context.Context, tenantID, approvalID string, req *models.ReviewRequest) (*models.ApprovalWithSteps, error) {
	switch req.Action {
	case "approve":
		return s.Approve(ctx, tenantID, approvalID, req.ReviewerID, req.Comment)
	case "reject":
		return s.Reject(ctx, tenantID, approvalID, req.ReviewerID, req.Comment)
	default:
		return nil, fmt.Errorf("invalid action: %s", req.Action)
	}
}

// Withdraw withdraws a pending approval. Only the requester can withdraw.
func (s *ApprovalService) Withdraw(ctx context.Context, tenantID, id, userID string, reason *string) error {
	approval, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return ErrApprovalNotFound
	}
	if approval.Status != models.ApprovalPending {
		return ErrInvalidStatus
	}
	if approval.RequestedBy == nil || *approval.RequestedBy != userID {
		return ErrNotAuthorized
	}
	if err := s.repo.UpdateStatus(ctx, tenantID, id, models.ApprovalCanceled); err != nil {
		return err
	}
	if s.notificationSvc != nil {
		_ = s.notificationSvc.NotifyApprovalRejected(ctx, approval, userID, deref(reason))
	}
	return nil
}

// Delegate transfers a pending step from one approver to another.
func (s *ApprovalService) Delegate(ctx context.Context, tenantID, approvalID string, req *models.DelegateRequest) (*models.ApprovalStep, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.Delegate")
	defer span.End()

	approval, err := s.repo.GetByID(ctx, tenantID, approvalID)
	if err != nil {
		return nil, ErrApprovalNotFound
	}
	if approval.Status != models.ApprovalPending {
		return nil, ErrInvalidStatus
	}

	var step *models.ApprovalStep
	err = s.repo.RunInTx(ctx, func(tx *sqlx.Tx) error {
		step, err = s.repo.DelegateStepTx(ctx, tx, approvalID, req.FromUserID, req.ToUserID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return step, nil
}

// Reassign transfers a pending step from one approver to another (same as delegate).
func (s *ApprovalService) Reassign(ctx context.Context, tenantID, approvalID, authorizingUserID, reqFromUserID string, toUserID string, reason *string) (*models.ApprovalStep, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.Reassign")
	defer span.End()

	approval, err := s.repo.GetByID(ctx, tenantID, approvalID)
	if err != nil {
		return nil, ErrApprovalNotFound
	}
	if approval.Status != models.ApprovalPending {
		return nil, ErrInvalidStatus
	}

	var step *models.ApprovalStep
	err = s.repo.RunInTx(ctx, func(tx *sqlx.Tx) error {
		step, err = s.repo.ReassignStepTx(ctx, tx, approvalID, reqFromUserID, toUserID)
		return err
	})
	return step, err
}

// GetHistory returns the approval history/timeline.
func (s *ApprovalService) GetHistory(ctx context.Context, tenantID, id string) (*models.ApprovalHistory, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.GetHistory")
	defer span.End()

	approval, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrApprovalNotFound
	}
	events, err := s.repo.GetHistory(ctx, id)
	if err != nil {
		return nil, err
	}
	totalLevels := 1
	for _, step := range events {
		if step.LevelIndex != nil && *step.LevelIndex+1 > totalLevels {
			totalLevels = *step.LevelIndex + 1
		}
	}
	return &models.ApprovalHistory{
		RequestID:   id,
		Title:       deref(approval.Title),
		Status:      approval.Status,
		TotalLevels: totalLevels,
		History:     events,
	}, nil
}

// GetTrend returns daily trend data.
func (s *ApprovalService) GetTrend(ctx context.Context, tenantID string, startDate, endDate string) (*models.TrendResult, error) {
	ctx, span := otel.Tracer("orion-approval-svc").Start(ctx, "ApprovalService.GetTrend")
	defer span.End()
	trends, err := s.repo.GetTrend(ctx, tenantID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	return &models.TrendResult{
		TenantID:  tenantID,
		StartDate: startDate,
		EndDate:   endDate,
		Trend:     trends,
	}, nil
}

// GetStatistics returns aggregate statistics.
func (s *ApprovalService) GetStatistics(ctx context.Context, tenantID string, startDate, endDate string) (*models.ApprovalStatistics, error) {
	return s.repo.GetStatistics(ctx, tenantID, startDate, endDate)
}

// GetMyPending returns pending approvals where the authenticated user is an approver.
func (s *ApprovalService) GetMyPending(ctx context.Context, tenantID, userID string) ([]models.ApprovalWithSteps, error) {
	return s.GetPendingForUser(ctx, tenantID, userID)
}

// CreateTemplate creates a new approval template.
func (s *ApprovalService) CreateTemplate(ctx context.Context, tenantID string, req *models.CreateTemplateRequest) (*models.ApprovalTemplate, error) {
	levelConfigs := make(models.LevelConfigs, 0, len(req.Levels))
	for _, level := range req.Levels {
		levelConfigs = append(levelConfigs, models.LevelConfig{
			Level:             level.LevelIndex,
			RequiredApprovals: level.RequiredApprovals,
		})
	}
	mode := req.Mode
	if mode == "" {
		mode = models.ModeSerial
	}
	template := &models.ApprovalTemplate{
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		ResourceType: req.ResourceType,
		Levels:       levelConfigs,
		Mode:         mode,
		IsDefault:    req.IsDefault,
	}
	if err := s.repo.CreateTemplate(ctx, template); err != nil {
		return nil, fmt.Errorf("failed to create template: %w", err)
	}
	return template, nil
}

// GetTemplates returns all templates for a tenant.
func (s *ApprovalService) GetTemplates(ctx context.Context, tenantID string) ([]models.ApprovalTemplate, error) {
	return s.repo.GetTemplates(ctx, tenantID)
}

// CreateEmergency creates an emergency approval request.
func (s *ApprovalService) CreateEmergency(ctx context.Context, tenantID string, req *models.EmergencyApprovalRequest) (*models.EmergencyApproval, error) {
	levelConfigs := make(models.LevelConfigs, 0, len(req.ApproverIDs))
	for i, _ := range req.ApproverIDs {
		levelConfigs = append(levelConfigs, models.LevelConfig{
			Level:             i,
			RequiredApprovals: 1,
		})
	}
	emergency := &models.EmergencyApproval{
		TenantID:          tenantID,
		Title:             req.Title,
		Description:       req.Description,
		RequestedBy:       req.RequestedBy,
		ResourceType:      req.ResourceType,
		ResourceID:        req.ResourceID,
		Reason:            req.Reason,
		ImpactDescription: req.ImpactDescription,
		ApproverIDs:       levelConfigs,
		Status:            models.ApprovalPending,
	}
	if err := s.repo.CreateEmergency(ctx, emergency); err != nil {
		return nil, fmt.Errorf("failed to create emergency approval: %w", err)
	}
	if s.notificationSvc != nil {
		_ = s.notificationSvc.NotifyApprovalCreated(ctx, &models.Approval{
			Title: &req.Title,
		}, nil)
	}
	return emergency, nil
}
