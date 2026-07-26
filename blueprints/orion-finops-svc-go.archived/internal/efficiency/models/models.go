package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ==================== JSONB helper ====================

type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
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
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// JSONBRaw is a flexible JSONB type that can hold any JSON value (not just objects).
type JSONBRaw []interface{}

func (j JSONBRaw) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONBRaw) Scan(src interface{}) error {
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
		return fmt.Errorf("cannot scan %T into JSONBRaw", src)
	}
}

// ==================== Time Window ====================

// TimeWindow represents a DORA aggregation window type.
type TimeWindow string

const (
	TimeWindowDay     TimeWindow = "day"
	TimeWindowWeek    TimeWindow = "week"
	TimeWindowMonth   TimeWindow = "month"
	TimeWindowQuarter TimeWindow = "quarter"
)

// TimeWindowConfig holds a configured time window with start/end boundaries.
type TimeWindowConfig struct {
	Window TimeWindow `json:"window"`
	Size   int        `json:"size"`
	Start  time.Time  `json:"start"`
	End    time.Time  `json:"end"`
}

// ==================== Core Entity Models ====================

// EfficiencyMetric is the generic key-value metric entity.
type EfficiencyMetric struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	Name       string    `db:"name" json:"name"`
	MetricType string    `db:"metric_type" json:"metric_type"`
	Value      float64   `db:"value" json:"value"`
	Target     float64   `db:"target" json:"target,omitempty"`
	Unit       string    `db:"unit" json:"unit,omitempty"`
	Period     string    `db:"period" json:"period,omitempty"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// PipelineRecord represents a pipeline completion event for DORA metrics.
type PipelineRecord struct {
	ID                 string    `db:"id" json:"id"`
	TenantID           string    `db:"tenant_id" json:"tenant_id"`
	RunID              string    `db:"run_id" json:"run_id"`
	PipelineID         string    `db:"pipeline_id" json:"pipeline_id"`
	Status             string    `db:"status" json:"status"`
	TriggerType        string    `db:"trigger_type" json:"trigger_type"`
	GitRef             string    `db:"git_ref" json:"git_ref,omitempty"`
	GitSHA             string    `db:"git_sha" json:"git_sha,omitempty"`
	DurationMs         int64     `db:"duration_ms" json:"duration_ms"`
	CompletedAt        time.Time `db:"completed_at" json:"completed_at"`
	SyncedToClickhouse bool      `db:"synced_to_clickhouse" json:"synced_to_clickhouse"`
	SyncedAt           time.Time `db:"synced_at" json:"synced_at,omitempty"`
}

// DeploymentRecord represents a deployment event for DORA metrics.
type DeploymentRecord struct {
	ID                 string    `db:"id" json:"id"`
	TenantID           string    `db:"tenant_id" json:"tenant_id"`
	DeploymentID       string    `db:"deployment_id" json:"deployment_id"`
	Service            string    `db:"service" json:"service,omitempty"`
	Environment        string    `db:"environment" json:"environment,omitempty"`
	Status             string    `db:"status" json:"status"`
	Version            string    `db:"version" json:"version,omitempty"`
	DurationMs         int64     `db:"duration_ms" json:"duration_ms,omitempty"`
	DeployedAt         time.Time `db:"deployed_at" json:"deployed_at"`
	RecoveryTimeMs     int64     `db:"recovery_time_ms" json:"recovery_time_ms,omitempty"`
	CommitSHA          string    `db:"commit_sha" json:"commit_sha,omitempty"`
	CommitCommittedAt  time.Time `db:"commit_committed_at" json:"commit_committed_at,omitempty"`
	SyncedToClickhouse bool      `db:"synced_to_clickhouse" json:"synced_to_clickhouse"`
	SyncedAt           time.Time `db:"synced_at" json:"synced_at,omitempty"`
}

// IncidentRecord represents an incident for MTTR calculation.
type IncidentRecord struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenant_id"`
	DeploymentID    string    `db:"deployment_id" json:"deployment_id,omitempty"`
	PipelineRunID   string    `db:"pipeline_run_id" json:"pipeline_run_id,omitempty"`
	Type            string    `db:"type" json:"type"`
	Severity        string    `db:"severity" json:"severity,omitempty"`
	Status          string    `db:"status" json:"status"`
	DetectedAt      time.Time `db:"detected_at" json:"detected_at"`
	AcknowledgedAt  time.Time `db:"acknowledged_at" json:"acknowledged_at,omitempty"`
	ResolvedAt      time.Time `db:"resolved_at" json:"resolved_at,omitempty"`
	RecoveryTimeMs  int64     `db:"recovery_time_ms" json:"recovery_time_ms,omitempty"`
	Service         string    `db:"service" json:"service,omitempty"`
	Environment     string    `db:"environment" json:"environment,omitempty"`
}

// MetricSnapshot stores historical DORA metric values for trend calculation.
type MetricSnapshot struct {
	ID                  string    `db:"id" json:"id"`
	TenantID            string    `db:"tenant_id" json:"tenant_id"`
	TimeWindow          string    `db:"time_window" json:"time_window"`
	DeploymentFrequency float64   `db:"deployment_frequency" json:"deployment_frequency"`
	LeadTimeMs          float64   `db:"lead_time_ms" json:"lead_time_ms"`
	ChangeFailureRate   float64   `db:"change_failure_rate" json:"change_failure_rate"`
	MttrMs              float64   `db:"mttr_ms" json:"mttr_ms"`
	CapturedAt          time.Time `db:"captured_at" json:"captured_at"`
}

// Scenario stores a cached dashboard scenario.
type Scenario struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	ScenarioID  string    `db:"scenario_id" json:"scenario_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Category    string    `db:"category" json:"category"`
	Widgets     JSONB     `db:"widgets" json:"widgets"`
	TimeRange   JSONB     `db:"time_range" json:"time_range"`
	Summary     JSONB     `db:"summary" json:"summary"`
	CacheKey    string    `db:"cache_key" json:"cache_key"`
	ExpiresAt   time.Time `db:"expires_at" json:"expires_at"`
}

// WeeklyReport stores a generated weekly report.
type WeeklyReport struct {
	ID         string    `db:"id" json:"id"`
	TeamID     string    `db:"team_id" json:"team_id"`
	WeekStart  time.Time `db:"week_start" json:"week_start"`
	WeekEnd    time.Time `db:"week_end" json:"week_end"`
	ReportData JSONB     `db:"report_data" json:"report_data"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// TeamData stores registered team information.
type TeamData struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	Name       string    `db:"name" json:"name"`
	Members    int       `db:"members" json:"members"`
	Pipelines  JSONB     `db:"pipelines" json:"pipelines"`
	Deployments JSONB    `db:"deployments" json:"deployments"`
}

// ProjectData stores registered project information.
type ProjectData struct {
	ID          string `db:"id" json:"id"`
	TenantID    string `db:"tenant_id" json:"tenant_id"`
	Name        string `db:"name" json:"name"`
	Pipelines   JSONB  `db:"pipelines" json:"pipelines"`
	Deployments JSONB  `db:"deployments" json:"deployments"`
	Commits     int    `db:"commits" json:"commits"`
}

// GlobalDeployment stores a deployment record for report generation.
type GlobalDeployment struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	DeploymentData JSONB   `db:"deployment_data" json:"deployment_data"`
	DeployedAt   time.Time `db:"deployed_at" json:"deployed_at"`
}

// GlobalPipeline stores a pipeline record for report generation.
type GlobalPipeline struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	PipelineData JSONB     `db:"pipeline_data" json:"pipeline_data"`
	CompletedAt  time.Time `db:"completed_at" json:"completed_at"`
}

// ReportHistory stores generated efficiency reports.
type ReportHistory struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	ReportData  JSONB     `db:"report_data" json:"report_data"`
	GeneratedAt time.Time `db:"generated_at" json:"generated_at"`
}

// ==================== DORA Result Types ====================

// DORAMetricResult is the standard DORA metric output with value, trend, target, status.
type DORAMetricResult struct {
	Value  float64 `json:"value"`
	Trend  string  `json:"trend"`
	Target float64 `json:"target"`
	Status string  `json:"status"`
}

// AllDORAResult contains all four DORA metrics.
type AllDORAResult struct {
	DeploymentFrequency DORAMetricResult `json:"deploymentFrequency"`
	LeadTime            DORAMetricResult `json:"leadTime"`
	ChangeFailureRate   DORAMetricResult `json:"changeFailureRate"`
	Mttr                DORAMetricResult `json:"mttr"`
	ComputedAt          time.Time        `json:"computedAt"`
}

// DORATrendResult compares two time periods of DORA metrics.
type DORATrendResult struct {
	Current       AllDORAResult `json:"current"`
	Previous      AllDORAResult `json:"previous"`
	Changes       TrendChanges  `json:"changes"`
	CurrentPeriod string        `json:"currentPeriod"`
	PreviousPeriod string       `json:"previousPeriod"`
}

// TrendChanges holds percentage changes for each DORA metric.
type TrendChanges struct {
	DeploymentFrequency float64 `json:"deploymentFrequency"`
	LeadTime            float64 `json:"leadTime"`
	ChangeFailureRate   float64 `json:"changeFailureRate"`
	Mttr                float64 `json:"mttr"`
}

// DeploymentFrequencyResult holds deployment frequency calculation output.
type DeploymentFrequencyResult struct {
	TotalDeployments      int     `json:"totalDeployments"`
	SuccessfulDeployments int     `json:"successfulDeployments"`
	FailedDeployments     int     `json:"failedDeployments"`
	DeploymentsPerDay     float64 `json:"deploymentsPerDay"`
	FrequencyLevel        string  `json:"frequencyLevel"`
}

// LeadTimeResult holds lead time calculation output.
type LeadTimeResult struct {
	TotalChanges       int     `json:"totalChanges"`
	AverageLeadTimeMs  float64 `json:"averageLeadTimeMs"`
	MedianLeadTimeMs   float64 `json:"medianLeadTimeMs"`
	P90LeadTimeMs      float64 `json:"p90LeadTimeMs"`
	P99LeadTimeMs      float64 `json:"p99LeadTimeMs"`
	LeadTimeLevel      string  `json:"leadTimeLevel"`
	CalculationMethod  string  `json:"calculationMethod"`
}

// ChangeFailureRateResult holds failure rate calculation output.
type ChangeFailureRateResult struct {
	TotalDeployments  int     `json:"totalDeployments"`
	FailedDeployments int     `json:"failedDeployments"`
	FailureRate       float64 `json:"failureRate"`
	FailureRateLevel  string  `json:"failureRateLevel"`
}

// MTTRResult holds MTTR calculation output.
type MTTRResult struct {
	TotalIncidents       int     `json:"totalIncidents"`
	RecoveredIncidents   int     `json:"recoveredIncidents"`
	AverageRecoveryTimeMs float64 `json:"averageRecoveryTimeMs"`
	MedianRecoveryTimeMs  float64 `json:"medianRecoveryTimeMs"`
	P90RecoveryTimeMs     float64 `json:"p90RecoveryTimeMs"`
	RecoveryTimeLevel     string  `json:"recoveryTimeLevel"`
	CalculationMethod     string  `json:"calculationMethod"`
}

// DORAMetricsReport is the full DORA report with all four metrics.
type DORAMetricsReport struct {
	ReportID             string                  `json:"reportId"`
	TenantID             string                  `json:"tenantId"`
	DeploymentFrequency  DeploymentFrequencyResult `json:"deploymentFrequency"`
	LeadTimeForChanges   LeadTimeResult            `json:"leadTimeForChanges"`
	ChangeFailureRate    ChangeFailureRateResult    `json:"changeFailureRate"`
	MeanTimeToRecovery   MTTRResult                `json:"meanTimeToRecovery"`
	OverallLevel         string                    `json:"overallLevel"`
	GeneratedAt          time.Time                 `json:"generatedAt"`
}

// ==================== Dashboard Types ====================

// DashboardWidget represents a single widget in a scenario dashboard.
type DashboardWidget struct {
	ID     string      `json:"id"`
	Type   string      `json:"type"`
	Title  string      `json:"title"`
	Data   interface{} `json:"data"`
	Layout *WidgetLayout `json:"layout,omitempty"`
}

// WidgetLayout defines the grid layout of a widget.
type WidgetLayout struct {
	ColSpan int `json:"colSpan"`
	RowSpan int `json:"rowSpan"`
}

// ScenarioSummary holds the summary metrics for a scenario.
type ScenarioSummary struct {
	Score         int      `json:"score"`
	Trend         string   `json:"trend"`
	ChangePercent int      `json:"changePercent"`
	Highlights    []string `json:"highlights"`
	Issues        []string `json:"issues"`
}

// ScenarioResult is the full scenario dashboard response.
type ScenarioResult struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Category    string           `json:"category"`
	Widgets     []DashboardWidget `json:"widgets"`
	TimeRange   TimeRange        `json:"timeRange"`
	Summary     ScenarioSummary  `json:"summary"`
}

// TimeRange defines a start/end time range.
type TimeRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// AvailableScenario holds scenario metadata for listing.
type AvailableScenario struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Category string `json:"category"`
}

// ==================== Report Types ====================

// EfficiencyReport is the full efficiency report response.
type EfficiencyReport struct {
	ReportID            string             `json:"reportId"`
	TenantID            string             `json:"tenantId"`
	TimeWindow          string             `json:"timeWindow"`
	WindowSize          int                `json:"windowSize"`
	DoraMetrics         *DORAMetricsReport `json:"doraMetrics,omitempty"`
	TotalPipelineRuns   int                `json:"totalPipelineRuns"`
	PipelineSuccessRate float64            `json:"pipelineSuccessRate"`
	AverageBuildTimeMs  float64            `json:"averageBuildTimeMs"`
	TotalDeployments    int                `json:"totalDeployments"`
	GeneratedAt         time.Time          `json:"generatedAt"`
}

// TeamMetricsResult holds team-level metrics.
type TeamMetricsResult struct {
	TeamID                string  `json:"teamId"`
	TeamName              string  `json:"teamName"`
	TenantID              string  `json:"tenantId"`
	ActiveMembers         int     `json:"activeMembers"`
	CompletedPipelines    int     `json:"completedPipelines"`
	SuccessRate           float64 `json:"successRate"`
	AverageExecutionTimeMs float64 `json:"averageExecutionTimeMs"`
	DeploymentCount       int     `json:"deploymentCount"`
	ChangeFailureRate     float64 `json:"changeFailureRate"`
}

// ProjectMetricsResult holds project-level metrics.
type ProjectMetricsResult struct {
	ProjectID          string  `json:"projectId"`
	ProjectName        string  `json:"projectName"`
	TenantID           string  `json:"tenantId"`
	TotalPipelines     int     `json:"totalPipelines"`
	RecentPipelineCount int    `json:"recentPipelineCount"`
	SuccessRate        float64 `json:"successRate"`
	AverageBuildTimeMs float64 `json:"averageBuildTimeMs"`
	DeploymentCount    int     `json:"deploymentCount"`
	CommitCount        int     `json:"commitCount"`
}

// PeriodMetrics holds computed metrics for a single time period.
type PeriodMetrics struct {
	Label             string    `json:"label"`
	Start             time.Time `json:"start"`
	End               time.Time `json:"end"`
	PipelineRuns      int       `json:"pipelineRuns"`
	SuccessRate       float64   `json:"successRate"`
	AverageBuildTimeMs float64  `json:"averageBuildTimeMs"`
	Deployments       int       `json:"deployments"`
	ChangeFailureRate float64   `json:"changeFailureRate"`
}

// PeriodComparisonResult compares two time periods.
type PeriodComparisonResult struct {
	PeriodA  PeriodMetrics `json:"periodA"`
	PeriodB  PeriodMetrics `json:"periodB"`
	Changes  PeriodChanges `json:"changes"`
}

// PeriodChanges holds the percentage changes between two periods.
type PeriodChanges struct {
	PipelineRuns      float64 `json:"pipelineRuns"`
	SuccessRate       float64 `json:"successRate"`
	AverageBuildTime  float64 `json:"averageBuildTime"`
	Deployments       float64 `json:"deployments"`
	ChangeFailureRate float64 `json:"changeFailureRate"`
}

// WeeklyReportResult is the full weekly report response.
type WeeklyReportResult struct {
	ReportID   string                 `json:"reportId"`
	TeamID     string                 `json:"teamId"`
	WeekStart  time.Time              `json:"weekStart"`
	WeekEnd    time.Time              `json:"weekEnd"`
	GeneratedAt time.Time             `json:"generatedAt"`
	HealthScore string                `json:"healthScore"`
	Markdown   string                 `json:"markdown"`
	JSON       map[string]interface{} `json:"json"`
}

// WeeklyReportListItem is a summary for listing past reports.
type WeeklyReportListItem struct {
	ID          string `json:"id"`
	TeamID      string `json:"teamId"`
	WeekStart   string `json:"weekStart"`
	WeekEnd     string `json:"weekEnd"`
	HealthScore string `json:"healthScore"`
}

// ==================== Request Types ====================

// CreateEfficiencyMetricRequest is the request body for creating a metric.
type CreateEfficiencyMetricRequest struct {
	Name       string  `json:"name" binding:"required"`
	MetricType string  `json:"metric_type" binding:"required"`
	Value      float64 `json:"value" binding:"required"`
	Target     float64 `json:"target"`
	Unit       string  `json:"unit"`
	Period     string  `json:"period"`
}

// PaginatedRequest holds pagination parameters.
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

// RegisterTeamRequest is the request body for registering a team.
type RegisterTeamRequest struct {
	TeamID    string `json:"team_id" binding:"required"`
	Name      string `json:"name" binding:"required"`
	Members   int    `json:"members"`
}

// RegisterProjectRequest is the request body for registering a project.
type RegisterProjectRequest struct {
	ProjectID string `json:"project_id" binding:"required"`
	Name      string `json:"name" binding:"required"`
	Commits   int    `json:"commits"`
}

// InjectDataRequest is the request body for injecting pipeline/deployment data.
type InjectDataRequest struct {
	TenantID string `json:"tenant_id" binding:"required"`
}

// ComparePeriodsRequest is the request body for period comparison.
type ComparePeriodsRequest struct {
	PeriodALabel string    `json:"period_a_label" binding:"required"`
	PeriodAStart time.Time `json:"period_a_start" binding:"required"`
	PeriodAEnd   time.Time `json:"period_a_end" binding:"required"`
	PeriodBLabel string    `json:"period_b_label" binding:"required"`
	PeriodBStart time.Time `json:"period_b_start" binding:"required"`
	PeriodBEnd   time.Time `json:"period_b_end" binding:"required"`
}

// GenerateWeeklyReportRequest is the request body for generating a weekly report.
type GenerateWeeklyReportRequest struct {
	TeamID    string    `json:"team_id"`
	WeekStart time.Time `json:"week_start"`
}
