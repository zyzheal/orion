package models

import "time"

// RecommendationType defines the types of AI-powered CMDB recommendations.
type RecommendationType string

const (
	RecTypeAutoLink      RecommendationType = "auto-link"
	RecTypeAttributeFill RecommendationType = "attribute-fill"
	RecTypeAnomalyDetect RecommendationType = "anomaly-detect"
	RecTypeTopologyFix   RecommendationType = "topology-fix"
)

// RecommendationStatus defines the disposition of a recommendation.
type RecommendationStatus string

const (
	RecStatusPending  RecommendationStatus = "pending"
	RecStatusAccepted RecommendationStatus = "accepted"
	RecStatusRejected RecommendationStatus = "rejected"
)

// Recommendation represents a single AI-generated CMDB recommendation.
type Recommendation struct {
	ID           string               `json:"id"`
	Type         RecommendationType   `json:"type"`
	SourceCIID   string               `json:"sourceCi"`
	SourceCIName string               `json:"sourceCiName"`
	TargetCIID   string               `json:"targetCi"`
	TargetCIName string               `json:"targetCiName"`
	Confidence   float64              `json:"confidence"`
	Status       RecommendationStatus `json:"status"`
	RecommendAt  time.Time            `json:"recommendTime"`
	Suggestion   string               `json:"suggestion"`
	Reason       string               `json:"reason"`
}

// AnomalyDetected represents a detected CMDB data quality anomaly.
type AnomalyDetected struct {
	ID          string    `json:"id"`
	CIID        string    `json:"ciId"`
	CIName      string    `json:"ciName"`
	AnomalyType string    `json:"anomalyType"`
	Severity    string    `json:"severity"`
	DetectedAt  time.Time `json:"detectedTime"`
	Detail      string    `json:"detail"`
}

// RecommendationResult is the response for AI recommendation queries.
type RecommendationResult struct {
	Recommendations []Recommendation  `json:"recommendations"`
	Anomalies       []AnomalyDetected `json:"anomalies"`
	Total           int               `json:"total"`
}
