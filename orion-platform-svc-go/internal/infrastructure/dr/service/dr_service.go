package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/infrastructure/dr/models"
	"orion/platform-svc-go/internal/infrastructure/dr/repository"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var (
	ErrDRPlanNotFound      = errors.New("DR plan not found")
	ErrFailoverTestNotFound = errors.New("failover test not found")
	ErrBackupConfigNotFound = errors.New("backup config not found")
	ErrPolicyNotFound       = errors.New("DR policy not found")
	ErrInvalidInput         = errors.New("invalid input")
	ErrPlanNotDeletable     = errors.New("DR plan cannot be deleted")
	ErrBackupNotReady       = errors.New("backup is not in completed state")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ─── DR Plan Management ──────────────────────────────────────────────────────

func (s *Service) CreatePlan(ctx context.Context, tenantID string, req *models.CreateDRPlanRequest) (*models.DRPlan, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "CreatePlan")
	defer span.End()

	if req.Name == "" {
		return nil, fmt.Errorf("%w: plan name is required", ErrInvalidInput)
	}
	if req.RTO <= 0 {
		return nil, fmt.Errorf("%w: RTO target must be positive", ErrInvalidInput)
	}
	if req.RPO <= 0 {
		return nil, fmt.Errorf("%w: RPO target must be positive", ErrInvalidInput)
	}

	now := time.Now()
	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}
	failoverStrategy := req.FailoverStrategy
	if failoverStrategy == "" {
		failoverStrategy = "manual"
	}
	createdBy := req.CreatedBy
	if createdBy == "" {
		createdBy = "system"
	}

	var backupRegions models.StringArray
	if req.BackupRegions != nil {
		backupRegions = req.BackupRegions
	} else {
		backupRegions = models.StringArray{}
	}

	var services models.JSONArray
	if req.Services != nil {
		services = models.JSONArray(req.Services)
	} else {
		services = models.JSONArray{}
	}

	plan := &models.DRPlan{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		Name:             req.Name,
		PlanType:         req.PlanType,
		RPO:              req.RPO,
		RTO:              req.RTO,
		Status:           "active",
		Priority:         priority,
		FailoverStrategy: failoverStrategy,
		BackupRegions:    backupRegions,
		Services:         services,
		Config:           models.JSONB{},
		CreatedBy:        createdBy,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	span.SetAttributes(
		attribute.String("dr.plan.id", plan.ID),
		attribute.String("dr.tenant_id", tenantID),
	)

	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		return nil, fmt.Errorf("create plan: %w", err)
	}
	return plan, nil
}

func (s *Service) GetPlan(ctx context.Context, tenantID, id string) (*models.DRPlan, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "GetPlan")
	defer span.End()

	plan, err := s.repo.GetPlanByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrDRPlanNotFound, id)
	}
	return plan, nil
}

func (s *Service) ListPlans(ctx context.Context, tenantID string, offset, limit int) ([]models.DRPlan, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "ListPlans")
	defer span.End()

	return s.repo.ListPlans(ctx, tenantID, offset, limit)
}

func (s *Service) CountPlans(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountPlans(ctx, tenantID)
}

func (s *Service) UpdatePlan(ctx context.Context, tenantID, id string, req *models.UpdateDRPlanRequest) (*models.DRPlan, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "UpdatePlan")
	defer span.End()

	// Verify plan exists
	if _, err := s.repo.GetPlanByID(ctx, tenantID, id); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrDRPlanNotFound, id)
	}

	plan, err := s.repo.UpdatePlan(ctx, tenantID, id, req)
	if err != nil {
		return nil, fmt.Errorf("update plan: %w", err)
	}
	return plan, nil
}

func (s *Service) DeletePlan(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("DRService").Start(ctx, "DeletePlan")
	defer span.End()

	// Verify plan exists
	if _, err := s.repo.GetPlanByID(ctx, tenantID, id); err != nil {
		return fmt.Errorf("%w: %s", ErrDRPlanNotFound, id)
	}

	if err := s.repo.DeletePlan(ctx, tenantID, id); err != nil {
		return fmt.Errorf("delete plan: %w", err)
	}
	return nil
}

// ─── Failover Test Management ────────────────────────────────────────────────

func (s *Service) TriggerFailover(ctx context.Context, tenantID, planID, triggeredBy string) (*models.FailoverTriggerResult, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "TriggerFailover")
	defer span.End()

	plan, err := s.repo.GetPlanByID(ctx, tenantID, planID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrDRPlanNotFound, planID)
	}

	if triggeredBy == "" {
		triggeredBy = "system"
	}

	now := time.Now()
	test := &models.FailoverTest{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		PlanID:           planID,
		TestName:         fmt.Sprintf("Failover - %s - %s", plan.Name, now.Format(time.RFC3339)),
		TestType:         "real",
		StartedAt:        now,
		Result:           "running",
		AffectedServices: extractServiceNames(plan.Services),
		CreatedBy:        triggeredBy,
		CreatedAt:        now,
	}

	if err := s.repo.CreateFailoverTest(ctx, test); err != nil {
		return nil, fmt.Errorf("create failover test: %w", err)
	}

	// Update plan status (best-effort)
	_ = s.repo.UpdatePlanStatus(ctx, tenantID, planID, "failing-over")

	return &models.FailoverTriggerResult{
		ID:        test.ID,
		PlanID:    test.PlanID,
		Status:    "running",
		StartedAt: test.StartedAt,
		Message:   fmt.Sprintf("Failover triggered for plan %q. Services: %d affected.", plan.Name, len(test.AffectedServices)),
	}, nil
}

func (s *Service) TestFailover(ctx context.Context, tenantID, planID, testName, testedBy string) (*models.FailoverTriggerResult, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "TestFailover")
	defer span.End()

	plan, err := s.repo.GetPlanByID(ctx, tenantID, planID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrDRPlanNotFound, planID)
	}

	if testedBy == "" {
		testedBy = "system"
	}
	if testName == "" {
		testName = fmt.Sprintf("DR Drill - %s - %s", plan.Name, time.Now().Format(time.RFC3339))
	}

	now := time.Now()
	test := &models.FailoverTest{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		PlanID:           planID,
		TestName:         testName,
		TestType:         "drill",
		StartedAt:        now,
		Result:           "running",
		AffectedServices: extractServiceNames(plan.Services),
		CreatedBy:        testedBy,
		CreatedAt:        now,
	}

	if err := s.repo.CreateFailoverTest(ctx, test); err != nil {
		return nil, fmt.Errorf("create failover test: %w", err)
	}

	// Update plan status and last tested (best-effort)
	_ = s.repo.UpdatePlanStatus(ctx, tenantID, planID, "testing")
	_ = s.repo.UpdatePlanLastTested(ctx, tenantID, planID, now)

	return &models.FailoverTriggerResult{
		ID:        test.ID,
		PlanID:    test.PlanID,
		Status:    "running",
		StartedAt: test.StartedAt,
		Message:   fmt.Sprintf("DR drill started for plan %q.", plan.Name),
	}, nil
}

func (s *Service) CompleteFailoverTest(ctx context.Context, tenantID, testID string, req *models.CompleteFailoverTestRequest) (*models.FailoverTest, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "CompleteFailoverTest")
	defer span.End()

	// Verify test exists
	test, err := s.repo.GetFailoverTestByID(ctx, tenantID, testID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrFailoverTestNotFound, testID)
	}

	completed, err := s.repo.CompleteFailoverTest(ctx, tenantID, testID, req)
	if err != nil {
		return nil, fmt.Errorf("complete failover test: %w", err)
	}

	// Update plan last tested (best-effort)
	_ = s.repo.UpdatePlanLastTested(ctx, tenantID, test.PlanID, time.Now())

	return completed, nil
}

func (s *Service) GetFailoverTest(ctx context.Context, tenantID, id string) (*models.FailoverTest, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "GetFailoverTest")
	defer span.End()

	test, err := s.repo.GetFailoverTestByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrFailoverTestNotFound, id)
	}
	return test, nil
}

func (s *Service) ListFailoverTests(ctx context.Context, tenantID string, planID *string) ([]models.FailoverTest, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "ListFailoverTests")
	defer span.End()

	return s.repo.ListFailoverTests(ctx, tenantID, planID)
}

// ─── Backup Config Management ────────────────────────────────────────────────

func (s *Service) CreateBackupConfig(ctx context.Context, tenantID string, req *models.CreateBackupConfigRequest) (*models.BackupConfig, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "CreateBackupConfig")
	defer span.End()

	if req.SourceType == "" || req.SourceID == "" {
		return nil, fmt.Errorf("%w: sourceType and sourceId are required", ErrInvalidInput)
	}

	now := time.Now()
	schedule := req.BackupSchedule
	if schedule == "" {
		schedule = "0 2 * * *"
	}
	retentionDays := 30
	if req.RetentionDays != nil {
		retentionDays = *req.RetentionDays
	}
	encryption := true
	if req.Encryption != nil {
		encryption = *req.Encryption
	}
	compression := req.Compression
	if compression == "" {
		compression = "gzip"
	}
	createdBy := req.CreatedBy
	if createdBy == "" {
		createdBy = "system"
	}

	bc := &models.BackupConfig{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		SourceType:      req.SourceType,
		SourceID:        req.SourceID,
		BackupSchedule:  schedule,
		RetentionDays:   retentionDays,
		StorageLocation: req.StorageLocation,
		Encryption:      encryption,
		Compression:     compression,
		LastBackupSize:  0,
		Enabled:         true,
		CreatedBy:       createdBy,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.repo.CreateBackupConfig(ctx, bc); err != nil {
		return nil, fmt.Errorf("create backup config: %w", err)
	}
	return bc, nil
}

func (s *Service) GetBackupConfig(ctx context.Context, tenantID, id string) (*models.BackupConfig, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "GetBackupConfig")
	defer span.End()

	bc, err := s.repo.GetBackupConfigByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBackupConfigNotFound, id)
	}
	return bc, nil
}

func (s *Service) ListBackupConfigs(ctx context.Context, tenantID string, offset, limit int) ([]models.BackupConfig, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "ListBackupConfigs")
	defer span.End()

	return s.repo.ListBackupConfigs(ctx, tenantID, offset, limit)
}

func (s *Service) CountBackupConfigs(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountBackupConfigs(ctx, tenantID)
}

func (s *Service) UpdateBackupConfig(ctx context.Context, tenantID, id string, req *models.UpdateBackupConfigRequest) (*models.BackupConfig, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "UpdateBackupConfig")
	defer span.End()

	// Verify exists
	if _, err := s.repo.GetBackupConfigByID(ctx, tenantID, id); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBackupConfigNotFound, id)
	}

	bc, err := s.repo.UpdateBackupConfig(ctx, tenantID, id, req)
	if err != nil {
		return nil, fmt.Errorf("update backup config: %w", err)
	}
	return bc, nil
}

func (s *Service) DeleteBackupConfig(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("DRService").Start(ctx, "DeleteBackupConfig")
	defer span.End()

	if _, err := s.repo.GetBackupConfigByID(ctx, tenantID, id); err != nil {
		return fmt.Errorf("%w: %s", ErrBackupConfigNotFound, id)
	}

	if err := s.repo.DeleteBackupConfig(ctx, tenantID, id); err != nil {
		return fmt.Errorf("delete backup config: %w", err)
	}
	return nil
}

// ─── RTO/RPO Compliance Tracking ─────────────────────────────────────────────

func (s *Service) GetRTOStatus(ctx context.Context, tenantID string) ([]models.RTOResult, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "GetRTOStatus")
	defer span.End()

	plans, err := s.repo.ListPlans(ctx, tenantID, 0, math.MaxInt64)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}

	results := make([]models.RTOResult, 0, len(plans))
	for _, plan := range plans {
		tests, err := s.repo.ListFailoverTests(ctx, tenantID, &plan.ID)
		if err != nil {
			continue
		}

		result := models.RTOResult{
			PlanID:    plan.ID,
			PlanName:  plan.Name,
			TargetRTO: plan.RTO,
		}

		for _, t := range tests {
			if t.CompletedAt != nil && t.Result != "cancelled" {
				result.LastTestRTO = t.ActualRTO
				result.LastTested = t.CompletedAt
				if t.ActualRTO != nil && *t.ActualRTO <= plan.RTO {
					result.Compliance = "compliant"
				} else {
					result.Compliance = "non-compliant"
				}
				break
			}
		}

		if result.Compliance == "" {
			if plan.LastTested != nil {
				result.LastTested = plan.LastTested
			}
			result.Compliance = "not-tested"
		}

		results = append(results, result)
	}

	return results, nil
}

func (s *Service) GetRPOStatus(ctx context.Context, tenantID string) ([]models.RPOResult, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "GetRPOStatus")
	defer span.End()

	plans, err := s.repo.ListPlans(ctx, tenantID, 0, math.MaxInt64)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}

	results := make([]models.RPOResult, 0, len(plans))
	for _, plan := range plans {
		tests, err := s.repo.ListFailoverTests(ctx, tenantID, &plan.ID)
		if err != nil {
			continue
		}

		result := models.RPOResult{
			PlanID:    plan.ID,
			PlanName:  plan.Name,
			TargetRPO: plan.RPO,
		}

		for _, t := range tests {
			if t.CompletedAt != nil && t.Result != "cancelled" {
				result.LastTestRPO = t.ActualRPO
				result.LastTested = t.CompletedAt
				if t.ActualRPO != nil && *t.ActualRPO <= plan.RPO {
					result.Compliance = "compliant"
				} else {
					result.Compliance = "non-compliant"
				}
				break
			}
		}

		if result.Compliance == "" {
			if plan.LastTested != nil {
				result.LastTested = plan.LastTested
			}
			result.Compliance = "not-tested"
		}

		results = append(results, result)
	}

	return results, nil
}

// ─── DR Drill Scheduling ─────────────────────────────────────────────────────

func (s *Service) ScheduleDrill(ctx context.Context, tenantID string, req *models.ScheduleDrillRequest) (*models.FailoverTest, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "ScheduleDrill")
	defer span.End()

	// Find or validate plan
	var planID string
	if req.PlanID != nil && *req.PlanID != "" {
		planID = *req.PlanID
	} else {
		// Find a plan whose services match the componentType
		plans, err := s.repo.ListPlans(ctx, tenantID, 0, 1000)
		if err != nil {
			return nil, fmt.Errorf("list plans: %w", err)
		}
		found := false
		for _, p := range plans {
			for _, svc := range p.Services {
				if svcMap, ok := svc.(map[string]interface{}); ok {
					if name, ok := svcMap["name"].(string); ok && name == req.ComponentType {
						planID = p.ID
						found = true
						break
					}
				} else if svcStr, ok := svc.(string); ok && svcStr == req.ComponentType {
					planID = p.ID
					found = true
					break
				}
			}
			if found {
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("%w: no DR plan found for component %s", ErrDRPlanNotFound, req.ComponentType)
		}
	}

	// Verify plan exists
	plan, err := s.repo.GetPlanByID(ctx, tenantID, planID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrDRPlanNotFound, planID)
	}

	testType := req.TestType
	if testType == "" {
		testType = "scheduled-drill"
	}
	createdBy := req.CreatedBy
	if createdBy == "" {
		createdBy = "system"
	}

	now := time.Now()
	testName := fmt.Sprintf("Scheduled Drill - %s - %s", req.ComponentType, now.Format(time.RFC3339))

	test := &models.FailoverTest{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		PlanID:           plan.ID,
		TestName:         testName,
		TestType:         testType,
		StartedAt:        now,
		Result:           "scheduled",
		AffectedServices: models.StringArray{req.ComponentType},
		CreatedBy:        createdBy,
		CreatedAt:        now,
	}

	_ = plan // plan validated

	if err := s.repo.CreateFailoverTest(ctx, test); err != nil {
		return nil, fmt.Errorf("create drill: %w", err)
	}
	return test, nil
}

func (s *Service) ListDrills(ctx context.Context, tenantID string) ([]models.FailoverTest, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "ListDrills")
	defer span.End()

	return s.repo.ListFailoverTests(ctx, tenantID, nil)
}

// ─── DR Policy Engine ────────────────────────────────────────────────────────

func (s *Service) CreatePolicy(ctx context.Context, tenantID string, req *models.CreatePolicyRequest) (*models.DRPolicy, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "CreatePolicy")
	defer span.End()

	if req.Name == "" {
		return nil, fmt.Errorf("%w: policy name is required", ErrInvalidInput)
	}

	now := time.Now()
	priority := req.Priority
	createdBy := req.CreatedBy
	if createdBy == "" {
		createdBy = "system"
	}

	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	config := models.JSONB{}
	if req.Config != nil {
		config = models.JSONB(req.Config)
	}

	policy := &models.DRPolicy{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: description,
		Services:    models.JSONArray(req.Services),
		Strategy:    req.Strategy,
		RPO:         req.RPO,
		RTO:         req.RTO,
		Priority:    priority,
		Status:      "active",
		Config:      config,
		CreatedBy:   createdBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.CreatePolicy(ctx, policy); err != nil {
		return nil, fmt.Errorf("create policy: %w", err)
	}
	return policy, nil
}

func (s *Service) GetPolicy(ctx context.Context, tenantID, id string) (*models.DRPolicy, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "GetPolicy")
	defer span.End()

	policy, err := s.repo.GetPolicyByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrPolicyNotFound, id)
	}
	return policy, nil
}

func (s *Service) ListPolicies(ctx context.Context, tenantID string, offset, limit int) ([]models.DRPolicy, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "ListPolicies")
	defer span.End()

	return s.repo.ListPolicies(ctx, tenantID, offset, limit)
}

func (s *Service) CountPolicies(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountPolicies(ctx, tenantID)
}

func (s *Service) UpdatePolicy(ctx context.Context, tenantID, id string, req *models.UpdatePolicyRequest) (*models.DRPolicy, error) {
	ctx, span := otel.Tracer("DRService").Start(ctx, "UpdatePolicy")
	defer span.End()

	if _, err := s.repo.GetPolicyByID(ctx, tenantID, id); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrPolicyNotFound, id)
	}

	policy, err := s.repo.UpdatePolicy(ctx, tenantID, id, req)
	if err != nil {
		return nil, fmt.Errorf("update policy: %w", err)
	}
	return policy, nil
}

func (s *Service) DeletePolicy(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("DRService").Start(ctx, "DeletePolicy")
	defer span.End()

	if _, err := s.repo.GetPolicyByID(ctx, tenantID, id); err != nil {
		return fmt.Errorf("%w: %s", ErrPolicyNotFound, id)
	}

	if err := s.repo.DeletePolicy(ctx, tenantID, id); err != nil {
		return fmt.Errorf("delete policy: %w", err)
	}
	return nil
}

// CanFailover checks if a policy allows failover to a target region.
// Active-active allows any region; active-passive blocks by default.
func (s *Service) CanFailover(policy *models.DRPolicy, targetRegion string) bool {
	if policy.Strategy == "active-active" {
		return true
	}
	if config, ok := policy.Config["allowed_regions"]; ok {
		if regions, ok := config.([]interface{}); ok {
			for _, r := range regions {
				if rStr, ok := r.(string); ok && rStr == targetRegion {
					return true
				}
			}
			return false
		}
	}
	return policy.Strategy != "active-passive"
}

// CheckCompliance checks RTO/RPO compliance against actual values.
// Duration strings like "5m", "1h", "30s" are parsed to seconds.
func (s *Service) CheckCompliance(policy *models.DRPolicy, actualRTO, actualRPO int) bool {
	policyRTO := parseDuration(policy.RTO)
	policyRPO := parseDuration(policy.RPO)
	return actualRTO <= policyRTO && actualRPO <= policyRPO
}

// GetFailoverCostEstimate returns a cost estimate based on strategy and service count.
func (s *Service) GetFailoverCostEstimate(strategy string, serviceCount int) *models.FailoverCostEstimate {
	baseCosts := map[string]int{
		"active-active":  0,
		"active-passive": 100,
		"warm-standby":   500,
		"cold-standby":   1000,
	}
	base := baseCosts[strategy]
	return &models.FailoverCostEstimate{
		Strategy:     strategy,
		ServiceCount: serviceCount,
		CostEstimate: base + serviceCount*10,
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// extractServiceNames extracts service names from the services JSONArray.
func extractServiceNames(services models.JSONArray) models.StringArray {
	names := make(models.StringArray, 0, len(services))
	for _, s := range services {
		switch v := s.(type) {
		case string:
			names = append(names, v)
		case map[string]interface{}:
			if name, ok := v["name"].(string); ok {
				names = append(names, name)
			} else {
				names = append(names, "unknown")
			}
		default:
			names = append(names, "unknown")
		}
	}
	return names
}

// durationRe matches duration strings like "5m", "1h", "30s".
var durationRe = regexp.MustCompile(`^(\d+)([smh]?)$`)

// parseDuration parses duration strings like "5m", "1h", "30s" to seconds.
func parseDuration(duration string) int {
	matches := durationRe.FindStringSubmatch(duration)
	if matches == nil {
		return 0
	}
	value, _ := strconv.Atoi(matches[1])
	unit := matches[2]
	switch unit {
	case "s":
		return value
	case "m":
		return value * 60
	case "h":
		return value * 3600
	default:
		return value
	}
}
