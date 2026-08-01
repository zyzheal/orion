package models

import "database/sql"

// --- Enums ---

type DecisionType string

const (
	DecisionTypePipelineSelection DecisionType = "pipeline_selection"
	DecisionTypeResourceAllocation DecisionType = "resource_allocation"
	DecisionTypeScheduling         DecisionType = "scheduling"
	DecisionTypeScaling            DecisionType = "scaling"
	DecisionTypeOptimization       DecisionType = "optimization"
	DecisionTypeAnomalyDetection   DecisionType = "anomaly_detection"
	DecisionTypeRiskAssessment     DecisionType = "risk_assessment"
	DecisionTypeCostPrediction     DecisionType = "cost_prediction"
	DecisionTypeQualityGate        DecisionType = "quality_gate"
	DecisionTypeCustom             DecisionType = "custom"
)

type DecisionStatus string

const (
	DecisionStatusPending   DecisionStatus = "pending"
	DecisionStatusExecuted  DecisionStatus = "executed"
	DecisionStatusAccepted  DecisionStatus = "accepted"
	DecisionStatusRejected  DecisionStatus = "rejected"
	DecisionStatusOverridden DecisionStatus = "overridden"
	DecisionStatusFailed    DecisionStatus = "failed"
)

type FeedbackType string

const (
	FeedbackTypePositive FeedbackType = "positive"
	FeedbackTypeNegative FeedbackType = "negative"
	FeedbackTypeNeutral  FeedbackType = "neutral"
)

// --- Core entity: AIDecision ---

// AIDecision is a recorded AI decision with reasoning and context.
type AIDecision struct {
	ID          string           `db:"id" json:"id"`
	TenantID    string           `db:"tenant_id" json:"tenantId"`
	Type        DecisionType     `db:"type" json:"type"`
	Status      DecisionStatus   `db:"status" json:"status"`
	Input       string           `db:"input" json:"input"`        // JSONB
	Output      string           `db:"output" json:"output"`      // JSONB
	Confidence  float64          `db:"confidence" json:"confidence"`
	ModelID     sql.NullString   `db:"model_id" json:"modelId"`
	ModelVersion sql.NullString  `db:"model_version" json:"modelVersion"`
	Reasoning   string           `db:"reasoning" json:"reasoning"` // JSONB
	Context     string           `db:"context" json:"context"`     // JSONB
	Impact      sql.NullString   `db:"impact" json:"impact"`       // JSONB
	CreatedBy   string           `db:"created_by" json:"createdBy"`
	CreatedAt   int64            `db:"created_at" json:"createdAt"`  // unix seconds
	ExecutedAt  sql.NullInt64    `db:"executed_at" json:"executedAt"` // unix seconds
	ExpiresAt   sql.NullInt64    `db:"expires_at" json:"expiresAt"`  // unix seconds
}

// --- Reasoning (JSONB blob) ---

type DecisionReasoning struct {
	Summary      string                `json:"summary"`
	Factors      []DecisionFactor      `json:"factors"`
	Alternatives []DecisionAlternative `json:"alternatives"`
	Constraints  []string              `json:"constraints"`
	Assumptions  []string              `json:"assumptions"`
}

type DecisionFactor struct {
	Name        string      `json:"name"`
	Value       interface{} `json:"value"`
	Weight      float64     `json:"weight"`
	Description string      `json:"description"`
	Category    string      `json:"category"`
}

type DecisionAlternative struct {
	Option string  `json:"option"`
	Score  float64 `json:"score"`
	Reason string  `json:"reason"`
}

// --- Impact (JSONB blob) ---

type DecisionImpact struct {
	CostSavings        *float64 `json:"costSavings"`
	TimeSavings        *float64 `json:"timeSavings"`
	RiskReduction      *float64 `json:"riskReduction"`
	QualityImprovement *float64 `json:"qualityImprovement"`
	ResourceUtilization *float64 `json:"resourceUtilization"`
}

// --- Feedback ---

// DecisionFeedback is user feedback on a decision.
type DecisionFeedback struct {
	ID           string           `db:"id" json:"id"`
	TenantID     string           `db:"tenant_id" json:"tenantId"`
	DecisionID   string           `db:"decision_id" json:"decisionId"`
	Type         FeedbackType     `db:"type" json:"type"`
	Comment      sql.NullString   `db:"comment" json:"comment"`
	Outcome      sql.NullString   `db:"outcome" json:"outcome"`
	ActualImpact sql.NullString   `db:"actual_impact" json:"actualImpact"` // JSONB
	CreatedBy    string           `db:"created_by" json:"createdBy"`
	CreatedAt    int64            `db:"created_at" json:"createdAt"` // unix seconds
}

// --- Trace ---

// DecisionTrace is a step in the decision execution trace.
type DecisionTrace struct {
	ID         string `db:"id" json:"id"`
	TenantID   string `db:"tenant_id" json:"tenantId"`
	DecisionID string `db:"decision_id" json:"decisionId"`
	Step       int    `db:"step" json:"step"`
	Action     string `db:"action" json:"action"`
	Description string `db:"description" json:"description"`
	Input      string `db:"input" json:"input"`       // JSONB
	Output     string `db:"output" json:"output"`     // JSONB
	Duration   int    `db:"duration" json:"duration"`  // ms
	Timestamp  int64  `db:"timestamp" json:"timestamp"` // unix seconds
}

// --- Request / Response types ---

// RecordDecisionRequest is the body for creating a new decision.
type RecordDecisionRequest struct {
	Type         DecisionType      `json:"type" binding:"required"`
	Input        map[string]interface{} `json:"input" binding:"required"`
	Output       map[string]interface{} `json:"output" binding:"required"`
	Confidence   float64           `json:"confidence" binding:"required"`
	ModelID      *string           `json:"modelId"`
	ModelVersion *string           `json:"modelVersion"`
	Reasoning    DecisionReasoning `json:"reasoning" binding:"required"`
	Context      map[string]interface{} `json:"context"`
	ExpiresAt    *int64            `json:"expiresAt"`
}

// SubmitFeedbackRequest is the body for submitting decision feedback.
type SubmitFeedbackRequest struct {
	Type         FeedbackType   `json:"type" binding:"required"`
	Comment      *string        `json:"comment"`
	Outcome      *string        `json:"outcome"`
	ActualImpact *DecisionImpact `json:"actualImpact"`
}

// AnalyzeDecisionsRequest is the body for batch decision analysis.
type AnalyzeDecisionsRequest struct {
	DecisionIds []string                 `json:"decisionIds"`
	Types       []DecisionType           `json:"types"`
	DateRange   *DateRange               `json:"dateRange"`
	AnalysisType string                  `json:"analysisType" binding:"required"` // pattern | trend | anomaly | correlation
}

// DateRange represents a start/end time window.
type DateRange struct {
	Start int64 `json:"start"` // unix seconds
	End   int64 `json:"end"`   // unix seconds
}

// AnalyzeDecisionsResult is the batch analysis response.
type AnalyzeDecisionsResult struct {
	AnalysisType    string              `json:"analysisType"`
	Insights        []AnalysisInsight   `json:"insights"`
	Recommendations []string            `json:"recommendations"`
}

// AnalysisInsight is a single insight from batch analysis.
type AnalysisInsight struct {
	Type         string                 `json:"type"`
	Title        string                 `json:"title"`
	Description  string                 `json:"description"`
	Significance float64                `json:"significance"`
	Data         map[string]interface{} `json:"data"`
}

// DecisionStats aggregates decision statistics.
type DecisionStats struct {
	Total                 int64                        `json:"total"`
	ByStatus              map[DecisionStatus]int64     `json:"byStatus"`
	ByType                map[DecisionType]int64       `json:"byType"`
	AvgConfidence         float64                      `json:"avgConfidence"`
	AcceptanceRate        float64                      `json:"acceptanceRate"`
	PositiveFeedbackRate  float64                      `json:"positiveFeedbackRate"`
	AvgImpact             AvgImpact                    `json:"avgImpact"`
}

// AvgImpact is average impact metrics.
type AvgImpact struct {
	CostSavings   float64 `json:"costSavings"`
	TimeSavings   float64 `json:"timeSavings"`
	RiskReduction float64 `json:"riskReduction"`
}

// ListQuery mirrors the query parameters used by the handler.
type ListQuery struct {
	Type      string
	Status    string
	ModelID   string
	StartDate *int64
	EndDate   *int64
	Sort      string
	Order     string
	Limit     *int
	Offset    *int
}

// PaginatedResponse is a generic paginated response envelope.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int64       `json:"total"`
	Offset   int         `json:"offset"`
	Limit    int         `json:"limit"`
}
