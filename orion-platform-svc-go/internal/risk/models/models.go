package models

import "time"

// -----------------------------------------------
// CRUD models
// -----------------------------------------------

// Risk represents a risk record.
type Risk struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Value     string    `json:"value" db:"value"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateRiskRequest struct {
	Name    string `json:"name" binding:"required"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type UpdateRiskRequest struct {
	Name    *string `json:"name"`
	Value   *string `json:"value"`
	Enabled *bool   `json:"enabled"`
}

// -----------------------------------------------
// Risk scoring models
// -----------------------------------------------

// Severity represents the severity level of a risk (1-5).
type Severity int

const (
	SeverityVeryLow  Severity = 1
	SeverityLow      Severity = 2
	SeverityMedium   Severity = 3
	SeverityHigh     Severity = 4
	SeverityVeryHigh Severity = 5
)

// Probability represents the probability level of a risk (1-5).
type Probability int

const (
	ProbabilityVeryLow  Probability = 1
	ProbabilityLow      Probability = 2
	ProbabilityMedium   Probability = 3
	ProbabilityHigh     Probability = 4
	ProbabilityVeryHigh Probability = 5
)

// Impact represents the impact level of a risk (1-5).
type Impact int

const (
	ImpactVeryLow  Impact = 1
	ImpactLow      Impact = 2
	ImpactMedium   Impact = 3
	ImpactHigh     Impact = 4
	ImpactVeryHigh Impact = 5
)

// RiskScoreRequest is the input for calculating a risk score.
type RiskScoreRequest struct {
	Severity    Severity    `json:"severity" binding:"required"`
	Probability Probability `json:"probability" binding:"required"`
	Impact      Impact      `json:"impact" binding:"required"`
}

// RiskScore is the result of a risk score calculation.
type RiskScore struct {
	Score       float64     `json:"score"`
	Level       string      `json:"level"`
	Severity    Severity    `json:"severity"`
	Probability Probability `json:"probability"`
	Impact      Impact      `json:"impact"`
}

// RiskLevel represents a named risk level with color metadata.
type RiskLevel struct {
	Name  string  `json:"name"`
	Label string  `json:"label"`
	Color string  `json:"color"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
}

// RiskMatrixCell represents a single cell in the 5x5 risk matrix.
type RiskMatrixCell struct {
	Severity    Severity    `json:"severity"`
	Probability Probability `json:"probability"`
	Score       float64     `json:"score"`
	Level       string      `json:"level"`
	Color       string      `json:"color"`
}

// RiskMatrix is a 5x5 heatmap matrix (severity x probability).
type RiskMatrix struct {
	SeverityLevels    []string         `json:"severity_levels"`
	ProbabilityLevels []string         `json:"probability_levels"`
	Cells             []RiskMatrixCell `json:"cells"`
	Levels            []RiskLevel      `json:"levels"`
}

// HeatmapPoint represents a single data point on the heatmap.
type HeatmapPoint struct {
	RiskID      string      `json:"risk_id,omitempty"`
	RiskName    string      `json:"risk_name,omitempty"`
	Severity    Severity    `json:"severity"`
	Probability Probability `json:"probability"`
	Impact      Impact      `json:"impact"`
	Score       float64     `json:"score"`
	Level       string      `json:"level"`
	Color       string      `json:"color"`
	Count       int64       `json:"count"`
}

// HeatmapResponse wraps the heatmap data.
type HeatmapResponse struct {
	Points []HeatmapPoint `json:"points"`
	Matrix RiskMatrix     `json:"matrix"`
}
