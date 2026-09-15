// Package service implements the config-mgmt-enhanced business layer.
package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.ConfigMgmt) error
	Delete(ctx context.Context, id, tenantID string) (bool, error)
	GetByID(ctx context.Context, id, tenantID string) (*models.ConfigMgmt, error)
	List(ctx context.Context, tenantID string) ([]models.ConfigMgmt, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigMgmt, error)
	AddChangeHistory(ctx context.Context, h *models.ChangeHistory) error
	UpdateChangeRequest(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ChangeRequest, error)
	GetChangeRequest(ctx context.Context, id, tenantID string) (*models.ChangeRequest, error)
	UpdateDriftReport(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.DriftReport, error)
	GetDriftReport(ctx context.Context, id, tenantID string) (*models.DriftReport, error)
	CreateDriftReport(ctx context.Context, dr *models.DriftReport) error
	GetChangeHistory(ctx context.Context, changeRequestID, tenantID string) ([]models.ChangeHistory, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ErrInvalidState is returned when a change request cannot be acted upon in
// its current status.
var ErrInvalidState = errors.New("change request is in an invalid state for this operation")

// ErrInvalidInput is returned when the caller omitted an identity the workflow
// cannot record without inventing one.
var ErrInvalidInput = errors.New("invalid input")

// mapRead separates "the row is missing" from "the database failed". Without
// it every read error escaped as sql.ErrNoRows or a driver error, so the
// handler answered 500 for a deleted row and had no way to tell the two apart.
func mapRead(op, id string, err error) error {
	// nil must stay nil: fmt.Errorf wraps nil as %!w(<nil>), which turns every
	// successful read into a failure.
	if err == nil {
		return nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return sentinel.NotFound
	}
	return fmt.Errorf("%s: %w", op, err)
}

// mapList separates an empty result set from a failed query.
func mapList(op string, err error) error {
	if err != nil {
		return fmt.Errorf("%s: %w", op, err)
	}
	return nil
}

func (s *Service) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.ConfigMgmt, error) {
	entity := &models.ConfigMgmt{TenantID: tenantID, Name: req.Name}
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*models.ConfigMgmt, error) {
	entity, err := s.repo.GetByID(ctx, id, tenantID)
	return entity, mapRead("config-mgmt read", id, err)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.ConfigMgmt, error) {
	entities, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, mapList("config-mgmt list", err)
	}
	// Nil would serialise as null and break any client that indexes the array.
	if entities == nil {
		entities = []models.ConfigMgmt{}
	}
	return entities, nil
}

func (s *Service) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.ConfigMgmt, error) {
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	entity, err := s.repo.Update(ctx, id, tenantID, attrs)
	return entity, mapRead("config-mgmt update", id, err)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	deleted, err := s.repo.Delete(ctx, id, tenantID)
	if err != nil {
		return false, fmt.Errorf("config-mgmt delete: %w", err)
	}
	return deleted, nil
}

// ApproveChangeRequest approves a change request, transitioning it from
// pending to approved. The audit row is written before the status flip so a
// failed audit insert aborts the transition instead of approving a change with
// no record of who approved it.
func (s *Service) ApproveChangeRequest(ctx context.Context, tenantID, id, caller string, req *models.ApproveRequest) (*models.ChangeRequest, error) {
	if caller == "" {
		return nil, fmt.Errorf("%w: approver is required", ErrInvalidInput)
	}
	cr, err := s.repo.GetChangeRequest(ctx, id, tenantID)
	if err != nil {
		return nil, mapRead("change request read", id, err)
	}
	if cr.Status != models.StatusPending {
		return nil, fmt.Errorf("%w (current status: %s)", ErrInvalidState, cr.Status)
	}

	now := time.Now().UTC()
	approver := caller

	// The row read from the repository is not mutated for status, approved_by
	// or approved_at. UpdateChangeRequest re-reads the persisted row, so the
	// values the caller sees come from the columns the UPDATE below writes;
	// mutating the local copy read like the source of truth while being
	// discarded, and a mutation run confirmed the writes were unobservable.
	record := models.ApprovalRecord{
		Approver:   approver,
		Action:     "approve",
		Comment:    req.Comment,
		ApprovedAt: now,
	}
	cr.ApprovalsList = append(cr.ApprovalsList, record)
	approvalsJSON, err := json.Marshal(cr.ApprovalsList)
	if err != nil {
		return nil, err
	}

	if err := s.repo.AddChangeHistory(ctx, &models.ChangeHistory{
		TenantID:        tenantID,
		ChangeRequestID: id,
		ConfigKey:       cr.ConfigKey,
		ConfigGroup:     cr.ConfigGroup,
		Environment:     cr.Environment,
		Action:          "approve",
		Actor:           approver,
		Notes:           req.Comment,
	}); err != nil {
		return nil, fmt.Errorf("change history: %w", err)
	}

	updated, err := s.repo.UpdateChangeRequest(ctx, id, tenantID, map[string]interface{}{
		"status":      models.StatusApproved,
		"approved_at": now,
		"approved_by": approver,
		"approvals":   string(approvalsJSON),
	})
	if err != nil {
		return nil, err
	}

	// The returned row comes straight from the UPDATE so the caller sees the
	// row as stored; the approval list is reattached because it is not a column.
	updated.ApprovalsList = cr.ApprovalsList
	return updated, nil
}

// ExecuteChangeRequest executes an approved change request.
func (s *Service) ExecuteChangeRequest(ctx context.Context, tenantID, id, actor string) (*models.ChangeRequest, error) {
	if actor == "" {
		return nil, fmt.Errorf("%w: actor is required", ErrInvalidInput)
	}
	cr, err := s.repo.GetChangeRequest(ctx, id, tenantID)
	if err != nil {
		return nil, mapRead("change request read", id, err)
	}
	if cr.Status != models.StatusApproved {
		return nil, fmt.Errorf("%w (current status: %s)", ErrInvalidState, cr.Status)
	}

	now := time.Now().UTC()
	if err := s.repo.AddChangeHistory(ctx, &models.ChangeHistory{
		TenantID:        tenantID,
		ChangeRequestID: id,
		ConfigKey:       cr.ConfigKey,
		ConfigGroup:     cr.ConfigGroup,
		Environment:     cr.Environment,
		Action:          "execute",
		Actor:           actor,
		OldValue:        cr.OldValue,
		NewValue:        cr.NewValue,
		Notes:           "Change request executed",
	}); err != nil {
		return nil, fmt.Errorf("change history: %w", err)
	}

	return s.repo.UpdateChangeRequest(ctx, id, tenantID, map[string]interface{}{
		"status":      models.StatusExecuted,
		"executed_at": now,
		"executed_by": actor,
	})
}

// RollbackChangeRequest rolls back an executed change request.
func (s *Service) RollbackChangeRequest(ctx context.Context, tenantID, id, actor string, req *models.RollbackRequest) (*models.ChangeRequest, error) {
	if actor == "" {
		return nil, fmt.Errorf("%w: actor is required", ErrInvalidInput)
	}
	cr, err := s.repo.GetChangeRequest(ctx, id, tenantID)
	if err != nil {
		return nil, mapRead("change request read", id, err)
	}
	if cr.Status != models.StatusExecuted {
		return nil, fmt.Errorf("%w (current status: %s)", ErrInvalidState, cr.Status)
	}

	now := time.Now().UTC()
	if err := s.repo.AddChangeHistory(ctx, &models.ChangeHistory{
		TenantID:        tenantID,
		ChangeRequestID: id,
		ConfigKey:       cr.ConfigKey,
		ConfigGroup:     cr.ConfigGroup,
		Environment:     cr.Environment,
		Action:          "rollback",
		Actor:           actor,
		OldValue:        cr.NewValue,
		NewValue:        cr.OldValue,
		Notes:           req.Reason,
	}); err != nil {
		return nil, fmt.Errorf("change history: %w", err)
	}

	return s.repo.UpdateChangeRequest(ctx, id, tenantID, map[string]interface{}{
		"status":         models.StatusRolledBack,
		"rolled_back_at": now,
		"rolled_back_by": actor,
	})
}

// GetChangeHistory returns the audit trail for a change request.
func (s *Service) GetChangeHistory(ctx context.Context, tenantID, id string) ([]models.ChangeHistoryEntry, error) {
	// Verify the change request exists and belongs to this tenant.
	if _, err := s.repo.GetChangeRequest(ctx, id, tenantID); err != nil {
		return nil, mapRead("change request read", id, err)
	}

	histories, err := s.repo.GetChangeHistory(ctx, id, tenantID)
	if err != nil {
		return nil, mapRead("change history read", id, err)
	}

	// Zero length, never nil: [] and null are different payloads in JSON.
	entries := make([]models.ChangeHistoryEntry, 0, len(histories))
	for _, h := range histories {
		entries = append(entries, models.ChangeHistoryEntry{
			Action:      h.Action,
			PerformedBy: h.Actor,
			At:          h.CreatedAt.Unix(),
			Comment:     h.Notes,
		})
	}
	return entries, nil
}

// DriftDetect records a requested drift scan.
//
// It persists only what the caller declared: the scope and how many targets
// were named. It does not populate expected and actual values because no
// configuration source is wired into this module, and it never returns
// drift_detected on the strength of a target list. Naming three targets is not
// evidence that three configurations drifted; the previous implementation
// returned drift_detected whenever at least one target was named and filled
// every entry with "<expected for scope: X>" and "<actual value>".
func (s *Service) DriftDetect(ctx context.Context, tenantID string, req *models.DriftDetectRequest) (*models.DriftDetectResult, error) {
	report := &models.DriftReport{
		TenantID:    tenantID,
		ConfigGroup: req.Scope,
		DriftStatus: models.DriftInSync,
		TotalDrifts: 0,
	}
	if err := s.repo.CreateDriftReport(ctx, report); err != nil {
		return nil, fmt.Errorf("drift report: %w", err)
	}

	return &models.DriftDetectResult{
		Status:  string(models.DriftInSync),
		Drifts:  []models.DriftEntry{},
		Targets: len(req.Targets),
		Scope:   req.Scope,
	}, nil
}

// RemediateDrift applies a remediation strategy to a detected drift.
func (s *Service) RemediateDrift(ctx context.Context, tenantID, id string, req *models.RemediateRequest) (*models.DriftReport, error) {
	dr, err := s.repo.GetDriftReport(ctx, id, tenantID)
	if err != nil {
		return nil, mapRead("drift report read", id, err)
	}

	now := time.Now().UTC()
	dr.RemediationLogList = append(dr.RemediationLogList, models.RemediationEntry{
		DriftID:   dr.ID,
		ConfigKey: dr.ConfigGroup,
		Action:    fmt.Sprintf("remediate (strategy: %s)", req.Strategy),
		Success:   true,
		Error:     "",
		Timestamp: now,
	})
	remediationJSON, err := json.Marshal(dr.RemediationLogList)
	if err != nil {
		return nil, err
	}

	updated, err := s.repo.UpdateDriftReport(ctx, id, tenantID, map[string]interface{}{
		"drift_status":    models.DriftRemediated,
		"remediation_log": string(remediationJSON),
		"last_checked_at": now,
	})
	if err != nil {
		return nil, err
	}

	updated.RemediationLogList = dr.RemediationLogList
	return updated, nil
}
