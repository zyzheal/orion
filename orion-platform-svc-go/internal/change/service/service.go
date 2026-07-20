package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/change/models"
	"orion/platform-svc-go/internal/change/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AddCABDecision(ctx context.Context, tenantID, cabID, changeRequestID, decision, notes string) (*models.CABDecision, error)
	CreateCABMeeting(ctx context.Context, tenantID string, meeting *models.CABMeeting) error
	CreateChangeRequest(ctx context.Context, m *models.ChangeRequest) error
	CreateRFC(ctx context.Context, tenantID string, rfc *models.RFC) error
	CreateTimelineEvent(ctx context.Context, event *models.TimelineEvent) error
	DeleteChangeRequest(ctx context.Context, tenantID, id string) error
	GetCABMeeting(ctx context.Context, tenantID, id string) (*models.CABMeeting, error)
	GetChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error)
	GetRFC(ctx context.Context, tenantID, id string) (*models.RFC, error)
	GetStats(ctx context.Context, tenantID string) (*models.ChangeStats, error)
	ListCABMeetings(ctx context.Context, tenantID string, q models.CABMeetingListQuery) (*models.ListResult[models.CABMeeting], error)
	ListChangeRequests(ctx context.Context, tenantID string, q models.ChangeRequestListQuery) (*models.ListResult[models.ChangeRequest], error)
	ListRFCs(ctx context.Context, tenantID string, limit, offset int) (*models.ListResult[models.RFC], error)
	ListTimelineEvents(ctx context.Context, tenantID, changeRequestID string, limit, offset int) ([]models.TimelineEvent, error)
	UpdateCABMeeting(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.CABMeeting, error)
	UpdateChangeRequest(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ChangeRequest, error)
	UpdateRFC(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.RFC, error)
	UpdateStatus(ctx context.Context, tenantID, id, status, reason string) (*models.ChangeRequest, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Change Request ---

func (s *Service) CreateChangeRequest(ctx context.Context, tenantID string, req models.CreateChangeRequestRequest, userID string) (*models.ChangeRequest, error) {
	if req.Title == "" {
		return nil, errors.New("title is required")
	}
	requesterID := req.RequesterID
	if requesterID == "" {
		requesterID = userID
	}
	m := &models.ChangeRequest{
		TenantID:    tenantID,
		Title:       req.Title,
		Description: req.Description,
		ChangeType:  req.ChangeType,
		Priority:    req.Priority,
		RiskLevel:   req.RiskLevel,
		AssignedTo:  req.AssignedTo,
		RequesterID: requesterID,
		CreatedBy:   userID,
		Status:      "draft",
	}
	if err := s.repo.CreateChangeRequest(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) GetChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error) {
	return s.repo.GetChangeRequest(ctx, tenantID, id)
}

func (s *Service) ListChangeRequests(ctx context.Context, tenantID string, q models.ChangeRequestListQuery) (*models.ListResult[models.ChangeRequest], error) {
	return s.repo.ListChangeRequests(ctx, tenantID, q)
}

func (s *Service) UpdateChangeRequest(ctx context.Context, tenantID, id string, req models.UpdateChangeRequestRequest) (*models.ChangeRequest, error) {
	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.ChangeType != nil {
		updates["change_type"] = *req.ChangeType
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.RiskLevel != nil {
		updates["risk_level"] = *req.RiskLevel
	}
	if req.AssignedTo != nil {
		updates["assigned_to"] = *req.AssignedTo
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if len(updates) == 0 {
		return s.GetChangeRequest(ctx, tenantID, id)
	}
	return s.repo.UpdateChangeRequest(ctx, tenantID, id, updates)
}

func (s *Service) DeleteChangeRequest(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteChangeRequest(ctx, tenantID, id)
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id, status, reason string) (*models.ChangeRequest, error) {
	if status == "" {
		return nil, errors.New("status is required")
	}
	validStatuses := map[string]bool{
		"draft": true, "submitted": true, "approved": true,
		"in_progress": true, "completed": true, "rejected": true, "cancelled": true,
	}
	if !validStatuses[status] {
		return nil, repository.ErrInvalidStatus
	}
	// TODO: add timeline event for status transition
	return s.repo.UpdateStatus(ctx, tenantID, id, status, reason)
}

// --- Timeline ---

func (s *Service) GetTimeline(ctx context.Context, tenantID, changeRequestID string, limit, offset int) ([]models.TimelineEvent, error) {
	return s.repo.ListTimelineEvents(ctx, tenantID, changeRequestID, limit, offset)
}

func (s *Service) AddTimelineEvent(ctx context.Context, tenantID, changeRequestID, eventType, description string, metadata map[string]interface{}, userID string) (*models.TimelineEvent, error) {
	if eventType == "" || description == "" {
		return nil, errors.New("event_type and description are required")
	}
	var raw json.RawMessage
	if metadata != nil {
		b, err := json.Marshal(metadata)
		if err != nil {
			return nil, err
		}
		raw = b
	}
	event := &models.TimelineEvent{
		ChangeRequestID: changeRequestID,
		TenantID:        tenantID,
		EventType:       eventType,
		Description:     description,
		Metadata:        &raw,
		CreatedBy:       userID,
	}
	if err := s.repo.CreateTimelineEvent(ctx, event); err != nil {
		return nil, err
	}
	return event, nil
}

// --- Statistics ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.ChangeStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}

// --- RFC ---

func (s *Service) CreateRFC(ctx context.Context, tenantID string, req models.CreateRFCRequest, userID string) (*models.RFC, error) {
	if req.ChangeRequestID == "" || req.RFCNumber == "" {
		return nil, errors.New("changeRequestId and rfcNumber are required")
	}
	rfc := &models.RFC{
		ChangeRequestID: req.ChangeRequestID,
		RFCNumber:       req.RFCNumber,
		Title:           req.Title,
		Description:     req.Description,
		Status:          req.Status,
		CreatedBy:       userID,
	}
	if err := s.repo.CreateRFC(ctx, tenantID, rfc); err != nil {
		return nil, err
	}
	return s.repo.GetRFC(ctx, tenantID, rfc.ID)
}

func (s *Service) GetRFC(ctx context.Context, tenantID, id string) (*models.RFC, error) {
	return s.repo.GetRFC(ctx, tenantID, id)
}

func (s *Service) ListRFCs(ctx context.Context, tenantID string, limit, offset int) (*models.ListResult[models.RFC], error) {
	return s.repo.ListRFCs(ctx, tenantID, limit, offset)
}

func (s *Service) UpdateRFC(ctx context.Context, tenantID, id string, req models.UpdateRFCRequest) (*models.RFC, error) {
	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if len(updates) == 0 {
		return s.GetRFC(ctx, tenantID, id)
	}
	return s.repo.UpdateRFC(ctx, tenantID, id, updates)
}

// --- CAB Meetings ---

func (s *Service) CreateCABMeeting(ctx context.Context, tenantID string, req models.CreateCABMeetingRequest, userID string) (*models.CABMeeting, error) {
	if req.Title == "" || req.ScheduledAt.IsZero() {
		return nil, errors.New("title and scheduledAt are required")
	}
	meeting := &models.CABMeeting{
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		ScheduledAt: req.ScheduledAt,
		CreatedBy:   userID,
	}
	if err := s.repo.CreateCABMeeting(ctx, tenantID, meeting); err != nil {
		return nil, err
	}
	return s.repo.GetCABMeeting(ctx, tenantID, meeting.ID)
}

func (s *Service) GetCABMeeting(ctx context.Context, tenantID, id string) (*models.CABMeeting, error) {
	return s.repo.GetCABMeeting(ctx, tenantID, id)
}

func (s *Service) ListCABMeetings(ctx context.Context, tenantID string, q models.CABMeetingListQuery) (*models.ListResult[models.CABMeeting], error) {
	return s.repo.ListCABMeetings(ctx, tenantID, q)
}

func (s *Service) UpdateCABMeeting(ctx context.Context, tenantID, id string, req models.UpdateCABMeetingRequest) (*models.CABMeeting, error) {
	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.ScheduledAt != nil {
		updates["scheduled_at"] = *req.ScheduledAt
	}
	if len(updates) == 0 {
		return s.GetCABMeeting(ctx, tenantID, id)
	}
	return s.repo.UpdateCABMeeting(ctx, tenantID, id, updates)
}

// --- CAB Decisions ---

func (s *Service) AddCABDecision(ctx context.Context, tenantID, cabID string, req models.CreateCABDecisionRequest) (*models.CABDecision, error) {
	if req.ChangeRequestID == "" || req.Decision == "" {
		return nil, errors.New("changeRequestId and decision are required")
	}
	decisions := map[string]bool{"approved": true, "rejected": true, "deferred": true}
	if !decisions[req.Decision] {
		return nil, errors.New("invalid decision: must be approved, rejected, or deferred")
	}
	decision, err := s.repo.AddCABDecision(ctx, tenantID, cabID, req.ChangeRequestID, req.Decision, req.Notes)
	if err != nil {
		return nil, err
	}
	return decision, nil
}

// --- Errors ---

var (
	ErrNotFound       = errors.New("not found")
	ErrChangeNotFound = fmt.Errorf("change request not found: %w", ErrNotFound)
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || repository.IsNotFound(err)
}
