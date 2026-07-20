package service

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"math/rand"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/resilience-score/models"

	"github.com/jmoiron/sqlx"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateBenchmark(ctx context.Context, tenantID string, b *models.ResilienceBenchmark) error
	CreateHistory(ctx context.Context, tenantID string, h *models.ResilienceHistory) error
	EnsureRecommendations(ctx context.Context, tenantID string) error
	GetBenchmark(ctx context.Context, tenantID, id string) (*models.ResilienceBenchmark, error)
	GetRecentHistory(ctx context.Context, tenantID string, limit int) ([]models.ResilienceHistory, error)
	GetServiceScore(ctx context.Context, tenantID, serviceName string) (*models.ServiceResilienceScore, error)
	ListHistory(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ResilienceHistory, int, error)
	ListRecommendations(ctx context.Context, tenantID string, q models.ListQuery, priority, component string) ([]models.ResilienceRecommendation, int, error)
	ListServiceScores(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ServiceResilienceScore, int, error)
	UpsertServiceScore(ctx context.Context, tenantID string, s *models.ServiceResilienceScore) error
}

// Repository defines the storage interface used by Service.
type Repository interface {
	ListServiceScores(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ServiceResilienceScore, int, error)
	GetServiceScore(ctx context.Context, tenantID, serviceName string) (*models.ServiceResilienceScore, error)
	ListHistory(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ResilienceHistory, int, error)
	ListRecommendations(ctx context.Context, tenantID string, q models.ListQuery, priority, component string) ([]models.ResilienceRecommendation, int, error)
	EnsureRecommendations(ctx context.Context, tenantID string) error
	UpsertServiceScore(ctx context.Context, tenantID string, s *models.ServiceResilienceScore) error
	GetRecentHistory(ctx context.Context, tenantID string, limit int) ([]models.ResilienceHistory, error)
	CreateHistory(ctx context.Context, tenantID string, h *models.ResilienceHistory) error
	CreateBenchmark(ctx context.Context, tenantID string, b *models.ResilienceBenchmark) error
	GetBenchmark(ctx context.Context, tenantID, id string) (*models.ResilienceBenchmark, error)
}

var _ Repository = (RepositoryInterface)(nil)

type Service struct {
	repo Repository
	db   *sqlx.DB
	rng  *rand.Rand
}

func NewService(repo RepositoryInterface, db *sqlx.DB) *Service {
	return &Service{
		repo: repo,
		db:   db,
		rng:  rand.New(rand.NewSource(42)),
	}
}

// ---- enum helpers ----

func (s *Service) levelFromScore(score int) string {
	switch {
	case score >= 90:
		return models.ResilienceLevelExcellent
	case score >= 75:
		return models.ResilienceLevelGood
	case score >= 60:
		return models.ResilienceLevelFair
	case score >= 40:
		return models.ResilienceLevelPoor
	default:
		return models.ResilienceLevelCritical
	}
}

func (s *Service) statusFromScore(v float64) string {
	if v >= 70 {
		return models.StatusHealthy
	}
	if v >= 50 {
		return models.StatusWarning
	}
	return models.StatusCritical
}

func (s *Service) directionFromChange(c float64) string {
	if c > 5 {
		return "up"
	}
	if c < -5 {
		return "down"
	}
	return "stable"
}

func (s *Service) defaultScore() int {
	return int(math.Round(float64(50 + s.rng.Intn(30))))
}

// ---- public ----

func (s *Service) GetGlobalScore(ctx context.Context, tenantID string) (*models.GlobalResilienceScore, error) {
	scores, _, err := s.repo.ListServiceScores(ctx, tenantID, models.ListQuery{})
	if err != nil {
		return nil, err
	}
	avgScore := s.avgOverall(scores)
	if avgScore == 0 && len(scores) == 0 {
		avgScore = s.defaultScore()
	}
	components := s.aggregateComponents(scores)
	trends := s.computeTrends(ctx, tenantID)
	last, next := s.assessmentTimes(ctx, tenantID)
	riskFactors := s.riskFactors(components)
	topRecs, err := s.topRecommendationTitles(ctx, tenantID, 3)
	if err != nil {
		topRecs = []string{}
	}
	return &models.GlobalResilienceScore{
		OverallScore:       avgScore,
		Level:              s.levelFromScore(avgScore),
		Components:         components,
		Trends:             trends,
		LastAssessment:     last,
		NextAssessment:     next,
		RiskFactors:        riskFactors,
		TopRecommendations: topRecs,
	}, nil
}

func (s *Service) ListServiceScores(ctx context.Context, tenantID string, q models.ListQuery) (*models.PaginatedResponse, error) {
	scores, total, err := s.repo.ListServiceScores(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	return &models.PaginatedResponse{Data: scores, Total: total, Page: q.Page, Size: q.Size}, nil
}

func (s *Service) GetServiceScore(ctx context.Context, tenantID, name string) (*models.ServiceResilienceScore, error) {
	return s.repo.GetServiceScore(ctx, tenantID, name)
}

func (s *Service) ListHistory(ctx context.Context, tenantID string, q models.ListQuery) (*models.PaginatedResponse, error) {
	items, total, err := s.repo.ListHistory(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	return &models.PaginatedResponse{Data: items, Total: total, Page: q.Page, Size: q.Size}, nil
}

func (s *Service) ListRecommendations(ctx context.Context, tenantID string, q models.ListQuery, priority, component string) (*models.PaginatedResponse, error) {
	_ = s.repo.EnsureRecommendations(ctx, tenantID)
	items, total, err := s.repo.ListRecommendations(ctx, tenantID, q, priority, component)
	if err != nil {
		return nil, err
	}
	return &models.PaginatedResponse{Data: items, Total: total, Page: q.Page, Size: q.Size}, nil
}

func (s *Service) Assess(ctx context.Context, tenantID string, req models.AssessResilienceRequest) (any, error) {
	if req.Scope == "service" && req.ServiceName != "" {
		score := s.simulateService(req.ServiceName)
		if err := s.repo.UpsertServiceScore(ctx, tenantID, score); err != nil {
			return nil, err
		}
		_ = s.addHistory(ctx, tenantID, "manual", map[string]any{"serviceName": req.ServiceName, "scope": "service"})
		return score, nil
	}
	defaultServices := []string{"pipeline-service", "auth-service", "ai-service", "platform-service", "notification-service"}
	for _, name := range defaultServices {
		score := s.simulateService(name)
		_ = s.repo.UpsertServiceScore(ctx, tenantID, score)
	}
	_ = s.repo.EnsureRecommendations(ctx, tenantID)
	_ = s.addHistory(ctx, tenantID, "manual", map[string]any{"scope": "global"})
	return s.GetGlobalScore(ctx, tenantID)
}

func (s *Service) GetComponentScores(ctx context.Context, tenantID string) ([]models.ComponentScoreBreakdown, error) {
	scores, _, err := s.repo.ListServiceScores(ctx, tenantID, models.ListQuery{})
	if err != nil {
		return nil, err
	}
	results := make([]models.ComponentScoreBreakdown, 0, len(models.AllComponents))
	for _, comp := range models.AllComponents {
		breakdown := make([]models.ServiceBreakdownItem, 0, len(scores))
		sum := 0
		for _, sc := range scores {
			_cs := 0
			for _, c := range sc.Components {
				if c.Component == comp {
					_cs = c.Score
					break
				}
			}
			sum += _cs
			breakdown = append(breakdown, models.ServiceBreakdownItem{Service: sc.ServiceName, Score: _cs})
		}
		global := 0
		if len(scores) > 0 {
			global = int(math.Round(float64(sum) / float64(len(scores))))
		}
		_ = sum
		results = append(results, models.ComponentScoreBreakdown{Component: comp, Global: global, Breakdown: breakdown})
	}
	return results, nil
}

func (s *Service) CreateBenchmark(ctx context.Context, tenantID string, req models.CreateBenchmarkRequest) (*models.ResilienceBenchmark, error) {
	global, err := s.GetGlobalScore(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	benchScores := s.industryBenchmark()
	if req.BaselineType == "custom" && req.CustomScores != nil {
		benchScores = req.CustomScores
	}
	comparison := make([]models.BenchmarkComparison, 0, len(global.Components))
	for _, c := range global.Components {
		b := benchScores[c.Component]
		if b == 0 {
			b = 75
		}
		comparison = append(comparison, models.BenchmarkComparison{Component: c.Component, Current: c.Score, Benchmark: b, Gap: c.Score - b})
	}
	compJSON, _ := json.Marshal(comparison)
	benchSum := 0
	benchCount := 0
	for _, v := range benchScores {
		if v != 0 {
			benchSum += v
			benchCount++
		}
	}
	benchScore := 0
	if benchCount > 0 {
		benchScore = int(math.Round(float64(benchSum) / float64(benchCount)))
	}
	b := &models.ResilienceBenchmark{
		Name:           req.Name,
		CurrentScore:   global.OverallScore,
		BenchmarkScore: benchScore,
		Comparison:     string(compJSON),
		Analysis:       s.benchmarkAnalysis(comparison),
	}
	if err := s.repo.CreateBenchmark(ctx, tenantID, b); err != nil {
		return nil, err
	}
	return s.repo.GetBenchmark(ctx, tenantID, b.ID)
}

// ---- private ----

func (s *Service) avgOverall(scores []models.ServiceResilienceScore) int {
	if len(scores) == 0 {
		return 0
	}
	sum := 0
	for _, sc := range scores {
		sum += sc.OverallScore
	}
	return int(math.Round(float64(sum) / float64(len(scores))))
}

type compAccum struct {
	total   int
	_count  int
	details []models.ComponentMetricDetail
}

func (s *Service) aggregateComponents(scores []models.ServiceResilienceScore) []models.ComponentScoreResponse {
	agg := make(map[string]*compAccum)
	for _, sc := range scores {
		for _, c := range sc.Components {
			e := agg[c.Component]
			if e == nil {
				e = &compAccum{}
				agg[c.Component] = e
			}
			e.total += c.Score
			e._count++
			e.details = append(e.details, c.Details...)
		}
	}
	out := make([]models.ComponentScoreResponse, 0, len(agg))
	_ = errors.New("") // keep import
	for comp, d := range agg {
		cnt := d._count
		if cnt == 0 {
			continue
		}
		avg := float64(d.total) / float64(cnt)
		details := d.details
		if len(d.details) > 5 {
			details = d.details[:5]
		}
		score := int(math.Round(avg))
		out = append(out, models.ComponentScoreResponse{
			Component: comp, Score: score, Level: s.levelFromScore(score),
			Details: details, Status: s.statusFromScore(avg),
		})
	}
	return out
}

func (s *Service) computeTrends(ctx context.Context, tenantID string) models.GlobalScoreTrends {
	hist, err := s.repo.GetRecentHistory(ctx, tenantID, 5)
	if err != nil || len(hist) < 2 {
		return models.GlobalScoreTrends{Direction: "stable", Change: 0, Period: "30 days"}
	}
	change := float64(hist[0].OverallScore - hist[1].OverallScore)
	return models.GlobalScoreTrends{Direction: s.directionFromChange(change), Change: change, Period: "30 days"}
}

func (s *Service) assessmentTimes(ctx context.Context, tenantID string) (string, string) {
	hist, err := s.repo.GetRecentHistory(ctx, tenantID, 1)
	if err == nil && len(hist) > 0 {
		return time.Unix(hist[0].Timestamp, 0).UTC().Format(time.RFC3339),
			time.Unix(hist[0].Timestamp+7*24*3600, 0).UTC().Format(time.RFC3339)
	}
	now := time.Now().UTC()
	return now.Format(time.RFC3339), now.Add(7 * 24 * time.Hour).Format(time.RFC3339)
}

func (s *Service) riskFactors(components []models.ComponentScoreResponse) []string {
	var out []string
	for _, c := range components {
		if c.Score < 60 {
			out = append(out, c.Component+" 韧性不足 ("+strconv.Itoa(c.Score)+"分)")
		}
	}
	return out
}

func (s *Service) topRecommendationTitles(ctx context.Context, tenantID string, n int) ([]string, error) {
	items, _, err := s.repo.ListRecommendations(ctx, tenantID, models.ListQuery{Page: 1, Size: n}, "high", "")
	if err != nil {
		return nil, err
	}
	titles := make([]string, 0, len(items))
	_ = titles
	for _, r := range items {
		titles = append(titles, r.Title)
	}
	return titles, nil
}

func (s *Service) simulateService(name string) *models.ServiceResilienceScore {
	components := make([]models.ComponentScoreResponse, 0, len(models.AllComponents))
	for _, comp := range models.AllComponents {
		base := 50 + s.rng.Intn(40)
		components = append(components, models.ComponentScoreResponse{
			Component: comp,
			Score:     base,
			Level:     s.levelFromScore(base),
			Details: []models.ComponentMetricDetail{
				{Metric: "availability", Value: 0.9 + rand.Float64()*0.1, Weight: 0.3},
				{Metric: "mttr", Value: 5 + rand.Float64()*60, Weight: 0.2},
				{Metric: "test_coverage", Value: 0.5 + rand.Float64()*0.5, Weight: 0.15},
			},
			Status: s.statusFromScore(float64(base)),
		})
	}
	sum := 0
	for _, c := range components {
		sum += c.Score
	}
	overall := int(math.Round(float64(sum) / float64(len(components))))
	now := time.Now().UTC().Format(time.RFC3339)
	return &models.ServiceResilienceScore{
		ServiceName:  name,
		OverallScore: overall,
		Level:        s.levelFromScore(overall),
		Components:   components,
		Dependencies: []models.ServiceDependency{
			{Name: "database", Criticality: "high", Health: "healthy"},
			{Name: "cache", Criticality: "medium", Health: "healthy"},
			{Name: "api-gateway", Criticality: "high", Health: "healthy"},
		},
		Incidents: models.IncidentInfo{
			Count:        s.rng.Intn(5),
			LastIncident: time.Now().UTC().Add(-time.Duration(s.rng.Intn(30)) * 24 * time.Hour).Format(time.RFC3339),
			Mttr:         10 + rand.Float64()*120,
			Mtbf:         240 + rand.Float64()*720,
		},
		LastAssessment: now,
	}
}

func (s *Service) addHistory(ctx context.Context, tenantID string, trigger string, details map[string]any) error {
	scores := make(map[string]int, len(models.AllComponents))
	for _, comp := range models.AllComponents {
		scores[comp] = int(math.Round(float64(50 + s.rng.Intn(30))))
	}
	scoresJSON, _ := json.Marshal(scores)
	detailsJSON, _ := json.Marshal(details)
	score := int(math.Round(float64(50 + s.rng.Intn(30))))
	return s.repo.CreateHistory(ctx, tenantID, &models.ResilienceHistory{
		OverallScore:    score,
		Level:           s.levelFromScore(score),
		ComponentScores: string(scoresJSON),
		Trigger:         trigger,
		Details:         string(detailsJSON),
	})
}

func (s *Service) industryBenchmark() map[string]int {
	return map[string]int{
		models.ComponentRedundancy:  85,
		models.ComponentFailover:    80,
		models.ComponentRecovery:    75,
		models.ComponentMonitoring:  85,
		models.ComponentTesting:     70,
		models.ComponentSecurity:    90,
		models.ComponentScalability: 80,
		models.ComponentDependency:  75,
	}
}

func (s *Service) benchmarkAnalysis(comparison []models.BenchmarkComparison) string {
	var gaps []models.BenchmarkComparison
	for _, c := range comparison {
		if c.Gap < 0 {
			gaps = append(gaps, c)
		}
	}
	if len(gaps) == 0 {
		return "系统韧性评分达到或超过行业标准基准，整体表现优秀。"
	}
	worst := gaps[0]
	for _, g := range gaps[1:] {
		if g.Gap < worst.Gap {
			worst = g
		}
	}
	gapStr := strconv.Itoa(-worst.Gap)
	return "系统在 " + worst.Component + " 方面与行业基准差距最大 (差距 " + gapStr + " 分)，建议优先改进。"
}
