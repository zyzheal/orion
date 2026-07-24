package models

import "time"

// CloudAccount represents a cloud provider account.
type CloudAccount struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenant_id" db:"tenant_id"`
	ProviderID     string    `json:"provider_id" db:"provider_id"`
	AccountName    string    `json:"account_name" db:"account_name"`
	AccountID      string    `json:"account_id" db:"account_id"`
	CredentialType string    `json:"credential_type" db:"credential_type"`
	CredentialRef  string    `json:"credential_ref" db:"credential_ref"`
	Region         string    `json:"region" db:"region"`
	Status         string    `json:"status" db:"status"`
	MonthlyBudget  float64   `json:"monthly_budget" db:"monthly_budget"`
	CurrentSpend   float64   `json:"current_spend" db:"current_spend"`
	Tags           string    `json:"tags" db:"tags"`
	CreatedBy      string    `json:"created_by" db:"created_by"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// CloudAccountInput is the input for creating a cloud account.
type CloudAccountInput struct {
	Name           string                 `json:"name" binding:"required"`
	Provider       string                 `json:"provider" binding:"required"`
	Region         string                 `json:"region" binding:"required"`
	CredentialsRef string                 `json:"credentials_ref" binding:"required"`
	Metadata       map[string]interface{} `json:"metadata"`
}

// UpdateCloudAccountInput is the input for updating a cloud account.
type UpdateCloudAccountInput struct {
	Name          *string  `json:"name"`
	Provider      *string  `json:"provider"`
	Region        *string  `json:"region"`
	Status        *string  `json:"status"`
	MonthlyBudget *float64 `json:"monthly_budget"`
}

// CloudResource represents a cloud resource.
type CloudResource struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	AccountID    string    `json:"account_id" db:"account_id"`
	Provider     string    `json:"provider" db:"provider"`
	ResourceID   string    `json:"resource_id" db:"resource_id"`
	ResourceType string    `json:"resource_type" db:"resource_type"`
	Region       string    `json:"region" db:"region"`
	Name         string    `json:"name" db:"name"`
	Status       string    `json:"status" db:"status"`
	MonthlyCost  float64   `json:"monthly_cost" db:"monthly_cost"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// CloudStats represents cloud cost statistics.
type CloudStats struct {
	TotalCost      float64            `json:"total_cost"`
	TotalResources int                `json:"total_resources"`
	ByProvider     map[string]float64 `json:"by_provider"`
	ByRegion       map[string]float64 `json:"by_region"`
	ByAccount      map[string]float64 `json:"by_account"`
	ByType         map[string]float64 `json:"by_type"`
	CalculatedAt   time.Time          `json:"calculated_at"`
}

// CostBreakdown represents a cost breakdown for a provider.
type CostBreakdown struct {
	Provider     string     `json:"provider"`
	TotalCost    float64    `json:"total_cost"`
	Currency     string     `json:"currency"`
	Breakdown    []CostItem `json:"breakdown"`
	CalculatedAt time.Time  `json:"calculated_at"`
}

// CostItem represents a single cost item.
type CostItem struct {
	Service  string  `json:"service"`
	Cost     float64 `json:"cost"`
	Currency string  `json:"currency"`
}

// CostCompareInput is the input for cost comparison.
type CostCompareInput struct {
	VMCount          int     `json:"vm_count"`
	VMType           string  `json:"vm_type"`
	StorageGB        float64 `json:"storage_gb"`
	BandwidthGBMonth float64 `json:"bandwidth_gb_month"`
}

// CostComparisonResult is the result of a cost comparison.
type CostComparisonResult struct {
	Provider  string     `json:"provider"`
	TotalCost float64    `json:"total_cost"`
	Currency  string     `json:"currency"`
	Items     []CostItem `json:"items"`
}

// Recommendation represents a cost optimization recommendation.
type Recommendation struct {
	ID               string  `json:"id"`
	Category         string  `json:"category"`
	Title            string  `json:"title"`
	Description      string  `json:"description"`
	EstimatedSavings float64 `json:"estimated_savings"`
	Currency         string  `json:"currency"`
	Confidence       float64 `json:"confidence"`
}

// HealthStatus represents the health status of cloud resources.
type HealthStatus struct {
	TotalResources int            `json:"total_resources"`
	ByAccount      map[string]int `json:"by_account"`
	ByType         map[string]int `json:"by_type"`
	ByRegion       map[string]int `json:"by_region"`
	TotalCost      float64        `json:"total_cost"`
	HealthStatus   string         `json:"health_status"`
	CheckedAt      time.Time      `json:"checked_at"`
}

// ResourceStatistics represents resource statistics.
type ResourceStatistics struct {
	TotalResources int            `json:"total_resources"`
	ByProvider     map[string]int `json:"by_provider"`
	ByRegion       map[string]int `json:"by_region"`
	ByType         map[string]int `json:"by_type"`
	TotalCost      float64        `json:"total_cost"`
}

// SyncResult represents the result of a resource sync.
type SyncResult struct {
	SyncID    string `json:"sync_id"`
	AccountID string `json:"account_id"`
	Provider  string `json:"provider"`
	Message   string `json:"message"`
}

// ComplianceCheckInput is the input for compliance check.
type ComplianceCheckInput struct {
	Categories []string `json:"categories"`
}

// ComplianceReport is the result of a compliance check.
type ComplianceReport struct {
	TotalRules  int                    `json:"total_rules"`
	PassedRules int                    `json:"passed_rules"`
	FailedRules int                    `json:"failed_rules"`
	RuleResults []ComplianceRuleResult `json:"rule_results"`
	CheckedAt   time.Time              `json:"checked_at"`
}

// ComplianceRuleResult is the result of a single compliance rule.
type ComplianceRuleResult struct {
	RuleID   string `json:"rule_id"`
	Category string `json:"category"`
	Status   string `json:"status"`
	Message  string `json:"message"`
}

// ComplianceRule represents a compliance rule.
type ComplianceRule struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Category string `json:"category"`
	Severity string `json:"severity"`
	Desc     string `json:"description"`
	Enabled  bool   `json:"enabled"`
}

// SchedulingPolicyInput is the input for creating a scheduling policy.
type SchedulingPolicyInput struct {
	Name        string                 `json:"name" binding:"required"`
	Strategy    string                 `json:"strategy" binding:"required"`
	Constraints map[string]interface{} `json:"constraints"`
	Priority    int                    `json:"priority"`
	Enabled     bool                   `json:"enabled"`
}

// SchedulingPolicy represents a scheduling policy.
type SchedulingPolicy struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Strategy    string    `json:"strategy" db:"strategy"`
	Constraints string    `json:"constraints" db:"constraints"`
	Priority    int       `json:"priority" db:"priority"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// ScheduleResourceInput is the input for scheduling a resource.
type ScheduleResourceInput struct {
	ResourceType      string                 `json:"resource_type" binding:"required"`
	Spec              map[string]interface{} `json:"spec"`
	PolicyID          string                 `json:"policy_id"`
	PreferredProvider string                 `json:"preferred_provider"`
	PreferredRegion   string                 `json:"preferred_region"`
}

// ScheduleDecision is the result of a scheduling decision.
type ScheduleDecision struct {
	Provider      string                 `json:"provider"`
	Region        string                 `json:"region"`
	ResourceSpec  map[string]interface{} `json:"resource_spec"`
	EstimatedCost float64                `json:"estimated_cost"`
	PolicyID      string                 `json:"policy_id"`
	DecisionTime  time.Time              `json:"decision_time"`
}

// MigrationPlanInput is the input for creating a migration plan.
type MigrationPlanInput struct {
	Name              string   `json:"name" binding:"required"`
	SourceProvider    string   `json:"source_provider" binding:"required"`
	SourceRegion      string   `json:"source_region" binding:"required"`
	TargetProvider    string   `json:"target_provider" binding:"required"`
	TargetRegion      string   `json:"target_region" binding:"required"`
	Resources         []string `json:"resources"`
	EstimatedCost     float64  `json:"estimated_cost"`
	EstimatedDuration int      `json:"estimated_duration"`
}

// MigrationPlan represents a migration plan.
type MigrationPlan struct {
	ID                string    `json:"id" db:"id"`
	TenantID          string    `json:"tenant_id" db:"tenant_id"`
	Name              string    `json:"name" db:"name"`
	SourceProvider    string    `json:"source_provider" db:"source_provider"`
	SourceRegion      string    `json:"source_region" db:"source_region"`
	TargetProvider    string    `json:"target_provider" db:"target_provider"`
	TargetRegion      string    `json:"target_region" db:"target_region"`
	Resources         string    `json:"resources" db:"resources"`
	EstimatedCost     float64   `json:"estimated_cost" db:"estimated_cost"`
	EstimatedDuration int       `json:"estimated_duration" db:"estimated_duration"`
	Status            string    `json:"status" db:"status"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

// MigrationResult represents the result of a migration execution.
type MigrationResult struct {
	PlanID    string    `json:"plan_id"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	StartedAt time.Time `json:"started_at"`
}
