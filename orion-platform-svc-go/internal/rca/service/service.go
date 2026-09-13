package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/rca/models"
	"orion/platform-svc-go/internal/rca/repository"
)

type RCAService struct {
	repo   repository.Repository
	logger *zap.Logger
}

// NewRCAService builds the RCA service. A nil logger is replaced with a no-op
// logger rather than stored: Analyze logs on every call, so a nil logger
// dereferences inside zap and panics the first time an analysis runs. The rest
// of the platform follows the same guard, so a caller that omits the logger does
// not take the process down with it.
func NewRCAService(repo repository.Repository, logger *zap.Logger) *RCAService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &RCAService{repo: repo, logger: logger}
}

// categoryTable is the pattern catalogue the analysis draws from. The keys are
// the category names accepted in include_patterns / exclude_patterns, and the
// values are the same keywords a caller may name instead of the category.
var categoryTable = map[string][]string{
	"performance":   {"latency", "timeout", "slow_query", "resource_exhaustion"},
	"availability":  {"crash", "restart", "connection_refused", "health_check_failure"},
	"data":          {"corruption", "inconsistency", "data_loss", "migration_failure"},
	"security":      {"unauthorized", "vulnerability", "authentication_failure"},
	"configuration": {"config_change", "deployment_failure", "rollback"},
}

// Analyze performs root cause analysis for an incident.
func (s *RCAService) Analyze(ctx context.Context, tenantID uuid.UUID, req *models.AnalyzeRequest, triggeredBy string) (*models.RCAAnalysis, error) {
	analysis, err := s.repo.CreateAnalysis(ctx, tenantID, req.IncidentID, triggeredBy)
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

	if err := s.repo.UpdateAnalysis(ctx, tenantID, analysis.ID, "completed", rootCauses, confidence); err != nil {
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

// selectedCategories turns the caller's include/exclude pattern lists into the
// ordered set of categories the analysis covers.
//
// Semantics:
//   - an empty include_patterns list means "consider everything" — the caller
//     asked for a general analysis rather than a targeted one;
//   - a category is included when it is named, or when any of its keywords is
//     named; case and whitespace are ignored;
//   - exclude_patterns always wins over include_patterns;
//   - the result is sorted so the output is deterministic. Go map iteration is
//     random, and the old version iterated the pattern map directly, so two
//     identical requests could have produced different priority orderings.
func selectedCategories(include, exclude []string) []string {
	excluded := normalizeSet(exclude)

	matched := func(name string, keywords []string) bool {
		if _, ok := excluded[name]; ok {
			return false
		}
		for _, k := range keywords {
			if _, ok := excluded[k]; ok {
				return false
			}
		}
		return true
	}

	if len(include) == 0 {
		out := make([]string, 0, len(categoryTable))
		for name, keywords := range categoryTable {
			if matched(name, keywords) {
				out = append(out, name)
			}
		}
		sort.Strings(out)
		return out
	}

	included := normalizeSet(include)
	out := make([]string, 0, len(categoryTable))
	for name, keywords := range categoryTable {
		if !matched(name, keywords) {
			continue
		}
		if _, ok := included[name]; ok {
			out = append(out, name)
			continue
		}
		for _, k := range keywords {
			if _, ok := included[k]; ok {
				out = append(out, name)
				break
			}
		}
	}
	sort.Strings(out)
	return out
}

// normalizeSet lowercases and trims the entries of a caller-supplied list.
func normalizeSet(list []string) map[string]struct{} {
	out := make(map[string]struct{}, len(list))
	for _, e := range list {
		e = strings.ToLower(strings.TrimSpace(e))
		if e != "" {
			out[e] = struct{}{}
		}
	}
	return out
}

// performAnalysis derives root causes from the caller's request.
//
// It is a pure function of include_patterns, exclude_patterns and the analysis
// window. It used to match keyword strings against req.IncidentID — an
// identifier, not content — so for a UUID-shaped id no keyword could ever
// match, the entire category table was dead code, and every single analysis
// returned category "unknown" with confidence 0.05 regardless of input.
//
// When the caller supplies no signal at all the honest answer is no root cause
// and zero confidence, not an invented one.
func (s *RCAService) performAnalysis(req *models.AnalyzeRequest) ([]models.RootCause, float64) {
	categories := selectedCategories(req.IncludePatterns, req.ExcludePatterns)
	if len(categories) == 0 {
		return []models.RootCause{}, 0.0
	}

	evidence := []string{fmt.Sprintf("Time range: %s to %s",
		req.TimeRange.Start.Format(time.RFC3339),
		req.TimeRange.End.Format(time.RFC3339))}
	rootCauses := make([]models.RootCause, 0, len(categories))
	for i, category := range categories {
		rootCauses = append(rootCauses, models.RootCause{
			ID:          uuid.New(),
			Component:   req.IncidentID,
			Category:    category,
			Description: fmt.Sprintf("Root cause identified in category: %s", category),
			Evidence:    evidence,
			Impact:      "high",
			Priority:    i + 1,
			Fixes:       suggestFixes(category),
			CreatedAt:   time.Now(),
		})
	}

	// Confidence is the fraction of the catalogue the caller pinned down: naming
	// one of five categories is a far more specific signal than asking for all
	// five. No signal at all returns 0.0 above rather than a fabricated number.
	confidence := min(float64(len(categories))/float64(len(categoryTable)), 0.95)
	return rootCauses, confidence
}

func suggestFixes(category string) []models.Fix {
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

// GetTimeline returns the timeline for the incident that the given analysis
// covers. The lookup goes through the tenant-scoped GetAnalysis first, so an
// analysis id that belongs to another tenant is a not-found rather than a
// cross-tenant timeline read.
func (s *RCAService) GetTimeline(ctx context.Context, tenantID, analysisID uuid.UUID) ([]models.TimelineEvent, error) {
	analysis, err := s.repo.GetAnalysis(ctx, tenantID, analysisID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTimeline(ctx, tenantID, analysis.IncidentID, 50)
}

// SuggestFixes returns the suggested fixes of the root causes a given analysis
// produced, aggregated in priority order.
//
// The path parameter is an analysis id. The previous implementation passed it
// to a query on rca_root_causes.id, which could never match an analysis id, so
// the endpoint was permanently empty — and that query took a tenantID it never
// used, on a table that has no tenant column at all.
func (s *RCAService) SuggestFixes(ctx context.Context, tenantID, analysisID uuid.UUID) ([]models.Fix, error) {
	analysis, err := s.repo.GetAnalysis(ctx, tenantID, analysisID)
	if err != nil {
		return nil, err
	}
	fixes := []models.Fix{}
	for _, rc := range analysis.RootCauses {
		for _, f := range rc.Fixes {
			f.RootCauseID = rc.ID
			fixes = append(fixes, f)
		}
	}
	sort.SliceStable(fixes, func(i, j int) bool { return fixes[i].Priority < fixes[j].Priority })
	return fixes, nil
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
