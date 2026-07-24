package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ==================== Canary Deployment ====================

// CanaryStatus represents the lifecycle of a canary deployment.
type CanaryStatus string

const (
	CanaryPending    CanaryStatus = "pending"
	CanaryRunning    CanaryStatus = "running"
	CanarySuccess    CanaryStatus = "success"
	CanaryFailed     CanaryStatus = "failed"
	CanaryRolled     CanaryStatus = "rolled_back"
	CanaryPromoted   CanaryStatus = "promoted"
	CanaryDeploying  CanaryStatus = "deploying"
)

// Canary represents a canary deployment.
type Canary struct {
	ID           string       `db:"id" json:"id"`
	TenantID     string       `db:"tenant_id" json:"tenant_id"`
	DeploymentID string       `db:"deployment_id" json:"deployment_id"`
	ServiceName  string       `db:"service_name" json:"service_name"`
	Version      string       `db:"version" json:"version"`
	Status       CanaryStatus `db:"status" json:"status"`
	Weight       int          `db:"weight" json:"weight"`
	TargetWeight int          `db:"target_weight" json:"target_weight"`
	StartedAt    *time.Time   `db:"started_at" json:"started_at,omitempty"`
	CompletedAt  *time.Time   `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt    time.Time    `db:"created_at" json:"created_at"`
}

// CanaryMetric represents a metric collected during canary analysis.
type CanaryMetric struct {
	ID         string    `db:"id" json:"id"`
	CanaryID   string    `db:"canary_id" json:"canary_id"`
	MetricName string    `db:"metric_name" json:"metric_name"`
	Value      float64   `db:"value" json:"value"`
	Source     string    `db:"source" json:"source"`
	Timestamp  time.Time `db:"timestamp" json:"timestamp"`
}

// CanaryAnalysis represents the analysis result of a canary deployment.
type CanaryAnalysis struct {
	ID        string    `db:"id" json:"id"`
	CanaryID  string    `db:"canary_id" json:"canary_id"`
	Score     float64   `db:"score" json:"score"`
	Verdict   string    `db:"verdict" json:"verdict"`
	Details   string    `db:"details" json:"details"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// CreateCanaryRequest is the input for creating a canary deployment.
type CreateCanaryRequest struct {
	DeploymentID string `json:"deployment_id" binding:"required"`
	ServiceName  string `json:"service_name" binding:"required"`
	Version      string `json:"version" binding:"required"`
	Weight       int    `json:"weight"`
	TargetWeight int    `json:"target_weight"`
}

// PaginatedRequest provides pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// ==================== Canary Analysis Run (ML Analysis) ====================

// AnalysisStatus represents the status of an analysis run.
type AnalysisStatus string

const (
	AnalysisRunning       AnalysisStatus = "running"
	AnalysisPromote       AnalysisStatus = "promote"
	AnalysisRollback      AnalysisStatus = "rollback"
	AnalysisInconclusive  AnalysisStatus = "inconclusive"
)

// AnalysisDecision represents the decision outcome.
type AnalysisDecision string

const (
	DecisionPromote      AnalysisDecision = "promote"
	DecisionRollback     AnalysisDecision = "rollback"
	DecisionContinue     AnalysisDecision = "continue"
	DecisionPending      AnalysisDecision = "pending"
	DecisionInconclusive AnalysisDecision = "inconclusive"
)

// TrafficSplit represents traffic distribution between canary and baseline.
type TrafficSplit struct {
	Canary   int `json:"canary"`
	Baseline int `json:"baseline"`
}

// Value implements the driver.Valuer interface for JSONB storage.
func (t TrafficSplit) Value() (driver.Value, error) {
	return json.Marshal(t)
}

// Scan implements the sql.Scanner interface for JSONB retrieval.
func (t *TrafficSplit) Scan(src interface{}) error {
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, t)
	case string:
		return json.Unmarshal([]byte(v), t)
	default:
		return fmt.Errorf("cannot scan %T into TrafficSplit", src)
	}
}

// CanaryAnalysisRun represents an ML canary analysis run.
type CanaryAnalysisRun struct {
	ID           string          `db:"id" json:"id"`
	DeploymentID string          `db:"deployment_id" json:"deployment_id"`
	RunNumber    int             `db:"run_number" json:"run_number"`
	TrafficSplit TrafficSplit    `db:"traffic_split" json:"traffic_split"`
	Status       AnalysisStatus  `db:"status" json:"status"`
	Confidence   *float64        `db:"confidence" json:"confidence,omitempty"`
	Decision     *AnalysisDecision `db:"decision" json:"decision,omitempty"`
	StartedAt    time.Time       `db:"started_at" json:"started_at"`
	CompletedAt  *time.Time      `db:"completed_at" json:"completed_at,omitempty"`
	DurationMs   *float64        `db:"duration_ms" json:"duration_ms,omitempty"`
}

// CanaryAnalysisRunCreateInput is the input for creating an analysis run.
type CanaryAnalysisRunCreateInput struct {
	DeploymentID string       `json:"deployment_id" binding:"required"`
	RunNumber    int          `json:"run_number"`
	TrafficSplit TrafficSplit `json:"traffic_split"`
}

// ==================== Metric Verdict & Category ====================

// MetricVerdict represents the verdict of a single metric analysis.
type MetricVerdict string

const (
	VerdictPass MetricVerdict = "pass"
	VerdictWarn MetricVerdict = "warn"
	VerdictFail MetricVerdict = "fail"
)

// MetricCategory represents the category of a metric.
type MetricCategory string

const (
	CategoryLatency    MetricCategory = "latency"
	CategoryErrorRate  MetricCategory = "error_rate"
	CategoryThroughput MetricCategory = "throughput"
	CategorySaturation MetricCategory = "saturation"
)

// ==================== Canary Metric Result ====================

// CanaryMetricResult represents the statistical analysis result for a single metric.
type CanaryMetricResult struct {
	ID            string         `db:"id" json:"id"`
	RunID         string         `db:"run_id" json:"run_id"`
	MetricName    string         `db:"metric_name" json:"metric_name"`
	BaselineValue *float64       `db:"baseline_value" json:"baseline_value,omitempty"`
	CanaryValue   *float64       `db:"canary_value" json:"canary_value,omitempty"`
	MannWhitneyP  *float64       `db:"mann_whitney_p" json:"mann_whitney_p,omitempty"`
	KsStatistic   *float64       `db:"ks_statistic" json:"ks_statistic,omitempty"`
	CliffDelta    *float64       `db:"cliff_delta" json:"cliff_delta,omitempty"`
	Verdict       *MetricVerdict `db:"verdict" json:"verdict,omitempty"`
	Category      *MetricCategory `db:"category" json:"category,omitempty"`
}

// CanaryMetricResultCreateInput is the input for creating a metric result.
type CanaryMetricResultCreateInput struct {
	RunID         string         `json:"run_id" binding:"required"`
	MetricName    string         `json:"metric_name" binding:"required"`
	BaselineValue *float64       `json:"baseline_value,omitempty"`
	CanaryValue   *float64       `json:"canary_value,omitempty"`
	MannWhitneyP  *float64       `json:"mann_whitney_p,omitempty"`
	KsStatistic   *float64       `json:"ks_statistic,omitempty"`
	CliffDelta    *float64       `json:"cliff_delta,omitempty"`
	Verdict       *MetricVerdict `json:"verdict,omitempty"`
	Category      *MetricCategory `json:"category,omitempty"`
}

// ==================== Canary ML Result ====================

// JSONMap is a map type that supports JSONB storage in PostgreSQL.
type JSONMap map[string]interface{}

// Value implements the driver.Valuer interface for JSONB storage.
func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface for JSONB retrieval.
func (j *JSONMap) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONMap", src)
	}
}

// CanaryMLResult represents an ML model prediction result.
type CanaryMLResult struct {
	ID              string   `db:"id" json:"id"`
	RunID           string   `db:"run_id" json:"run_id"`
	ModelName       string   `db:"model_name" json:"model_name"`
	Prediction      *string  `db:"prediction" json:"prediction,omitempty"`
	Confidence      *float64 `db:"confidence" json:"confidence,omitempty"`
	ShapExplanation *JSONMap `db:"shap_explanation" json:"shap_explanation,omitempty"`
	ClusterID       *int     `db:"cluster_id" json:"cluster_id,omitempty"`
}

// CanaryMLResultCreateInput is the input for creating an ML result.
type CanaryMLResultCreateInput struct {
	RunID           string   `json:"run_id" binding:"required"`
	ModelName       string   `json:"model_name" binding:"required"`
	Prediction      *string  `json:"prediction,omitempty"`
	Confidence      *float64 `json:"confidence,omitempty"`
	ShapExplanation *JSONMap `json:"shap_explanation,omitempty"`
	ClusterID       *int     `json:"cluster_id,omitempty"`
}

// ==================== Canary Analysis Config ====================

// StringArray is a string slice that supports PostgreSQL text[] storage.
type StringArray []string

// Value implements the driver.Valuer interface for text[] storage.
func (s StringArray) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

// Scan implements the sql.Scanner interface for text[] retrieval.
func (s *StringArray) Scan(src interface{}) error {
	if src == nil {
		*s = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, s)
	case string:
		return json.Unmarshal([]byte(v), s)
	default:
		return fmt.Errorf("cannot scan %T into StringArray", src)
	}
}

// CanaryAnalysisConfig represents a canary analysis configuration.
type CanaryAnalysisConfig struct {
	ID                  string             `db:"id" json:"id"`
	ServiceName         string             `db:"service_name" json:"service_name"`
	Environment         string             `db:"environment" json:"environment"`
	AnalysisIntervalSec int                `db:"analysis_interval_sec" json:"analysis_interval_sec"`
	MaxRounds           int                `db:"max_rounds" json:"max_rounds"`
	WarmupPeriodSec     int                `db:"warmup_period_sec" json:"warmup_period_sec"`
	PromoteThreshold    float64            `db:"promote_threshold" json:"promote_threshold"`
	RollbackThreshold   float64            `db:"rollback_threshold" json:"rollback_threshold"`
	TrafficStep         int                `db:"traffic_step" json:"traffic_step"`
	MetricWeights       *JSONMap           `db:"metric_weights" json:"metric_weights,omitempty"`
	ExcludedMetrics     StringArray        `db:"excluded_metrics" json:"excluded_metrics"`
	SloMetrics          StringArray        `db:"slo_metrics" json:"slo_metrics"`
	CreatedAt           time.Time          `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time          `db:"updated_at" json:"updated_at"`
}

// CanaryAnalysisConfigCreateInput is the input for creating a config.
type CanaryAnalysisConfigCreateInput struct {
	ServiceName         string   `json:"service_name" binding:"required"`
	Environment         string   `json:"environment" binding:"required"`
	AnalysisIntervalSec *int     `json:"analysis_interval_sec,omitempty"`
	MaxRounds           *int     `json:"max_rounds,omitempty"`
	WarmupPeriodSec     *int     `json:"warmup_period_sec,omitempty"`
	PromoteThreshold    *float64 `json:"promote_threshold,omitempty"`
	RollbackThreshold   *float64 `json:"rollback_threshold,omitempty"`
	TrafficStep         *int     `json:"traffic_step,omitempty"`
	MetricWeights       *JSONMap `json:"metric_weights,omitempty"`
	ExcludedMetrics     []string `json:"excluded_metrics,omitempty"`
	SloMetrics          []string `json:"slo_metrics,omitempty"`
}

// CanaryAnalysisConfigUpdateInput is the input for updating a config.
type CanaryAnalysisConfigUpdateInput struct {
	AnalysisIntervalSec *int     `json:"analysis_interval_sec,omitempty"`
	MaxRounds           *int     `json:"max_rounds,omitempty"`
	WarmupPeriodSec     *int     `json:"warmup_period_sec,omitempty"`
	PromoteThreshold    *float64 `json:"promote_threshold,omitempty"`
	RollbackThreshold   *float64 `json:"rollback_threshold,omitempty"`
	TrafficStep         *int     `json:"traffic_step,omitempty"`
	MetricWeights       *JSONMap `json:"metric_weights,omitempty"`
	ExcludedMetrics     []string `json:"excluded_metrics,omitempty"`
	SloMetrics          []string `json:"slo_metrics,omitempty"`
}

// ==================== Canary Decision ====================

// CanaryDecisionRecord represents a decision audit trail entry.
type CanaryDecisionRecord struct {
	ID             string           `db:"id" json:"id"`
	RunID          string           `db:"run_id" json:"run_id"`
	Decision       AnalysisDecision `db:"decision" json:"decision"`
	Reason         *string          `db:"reason" json:"reason,omitempty"`
	OverriddenBy   *string          `db:"overridden_by" json:"overridden_by,omitempty"`
	OverrideReason *string          `db:"override_reason" json:"override_reason,omitempty"`
	DecidedAt      time.Time        `db:"decided_at" json:"decided_at"`
}

// CanaryDecisionCreateInput is the input for creating a decision record.
type CanaryDecisionCreateInput struct {
	RunID          string           `json:"run_id" binding:"required"`
	Decision       AnalysisDecision `json:"decision" binding:"required"`
	Reason         *string          `json:"reason,omitempty"`
	OverriddenBy   *string          `json:"overridden_by,omitempty"`
	OverrideReason *string          `json:"override_reason,omitempty"`
}

// ==================== Canary Retrain Job ====================

// CanaryRetrainJob represents an ML model retraining job.
type CanaryRetrainJob struct {
	ID           string     `db:"id" json:"id"`
	ModelName    string     `db:"model_name" json:"model_name"`
	Status       string     `db:"status" json:"status"`
	SubmittedAt  time.Time  `db:"submitted_at" json:"submitted_at"`
	CompletedAt  *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	ErrorMessage *string    `db:"error_message" json:"error_message,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
}

// CanaryRetrainJobCreateInput is the input for creating a retrain job.
type CanaryRetrainJobCreateInput struct {
	ModelName string `json:"model_name" binding:"required"`
}

// ==================== Traffic Config ====================

// TrafficConfig represents a traffic split configuration.
type TrafficConfig struct {
	ID                  string     `db:"id" json:"id"`
	CanaryID            string     `db:"canary_id" json:"canary_id"`
	Strategy            string     `db:"strategy" json:"strategy"`
	Host                *string    `db:"host" json:"host,omitempty"`
	Namespace           *string    `db:"namespace" json:"namespace,omitempty"`
	UpstreamName        *string    `db:"upstream_name" json:"upstream_name,omitempty"`
	Phase               *string    `db:"phase" json:"phase,omitempty"`
	BaselineWeight      *int       `db:"baseline_weight" json:"baseline_weight,omitempty"`
	CanaryWeight        *int       `db:"canary_weight" json:"canary_weight,omitempty"`
	BaselineDestination *string    `db:"baseline_destination" json:"baseline_destination,omitempty"`
	BaselineSubset      *string    `db:"baseline_subset" json:"baseline_subset,omitempty"`
	CanaryDestination   *string    `db:"canary_destination" json:"canary_destination,omitempty"`
	CanarySubset        *string    `db:"canary_subset" json:"canary_subset,omitempty"`
	Servers             *JSONMap   `db:"servers" json:"servers,omitempty"`
	CreatedAt           time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time  `db:"updated_at" json:"updated_at"`
}

// TrafficConfigUpsertInput is the input for upserting a traffic config.
type TrafficConfigUpsertInput struct {
	ID                  string   `json:"id" binding:"required"`
	CanaryID            string   `json:"canary_id" binding:"required"`
	Strategy            string   `json:"strategy"`
	Phase               *string  `json:"phase,omitempty"`
	Host                *string  `json:"host,omitempty"`
	Namespace           *string  `json:"namespace,omitempty"`
	UpstreamName        *string  `json:"upstream_name,omitempty"`
	BaselineWeight      *int     `json:"baseline_weight,omitempty"`
	CanaryWeight        *int     `json:"canary_weight,omitempty"`
	BaselineDestination *string  `json:"baseline_destination,omitempty"`
	BaselineSubset      *string  `json:"baseline_subset,omitempty"`
	CanaryDestination   *string  `json:"canary_destination,omitempty"`
	CanarySubset        *string  `json:"canary_subset,omitempty"`
	Servers             *JSONMap `json:"servers,omitempty"`
}

// TrafficConfigUpdateInput is the input for updating a traffic config.
type TrafficConfigUpdateInput struct {
	Strategy            *string `json:"strategy,omitempty"`
	BaselineWeight      *int    `json:"baseline_weight,omitempty"`
	CanaryWeight        *int    `json:"canary_weight,omitempty"`
	BaselineDestination *string `json:"baseline_destination,omitempty"`
	CanaryDestination   *string `json:"canary_destination,omitempty"`
	Host                *string `json:"host,omitempty"`
	Namespace           *string `json:"namespace,omitempty"`
}

// ==================== Traffic History ====================

// TrafficHistory represents an execution history entry for traffic changes.
type TrafficHistory struct {
	ID         string    `db:"id" json:"id"`
	CanaryID   string    `db:"canary_id" json:"canary_id"`
	Success    bool      `db:"success" json:"success"`
	Result     string    `db:"result" json:"result"`
	Error      *string   `db:"error" json:"error,omitempty"`
	ExecutedAt time.Time `db:"executed_at" json:"executed_at"`
}

// TrafficHistoryCreateInput is the input for creating a history entry.
type TrafficHistoryCreateInput struct {
	ID       string `json:"id" binding:"required"`
	CanaryID string `json:"canary_id" binding:"required"`
	Success  bool   `json:"success"`
	Result   string `json:"result" binding:"required"`
	Error    *string `json:"error,omitempty"`
}

// ==================== Prometheus ====================

// PrometheusQueryResult represents a single Prometheus query result.
type PrometheusQueryResult struct {
	Metric map[string]string `json:"metric"`
	Values [][]interface{}   `json:"values"`
}

// PrometheusRangeQueryResponse represents a Prometheus range query API response.
type PrometheusRangeQueryResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string                 `json:"resultType"`
		Result     []PrometheusQueryResult `json:"result"`
	} `json:"data"`
}
