package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"math"
	"time"

	"orion/platform-svc-go/internal/change-intelligence/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateAnalysis(ctx context.Context, a *models.ChangeAnalysis) error
	GetAnalysisByID(ctx context.Context, id string, tenantID string) (*models.ChangeAnalysis, error)
	GetBlastRadiusByAnalysisID(ctx context.Context, analysisID string) ([]models.BlastRadiusItem, error)
	ListAnalyses(ctx context.Context, tenantID string) ([]models.ChangeAnalysis, error)
	SaveBlastRadius(ctx context.Context, analysisID string, items []models.BlastRadiusItem) error
	SaveRiskFactors(ctx context.Context, analysisID string, factors []models.RiskFactor) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Analyze creates a new change analysis record with computed risk score and blast radius.
func (s *Service) Analyze(ctx context.Context, req *models.AnalyzeRequest, tenantID string, createdBy string) (*models.ChangeAnalysis, error) {
	// Compute risk score based on the changes payload.
	riskScore := computeRiskScore(req.Changes)

	// Determine blast radius items from the changes payload.
	blastRadius := s.computeBlastRadius(req.Changes)

	// Generate recommendations based on risk level.
	recommendations := generateRecommendations(riskScore, blastRadius)

	brBytes, _ := json.Marshal(blastRadius)
	affectedSvcIDs := extractAffectedServiceIDs(blastRadius)
	affectedBytes, _ := json.Marshal(affectedSvcIDs)
	recBytes, _ := json.Marshal(recommendations)

	analysis := &models.ChangeAnalysis{
		TenantID:         tenantID,
		ChangeID:         req.ChangeID,
		ServiceName:      req.ServiceName,
		RiskScore:        riskScore,
		BlastRadius:      string(brBytes),
		AffectedServices: string(affectedBytes),
		Recommendations:  string(recBytes),
		CreatedBy:        createdBy,
	}

	if err := s.repo.CreateAnalysis(ctx, analysis); err != nil {
		return nil, err
	}

	// Persist blast radius items and risk factors.
	if len(blastRadius) > 0 {
		if err := s.repo.SaveBlastRadius(ctx, analysis.ID, blastRadius); err != nil {
			return nil, err
		}
	}

	riskFactors := extractRiskFactors(req.Changes)
	if len(riskFactors) > 0 {
		if err := s.repo.SaveRiskFactors(ctx, analysis.ID, riskFactors); err != nil {
			return nil, err
		}
	}

	return s.repo.GetAnalysisByID(ctx, analysis.ID, tenantID)
}

// ListReports returns all change analyses for the given tenant.
func (s *Service) ListReports(ctx context.Context, tenantID string) ([]models.ReportSummary, int, error) {
	analyses, err := s.repo.ListAnalyses(ctx, tenantID)
	if err != nil {
		return nil, 0, err
	}
	if analyses == nil {
		analyses = []models.ChangeAnalysis{}
	}
	summaries := make([]models.ReportSummary, len(analyses))
	for i, a := range analyses {
		summaries[i] = models.ReportSummary{
			ID:          a.ID,
			ChangeID:    a.ChangeID,
			ServiceName: a.ServiceName,
			RiskScore:   a.RiskScore,
			CreatedAt:   a.CreatedAt,
		}
	}
	return summaries, len(summaries), nil
}

// GetReport returns a single change analysis detail.
func (s *Service) GetReport(ctx context.Context, id string, tenantID string) (*models.ChangeAnalysis, error) {
	analysis, err := s.repo.GetAnalysisByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAnalysisNotFound
		}
		return nil, err
	}
	return analysis, nil
}

// GetBlastRadius returns the blast radius items for a given analysis.
func (s *Service) GetBlastRadius(ctx context.Context, analysisID string, tenantID string) (*models.BlastRadiusResponse, error) {
	// Verify the analysis exists and belongs to the tenant.
	analysis, err := s.repo.GetAnalysisByID(ctx, analysisID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrAnalysisNotFound
		}
		return nil, err
	}

	items, err := s.repo.GetBlastRadiusByAnalysisID(ctx, analysisID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []models.BlastRadiusItem{}
	}

	var recommendations []string
	if err := json.Unmarshal([]byte(analysis.Recommendations), &recommendations); err != nil {
		recommendations = []string{}
	}

	return &models.BlastRadiusResponse{
		AnalysisID:       analysis.ID,
		ServiceName:      analysis.ServiceName,
		RiskScore:        analysis.RiskScore,
		AffectedServices: items,
		Recommendations:  recommendations,
	}, nil
}

// --- Risk scoring logic ---

// computeRiskScore calculates a risk score (0.0 - 1.0) based on the changes payload.
// The implementation uses heuristic analysis: number of changed entities, presence of
// critical keywords, and structural complexity.
func computeRiskScore(changesJSON string) float64 {
	var changes interface{}
	if err := json.Unmarshal([]byte(changesJSON), &changes); err != nil {
		return 0.5 // default moderate risk on parse failure
	}

	score := 0.0

	switch v := changes.(type) {
	case []interface{}:
		// Array of changes: more changes = higher risk.
		n := float64(len(v))
		score = math.Min(n/20.0, 0.6)
		for _, change := range v {
			if changeStr, ok := change.(string); ok {
				score += keywordRiskBoost(changeStr)
			}
		}
	case map[string]interface{}:
		// Object of changes: more fields = higher risk.
		n := float64(len(v))
		score = math.Min(n/15.0, 0.5)
		if svc, ok := v["service"]; ok {
			if svcStr, ok := svc.(string); ok {
				score += keywordRiskBoost(svcStr)
			}
		}
		if desc, ok := v["description"]; ok {
			if descStr, ok := desc.(string); ok {
				score += keywordRiskBoost(descStr)
			}
		}
	default:
		score = 0.3
	}

	return math.Round(math.Min(score, 1.0)*100) / 100
}

// keywordRiskBoost increases risk score for high-risk keywords in change descriptions.
func keywordRiskBoost(text string) float64 {
	highRiskKeywords := []string{"database", "schema", "migration", "api", "breaking", "auth", "security", "permission", "network", "config"}
	boost := 0.0
	for _, kw := range highRiskKeywords {
		// Simple substring match — in production this would use NLP/semantic analysis.
		for i := 0; i <= len(text)-len(kw); i++ {
			if len(text) >= i+len(kw) && text[i:i+len(kw)] == kw {
				boost += 0.05
			}
		}
	}
	return math.Min(boost, 0.4)
}

// computeBlastRadius determines the set of services potentially impacted by a change.
func (s *Service) computeBlastRadius(changesJSON string) []models.BlastRadiusItem {
	var changes interface{}
	if err := json.Unmarshal([]byte(changesJSON), &changes); err != nil {
		return nil
	}

	var items []models.BlastRadiusItem
	seen := make(map[string]bool)

	switch v := changes.(type) {
	case []interface{}:
		for _, change := range v {
			if m, ok := change.(map[string]interface{}); ok {
				item := extractBlastRadiusItem(m)
				if item != nil && !seen[item.ServiceID] {
					seen[item.ServiceID] = true
					items = append(items, *item)
				}
			}
		}
	case map[string]interface{}:
		item := extractBlastRadiusItem(v)
		if item != nil {
			items = append(items, *item)
		}
	}

	if items == nil {
		items = []models.BlastRadiusItem{}
	}
	return items
}

// extractBlastRadiusItem attempts to extract a single blast radius item from a change map.
func extractBlastRadiusItem(m map[string]interface{}) *models.BlastRadiusItem {
	svcID, _ := m["serviceId"].(string)
	svcName, _ := m["serviceName"].(string)
	if svcID == "" && svcName == "" {
		return nil
	}

	impactLevel := "medium"
	if il, ok := m["impactLevel"].(string); ok {
		impactLevel = il
	}

	probability := 0.5
	if p, ok := m["probability"].(float64); ok {
		probability = p
	}

	return &models.BlastRadiusItem{
		ServiceID:   svcID,
		ServiceName: svcName,
		ImpactLevel: impactLevel,
		Probability: probability,
	}
}

// extractAffectedServiceIDs returns a list of affected service identifiers from blast radius items.
func extractAffectedServiceIDs(items []models.BlastRadiusItem) []string {
	ids := make([]string, len(items))
	for i, item := range items {
		name := item.ServiceName
		if name == "" {
			name = item.ServiceID
		}
		ids[i] = name
	}
	return ids
}

// generateRecommendations produces human-readable recommendations based on risk score and blast radius.
func generateRecommendations(riskScore float64, blastRadius []models.BlastRadiusItem) []string {
	recs := []string{}

	if riskScore >= 0.7 {
		recs = append(recs, "High-risk change detected. Consider a staged rollout with canary deployments.")
		recs = append(recs, "Notify all downstream service owners before applying this change.")
	} else if riskScore >= 0.4 {
		recs = append(recs, "Moderate-risk change. Verify with integration tests before deployment.")
	} else {
		recs = append(recs, "Low-risk change. Standard CI/CD pipeline should be sufficient.")
	}

	if len(blastRadius) > 3 {
		recs = append(recs, "Wide blast radius detected. Consider splitting this change into smaller, isolated changes.")
	}

	for _, item := range blastRadius {
		if item.ImpactLevel == "high" {
			recs = append(recs, "Service '"+item.ServiceName+"' has high impact. Coordinate with the owning team before deployment.")
		}
	}

	if len(recs) == 0 {
		recs = append(recs, "No specific recommendations. Proceed with standard change management process.")
	}

	return recs
}

// extractRiskFactors derives risk factors from the changes payload for persistence.
func extractRiskFactors(changesJSON string) []models.RiskFactor {
	var changes interface{}
	if err := json.Unmarshal([]byte(changesJSON), &changes); err != nil {
		return nil
	}

	var factors []models.RiskFactor

	changeCount := 0
	switch v := changes.(type) {
	case []interface{}:
		changeCount = len(v)
	case map[string]interface{}:
		changeCount = len(v)
	}

	if changeCount > 10 {
		factors = append(factors, models.RiskFactor{
			Factor:      "change_volume",
			Score:       0.7,
			Description: "Large number of changes increases likelihood of unintended side effects.",
		})
	} else if changeCount > 5 {
		factors = append(factors, models.RiskFactor{
			Factor:      "change_volume",
			Score:       0.4,
			Description: "Moderate number of changes detected.",
		})
	} else {
		factors = append(factors, models.RiskFactor{
			Factor:      "change_volume",
			Score:       0.1,
			Description: "Small number of changes.",
		})
	}

	return factors
}

// --- Errors ---

var (
	ErrAnalysisNotFound = errors.New("change analysis not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrAnalysisNotFound)
}

// --- Helpers ---

func nowTimestamp() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.New().String()
}
