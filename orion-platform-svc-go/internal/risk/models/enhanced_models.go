package models

// RiskFactor represents a weighted factor contributing to an overall risk score.
// Weight is the factor's importance (0.0-1.0) and Value is its normalized score (0.0-100.0).
type RiskFactor struct {
	Name   string  `json:"name"`
	Weight float64 `json:"weight"`
	Value  float64 `json:"value"`
}

// MitigationPlan describes a proposed remediation for a risk.
type MitigationPlan struct {
	Action      string `json:"action"`
	Description string `json:"description"`
	Owner       string `json:"owner"`
	TargetDate  string `json:"target_date"`
	Effectiveness float64 `json:"effectiveness"` // 0.0-1.0
}

// RiskTrend captures the score delta for a risk over a time period.
type RiskTrend struct {
	RiskID        string  `json:"risk_id"`
	RiskName      string  `json:"risk_name"`
	AvgScore      float64 `json:"avg_score"`
	MinScore      float64 `json:"min_score"`
	MaxScore      float64 `json:"max_score"`
	ScoreDelta    float64 `json:"score_delta"`
	SampleCount   int     `json:"sample_count"`
	TrendDirection string `json:"trend_direction"` // up|down|stable
}

// CorrelatedRiskPair represents two risks that share overlapping tags.
type CorrelatedRiskPair struct {
	RiskA       *Risk `json:"risk_a"`
	RiskB       *Risk `json:"risk_b"`
	SharedTags  []string `json:"shared_tags"`
	OverlapScore float64 `json:"overlap_score"` // size(shared) / size(union)
}

// WeightedScoreRequest holds a list of risk factors for weighted scoring.
type WeightedScoreRequest struct {
	Factors []RiskFactor `json:"factors"`
}

// WeightedScoreResult is the output of a weighted risk score calculation.
type WeightedScoreResult struct {
	Score       float64       `json:"score"`
	Level       string        `json:"level"`
	FactorBreakdown []FactorBreakdown `json:"factor_breakdown"`
	Mitigation  *MitigationPlan `json:"mitigation,omitempty"`
}

// FactorBreakdown shows each factor's contribution to the total score.
type FactorBreakdown struct {
	Name        string  `json:"name"`
	Weight      float64 `json:"weight"`
	Value       float64 `json:"value"`
	Contribution float64 `json:"contribution"`
}
