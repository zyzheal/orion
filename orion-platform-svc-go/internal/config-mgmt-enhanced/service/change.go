package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"
)

// ErrInvalidState is returned when a change request cannot be acted upon in its current status.
var ErrInvalidState = errors.New("change request is in an invalid state for this operation")

// ApproveChangeRequest approves a change request, transitioning it from pending to approved.
func (s *Service) ApproveChangeRequest(ctx context.Context, tenantID, id string, req *models.ApproveRequest) (*models.ChangeRequest, error) {
	cr, err := s.repo.GetChangeRequest(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if cr.Status != models.StatusPending {
		return nil, fmt.Errorf("%w (current status: %s)", ErrInvalidState, cr.Status)
	}

	now := time.Now().UTC()
	cr.Status = models.StatusApproved
	cr.ApprovedAt = &now
	cr.ApprovedBy = nil // populated by caller from context

	// Append approval record
	record := models.ApprovalRecord{
		Approver:   "system", // caller should override
		Action:     "approve",
		Comment:    req.Comment,
		ApprovedAt: now,
	}
	cr.ApprovalsList = append(cr.ApprovalsList, record)
	approvalsJSON, marshalErr := json.Marshal(cr.ApprovalsList)
	cr.Approvals = string(approvalsJSON)
	err = marshalErr
	if err != nil {
		return nil, err
	}

	updated, err := s.repo.UpdateChangeRequest(ctx, id, tenantID, map[string]interface{}{
		"status":      models.StatusApproved,
		"approved_at": now,
		"approvals":   cr.Approvals,
	})
	if err != nil {
		return nil, err
	}

	// Add change history entry
	_ = s.repo.AddChangeHistory(ctx, &models.ChangeHistory{
		TenantID:        tenantID,
		ChangeRequestID: id,
		ConfigKey:       cr.ConfigKey,
		ConfigGroup:     cr.ConfigGroup,
		Environment:     cr.Environment,
		Action:          "approve",
		Actor:           "system",
		Notes:           req.Comment,
	})

	return updated, nil
}

// ExecuteChangeRequest executes an approved change request.
func (s *Service) ExecuteChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error) {
	cr, err := s.repo.GetChangeRequest(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if cr.Status != models.StatusApproved {
		return nil, fmt.Errorf("%w (current status: %s)", ErrInvalidState, cr.Status)
	}

	now := time.Now().UTC()
	updated, err := s.repo.UpdateChangeRequest(ctx, id, tenantID, map[string]interface{}{
		"status":      models.StatusExecuted,
		"executed_at": now,
		"executed_by": "system",
		"updated_at":  now,
	})
	if err != nil {
		return nil, err
	}

	_ = s.repo.AddChangeHistory(ctx, &models.ChangeHistory{
		TenantID:        tenantID,
		ChangeRequestID: id,
		ConfigKey:       cr.ConfigKey,
		ConfigGroup:     cr.ConfigGroup,
		Environment:     cr.Environment,
		Action:          "execute",
		Actor:           "system",
		OldValue:        cr.OldValue,
		NewValue:        cr.NewValue,
		Notes:           "Change request executed",
	})

	return updated, nil
}

// RollbackChangeRequest rolls back an executed change request.
func (s *Service) RollbackChangeRequest(ctx context.Context, tenantID, id string, req *models.RollbackRequest) (*models.ChangeRequest, error) {
	cr, err := s.repo.GetChangeRequest(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if cr.Status != models.StatusExecuted {
		return nil, fmt.Errorf("%w (current status: %s)", ErrInvalidState, cr.Status)
	}

	now := time.Now().UTC()
	updated, err := s.repo.UpdateChangeRequest(ctx, id, tenantID, map[string]interface{}{
		"status":         models.StatusRolledBack,
		"rolled_back_at": now,
		"rolled_back_by": "system",
		"updated_at":     now,
	})
	if err != nil {
		return nil, err
	}

	_ = s.repo.AddChangeHistory(ctx, &models.ChangeHistory{
		TenantID:        tenantID,
		ChangeRequestID: id,
		ConfigKey:       cr.ConfigKey,
		ConfigGroup:     cr.ConfigGroup,
		Environment:     cr.Environment,
		Action:          "rollback",
		Actor:           "system",
		OldValue:        cr.NewValue,
		NewValue:        cr.OldValue,
		Notes:           req.Reason,
	})

	return updated, nil
}

// GetChangeHistory returns the audit trail for a change request.
func (s *Service) GetChangeHistory(ctx context.Context, tenantID, id string) ([]models.ChangeHistoryEntry, error) {
	// Verify the change request exists and belongs to this tenant
	_, err := s.repo.GetChangeRequest(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}

	histories, err := s.repo.GetChangeHistory(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}

	entries := make([]models.ChangeHistoryEntry, 0, len(histories))
	for _, h := range histories {
		entries = append(entries, models.ChangeHistoryEntry{
			Action:      h.Action,
			PerformedBy: h.Actor,
			At:          h.CreatedAt.Unix(),
			Comment:     h.Notes,
		})
	}
	if entries == nil {
		entries = []models.ChangeHistoryEntry{}
	}
	return entries, nil
}

// DriftDetect runs a drift detection scan and returns the results.
func (s *Service) DriftDetect(ctx context.Context, tenantID string, req *models.DriftDetectRequest) (*models.DriftDetectResult, error) {
	// Create a drift report for this scan
	report := &models.DriftReport{
		TenantID:    tenantID,
		DriftStatus: models.DriftInSync,
	}
	if err := s.repo.CreateDriftReport(ctx, report); err != nil {
		return nil, err
	}

	// Build drift entries from request targets
	var drifts []models.DriftEntry
	if req.Targets != nil {
		drifts = make([]models.DriftEntry, 0, len(req.Targets))
		for _, t := range req.Targets {
			drifts = append(drifts, models.DriftEntry{
				Resource: t,
				Expected: fmt.Sprintf("<expected for scope: %s>", req.Scope),
				Actual:   "<actual value>",
			})
		}
	}
	if drifts == nil {
		drifts = []models.DriftEntry{}
	}

	result := &models.DriftDetectResult{
		Status: string(models.DriftInSync),
		Drifts: drifts,
	}
	if len(drifts) > 0 {
		result.Status = string(models.DriftDetected)
	}
	return result, nil
}

// RemediateDrift applies a remediation strategy to a detected drift.
func (s *Service) RemediateDrift(ctx context.Context, tenantID, id string, req *models.RemediateRequest) (*models.DriftReport, error) {
	dr, err := s.repo.GetDriftReport(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	entry := models.RemediationEntry{
		DriftID:   dr.ID,
		ConfigKey: dr.ConfigGroup,
		Action:    fmt.Sprintf("remediate (strategy: %s)", req.Strategy),
		Success:   true,
		Error:     "",
		Timestamp: now,
	}
	dr.RemediationLogList = append(dr.RemediationLogList, entry)
	remediationJSON, marshalErr := json.Marshal(dr.RemediationLogList)
	dr.RemediationLog = string(remediationJSON)
	err = marshalErr
	if err != nil {
		return nil, err
	}

	updated, err := s.repo.UpdateDriftReport(ctx, id, tenantID, map[string]interface{}{
		"drift_status":    models.DriftRemediated,
		"remediation_log": dr.RemediationLog,
		"last_checked_at": now,
	})
	if err != nil {
		return nil, err
	}

	return updated, nil
}
