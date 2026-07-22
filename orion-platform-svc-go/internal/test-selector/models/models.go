package models

import "time"

// ImpactPriority represents the impact severity level.
type ImpactPriority string

const (
	ImpactCritical ImpactPriority = "critical"
	ImpactHigh     ImpactPriority = "high"
	ImpactMedium   ImpactPriority = "medium"
	ImpactLow      ImpactPriority = "low"
)

// OrderingStrategy represents the test ordering strategy.
type OrderingStrategy string

const (
	OrderingFailFast      OrderingStrategy = "fail-fast"
	OrderingBalanced      OrderingStrategy = "balanced"
	OrderingCoverageFirst OrderingStrategy = "coverage-first"
)

// TestStatus represents the execution status of a PR test.
type TestStatus string

const (
	StatusPending   TestStatus = "pending"
	StatusRunning   TestStatus = "running"
	StatusCompleted TestStatus = "completed"
	StatusFailed    TestStatus = "failed"
)

// ChangeType represents the type of a file change.
type ChangeType string

const (
	ChangeAdded    ChangeType = "added"
	ChangeModified ChangeType = "modified"
	ChangeDeleted  ChangeType = "deleted"
	ChangeRenamed  ChangeType = "renamed"
)

// TestSuite represents a test file (e.g., *.test.ts).
type TestSuite struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	FilePath    string    `json:"filePath" db:"file_path"`
	TestCount   int       `json:"testCount" db:"test_count"`
	AvgDuration float64   `json:"avgDuration" db:"avg_duration"` // ms
	PassRate    float64   `json:"passRate" db:"pass_rate"`       // 0-1
	LastRun     time.Time `json:"lastRun" db:"last_run"`
	SourceFiles string    `json:"sourceFiles" db:"source_files"` // JSON array
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// TestCase represents an individual test (e.g., it/describe block).
type TestCase struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	SuiteID      string    `json:"suiteId" db:"suite_id"`
	Name         string    `json:"name" db:"name"`
	FilePath     string    `json:"filePath" db:"file_path"`
	Dependencies string    `json:"dependencies" db:"dependencies"` // JSON array
	AvgDuration  float64   `json:"avgDuration" db:"avg_duration"`  // ms
	FlakyScore   float64   `json:"flakyScore" db:"flaky_score"`    // 0-100
	History      string    `json:"history" db:"history"`           // JSON array
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// TestExecutionRecord stores a single test run result.
type TestExecutionRecord struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenant_id" db:"tenant_id"`
	TestID         string    `json:"testId" db:"test_id"`
	ExecutionID    string    `json:"executionId" db:"execution_id"`
	Passed         bool      `json:"passed" db:"passed"`
	Duration       float64   `json:"duration" db:"duration"` // ms
	FailureMessage *string   `json:"failureMessage" db:"failure_message"`
	PRID           *string   `json:"prId" db:"pr_id"`
	ExecutedAt     time.Time `json:"executedAt" db:"executed_at"`
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
}

// PRTestResult stores the result of a test selection for a PR.
type PRTestResult struct {
	ID         string     `json:"id" db:"id"`
	TenantID   string     `json:"tenant_id" db:"tenant_id"`
	PRID       string     `json:"prId" db:"pr_id"`
	PlanData   string     `json:"planData" db:"plan_data"`     // JSON blob: TestExecutionPlan
	ImpactData string     `json:"impactData" db:"impact_data"` // JSON blob: ImpactAnalysisResult
	Status     TestStatus `json:"status" db:"status"`
	CreatedAt  time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time  `json:"updatedAt" db:"updated_at"`
}

// TestCodeMapping maps a test file to its source files.
type TestCodeMapping struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	TestPath      string    `json:"testPath" db:"test_path"`
	SourcePaths   string    `json:"sourcePaths" db:"source_paths"`     // JSON array
	SymbolMapping string    `json:"symbolMapping" db:"symbol_mapping"` // JSON object
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
}

// TestHistoryStats is the computed statistics for a test.
type TestHistoryStats struct {
	TestID              string             `json:"testId"`
	TotalRuns           int                `json:"totalRuns"`
	PassedRuns          int                `json:"passedRuns"`
	FailedRuns          int                `json:"failedRuns"`
	PassRate            float64            `json:"passRate"`
	AvgDuration         float64            `json:"avgDuration"` // ms
	FlakyScore          float64            `json:"flakyScore"`  // 0-100
	ConsecutiveFailures int                `json:"consecutiveFailures"`
	RecentFailures      []string           `json:"recentFailures"`
	History             []TestHistoryEntry `json:"history"`
}

// TestHistoryEntry is a flattened history record for API response.
type TestHistoryEntry struct {
	ExecutionID    string  `json:"executionId"`
	Passed         bool    `json:"passed"`
	Duration       float64 `json:"duration"`
	Timestamp      string  `json:"timestamp"`
	FailureMessage *string `json:"failureMessage"`
	PRID           *string `json:"prId"`
}

// TestFailurePrediction is the failure prediction for a test.
type TestFailurePrediction struct {
	TestID             string   `json:"testId"`
	FailureProbability float64  `json:"failureProbability"` // 0-1
	Reasons            []string `json:"reasons"`
	IsFlaky            bool     `json:"isFlaky"`
}

// TestExecutionPlan is the plan for test execution.
type TestExecutionPlan struct {
	SelectedTests     []SelectedTest   `json:"selectedTests"`
	SkippedTests      []SkippedTest    `json:"skippedTests"`
	EstimatedDuration float64          `json:"estimatedDuration"` // ms
	Grouping          []TestGroup      `json:"grouping"`
	Ordering          OrderingStrategy `json:"ordering"`
	PlanID            string           `json:"planId"`
	CreatedAt         string           `json:"createdAt"`
}

// SelectedTest represents a test to be executed.
type SelectedTest struct {
	ID                string         `json:"id"`
	Type              string         `json:"type"` // suite or case
	Priority          ImpactPriority `json:"priority"`
	EstimatedDuration float64        `json:"estimatedDuration"` // ms
	Reason            string         `json:"reason"`
}

// SkippedTest represents a test that should be skipped.
type SkippedTest struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

// TestGroup represents a parallel group of tests.
type TestGroup struct {
	GroupID           string   `json:"groupId"`
	TestIDs           []string `json:"testIds"`
	EstimatedDuration float64  `json:"estimatedDuration"` // ms
	ParallelIndex     int      `json:"parallelIndex"`
}

// TestImpact represents the impact analysis result.
type TestImpact struct {
	ChangedFile       string         `json:"changedFile"`
	ChangeType        ChangeType     `json:"changeType"`
	AffectedTests     []string       `json:"affectedTests"`
	Priority          ImpactPriority `json:"priority"`
	EstimatedDuration float64        `json:"estimatedDuration"` // ms
	ImpactScore       float64        `json:"impactScore"`       // 0-100
}

// ImpactAnalysisResult holds the full impact analysis output.
type ImpactAnalysisResult struct {
	Impacts                []TestImpact `json:"impacts"`
	AllAffectedTestIDs     []string     `json:"allAffectedTestIds"`
	TotalEstimatedDuration float64      `json:"totalEstimatedDuration"` // ms
}

// ChangedFile represents a file change in a PR.
type ChangedFile struct {
	Path         string     `json:"path" binding:"required"`
	ChangeType   ChangeType `json:"changeType" binding:"required"`
	Additions    int        `json:"additions"`
	Deletions    int        `json:"deletions"`
	PreviousPath *string    `json:"previousPath"`
}

// PRChange represents the PR change request body.
type PRChange struct {
	PRID         string        `json:"prId" binding:"required"`
	RepoID       string        `json:"repoId" binding:"required"`
	SourceBranch string        `json:"sourceBranch" binding:"required"`
	TargetBranch string        `json:"targetBranch" binding:"required"`
	ChangedFiles []ChangedFile `json:"changedFiles" binding:"required"`
}

// TestSelectorConfig holds configuration for test selection.
type TestSelectorConfig struct {
	MaxExecutionTimeMs   int              `json:"maxExecutionTimeMs"`
	Ordering             OrderingStrategy `json:"ordering"`
	MaxParallelGroups    int              `json:"maxParallelGroups"`
	MaxTestsPerGroup     int              `json:"maxTestsPerGroup"`
	SkipFlakyTests       bool             `json:"skipFlakyTests"`
	FlakyThreshold       float64          `json:"flakyThreshold"`
	MinImpactScore       float64          `json:"minImpactScore"`
	HistoryRetentionDays int              `json:"historyRetentionDays"`
}

// RecordTestResultRequest is the body for POST /record.
type RecordTestResultRequest struct {
	TestID         string  `json:"testId" binding:"required"`
	Passed         bool    `json:"passed" binding:"required"`
	Duration       float64 `json:"duration" binding:"required"`
	FailureMessage *string `json:"failureMessage"`
	PRID           *string `json:"prId"`
}

// SelectTestsResponse is returned by POST /select.
type SelectTestsResponse struct {
	Plan *TestExecutionPlan `json:"plan"`
}

// PRTestResultResponse is returned by GET /pr/:prId.
type PRTestResultResponse struct {
	PRID      string                `json:"prId"`
	Plan      *TestExecutionPlan    `json:"plan"`
	Impact    *ImpactAnalysisResult `json:"impact"`
	Status    TestStatus            `json:"status"`
	CreatedAt string                `json:"createdAt"`
	UpdatedAt string                `json:"updatedAt"`
}

// CoverageStats is returned by GET /coverage.
type CoverageStats map[string]CoverageEntry

// CoverageEntry holds per-source-file coverage info.
type CoverageEntry struct {
	TestCount int      `json:"testCount"`
	TestIDs   []string `json:"testIds"`
}

// CreateTestSuiteRequest is the body for POST /test-suites.
type CreateTestSuiteRequest struct {
	Name        string   `json:"name" binding:"required"`
	FilePath    string   `json:"filePath" binding:"required"`
	SourceFiles []string `json:"sourceFiles"`
}

// UpdateTestSuiteRequest is the body for PUT /test-suites/:id.
type UpdateTestSuiteRequest struct {
	Name        *string   `json:"name"`
	TestCount   *int      `json:"testCount"`
	SourceFiles *[]string `json:"sourceFiles"`
}

// RecommendationRequest is the body for POST /recommend.
type RecommendationRequest struct {
	ChangedFiles []ChangedFile `json:"changedFiles" binding:"required"`
	PRID         string        `json:"prId"`
}

// TestSelectorStats holds summary statistics.
type TestSelectorStats struct {
	TotalSuites int `json:"totalSuites"`
	TotalCases  int `json:"totalCases"`
	FlakyCount  int `json:"flakyCount"`
}
