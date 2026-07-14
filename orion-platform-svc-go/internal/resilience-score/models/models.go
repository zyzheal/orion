package models

// ----- Enums -----

const (
	ResilienceLevelExcellent = "excellent"
	ResilienceLevelGood      = "good"
	ResilienceLevelFair      = "fair"
	ResilienceLevelPoor      = "poor"
	ResilienceLevelCritical  = "critical"
)

var ValidResilienceLevels = []string{
	ResilienceLevelExcellent,
	ResilienceLevelGood,
	ResilienceLevelFair,
	ResilienceLevelPoor,
	ResilienceLevelCritical,
}

const (
	ComponentRedundancy  = "redundancy"
	ComponentFailover    = "failover"
	ComponentRecovery    = "recovery"
	ComponentMonitoring  = "monitoring"
	ComponentTesting     = "testing"
	ComponentSecurity    = "security"
	ComponentScalability = "scalability"
	ComponentDependency  = "dependency"
)

var AllComponents = []string{
	ComponentRedundancy,
	ComponentFailover,
	ComponentRecovery,
	ComponentMonitoring,
	ComponentTesting,
	ComponentSecurity,
	ComponentScalability,
	ComponentDependency,
}

const (
	StatusHealthy  = "healthy"
	StatusWarning  = "warning"
	StatusCritical = "critical"
)

const (
	TriggerScheduled = "scheduled"
	TriggerManual    = "manual"
	TriggerIncident  = "incident"
	TriggerChange    = "change"
)

// ----- ListQuery (pagination) -----

type ListQuery struct {
	Page  int `form:"page" binding:"min=1"`
	Size  int `form:"size" binding:"min=1,max=100"`
	Sort  string `form:"sort"`
	Order string `form:"order"`
}

func (q *ListQuery) Offset() int {
	if q.Page <= 0 {
		q.Page = 1
	}
	return (q.Page - 1) * q.Limit()
}

func (q *ListQuery) Limit() int {
	if q.Size <= 0 {
		return 20
	}
	if q.Size > 100 {
		return 100
	}
	return q.Size
}

func (q *ListQuery) SetDefaults() {
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Size <= 0 {
		q.Size = 20
	}
	if q.Sort == "" {
		q.Sort = "overallScore"
	}
	if q.Order == "" {
		q.Order = "desc"
	}
}

// ----- Pagination response -----

type PaginatedResponse struct {
	Data  any `json:"data"`
	Total int `json:"total"`
	Page  int `json:"page"`
	Size  int `json:"size"`
}

// ----- Domain models -----

// ComponentMetricDetail holds one metric inside a component score.
type ComponentMetricDetail struct {
	Metric string  `json:"metric"`
	Value  float64 `json:"value"`
	Weight float64 `json:"weight"`
}

// ComponentScoreResponse is a resilience component score.
type ComponentScoreResponse struct {
	Component string                    `json:"component"`
	Score     int                       `json:"score"`
	Level     string                    `json:"level"`
	Details   []ComponentMetricDetail   `json:"details"`
	Status    string                    `json:"status"`
}

// GlobalScoreTrends holds the trend data.
type GlobalScoreTrends struct {
	Direction string  `json:"direction"` // up, down, stable
	Change    float64 `json:"change"`
	Period    string  `json:"period"`
}

// GlobalResilienceScore is the overall system resilience score.
type GlobalResilienceScore struct {
	OverallScore        int                       `json:"overallScore"`
	Level               string                    `json:"level"`
	Components          []ComponentScoreResponse  `json:"components"`
	Trends              GlobalScoreTrends         `json:"trends"`
	LastAssessment      string                    `json:"lastAssessment"`
	NextAssessment      string                    `json:"nextAssessment"`
	RiskFactors         []string                  `json:"riskFactors"`
	TopRecommendations  []string                  `json:"topRecommendations"`
}

// ServiceDependency describes one dependency of a service.
type ServiceDependency struct {
	Name        string `json:"name"`
	Criticality string `json:"criticality"` // high, medium, low
	Health      string `json:"health"`      // healthy, degraded, unhealthy
}

// IncidentInfo holds incident summary for a service.
type IncidentInfo struct {
	Count        int     `json:"count"`
	LastIncident string  `json:"lastIncident,omitempty"`
	Mttr         float64 `json:"mttr,omitempty"`
	Mtbf         float64 `json:"mtbf,omitempty"`
}

// ServiceResilienceScore holds per-service resilience data.
type ServiceResilienceScore struct {
	ServiceName   string                   `json:"serviceName"`
	OverallScore  int                      `json:"overallScore"`
	Level         string                   `json:"level"`
	Components    []ComponentScoreResponse `json:"components"`
	Dependencies  []ServiceDependency      `json:"dependencies"`
	Incidents     IncidentInfo             `json:"incidents"`
	LastAssessment string                  `json:"lastAssessment"`
}

// ----- DB-persistent models -----

// ResilienceHistory is stored in resilience_score_history table.
type ResilienceHistory struct {
	ID              string `json:"id" db:"id"`
	TenantID        string `json:"tenant_id" db:"tenant_id"`
	Timestamp       int64  `json:"timestamp" db:"timestamp"`
	OverallScore    int    `json:"overallScore" db:"overall_score"`
	Level           string `json:"level" db:"level"`
	ComponentScores string `json:"componentScores" db:"component_scores"` // JSONB
	Trigger         string `json:"trigger" db:"trigger"`
	Details         string `json:"details,omitempty" db:"details"`       // JSONB
}

// ResilienceRecommendation is stored in resilience_recommendations table.
type ResilienceRecommendation struct {
	ID                    string   `json:"id" db:"id"`
	TenantID              string   `json:"tenant_id" db:"tenant_id"`
	Component             string   `json:"component" db:"component"`
	Priority              string   `json:"priority" db:"priority"`  // high, medium, low
	Title                 string   `json:"title" db:"title"`
	Description           string   `json:"description" db:"description"`
	CurrentScore          int      `json:"currentScore" db:"current_score"`
	PotentialImprovement  int      `json:"potentialImprovement" db:"potential_improvement"`
	Effort                string   `json:"effort" db:"effort"`       // low, medium, high
	Impact                string   `json:"impact" db:"impact"`       // low, medium, high
	Actions               string   `json:"actions" db:"actions"`     // JSONB (string[])
	References            string   `json:"references" db:"references"` // JSONB (string[])
}

// BenchmarkComparison is one component comparison in a benchmark.
type BenchmarkComparison struct {
	Component string `json:"component"`
	Current   int    `json:"current"`
	Benchmark int    `json:"benchmark"`
	Gap       int    `json:"gap"`
}

// ResilienceBenchmark is stored in resilience_benchmarks table.
type ResilienceBenchmark struct {
	ID             string                 `json:"id" db:"id"`
	TenantID       string                 `json:"tenant_id" db:"tenant_id"`
	Name           string                 `json:"name" db:"name"`
	Timestamp      int64                  `json:"timestamp" db:"timestamp"`
	CurrentScore   int                    `json:"currentScore" db:"current_score"`
	BenchmarkScore int                    `json:"benchmarkScore" db:"benchmark_score"`
	Comparison     string                 `json:"comparison" db:"comparison"` // JSONB
	Analysis       string                 `json:"analysis" db:"analysis"`
}

// ----- Request DTOs -----

// AssessResilienceRequest is the body for POST /resilience-score/assess.
type AssessResilienceRequest struct {
	Scope         string   `json:"scope" binding:"required"`       // global, service, component
	ServiceName   string   `json:"serviceName,omitempty"`
	Components    []string `json:"components"`
	DeepAnalysis  bool     `json:"deepAnalysis"`
}

// CreateBenchmarkRequest is the body for POST /resilience-score/benchmarks.
type CreateBenchmarkRequest struct {
	Name         string            `json:"name" binding:"required"`
	BaselineType string            `json:"baselineType" binding:"required"` // industry, internal, custom
	CustomScores map[string]int    `json:"customScores"`
}

// ComponentScoreBreakdown is one element of GET /components response.
type ComponentScoreBreakdown struct {
	Component string              `json:"component"`
	Global    int                 `json:"global"`
	Breakdown []ServiceBreakdownItem `json:"breakdown"`
}

// ServiceBreakdownItem is a service's score for a given component.
type ServiceBreakdownItem struct {
	Service string `json:"service"`
	Score   int    `json:"score"`
}

// ----- Helper types for in-memory assessment state -----

// AssessmentMetric holds a single simulated metric.
type AssessmentMetric struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
	Weight float64 `json:"weight"`
}
