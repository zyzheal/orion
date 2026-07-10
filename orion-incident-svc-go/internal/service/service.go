package service

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/incident-svc-go/internal/models"
	"orion/incident-svc-go/internal/repository"
)

var (
	ErrIncidentNotFound   = errors.New("incident not found")
	ErrInvalidTransition  = errors.New("invalid status transition")
	ErrPostmortemNotFound = errors.New("postmortem not found")
	ErrPostmortemExists   = errors.New("postmortem already exists for this incident")
)

// IncidentService handles incident management business logic (ITIL-aligned lifecycle).
type IncidentService struct {
	incidentRepo     *repository.IncidentRepository
	timelineRepo     *repository.TimelineEventRepository
	postmortemRepo   *repository.PostmortemRepository
	escalationRepo   *repository.EscalationRepository
}

func NewIncidentService(
	incidentRepo *repository.IncidentRepository,
	timelineRepo *repository.TimelineEventRepository,
	postmortemRepo *repository.PostmortemRepository,
	escalationRepo *repository.EscalationRepository,
) *IncidentService {
	return &IncidentService{
		incidentRepo:   incidentRepo,
		timelineRepo:   timelineRepo,
		postmortemRepo: postmortemRepo,
		escalationRepo: escalationRepo,
	}
}

// ── Valid lifecycle transitions ──────────────────────────────────────────
var validTransitions = map[string][]string{
	"open":          {"acknowledged", "resolved", "closed"},
	"acknowledged":  {"investigating", "resolved", "closed"},
	"investigating": {"on_hold", "resolved", "closed"},
	"on_hold":       {"investigating", "resolved", "closed"},
	"resolved":      {"closed", "open"},
	"closed":        {"open"},
}

// ── Priority matrix (impact x urgency) ──────────────────────────────────
var priorityMatrix = map[string]map[string]string{
	"critical": {"critical": "p1", "high": "p1", "medium": "p2", "low": "p3"},
	"high":     {"critical": "p1", "high": "p2", "medium": "p2", "low": "p3"},
	"medium":   {"critical": "p2", "high": "p2", "medium": "p3", "low": "p4"},
	"low":      {"critical": "p3", "high": "p3", "medium": "p4", "low": "p4"},
}

// ── SLA thresholds (minutes) ────────────────────────────────────────────
var slaThresholds = map[string]int{
	"critical": 15,
	"high":     60,
	"medium":   240,
	"low":      1440,
}

// ── Valid event types ───────────────────────────────────────────────────
var validEventTypes = []string{"status_change", "note", "escalation", "assignment", "update", "sla_breach", "system"}

// ── IncidentResponse is the API-facing incident representation. ───────────
type IncidentResponse struct {
	ID                string     `json:"id"`
	TenantID          string     `json:"tenant_id"`
	DeploymentID      *string    `json:"deployment_id,omitempty"`
	PipelineRunID     *string    `json:"pipeline_run_id,omitempty"`
	CommitSHA         *string    `json:"commit_sha,omitempty"`
	Title             *string    `json:"title,omitempty"`
	Description       *string    `json:"description,omitempty"`
	Type              string     `json:"type"`
	Severity          string     `json:"severity"`
	Status            string     `json:"status"`
	Priority          *string    `json:"priority,omitempty"`
	Impact            *string    `json:"impact,omitempty"`
	Urgency           *string    `json:"urgency,omitempty"`
	Service           *string    `json:"service,omitempty"`
	Environment       *string    `json:"environment,omitempty"`
	ErrorMessage      *string    `json:"error_message,omitempty"`
	DetectedBy        *string    `json:"detected_by,omitempty"`
	AffectedServices  []string   `json:"affected_services"`
	Tags              []string   `json:"tags"`
	AssignedTeam      *string    `json:"assigned_team,omitempty"`
	CommanderID       *string    `json:"commander_id,omitempty"`
	RelatedProblemID  *string    `json:"related_problem_id,omitempty"`
	LinkedProblemID   *string    `json:"linked_problem_id,omitempty"`
	LinkedChangeID    *string    `json:"linked_change_id,omitempty"`
	PostmortemURL     *string    `json:"postmortem_url,omitempty"`
	PostmortemSummary *string    `json:"postmortem_summary,omitempty"`
	PostmortemRequired bool      `json:"postmortem_required"`
	EscalationLevel   int        `json:"escalation_level"`
	SLABreach         bool       `json:"sla_breach"`
	SLABreachAt       *time.Time `json:"sla_breach_at,omitempty"`
	ResolvedBy        *string    `json:"resolved_by,omitempty"`
	ClosedAt          *time.Time `json:"closed_at,omitempty"`
	ClosedBy          *string    `json:"closed_by,omitempty"`
	DetectedAt        time.Time  `json:"detected_at"`
	AcknowledgedAt    *time.Time `json:"acknowledged_at,omitempty"`
	ResolvedAt        *time.Time `json:"resolved_at,omitempty"`
	RecoveryTimeMs    *int64     `json:"recovery_time_ms,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// toResponse converts a DB model to API response.
func toResponse(inc *models.Incident) IncidentResponse {
	var affectedServices []string
	if len(inc.AffectedServices) > 0 {
		_ = json.Unmarshal(inc.AffectedServices, &affectedServices)
	}

	var tags []string
	if len(inc.Tags) > 0 {
		_ = json.Unmarshal(inc.Tags, &tags)
	}

	return IncidentResponse{
		ID:                inc.ID,
		TenantID:          inc.TenantID,
		DeploymentID:      inc.DeploymentID,
		PipelineRunID:     inc.PipelineRunID,
		CommitSHA:         inc.CommitSHA,
		Title:             inc.Title,
		Description:       inc.Description,
		Type:              inc.Type,
		Severity:          inc.Severity,
		Status:            inc.Status,
		Priority:          inc.Priority,
		Impact:            inc.Impact,
		Urgency:           inc.Urgency,
		Service:           inc.Service,
		Environment:       inc.Environment,
		ErrorMessage:      inc.ErrorMessage,
		DetectedBy:        inc.DetectedBy,
		AffectedServices:  affectedServices,
		Tags:              tags,
		AssignedTeam:      inc.AssignedTeam,
		CommanderID:       inc.CommanderID,
		RelatedProblemID:  inc.RelatedProblemID,
		LinkedProblemID:   inc.LinkedProblemID,
		LinkedChangeID:    inc.LinkedChangeID,
		PostmortemURL:     inc.PostmortemURL,
		PostmortemSummary: inc.PostmortemSummary,
		PostmortemRequired: inc.PostmortemRequired,
		EscalationLevel:   inc.EscalationLevel,
		SLABreach:         inc.SLABreach,
		SLABreachAt:       inc.SLABreachAt,
		ResolvedBy:        inc.ResolvedBy,
		ClosedAt:          inc.ClosedAt,
		ClosedBy:          inc.ClosedBy,
		DetectedAt:        inc.DetectedAt,
		AcknowledgedAt:    inc.AcknowledgedAt,
		ResolvedAt:        inc.ResolvedAt,
		RecoveryTimeMs:    inc.RecoveryTimeMs,
		CreatedAt:         inc.CreatedAt,
		UpdatedAt:         inc.UpdatedAt,
	}
}

// toResponseSlice converts a slice of DB models to API responses.
func toResponseSlice(incidents []models.Incident) []IncidentResponse {
	result := make([]IncidentResponse, len(incidents))
	for i, inc := range incidents {
		result[i] = toResponse(&inc)
	}
	return result
}

// ── Create Incident ─────────────────────────────────────────────────────
func (s *IncidentService) CreateIncident(ctx context.Context, req models.CreateIncidentRequest, tenantID string) (*IncidentResponse, error) {
	impact := req.Impact
	urgency := req.Urgency
	if impact == nil || *impact == "" {
		impact = strPtr("medium")
	}
	if urgency == nil || *urgency == "" {
		urgency = strPtr("medium")
	}

	priority := calculatePriority(*impact, *urgency)

	now := time.Now().UTC()
	incident := &models.Incident{
		ID:                newID(),
		TenantID:          tenantID,
		Title:             &req.Title,
		Type:              req.Type,
		Severity:          req.Severity,
		Status:            "open",
		Priority:          &priority,
		Impact:            impact,
		Urgency:           urgency,
		PostmortemRequired: req.PostmortemRequired != nil && *req.PostmortemRequired,
		EscalationLevel:   0,
		SLABreach:         false,
		DetectedAt:        now,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if req.Description != nil {
		incident.Description = req.Description
	}
	if req.Service != nil {
		incident.Service = req.Service
	}
	if req.Environment != nil {
		incident.Environment = req.Environment
	}
	if req.ErrorMessage != nil {
		incident.ErrorMessage = req.ErrorMessage
	}
	if req.DetectedBy != nil {
		incident.DetectedBy = req.DetectedBy
	}
	if req.AssignedTeam != nil {
		incident.AssignedTeam = req.AssignedTeam
	}
	if req.DeploymentID != nil {
		incident.DeploymentID = req.DeploymentID
	}
	if req.PipelineRunID != nil {
		incident.PipelineRunID = req.PipelineRunID
	}
	if req.CommitSHA != nil {
		incident.CommitSHA = req.CommitSHA
	}

	if len(req.AffectedServices) > 0 {
		incident.AffectedServices, _ = json.Marshal(req.AffectedServices)
	}
	if len(req.Tags) > 0 {
		incident.Tags, _ = json.Marshal(req.Tags)
	}

	if err := s.incidentRepo.Create(ctx, incident); err != nil {
		return nil, fmt.Errorf("failed to create incident: %w", err)
	}

	// Log creation in timeline
	timelineEvent := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: incident.ID,
		TenantID:   tenantID,
		EventType:  "status_change",
		ActorID:    nil,
		Content:    fmt.Sprintf(`Incident created with status "open", priority "%s"`, priority),
		Metadata:   []byte(`{}`),
		CreatedAt:  now,
	}
	_ = s.timelineRepo.Create(ctx, timelineEvent)

	resp := toResponse(incident)
	return &resp, nil
}

// ── Get Incident ────────────────────────────────────────────────────────
func (s *IncidentService) GetIncident(ctx context.Context, id, tenantID string) (*IncidentResponse, error) {
	incident, err := s.incidentRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}
	resp := toResponse(incident)
	return &resp, nil
}

// ── List Incidents ──────────────────────────────────────────────────────
func (s *IncidentService) ListIncidents(ctx context.Context, tenantID string, filters models.IncidentListFilters) ([]IncidentResponse, error) {
	filters.Limit = normalizeLimit(filters.Limit)
	filters.Offset = normalizeOffset(filters.Offset)

	incidents, err := s.incidentRepo.List(ctx, tenantID, filters)
	if err != nil {
		return nil, fmt.Errorf("failed to list incidents: %w", err)
	}

	if incidents == nil {
		return []IncidentResponse{}, nil
	}
	return toResponseSlice(incidents), nil
}

// ── Update Incident ─────────────────────────────────────────────────────
func (s *IncidentService) UpdateIncident(ctx context.Context, id, tenantID string, req models.UpdateIncidentRequest) (*IncidentResponse, error) {
	incident, err := s.incidentRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}

	if req.Title != nil {
		incident.Title = req.Title
	}
	if req.Description != nil {
		incident.Description = req.Description
	}
	if req.Severity != nil {
		incident.Severity = *req.Severity
	}
	if req.Service != nil {
		incident.Service = req.Service
	}
	if req.Environment != nil {
		incident.Environment = req.Environment
	}
	if req.ErrorMessage != nil {
		incident.ErrorMessage = req.ErrorMessage
	}
	if req.DetectedBy != nil {
		incident.DetectedBy = req.DetectedBy
	}
	if req.AssignedTeam != nil {
		incident.AssignedTeam = req.AssignedTeam
	}
	if req.RelatedProblemID != nil {
		incident.RelatedProblemID = req.RelatedProblemID
	}
	if req.LinkedProblemID != nil {
		incident.LinkedProblemID = req.LinkedProblemID
	}
	if req.LinkedChangeID != nil {
		incident.LinkedChangeID = req.LinkedChangeID
	}
	if req.PostmortemURL != nil {
		incident.PostmortemURL = req.PostmortemURL
	}
	if req.PostmortemSummary != nil {
		incident.PostmortemSummary = req.PostmortemSummary
	}
	if req.PostmortemRequired != nil {
		incident.PostmortemRequired = *req.PostmortemRequired
	}

	// Recalculate priority if impact or urgency changed
	if req.Impact != nil || req.Urgency != nil {
		impact := incident.Impact
		urgency := incident.Urgency
		if req.Impact != nil && *req.Impact != "" {
			impact = req.Impact
		}
		if req.Urgency != nil && *req.Urgency != "" {
			urgency = req.Urgency
		}
		priority := calculatePriority(strDeref(impact, "medium"), strDeref(urgency, "medium"))
		incident.Priority = &priority
	}

	if req.AffectedServices != nil {
		incident.AffectedServices, _ = json.Marshal(req.AffectedServices)
	}
	if req.Tags != nil {
		incident.Tags, _ = json.Marshal(req.Tags)
	}

	incident.UpdatedAt = time.Now().UTC()

	if err := s.incidentRepo.Update(ctx, incident); err != nil {
		return nil, fmt.Errorf("failed to update incident: %w", err)
	}

	// Log update in timeline
	now := time.Now().UTC()
	updatedFields := []string{}
	if req.Title != nil { updatedFields = append(updatedFields, "title") }
	if req.Description != nil { updatedFields = append(updatedFields, "description") }
	if req.Severity != nil { updatedFields = append(updatedFields, "severity") }
	if req.Service != nil { updatedFields = append(updatedFields, "service") }
	if req.Environment != nil { updatedFields = append(updatedFields, "environment") }

	timelineEvent := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: incident.ID,
		TenantID:   tenantID,
		EventType:  "update",
		ActorID:    nil,
		Content:    fmt.Sprintf("Incident updated: %s", joinStrings(updatedFields, ", ")),
		Metadata:   []byte(fmt.Sprintf(`{"fields":["%s"]}`, joinStrings(updatedFields, `","`))),
		CreatedAt:  now,
	}
	_ = s.timelineRepo.Create(ctx, timelineEvent)

	resp := toResponse(incident)
	return &resp, nil
}

// ── Delete Incident ─────────────────────────────────────────────────────
func (s *IncidentService) DeleteIncident(ctx context.Context, id, tenantID string) error {
	if err := s.incidentRepo.SoftDelete(ctx, id, tenantID); err != nil {
		return fmt.Errorf("failed to delete incident: %w", err)
	}
	return nil
}

// ── Update Status (with lifecycle validation) ───────────────────────────
func (s *IncidentService) UpdateStatus(ctx context.Context, id, tenantID string, req models.UpdateStatusRequest) (*IncidentResponse, error) {
	incident, err := s.incidentRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}

	// Validate status transition
	allowed, ok := validTransitions[incident.Status]
	if !ok || !contains(allowed, req.Status) {
		return nil, fmt.Errorf("%w: %s -> %s. Allowed: %v", ErrInvalidTransition, incident.Status, req.Status, allowed)
	}

	now := time.Now().UTC()
	updateFields := []string{"status = $1", "updated_at = $2"}
	args := []interface{}{req.Status, now}
	argIdx := 3

	if req.Status == "acknowledged" && incident.AcknowledgedAt == nil {
		updateFields = append(updateFields, fmt.Sprintf("acknowledged_at = $%d", argIdx))
		args = append(args, now)
		argIdx++
		incident.AcknowledgedAt = &now
	}
	if req.Status == "resolved" {
		updateFields = append(updateFields, fmt.Sprintf("resolved_at = $%d", argIdx))
		args = append(args, now)
		argIdx++
		incident.ResolvedAt = &now
		recoveryMs := now.Sub(incident.DetectedAt).Milliseconds()
		updateFields = append(updateFields, fmt.Sprintf("recovery_time_ms = $%d", argIdx))
		args = append(args, recoveryMs)
		argIdx++
		incident.RecoveryTimeMs = &recoveryMs
		if req.ActorID != "" {
			updateFields = append(updateFields, fmt.Sprintf("resolved_by = $%d", argIdx))
			args = append(args, req.ActorID)
			argIdx++
			incident.ResolvedBy = &req.ActorID
		}
	}
	if req.Status == "closed" {
		updateFields = append(updateFields, fmt.Sprintf("closed_at = $%d", argIdx))
		args = append(args, now)
		argIdx++
		incident.ClosedAt = &now
		if req.ActorID != "" {
			updateFields = append(updateFields, fmt.Sprintf("closed_by = $%d", argIdx))
			args = append(args, req.ActorID)
			argIdx++
			incident.ClosedBy = &req.ActorID
		}
	}

	args = append(args, id, tenantID)

	query := fmt.Sprintf("UPDATE incidents SET %s WHERE id = $%d AND tenant_id = $%d RETURNING *",
		joinStrings(updateFields, ", "), argIdx, argIdx+1)

	rows, err := s.incidentRepo.DB().NamedQueryContext(ctx, query, map[string]interface{}{
		"id": id,
	})
	// Use direct query since NamedQuery doesn't work well with dynamic column lists
	_ = rows

	// Use direct DB query for dynamic updates
	directQuery := fmt.Sprintf("UPDATE incidents SET %s WHERE id = $%d AND tenant_id = $%d RETURNING *",
		joinStrings(updateFields, ", "), argIdx, argIdx+1)

	err = s.incidentRepo.DB().GetContext(ctx, incident, directQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update incident status: %w", err)
	}

	// Log status change in timeline
	statusContent := req.Status
	if req.Reason != "" {
		statusContent = fmt.Sprintf("Status changed: %s -> %s: %s", incident.Status, req.Status, req.Reason)
	} else {
		statusContent = fmt.Sprintf("Status changed: %s -> %s", incident.Status, req.Status)
	}

	timelineEvent := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: id,
		TenantID:   tenantID,
		EventType:  "status_change",
		ActorID:    strPtrOrNil(req.ActorID),
		Content:    statusContent,
		Metadata:   []byte(fmt.Sprintf(`{"from":"%s","to":"%s","reason":"%s"}`, incident.Status, req.Status, escapeJSON(req.Reason))),
		CreatedAt:  now,
	}
	_ = s.timelineRepo.Create(ctx, timelineEvent)

	// Auto-require postmortem for critical incidents on resolution
	if req.Status == "resolved" && incident.Severity == "critical" && !incident.PostmortemRequired {
		_, _ = s.incidentRepo.DB().ExecContext(ctx,
			"UPDATE incidents SET postmortem_required = TRUE, updated_at = now() WHERE id = $1", id)
		incident.PostmortemRequired = true
	}

	resp := toResponse(incident)
	return &resp, nil
}

// ── Assign Commander ────────────────────────────────────────────────────
func (s *IncidentService) AssignCommander(ctx context.Context, id, tenantID, commanderID string) (*IncidentResponse, error) {
	_, err := s.incidentRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}

	now := time.Now().UTC()
	_, err = s.incidentRepo.DB().ExecContext(ctx,
		"UPDATE incidents SET commander_id = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4 RETURNING *",
		commanderID, now, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to assign commander: %w", err)
	}

	incident, _ := s.incidentRepo.GetByID(ctx, id, tenantID)

	// Log assignment in timeline
	timelineEvent := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: id,
		TenantID:   tenantID,
		EventType:  "assignment",
		ActorID:    &commanderID,
		Content:    fmt.Sprintf("Incident commander assigned: %s", commanderID),
		Metadata:   []byte(fmt.Sprintf(`{"commander_id":"%s"}`, commanderID)),
		CreatedAt:  now,
	}
	_ = s.timelineRepo.Create(ctx, timelineEvent)

	resp := toResponse(incident)
	return &resp, nil
}

// ── Add Timeline Event ──────────────────────────────────────────────────
func (s *IncidentService) AddTimelineEvent(ctx context.Context, incidentID, tenantID, eventType, content, actorID string, metadata map[string]interface{}) (*models.TimelineEvent, error) {
	_, err := s.incidentRepo.GetByID(ctx, incidentID, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}

	if !contains(validEventTypes, eventType) {
		return nil, fmt.Errorf("invalid event type: %s. Must be one of: %v", eventType, validEventTypes)
	}

	metaBytes, _ := json.Marshal(metadata)
	if metaBytes == nil {
		metaBytes = []byte(`{}`)
	}

	now := time.Now().UTC()
	event := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: incidentID,
		TenantID:   tenantID,
		EventType:  eventType,
		ActorID:    strPtrOrNil(actorID),
		Content:    content,
		Metadata:   metaBytes,
		CreatedAt:  now,
	}

	if err := s.timelineRepo.Create(ctx, event); err != nil {
		return nil, fmt.Errorf("failed to create timeline event: %w", err)
	}

	return event, nil
}

// ── Get Timeline ────────────────────────────────────────────────────────
func (s *IncidentService) GetTimeline(ctx context.Context, incidentID, tenantID string, limit, offset int) ([]models.TimelineEvent, error) {
	if limit <= 0 {
		limit = 100
	}
	_, err := s.incidentRepo.GetByID(ctx, incidentID, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}

	events, err := s.timelineRepo.FindByIncident(ctx, incidentID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get timeline: %w", err)
	}
	if events == nil {
		return []models.TimelineEvent{}, nil
	}
	return events, nil
}

// ── Escalate Incident ───────────────────────────────────────────────────
func (s *IncidentService) EscalateIncident(ctx context.Context, id, tenantID string, req models.EscalateRequest) error {
	incident, err := s.incidentRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return ErrIncidentNotFound
	}

	currentLevel := incident.EscalationLevel
	if req.ToLevel <= currentLevel {
		return fmt.Errorf("cannot escalate to level %d: current level is %d", req.ToLevel, currentLevel)
	}
	if req.ToLevel > 5 {
		return fmt.Errorf("maximum escalation level is 5")
	}

	// Insert escalation record
	now := time.Now().UTC()
	escalation := &models.EscalationRecord{
		ID:           newID(),
		IncidentID:   id,
		TenantID:     tenantID,
		FromLevel:    currentLevel,
		ToLevel:      req.ToLevel,
		Reason:       &req.Reason,
		EscalatedBy:  req.EscalatedBy,
		EscalatedAt:  now,
	}
	if err := s.escalationRepo.Create(ctx, escalation); err != nil {
		return fmt.Errorf("failed to record escalation: %w", err)
	}

	// Update incident escalation level
	_, _ = s.incidentRepo.DB().ExecContext(ctx,
		"UPDATE incidents SET escalation_level = $1, updated_at = $2 WHERE id = $3",
		req.ToLevel, now, id)

	// Log in timeline
	timelineEvent := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: id,
		TenantID:   tenantID,
		EventType:  "escalation",
		ActorID:    &req.EscalatedBy,
		Content:    fmt.Sprintf("Incident escalated from level %d to %d: %s", currentLevel, req.ToLevel, req.Reason),
		Metadata:   []byte(fmt.Sprintf(`{"from_level":%d,"to_level":%d,"reason":"%s"}`, currentLevel, req.ToLevel, escapeJSON(req.Reason))),
		CreatedAt:  now,
	}
	_ = s.timelineRepo.Create(ctx, timelineEvent)

	return nil
}

// ── Get Escalation History ──────────────────────────────────────────────
func (s *IncidentService) GetEscalationHistory(ctx context.Context, incidentID, tenantID string) ([]models.EscalationRecord, error) {
	_, err := s.incidentRepo.GetByID(ctx, incidentID, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}

	records, err := s.escalationRepo.FindByIncident(ctx, incidentID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get escalation history: %w", err)
	}
	if records == nil {
		return []models.EscalationRecord{}, nil
	}
	return records, nil
}

// ── SLA Breach Check ────────────────────────────────────────────────────
func (s *IncidentService) CheckSLABreach(ctx context.Context, id, tenantID string) (*models.SLAStatus, error) {
	incident, err := s.incidentRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}

	threshold := slaThresholds[incident.Severity]
	if threshold == 0 {
		threshold = slaThresholds["medium"]
	}

	elapsedMinutes := int(time.Since(incident.DetectedAt).Minutes())
	breached := elapsedMinutes > threshold && incident.Status != "resolved" && incident.Status != "closed"

	return &models.SLAStatus{
		Breached:         breached,
		ThresholdMinutes: threshold,
		ElapsedMinutes:   elapsedMinutes,
	}, nil
}

// ── Mark SLA Breach ─────────────────────────────────────────────────────
func (s *IncidentService) MarkSLABreach(ctx context.Context, id, tenantID string) (*IncidentResponse, error) {
	incident, err := s.incidentRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}

	now := time.Now().UTC()
	_, err = s.incidentRepo.DB().ExecContext(ctx,
		"UPDATE incidents SET sla_breach = TRUE, sla_breach_at = $1, updated_at = $2 WHERE id = $3",
		now, now, id)
	if err != nil {
		return nil, fmt.Errorf("failed to mark SLA breach: %w", err)
	}

	// Refresh incident
	incident, _ = s.incidentRepo.GetByID(ctx, id, tenantID)

	// Log in timeline
	timelineEvent := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: id,
		TenantID:   tenantID,
		EventType:  "sla_breach",
		ActorID:    strPtr("system"),
		Content:    fmt.Sprintf("SLA breach detected for %s severity incident", incident.Severity),
		Metadata:   []byte(fmt.Sprintf(`{"severity":"%s","threshold_minutes":%d}`, incident.Severity, slaThresholds[incident.Severity])),
		CreatedAt:  now,
	}
	_ = s.timelineRepo.Create(ctx, timelineEvent)

	resp := toResponse(incident)
	return &resp, nil
}

// ── Create Postmortem ───────────────────────────────────────────────────
func (s *IncidentService) CreatePostmortem(ctx context.Context, incidentID, tenantID string, req models.CreatePostmortemRequest) (*models.PostmortemRecord, error) {
	_, err := s.incidentRepo.GetByID(ctx, incidentID, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}

	existing, _ := s.postmortemRepo.FindByIncident(ctx, incidentID)
	if existing != nil {
		return nil, ErrPostmortemExists
	}

	now := time.Now().UTC()
	record := &models.PostmortemRecord{
		ID:         newID(),
		IncidentID: incidentID,
		TenantID:   tenantID,
		Summary:    req.Summary,
		RootCause:  req.RootCause,
		Status:     "draft",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if req.Title != nil {
		record.Title = req.Title
	}
	if req.ContributingFactors != nil {
		record.ContributingFactors, _ = json.Marshal(req.ContributingFactors)
	}
	if req.ImpactDescription != nil {
		record.ImpactDescription = req.ImpactDescription
	}
	if req.Timeline != nil {
		record.Timeline = req.Timeline
	}
	if req.TimelineSummary != nil {
		record.TimelineSummary = req.TimelineSummary
	}
	if req.ActionItems != nil {
		record.ActionItems = req.ActionItems
	}
	if req.LessonsLearned != nil {
		record.LessonsLearned = req.LessonsLearned
	}
	if req.CreatedBy != nil {
		record.CreatedBy = req.CreatedBy
	}

	if err := s.postmortemRepo.Create(ctx, record); err != nil {
		return nil, fmt.Errorf("failed to create postmortem: %w", err)
	}

	// Log in timeline
	timelineEvent := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: incidentID,
		TenantID:   tenantID,
		EventType:  "update",
		ActorID:    record.CreatedBy,
		Content:    fmt.Sprintf("Post-mortem draft created: %q", strDeref(record.Title, "Untitled")),
		Metadata:   []byte(fmt.Sprintf(`{"postmortem_id":"%s"}`, record.ID)),
		CreatedAt:  now,
	}
	_ = s.timelineRepo.Create(ctx, timelineEvent)

	return record, nil
}

// ── Get Postmortem ──────────────────────────────────────────────────────
func (s *IncidentService) GetPostmortem(ctx context.Context, incidentID, tenantID string) (*models.PostmortemRecord, error) {
	_, err := s.incidentRepo.GetByID(ctx, incidentID, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}

	record, err := s.postmortemRepo.FindByIncident(ctx, incidentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get postmortem: %w", err)
	}
	if record == nil {
		return nil, ErrPostmortemNotFound
	}
	return record, nil
}

// ── Update Postmortem (draft only) ──────────────────────────────────────
func (s *IncidentService) UpdatePostmortem(ctx context.Context, incidentID, tenantID string, updates map[string]interface{}) (*models.PostmortemRecord, error) {
	record, err := s.postmortemRepo.FindByIncident(ctx, incidentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get postmortem: %w", err)
	}
	if record == nil {
		return nil, ErrPostmortemNotFound
	}
	if record.Status != "draft" {
		return nil, fmt.Errorf("cannot update postmortem in %q status. Only draft postmortems can be edited", record.Status)
	}

	// Apply updates
	if v, ok := updates["title"].(string); ok {
		record.Title = &v
	}
	if v, ok := updates["summary"].(string); ok && v != "" {
		record.Summary = v
	}
	if v, ok := updates["root_cause"].(string); ok && v != "" {
		record.RootCause = v
	}
	if v, ok := updates["contributing_factors"].([]string); ok {
		record.ContributingFactors, _ = json.Marshal(v)
	}
	if v, ok := updates["impact_description"].(string); ok {
		record.ImpactDescription = &v
	}
	if v, ok := updates["timeline"].([]byte); ok {
		record.Timeline = v
	}
	if v, ok := updates["timeline_summary"].(string); ok {
		record.TimelineSummary = &v
	}
	if v, ok := updates["action_items"].([]byte); ok {
		record.ActionItems = v
	}
	if v, ok := updates["lessons_learned"].(string); ok {
		record.LessonsLearned = &v
	}

	record.UpdatedAt = time.Now().UTC()

	if err := s.postmortemRepo.Update(ctx, record); err != nil {
		return nil, fmt.Errorf("failed to update postmortem: %w", err)
	}

	return record, nil
}

// ── Publish Postmortem ──────────────────────────────────────────────────
func (s *IncidentService) PublishPostmortem(ctx context.Context, incidentID, tenantID, reviewedBy string) (*models.PostmortemRecord, error) {
	record, err := s.postmortemRepo.FindByIncident(ctx, incidentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get postmortem: %w", err)
	}
	if record == nil {
		return nil, ErrPostmortemNotFound
	}
	if record.Status != "draft" {
		return nil, fmt.Errorf("cannot publish postmortem in %q status. Only draft postmortems can be published", record.Status)
	}

	now := time.Now().UTC()
	rb := strPtr(reviewedBy)
	if err := s.postmortemRepo.Publish(ctx, &record.ID, rb); err != nil {
		return nil, fmt.Errorf("failed to publish postmortem: %w", err)
	}

	record.Status = "published"
	record.PublishedAt = &now
	record.ReviewedBy = &reviewedBy
	record.UpdatedAt = now

	// Log in timeline
	timelineEvent := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: incidentID,
		TenantID:   tenantID,
		EventType:  "update",
		ActorID:    &reviewedBy,
		Content:    "Post-mortem published",
		Metadata:   []byte(fmt.Sprintf(`{"postmortem_id":"%s"}`, record.ID)),
		CreatedAt:  now,
	}
	_ = s.timelineRepo.Create(ctx, timelineEvent)

	return record, nil
}

// ── Archive Postmortem ──────────────────────────────────────────────────
func (s *IncidentService) ArchivePostmortem(ctx context.Context, incidentID, tenantID string) (*models.PostmortemRecord, error) {
	record, err := s.postmortemRepo.FindByIncident(ctx, incidentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get postmortem: %w", err)
	}
	if record == nil {
		return nil, ErrPostmortemNotFound
	}
	if record.Status != "published" {
		return nil, fmt.Errorf("cannot archive postmortem in %q status. Only published postmortems can be archived", record.Status)
	}

	if err := s.postmortemRepo.Archive(ctx, record.ID); err != nil {
		return nil, fmt.Errorf("failed to archive postmortem: %w", err)
	}

	record.Status = "archived"
	record.UpdatedAt = time.Now().UTC()

	return record, nil
}

// ── Statistics ──────────────────────────────────────────────────────────
func (s *IncidentService) GetStats(ctx context.Context, tenantID string) (*models.IncidentStats, error) {
	stats := &models.IncidentStats{
		ByStatus:   map[string]int{},
		BySeverity: map[string]int{},
		ByPriority: map[string]int{},
		Trends:     []models.TrendPoint{},
	}

	s.countByStatus(ctx, tenantID, stats)
	s.countBySeverity(ctx, tenantID, stats)
	s.countByPriority(ctx, tenantID, stats)
	stats.SLABreachCount = s.getSLABreachCount(ctx, tenantID)
	stats.EscalationCount = s.getEscalationCount(ctx, tenantID)
	stats.MTTR = s.getMTTRStats(ctx, tenantID)
	stats.Trends = s.getTrends(ctx, tenantID)

	return stats, nil
}


// countByStatus queries incident status counts and updates stats.
func (s *IncidentService) countByStatus(ctx context.Context, tenantID string, stats *models.IncidentStats) {
	rows, err := s.incidentRepo.DB().QueryContext(ctx,
		"SELECT status, COUNT(*) as count FROM incidents WHERE tenant_id = $1 GROUP BY status", tenantID)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err == nil {
			stats.ByStatus[status] = count
			stats.Total += count
		}
	}
}

// countBySeverity queries incident severity counts and updates stats.
func (s *IncidentService) countBySeverity(ctx context.Context, tenantID string, stats *models.IncidentStats) {
	rows, err := s.incidentRepo.DB().QueryContext(ctx,
		"SELECT severity, COUNT(*) as count FROM incidents WHERE tenant_id = $1 GROUP BY severity", tenantID)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var severity string
		var count int
		if err := rows.Scan(&severity, &count); err == nil {
			stats.BySeverity[severity] = count
		}
	}
}

// countByPriority queries incident priority counts and updates stats.
func (s *IncidentService) countByPriority(ctx context.Context, tenantID string, stats *models.IncidentStats) {
	rows, err := s.incidentRepo.DB().QueryContext(ctx,
		"SELECT priority, COUNT(*) as count FROM incidents WHERE tenant_id = $1 GROUP BY priority", tenantID)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var priority sql.NullString
		var count int
		if err := rows.Scan(&priority, &count); err == nil && priority.Valid {
			stats.ByPriority[priority.String] = count
		}
	}
}

// getSLABreachCount returns the number of incidents with SLA breaches.
func (s *IncidentService) getSLABreachCount(ctx context.Context, tenantID string) int {
	var count int
	rows, err := s.incidentRepo.DB().QueryContext(ctx,
		"SELECT COUNT(*) FROM incidents WHERE tenant_id = $1 AND sla_breach = TRUE", tenantID)
	if err != nil {
		return 0
	}
	defer rows.Close()
	if rows.Next() {
		_ = rows.Scan(&count)
	}
	return count
}

// getEscalationCount returns the number of escalations for a tenant.
func (s *IncidentService) getEscalationCount(ctx context.Context, tenantID string) int {
	var count int
	rows, err := s.incidentRepo.DB().QueryContext(ctx,
		"SELECT COUNT(*) FROM incident_escalations WHERE tenant_id = $1", tenantID)
	if err != nil {
		return 0
	}
	defer rows.Close()
	if rows.Next() {
		_ = rows.Scan(&count)
	}
	return count
}

// getMTTRStats computes MTTR statistics (avg, median, p90, p99) for resolved incidents.
func (s *IncidentService) getMTTRStats(ctx context.Context, tenantID string) models.MTTRStats {
	rows, err := s.incidentRepo.DB().QueryContext(ctx,
		`SELECT
			COUNT(*) as total,
			AVG(recovery_time_ms) as avg_ms,
			PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY recovery_time_ms) as median_ms,
			PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY recovery_time_ms) as p90_ms,
			PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY recovery_time_ms) as p99_ms
		FROM incidents
		WHERE tenant_id = $1 AND status IN ('resolved','closed') AND recovery_time_ms IS NOT NULL`,
		tenantID)
	if err != nil {
		return models.MTTRStats{}
	}
	defer rows.Close()
	if rows.Next() {
		var avgMs, medianMs, p90Ms, p99Ms sql.NullFloat64
		var total int
		if err := rows.Scan(&total, &avgMs, &medianMs, &p90Ms, &p99Ms); err == nil {
			return models.MTTRStats{
				AvgMs:    nullFloat64ToFloat64(avgMs),
				MedianMs: nullFloat64ToFloat64(medianMs),
				P90Ms:    nullFloat64ToFloat64(p90Ms),
				P99Ms:    nullFloat64ToFloat64(p99Ms),
			}
		}
	}
	return models.MTTRStats{}
}

// getTrends computes daily incident trends for the last 7 days.
func (s *IncidentService) getTrends(ctx context.Context, tenantID string) []models.TrendPoint {
	rows, err := s.incidentRepo.DB().QueryContext(ctx,
		`SELECT
			TO_CHAR(DATE_TRUNC('day', detected_at), 'YYYY-MM-DD') as period,
			SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as opened,
			SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) as resolved
		FROM incidents
		WHERE tenant_id = $1 AND detected_at >= NOW() - INTERVAL '7 days'
		GROUP BY DATE_TRUNC('day', detected_at)
		ORDER BY period ASC`,
		tenantID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var trends []models.TrendPoint
	for rows.Next() {
		var period string
		var opened, resolved int
		if err := rows.Scan(&period, &opened, &resolved); err == nil {
			trends = append(trends, models.TrendPoint{
				Period:   period,
				Opened:   opened,
				Resolved: resolved,
			})
		}
	}
	return trends
}

// ── List Postmortems ─────────────────────────────────────────────────────
func (s *IncidentService) ListPostmortems(ctx context.Context, tenantID string, status *string, limit, offset int) ([]models.PostmortemRecord, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	records, total, err := s.postmortemRepo.FindByTenant(ctx, tenantID, status, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list postmortems: %w", err)
	}
	if records == nil {
		return []models.PostmortemRecord{}, total, nil
	}
	return records, total, nil
}

// ── Knowledge Recommendations ────────────────────────────────────────────
// GetKnowledgeRecommendations returns knowledge base recommendations for an incident.
// NOTE: The knowledge integration service is not wired into this Go service yet.
// This method validates the incident exists and returns an empty slice.
// When the knowledge service is available, populate this with actual KB article lookups.
func (s *IncidentService) GetKnowledgeRecommendations(ctx context.Context, incidentID, tenantID string, limit int) ([]string, error) {
	_, err := s.incidentRepo.GetByID(ctx, incidentID, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}
	if limit <= 0 {
		limit = 5
	}
	// Stub: knowledge integration not yet available in Go service.
	// TODO: Wire in knowledge integration service and return KB article IDs.
	return []string{}, nil
}

// ── Link Problem ─────────────────────────────────────────────────────────
func (s *IncidentService) LinkProblem(ctx context.Context, incidentID, problemID, tenantID string) (*IncidentResponse, error) {
	incident, err := s.incidentRepo.GetByID(ctx, incidentID, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}
	incident.RelatedProblemID = &problemID
	incident.LinkedProblemID = &problemID
	incident.UpdatedAt = time.Now().UTC()

	if err := s.incidentRepo.Update(ctx, incident); err != nil {
		return nil, fmt.Errorf("failed to link problem: %w", err)
	}

	now := time.Now().UTC()
	timelineEvent := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: incidentID,
		TenantID:   tenantID,
		EventType:  "update",
		ActorID:    nil,
		Content:    fmt.Sprintf("Linked to problem: %s", problemID),
		Metadata:   []byte(fmt.Sprintf(`{"problem_id":"%s"}`, problemID)),
		CreatedAt:  now,
	}
	_ = s.timelineRepo.Create(ctx, timelineEvent)

	resp := toResponse(incident)
	return &resp, nil
}

// ── Link Change ──────────────────────────────────────────────────────────
func (s *IncidentService) LinkChange(ctx context.Context, incidentID, changeID, tenantID string) (*IncidentResponse, error) {
	incident, err := s.incidentRepo.GetByID(ctx, incidentID, tenantID)
	if err != nil {
		return nil, ErrIncidentNotFound
	}
	incident.LinkedChangeID = &changeID
	incident.UpdatedAt = time.Now().UTC()

	if err := s.incidentRepo.Update(ctx, incident); err != nil {
		return nil, fmt.Errorf("failed to link change: %w", err)
	}

	now := time.Now().UTC()
	timelineEvent := &models.TimelineEvent{
		ID:         newID(),
		IncidentID: incidentID,
		TenantID:   tenantID,
		EventType:  "update",
		ActorID:    nil,
		Content:    fmt.Sprintf("Linked to change: %s", changeID),
		Metadata:   []byte(fmt.Sprintf(`{"change_id":"%s"}`, changeID)),
		CreatedAt:  now,
	}
	_ = s.timelineRepo.Create(ctx, timelineEvent)

	resp := toResponse(incident)
	return &resp, nil
}

func calculatePriority(impact, urgency string) string {
	i := toLower(impact)
	u := toLower(urgency)
	if m, ok := priorityMatrix[i]; ok {
		if p, ok := m[u]; ok {
			return p
		}
	}
	return "p3"
}

func toLower(s string) string {
	result := s
	for i, c := range s {
		if c >= 'A' && c <= 'Z' {
			result = string(rune(c)+32) + s[i+1:]
			break
		}
	}
	if result == s && len(s) > 0 {
		for i, c := range s {
			if c >= 'A' && c <= 'Z' {
				return s[:i] + string(rune(c)+32) + s[i+1:]
			}
		}
	}
	return result
}

func contains(slice []string, val string) bool {
	for _, v := range slice {
		if v == val {
			return true
		}
	}
	return false
}

func normalizeLimit(limit int) int {
	if limit <= 0 {
		return 20
	}
	if limit > 100 {
		return 100
	}
	return limit
}

func normalizeOffset(offset int) int {
	if offset < 0 {
		return 0
	}
	return offset
}

func strPtr(s string) *string {
	return &s
}

func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func strDeref(s *string, fallback string) string {
	if s != nil && *s != "" {
		return *s
	}
	return fallback
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for i := 1; i < len(parts); i++ {
		result += sep + parts[i]
	}
	return result
}

func escapeJSON(s string) string {
	s = stringsReplace(s, `\`, `\\`)
	s = stringsReplace(s, `"`, `\"`)
	return s
}

func stringsReplace(s, old, new string) string {
	result := ""
	lastIdx := 0
	for {
		idx := stringsIndex(s, old, lastIdx)
		if idx < 0 {
			result += s[lastIdx:]
			break
		}
		result += s[lastIdx:idx] + new
		lastIdx = idx + len(old)
	}
	return result
}

func stringsIndex(s, substr string, start int) int {
	if start >= len(s) || len(substr) == 0 {
		return -1
	}
	for i := start; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

func newID() string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		randUint32(), randUint16(), randUint16(), randUint16(), randUint64())
}

func randUint32() uint32 {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err == nil {
		return uint32(buf[0])<<24 | uint32(buf[1])<<16 | uint32(buf[2])<<8 | uint32(buf[3])
	}
	return uint32(time.Now().UnixNano())
}

func randUint16() uint16 {
	buf := make([]byte, 2)
	if _, err := rand.Read(buf); err == nil {
		return uint16(buf[0])<<8 | uint16(buf[1])
	}
	return uint16(time.Now().UnixNano())
}

func randUint64() uint64 {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err == nil {
		return uint64(buf[0])<<56 | uint64(buf[1])<<48 | uint64(buf[2])<<40 | uint64(buf[3])<<32 |
			uint64(buf[4])<<24 | uint64(buf[5])<<16 | uint64(buf[6])<<8 | uint64(buf[7])
	}
	return uint64(time.Now().UnixNano())
}

func nullFloat64ToFloat64(v sql.NullFloat64) float64 {
	if v.Valid {
		return v.Float64
	}
	return 0
}
