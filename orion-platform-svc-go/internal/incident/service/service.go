package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/incident/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AddTimelineEvent(ctx context.Context, tenantID, incidentID string, req models.AddTimelineEventRequest, metadataJSON string) error
	ArchivePostmortem(ctx context.Context, tenantID, incidentID string) (*models.PostmortemRecord, error)
	AssignCommander(ctx context.Context, tenantID, id, commanderID string) error
	CheckSlaBreach(ctx context.Context, tenantID, incidentID string) (*models.SlaCheckResult, error)
	Create(ctx context.Context, tenantID string, m *models.Incident) error
	CreatePostmortem(ctx context.Context, tenantID, incidentID string, pm *models.PostmortemRecord) error
	Delete(ctx context.Context, tenantID, id string) error
	Escalate(ctx context.Context, tenantID, incidentID string, fromLevel, toLevel int, reason, escalatedBy string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Incident, error)
	GetEscalations(ctx context.Context, tenantID, incidentID string) ([]models.EscalationRecord, error)
	GetKnowledgeRecommendations(ctx context.Context, tenantID, incidentID string, limit int) ([]models.KnowledgeRecommendation, error)
	GetPostmortem(ctx context.Context, tenantID, incidentID string) (*models.PostmortemRecord, error)
	GetStats(ctx context.Context, tenantID string) (*models.IncidentStats, error)
	GetTimeline(ctx context.Context, tenantID, incidentID string, q models.TimelineQuery) ([]models.TimelineEvent, error)
	List(ctx context.Context, tenantID string, q models.IncidentListQuery) (*models.IncidentListResult, error)
	MarkSlaBreach(ctx context.Context, tenantID, incidentID string) error
	PostmortemExists(ctx context.Context, tenantID, incidentID string) (bool, error)
	PublishPostmortem(ctx context.Context, tenantID, incidentID string, reviewedBy *string) (*models.PostmortemRecord, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdatePostmortem(ctx context.Context, tenantID, incidentID string, updates map[string]interface{}) (*models.PostmortemRecord, error)
	UpdateStatus(ctx context.Context, tenantID, id, newStatus, actorID, reason string) error
}

// ErrIncidentNotFound wraps ErrNotFound for incident-specific lookups.
var ErrIncidentNotFound = errors.New("incident not found")

// ErrStateConflict is returned when a transition is not allowed.
var ErrStateConflict = errors.New("invalid state transition")

// ErrValidation is returned for invalid input.
var ErrValidation = errors.New("validation error")

// ErrAlreadyExists is returned when a resource already exists.
var ErrAlreadyExists = errors.New("already exists")

// Service orchestrates incident business logic.
type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Priority / severity helpers ---

// priorityMatrix maps impact x urgency to priority (p1..p4).
var priorityMatrix = map[string]map[string]string{
	"critical": {"critical": "p1", "high": "p1", "medium": "p2", "low": "p3"},
	"high":     {"critical": "p1", "high": "p2", "medium": "p2", "low": "p3"},
	"medium":   {"critical": "p2", "high": "p2", "medium": "p3", "low": "p4"},
	"low":      {"critical": "p3", "high": "p3", "medium": "p4", "low": "p4"},
}

func calcPriority(impact, urgency string) string {
	if row, ok := priorityMatrix[impact]; ok {
		if p, ok := row[urgency]; ok {
			return p
		}
	}
	return "p3"
}

// validTransitions defines allowed status transitions.
var validTransitions = map[string][]string{
	"open":          {"acknowledged", "resolved", "closed"},
	"acknowledged":  {"investigating", "resolved", "closed"},
	"investigating": {"on_hold", "resolved", "closed"},
	"on_hold":       {"investigating", "resolved", "closed"},
	"resolved":      {"closed", "open"},
	"closed":        {"open"},
}

func isValidTransition(current, next string) bool {
	allowed := validTransitions[current]
	for _, a := range allowed {
		if a == next {
			return true
		}
	}
	return false
}

// --- CRUD ---

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateIncidentRequest) (*models.Incident, error) {
	impact := req.Impact
	if impact == "" {
		impact = req.Severity // fallback
	}
	urgency := req.Urgency
	if urgency == "" {
		urgency = req.Severity // fallback
	}
	priority := calcPriority(impact, urgency)

	affectedJSON, _ := json.Marshal(req.AffectedServices)
	tagsJSON, _ := json.Marshal(req.Tags)

	postRequired := false
	if req.PostmortemRequired != nil {
		postRequired = *req.PostmortemRequired
	}

	m := &models.Incident{
		Title:              req.Title,
		Description:        req.Description,
		Type:               req.Type,
		Severity:           req.Severity,
		Priority:           priority,
		Status:             "open",
		Impact:             impact,
		Urgency:            urgency,
		AffectedServices:   string(affectedJSON),
		Tags:               string(tagsJSON),
		Environment:        req.Environment,
		Service:            req.Service,
		SlaBreach:          false,
		PostmortemRequired: postRequired,
	}

	if req.AssignedTeam != "" {
		m.AssignedTeam = &req.AssignedTeam
	}
	if req.DetectedBy != "" {
		m.DetectedBy = &req.DetectedBy
	}
	if req.ErrorMessage != "" {
		m.ErrorMessage = &req.ErrorMessage
	}

	if err := s.repo.Create(ctx, tenantID, m); err != nil {
		return nil, err
	}

	// Add initial timeline event
	_, _ = s.AddTimelineEvent(ctx, tenantID, m.ID, models.AddTimelineEventRequest{
		EventType: "system",
		Content:   fmt.Sprintf("Incident created with priority %s", priority),
		ActorID:   "system",
	})

	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Incident, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, q models.IncidentListQuery) (*models.IncidentListResult, error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}
	return s.repo.List(ctx, tenantID, q)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateIncidentRequest) (*models.Incident, error) {
	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Impact != nil {
		updates["impact"] = *req.Impact
	}
	if req.Urgency != nil {
		updates["urgency"] = *req.Urgency
	}
	if req.Environment != nil {
		updates["environment"] = *req.Environment
	}
	if req.Service != nil {
		updates["service"] = *req.Service
	}
	if req.AssignedTeam != nil {
		updates["assigned_team"] = *req.AssignedTeam
	}
	if req.RelatedProblemID != nil {
		updates["related_problem_id"] = *req.RelatedProblemID
	}
	if req.LinkedProblemID != nil {
		updates["linked_problem_id"] = *req.LinkedProblemID
	}
	if req.LinkedChangeID != nil {
		updates["linked_change_id"] = *req.LinkedChangeID
	}
	if req.PostmortemRequired != nil {
		updates["postmortem_required"] = *req.PostmortemRequired
	}

	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// --- Status ---

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id, newStatus, actorID, reason string) (*models.Incident, error) {
	incident, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if !isValidTransition(incident.Status, newStatus) {
		allowed := validTransitions[incident.Status]
		allowedStr := "none"
		if len(allowed) > 0 {
			allowedStr = strings.Join(allowed, ", ")
		}
		return nil, fmt.Errorf("invalid status transition: %s -> %s. Allowed: %s: %w", incident.Status, newStatus, allowedStr, ErrStateConflict)
	}

	if err := s.repo.UpdateStatus(ctx, tenantID, id, newStatus, actorID, reason); err != nil {
		return nil, err
	}

	// Add timeline event
	_, _ = s.AddTimelineEvent(ctx, tenantID, id, models.AddTimelineEventRequest{
		EventType: "status_change",
		Content:   fmt.Sprintf("Status changed from %s to %s", incident.Status, newStatus),
		ActorID:   actorID,
	})

	return s.repo.GetByID(ctx, tenantID, id)
}

// --- Assignment ---

func (s *Service) AssignCommander(ctx context.Context, tenantID, id, commanderID string) (*models.Incident, error) {
	if err := s.repo.AssignCommander(ctx, tenantID, id, commanderID); err != nil {
		return nil, err
	}
	incident, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	_, _ = s.AddTimelineEvent(ctx, tenantID, id, models.AddTimelineEventRequest{
		EventType: "assignment",
		Content:   fmt.Sprintf("Commander assigned: %s", commanderID),
		ActorID:   commanderID,
	})

	return incident, nil
}

// --- Escalation ---

func (s *Service) Escalate(ctx context.Context, tenantID, incidentID string, req models.EscalateRequest) error {
	if req.ToLevel < 0 || req.ToLevel > 5 {
		return fmt.Errorf("escalation level must be between 0 and 5: %w", ErrValidation)
	}

	incident, err := s.repo.GetByID(ctx, tenantID, incidentID)
	if err != nil {
		return err
	}

	if req.ToLevel <= incident.EscalationLevel {
		return fmt.Errorf("escalation level %d is not higher than current level %d: %w", req.ToLevel, incident.EscalationLevel, ErrValidation)
	}

	if err := s.repo.Escalate(ctx, tenantID, incidentID, incident.EscalationLevel, req.ToLevel, req.Reason, req.EscalatedBy); err != nil {
		return err
	}

	_, _ = s.AddTimelineEvent(ctx, tenantID, incidentID, models.AddTimelineEventRequest{
		EventType: "escalation",
		Content:   fmt.Sprintf("Escalated to level %d by %s: %s", req.ToLevel, req.EscalatedBy, req.Reason),
		ActorID:   req.EscalatedBy,
	})

	return nil
}

func (s *Service) GetEscalations(ctx context.Context, tenantID, incidentID string) ([]models.EscalationRecord, error) {
	return s.repo.GetEscalations(ctx, tenantID, incidentID)
}

// --- SLA ---

func (s *Service) CheckSlaBreach(ctx context.Context, tenantID, incidentID string) (*models.SlaCheckResult, error) {
	return s.repo.CheckSlaBreach(ctx, tenantID, incidentID)
}

func (s *Service) MarkSlaBreach(ctx context.Context, tenantID, incidentID string) (*models.Incident, error) {
	if err := s.repo.MarkSlaBreach(ctx, tenantID, incidentID); err != nil {
		return nil, err
	}

	_, _ = s.AddTimelineEvent(ctx, tenantID, incidentID, models.AddTimelineEventRequest{
		EventType: "sla_breach",
		Content:   "SLA breach marked",
		ActorID:   "system",
	})

	return s.repo.GetByID(ctx, tenantID, incidentID)
}

// --- Timeline ---

func (s *Service) AddTimelineEvent(ctx context.Context, tenantID, incidentID string, req models.AddTimelineEventRequest) (*models.TimelineEvent, error) {
	// Validate event type
	validEventTypes := []string{"status_change", "note", "escalation", "assignment", "update", "sla_breach", "system"}
	valid := false
	for _, t := range validEventTypes {
		if req.EventType == t {
			valid = true
			break
		}
	}
	if !valid {
		return nil, fmt.Errorf("invalid event type: %s: %w", req.EventType, ErrValidation)
	}

	metadataJSON := "{}"
	if req.Metadata != nil {
		b, err := json.Marshal(req.Metadata)
		if err == nil {
			metadataJSON = string(b)
		}
	}

	if err := s.repo.AddTimelineEvent(ctx, tenantID, incidentID, req, metadataJSON); err != nil {
		return nil, err
	}

	return &models.TimelineEvent{
		ID:         uuid.New().String(),
		IncidentID: incidentID,
		TenantID:   tenantID,
		EventType:  req.EventType,
		ActorID:    req.ActorID,
		Content:    req.Content,
		Metadata:   req.Metadata,
		CreatedAt:  time.Now().UTC(),
	}, nil
}

func (s *Service) GetTimeline(ctx context.Context, tenantID, incidentID string, q models.TimelineQuery) ([]models.TimelineEvent, error) {
	return s.repo.GetTimeline(ctx, tenantID, incidentID, q)
}

// --- Postmortem ---

func (s *Service) CreatePostmortem(ctx context.Context, tenantID, incidentID string, req models.CreatePostmortemRequest) (*models.PostmortemRecord, error) {
	exists, err := s.repo.PostmortemExists(ctx, tenantID, incidentID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("post-mortem already exists for incident %s: %w", incidentID, ErrAlreadyExists)
	}

	factorsJSON, _ := json.Marshal(req.ContributingFactors)

	pm := &models.PostmortemRecord{
		Summary:             req.Summary,
		RootCause:           req.RootCause,
		ContributingFactors: string(factorsJSON),
		TimelineSummary:     &req.TimelineSummary,
		Actions:             &req.Actions,
		LessonsLearned:      &req.LessonsLearned,
	}

	if req.Title != "" {
		pm.Title = &req.Title
	}
	if req.ImpactDescription != "" {
		pm.ImpactDescription = &req.ImpactDescription
	}
	if req.CreatedBy != "" {
		pm.CreatedBy = &req.CreatedBy
	}

	if err := s.repo.CreatePostmortem(ctx, tenantID, incidentID, pm); err != nil {
		return nil, err
	}

	_, _ = s.AddTimelineEvent(ctx, tenantID, incidentID, models.AddTimelineEventRequest{
		EventType: "system",
		Content:   "Post-mortem created",
		ActorID:   "system",
	})

	return pm, nil
}

func (s *Service) GetPostmortem(ctx context.Context, tenantID, incidentID string) (*models.PostmortemRecord, error) {
	return s.repo.GetPostmortem(ctx, tenantID, incidentID)
}

func (s *Service) UpdatePostmortem(ctx context.Context, tenantID, incidentID string, req models.UpdatePostmortemRequest) (*models.PostmortemRecord, error) {
	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Summary != nil {
		updates["summary"] = *req.Summary
	}
	if req.RootCause != nil {
		updates["root_cause"] = *req.RootCause
	}
	if req.ContributingFactors != nil {
		updates["contributing_factors"] = *req.ContributingFactors
	}
	if req.ImpactDescription != nil {
		updates["impact_description"] = *req.ImpactDescription
	}
	if req.TimelineSummary != nil {
		updates["timeline_summary"] = *req.TimelineSummary
	}
	if req.Actions != nil {
		updates["action_items"] = *req.Actions
	}
	if req.LessonsLearned != nil {
		updates["lessons_learned"] = *req.LessonsLearned
	}

	pm, err := s.repo.UpdatePostmortem(ctx, tenantID, incidentID, updates)
	if err != nil {
		return nil, err
	}

	if pm != nil && pm.Status != "draft" {
		return nil, fmt.Errorf("post-mortem is %s and cannot be updated: %w", pm.Status, ErrStateConflict)
	}

	return pm, nil
}

func (s *Service) PublishPostmortem(ctx context.Context, tenantID, incidentID string, reviewedBy *string) (*models.PostmortemRecord, error) {
	pm, err := s.repo.GetPostmortem(ctx, tenantID, incidentID)
	if err != nil {
		return nil, err
	}
	if pm.Status != "draft" {
		return nil, fmt.Errorf("post-mortem must be in draft status to publish: %w", ErrStateConflict)
	}

	published, err := s.repo.PublishPostmortem(ctx, tenantID, incidentID, reviewedBy)
	if err != nil {
		return nil, err
	}

	_, _ = s.AddTimelineEvent(ctx, tenantID, incidentID, models.AddTimelineEventRequest{
		EventType: "system",
		Content:   "Post-mortem published",
		ActorID:   "system",
	})

	return published, nil
}

func (s *Service) ArchivePostmortem(ctx context.Context, tenantID, incidentID string) (*models.PostmortemRecord, error) {
	pm, err := s.repo.GetPostmortem(ctx, tenantID, incidentID)
	if err != nil {
		return nil, err
	}
	if pm.Status != "published" {
		return nil, fmt.Errorf("post-mortem must be published to archive: %w", ErrStateConflict)
	}

	archived, err := s.repo.ArchivePostmortem(ctx, tenantID, incidentID)
	if err != nil {
		return nil, err
	}

	_, _ = s.AddTimelineEvent(ctx, tenantID, incidentID, models.AddTimelineEventRequest{
		EventType: "system",
		Content:   "Post-mortem archived",
		ActorID:   "system",
	})

	return archived, nil
}

// --- Statistics ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.IncidentStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}

// --- Knowledge recommendations ---

func (s *Service) GetKnowledgeRecommendations(ctx context.Context, tenantID, incidentID string, limit int) (*models.KnowledgeRecommendationResult, error) {
	recommendations, err := s.repo.GetKnowledgeRecommendations(ctx, tenantID, incidentID, limit)
	if err != nil {
		return nil, err
	}
	return &models.KnowledgeRecommendationResult{
		IncidentID:      incidentID,
		Limit:           limit,
		Recommendations: recommendations,
	}, nil
}

// --- Sentinel helpers for handler error routing ---

// IsNotFound returns true if the error indicates a resource was not found.
func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, ErrIncidentNotFound)
}

// IsStateConflict returns true if the error indicates a state conflict.
func IsStateConflict(err error) bool {
	return errors.Is(err, ErrStateConflict)
}

// IsValidationErr returns true if the error indicates a validation error.
func IsValidationErr(err error) bool {
	return errors.Is(err, ErrValidation)
}

// IsAlreadyExists returns true if the error indicates a duplicate resource.
func IsAlreadyExists(err error) bool {
	return errors.Is(err, ErrAlreadyExists)
}

// Helper: join string slice using stdlib
func stringsJoin(ss []string, sep string) string {
	return strings.Join(ss, sep)
}
