package service

import (
	"fmt"
	"math"
	"testing"

	"orion/platform-svc-go/internal/governance/risk/models"
)

// ---------------------------------------------------------------
// Score level thresholds
// ---------------------------------------------------------------

func TestEvaluateRiskLevel(t *testing.T) {
	svc := NewService(nil)

	cases := []struct {
		score    float64
		want     string
	}{
		{0, "low"},
		{10, "low"},
		{25, "low"},
		{26, "medium"},
		{50, "medium"},
		{51, "high"},
		{75, "high"},
		{76, "critical"},
		{100, "critical"},
	}

	for _, tc := range cases {
		t.Run(tc.want+fmt.Sprintf("_%d", int(tc.score)), func(t *testing.T) {
			got := svc.EvaluateRiskLevel(tc.score)
			if got != tc.want {
				t.Errorf("score=%.0f: want level=%q, got %q", tc.score, tc.want, got)
			}
		})
	}
}

// ---------------------------------------------------------------
// Weighted score computation
// ---------------------------------------------------------------

func TestComputeWeightedScore(t *testing.T) {
	svc := NewService(nil)

	// Single factor, weight 1.0, score 50 => 50
	factors := []models.RiskFactor{{Name: "a", Weight: 1.0, Score: 50}}
	if got := svc.ComputeWeightedScore(factors); got != 50 {
		t.Errorf("single factor: want 50, got %f", got)
	}

	// Two factors with different weights: (10*0.5 + 90*0.5)/1.0 = 50
	factors = []models.RiskFactor{
		{Name: "a", Weight: 0.5, Score: 10},
		{Name: "b", Weight: 0.5, Score: 90},
	}
	if got := svc.ComputeWeightedScore(factors); got != 50 {
		t.Errorf("two factors: want 50, got %f", got)
	}

	// Empty => 0
	if got := svc.ComputeWeightedScore([]models.RiskFactor{}); got != 0 {
		t.Errorf("empty: want 0, got %f", got)
	}

	// Capped at 100: (100*0.5 + 100*0.5) = 100
	factors = []models.RiskFactor{
		{Name: "a", Weight: 0.5, Score: 100},
		{Name: "b", Weight: 0.5, Score: 100},
	}
	if got := svc.ComputeWeightedScore(factors); got != 100 {
		t.Errorf("capped at 100: want 100, got %f", got)
	}
}

// ---------------------------------------------------------------
// Default weights
// ---------------------------------------------------------------

func TestDefaultWeightsSumToOne(t *testing.T) {
	w := DefaultWeights()
	sum := w.Technical.ChangeSize + w.Technical.ChangeComplexity + w.Technical.DependencyCount + w.Technical.TestCoverage +
		w.Historical.FailureRate + w.Historical.RecentIncidents + w.Historical.MTTR +
		w.Organizational.TeamExperience + w.Organizational.ReviewCompleteness + w.Organizational.TimeOfDay
	if !floatEqual(sum, 1.0) {
		t.Errorf("default weights sum to %f, want 1.0", sum)
	}
}

// ---------------------------------------------------------------
// Integration: full ScoreDeploymentRisk with various risk profiles
// ---------------------------------------------------------------

func TestScoreDeploymentRisk(t *testing.T) {
	svc := NewService(nil)

	tests := []struct {
		name     string
		risk     models.DeploymentRisk
		wantLow  string // expected risk level (low/medium/high/critical)
		validate func(t *testing.T, score float64, level string, factors []models.RiskFactor, recs []models.RiskRecommendation)
	}{
		{
			name: "low risk - small change, no issues",
			risk: models.DeploymentRisk{
				ChangeSize:   models.ChangeSize{FilesChanged: 3, LinesChanged: 50},
				TimeRisk:     models.TimeRisk{},
				HistoricalRisk: models.HistoricalRisk{RecentFailureRate: 0.02, RecentIncidents: 0, AverageMTTR: 10*60*1000},
			},
			wantLow: "low",
		},
		{
			name: "medium risk - moderate change, some history",
			risk: models.DeploymentRisk{
				ChangeSize:   models.ChangeSize{FilesChanged: 25, LinesChanged: 500},
				ChangeScope:  []string{"svc-a", "svc-b"},
				TimeRisk:     models.TimeRisk{IsAfterHours: true},
				HistoricalRisk: models.HistoricalRisk{RecentFailureRate: 0.08, RecentIncidents: 1, AverageMTTR: 30*60*1000},
			},
			wantLow: "medium",
		},
		{
			name: "high risk - large change, many dependencies",
			risk: models.DeploymentRisk{
				ChangeSize:   models.ChangeSize{FilesChanged: 80, LinesChanged: 3000},
				ChangeScope:  []string{"svc-a", "svc-b", "svc-c", "svc-d"},
				TimeRisk:     models.TimeRisk{IsFriday: true, IsAfterHours: true},
				DependencyRisk: models.DependencyRisk{TotalDependencies: 15, UnhealthyDependencies: 2, CriticalDependencies: []string{"db", "cache"}},
				HistoricalRisk: models.HistoricalRisk{RecentFailureRate: 0.20, RecentIncidents: 3, AverageMTTR: 120*60*1000},
			},
			wantLow: "high",
		},
		{
			name: "critical risk - massive change, holiday, high failure rate",
			risk: models.DeploymentRisk{
				ChangeSize:   models.ChangeSize{FilesChanged: 200, LinesChanged: 20000},
				ChangeScope:  []string{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"},
				TimeRisk:     models.TimeRisk{IsHoliday: true},
				DependencyRisk: models.DependencyRisk{TotalDependencies: 30, UnhealthyDependencies: 5, CriticalDependencies: []string{"db", "cache", "queue", "auth"}},
				HistoricalRisk: models.HistoricalRisk{RecentFailureRate: 0.50, RecentIncidents: 6, AverageMTTR: 300*60*1000},
			},
			wantLow: "critical",
		},
		{
			name: "time risk - weekend deployment",
			risk: models.DeploymentRisk{
				ChangeSize: models.ChangeSize{FilesChanged: 5, LinesChanged: 100},
				TimeRisk:   models.TimeRisk{IsWeekend: true},
				HistoricalRisk: models.HistoricalRisk{RecentFailureRate: 0.01},
			},
			wantLow: "low",
		},
		{
			name: "high MTTR increases risk",
			risk: models.DeploymentRisk{
				ChangeSize: models.ChangeSize{FilesChanged: 5, LinesChanged: 100},
				TimeRisk:   models.TimeRisk{},
				HistoricalRisk: models.HistoricalRisk{AverageMTTR: 250 * 60 * 1000}, // 250 minutes
			},
			wantLow: "low",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score, level, factors, recs := svc.ScoreDeploymentRisk(tt.risk)

			if score < 0 || score > 100 {
				t.Errorf("score out of range [0,100]: got %.2f", score)
			}

			if level != tt.wantLow {
				t.Errorf("want level=%q, got %q (score=%.2f)", tt.wantLow, level, score)
			}

			// Verify factors list is complete
			if len(factors) != 10 {
				t.Errorf("expected 10 factors, got %d", len(factors))
			}

			// Verify each factor has valid score and weight
			for _, f := range factors {
				if f.Weight <= 0 {
					t.Errorf("factor %q has zero/negative weight", f.Name)
				}
				if f.Score < 0 || f.Score > 100 {
					t.Errorf("factor %q score=%.2f out of range [0,100]", f.Name, f.Score)
				}
			}

			// Verify recommendations match level
			if level == "critical" && len(recs) == 0 {
				t.Error("critical level should produce recommendations")
			}

			if tt.validate != nil {
				tt.validate(t, score, level, factors, recs)
			}
		})
	}
}

// ---------------------------------------------------------------
// Score monotonicity: increasing risk should produce increasing score
// ---------------------------------------------------------------

func TestScoreMonotonicity(t *testing.T) {
	svc := NewService(nil)

	// More files changed should generally yield higher score
	base := models.DeploymentRisk{
		ChangeSize:   models.ChangeSize{FilesChanged: 5, LinesChanged: 100},
		HistoricalRisk: models.HistoricalRisk{RecentFailureRate: 0.05},
	}
	scoreLow, _, _, _ := svc.ScoreDeploymentRisk(base)

	baseChange := base
	baseChange.ChangeSize.FilesChanged = 100
	baseChange.ChangeSize.LinesChanged = 5000
	scoreHigh, _, _, _ := svc.ScoreDeploymentRisk(baseChange)

	if scoreHigh <= scoreLow {
		t.Errorf("increasing change size did not increase score: low=%.2f high=%.2f", scoreLow, scoreHigh)
	}

	// Higher failure rate should yield higher score
	baseFail := base
	baseFail.HistoricalRisk.RecentFailureRate = 0.40
	scoreFail, _, _, _ := svc.ScoreDeploymentRisk(baseFail)

	if scoreFail <= scoreLow {
		t.Errorf("increasing failure rate did not increase score: base=%.2f fail=%.2f", scoreLow, scoreFail)
	}
}

// ---------------------------------------------------------------
// Recommendations generated for high/critical levels
// ---------------------------------------------------------------

func TestRecommendationsGenerated(t *testing.T) {
	svc := NewService(nil)

	// Critical scenario
	crit := models.DeploymentRisk{
		ChangeSize:   models.ChangeSize{FilesChanged: 150, LinesChanged: 10000},
		ChangeScope:  []string{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"},
		TimeRisk:     models.TimeRisk{IsHoliday: true},
		DependencyRisk: models.DependencyRisk{TotalDependencies: 25, UnhealthyDependencies: 3, CriticalDependencies: []string{"db", "cache", "queue"}},
		HistoricalRisk: models.HistoricalRisk{RecentFailureRate: 0.40, RecentIncidents: 7, AverageMTTR: 200*60*1000},
	}
	_, level, _, recs := svc.ScoreDeploymentRisk(crit)

	if level != "critical" {
		t.Errorf("expected critical, got %s", level)
	}
	if len(recs) == 0 {
		t.Fatal("expected recommendations for critical level")
	}

	// Verify at least one block recommendation exists for critical
	hasBlock := false
	for _, r := range recs {
		if r.Type == "block" && r.Priority == "critical" {
			hasBlock = true
			break
		}
	}
	if !hasBlock {
		t.Error("critical level should have at least one block/critical recommendation")
	}

	// Verify each recommendation has required fields
	for i, r := range recs {
		if r.Title == "" {
			t.Errorf("recommendation[%d] missing title", i)
		}
		if r.Priority == "" {
			t.Errorf("recommendation[%d] missing priority", i)
		}
	}
}

// ---------------------------------------------------------------
// Individual factor evaluation
// ---------------------------------------------------------------

func TestFactorCategories(t *testing.T) {
	svc := NewService(nil)

	dr := models.DeploymentRisk{
		ChangeSize:   models.ChangeSize{FilesChanged: 10, LinesChanged: 200},
		ChangeScope:  []string{"svc-a", "svc-b"},
		TimeRisk:     models.TimeRisk{IsFriday: true},
		DependencyRisk: models.DependencyRisk{TotalDependencies: 5, UnhealthyDependencies: 0, CriticalDependencies: []string{"db"}},
		HistoricalRisk: models.HistoricalRisk{RecentFailureRate: 0.1, RecentIncidents: 1, AverageMTTR: 30*60*1000},
	}

	_, _, factors, _ := svc.ScoreDeploymentRisk(dr)

	// Check we have factors from all three categories
	categories := map[models.RiskFactorCategory]bool{}
	for _, f := range factors {
		categories[f.Category] = true
	}

	if !categories[models.FactorCategoryTechnical] {
		t.Error("missing technical category factor")
	}
	if !categories[models.FactorCategoryHistorical] {
		t.Error("missing historical category factor")
	}
	if !categories[models.FactorCategoryOrganizational] {
		t.Error("missing organizational category factor")
	}
}

// ---------------------------------------------------------------
// Helper
// ---------------------------------------------------------------

func floatEqual(a, b float64) bool {
	return math.Abs(a-b) < 1e-9
}
