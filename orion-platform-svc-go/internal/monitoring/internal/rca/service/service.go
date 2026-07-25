package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/monitoring/internal/rca/models"
	"orion/platform-svc-go/internal/monitoring/internal/rca/repository"
	"go.uber.org/zap"
)

type RCAService struct {
	repo   *repository.RCARespository
	logger *zap.Logger
}

func NewRCAService(repo *repository.RCARespository, logger *zap.Logger) *RCAService {
	return &RCAService{repo: repo, logger: logger}
}

// Analyze performs root cause analysis for an incident.
func (s *RCAService) Analyze(ctx context.Context, tenantID uuid.UUID, req *models.AnalyzeRequest, triggeredBy string) (*models.RCAAnalysis, error) {
	analysis, err := s.repo.CreateAnalysis(ctx, tenantID, req.IncidentID, triggeredBy, &req.TimeRange)
	if err != nil {
		s.logger.Error("failed to create rca analysis",
			zap.String("incidentId", req.IncidentID),
			zap.Error(err),
		)
		return nil, err
	}

	s.logger.Info("starting rca analysis",
		zap.String("analysisId", analysis.ID.String()),
		zap.String("incidentId", req.IncidentID),
	)

	rootCauses, confidence := s.performAnalysis(req)

	if err := s.repo.UpdateAnalysis(ctx, analysis.ID, "completed", rootCauses, confidence); err != nil {
		s.logger.Error("failed to update rca analysis",
			zap.String("analysisId", analysis.ID.String()),
			zap.Error(err),
		)
		return nil, err
	}

	analysis.Status = "completed"
	analysis.RootCauses = rootCauses
	analysis.Confidence = confidence
	now := time.Now()
	analysis.CompletedAt = &now

	s.logger.Info("rca analysis completed",
		zap.String("analysisId", analysis.ID.String()),
		zap.Int("rootCauseCount", len(rootCauses)),
		zap.Float64("confidence", confidence),
	)
	return analysis, nil
}

func (s *RCAService) performAnalysis(req *models.AnalyzeRequest) ([]models.RootCause, float64) {
	var rootCauses []models.RootCause
	confidence := 0.0

	// Categorize by common patterns
	patterns := map[string][]string{
		"performance":  {"latency", "timeout", "slow_query", "resource_exhaustion"},
		"availability": {"crash", "restart", "connection_refused", "health_check_failure"},
		"data":         {"corruption", "inconsistency", "data_loss", "migration_failure"},
		"security":     {"unauthorized", "vulnerability", "authentication_failure"},
		"configuration": {"config_change", "deployment_failure", "rollback"},
	}

	for category, keywords := range patterns {
		matched := false
		for _, keyword := range keywords {
			if strings.Contains(strings.ToLower(req.IncidentID), keyword) {
				matched = true
				break
			}
		}
		if matched {
			rootCause := models.RootCause{
				ID:          uuid.New(),
				Component:   req.IncidentID,
				Category:    category,
				Description: fmt.Sprintf("Root cause identified in category: %s", category),
				Evidence:    []string{fmt.Sprintf("Time range: %s to %s", req.TimeRange.Start, req.TimeRange.End)},
				Impact:      "high",
				Priority:    len(rootCauses) + 1,
				Fixes:       s.suggestFixes(category),
				CreatedAt:   time.Now(),
			}
			rootCauses = append(rootCauses, rootCause)
			confidence += 0.15
		}
	}

	if len(rootCauses) == 0 {
		rootCauses = append(rootCauses, models.RootCause{
			ID:          uuid.New(),
			Component:   req.IncidentID,
			Category:    "unknown",
			Description: "No clear root cause identified. Manual investigation required.",
			Evidence:    []string{"No matching patterns found"},
			Impact:      "unknown",
			Priority:    1,
			Fixes:       []models.Fix{{Title: "Manual investigation required", Description: "Analyze logs and metrics manually"}},
			CreatedAt:   time.Now(),
		})
		confidence = 0.05
	}

	return rootCauses, min(confidence, 0.95)
}

func (s *RCAService) suggestFixes(category string) []models.Fix {
	fixes := map[string][]models.Fix{
		"performance": {
			{Title: "Optimize database queries", Description: "Add indexes, optimize slow queries", Priority: 1, Status: "suggested"},
			{Title: "Scale resources", Description: "Increase CPU/memory allocation", Priority: 2, Status: "suggested"},
			{Title: "Enable caching", Description: "Add Redis/Memcached layer", Priority: 3, Status: "suggested"},
		},
		"availability": {
			{Title: "Add redundancy", Description: "Deploy multiple instances", Priority: 1, Status: "suggested"},
			{Title: "Implement health checks", Description: "Add automated health monitoring", Priority: 2, Status: "suggested"},
			{Title: "Configure auto-restart", Description: "Set up process supervision", Priority: 3, Status: "suggested"},
		},
		"data": {
			{Title: "Enable backups", Description: "Implement automated backup strategy", Priority: 1, Status: "suggested"},
			{Title: "Add data validation", Description: "Implement schema validation", Priority: 2, Status: "suggested"},
		},
		"security": {
			{Title: "Review access controls", Description: "Audit permissions and roles", Priority: 1, Status: "suggested"},
			{Title: "Apply security patches", Description: "Update dependencies", Priority: 2, Status: "suggested"},
		},
		"configuration": {
			{Title: "Review recent changes", Description: "Analyze deployment history", Priority: 1, Status: "suggested"},
			{Title: "Implement config validation", Description: "Add pre-deployment checks", Priority: 2, Status: "suggested"},
		},
	}

	if f, ok := fixes[category]; ok {
		return f
	}
	return []models.Fix{{Title: "Investigate manually", Description: "No automated fix available", Priority: 1, Status: "suggested"}}
}

// GetTimeline returns the timeline for an incident.
func (s *RCAService) GetTimeline(ctx context.Context, tenantID uuid.UUID, incidentID string) ([]models.TimelineEvent, error) {
	return s.repo.GetTimeline(ctx, tenantID, incidentID, 50)
}

// SuggestFixes returns suggested fixes for a root cause.
func (s *RCAService) SuggestFixes(ctx context.Context, tenantID uuid.UUID, rootCauseID string) ([]models.Fix, error) {
	// In a real implementation, this would query the root cause and suggest fixes
	// For now, return a basic suggestion
	s.logger.Info("suggesting fixes",
		zap.String("rootCauseId", rootCauseID),
	)
	return []models.Fix{
		{Title: "Investigate logs", Description: "Check application and system logs", Priority: 1, Status: "suggested"},
		{Title: "Review metrics", Description: "Analyze relevant metrics in monitoring dashboard", Priority: 2, Status: "suggested"},
	}, nil
}

// QueryAnalysisHistory returns paginated analysis history.
func (s *RCAService) QueryAnalysisHistory(ctx context.Context, tenantID uuid.UUID, incidentID string, limit, offset int) (models.RCAAnalysisResponse, error) {
	return s.repo.QueryAnalysisHistory(ctx, tenantID, incidentID, limit, offset)
}

// GetAnalysis returns an analysis by ID.
func (s *RCAService) GetAnalysis(ctx context.Context, tenantID, id uuid.UUID) (*models.RCAAnalysis, error) {
	return s.repo.GetAnalysis(ctx, tenantID, id)
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
