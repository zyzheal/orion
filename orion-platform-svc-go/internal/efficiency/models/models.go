package models

import "time"

// TimeWindow specifies the aggregation window for DORA metrics.
type TimeWindow string

const (
	TimeWindowDay     TimeWindow = "day"
	TimeWindowWeek    TimeWindow = "week"
	TimeWindowMonth   TimeWindow = "month"
	TimeWindowQuarter TimeWindow = "quarter"
)

// Level aliases used across DORA metrics.
type Level string

const (
	LevelElite  Level = "elite"
	LevelHigh   Level = "high"
	LevelMedium Level = "medium"
	LevelLow    Level = "low"
)

const (
	FrequencyLevelOnDemand Level = "on-demand"
	FrequencyLevelDaily    Level = "daily"
	FrequencyLevelWeekly   Level = "weekly"
	FrequencyLevelMonthly  Level = "monthly"
	FrequencyLevelYearly   Level = "yearly"
)

// MetricStatus indicates whether a target is met.
type MetricStatus string

const (
	StatusMet     MetricStatus = "met"
	StatusWarning MetricStatus = "warning"
	StatusMissed  MetricStatus = "missed"
)

// Trend indicates the direction of a metric.
type Trend string

const (
	TrendUp     Trend = "up"
	TrendDown   Trend = "down"
	TrendStable Trend = "stable"
)

// Impact levels used in bottleneck analysis.
type Impact string

const (
	ImpactHigh   Impact = "high"
	ImpactMedium Impact = "medium"
	ImpactLow    Impact = "low"
)

// TimeWindowConfig defines a calculation window.
type TimeWindowConfig struct {
	Window TimeWindow `json:"window"`
	Size   int        `json:"size"`
	Start  time.Time  `json:"start"`
	End    time.Time  `json:"end"`
}

// ===== Raw records (persisted) =====

// DeploymentRecord stores a deployment event.
type DeploymentRecord struct {
	ID                 string     `json:"id" db:"id"`
	TenantID           string     `json:"tenantId" db:"tenant_id"`
	DeploymentID       string     `json:"deploymentId" db:"deployment_id"`
	Service            string     `json:"service" db:"service"`
	Environment        string     `json:"environment" db:"environment"`
	Status             string     `json:"status" db:"status"`
	Version            *string    `json:"version,omitempty" db:"version"`
	DurationMs         *int64     `json:"durationMs,omitempty" db:"duration_ms"`
	DeployedAt         time.Time  `json:"deployedAt" db:"deployed_at"`
	RecoveryTimeMs     *int64     `json:"recoveryTimeMs,omitempty" db:"recovery_time_ms"`
	CommitSha          *string    `json:"commitSha,omitempty" db:"commit_sha"`
	CommitCommittedAt  *time.Time `json:"commitCommittedAt,omitempty" db:"commit_committed_at"`
	SyncedToClickHouse bool       `json:"syncedToClickHouse" db:"synced_to_clickhouse"`
	SyncedAt           *time.Time `json:"syncedAt,omitempty" db:"synced_at"`
}

// PipelineCompletionRecord stores a pipeline run completion event.
type PipelineCompletionRecord struct {
	ID                 string     `json:"id" db:"id"`
	RunID              string     `json:"runId" db:"run_id"`
	PipelineID         string     `json:"pipelineId" db:"pipeline_id"`
	Status             string     `json:"status" db:"status"`
	TriggerType        string     `json:"triggerType" db:"trigger_type"`
	GitRef             *string    `json:"gitRef,omitempty" db:"git_ref"`
	GitSha             *string    `json:"gitSha,omitempty" db:"git_sha"`
	DurationMs         int64      `json:"durationMs" db:"duration_ms"`
	CompletedAt        time.Time  `json:"completedAt" db:"completed_at"`
	TenantID           string     `json:"tenantId" db:"tenant_id"`
	SyncedToClickHouse bool       `json:"syncedToClickHouse" db:"synced_to_clickhouse"`
	SyncedAt           *time.Time `json:"syncedAt,omitempty" db:"synced_at"`
}

// IncidentRecord stores an incident for MTTR calculation.
type IncidentRecord struct {
	ID             string     `json:"id" db:"id"`
	TenantID       string     `json:"tenantId" db:"tenant_id"`
	DeploymentID   *string    `json:"deploymentId,omitempty" db:"deployment_id"`
	PipelineRunID  *string    `json:"pipelineRunId,omitempty" db:"pipeline_run_id"`
	Type           string     `json:"type" db:"type"`
	Severity       string     `json:"severity" db:"severity"`
	Status         string     `json:"status" db:"status"`
	DetectedAt     time.Time  `json:"detectedAt" db:"detected_at"`
	AcknowledgedAt *time.Time `json:"acknowledgedAt,omitempty" db:"acknowledged_at"`
	ResolvedAt     *time.Time `json:"resolvedAt,omitempty" db:"resolved_at"`
	RecoveryTimeMs *int64     `json:"recoveryTimeMs,omitempty" db:"recovery_time_ms"`
	Service        *string    `json:"service,omitempty" db:"service"`
	Environment    *string    `json:"environment,omitempty" db:"environment"`
}

// ===== DORA computed metrics =====

// DeploymentFrequency computed result.
type DeploymentFrequency struct {
	Window                TimeWindowConfig `json:"window" db:"-"`
	TotalDeployments      int              `json:"totalDeployments"`
	SuccessfulDeployments int              `json:"successfulDeployments"`
	FailedDeployments     int              `json:"failedDeployments"`
	DeploymentsPerDay     float64          `json:"deploymentsPerDay"`
	FrequencyLevel        Level            `json:"frequencyLevel"`
}

// LeadTimeForChanges computed result.
type LeadTimeForChanges struct {
	Window            TimeWindowConfig `json:"window" db:"-"`
	TotalChanges      int              `json:"totalChanges"`
	AverageLeadTimeMs int64            `json:"averageLeadTimeMs"`
	MedianLeadTimeMs  int64            `json:"medianLeadTimeMs"`
	P90LeadTimeMs     int64            `json:"p90LeadTimeMs"`
	P99LeadTimeMs     int64            `json:"p99LeadTimeMs"`
	LeadTimeLevel     Level            `json:"leadTimeLevel"`
	CalculationMethod string           `json:"calculationMethod"`
}

// DeploymentFailureRecord for failure details.
type DeploymentFailureRecord struct {
	DeploymentID   string    `json:"deploymentId"`
	Service        string    `json:"service"`
	Environment    string    `json:"environment"`
	FailedAt       time.Time `json:"failedAt"`
	Reason         *string   `json:"reason,omitempty"`
	RecoveryTimeMs *int64    `json:"recoveryTimeMs,omitempty"`
}

// ChangeFailureRate computed result.
type ChangeFailureRate struct {
	Window            TimeWindowConfig          `json:"window" db:"-"`
	TotalDeployments  int                       `json:"totalDeployments"`
	FailedDeployments int                       `json:"failedDeployments"`
	FailureRate       float64                   `json:"failureRate"`
	FailureRateLevel  Level                     `json:"failureRateLevel"`
	FailureDetails    []DeploymentFailureRecord `json:"failureDetails"`
}

// MeanTimeToRecovery computed result.
type MeanTimeToRecovery struct {
	Window                TimeWindowConfig `json:"window" db:"-"`
	TotalIncidents        int              `json:"totalIncidents"`
	RecoveredIncidents    int              `json:"recoveredIncidents"`
	AverageRecoveryTimeMs int64            `json:"averageRecoveryTimeMs"`
	MedianRecoveryTimeMs  int64            `json:"medianRecoveryTimeMs"`
	P90RecoveryTimeMs     int64            `json:"p90RecoveryTimeMs"`
	P99RecoveryTimeMs     *int64           `json:"p99RecoveryTimeMs"`
	RecoveryTimeLevel     Level            `json:"recoveryTimeLevel"`
	CalculationMethod     string           `json:"calculationMethod"`
}

// DoraMetricsReport aggregates all four DORA metrics.
type DoraMetricsReport struct {
	ReportID            string              `json:"reportId" db:"-"`
	TenantID            string              `json:"tenantId"`
	Window              TimeWindowConfig    `json:"window" db:"-"`
	DeploymentFrequency DeploymentFrequency `json:"deploymentFrequency"`
	LeadTimeForChanges  LeadTimeForChanges  `json:"leadTimeForChanges"`
	ChangeFailureRate   ChangeFailureRate   `json:"changeFailureRate"`
	MeanTimeToRecovery  MeanTimeToRecovery  `json:"meanTimeToRecovery"`
	OverallLevel        Level               `json:"overallLevel"`
	GeneratedAt         time.Time           `json:"generatedAt"`
}

// ===== Efficiency report (high-level) =====

// EfficiencyReport is the top-level efficiency report.
type EfficiencyReport struct {
	ReportID            string             `json:"reportId"`
	TenantID            string             `json:"tenantId"`
	TimeWindow          TimeWindow         `json:"timeWindow"`
	WindowSize          int                `json:"windowSize"`
	DoraMetrics         *DoraMetricsReport `json:"doraMetrics,omitempty"`
	TotalPipelineRuns   int                `json:"totalPipelineRuns"`
	PipelineSuccessRate float64            `json:"pipelineSuccessRate"`
	AverageBuildTimeMs  int64              `json:"averageBuildTimeMs"`
	TotalDeployments    int                `json:"totalDeployments"`
	GeneratedAt         time.Time          `json:"generatedAt"`
}

// ReportHistoryEntry is a persisted report for history.
type ReportHistoryEntry struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	ReportData  string    `json:"reportData" db:"report_data"`
	GeneratedAt time.Time `json:"generatedAt" db:"generated_at"`
}

// ===== Team / Project metrics =====

// TeamMetrics aggregates metrics for a single team.
type TeamMetrics struct {
	TeamID                 string  `json:"teamId"`
	TeamName               string  `json:"teamName"`
	TenantID               string  `json:"tenantId"`
	ActiveMembers          int     `json:"activeMembers"`
	CompletedPipelines     int     `json:"completedPipelines"`
	SuccessRate            float64 `json:"successRate"`
	AverageExecutionTimeMs int64   `json:"averageExecutionTimeMs"`
	DeploymentCount        int     `json:"deploymentCount"`
	ChangeFailureRate      float64 `json:"changeFailureRate"`
}

// ProjectMetrics aggregates metrics for a single project.
type ProjectMetrics struct {
	ProjectID           string  `json:"projectId"`
	ProjectName         string  `json:"projectName"`
	TenantID            string  `json:"tenantId"`
	TotalPipelines      int     `json:"totalPipelines"`
	RecentPipelineCount int     `json:"recentPipelineCount"`
	SuccessRate         float64 `json:"successRate"`
	AverageBuildTimeMs  int64   `json:"averageBuildTimeMs"`
	DeploymentCount     int     `json:"deploymentCount"`
	CommitCount         int     `json:"commitCount"`
}

// TeamInfo is the minimal team list entry.
type TeamInfo struct {
	TeamID   string `json:"teamId"`
	TeamName string `json:"teamName"`
}

// TeamData persisted entity.
type TeamData struct {
	ID          string `json:"id" db:"id"`
	TenantID    string `json:"tenantId" db:"tenant_id"`
	Name        string `json:"name" db:"name"`
	Members     int    `json:"members" db:"members"`
	Pipelines   string `json:"pipelines" db:"pipelines"`
	Deployments string `json:"deployments" db:"deployments"`
}

// ProjectData persisted entity.
type ProjectData struct {
	ID          string `json:"id" db:"id"`
	TenantID    string `json:"tenantId" db:"tenant_id"`
	Name        string `json:"name" db:"name"`
	Pipelines   string `json:"pipelines" db:"pipelines"`
	Deployments string `json:"deployments" db:"deployments"`
	Commits     int    `json:"commits" db:"commits"`
}

// GlobalDeployment persisted entity.
type GlobalDeployment struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenantId" db:"tenant_id"`
	DeploymentData string    `json:"deploymentData" db:"deployment_data"`
	DeployedAt     time.Time `json:"deployedAt" db:"deployed_at"`
}

// GlobalPipeline persisted entity.
type GlobalPipeline struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenantId" db:"tenant_id"`
	PipelineData string    `json:"pipelineData" db:"pipeline_data"`
	CompletedAt  time.Time `json:"completedAt" db:"completed_at"`
}

// ===== Period comparison =====

// PeriodSpec defines a time period for comparison.
type PeriodSpec struct {
	Label string    `json:"label"`
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// PeriodMetrics is the computed metrics for one period.
type PeriodMetrics struct {
	Label              string  `json:"label"`
	Start              string  `json:"start"`
	End                string  `json:"end"`
	PipelineRuns       int     `json:"pipelineRuns"`
	SuccessRate        float64 `json:"successRate"`
	AverageBuildTimeMs int64   `json:"averageBuildTimeMs"`
	Deployments        int     `json:"deployments"`
	ChangeFailureRate  float64 `json:"changeFailureRate"`
}

// PeriodChanges percentage deltas.
type PeriodChanges struct {
	PipelineRuns      float64 `json:"pipelineRuns"`
	SuccessRate       float64 `json:"successRate"`
	AverageBuildTime  float64 `json:"averageBuildTime"`
	Deployments       float64 `json:"deployments"`
	ChangeFailureRate float64 `json:"changeFailureRate"`
}

// PeriodComparisonResult is the full comparison output.
type PeriodComparisonResult struct {
	PeriodA PeriodMetrics `json:"periodA"`
	PeriodB PeriodMetrics `json:"periodB"`
	Changes PeriodChanges `json:"changes"`
}

// ===== DORA standard metric result =====

// DORAMetricResult is the {value, trend, target, status} format.
type DORAMetricResult struct {
	Value  float64      `json:"value"`
	Trend  Trend        `json:"trend"`
	Target float64      `json:"target"`
	Status MetricStatus `json:"status"`
}

// AllDORAResult aggregates all four standard DORA metrics.
type AllDORAResult struct {
	DeploymentFrequency DORAMetricResult `json:"deploymentFrequency"`
	LeadTime            DORAMetricResult `json:"leadTime"`
	ChangeFailureRate   DORAMetricResult `json:"changeFailureRate"`
	MTTR                DORAMetricResult `json:"mttr"`
	ComputedAt          time.Time        `json:"computedAt"`
}

// DORATrendChanges percentage changes between periods.
type DORATrendChanges struct {
	DeploymentFrequency float64 `json:"deploymentFrequency"`
	LeadTime            float64 `json:"leadTime"`
	ChangeFailureRate   float64 `json:"changeFailureRate"`
	MTTR                float64 `json:"mttr"`
}

// DORATrendResult compares current and previous periods.
type DORATrendResult struct {
	Current        AllDORAResult    `json:"current"`
	Previous       AllDORAResult    `json:"previous"`
	Changes        DORATrendChanges `json:"changes"`
	CurrentPeriod  string           `json:"currentPeriod"`
	PreviousPeriod string           `json:"previousPeriod"`
}

// MetricSnapshot is the per-calculation snapshot stored in DB.
type MetricSnapshot struct {
	ID                  string    `json:"id" db:"id"`
	TenantID            string    `json:"tenantId" db:"tenant_id"`
	TimeWindow          string    `json:"timeWindow" db:"time_window"`
	DeploymentFrequency float64   `json:"deploymentFrequency" db:"deployment_frequency"`
	LeadTimeMs          int64     `json:"leadTimeMs" db:"lead_time_ms"`
	ChangeFailureRate   float64   `json:"changeFailureRate" db:"change_failure_rate"`
	MTTRMs              int64     `json:"mttrMs" db:"mttr_ms"`
	CapturedAt          time.Time `json:"capturedAt" db:"captured_at"`
}

// HistoricalSnapshotWeek is the chart data point.
type HistoricalSnapshotWeek struct {
	Week                string  `json:"week"`
	DeploymentFrequency float64 `json:"deploymentFrequency"`
	LeadTime            int     `json:"leadTime"`
	MTTR                int     `json:"mttr"`
	ChangeFailureRate   float64 `json:"changeFailureRate"`
}

// ===== Dashboard response =====

// DashboardDORA aggregates DORA values in dashboard format.
type DashboardDORA struct {
	DeploymentFrequency float64 `json:"deploymentFrequency"`
	LeadTime            int     `json:"leadTime"`
	MTTR                int     `json:"mttr"`
	ChangeFailureRate   float64 `json:"changeFailureRate"`
}

// DashboardSummary deployment counts.
type DashboardSummary struct {
	TotalDeployments      int `json:"totalDeployments"`
	SuccessfulDeployments int `json:"successfulDeployments"`
	FailedDeployments     int `json:"failedDeployments"`
}

// DashboardData is the /dashboard response body.
type DashboardData struct {
	DORA    DashboardDORA    `json:"dora"`
	Trends  DashboardDORA    `json:"trends"`
	Summary DashboardSummary `json:"summary"`
}

// ===== Bottleneck analysis =====

// Bottleneck is a derived improvement area.
type Bottleneck struct {
	ID           string `json:"id"`
	Category     string `json:"category"`
	Description  string `json:"description"`
	Impact       Impact `json:"impact"`
	Metric       string `json:"metric"`
	CurrentValue string `json:"currentValue"`
	TargetValue  string `json:"targetValue"`
	Suggestion   string `json:"suggestion"`
}

// ===== Developer profile =====

// DeveloperProfile is derived from team data.
type DeveloperProfile struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Team          string   `json:"team"`
	Role          string   `json:"role"`
	Commits       int      `json:"commits"`
	PRs           int      `json:"prs"`
	Reviews       int      `json:"reviews"`
	BugsFixed     int      `json:"bugsFixed"`
	AvgReviewTime int      `json:"avgReviewTime"`
	AvgPRSize     int      `json:"avgPRSize"`
	CodeQuality   int      `json:"codeQuality"`
	ActiveDays    int      `json:"activeDays"`
	Specialty     []string `json:"specialty"`
}

// ===== Request DTOs =====

// ComparePeriodsRequest is the body for POST /compare.
type ComparePeriodsRequest struct {
	TenantID *string     `json:"tenantId"`
	PeriodA  *PeriodSpec `json:"periodA" binding:"required"`
	PeriodB  *PeriodSpec `json:"periodB" binding:"required"`
}
