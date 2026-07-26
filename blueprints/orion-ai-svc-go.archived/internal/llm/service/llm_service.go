package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"orion/ai-svc-go/internal/llm/models"
	"orion/ai-svc-go/internal/llm/repository"
)

var (
	ErrTraceNotFound  = errors.New("trace not found")
	ErrPricingMissing = errors.New("pricing not found for model")
)

// Service orchestrates all LLM trace business logic.
type Service struct {
	repo *repository.Repository
}

// NewService creates a Service backed by the given repository.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ==========================================================================
// Trace Lifecycle  (mirrors LLMTraceService)
// ==========================================================================

// StartTrace begins a new LLM trace. It generates a trace ID, hashes the
// prompt content, and persists the initial "pending" record.
func (s *Service) StartTrace(ctx context.Context, req *models.TraceStartRequest) (*models.LLMTrace, error) {
	traceID := generateTraceID()
	promptHash := hashContent(req.PromptContent)

	now := time.Now().UTC()
	trace := &models.LLMTrace{
		TraceID:          traceID,
		TenantID:         req.TenantID,
		ModelID:          req.ModelID,
		PromptContent:    &req.PromptContent,
		PromptHash:       &promptHash,
		InputTokens:      0,
		OutputTokens:     0,
		TotalTokens:      0,
		InputCost:        0,
		OutputCost:       0,
		TotalCost:        0,
		Currency:         "CNY",
		Status:           "pending",
		RequestStartedAt: now,
		RequestContext:   toJSONB(req.RequestContext),
	}

	if req.UserID != "" {
		trace.UserID = &req.UserID
	}
	if req.ScenarioID != "" {
		trace.ScenarioID = &req.ScenarioID
	}
	if req.ProviderID != "" {
		trace.ProviderID = &req.ProviderID
	}
	if req.ParentTraceID != "" {
		trace.ParentTraceID = &req.ParentTraceID
	}

	saved, err := s.repo.CreateTrace(ctx, trace)
	if err != nil {
		return nil, fmt.Errorf("StartTrace: %w", err)
	}
	log.Printf("[LLMTrace] Started trace: %s", traceID)
	return saved, nil
}

// CompleteTrace finalises a trace by calculating costs, hashing the output,
// and recording the completion timestamp and duration.
func (s *Service) CompleteTrace(ctx context.Context, traceID string, req *models.TraceCompleteRequest) (*models.LLMTrace, error) {
	trace, err := s.repo.FindTraceByTraceID(ctx, traceID)
	if err != nil {
		return nil, ErrTraceNotFound
	}

	// Calculate cost using the model's pricing.
	cost := s.CalculateCost(ctx, trace.ModelID, req.InputTokens, req.OutputTokens)

	outputHash := hashContent(req.OutputContent)
	now := time.Now().UTC()
	durationMs := now.Sub(trace.RequestStartedAt).Milliseconds()

	status := "completed"
	var errMsg *string
	if req.ErrorMessage != "" {
		status = "failed"
		errMsg = &req.ErrorMessage
	}

	updates := map[string]interface{}{
		"outputContent":      req.OutputContent,
		"outputHash":         outputHash,
		"inputTokens":        req.InputTokens,
		"outputTokens":       req.OutputTokens,
		"totalTokens":        req.InputTokens + req.OutputTokens,
		"inputCost":          cost.InputCost,
		"outputCost":         cost.OutputCost,
		"totalCost":          cost.TotalCost,
		"status":             status,
		"requestCompletedAt": now,
		"durationMs":         durationMs,
		"errorMessage":       errMsg,
	}

	updated, err := s.repo.UpdateTrace(ctx, traceID, updates)
	if err != nil {
		return nil, fmt.Errorf("CompleteTrace(%s): %w", traceID, err)
	}
	log.Printf("[LLMTrace] Completed trace: %s tokens=%d cost=%.6f", traceID, updated.TotalTokens, updated.TotalCost)
	return updated, nil
}

// GetTrace returns a single trace by its trace_id.
func (s *Service) GetTrace(ctx context.Context, traceID string) (*models.LLMTrace, error) {
	trace, err := s.repo.FindTraceByTraceID(ctx, traceID)
	if err != nil {
		return nil, ErrTraceNotFound
	}
	return trace, nil
}

// GetTracesByTenant returns all traces for a tenant.
func (s *Service) GetTracesByTenant(ctx context.Context, tenantID string, limit int) ([]models.LLMTrace, error) {
	return s.repo.FindTracesByTenant(ctx, tenantID, limit)
}

// GetTracesByScenario returns all traces for a scenario.
func (s *Service) GetTracesByScenario(ctx context.Context, scenarioID string, limit int) ([]models.LLMTrace, error) {
	return s.repo.FindTracesByScenario(ctx, scenarioID, limit)
}

// GetAllTraces returns all traces up to the given limit.
func (s *Service) GetAllTraces(ctx context.Context, limit int) ([]models.LLMTrace, error) {
	return s.repo.FindAllTraces(ctx, limit)
}

// ClearTraces deletes every trace.
func (s *Service) ClearTraces(ctx context.Context) error {
	return s.repo.DeleteAllTraces(ctx)
}

// AggregateDailyStats computes aggregated statistics for a tenant on a given date.
func (s *Service) AggregateDailyStats(ctx context.Context, tenantID string, date time.Time) (*models.DailyStats, error) {
	return s.repo.GetDailyStats(ctx, tenantID, date)
}

// ==========================================================================
// Cost Calculation  (mirrors CostCalculator)
// ==========================================================================

// CalculateCost computes the cost breakdown for a single LLM call.
// It checks custom pricing in the database first, then falls back to defaults.
func (s *Service) CalculateCost(ctx context.Context, modelID string, inputTokens, outputTokens int64) *models.CostBreakdown {
	pricing := s.getPricing(ctx, modelID)
	inputCost := float64(inputTokens) * pricing.Input
	outputCost := float64(outputTokens) * pricing.Output
	totalCost := inputCost + outputCost

	return &models.CostBreakdown{
		InputCost:       inputCost,
		OutputCost:      outputCost,
		TotalCost:       totalCost,
		Currency:        "CNY",
		BreakdownByModel: map[string]float64{modelID: totalCost},
	}
}

// CalculateBatchCost computes the total cost across multiple traces.
func (s *Service) CalculateBatchCost(ctx context.Context, traces []struct {
	ModelID     string
	InputTokens int64
	OutputTokens int64
}) *models.CostBreakdown {
	var totalInput, totalOutput float64
	byModel := make(map[string]float64)

	for _, t := range traces {
		pricing := s.getPricing(ctx, t.ModelID)
		input := float64(t.InputTokens) * pricing.Input
		output := float64(t.OutputTokens) * pricing.Output
		cost := input + output
		totalInput += input
		totalOutput += output
		byModel[t.ModelID] += cost
	}

	return &models.CostBreakdown{
		InputCost:        totalInput,
		OutputCost:       totalOutput,
		TotalCost:        totalInput + totalOutput,
		Currency:         "CNY",
		BreakdownByModel: byModel,
	}
}

// CalculateSavings compares the cost of two models for the same token usage.
func (s *Service) CalculateSavings(ctx context.Context, req *models.SavingsRequest) *models.SavingsResult {
	currentPricing := s.getPricing(ctx, req.CurrentModel)
	altPricing := s.getPricing(ctx, req.AlternativeModel)

	currentCost := float64(req.InputTokens)*currentPricing.Input + float64(req.OutputTokens)*currentPricing.Output
	altCost := float64(req.InputTokens)*altPricing.Input + float64(req.OutputTokens)*altPricing.Output
	savings := currentCost - altCost

	var pct float64
	if currentCost > 0 {
		pct = (savings / currentCost) * 100
	}

	return &models.SavingsResult{
		CurrentCost:     currentCost,
		AlternativeCost: altCost,
		Savings:         savings,
		SavingsPercent:  pct,
	}
}

// EstimateMonthlyCost projects a monthly cost from daily token usage.
func (s *Service) EstimateMonthlyCost(ctx context.Context, modelID string, dailyTokens int64) float64 {
	pricing := s.getPricing(ctx, modelID)
	halfTokens := float64(dailyTokens) / 2
	dailyCost := halfTokens*pricing.Input + halfTokens*pricing.Output
	return dailyCost * 30
}

// ==========================================================================
// Pricing Management  (mirrors ModelPricingRepository + CostCalculator)
// ==========================================================================

// SetCustomPricing creates or updates custom pricing for a model.
func (s *Service) SetCustomPricing(ctx context.Context, req *models.SetPricingRequest) (*models.ModelPricing, error) {
	var tenantID *string
	if req.TenantID != "" {
		tenantID = &req.TenantID
	}
	p, err := s.repo.UpsertPricing(ctx, req.ModelID, req.InputPrice, req.OutputPrice, tenantID)
	if err != nil {
		return nil, fmt.Errorf("SetCustomPricing(%s): %w", req.ModelID, err)
	}
	log.Printf("[CostCalculator] Set custom pricing for %s: input=%.6f output=%.6f", req.ModelID, req.InputPrice, req.OutputPrice)
	return p, nil
}

// GetPricingForModel returns the effective pricing (custom or default) for a model.
func (s *Service) GetPricingForModel(ctx context.Context, modelID string) map[string]float64 {
	p := s.getPricing(ctx, modelID)
	return map[string]float64{"input": p.Input, "output": p.Output}
}

// GetAllPricing returns a merged map of default + custom pricings.
func (s *Service) GetAllPricing(ctx context.Context) map[string]map[string]float64 {
	result := make(map[string]map[string]float64)

	// Start with defaults.
	for model, p := range models.DefaultModelPricing {
		result[model] = map[string]float64{"input": p.Input, "output": p.Output}
	}

	// Override with custom pricing from DB.
	custom, err := s.repo.FindAllPricings(ctx)
	if err == nil {
		for _, p := range custom {
			result[p.ModelID] = map[string]float64{"input": p.InputPrice, "output": p.OutputPrice}
		}
	}
	return result
}

// GetAvailableModels returns the union of default model IDs and custom-priced model IDs.
func (s *Service) GetAvailableModels(ctx context.Context) []string {
	seen := make(map[string]struct{})
	for id := range models.DefaultModelPricing {
		seen[id] = struct{}{}
	}
	custom, err := s.repo.FindAllPricings(ctx)
	if err == nil {
		for _, p := range custom {
			seen[p.ModelID] = struct{}{}
		}
	}
	result := make([]string, 0, len(seen))
	for id := range seen {
		result = append(result, id)
	}
	return result
}

// DeleteCustomPricing removes custom pricing for a model.
func (s *Service) DeleteCustomPricing(ctx context.Context, modelID string) (bool, error) {
	return s.repo.DeletePricingByModelID(ctx, modelID)
}

// ==========================================================================
// Token Estimation  (mirrors TokenCounter.estimateTokensFallback)
// ==========================================================================

// EstimateTokens provides a rough token count for a piece of text.
// Chinese characters count as ~1 token each; English characters ~4 per token.
func EstimateTokens(text string) int {
	if len(text) == 0 {
		return 0
	}
	var chineseCount, otherCount int
	for _, r := range text {
		if r >= 0x4e00 && r <= 0x9fa5 { // CJK Unified Ideographs
			chineseCount++
		} else {
			otherCount++
		}
	}
	return chineseCount + (otherCount+3)/4 // ceiling division for English
}

// ==========================================================================
// Internal helpers
// ==========================================================================

// getPricing retrieves the effective pricing for a model: custom DB pricing
// takes precedence over the built-in defaults.
func (s *Service) getPricing(ctx context.Context, modelID string) struct{ Input, Output float64 } {
	custom, err := s.repo.FindPricingByModelID(ctx, modelID)
	if err == nil && custom != nil {
		return struct{ Input, Output float64 }{Input: custom.InputPrice, Output: custom.OutputPrice}
	}
	if dp, ok := models.DefaultModelPricing[modelID]; ok {
		return struct{ Input, Output float64 }{Input: dp.Input, Output: dp.Output}
	}
	// Fall back to gpt-4 pricing for unknown models.
	dp := models.DefaultModelPricing["gpt-4"]
	return struct{ Input, Output float64 }{Input: dp.Input, Output: dp.Output}
}

// generateTraceID creates a unique trace identifier.
func generateTraceID() string {
	return fmt.Sprintf("trace_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:16])
}

// hashContent computes a SHA-256 prefix (64 hex chars) of the content,
// matching the Node.js crypto.createHash('sha256').digest('hex').slice(0, 64).
func hashContent(content string) string {
	h := sha256.Sum256([]byte(content))
	return hex.EncodeToString(h[:])[:64]
}

// toJSONB converts a map to models.JSONB, returning nil for empty/nil maps.
func toJSONB(m map[string]interface{}) models.JSONB {
	if len(m) == 0 {
		return nil
	}
	return models.JSONB(m)
}

// ptrStr is a helper to take the address of a string (used for nullable columns).
func ptrStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
