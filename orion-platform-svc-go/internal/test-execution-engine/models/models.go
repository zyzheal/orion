package models

import "time"

type TestFramework string

const (
	FrameworkJUnit   TestFramework = "junit"
	FrameworkTestNG  TestFramework = "testng"
	FrameworkPyTest  TestFramework = "pytest"
	FrameworkGoTest  TestFramework = "go_test"
	FrameworkCustom  TestFramework = "custom"
)

type TestStatus string

const (
	TestStatusPending   TestStatus = "pending"
	TestStatusRunning   TestStatus = "running"
	TestStatusPassed    TestStatus = "passed"
	TestStatusFailed    TestStatus = "failed"
	TestStatusSkipped   TestStatus = "skipped"
	TestStatusError     TestStatus = "error"
	TestStatusCancelled TestStatus = "cancelled"
)

type TestExecution struct {
	ID          string       `json:"id" db:"id"`
	TenantID    string       `json:"tenantId" db:"tenant_id"`
	Name        string       `json:"name" db:"name"`
	Framework   TestFramework `json:"framework" db:"framework"`
	Status      TestStatus   `json:"status" db:"status"`
	TotalTests  int          `json:"totalTests" db:"total_tests"`
	Passed      int          `json:"passed" db:"passed"`
	Failed      int          `json:"failed" db:"failed"`
	Skipped     int          `json:"skipped" db:"skipped"`
	Errors      int          `json:"errors" db:"errors"`
	DurationMS  int64        `json:"durationMs" db:"duration_ms"`
	ReportURL   string       `json:"reportUrl" db:"report_url"`
	TriggeredBy string       `json:"triggeredBy" db:"triggered_by"`
	PipelineID  string       `json:"pipelineId" db:"pipeline_id"`
	CreatedAt   time.Time    `json:"createdAt" db:"created_at"`
	CompletedAt *time.Time   `json:"completedAt" db:"completed_at"`
}

type TestSuite struct {
	ID          string       `json:"id" db:"id"`
	ExecutionID string       `json:"executionId" db:"execution_id"`
	Name        string       `json:"name" db:"name"`
	Tests       int          `json:"tests" db:"tests"`
	Passed      int          `json:"passed" db:"passed"`
	Failed      int          `json:"failed" db:"failed"`
	Skipped     int          `json:"skipped" db:"skipped"`
	DurationMS  int64        `json:"durationMs" db:"duration_ms"`
}

type TestCase struct {
	ID         string     `json:"id" db:"id"`
	SuiteID    string     `json:"suiteId" db:"suite_id"`
	Name       string     `json:"name" db:"name"`
	ClassName  string     `json:"className" db:"class_name"`
	Status     TestStatus `json:"status" db:"status"`
	DurationMS int64      `json:"durationMs" db:"duration_ms"`
	ErrorMsg   string     `json:"errorMsg" db:"error_msg"`
	StackTrace string     `json:"stackTrace" db:"stack_trace"`
}

type CreateExecutionRequest struct {
	Name       string       `json:"name" binding:"required"`
	Framework  TestFramework `json:"framework" binding:"required"`
	PipelineID string       `json:"pipelineId"`
	TestPaths  []string     `json:"testPaths"`
}

type SubmitResultRequest struct {
	Framework  TestFramework `json:"framework" binding:"required"`
	TotalTests int           `json:"totalTests" binding:"required"`
	Passed     int           `json:"passed"`
	Failed     int           `json:"failed"`
	Skipped    int           `json:"skipped"`
	Errors     int           `json:"errors"`
	DurationMS int64         `json:"durationMs"`
	ReportURL  string        `json:"reportUrl"`
	Suites     []TestSuiteInput `json:"suites"`
}

type TestSuiteInput struct {
	Name      string           `json:"name" binding:"required"`
	Tests     int              `json:"tests"`
	Passed    int              `json:"passed"`
	Failed    int              `json:"failed"`
	Skipped   int              `json:"skipped"`
	DurationMS int64           `json:"durationMs"`
	TestCases []TestCaseInput  `json:"testCases"`
}

type TestCaseInput struct {
	Name       string     `json:"name" binding:"required"`
	ClassName  string     `json:"className"`
	Status     TestStatus `json:"status"`
	DurationMS int64      `json:"durationMs"`
	ErrorMsg   string     `json:"errorMsg"`
	StackTrace string     `json:"stackTrace"`
}

type ListExecutionsQuery struct {
	Page     int          `form:"page"`
	PageSize int          `form:"pageSize"`
	Status   *TestStatus  `form:"status"`
	PipelineID string     `form:"pipelineId"`
}

type ExecutionListResponse struct {
	Items    []TestExecution `json:"items"`
	Total    int             `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"pageSize"`
}