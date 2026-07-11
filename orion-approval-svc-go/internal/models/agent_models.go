package models

// ========== Agent Analysis Request/Response ==========

// RiskAnalysisRequest is the input for risk analysis.
type RiskAnalysisRequest struct {
	Context            *ApprovalAgentContext `json:"context" binding:"required"`
	AnalysisDimensions []string              `json:"analysis_dimensions"`
}

// RiskAnalysisResult is the output of risk analysis.
type RiskAnalysisResult struct {
	RiskScore         int      `json:"risk_score"`
	RiskLevel         int      `json:"risk_level"`
	RiskFactors       []string `json:"risk_factors"`
	Analysis          string   `json:"analysis"`
	Confidence        float64  `json:"confidence"`
	RecommendedAction string   `json:"recommended_action"`
}

// ApproverSuggestionRequest is the input for approver suggestion.
type ApproverSuggestionRequest struct {
	Context            *ApprovalAgentContext `json:"context" binding:"required"`
	CurrentApprovers   []string              `json:"current_approvers"`
	PreferApproverType string                `json:"prefer_approver_type"`
}

// ApproverSuggestionResult is the output of approver suggestion.
type ApproverSuggestionResult struct {
	SuggestedApprovers  []string `json:"suggested_approvers"`
	Reason              string   `json:"reason"`
	Confidence          float64  `json:"confidence"`
	RequiresExpertReview bool    `json:"requires_expert_review"`
}

// EvaluationRequest is the input for AI decision evaluation.
type EvaluationRequest struct {
	Context *ApprovalAgentContext `json:"context" binding:"required"`
}

// EvaluationResult is the output of AI decision evaluation.
type EvaluationResult struct {
	Action            string   `json:"action"`
	Confidence        float64  `json:"confidence"`
	Reason            string   `json:"reason"`
	RiskScore         int      `json:"risk_score"`
	RiskFactors       []string `json:"risk_factors"`
	SuggestedApprover string   `json:"suggested_approver"`
}

// ApprovalAgentContext is the context for AI agent analysis.
type ApprovalAgentContext struct {
	Operation       string                 `json:"operation"`
	Resource        string                 `json:"resource"`
	Requester       string                 `json:"requester"`
	Environment     string                 `json:"environment"`
	RiskLevel       int                    `json:"risk_level"`
	Metadata        map[string]interface{} `json:"metadata"`
}

// ========== Flow Config Request/Response ==========

// FlowMatchRequest is the input for flow matching.
type FlowMatchRequest struct {
	CapabilityID string `json:"capability_id" binding:"required"`
	Environment  string `json:"environment" binding:"required"`
	RiskLevel    int    `json:"risk_level" binding:"required,min=1,max=4"`
}

// CreateFlowConfigRequest is the input for creating a flow config.
type CreateFlowConfigRequest struct {
	Name    string     `json:"name" binding:"required"`
	Nodes   []FlowNode `json:"nodes" binding:"required,min=1"`
	Enabled bool       `json:"enabled"`
}

// UpdateFlowConfigRequest is the input for updating a flow config.
type UpdateFlowConfigRequest struct {
	Name        *string    `json:"name"`
	Description *string    `json:"description"`
	Enabled     *bool      `json:"enabled"`
	Nodes       []FlowNode `json:"nodes"`
	Priority    *int       `json:"priority"`
}
