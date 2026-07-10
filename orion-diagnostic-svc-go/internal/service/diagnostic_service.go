package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"orion/diagnostic-svc-go/internal/models"
	"orion/diagnostic-svc-go/internal/repository"
	"time"

	"github.com/google/uuid"
)

var (
	ErrSessionNotFound = errors.New("diagnostic session not found")
	ErrReportNotFound  = errors.New("diagnostic report not found")
	ErrKnowledgeNotFound = errors.New("knowledge entry not found")
)

// Service orchestrates diagnostic operations.
type Service struct {
	sessionRepo *repository.SessionRepository
}

func NewService(sessionRepo *repository.SessionRepository) *Service {
	return &Service{sessionRepo: sessionRepo}
}

// CreateSession starts a new diagnostic session.
func (s *Service) CreateSession(ctx context.Context, tenantID string, req *models.CreateDiagnosticRequest) (*models.DiagnosticSession, error) {
	now := time.Now()
	symptomsJSON, _ := json.Marshal(req.Symptoms)

	session := &models.DiagnosticSession{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Title:       fmt.Sprintf("%s: %s", req.TriggerType, req.TriggerID),
		Status:      string(models.SessionStatusRunning),
		TriggerType: req.TriggerType,
		TriggerID:   req.TriggerID,
		Symptoms:    models.JSONText(symptomsJSON),
		Findings:    models.JSONText("[]"),
		StartedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}
	return session, nil
}

// GetSession retrieves a diagnostic session by ID.
func (s *Service) GetSession(ctx context.Context, tenantID, id string) (*models.DiagnosticSession, error) {
	return s.sessionRepo.GetByID(ctx, tenantID, id)
}

// ListSessions lists diagnostic sessions with optional filters.
func (s *Service) ListSessions(ctx context.Context, tenantID string, status, triggerType string, offset, limit int) ([]models.DiagnosticSession, error) {
	return s.sessionRepo.List(ctx, tenantID, status, triggerType, nil, offset, limit)
}

// CompleteSession marks a session as completed with findings.
func (s *Service) CompleteSession(ctx context.Context, tenantID, id string, findingsJSON string) (*models.DiagnosticSession, error) {
	session, err := s.sessionRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrSessionNotFound
	}
	completeAt := time.Now()
	session.Status = string(models.SessionStatusCompleted)
	session.Findings = models.JSONText(findingsJSON)
	session.CompletedAt = &completeAt
	if err := s.sessionRepo.Update(ctx, session); err != nil {
		return nil, fmt.Errorf("update session: %w", err)
	}
	return s.sessionRepo.GetByID(ctx, tenantID, id)
}

// AddSymptoms adds symptoms to an existing session.
func (s *Service) AddSymptoms(ctx context.Context, tenantID, sessionID string, symptoms []models.Symptom) error {
	symptomsJSON, _ := json.Marshal(symptoms)
	return s.sessionRepo.UpdateSymptoms(ctx, sessionID, tenantID, string(symptomsJSON))
}
