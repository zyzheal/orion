package service

import (
	"context"
	"encoding/json"
	"fmt"
	"orion/diagnostic-svc-go/internal/models"
	"orion/diagnostic-svc-go/internal/repository"
	"time"

	"github.com/google/uuid"
)

// AgentService orchestrates full diagnostic workflows, combining engine + reporter
// + persistence across session and report repositories.
type AgentService struct {
	svc        *Service
	reportRepo *repository.ReportRepository
	stepRepo   *repository.StepRepository
	engine     *Engine
	kb         *KnowledgeService
	reporter   *Reporter
	initialized bool
	mu         chan struct{}
}

// NewAgentService assembles a fully wired diagnostic agent.
func NewAgentService(
	svc *Service,
	reportRepo *repository.ReportRepository,
	stepRepo *repository.StepRepository,
	engine *Engine,
	agentKB *KnowledgeService,
	reporter *Reporter,
) *AgentService {
	return &AgentService{
		svc:        svc,
		reportRepo: reportRepo,
		stepRepo:   stepRepo,
		engine:     engine,
		kb:         agentKB,
		reporter:   reporter,
		mu:         make(chan struct{}, 1),
	}
}

// EnsureSeeded loads the built-in diagnostic patterns. Call once at startup.
func (a *AgentService) EnsureSeeded() {
	if a.initialized {
		return
	}
	a.kb.SeedPatterns()
	a.initialized = true
}

// TriggerDiagnostic runs a full diagnostic flow and persists session + report.
func (a *AgentService) TriggerDiagnostic(ctx context.Context, tenantID string, req *models.CreateDiagnosticRequest) (*models.DiagnosticReport, error) {
	<-a.mu
	defer func() { a.mu <- struct{}{} }()

	// 1. Start session
	session, err := a.svc.CreateSession(ctx, tenantID, req)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	// 2. Run engine
	symptoms := req.Symptoms
	findings, rootCause, confidence := a.engine.Diagnose(symptoms)

	// Marshal findings to JSON
	findingsJSON, err := json.Marshal(findings)
	if err != nil {
		return nil, err
	}

	// 3. Persist identify step
	step := &models.DiagnosticStep{
		ID:        uuid.New().String(),
		SessionID: session.ID,
		StepType:  "identify",
		Status:    "completed",
		Result:    models.JSONText(findingsJSON),
		ExecutedAt: time.Now(),
	}
	if err := a.stepRepo.Create(ctx, step); err != nil {
		return nil, err
	}

	// 4. Complete session
	_, err = a.svc.CompleteSession(ctx, tenantID, session.ID, string(findingsJSON))
	if err != nil {
		return nil, err
	}

	// 5. Generate report with root cause attached
	sessionWithRC := *session
	sessionWithRC.RootCause = rootCause
	sessionWithRC.Confidence = &confidence
	report := a.reporter.GenerateReport(&sessionWithRC)
	if err := a.reportRepo.Create(ctx, report); err != nil {
		return nil, fmt.Errorf("persist report: %w", err)
	}

	// 6. Record KB outcome if match
	matches := a.kb.MatchSymptoms(symptoms)
	for _, m := range matches {
		if m.Score >= 60 {
			_ = a.kb.repo.IncrementFrequency(ctx, m.Entry.ID)
			break
		}
	}

	return report, nil
}

// RunDiagnosticStep executes a single diagnostic step on an existing session.
func (a *AgentService) RunDiagnosticStep(ctx context.Context, tenantID, sessionID string, stepType string) (json.RawMessage, error) {
	<-a.mu
	defer func() { a.mu <- struct{}{} }()

	session, err := a.svc.GetSession(ctx, tenantID, sessionID)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	var symptoms []models.Symptom
	if err := json.Unmarshal([]byte(session.Symptoms), &symptoms); err != nil {
		return nil, err
	}

	result, err := a.engine.RunStep(symptoms, stepType)
	if err != nil {
		return nil, err
	}

	step := &models.DiagnosticStep{
		ID:        uuid.New().String(),
		SessionID: sessionID,
		StepType:  stepType,
		Status:    "completed",
		Result:    models.JSONText(result),
		ExecutedAt: time.Now(),
	}
	if err := a.stepRepo.Create(ctx, step); err != nil {
		return nil, err
	}
	return result, nil
}

// GetReport retrieves a diagnostic report by ID.
func (a *AgentService) GetReport(ctx context.Context, id string) (*models.DiagnosticReport, error) {
	return a.reportRepo.GetByID(ctx, id)
}

// GetReportBySession retrieves the report tied to a session.
func (a *AgentService) GetReportBySession(ctx context.Context, tenantID, sessionID string) (*models.DiagnosticReport, error) {
	return a.reportRepo.GetBySession(ctx, tenantID, sessionID)
}

// ListReports returns paginated reports for a tenant.
func (a *AgentService) ListReports(ctx context.Context, tenantID string, offset, limit int) ([]models.DiagnosticReport, error) {
	return a.reportRepo.ListByTenant(ctx, tenantID, offset, limit)
}

// EstimateFixComplexity returns a complexity estimate for a session.
func (a *AgentService) EstimateFixComplexity(ctx context.Context, tenantID, sessionID string) (*FixComplexityEstimate, error) {
	session, err := a.svc.GetSession(ctx, tenantID, sessionID)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}
	return a.reporter.EstimateFixComplexity(session), nil
}

// KB returns the underlying knowledge service for direct access.
func (a *AgentService) KB() *KnowledgeService {
	return a.kb
}
