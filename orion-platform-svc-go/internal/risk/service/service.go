package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/risk/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.Risk) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Risk, error)
	List(ctx context.Context, tenantID string) ([]models.Risk, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Risk, error)
}

// riskLevels defines the standard risk level buckets.
// Score = Severity × Probability × Impact, range [1, 125].
var riskLevels = []models.RiskLevel{
	{Name: "low", Label: "Low", Color: "#52c41a", Min: 1, Max: 20},
	{Name: "medium", Label: "Medium", Color: "#faad14", Min: 21, Max: 50},
	{Name: "high", Label: "High", Color: "#fa8c16", Min: 51, Max: 80},
	{Name: "critical", Label: "Critical", Color: "#f5222d", Min: 81, Max: 125},
}

type Service struct {
	repo RepositoryInterface

	// scoreHistory tracks weighted scores per risk (tenantID:ID -> []scoreRecord)
	scoreHistoryMu sync.RWMutex
	scoreHistory   map[string][]scoreRecord
}

type scoreRecord struct {
	score float64
	ts    time.Time
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{
		repo:         repo,
		scoreHistory: make(map[string][]scoreRecord),
	}
}

// ---------- Enhanced scoring methods ----------

// CalculateWeightedScore computes a weighted risk score from a set of risk factors.
// Score = sum(factor.Weight * factor.Value), clamped to [0, 100].
// The resulting score is mapped to a level using 0-25=Low, 26-50=Medium, 51-75=High, 76-100=Critical.
func (s *Service) CalculateWeightedScore(_ context.Context, factors []models.RiskFactor, mitigation *models.MitigationPlan) (*models.WeightedScoreResult, error) {
	if len(factors) == 0 {
		return &models.WeightedScoreResult{
			Score:  0,
			Level:  "low",
			FactorBreakdown: []models.FactorBreakdown{},
		}, nil
	}

	breakdown := make([]models.FactorBreakdown, len(factors))
	var totalWeight float64
	var rawScore float64

	for i, f := range factors {
		contrib := f.Weight * f.Value
		totalWeight += f.Weight
		rawScore += contrib
		breakdown[i] = models.FactorBreakdown{
			Name:         f.Name,
			Weight:       f.Weight,
			Value:        f.Value,
			Contribution: contrib,
		}
	}

	// Normalize if weights don't sum to 1, then apply mitigation.
	score := rawScore
	if totalWeight > 0 {
		score = score / totalWeight
	}

	// Apply mitigation effectiveness: reduce score by the mitigation factor.
	if mitigation != nil && mitigation.Effectiveness > 0 {
		score = score * (1 - mitigation.Effectiveness)
	}

	// Clamp to [0, 100].
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	// Record into history (use first factor name as key).
	s.recordScore("global", breakdown[0].Name, score, time.Now())

	level := mapWeightedScore(score)
	result := &models.WeightedScoreResult{
		Score:           score,
		Level:           level,
		FactorBreakdown: breakdown,
		Mitigation:      mitigation,
	}
	return result, nil
}

// recordScore appends a score to the in-memory history for trend computation.
func (s *Service) recordScore(tenantID, riskName string, score float64, ts time.Time) {
	key := tenantID + ":" + riskName
	s.scoreHistoryMu.Lock()
	defer s.scoreHistoryMu.Unlock()
	s.scoreHistory[key] = append(s.scoreHistory[key], scoreRecord{score: score, ts: ts})
	// Keep last 1000 records to bound memory.
	if len(s.scoreHistory[key]) > 1000 {
		s.scoreHistory[key] = s.scoreHistory[key][len(s.scoreHistory[key])-1000:]
	}
}

// mapWeightedScore maps a score in [0, 100] to a risk level.
func mapWeightedScore(score float64) string {
	switch {
	case score <= 25:
		return "low"
	case score <= 50:
		return "medium"
	case score <= 75:
		return "high"
	default:
		return "critical"
	}
}

// GetRiskTrends returns aggregated score deltas over time since the given cutoff.
// It reads the in-memory score history plus the current risk list from the repo.
func (s *Service) GetRiskTrends(_ context.Context, tenantID string, since time.Time) ([]models.RiskTrend, error) {
	risks, err := s.repo.List(ctxForTrends(), tenantID)
	if err != nil {
		return nil, fmt.Errorf("list risks for trends: %w", err)
	}

	s.scoreHistoryMu.RLock()
	defer s.scoreHistoryMu.RUnlock()

	trends := make([]models.RiskTrend, 0, len(risks))
	for _, r := range risks {
		key := tenantID + ":" + r.Name
		records := s.scoreHistory[key]
		records = filterSince(records, since)

		if len(records) == 0 {
			trends = append(trends, models.RiskTrend{
				RiskID:        r.ID,
				RiskName:      r.Name,
				AvgScore:      0,
				MinScore:      0,
				MaxScore:      0,
				ScoreDelta:    0,
				SampleCount:   0,
				TrendDirection: "stable",
			})
			continue
		}

		var sum, minV, maxV float64
		for i, rec := range records {
			if i == 0 {
				minV = rec.score
				maxV = rec.score
			} else {
				if rec.score < minV {
					minV = rec.score
				}
				if rec.score > maxV {
					maxV = rec.score
				}
			}
			sum += rec.score
		}
		avg := sum / float64(len(records))
		delta := maxV - minV
		direction := "stable"
		if len(records) >= 2 {
			if records[len(records)-1].score > records[0].score+0.001 {
				direction = "up"
			} else if records[len(records)-1].score < records[0].score-0.001 {
				direction = "down"
			}
		}

		trends = append(trends, models.RiskTrend{
			RiskID:        r.ID,
			RiskName:      r.Name,
			AvgScore:      roundFloat(avg, 2),
			MinScore:      roundFloat(minV, 2),
			MaxScore:      roundFloat(maxV, 2),
			ScoreDelta:    roundFloat(delta, 2),
			SampleCount:   len(records),
			TrendDirection: direction,
		})
	}
	return trends, nil
}

// ctxForTrends returns a context used internally for the GetRiskTrends repo call.
// Exported so tests can override if needed.
var ctxForTrends = func() context.Context {
	return context.Background()
}

func filterSince(records []scoreRecord, since time.Time) []scoreRecord {
	var filtered []scoreRecord
	for _, r := range records {
		if !r.ts.Before(since) {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

// GetCorrelatedRisks finds pairs of risks within a tenant that share overlapping tags
// (encoded in the Risk.Value field as comma-separated tag strings) and returns them.
// Only pairs with overlap_score > 0 are returned, sorted by overlap descending.
func (s *Service) GetCorrelatedRisks(ctx context.Context, tenantID string) ([]models.CorrelatedRiskPair, error) {
	risks, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	pairs := make([]models.CorrelatedRiskPair, 0)
	for i := 0; i < len(risks); i++ {
		for j := i + 1; j < len(risks); j++ {
			a := &risks[i]
			b := &risks[j]
			tagsA := parseTags(a.Value)
			tagsB := parseTags(b.Value)
			shared, union := tagIntersectionAndUnion(tagsA, tagsB)
			if len(shared) == 0 {
				continue
			}
			var overlap float64
			if len(union) > 0 {
				overlap = float64(len(shared)) / float64(len(union))
			}
			pairs = append(pairs, models.CorrelatedRiskPair{
				RiskA:        a,
				RiskB:        b,
				SharedTags:   shared,
				OverlapScore: roundFloat(overlap, 3),
			})
		}
	}
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].OverlapScore > pairs[j].OverlapScore
	})
	return pairs, nil
}

// parseTags extracts comma-separated tags from the risk Value field.
// Falls back to splitting on space or returning the value as a single tag.
func parseTags(value string) []string {
	if value == "" {
		return nil
	}
	if strings.Contains(value, ",") {
		return splitAndTrim(value, ",")
	}
	if strings.Contains(value, " ") {
		return splitAndTrim(value, " ")
	}
	return []string{strings.TrimSpace(value)}
}

func splitAndTrim(s string, sep string) []string {
	var out []string
	for _, part := range strings.Split(s, sep) {
		p := strings.TrimSpace(part)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func tagIntersectionAndUnion(a, b []string) (shared, unionSet []string) {
	setA := make(map[string]bool)
	for _, t := range a {
		setA[t] = true
	}
	union := make(map[string]bool)
	for _, t := range a {
		union[t] = true
	}
	var sharedOut []string
	for _, t := range b {
		union[t] = true
		if setA[t] {
			sharedOut = append(sharedOut, t)
		}
	}
	// Make union deterministic.
	for t := range union {
		unionSet = append(unionSet, t)
	}
	return sharedOut, unionSet
}

// ---------- Helpers ----------

func roundFloat(v float64, decimals int) float64 {
	pow := math.Pow(10, float64(decimals))
	return math.Round(v*pow) / pow
}

// ---------- CRUD methods ----------

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRiskRequest) (*models.Risk, error) {
	m := &models.Risk{TenantID: tenantID, Name: req.Name, Value: req.Value, Enabled: req.Enabled}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Risk, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Risk, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateRiskRequest) (*models.Risk, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Value != nil {
		updates["value"] = *req.Value
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// ---------- Scoring methods ----------

// CalculateScore computes the risk score from severity, probability, and impact.
// Score = Severity × Probability × Impact (range 1-125).
func (s *Service) CalculateScore(ctx context.Context, req models.RiskScoreRequest) (*models.RiskScore, error) {
	score := float64(req.Severity) * float64(req.Probability) * float64(req.Impact)
	level := findRiskLevel(score)
	return &models.RiskScore{
		Score:       score,
		Level:       level.Name,
		Severity:    req.Severity,
		Probability: req.Probability,
		Impact:      req.Impact,
	}, nil
}

// GetRiskMatrix builds a 5x5 risk matrix (severity × probability) with Impact fixed at Medium (3).
func (s *Service) GetRiskMatrix(ctx context.Context) (*models.RiskMatrix, error) {
	baseImpact := models.ImpactMedium
	levels := make([]models.RiskLevel, len(riskLevels))
	copy(levels, riskLevels)

	severityLabels := []string{"Very Low", "Low", "Medium", "High", "Very High"}
	probLabels := []string{"Very Low", "Low", "Medium", "High", "Very High"}

	cells := make([]models.RiskMatrixCell, 0, 25)
	for s := models.Severity(1); s <= 5; s++ {
		for p := models.Probability(1); p <= 5; p++ {
			score := float64(s) * float64(p) * float64(baseImpact)
			level := findRiskLevel(score)
			cells = append(cells, models.RiskMatrixCell{
				Severity:    s,
				Probability: p,
				Score:       score,
				Level:       level.Name,
				Color:       level.Color,
			})
		}
	}

	return &models.RiskMatrix{
		SeverityLevels:    severityLabels,
		ProbabilityLevels: probLabels,
		Cells:             cells,
		Levels:            levels,
	}, nil
}

// GetHeatmap returns aggregated heatmap points from the tenant's risk list.
// Risks are grouped by (severity, probability, impact); each point carries count, score, and level.
func (s *Service) GetHeatmap(ctx context.Context, tenantID string) (*models.HeatmapResponse, error) {
	risks, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	matrix, err := s.GetRiskMatrix(ctx)
	if err != nil {
		return nil, err
	}

	type key struct {
		s models.Severity
		p models.Probability
		i models.Impact
	}
	agg := make(map[key]*models.HeatmapPoint)

	for _, r := range risks {
		s, p, i := parseValue(r.Value)
		k := key{s: s, p: p, i: i}
		pt, ok := agg[k]
		if !ok {
			score := float64(s) * float64(p) * float64(i)
			level := findRiskLevel(score)
			agg[k] = &models.HeatmapPoint{
				Severity:    s,
				Probability: p,
				Impact:      i,
				Score:       score,
				Level:       level.Name,
				Color:       level.Color,
				Count:       1,
			}
		} else {
			pt.Count++
		}
	}

	points := make([]models.HeatmapPoint, 0, len(agg))
	for _, pt := range agg {
		points = append(points, *pt)
	}

	return &models.HeatmapResponse{
		Points: points,
		Matrix: *matrix,
	}, nil
}

// findRiskLevel returns the highest risk level whose Min <= score.
func findRiskLevel(score float64) *models.RiskLevel {
	for i := len(riskLevels) - 1; i >= 0; i-- {
		if score >= riskLevels[i].Min {
			return &riskLevels[i]
		}
	}
	return &riskLevels[0]
}

// parseValue extracts severity/probability/impact from a risk Value string.
// Expected format: "severity:probability:impact" (e.g., "3:4:5").
// Fields out of [1,5] or missing default to Medium (3).
func parseValue(value string) (models.Severity, models.Probability, models.Impact) {
	parts := strings.SplitN(value, ":", 3)
	clamp := func(v string, defaultVal int) int {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 5 {
			return defaultVal
		}
		return n
	}
	defaultVal := 3
	getClamped := func(idx int) int {
		if idx < len(parts) {
			return clamp(parts[idx], defaultVal)
		}
		return defaultVal
	}
	return models.Severity(getClamped(0)),
		models.Probability(getClamped(1)),
		models.Impact(getClamped(2))
}
