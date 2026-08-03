package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"strconv"
	"strings"

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
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
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
