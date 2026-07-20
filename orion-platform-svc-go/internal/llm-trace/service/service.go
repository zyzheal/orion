package service

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/llm-trace/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountTracesByTenant(ctx context.Context, tenantID string, q *models.ListTracesQuery) (int64, error)
	CreateTrace(ctx context.Context, t *models.LLMTrace) error
	GetCustomPricing(ctx context.Context, modelID string) (*models.ModelPricing, error)
	GetDailyStats(ctx context.Context, tenantID, dateStr string) (*models.DailyStats, error)
	GetTrace(ctx context.Context, traceID, tenantID string) (*models.LLMTrace, error)
	GetTrackingAccuracy(ctx context.Context, tenantID string) (*models.TrackingAccuracy, error)
	ListTracesByTenant(ctx context.Context, tenantID string, q *models.ListTracesQuery) ([]models.LLMTrace, error)
	ListTracesByTenantAndDateRange(ctx context.Context, tenantID string, start, end *time.Time) ([]models.LLMTrace, error)
	UpdateTrace(ctx context.Context, traceID, tenantID string, fields map[string]interface{}) error
}

type Service struct {
	repo     RepositoryInterface
	currency string
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{
		repo:     repo,
		currency: "CNY",
	}
}

var (
	ErrTraceNotFound = errors.New("trace not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrTraceNotFound)
}

// --- Traces ---

// GetTrace retrieves a single trace by ID.
func (s *Service) GetTrace(ctx context.Context, traceID, tenantID string) (*models.LLMTrace, error) {
	t, err := s.repo.GetTrace(ctx, traceID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTraceNotFound
		}
		return nil, err
	}
	return t, nil
}

// ListTraces lists traces with optional filters.
func (s *Service) ListTraces(ctx context.Context, tenantID string, q *models.ListTracesQuery) ([]models.LLMTrace, int64, error) {
	var traces []models.LLMTrace
	var total int64
	var err error

	if q != nil && q.ScenarioID != nil && *q.ScenarioID != "" {
		traces, err = s.repo.ListTracesByTenant(ctx, tenantID, q)
		if err != nil {
			return nil, 0, err
		}
		total, err = s.repo.CountTracesByTenant(ctx, tenantID, q)
		if err != nil {
			return nil, 0, err
		}
	} else {
		// List by tenant only
		traces, err = s.repo.ListTracesByTenant(ctx, tenantID, &models.ListTracesQuery{
			Limit: q.Limit,
		})
		if err != nil {
			return nil, 0, err
		}
		total, err = s.repo.CountTracesByTenant(ctx, tenantID, nil)
		if err != nil {
			return nil, 0, err
		}
	}

	if traces == nil {
		traces = []models.LLMTrace{}
	}
	return traces, total, nil
}

// CreateTrace starts a new LLM trace.
func (s *Service) CreateTrace(ctx context.Context, tenantID, userID string, req *models.TraceCreateRequest) (*models.LLMTrace, error) {
	promptHash := s.hashContent(req.PromptContent)

	t := &models.LLMTrace{
		TenantID:      tenantID,
		ModelID:       req.ModelID,
		PromptContent: sql.NullString{String: req.PromptContent, Valid: true},
		PromptHash:    promptHash,
		InputTokens:   0,
		OutputTokens:  0,
		TotalTokens:   0,
		InputCost:     0,
		OutputCost:    0,
		TotalCost:     0,
		Currency:      s.currency,
		Status:        models.TraceStatusPending,
	}

	if userID != "" {
		t.UserID = sql.NullString{String: userID, Valid: true}
	}
	if req.ScenarioID != "" {
		t.ScenarioID = sql.NullString{String: req.ScenarioID, Valid: true}
	}
	if req.ProviderID != "" {
		t.ProviderID = sql.NullString{String: req.ProviderID, Valid: true}
	}
	if req.ParentTraceID != "" {
		t.ParentTraceID = sql.NullString{String: req.ParentTraceID, Valid: true}
	}
	if req.RequestContext != nil {
		j, _ := json.Marshal(req.RequestContext)
		t.RequestContext = sql.NullString{String: string(j), Valid: true}
	}
	if req.Metadata != nil {
		j, _ := json.Marshal(req.Metadata)
		t.Metadata = sql.NullString{String: string(j), Valid: true}
	}

	if err := s.repo.CreateTrace(ctx, t); err != nil {
		return nil, fmt.Errorf("failed to create trace: %w", err)
	}
	return t, nil
}

// CompleteTrace completes a trace with output and token usage.
func (s *Service) CompleteTrace(ctx context.Context, traceID, tenantID string, req *models.TraceCompleteRequest) (*models.LLMTrace, error) {
	// First get the existing trace
	existing, err := s.repo.GetTrace(ctx, traceID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTraceNotFound
		}
		return nil, err
	}

	// Calculate cost (inline to avoid context-free pricing lookup)
	pricing := s.getPricing(ctx, existing.ModelID)
	inputCost := float64(req.InputTokens) * pricing.Input
	outputCost := float64(req.OutputTokens) * pricing.Output
	totalCost := inputCost + outputCost

	// Calculate duration
	completedAt := time.Now().UTC()
	durationMs := completedAt.Sub(existing.RequestStartedAt).Milliseconds()

	status := models.TraceStatusCompleted
	if req.ErrorMessage != "" {
		status = models.TraceStatusFailed
	}

	outputHash := s.hashContent(req.OutputContent)

	// Update the trace
	updateFields := map[string]interface{}{
		"output_content":       req.OutputContent,
		"output_hash":          outputHash,
		"input_tokens":         req.InputTokens,
		"output_tokens":        req.OutputTokens,
		"total_tokens":         req.InputTokens + req.OutputTokens,
		"input_cost":           inputCost,
		"output_cost":          outputCost,
		"total_cost":           totalCost,
		"status":               string(status),
		"request_completed_at": completedAt,
		"duration_ms":          durationMs,
	}
	if req.ErrorMessage != "" {
		updateFields["error_message"] = req.ErrorMessage
	}

	if err := s.repo.UpdateTrace(ctx, traceID, tenantID, updateFields); err != nil {
		return nil, fmt.Errorf("failed to update trace: %w", err)
	}

	return s.repo.GetTrace(ctx, traceID, tenantID)
}

// --- Cost Calculation ---

// getPricing returns pricing for a model (custom first, then default).
func (s *Service) getPricing(ctx context.Context, modelID string) models.ModelPricing {
	// Try custom pricing from DB
	custom, err := s.repo.GetCustomPricing(ctx, modelID)
	if err == nil && custom != nil {
		return *custom
	}

	// Fall back to default pricing
	p, ok := models.DefaultModelPricing[modelID]
	if ok {
		return p
	}
	return models.DefaultModelPricing["gpt-4"]
}

// CalculateCost calculates cost for a single model call.
func (s *Service) CalculateCost(ctx context.Context, modelID string, inputTokens, outputTokens int) *models.CostBreakdown {
	pricing := s.getPricing(ctx, modelID)

	inputCost := float64(inputTokens) * pricing.Input
	outputCost := float64(outputTokens) * pricing.Output
	totalCost := inputCost + outputCost

	return &models.CostBreakdown{
		InputCost:  inputCost,
		OutputCost: outputCost,
		TotalCost:  totalCost,
		Currency:   s.currency,
		BreakdownByModel: map[string]float64{
			modelID: totalCost,
		},
	}
}

// CalculateBatchCost calculates cost for multiple traces.
func (s *Service) CalculateBatchCost(ctx context.Context, traces []models.LLMTrace) *models.CostBreakdown {
	totalInputCost := 0.0
	totalOutputCost := 0.0
	breakdownByModel := make(map[string]float64)

	for _, t := range traces {
		pricing := s.getPricing(ctx, t.ModelID)
		inputCost := float64(t.InputTokens) * pricing.Input
		outputCost := float64(t.OutputTokens) * pricing.Output
		cost := inputCost + outputCost

		totalInputCost += inputCost
		totalOutputCost += outputCost
		breakdownByModel[t.ModelID] += cost
	}

	return &models.CostBreakdown{
		InputCost:        totalInputCost,
		OutputCost:       totalOutputCost,
		TotalCost:        totalInputCost + totalOutputCost,
		Currency:         s.currency,
		BreakdownByModel: breakdownByModel,
	}
}

// GetAllPricing returns all available model pricing.
func (s *Service) GetAllPricing(ctx context.Context) map[string]models.ModelPricing {
	// Start with default pricing
	pricing := make(map[string]models.ModelPricing)
	for k, v := range models.DefaultModelPricing {
		pricing[k] = v
	}
	// Custom pricing would be loaded from DB here
	return pricing
}

// --- Stats ---

// GetDailyStats returns aggregated daily statistics.
func (s *Service) GetDailyStats(ctx context.Context, tenantID string, date *string) (*models.DailyStats, error) {
	var dateStr string
	if date != nil {
		// Validate date format YYYY-MM-DD
		_, err := time.Parse("2006-01-02", *date)
		if err != nil {
			return nil, fmt.Errorf("invalid date format: %w", err)
		}
		dateStr = *date
	} else {
		dateStr = time.Now().UTC().Format("2006-01-02")
	}

	stats, err := s.repo.GetDailyStats(ctx, tenantID, dateStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get daily stats: %w", err)
	}
	return stats, nil
}

// GetTrackingAccuracy returns tracking accuracy metrics.
func (s *Service) GetTrackingAccuracy(ctx context.Context, tenantID string) (*models.TrackingAccuracy, error) {
	accuracy, err := s.repo.GetTrackingAccuracy(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tracking accuracy: %w", err)
	}
	return accuracy, nil
}

// GetCostBreakdown returns cost breakdown for a date range.
func (s *Service) GetCostBreakdown(ctx context.Context, tenantID string, q *models.CostBreakdownQuery) (*models.CostBreakdown, int64, error) {
	traces, err := s.repo.ListTracesByTenantAndDateRange(ctx, tenantID, q.StartDate, q.EndDate)
	if err != nil {
		return nil, 0, err
	}
	if traces == nil {
		traces = []models.LLMTrace{}
	}

	breakdown := s.CalculateBatchCost(ctx, traces)
	return breakdown, int64(len(traces)), nil
}

// --- Helpers ---

func (s *Service) calculateCost(modelID string, inputTokens, outputTokens int) models.ModelPricing {
	// This is called without context; use defaults only
	p, ok := models.DefaultModelPricing[modelID]
	if !ok {
		p = models.DefaultModelPricing["gpt-4"]
	}
	p.Input *= float64(inputTokens)
	p.Output *= float64(outputTokens)
	return p
}

func (s *Service) hashContent(content string) string {
	if content == "" {
		return ""
	}
	h := sha256.New()
	h.Write([]byte(content))
	return hex.EncodeToString(h.Sum(nil))
}
