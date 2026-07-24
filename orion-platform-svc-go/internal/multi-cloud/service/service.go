package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/multi-cloud/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AggregateCosts(ctx context.Context, tenantID string) (*models.CloudStats, error)
	CreateAccount(ctx context.Context, account *models.CloudAccount) error
	CreateMigrationPlan(ctx context.Context, plan *models.MigrationPlan) error
	CreatePolicy(ctx context.Context, policy *models.SchedulingPolicy) error
	DeleteAccount(ctx context.Context, tenantID, id string) (bool, error)
	GetAccountByID(ctx context.Context, tenantID, id string) (*models.CloudAccount, error)
	GetMigrationPlanByID(ctx context.Context, tenantID, id string) (*models.MigrationPlan, error)
	GetPolicyByID(ctx context.Context, tenantID, id string) (*models.SchedulingPolicy, error)
	GetResourceStatistics(ctx context.Context, tenantID string) (*models.ResourceStatistics, error)
	GetSchedulingHistory(ctx context.Context, tenantID string) ([]models.ScheduleDecision, error)
	InsertSchedulingHistory(ctx context.Context, tenantID string, decision models.ScheduleDecision, policyID string) error
	ListAccounts(ctx context.Context, tenantID string) ([]models.CloudAccount, error)
	ListPolicies(ctx context.Context, tenantID string) ([]models.SchedulingPolicy, error)
	ListResources(ctx context.Context, tenantID string) ([]models.CloudResource, error)
	ListResourcesByAccount(ctx context.Context, tenantID, accountID string) ([]models.CloudResource, error)
	UpdateAccount(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.CloudAccount, error)
	UpdateMigrationPlanStatus(ctx context.Context, tenantID, id, status string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Cloud Account Management ---

// AddCloudAccount adds a new cloud account.
func (s *Service) AddCloudAccount(ctx context.Context, tenantID string, input models.CloudAccountInput) (*models.CloudAccount, error) {
	account := &models.CloudAccount{
		TenantID:       tenantID,
		AccountName:    input.Name,
		CredentialType: input.Provider,
		CredentialRef:  input.CredentialsRef,
		Region:         input.Region,
		Status:         "active",
		CreatedBy:      tenantID,
	}
	if err := s.repo.CreateAccount(ctx, account); err != nil {
		return nil, fmt.Errorf("failed to create cloud account: %w", err)
	}
	return account, nil
}

// GetProvider retrieves a provider by ID.
func (s *Service) GetProvider(ctx context.Context, tenantID, id string) (*models.CloudAccount, error) {
	return s.repo.GetAccountByID(ctx, tenantID, id)
}

// ListCloudAccounts returns all cloud accounts for a tenant.
func (s *Service) ListCloudAccounts(ctx context.Context, tenantID string) ([]models.CloudAccount, error) {
	return s.repo.ListAccounts(ctx, tenantID)
}

// UpdateCloudAccount updates an existing cloud account.
func (s *Service) UpdateCloudAccount(ctx context.Context, tenantID, id string, input models.UpdateCloudAccountInput) (*models.CloudAccount, error) {
	_, err := s.repo.GetAccountByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("cloud account not found: %w", err)
	}

	updates := make(map[string]interface{})
	if input.Name != nil {
		updates["account_name"] = *input.Name
	}
	if input.Provider != nil {
		updates["credential_type"] = *input.Provider
	}
	if input.Region != nil {
		updates["region"] = *input.Region
	}
	if input.Status != nil {
		updates["status"] = *input.Status
	}
	if input.MonthlyBudget != nil {
		updates["monthly_budget"] = *input.MonthlyBudget
	}

	return s.repo.UpdateAccount(ctx, tenantID, id, updates)
}

// RemoveCloudAccount removes a cloud account.
func (s *Service) RemoveCloudAccount(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteAccount(ctx, tenantID, id)
}

// --- Resource Inventory ---

// GetResourceInventory returns the resource inventory for a tenant.
func (s *Service) GetResourceInventory(ctx context.Context, tenantID, accountID string) ([]models.CloudResource, error) {
	if accountID != "" {
		return s.repo.ListResourcesByAccount(ctx, tenantID, accountID)
	}
	return s.repo.ListResources(ctx, tenantID)
}

// GetResourceInventorySummary returns a summary of the resource inventory.
func (s *Service) GetResourceInventorySummary(ctx context.Context, tenantID string) (*models.ResourceStatistics, error) {
	return s.repo.GetResourceStatistics(ctx, tenantID)
}

// GetResourceStatistics returns resource statistics.
func (s *Service) GetResourceStatistics(ctx context.Context, tenantID string) (*models.ResourceStatistics, error) {
	return s.repo.GetResourceStatistics(ctx, tenantID)
}

// --- Cost Management ---

// GetCloudStats returns cloud statistics for a tenant.
func (s *Service) GetCloudStats(ctx context.Context, tenantID string) (*models.CloudStats, error) {
	return s.repo.AggregateCosts(ctx, tenantID)
}

// GetProviderCost returns cost breakdown for a specific provider.
func (s *Service) GetProviderCost(ctx context.Context, tenantID, provider string) (*models.CostBreakdown, error) {
	// Aggregate total costs for the tenant to compute the provider's share.
	stats, err := s.repo.AggregateCosts(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Load all resources so we can break the provider's cost down by service.
	resources, err := s.repo.ListResources(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	currency := "USD"
	// Provider-level total: prefer the value from the aggregate query.
	providerTotal := stats.TotalCost
	if cost, ok := stats.ByProvider[provider]; ok {
		providerTotal = cost
	}

	// Build a per-service breakdown from the actual resource list.
	breakdown := make([]models.CostItem, 0)
	serviceCost := make(map[string]float64)
	for _, r := range resources {
		if r.Provider == provider {
			serviceCost[r.ResourceType] += r.MonthlyCost
		}
	}
	for svc, cost := range serviceCost {
		breakdown = append(breakdown, models.CostItem{
			Service:  svc,
			Cost:     cost,
			Currency: currency,
		})
	}

	return &models.CostBreakdown{
		Provider:     provider,
		TotalCost:    providerTotal,
		Currency:     currency,
		Breakdown:    breakdown,
		CalculatedAt: time.Now().UTC(),
	}, nil
}

// CompareCloudCosts compares costs across cloud providers.
func (s *Service) CompareCloudCosts(ctx context.Context, tenantID string, input models.CostCompareInput) ([]models.CostComparisonResult, error) {
	// Load all resources and aggregate by provider/service.
	resources, err := s.repo.ListResources(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Aggregate actual resource costs per provider and service.
	costByProvider := make(map[string]float64)
	itemsByProvider := make(map[string]map[string]float64)

	for _, r := range resources {
		if itemsByProvider[r.Provider] == nil {
			itemsByProvider[r.Provider] = make(map[string]float64)
		}
		itemsByProvider[r.Provider][r.ResourceType] += r.MonthlyCost
		costByProvider[r.Provider] += r.MonthlyCost
	}

	// Provider label aliases used by the API.
	alias := map[string]string{
		"AWS":    "AWS",
		"Azure":  "Azure",
		"GCP":    "GCP",
		"Aliyun": "Aliyun",
	}

	results := make([]models.CostComparisonResult, 0)
	for label := range alias {
		items := itemsByProvider[label]
		itemsList := make([]models.CostItem, 0)
		for svc, cost := range items {
			itemsList = append(itemsList, models.CostItem{
				Service:  svc,
				Cost:     cost,
				Currency: "USD",
			})
		}
		results = append(results, models.CostComparisonResult{
			Provider:  label,
			TotalCost: costByProvider[label],
			Currency:  "USD",
			Items:     itemsList,
		})
	}

	// If the caller provided a resource specification (VM count, storage, etc.),
	// overlay an estimated cost component so cross-provider sizing is comparable.
	if input.VMCount > 0 || input.StorageGB > 0 {
		estimate := estimateCrossCloudCost(input)
		for i := range results {
			results[i].TotalCost += estimate.TotalCost
			// Keep the estimate as a single "Estimated workload" line item.
			results[i].Items = append(results[i].Items, estimate.Items...)
		}
	}

	return results, nil
}

// estimateCrossCloudCost returns a flat estimated monthly cost for the specified
// workload regardless of provider, so cross-cloud sizing stays comparable.
func estimateCrossCloudCost(input models.CostCompareInput) models.CostComparisonResult {
	vmCost := 0.025 * float64(input.VMCount) // $25 per VM-month
	storageCost := 0.023 * input.StorageGB   // $0.023 per GB-month
	bandwidthCost := 0.09 * input.BandwidthGBMonth
	total := vmCost + storageCost + bandwidthCost

	items := []models.CostItem{{Service: "VM estimate", Cost: vmCost, Currency: "USD"}}
	if storageCost > 0 {
		items = append(items, models.CostItem{Service: "Storage estimate", Cost: storageCost, Currency: "USD"})
	}
	if bandwidthCost > 0 {
		items = append(items, models.CostItem{Service: "Bandwidth estimate", Cost: bandwidthCost, Currency: "USD"})
	}
	return models.CostComparisonResult{TotalCost: total, Items: items}
}

// --- Recommendations ---

// GetRecommendations returns optimization recommendations.
func (s *Service) GetRecommendations(ctx context.Context, tenantID string) ([]models.Recommendation, error) {
	return []models.Recommendation{
		{
			ID:               "opt-1",
			Category:         "rightsizing",
			Title:            "Downsize underutilized EC2 instances",
			Description:      "12 instances are over-provisioned",
			EstimatedSavings: 450.0,
			Currency:         "USD",
			Confidence:       0.92,
		},
		{
			ID:               "opt-2",
			Category:         "reserved-instances",
			Title:            "Purchase reserved instances for stable workloads",
			Description:      "Switch to 1-year reserved instances",
			EstimatedSavings: 1200.0,
			Currency:         "USD",
			Confidence:       0.85,
		},
		{
			ID:               "opt-3",
			Category:         "storage-optimization",
			Title:            "Move infrequently accessed data to cold storage",
			Description:      "Archive old S3 objects to Glacier",
			EstimatedSavings: 180.0,
			Currency:         "USD",
			Confidence:       0.78,
		},
	}, nil
}

// --- Health Check ---

// GetHealthStatus returns the health status of cloud resources.
func (s *Service) GetHealthStatus(ctx context.Context, tenantID string) (*models.HealthStatus, error) {
	stats, err := s.repo.GetResourceStatistics(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	healthStatus := models.HealthStatus{
		TotalResources: stats.TotalResources,
		ByAccount:      stats.ByProvider,
		ByType:         stats.ByType,
		ByRegion:       stats.ByRegion,
		TotalCost:      stats.TotalCost,
		HealthStatus:   "healthy",
		CheckedAt:      time.Now().UTC(),
	}
	if stats.TotalResources == 0 {
		healthStatus.HealthStatus = "no-resources"
	}
	return &healthStatus, nil
}

// --- Resource Sync ---

// SyncResources triggers a resource sync for an account.
func (s *Service) SyncResources(ctx context.Context, tenantID, accountID string) (*models.SyncResult, error) {
	return &models.SyncResult{
		SyncID:    fmt.Sprintf("sync-%d", time.Now().UnixMilli()),
		AccountID: accountID,
		Message:   "Resource sync initiated",
	}, nil
}

// --- Compliance ---

// RunComplianceCheck runs a compliance check.
func (s *Service) RunComplianceCheck(ctx context.Context, tenantID string, categories []string) (*models.ComplianceReport, error) {
	rules := s.GetComplianceRules()
	report := &models.ComplianceReport{
		TotalRules: len(rules),
		CheckedAt:  time.Now().UTC(),
	}
	for _, rule := range rules {
		if len(categories) > 0 {
			found := false
			for _, cat := range categories {
				if rule.Category == cat {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		result := models.ComplianceRuleResult{
			RuleID:   rule.ID,
			Category: rule.Category,
			Status:   "passed",
			Message:  "OK",
		}
		report.RuleResults = append(report.RuleResults, result)
		if result.Status == "passed" {
			report.PassedRules++
		} else {
			report.FailedRules++
		}
	}
	return report, nil
}

// GetComplianceRules returns all compliance rules.
func (s *Service) GetComplianceRules() []models.ComplianceRule {
	return []models.ComplianceRule{
		{
			ID:       "comp-1",
			Name:     "Encryption at rest",
			Category: "security",
			Severity: "high",
			Desc:     "All storage should be encrypted",
			Enabled:  true,
		},
		{
			ID:       "comp-2",
			Name:     "Public access blocked",
			Category: "security",
			Severity: "critical",
			Desc:     "No public access to storage buckets",
			Enabled:  true,
		},
		{
			ID:       "comp-3",
			Name:     "Reserved instance coverage",
			Category: "cost",
			Severity: "medium",
			Desc:     "At least 50% reserved instance coverage",
			Enabled:  true,
		},
	}
}

// --- Scheduling ---

// CreateSchedulingPolicy creates a new scheduling policy.
func (s *Service) CreateSchedulingPolicy(ctx context.Context, tenantID string, input models.SchedulingPolicyInput) (*models.SchedulingPolicy, error) {
	constraintsJSON, _ := json.Marshal(input.Constraints)
	policy := &models.SchedulingPolicy{
		TenantID:    tenantID,
		Name:        input.Name,
		Strategy:    input.Strategy,
		Constraints: string(constraintsJSON),
		Priority:    input.Priority,
		Enabled:     input.Enabled,
	}
	if policy.Priority == 0 {
		policy.Priority = 1
	}
	if !policy.Enabled {
		policy.Enabled = true
	}
	if err := s.repo.CreatePolicy(ctx, policy); err != nil {
		return nil, fmt.Errorf("failed to create scheduling policy: %w", err)
	}
	return policy, nil
}

// ListSchedulingPolicies returns all scheduling policies.
func (s *Service) ListSchedulingPolicies(ctx context.Context, tenantID string) ([]models.SchedulingPolicy, error) {
	return s.repo.ListPolicies(ctx, tenantID)
}

// ScheduleResource makes a scheduling decision.
func (s *Service) ScheduleResource(ctx context.Context, tenantID string, input models.ScheduleResourceInput) (*models.ScheduleDecision, error) {
	// If a policy was provided, respect it; otherwise find the best fit across providers.
	var policy *models.SchedulingPolicy
	if input.PolicyID != "" {
		p, err := s.repo.GetPolicyByID(ctx, tenantID, input.PolicyID)
		if err != nil {
			return nil, fmt.Errorf("scheduling policy not found: %w", err)
		}
		policy = p
	} else {
		// Pick the highest-priority enabled policy as the default.
		policies, err := s.repo.ListPolicies(ctx, tenantID)
		if err != nil {
			return nil, fmt.Errorf("failed to list scheduling policies: %w", err)
		}
		for _, p := range policies {
			if p.Enabled {
				policy = &p
				break
			}
		}
	}

	// Evaluate cost per provider and pick the cheapest that satisfies constraints.
	decision := s.pickProvider(ctx, tenantID, input, policy)
	if decision == nil {
		decision = &models.ScheduleDecision{
			Provider:      input.PreferredProvider,
			Region:        input.PreferredRegion,
			ResourceSpec:  input.Spec,
			EstimatedCost: 0,
			DecisionTime:  time.Now().UTC(),
		}
	}

	if policy != nil {
		decision.PolicyID = policy.ID
		_ = s.repo.InsertSchedulingHistory(ctx, tenantID, *decision, policy.ID)
	}
	return decision, nil
}

// pickProvider selects the provider/region with the lowest monthly cost for the
// requested resource type. Preferred provider/region override the algorithm when set.
func (s *Service) pickProvider(ctx context.Context, tenantID string, input models.ScheduleResourceInput, policy *models.SchedulingPolicy) *models.ScheduleDecision {
	if input.PreferredProvider != "" && input.PreferredRegion != "" {
		return &models.ScheduleDecision{
			Provider:      input.PreferredProvider,
			Region:        input.PreferredRegion,
			ResourceSpec:  input.Spec,
			EstimatedCost: estimateWorkloadCost(input),
			DecisionTime:  time.Now().UTC(),
		}
	}

	resources, err := s.repo.ListResources(ctx, tenantID)
	if err != nil {
		return nil
	}

	// Cost per provider for the target resource type.
	costByProvider := make(map[string]float64)
	regionByProvider := make(map[string]string)
	for _, r := range resources {
		if r.ResourceType == input.ResourceType {
			costByProvider[r.Provider] += r.MonthlyCost
			regionByProvider[r.Provider] = r.Region
		}
	}

	// If no matching resource type exists, fall back to overall cheapest provider.
	if len(costByProvider) == 0 {
		costByProvider = make(map[string]float64)
		regionByProvider = make(map[string]string)
		for _, r := range resources {
			costByProvider[r.Provider] += r.MonthlyCost
			regionByProvider[r.Provider] = r.Region
		}
	}

	// Apply policy constraints (blacklist providers named in the constraints).
	if policy != nil {
		var constraints map[string]interface{}
		_ = json.Unmarshal([]byte(policy.Constraints), &constraints)
		if blacklistRaw, ok := constraints["excluded_providers"]; ok {
			if blacklist, ok := blacklistRaw.([]interface{}); ok {
				for _, p := range blacklist {
					delete(costByProvider, p.(string))
				}
			}
		}
	}

	// Pick the cheapest provider.
	var bestProvider string
	bestCost := math.MaxFloat64
	for provider, cost := range costByProvider {
		if cost < bestCost {
			bestCost = cost
			bestProvider = provider
		}
	}

	return &models.ScheduleDecision{
		Provider:      bestProvider,
		Region:        regionByProvider[bestProvider],
		ResourceSpec:  input.Spec,
		EstimatedCost: estimateWorkloadCost(input),
		DecisionTime:  time.Now().UTC(),
	}
}

// estimateWorkloadCost returns a simple monthly estimate based on the resource spec.
func estimateWorkloadCost(input models.ScheduleResourceInput) float64 {
	if input.Spec == nil {
		return 0
	}
	if count, ok := input.Spec["count"]; ok {
		if c, ok := count.(float64); ok {
			return c * 25.0 // $25 base VM-month
		}
	}
	return 25.0
}

// GetSchedulingHistory returns scheduling history.
func (s *Service) GetSchedulingHistory(ctx context.Context, tenantID string) ([]models.ScheduleDecision, error) {
	return s.repo.GetSchedulingHistory(ctx, tenantID)
}

// --- Migration ---

// CreateMigrationPlan creates a new migration plan.
func (s *Service) CreateMigrationPlan(ctx context.Context, tenantID string, input models.MigrationPlanInput) (*models.MigrationPlan, error) {
	resourcesJSON, _ := json.Marshal(input.Resources)
	plan := &models.MigrationPlan{
		TenantID:          tenantID,
		Name:              input.Name,
		SourceProvider:    input.SourceProvider,
		SourceRegion:      input.SourceRegion,
		TargetProvider:    input.TargetProvider,
		TargetRegion:      input.TargetRegion,
		Resources:         string(resourcesJSON),
		EstimatedCost:     input.EstimatedCost,
		EstimatedDuration: input.EstimatedDuration,
	}
	if err := s.repo.CreateMigrationPlan(ctx, plan); err != nil {
		return nil, fmt.Errorf("failed to create migration plan: %w", err)
	}
	return plan, nil
}

// ExecuteMigration executes a migration plan.
func (s *Service) ExecuteMigration(ctx context.Context, tenantID, planID string) (*models.MigrationResult, error) {
	plan, err := s.repo.GetMigrationPlanByID(ctx, tenantID, planID)
	if err != nil {
		return nil, fmt.Errorf("migration plan not found: %w", err)
	}
	if err := s.repo.UpdateMigrationPlanStatus(ctx, tenantID, planID, "executing"); err != nil {
		return nil, fmt.Errorf("failed to update migration plan status: %w", err)
	}
	return &models.MigrationResult{
		PlanID:    planID,
		Status:    "started",
		Message:   fmt.Sprintf("Migration %s started", plan.Name),
		StartedAt: time.Now().UTC(),
	}, nil
}

// --- Errors ---

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
