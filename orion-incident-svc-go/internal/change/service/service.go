package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"orion/incident-svc-go/internal/change/models"
	"orion/incident-svc-go/internal/change/repository"
)

var (
	ErrChangeRequestNotFound = errors.New("change request not found")
	ErrRFCNotFound           = errors.New("rfc not found")
	ErrCABMeetingNotFound    = errors.New("cab meeting not found")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ==================== Change Requests ====================

func (s *Service) CreateChangeRequest(ctx context.Context, tenantID, actorID string, req *models.CreateChangeRequestRequest) (*models.ChangeRequest, error) {
	d := &models.ChangeRequest{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Title:       req.Title,
		Description: req.Description,
		Type:        req.Type,
		Priority:    req.Priority,
		RiskLevel:   req.RiskLevel,
		Status:      "draft",
		AssignedTo:  req.AssignedTo,
		RequesterID: req.RequesterID,
		CreatedBy:   actorID,
	}
	if d.Type == "" {
		d.Type = "normal"
	}
	if d.Priority == "" {
		d.Priority = "medium"
	}
	if d.RiskLevel == "" {
		d.RiskLevel = "low"
	}
	return d, s.repo.CreateChangeRequest(ctx, d)
}

func (s *Service) ListChangeRequests(ctx context.Context, tenantID string, offset, limit int, filters map[string]string) ([]models.ChangeRequest, error) {
	return s.repo.ListChangeRequests(ctx, tenantID, offset, limit, filters)
}

func (s *Service) GetChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error) {
	return s.repo.GetChangeRequest(ctx, tenantID, id)
}

func (s *Service) UpdateChangeRequest(ctx context.Context, tenantID, id string, req *models.UpdateChangeRequestRequest) (*models.ChangeRequest, error) {
	existing, err := s.repo.GetChangeRequest(ctx, tenantID, id)
	if err != nil {
		return nil, ErrChangeRequestNotFound
	}
	if existing == nil {
		return nil, ErrChangeRequestNotFound
	}
	return s.repo.UpdateChangeRequest(ctx, tenantID, id, req)
}

func (s *Service) DeleteChangeRequest(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteChangeRequest(ctx, tenantID, id)
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id, status, actorID, reason string) (*models.ChangeRequest, error) {
	existing, err := s.repo.GetChangeRequest(ctx, tenantID, id)
	if err != nil {
		return nil, ErrChangeRequestNotFound
	}
	if existing == nil {
		return nil, ErrChangeRequestNotFound
	}
	return s.repo.UpdateChangeRequest(ctx, tenantID, id, &models.UpdateChangeRequestRequest{Status: &status})
}

// ==================== Timeline ====================

func (s *Service) AddTimelineEvent(ctx context.Context, tenantID, changeRequestID, eventType, description, actorID string) (*models.ChangeTimelineEvent, error) {
	e := &models.ChangeTimelineEvent{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		ChangeRequestID: changeRequestID,
		EventType:       eventType,
		Description:     description,
		ActorID:         actorID,
	}
	return e, s.repo.CreateTimelineEvent(ctx, e)
}

func (s *Service) GetTimeline(ctx context.Context, tenantID, changeRequestID string, offset, limit int) ([]models.ChangeTimelineEvent, error) {
	return s.repo.ListTimelineEvents(ctx, tenantID, changeRequestID, offset, limit)
}

// ==================== RFCs ====================

func (s *Service) CreateRFC(ctx context.Context, tenantID, actorID string, req *models.CreateRFCRequest) (*models.RFC, error) {
	d := &models.RFC{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		ChangeRequestID: req.ChangeRequestID,
		RFCNumber:       req.RFCNumber,
		Title:           req.Title,
		Description:     req.Description,
		Status:          "draft",
		CreatedBy:       actorID,
	}
	return d, s.repo.CreateRFC(ctx, d)
}

func (s *Service) ListRFCs(ctx context.Context, tenantID string, offset, limit int) ([]models.RFC, error) {
	return s.repo.ListRFCs(ctx, tenantID, offset, limit)
}

func (s *Service) GetRFC(ctx context.Context, tenantID, id string) (*models.RFC, error) {
	return s.repo.GetRFC(ctx, tenantID, id)
}

func (s *Service) UpdateRFC(ctx context.Context, tenantID, id string, req *models.UpdateRFCRequest) (*models.RFC, error) {
	_, err := s.repo.GetRFC(ctx, tenantID, id)
	if err != nil {
		return nil, ErrRFCNotFound
	}
	return s.repo.UpdateRFC(ctx, tenantID, id, req)
}

// ==================== CAB Meetings ====================

func (s *Service) CreateCABMeeting(ctx context.Context, tenantID, actorID string, req *models.CreateCABMeetingRequest) (*models.CABMeeting, error) {
	d := &models.CABMeeting{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Title:       req.Title,
		Description: req.Description,
		Status:      "scheduled",
		ScheduledAt: req.ScheduledAt,
		CreatedBy:   actorID,
	}
	return d, s.repo.CreateCABMeeting(ctx, d)
}

func (s *Service) ListCABMeetings(ctx context.Context, tenantID string, offset, limit int, status string) ([]models.CABMeeting, error) {
	return s.repo.ListCABMeetings(ctx, tenantID, offset, limit, status)
}

func (s *Service) GetCABMeeting(ctx context.Context, tenantID, id string) (*models.CABMeeting, error) {
	return s.repo.GetCABMeeting(ctx, tenantID, id)
}

func (s *Service) UpdateCABMeeting(ctx context.Context, tenantID, id string, req *models.UpdateCABMeetingRequest) (*models.CABMeeting, error) {
	_, err := s.repo.GetCABMeeting(ctx, tenantID, id)
	if err != nil {
		return nil, ErrCABMeetingNotFound
	}
	return s.repo.UpdateCABMeeting(ctx, tenantID, id, req)
}

// ==================== CAB Decisions ====================

func (s *Service) AddCABDecision(ctx context.Context, tenantID, cabMeetingID string, req *models.AddCABDecisionRequest) (*models.CABDecision, error) {
	d := &models.CABDecision{
		ID:              uuid.New().String(),
		CABMeetingID:    cabMeetingID,
		ChangeRequestID: req.ChangeRequestID,
		Decision:        req.Decision,
		Notes:           req.Notes,
	}
	return d, s.repo.AddCABDecision(ctx, d)
}

// ==================== Stats ====================

func (s *Service) GetStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	total, err := s.repo.CountChangeRequests(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"total_change_requests": total,
	}, nil
}