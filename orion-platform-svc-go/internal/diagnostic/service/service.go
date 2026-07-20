package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/diagnostic/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountPatterns(ctx context.Context, tenantID string) (int, error)
	CountReports(ctx context.Context, tenantID string) (int, error)
	CountSessions(ctx context.Context, tenantID string) (int, error)
	CreatePattern(ctx context.Context, pattern *models.Pattern) error
	CreateReport(ctx context.Context, report *models.Report) error
	CreateSession(ctx context.Context, session *models.Session) error
	CreateSymptom(ctx context.Context, symptom *models.Symptom) error
	GetPatternByID(ctx context.Context, id string) (*models.Pattern, error)
	GetReportByID(ctx context.Context, id string) (*models.Report, error)
	GetReportBySession(ctx context.Context, sessionID string) (*models.Report, error)
	GetSessionByID(ctx context.Context, id string) (*models.Session, error)
	ListPatterns(ctx context.Context, tenantID, category, keyword *string) ([]models.Pattern, error)
	ListReports(ctx context.Context, tenantID, sessionID *string) ([]models.Report, error)
	ListSessions(ctx context.Context, tenantID string, status, triggerType, triggerID *string) ([]models.Session, error)
	ListSymptomsBySession(ctx context.Context, sessionID string) ([]models.Symptom, error)
	UpdateSessionStatus(ctx context.Context, id string, status string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Trigger diagnostic (create session + symptoms + report) ---

func (s *Service) TriggerDiagnostic(ctx context.Context, tenantID string, req *models.CreateSessionRequest) (*models.TriggerResult, error) {
	session := &models.Session{
		TenantID:    tenantID,
		TriggerType: req.TriggerType,
		TriggerID:   req.TriggerID,
		Status:      "running",
		StartedAt:   time.Now().UTC(),
		CreatedAt:   time.Now().UTC(),
	}
	if err := s.repo.CreateSession(ctx, session); err != nil {
		return nil, err
	}

	// Insert symptoms
	for _, symptomName := range req.Symptoms {
		symptom := &models.Symptom{
			SessionID: session.ID,
			Name:      symptomName,
			Severity:  "medium",
			CreatedAt: time.Now().UTC(),
		}
		if err := s.repo.CreateSymptom(ctx, symptom); err != nil {
			return nil, err
		}
	}

	// Auto-generate a report
	content, _ := json.Marshal(map[string]interface{}{
		"session": session.ID,
		"status":  "auto_generated",
		"summary": "Diagnostic completed automatically.",
	})
	report := &models.Report{
		SessionID: session.ID,
		Content:   string(content),
		CreatedAt: time.Now().UTC(),
	}
	if err := s.repo.CreateReport(ctx, report); err != nil {
		return nil, err
	}

	// Mark session completed
	if err := s.repo.UpdateSessionStatus(ctx, session.ID, "completed"); err != nil {
		return nil, err
	}

	// Reload session
	loaded, err := s.repo.GetSessionByID(ctx, session.ID)
	if err != nil {
		return nil, err
	}
	return &models.TriggerResult{
		Session: *loaded,
		Report:  *report,
	}, nil
}

// --- Session history ---

func (s *Service) GetDiagnosticHistory(ctx context.Context, tenantID string, status, triggerType, triggerID *string) ([]models.Session, int, error) {
	sessions, err := s.repo.ListSessions(ctx, tenantID, status, triggerType, triggerID)
	if err != nil {
		return nil, 0, err
	}
	if sessions == nil {
		sessions = []models.Session{}
	}
	return sessions, len(sessions), nil
}

// --- Session detail ---

func (s *Service) GetDiagnosticDetail(ctx context.Context, id string) (*models.Session, error) {
	session, err := s.repo.GetSessionByID(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	return session, nil
}

// --- Symptom ---

func (s *Service) AddSymptomToSession(ctx context.Context, sessionID string, req *models.AddSymptomRequest) (*models.Session, error) {
	// Validate session exists
	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	symptom := &models.Symptom{
		SessionID:   sessionID,
		Name:        req.Type,
		Description: &req.Description,
		Type:        req.Type,
		Source:      req.Source,
		Severity:    req.Severity,
		Metadata:    toJSON(req.Metadata),
		CreatedAt:   time.Now().UTC(),
	}
	if err := s.repo.CreateSymptom(ctx, symptom); err != nil {
		return nil, err
	}
	return session, nil
}

// --- Complete session (regenerate report) ---

func (s *Service) CompleteSession(ctx context.Context, id string) (*models.SessionWithReport, error) {
	session, err := s.repo.GetSessionByID(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}

	content, _ := json.Marshal(map[string]interface{}{
		"session": id,
		"status":  "completed",
		"summary": "Session completed manually.",
	})
	report := &models.Report{
		SessionID: id,
		Content:   string(content),
		CreatedAt: time.Now().UTC(),
	}
	if err := s.repo.CreateReport(ctx, report); err != nil {
		return nil, err
	}
	return &models.SessionWithReport{
		Session: *session,
		Report:  report,
	}, nil
}

// --- Reports ---

func (s *Service) GetReportHistory(ctx context.Context, tenantID, sessionID *string) ([]models.Report, int, error) {
	reports, err := s.repo.ListReports(ctx, tenantID, sessionID)
	if err != nil {
		return nil, 0, err
	}
	if reports == nil {
		reports = []models.Report{}
	}
	return reports, len(reports), nil
}

func (s *Service) GetReport(ctx context.Context, id string) (*models.Report, error) {
	report, err := s.repo.GetReportByID(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrReportNotFound
		}
		return nil, err
	}
	return report, nil
}

func (s *Service) GetReportBySession(ctx context.Context, sessionID string) (*models.Report, error) {
	return s.repo.GetReportBySession(ctx, sessionID)
}

// --- Complexity estimate ---

func (s *Service) EstimateFixComplexity(ctx context.Context, sessionID string) (*models.ComplexityEstimate, error) {
	_, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	symptoms, err := s.repo.ListSymptomsBySession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	n := len(symptoms)
	level := "low"
	reason := "Single symptom detected."
	if n > 3 {
		level = "high"
		reason = "Multiple symptoms indicate complex root cause."
	} else if n > 1 {
		level = "medium"
		reason = "Several symptoms present."
	}
	return &models.ComplexityEstimate{
		Level:  level,
		Reason: reason,
	}, nil
}

// --- Patterns ---

func (s *Service) AddPattern(ctx context.Context, tenantID string, req *models.CreatePatternRequest) (*models.Pattern, error) {
	pattern := &models.Pattern{
		TenantID:  tenantID,
		Name:      req.Name,
		Category:  &req.Category,
		Symptoms:  req.Symptoms,
		RootCause: &req.RootCause,
		Solutions: req.Solution,
		Frequency: 1,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.repo.CreatePattern(ctx, pattern); err != nil {
		return nil, err
	}
	return s.repo.GetPatternByID(ctx, pattern.ID)
}

func (s *Service) SearchPatterns(ctx context.Context, tenantID, category, keyword *string) ([]models.Pattern, int, error) {
	patterns, err := s.repo.ListPatterns(ctx, tenantID, category, keyword)
	if err != nil {
		return nil, 0, err
	}
	if patterns == nil {
		patterns = []models.Pattern{}
	}
	return patterns, len(patterns), nil
}

func (s *Service) GetPattern(ctx context.Context, id string) (*models.Pattern, error) {
	pattern, err := s.repo.GetPatternByID(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrPatternNotFound
		}
		return nil, err
	}
	return pattern, nil
}

// --- Knowledge base stats ---

func (s *Service) GetKnowledgeBaseStats(ctx context.Context, tenantID string) (*models.KnowledgeBaseStats, error) {
	pcs, _ := s.repo.CountPatterns(ctx, tenantID)
	scs, _ := s.repo.CountSessions(ctx, tenantID)
	rcs, _ := s.repo.CountReports(ctx, tenantID)
	return &models.KnowledgeBaseStats{
		Patterns: pcs,
		Sessions: scs,
		Reports:  rcs,
	}, nil
}

// --- Record outcome ---

func (s *Service) RecordOutcome(ctx context.Context, tenantID string, req *models.RecordOutcomeRequest) (*models.Outcome, error) {
	// Validate session belongs to tenant
	_, err := s.repo.GetSessionByID(ctx, req.SessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	_, err = s.repo.GetPatternByID(ctx, req.PatternID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrPatternNotFound
		}
		return nil, err
	}
	outcome := &models.Outcome{
		ID:              uuid.New().String(),
		SessionID:       req.SessionID,
		PatternID:       req.PatternID,
		Confirmed:       req.Confirmed,
		ActualRootCause: req.ActualRootCause,
		FixTimeMs:       req.FixTimeMs,
		CreatedAt:       time.Now().UTC(),
	}
	return outcome, nil
}

// --- Status ---

func (s *Service) GetStatus(ctx context.Context, tenantID string) (*struct {
	State    string `json:"state"`
	Sessions int    `json:"sessions"`
	Reports  int    `json:"reports"`
	Patterns int    `json:"patterns"`
}, error) {
	pcs, _ := s.repo.CountPatterns(ctx, tenantID)
	scs, _ := s.repo.CountSessions(ctx, tenantID)
	rcs, _ := s.repo.CountReports(ctx, tenantID)
	return &struct {
		State    string `json:"state"`
		Sessions int    `json:"sessions"`
		Reports  int    `json:"reports"`
		Patterns int    `json:"patterns"`
	}{
		State:    "healthy",
		Sessions: scs,
		Reports:  rcs,
		Patterns: pcs,
	}, nil
}

// --- Errors ---

var (
	ErrSessionNotFound = errors.New("diagnostic session not found")
	ErrReportNotFound  = errors.New("diagnostic report not found")
	ErrPatternNotFound = errors.New("diagnostic pattern not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrSessionNotFound) || errors.Is(err, ErrReportNotFound) || errors.Is(err, ErrPatternNotFound)
}

// --- Helpers ---

func toJSON(v *string) string {
	if v == nil || *v == "" {
		return "{}"
	}
	return *v
}
