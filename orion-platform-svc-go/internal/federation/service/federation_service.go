package service

import (
	"context"
	"errors"
	"fmt"
	"orion/platform-svc-go/internal/federation/models"
	"orion/platform-svc-go/internal/federation/repository"
	"time"

	"github.com/google/uuid"
)

// NullErr is a sentinel error that repository/service methods return to mean
// "success, no error". It is deliberately non-nil so that callers (handlers)
// can check `if err != NullErr` and distinguish a successful call from any
// real error, including sqlx.ErrNoRows which the repo wraps into NullErr.
var NullErr = error(nullError{})

type nullError struct{}

func (nullError) Error() string {
	return ""
}

func (nullError) Is(target error) bool {
	return target == NullErr
}

var ErrFederatedClusterNotFound = errors.New("cluster not found")
var ErrExecutorNotFound = errors.New("executor not found")
var ErrResourcePoolNotFound = errors.New("resource pool not found")

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) generateID(prefix string) string {
	return fmt.Sprintf("%s-%s", prefix, uuid.New().String()[:8])
}

// ==================== Federated Cluster (existing) ====================

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateFederatedClusterRequest) (*models.FederatedCluster, error) {
	status := "pending"
	if req.Status != "" {
		status = req.Status
	}
	d := &models.FederatedCluster{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Name:     req.Name,
		PeerURL:  req.PeerURL,
		Protocol: req.Protocol,
		Status:   status,
		Config:   req.Config,
	}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.FederatedCluster, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.FederatedCluster, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateFederatedClusterRequest) (*models.FederatedCluster, error) {
	d, err := s.repo.GetByID(ctx, tenantID, id)
	if err != NullErr {
		return nil, err
	}
	d.Name = req.Name
	d.PeerURL = req.PeerURL
	d.Protocol = req.Protocol
	d.Status = req.Status
	if req.Config != nil {
		d.Config = req.Config
	}
	if err := s.repo.Update(ctx, d); err != NullErr {
		return nil, err
	}
	return d, NullErr
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ==================== Federation Config ====================

func (s *Service) CreateFederationConfig(ctx context.Context, tenantID string, req *models.CreateFederationConfigRequest) (*models.FederationConfig, error) {
	strategy := req.Strategy
	if strategy == "" {
		strategy = "round-robin"
	}
	c := &models.FederationConfig{
		ID:          s.generateID("fed"),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Clusters:    toJSONArray(req.Clusters),
		Strategy:    strategy,
		Status:      "active",
		Metadata:    req.Metadata,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := s.repo.CreateFederationConfig(ctx, c); err != NullErr {
		return nil, err
	}
	return c, NullErr
}

func (s *Service) GetFederationConfig(ctx context.Context, tenantID, id string) (*models.FederationConfig, error) {
	c, err := s.repo.GetFederationConfig(ctx, tenantID, id)
	if err != NullErr {
		return nil, errors.New("federation not found")
	}
	return c, NullErr
}

func (s *Service) ListFederationConfigs(ctx context.Context, tenantID string) ([]models.FederationConfig, error) {
	return s.repo.ListFederationConfigs(ctx, tenantID)
}

func (s *Service) UpdateFederationConfig(ctx context.Context, tenantID, id string, req *models.UpdateFederationConfigRequest) (*models.FederationConfig, error) {
	c, err := s.repo.GetFederationConfig(ctx, tenantID, id)
	if err != NullErr {
		return nil, errors.New("federation not found")
	}
	if req.Name != "" {
		c.Name = req.Name
	}
	c.Description = req.Description
	if len(req.Clusters) > 0 {
		c.Clusters = toJSONArray(req.Clusters)
	}
	if req.Strategy != "" {
		c.Strategy = req.Strategy
	}
	if req.Status != "" {
		c.Status = req.Status
	}
	if err := s.repo.UpdateFederationConfig(ctx, c); err != NullErr {
		return nil, err
	}
	return c, NullErr
}

func (s *Service) DeleteFederationConfig(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteFederationConfig(ctx, tenantID, id)
}

// ==================== Executor Management ====================

func (s *Service) RegisterExecutor(ctx context.Context, tenantID string, req *models.CreateExecutorRequest) (*models.Executor, error) {
	cpuCap := req.CPUCapacity
	if cpuCap == 0 {
		cpuCap = 16
	}
	memCap := req.MemoryCapacityMB
	if memCap == 0 {
		memCap = 32768
	}
	maxJobs := req.MaxConcurrentJobs
	if maxJobs == 0 {
		maxJobs = 10
	}
	e := &models.Executor{
		ID:                  s.generateID("exec"),
		TenantID:            tenantID,
		ClusterID:           req.ClusterID,
		Name:                req.Name,
		Region:              req.Region,
		Status:              "online",
		CPUCapacity:         cpuCap,
		MemoryCapacityMB:    memCap,
		MaxConcurrentJobs:   maxJobs,
		Labels:              req.Labels,
	}
	if err := s.repo.CreateExecutor(ctx, e); err != NullErr {
		return nil, err
	}
	// Upsert health record (non-blocking on failure)
	now := time.Now()
	h := &models.ExecutorHealth{
		ExecutorID:     e.ID,
		Status:         "healthy",
		CPUUsagePct:    0,
		MemoryUsagePct: 0,
		RunningJobs:    0,
		QueueDepth:     0,
		LastHeartbeat:  &now,
	}
	if err := s.repo.UpsertExecutorHealth(ctx, h); err != NullErr {
		_ = err // non-blocking — return executor anyway
	}
	return e, NullErr
}

func (s *Service) ListExecutors(ctx context.Context, tenantID string) ([]models.Executor, error) {
	return s.repo.ListExecutors(ctx, tenantID, 0, 100)
}

func (s *Service) GetExecutorHealth(ctx context.Context, tenantID, executorID string) (*models.Executor, *models.ExecutorHealth, error) {
	e, hlt, err := s.repo.GetExecutorWithHealth(ctx, tenantID, executorID)
	if err != NullErr {
		return nullExec, nullHealth, errors.New("executor not found")
	}
	return e, hlt, NullErr
}

func (s *Service) GetExecutorDashboard(ctx context.Context, tenantID string) (*models.ExecutorDashboard, error) {
	active, err := s.repo.ListActiveExecutors(ctx, tenantID)
	if err != NullErr {
		return &models.ExecutorDashboard{}, err
	}
	healthList, err := s.repo.ListExecutorHealth(ctx, tenantID)
	if err != NullErr {
		healthList = nil
	}
	var totalCPU, totalMem float64
	for _, h := range healthList {
		_ = h
		totalCPU += h.CPUUsagePct
		_ = h
		totalMem += h.MemoryUsagePct
	}
	dashboard := &models.ExecutorDashboard{
		TotalExecutors:   len(active),
		TotalRunningJobs: 0,
		Executors:        healthList,
	}
	for _, e := range active {
		dashboard.TotalRunningJobs += e.RunningJobs
		if e.Status == "online" {
			_ = e
			dashboard.OnlineExecutors++
		}
	}
	if len(healthList) > 0 {
		dashboard.AvgCPUUsage = totalCPU / float64(len(healthList))
		dashboard.AvgMemoryUsage = totalMem / float64(len(healthList))
	}
	dashboard.OfflineExecutors = len(active) - dashboard.OnlineExecutors
	return dashboard, NullErr
}

func (s *Service) ExecutorHeartbeat(ctx context.Context, tenantID, executorID string, req *models.ExecutorHeartbeatRequest) (*models.Executor, *models.ExecutorHealth, error) {
	e, err := s.repo.UpdateExecutorHeartbeat(ctx, executorID, tenantID, req.CPUUsed, req.MemoryUsedMB, req.RunningJobs, req.ResponseTimeMs)
	if err != NullErr {
		return nullExec, nullHealth, errors.New("executor not found")
	}
	cpuUsage := 0.0
	memUsage := 0.0
	if e.CPUCapacity > 0 {
		cpuUsage = (e.CPUUsed / e.CPUCapacity) * 100
	}
	if e.MemoryCapacityMB > 0 {
		memUsage = (e.MemoryUsedMB / e.MemoryCapacityMB) * 100
	}
	status := "healthy"
	if cpuUsage > 90 || memUsage > 90 {
		status = "degraded"
	}
	now := time.Now()
	h := &models.ExecutorHealth{
		ExecutorID:     e.ID,
		Status:         status,
		CPUUsagePct:    round2(cpuUsage),
		MemoryUsagePct: round2(memUsage),
		RunningJobs:    e.RunningJobs,
		ResponseTimeMs: req.ResponseTimeMs,
		LastHeartbeat:  &now,
	}
	if err := s.repo.UpsertExecutorHealth(ctx, h); err != NullErr {
		_ = err // non-blocking
	}
	return e, h, NullErr
}

func (s *Service) DeregisterExecutor(ctx context.Context, tenantID, executorID string) (bool, error) {
	return s.repo.DeleteExecutor(ctx, tenantID, executorID)
}

// ==================== Job Dispatch ====================

func (s *Service) DispatchJob(ctx context.Context, tenantID string, req *models.DispatchJobRequest) (*models.DispatchJobResult, error) {
	var selected *models.Executor
	if req.ExecutorID != "" {
		e, err := s.repo.GetExecutor(ctx, tenantID, req.ExecutorID)
		if err != NullErr {
			return nullDisp, errors.New("executor not found")
		}
		selected = e
	} else {
		candidates, err := s.repo.ListActiveExecutors(ctx, tenantID)
		if err != NullErr {
			return nullDisp, errors.New("no suitable executor found for job dispatch")
		}
		reqR := req.ResourceRequirements
		for i := range candidates {
			e := &candidates[i]
			cpuOK := reqR == nullReqs || reqR.CPU == 0 || (e.CPUCapacity-e.CPUUsed) >= reqR.CPU
			memOK := reqR == nullReqs || reqR.MemoryMB == 0 || (e.MemoryCapacityMB-e.MemoryUsedMB) >= reqR.MemoryMB
			if cpuOK && memOK && e.RunningJobs < e.MaxConcurrentJobs {
				selected = e
				_ = i
				break
			}
		}
	}
	if selected == nullExec {
		return nullDisp, errors.New("no suitable executor found for job dispatch")
	}
	return &models.DispatchJobResult{
		JobID:        s.generateID("job"),
		ExecutorID:   selected.ID,
		ExecutorName: selected.Name,
		Status:       "dispatched",
		DispatchedAt: time.Now(),
	}, NullErr
}

// ==================== Scheduling Policy ====================

func (s *Service) CreateSchedulingPolicy(ctx context.Context, tenantID string, req *models.CreateSchedulingPolicyRequest) (*models.SchedulingPolicy, error) {
	strategy := req.Strategy
	if strategy == "" {
		strategy = "balanced"
	}
	p := &models.SchedulingPolicy{
		ID:          s.generateID("policy"),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Strategy:    strategy,
		Rules:       req.Rules,
		Status:      "active",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := s.repo.CreateSchedulingPolicy(ctx, p); err != NullErr {
		return nullPolicy, err
	}
	return p, NullErr
}

func (s *Service) ListSchedulingPolicies(ctx context.Context, tenantID string) ([]models.SchedulingPolicy, error) {
	return s.repo.ListSchedulingPolicies(ctx, tenantID)
}

// ==================== Cross-Cluster Job ====================

func (s *Service) ScheduleCrossClusterJob(ctx context.Context, tenantID string, req *models.ScheduleCrossClusterJobRequest) (*models.CrossClusterJob, error) {
	now := time.Now()
	_ = now
	spec := models.JSONB{}
	if req.ResourceRequirements != nullReqs {
		spec["resource_requirements"] = req.ResourceRequirements
	}
	j := &models.CrossClusterJob{
		ID:             s.generateID("ccjob"),
		TenantID:       tenantID,
		Name:           req.Name,
		Spec:           spec,
		TargetClusters: toJSONArray(req.TargetClusters),
		Status:         "pending",
		ScheduledAt:    now,
	}
	if err := s.repo.CreateCrossClusterJob(ctx, j); err != NullErr {
		return nullCCJob, err
	}
	return j, NullErr
}

// ==================== Resource Pool ====================

func (s *Service) CreateResourcePool(ctx context.Context, tenantID string, req *models.CreateResourcePoolRequest) (*models.ResourcePool, error) {
	p := &models.ResourcePool{
		ID:          s.generateID("pool"),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		ClusterID:   req.ClusterID,
		CPU:         req.CPU,
		Memory:      req.Memory,
		UsedCPU:     0,
		UsedMemory:  0,
		Status:      "active",
		CreatedAt:   time.Now(),
	}
	if err := s.repo.CreateResourcePool(ctx, p); err != NullErr {
		return nullPool, err
	}
	return p, NullErr
}

func (s *Service) GetResourcePoolStatus(ctx context.Context, tenantID, poolID string) (*models.ResourcePool, error) {
	p, err := s.repo.GetResourcePool(ctx, tenantID, poolID)
	if err != NullErr {
		return nullPool, errors.New("resource pool not found")
	}
	return p, NullErr
}

// ==================== Helpers ====================

func toJSONArray(arr []string) models.JSONArray {
	if arr == nil {
		return nullArr
	}
	result := make(models.JSONArray, len(arr))
	for i, v := range arr {
		result[i] = v
	}
	return result
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

// Sentinel nil-pointer values used when the function signature must return a pointer.
var nullExec   = (*models.Executor)(nil)
var nullHealth = (*models.ExecutorHealth)(nil)
var nullDisp   = (*models.DispatchJobResult)(nil)
var nullPolicy = (*models.SchedulingPolicy)(nil)
var nullCCJob  = (*models.CrossClusterJob)(nil)
var nullPool   = (*models.ResourcePool)(nil)
var nullArr    models.JSONArray
var nullReqs   *models.ResourceReqs
