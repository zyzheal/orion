package service

import (
	"context"
	"fmt"

	"orion/ai-svc-go/internal/llm-trace/models"
	"orion/ai-svc-go/internal/llm-trace/repository"
	"go.uber.org/zap"
)

type LLMTraceService struct {
	repo   *repository.LLMTraceRepository
	logger *zap.Logger
}

func NewLLMTraceService(repo *repository.LLMTraceRepository, logger *zap.Logger) *LLMTraceService {
	return &LLMTraceService{repo: repo, logger: logger}
}

// Create creates a new trace.
func (s *LLMTraceService) Create(ctx context.Context, tenantID string, req *models.CreateTraceRequest) (*models.LLMTrace, error) {
	if req.TotalTokens <= 0 {
		req.TotalTokens = req.PromptTokens + req.CompletionTokens
	}
	if req.Status == "" {
		req.Status = "completed"
	}

	trace, err := s.repo.Create(ctx, tenantID, req)
	if err != nil {
		s.logger.Error("failed to create llm trace",
			zap.String("model", req.Model),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("llm trace created",
		zap.String("traceId", trace.ID),
		zap.String("model", trace.Model),
		zap.Int("totalTokens", trace.TotalTokens),
		zap.Float64("cost", trace.Cost),
	)
	return trace, nil
}

// Query returns paginated traces.
func (s *LLMTraceService) Query(ctx context.Context, tenantID string, model, provider, status, startTime, endTime string, limit, offset int) (models.TraceResponse, error) {
	return s.repo.Query(ctx, tenantID, model, provider, status, startTime, endTime, limit, offset)
}

// GetCostSummary returns aggregated cost data.
func (s *LLMTraceService) GetCostSummary(ctx context.Context, tenantID string, period string) (*models.CostSummary, error) {
	if period == "" {
		period = "month"
	}

	summary, err := s.repo.GetCostSummary(ctx, tenantID, period)
	if err != nil {
		s.logger.Error("failed to get cost summary",
			zap.String("period", period),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("cost summary retrieved",
		zap.String("period", period),
		zap.Float64("totalCost", summary.TotalCost),
		zap.Int64("callCount", summary.CallCount),
	)
	return summary, nil
}

// GetByTraceID returns traces for a trace ID.
func (s *LLMTraceService) GetByTraceID(ctx context.Context, tenantID, traceID string) ([]models.LLMTrace, error) {
	return s.repo.GetByTraceID(ctx, tenantID, traceID)
}

// DeleteOldTraces removes old traces.
func (s *LLMTraceService) DeleteOldTraces(ctx context.Context, tenantID string, days int) (int64, error) {
	if days <= 0 {
		days = 30
	}

	count, err := s.repo.DeleteOldTraces(ctx, tenantID, days)
	if err != nil {
		s.logger.Error("failed to delete old traces",
			zap.Int("days", days),
			zap.Error(err),
		)
		return 0, err
	}
	s.logger.Info("old traces deleted",
		zap.Int("days", days),
		zap.Int64("deleted", count),
	)
	return count, nil
}
