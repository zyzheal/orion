package models

// ErrorCategory represents the frontend-facing error category.
type ErrorCategory string

const (
	CategoryCompilationError ErrorCategory = "compilation_error"
	CategoryTestFailure      ErrorCategory = "test_failure"
	CategoryDeploymentFail   ErrorCategory = "deployment_failure"
	CategoryInfrastructure   ErrorCategory = "infrastructure_error"
	CategoryTimeout          ErrorCategory = "timeout_error"
	CategoryConfig           ErrorCategory = "configuration_error"
	CategoryUnknown          ErrorCategory = "unknown_error"
)

// ErrorSeverity represents the display severity.
type ErrorSeverity string

const (
	SeverityCritical ErrorSeverity = "critical"
	SeverityWarning  ErrorSeverity = "warning"
	SeverityInfo     ErrorSeverity = "info"
)

// ErrorClassification is the classifier output.
type ErrorClassification struct {
	Type          string `json:"type"`
	ShouldRetry   bool   `json:"shouldRetry"`
	RetryStrategy string `json:"retryStrategy"`
	Confidence    float64 `json:"confidence"`
	Reasoning     string `json:"reasoning"`
}

// PipelineErrorDetail is the response for error detail endpoint.
type PipelineErrorDetail struct {
	ErrorType              ErrorCategory      `json:"errorType"`
	Severity               ErrorSeverity      `json:"severity"`
	HumanReadableMessage   string             `json:"humanReadableMessage"`
	SuggestedFix           []string           `json:"suggestedFix"`
	RawError               string             `json:"rawError"`
	StageName              string             `json:"stageName"`
	Timestamp              string             `json:"timestamp"`
	Classification         *ErrorClassification `json:"classification,omitempty"`
}
